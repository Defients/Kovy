// ============================================================
// Companion Chronicle Toast — canvas-rendered trend card (v8.3)
//
// Renders a longitudinal companion to the Digest: a 7-day bond
// sparkline, the week-over-week bond delta, the current streak, and
// up to two generated insights. Triggered on demand via the
// `kovy-show-chronicle` custom event.
//
// The card uses a teal accent (distinct from the Digest's violet,
// the capture-app amber, and the profile-switch blue) so the three
// on-demand overlay cards are visually distinguishable at a glance.
// ============================================================

import type { ChronicleTrends, ChronicleInsight } from "@/engine/chronicleEngine";

interface ChronicleToastState {
  trends: ChronicleTrends;
  insights: ChronicleInsight[];
  startTime: number;
  durationMs: number;
  alpha: number;
}

let activeToast: ChronicleToastState | null = null;
const FADE_MS = 450;

// Layout constants
const CARD_W = 320;
const CARD_X_OFFSET = 16;
const CARD_Y = 410; // below the digest card (digest starts at 220)
const PADDING = 12;
const LINE_GAP = 6;

const MOOD_GLYPH: Record<string, string> = {
  calm: "🌿", curious: "🔍", playful: "✨", focused: "🎯",
  sleepy: "😴", excited: "⚡", overwhelmed: "😵", shy: "🌸",
  content: "🙂", anxious: "😟", nostalgic: "🕰️", determined: "🔥",
};

export function showChronicleToast(
  trends: ChronicleTrends,
  insights: ChronicleInsight[],
  autoDismissSec: number,
  timestamp: number,
): void {
  const durationMs = Math.max(2000, Math.min(30000, autoDismissSec * 1000));
  activeToast = { trends, insights, startTime: timestamp, durationMs, alpha: 0 };
}

export function dismissChronicleToast(): void {
  activeToast = null;
}

export function isChronicleToastActive(): boolean {
  return activeToast !== null;
}

export function drawChronicleToast(ctx: CanvasRenderingContext2D, timestamp: number): void {
  if (!activeToast) return;

  const elapsed = timestamp - activeToast.startTime;
  if (elapsed > activeToast.durationMs) {
    activeToast = null;
    return;
  }

  if (elapsed < FADE_MS) {
    activeToast.alpha = elapsed / FADE_MS;
  } else if (elapsed > activeToast.durationMs - FADE_MS) {
    activeToast.alpha = (activeToast.durationMs - elapsed) / FADE_MS;
  } else {
    activeToast.alpha = 1;
  }

  const { trends, insights, alpha } = activeToast;
  const cw = ctx.canvas.width;
  const cardX = cw - CARD_W - CARD_X_OFFSET;

  // --- Pre-measure ---
  const sections: Array<(x: number, y: number) => number> = [];
  const heights: number[] = [];

  // Header summary line (streak + snapshot count)
  sections.push((x, y) => drawSummarySection(ctx, trends, x, y));
  // Sparkline + bond delta
  if (trends.bondSparkline.length >= 2) {
    sections.push((x, y) => drawSparklineSection(ctx, trends, x, y));
  } else if (trends.snapshotCount > 0) {
    sections.push((x, y) => drawBondOnlySection(ctx, trends, x, y));
  }
  // Insights (up to 2 in the card to keep it compact)
  if (insights.length > 0) {
    sections.push((x, y) => drawInsightsSection(ctx, insights, x, y));
  }
  // Empty state
  if (trends.snapshotCount === 0) {
    sections.push((x, y) => drawEmptySection(ctx, x, y));
  }

  for (const fn of sections) heights.push(fn(0, 0));
  const contentH = heights.reduce((a, b) => a + b, 0);
  const headerH = 24;
  const cardH = headerH + contentH + PADDING;

  ctx.save();
  ctx.globalAlpha = alpha;

  // --- Card background ---
  ctx.fillStyle = "rgba(8, 18, 22, 0.92)";
  ctx.beginPath();
  ctx.roundRect(cardX, CARD_Y, CARD_W, cardH, 10);
  ctx.fill();

  // --- Teal accent border ---
  ctx.strokeStyle = "rgba(90, 220, 210, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cardX, CARD_Y, CARD_W, cardH, 10);
  ctx.stroke();

  // --- Header ---
  ctx.font = "600 12px sans-serif";
  ctx.fillStyle = "rgba(90, 220, 210, 0.95)";
  ctx.fillText("📜 Companion Chronicle", cardX + PADDING, CARD_Y + 16);

  const timeStr = new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 180, 185, 0.6)";
  ctx.textAlign = "right";
  ctx.fillText(timeStr, cardX + CARD_W - PADDING, CARD_Y + 16);
  ctx.textAlign = "left";

  // --- Sections ---
  let cursorY = CARD_Y + headerH;
  sections.forEach((fn, i) => {
    const h = heights[i];
    fn(cardX, cursorY);
    cursorY += h;
  });

  ctx.restore();
}

// --- Section renderers ---

