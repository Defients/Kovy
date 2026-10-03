// ============================================================
// Profile Switch Toast — canvas-rendered notification shown when
// a profile auto-switch rule fires. Same screen location as the
// milestone/screenshot toasts, with a distinct violet accent.
// ============================================================

interface ProfileSwitchToastState {
  profileName: string;
  profileIcon: string;
  reason: string;
  startTime: number;
  alpha: number;
}

let activeToast: ProfileSwitchToastState | null = null;
const TOAST_DURATION = 4000;
const TOAST_FADE = 500;

export function showProfileSwitchToast(
  profileName: string,
  profileIcon: string,
  reason: string,
  timestamp: number,
): void {
  activeToast = {
    profileName,
    profileIcon,
    reason,
    startTime: timestamp,
    alpha: 0,
  };
}

export function drawProfileSwitchToast(
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
  const toastW = 300;
  const toastH = 56;
  const toastX = cw - toastW - 16;
  const toastY = 104;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background
  ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.fill();

  // Border — violet accent to distinguish from milestone (gold) and screenshot (cyan)
  ctx.strokeStyle = "rgba(180, 130, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.stroke();

  // Header
  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = "rgba(180, 130, 255, 0.9)";
  ctx.fillText("🔄 Profile Auto-Switched", toastX + 12, toastY + 16);

  // Profile name with icon
  ctx.font = "600 13px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(
    `${activeToast.profileIcon} ${activeToast.profileName}`,
    toastX + 12, toastY + 36,
  );

  // Reason
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "rgba(160, 150, 180, 0.7)";
  ctx.fillText(activeToast.reason, toastX + 12, toastY + 50);

  ctx.restore();
}
