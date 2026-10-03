// ============================================================
// Milestone Toast — extracted from KovyRenderer
// Canvas-rendered notification for milestone unlocks
// ============================================================

interface MilestoneToastState {
  milestones: Array<{ id: string; title: string; icon: string }>;
  startTime: number;
  alpha: number;
}

let activeToast: MilestoneToastState | null = null;
const TOAST_DURATION = 4000; // ms
const TOAST_FADE = 500; // ms fade in/out

export function drawMilestoneToast(
  ctx: CanvasRenderingContext2D,
  milestones: Array<{ id: string; title: string; icon: string }>,
  timestamp: number,
): void {
  // Set new toast if milestones were just unlocked
  if (milestones.length > 0) {
    activeToast = {
      milestones: milestones.map(m => ({ id: m.id, title: m.title, icon: m.icon })),
      startTime: timestamp,
      alpha: 0,
    };
  }

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
  const toastW = 280;
  const toastH = 24 + activeToast.milestones.length * 28;
  const toastX = cw - toastW - 16;
  const toastY = 104;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background
  ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(255, 200, 100, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.stroke();

  // Header
  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
  ctx.fillText("✦ Milestone Unlocked", toastX + 12, toastY + 16);

  // Milestone items
  ctx.font = "10px sans-serif";
  activeToast.milestones.forEach((m, i) => {
    const itemY = toastY + 32 + i * 28;
    // Icon
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(m.icon, toastX + 12, itemY);
    // Title
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(m.title, toastX + 32, itemY);
  });

  ctx.restore();
}

// --- Bond level-up toast (shared rendering system) ---

interface BondToastState {
  fromLevel: string;
  toLevel: string;
  startTime: number;
  alpha: number;
}

let activeBondToast: BondToastState | null = null;

export function drawBondLevelUpToast(
  ctx: CanvasRenderingContext2D,
  fromLevel: string,
  toLevel: string,
  timestamp: number,
): void {
  if (fromLevel === toLevel) return;

  // Set new toast
  activeBondToast = {
    fromLevel,
    toLevel,
    startTime: timestamp,
    alpha: 0,
  };
}

export function renderActiveBondToast(
  ctx: CanvasRenderingContext2D,
  timestamp: number,
): void {
  if (!activeBondToast) return;

  const elapsed = timestamp - activeBondToast.startTime;
  if (elapsed > TOAST_DURATION) {
    activeBondToast = null;
    return;
  }

  // Fade in/out
  if (elapsed < TOAST_FADE) {
    activeBondToast.alpha = elapsed / TOAST_FADE;
  } else if (elapsed > TOAST_DURATION - TOAST_FADE) {
    activeBondToast.alpha = (TOAST_DURATION - elapsed) / TOAST_FADE;
  } else {
    activeBondToast.alpha = 1;
  }

  const alpha = activeBondToast.alpha;
  const cw = ctx.canvas.width;
  const toastW = 280;
  const toastH = 52;
  const toastX = cw - toastW - 16;
  const toastY = 104;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(10, 14, 24, 0.85)";
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(100, 200, 255, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(toastX, toastY, toastW, toastH, 8);
  ctx.stroke();

  ctx.font = "600 11px sans-serif";
  ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
  ctx.fillText("🤝 Bond Level Up!", toastX + 12, toastY + 16);

  ctx.font = "600 12px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(
    `${activeBondToast.fromLevel} → ${activeBondToast.toLevel}`,
    toastX + 12, toastY + 36,
  );

  ctx.restore();
}
