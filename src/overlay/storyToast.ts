// ============================================================
// Story Toast — canvas-rendered weekly chapter card (v9.0)
//
// Renders a narrative chapter card showing the current week's story.
// Triggered on demand via the `kovy-show-story` custom event or
// automatically when a new chapter is generated.
//
// The card uses a warm amber accent (distinct from chronicle's teal,
// digest's violet, and profile-switch's blue).
// ============================================================

import type { StoryChapter } from "@/engine/storyEngine";

interface StoryToastState {
  chapter: StoryChapter;
  startTime: number;
  durationMs: number;
  alpha: number;
}

let activeToast: StoryToastState | null = null;
const FADE_MS = 450;

// Layout constants
const CARD_W = 360;
const CARD_X_OFFSET = 16;
const CARD_Y = 540; // below the chronicle card
const PADDING = 12;
const LINE_GAP = 6;

export function showStoryToast(
  chapter: StoryChapter,
  autoDismissSec: number,
  timestamp: number,
): void {
  const durationMs = Math.max(2000, Math.min(60000, autoDismissSec * 1000));
  activeToast = { chapter, startTime: timestamp, durationMs, alpha: 0 };
}

export function dismissStoryToast(): void {
  activeToast = null;
}

export function isStoryToastActive(): boolean {
  return activeToast !== null;
}

export function renderStoryToast(ctx: CanvasRenderingContext2D, timestamp: number): void {
  if (!activeToast) return;

  const toast = activeToast;
  const elapsed = timestamp - toast.startTime;

  // Fade in/out
  if (elapsed < FADE_MS) {
    toast.alpha = elapsed / FADE_MS;
  } else if (elapsed > toast.durationMs - FADE_MS) {
    toast.alpha = Math.max(0, (toast.durationMs - elapsed) / FADE_MS);
  } else {
    toast.alpha = 1;
  }

  if (elapsed > toast.durationMs) {
    activeToast = null;
    return;
  }

  const canvas = ctx.canvas;
  const cardX = canvas.width - CARD_W - CARD_X_OFFSET;
  const cardY = CARD_Y;

  ctx.save();
  ctx.globalAlpha = toast.alpha;

  // Calculate card height based on sections
  const sectionHeight = 60; // approximate per section
  const cardH = 80 + toast.chapter.sections.length * sectionHeight + 20;

  // Card background
  ctx.fillStyle = "rgba(30, 25, 20, 0.92)";
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, cardY, CARD_W, cardH, 8);
  ctx.fill();
  ctx.stroke();

  // Title
  ctx.fillStyle = "rgba(251, 191, 36, 0.95)";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(toast.chapter.title, cardX + PADDING, cardY + PADDING + 14);

  // Date range
  ctx.fillStyle = "rgba(200, 180, 160, 0.7)";
  ctx.font = "11px sans-serif";
  const weekStartStr = new Date(toast.chapter.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekEndStr = new Date(toast.chapter.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  ctx.fillText(`${weekStartStr} – ${weekEndStr}`, cardX + PADDING, cardY + PADDING + 30);

  // Sections
  let y = cardY + PADDING + 50;
  for (const section of toast.chapter.sections) {
    // Section heading
    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(section.heading, cardX + PADDING, y);
    y += 16;

    // Section body (word wrap)
    ctx.fillStyle = "rgba(220, 210, 200, 0.9)";
    ctx.font = "11px sans-serif";
    const maxWidth = CARD_W - PADDING * 2;
    const words = section.body.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth) {
        ctx.fillText(line, cardX + PADDING, y);
        y += LINE_GAP + 11;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, cardX + PADDING, y);
      y += LINE_GAP + 11;
    }
    y += 8;
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
