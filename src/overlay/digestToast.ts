// ============================================================
// Companion Digest Toast — canvas-rendered overlay card (v8.2)
//
// Renders a richer, multi-section card summarizing the companion
// relationship: bond level + progress, dominant mood, key stats,
// growth stage, milestone count, and a recent journal highlight.
// Triggered on demand via the `kovy-show-digest` custom event.
//
// The card lives in the right-side toast band (below the other
// toasts) and auto-dismisses after a configurable number of seconds.
// ============================================================

import type { Digest } from "@/engine/digestEngine";

interface DigestToastState {
  digest: Digest;
  startTime: number;
  durationMs: number;
  alpha: number;
}

let activeToast: DigestToastState | null = null;
const FADE_MS = 450;

// Layout constants
const CARD_W = 320;
const CARD_X_OFFSET = 16; // right margin
const CARD_Y = 220; // below the other toasts (milestone 104, profile 104, capture 160)
const PADDING = 12;
const LINE_GAP = 6;

// Mood → emoji + label
const MOOD_GLYPH: Record<string, string> = {
  calm: "🌿 calm",
  curious: "🔍 curious",
  playful: "✨ playful",
  focused: "🎯 focused",
  sleepy: "😴 sleepy",
  excited: "⚡ excited",
  overwhelmed: "😵 overwhelmed",
  shy: "🌸 shy",
  content: "🙂 content",
  anxious: "😟 anxious",
  nostalgic: "🕰️ nostalgic",
  determined: "🔥 determined",
};

// Growth stage → emoji
const STAGE_GLYPH: Record<string, string> = {
  sprout: "🌱 sprout",
  young: "🌿 young",
  mature: "🌳 mature",
  elder: "🌲 elder",
};

export function showDigestToast(digest: Digest, autoDismissSec: number, timestamp: number): void {
  const durationMs = Math.max(2000, Math.min(30000, autoDismissSec * 1000));
  activeToast = {
    digest,
    startTime: timestamp,
    durationMs,
    alpha: 0,
  };
}

export function dismissDigestToast(): void {
  activeToast = null;
}

export function isDigestToastActive(): boolean {
  return activeToast !== null;
}

export function drawDigestToast(ctx: CanvasRenderingContext2D, timestamp: number): void {
  if (!activeToast) return;

  const elapsed = timestamp - activeToast.startTime;
  if (elapsed > activeToast.durationMs) {
    activeToast = null;
    return;
  }

  // Fade in/out
  if (elapsed < FADE_MS) {
    activeToast.alpha = elapsed / FADE_MS;
  } else if (elapsed > activeToast.durationMs - FADE_MS) {
    activeToast.alpha = (activeToast.durationMs - elapsed) / FADE_MS;
  } else {
    activeToast.alpha = 1;
  }

  const { digest, alpha } = activeToast;
  const cw = ctx.canvas.width;
  const cardX = cw - CARD_W - CARD_X_OFFSET;

  // --- Pre-measure content height ---
  const sections: Array<(x: number, y: number) => number> = [];
  let contentH = 0;

  if (digest.bond) {
    sections.push((x, y) => {
      return drawBondSection(ctx, digest, x, y);
    });
  }
  if (digest.mood) {
    sections.push((x, y) => drawMoodSection(ctx, digest, x, y));
  }
  if (digest.stats) {
    sections.push((x, y) => drawStatsSection(ctx, digest, x, y));
  }
  if (digest.growth) {
    sections.push((x, y) => drawGrowthSection(ctx, digest, x, y));
  }
  if (digest.highlight) {
    sections.push((x, y) => drawHighlightSection(ctx, digest, x, y));
  }

  // Measure each section's height
  const heights: number[] = sections.map(fn => fn(0, 0));
  contentH = heights.reduce((a, b) => a + b, 0);

  const headerH = 24;
  const cardH = headerH + contentH + PADDING;

  ctx.save();
  ctx.globalAlpha = alpha;

  // --- Card background ---
  ctx.fillStyle = "rgba(10, 14, 24, 0.9)";
  ctx.beginPath();
  ctx.roundRect(cardX, CARD_Y, CARD_W, cardH, 10);
  ctx.fill();

  // --- Card border — soft violet accent to distinguish from other toasts ---
  ctx.strokeStyle = "rgba(170, 140, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cardX, CARD_Y, CARD_W, cardH, 10);
  ctx.stroke();

  // --- Header ---
  ctx.font = "600 12px sans-serif";
  ctx.fillStyle = "rgba(170, 140, 255, 0.95)";
  ctx.fillText("📖 Companion Digest", cardX + PADDING, CARD_Y + 16);

  // Subtle timestamp on the right of the header
  const timeStr = new Date(digest.generatedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 150, 180, 0.6)";
  ctx.textAlign = "right";
  ctx.fillText(timeStr, cardX + CARD_W - PADDING, CARD_Y + 16);
  ctx.textAlign = "left";

  // --- Sections ---
  let cursorY = CARD_Y + headerH;
  sections.forEach((fn, i) => {
    const h = heights[i];
    const drawn = fn(cardX, cursorY);
    cursorY += drawn;
  });

  ctx.restore();
}

// --- Section renderers. Each returns the height it consumed (>= 0). ---

