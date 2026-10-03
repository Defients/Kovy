// ============================================================
// Capture-App Toast — canvas-rendered notification shown when the
// capture-app auto-hide runner detects or clears a screen-capture
// application (OBS, Streamlabs, vMix, ShareX, …). Shares the same
// screen location band as the other toasts, with a distinct
// amber/orange accent to signal a privacy-state change.
// ============================================================

interface CaptureAppToastState {
  detected: boolean;
  matched: string[];
  startTime: number;
  alpha: number;
}

let activeToast: CaptureAppToastState | null = null;
const TOAST_DURATION = 4500;
const TOAST_FADE = 500;

export function showCaptureAppToast(
  detected: boolean,
  matched: string[],
  timestamp: number,
): void {
  activeToast = {
    detected,
    matched,
    startTime: timestamp,
    alpha: 0,
  };
}

export function drawCaptureAppToast(
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
  const cw = ctx.canvas.width;
  const toastW = 320;
  const toastH = 56;
  const toastX = cw - toastW - 16;
  const toastY = 160; // below the profile-switch toast (104+56)

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background
  ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.fill();

  // Border — amber accent to signal a privacy/capture-state change
  ctx.strokeStyle = "rgba(255, 180, 60, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.stroke();

  // Header
  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = "rgba(255, 180, 60, 0.95)";
  ctx.fillText(
    activeToast.detected ? "🔴 Capture App Detected" : "🟢 Capture Cleared",
    toastX + 12,
    toastY + 16,
  );

  // Body
  ctx.font = "600 13px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  const body = activeToast.detected
    ? `Hiding from ${activeToast.matched.join(", ") || "capture"}`
    : "Restored — visible to capture";
  ctx.fillText(body, toastX + 12, toastY + 36);

  // Sub
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 150, 180, 0.7)";
  ctx.fillText(
    activeToast.detected ? "Auto-hide enabled (OBS-safe)" : "Auto-hide restored your preference",
    toastX + 12,
    toastY + 50,
  );

  ctx.restore();
}