function drawSummarySection(ctx: CanvasRenderingContext2D, trends: ChronicleTrends, x: number, y: number): number {
  const innerX = x + PADDING;
  const cy = y + 14;

  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("📈 Overview", innerX, cy);

  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 220, 220, 0.75)";
  ctx.textAlign = "right";
  const rightStr = trends.snapshotCount === 0
    ? "no history yet"
    : `${trends.snapshotCount} day${trends.snapshotCount === 1 ? "" : "s"} · ${trends.daysSpan}d span`;
  ctx.fillText(rightStr, x + CARD_W - PADDING, cy);
  ctx.textAlign = "left";

  // Streak + bond delta line
  const cy2 = cy + 14;
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 180, 185, 0.75)";
  const streakStr = trends.currentStreak > 0 ? `🔥 ${trends.currentStreak}-day streak` : "No active streak";
  const deltaStr = trends.bondDeltaWeek !== null
    ? ` · ${trends.bondDeltaWeek >= 0 ? "+" : ""}${trends.bondDeltaWeek} bond/wk`
    : "";
  ctx.fillText(streakStr + deltaStr, innerX, cy2);

  return 14 + 14 + LINE_GAP;
}

function drawSparklineSection(ctx: CanvasRenderingContext2D, trends: ChronicleTrends, x: number, y: number): number {
  const innerX = x + PADDING;
  let cy = y + 14;

  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("🤝 Bond — last 7 days", innerX, cy);
  cy += 8;

  const plotW = CARD_W - PADDING * 2;
  const plotH = 36;
  const plotX = innerX;
  const plotY = cy;

  // Plot background
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.beginPath();
  ctx.roundRect(plotX, plotY, plotW, plotH, 4);
  ctx.fill();

  const pts = trends.bondSparkline;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 4;
  const stepX = (plotW - pad * 2) / (pts.length - 1);

  // Line
  ctx.strokeStyle = "rgba(90, 220, 210, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = plotX + pad + i * stepX;
    const py = plotY + plotH - pad - ((pts[i] - min) / range) * (plotH - pad * 2);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Fill under line
  ctx.lineTo(plotX + pad + (pts.length - 1) * stepX, plotY + plotH - pad);
  ctx.lineTo(plotX + pad, plotY + plotH - pad);
  ctx.closePath();
  ctx.fillStyle = "rgba(90, 220, 210, 0.12)";
  ctx.fill();

  // End dot
  const endX = plotX + pad + (pts.length - 1) * stepX;
  const endY = plotY + plotH - pad - ((pts[pts.length - 1] - min) / range) * (plotH - pad * 2);
  ctx.fillStyle = "rgba(90, 220, 210, 1)";
  ctx.beginPath();
  ctx.arc(endX, endY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  cy += plotH + 4;

  // Min/max labels
  ctx.font = "8px sans-serif";
  ctx.fillStyle = "rgba(160, 180, 185, 0.6)";
  ctx.fillText(`${min}`, plotX, cy + 8);
  ctx.textAlign = "right";
  ctx.fillText(`${max}`, plotX + plotW, cy + 8);
  ctx.textAlign = "left";

  return cy + 8 + LINE_GAP - y;
}

function drawBondOnlySection(ctx: CanvasRenderingContext2D, trends: ChronicleTrends, x: number, y: number): number {
  const innerX = x + PADDING;
  const cy = y + 14;
  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("🤝 Bond", innerX, cy);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 220, 220, 0.75)";
  ctx.textAlign = "right";
  ctx.fillText(`${trends.bondPointsNow} pts`, x + CARD_W - PADDING, cy);
  ctx.textAlign = "left";
  return 14 + LINE_GAP;
}

function drawInsightsSection(ctx: CanvasRenderingContext2D, insights: ChronicleInsight[], x: number, y: number): number {
  const innerX = x + PADDING;
  let cy = y + 14;

  ctx.font = "600 10px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("✨ Insights", innerX, cy);
  cy += 13;

  const maxW = CARD_W - PADDING * 2 - 10; // leave room for a leading dot
  const shown = insights.slice(0, 2);
  for (const ins of shown) {
    const toneColor = ins.tone === "positive"
      ? "rgba(120, 230, 180, 0.9)"
      : ins.tone === "encouraging"
        ? "rgba(255, 200, 130, 0.9)"
        : "rgba(180, 200, 210, 0.85)";
    // Leading dot
    ctx.fillStyle = toneColor;
    ctx.beginPath();
    ctx.arc(innerX + 2, cy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    // Wrapped text
    ctx.font = "9px sans-serif";
    ctx.fillStyle = "rgba(210, 225, 230, 0.85)";
    const lines = wrapText(ctx, ins.text, maxW, 2);
    for (const line of lines) {
      ctx.fillText(line, innerX + 10, cy);
      cy += 12;
    }
    cy += 2;
  }

  return cy + LINE_GAP - y;
}

function drawEmptySection(ctx: CanvasRenderingContext2D, x: number, y: number): number {
  const innerX = x + PADDING;
  const cy = y + 14;
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(170, 190, 195, 0.7)";
  ctx.fillText(
    "The chronicle begins tomorrow. Keep Kovy around and check back",
    innerX, cy,
  );
  ctx.fillText(
    "to see your bond, focus, and mood trends unfold over time.",
    innerX, cy + 12,
  );
  return 14 + 12 + LINE_GAP;
}

// --- Text helper (mirrors digestToast's wrapText) ---
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
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = last + "…";
  }
  return lines.slice(0, maxLines);
}