function drawBondSection(ctx: CanvasRenderingContext2D, digest: Digest, x: number, y: number): number {
  const bond = digest.bond!;
  const innerX = x + PADDING;
  let cy = y + 14;

  // Label
  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("🤝 Bond", innerX, cy);

  // Level + days on the right
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 200, 220, 0.75)";
  ctx.textAlign = "right";
  const levelStr = `${bond.level.replace("_", " ")} · ${bond.daysTogether}d together`;
  ctx.fillText(levelStr, x + CARD_W - PADDING, cy);
  ctx.textAlign = "left";

  // Progress bar
  cy += 10;
  const barW = CARD_W - PADDING * 2;
  const barH = 5;
  const barX = innerX;
  const barY = cy;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2.5);
  ctx.fill();
  const fillW = Math.max(2, barW * Math.max(0, Math.min(1, bond.progress)));
  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, "rgba(170, 140, 255, 0.9)");
  grad.addColorStop(1, "rgba(120, 200, 255, 0.9)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, fillW, barH, 2.5);
  ctx.fill();

  // Streak line
  cy += barH + 12;
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 150, 180, 0.7)";
  ctx.fillText(
    bond.streakDays > 0 ? `🔥 ${bond.streakDays}-day streak` : "Drop by anytime to grow our bond",
    innerX,
    cy,
  );

  return cy + LINE_GAP - y;
}

function drawMoodSection(ctx: CanvasRenderingContext2D, digest: Digest, x: number, y: number): number {
  const innerX = x + PADDING;
  const cy = y + 14;
  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("🎨 Mood", innerX, cy);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 200, 220, 0.75)";
  ctx.textAlign = "right";
  ctx.fillText(MOOD_GLYPH[digest.mood!] ?? digest.mood, x + CARD_W - PADDING, cy);
  ctx.textAlign = "left";
  return 14 + LINE_GAP;
}

function drawStatsSection(ctx: CanvasRenderingContext2D, digest: Digest, x: number, y: number): number {
  const s = digest.stats!;
  const innerX = x + PADDING;
  let cy = y + 14;

  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("📊 Activity", innerX, cy);
  cy += 6;

  // 2-column grid of mini-stats
  const items: Array<[string, string]> = [
    ["🎯 Focus", `${s.focusMinutes}m`],
    ["🎮 Games", `${s.gamingSessions}`],
    ["💭 Thoughts", `${s.thoughts}`],
    ["💬 Whispers", `${s.whispers}`],
    ["♥ Emotes", `${s.emotes}`],
    ["🏆 Best focus", `${s.longestFocusMinutes}m`],
  ];
  const colW = (CARD_W - PADDING * 2) / 2;
  ctx.font = "9px sans-serif";
  for (let i = 0; i < items.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ix = innerX + col * colW;
    const iy = cy + 14 + row * 14;
    ctx.fillStyle = "rgba(160, 150, 180, 0.7)";
    ctx.fillText(items[i][0], ix, iy);
    ctx.fillStyle = "rgba(220, 220, 240, 0.9)";
    ctx.textAlign = "right";
    ctx.fillText(items[i][1], ix + colW - 8, iy);
    ctx.textAlign = "left";
  }
  cy += 14 * (Math.ceil(items.length / 2)) + 4;

  // Milestones + active hours footer
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 150, 180, 0.7)";
  ctx.fillText(
    `🏅 ${digest.milestoneCount} milestones · ⏱ ${digest.activeHours}h active`,
    innerX,
    cy,
  );

  return cy + LINE_GAP - y;
}

function drawGrowthSection(ctx: CanvasRenderingContext2D, digest: Digest, x: number, y: number): number {
  const g = digest.growth!;
  const innerX = x + PADDING;
  const cy = y + 14;
  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("🌱 Growth", innerX, cy);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 200, 220, 0.75)";
  ctx.textAlign = "right";
  const ageStr = `${Math.round(g.ageDays)}d · ${STAGE_GLYPH[g.stage] ?? g.stage}`;
  ctx.fillText(ageStr, x + CARD_W - PADDING, cy);
  ctx.textAlign = "left";
  return 14 + LINE_GAP;
}

function drawHighlightSection(ctx: CanvasRenderingContext2D, digest: Digest, x: number, y: number): number {
  const h = digest.highlight!;
  const innerX = x + PADDING;
  let cy = y + 14;

  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("✨ Recent highlight", innerX, cy);
  cy += 14;

  // Title (truncate to ~38 chars)
  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(220, 220, 240, 0.9)";
  const title = h.title.length > 42 ? h.title.slice(0, 41) + "…" : h.title;
  ctx.fillText(title, innerX, cy);
  cy += 13;

  // Body (wrap to card width, max 2 lines)
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(170, 160, 190, 0.7)";
  const maxW = CARD_W - PADDING * 2;
  const lines = wrapText(ctx, h.body, maxW, 2);
  for (const line of lines) {
    ctx.fillText(line, innerX, cy);
    cy += 12;
  }

  return cy + LINE_GAP - y;
}

// --- Text helper: naive word-wrap to a max width, capped at maxLines ---
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  // Truncate the last line if it overflows the width
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + "…";
  }
  return lines.slice(0, maxLines);
}
