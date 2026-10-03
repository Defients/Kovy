// ============================================================
// Screenshot Toast — canvas-rendered notification shown when
// AI captures screenshots. Different styling for manual
// (Ask Kovy) vs periodic triggers, same screen location.
// ============================================================

interface ScreenshotToastState {
  source: "ask-kovy" | "periodic";
  monitorNames: string[];
  startTime: number;
  alpha: number;
}

let activeToast: ScreenshotToastState | null = null;
const TOAST_DURATION = 3500;
const TOAST_FADE = 400;

export function showScreenshotToast(
  source: "ask-kovy" | "periodic",
  monitorNames: string[],
  timestamp: number,
): void {
  activeToast = {
    source,
    monitorNames: [...monitorNames],
    startTime: timestamp,
    alpha: 0,
  };
}

export function drawScreenshotToast(
  ctx: CanvasRenderingContext2D,
  timestamp: number,
): void {
  if (!activeToast) return;

  const elapsed = timestamp - activeToast.startTime;
  if (elapsed > TOAST_DURATION) {
    activeToast = null;
    return;
  }

  // Fade in/out
  if (elapsed < TOAST_FADE) {
    activeToast.alpha = elapsed / TOAST_FADE;
  } else if (elapsed > TOAST_DURATION - TOAST_FADE) {
    activeToast.alpha = (TOAST_DURATION - elapsed) / TOAST_FADE;
  } else {
    activeToast.alpha = 1;
  }

  const alpha = activeToast.alpha;
  const isManual = activeToast.source === "ask-kovy";
  const cw = ctx.canvas.width;

  const toastW = 300;
  const toastH = 20 + activeToast.monitorNames.length * 18 + 8;
  const toastX = cw - toastW - 16;
  const toastY = 104;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background — different colors for manual vs periodic
  const bgColor = isManual
    ? "rgba(10, 14, 24, 0.88)"
    : "rgba(10, 14, 24, 0.75)";
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.fill();

  // Border — cyan for manual, dimmer blue for periodic
  const borderColor = isManual
    ? "rgba(100, 200, 255, 0.5)"
    : "rgba(100, 150, 200, 0.3)";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isManual ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.stroke();

  // Header — icon + label
  const headerColor = isManual
    ? "rgba(100, 200, 255, 0.95)"
    : "rgba(100, 160, 210, 0.85)";
  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = headerColor;
  const icon = isManual ? "📸" : "🔄";
  const headerText = isManual
    ? `${icon} Screenshot captured (Ask Kovy)`
    : `${icon} Screenshot captured (Periodic)`;
  ctx.fillText(headerText, toastX + 12, toastY + 16);

  // Monitor names
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(200, 210, 230, 0.8)";
  activeToast.monitorNames.forEach((name, i) => {
    const itemY = toastY + 32 + i * 18;
    ctx.fillText(`  • ${name}`, toastX + 12, itemY);
  });

  // Privacy note at bottom
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(150, 160, 180, 0.6)";
  ctx.fillText("Sent to OpenRouter — not stored locally", toastX + 12, toastY + toastH - 6);

  ctx.restore();
}
