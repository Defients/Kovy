// ============================================================
// Aurora Background Renderer — flowing gradient bands that shift
// with circadian phase. Renders behind everything else.
// ============================================================

import type { SurfaceMood } from "@/store/types";

type CircadianPhase = "morning" | "afternoon" | "evening" | "night" | "dawn";

const PHASE_COLORS: Record<CircadianPhase, [string, string]> = {
  morning: ["rgba(255, 200, 100, 0.06)", "rgba(255, 160, 80, 0.04)"],
  afternoon: ["rgba(100, 180, 255, 0.05)", "rgba(80, 200, 220, 0.03)"],
  evening: ["rgba(180, 100, 200, 0.06)", "rgba(220, 120, 180, 0.04)"],
  night: ["rgba(40, 50, 100, 0.08)", "rgba(60, 40, 90, 0.05)"],
  dawn: ["rgba(255, 180, 200, 0.05)", "rgba(200, 160, 220, 0.03)"],
};

export class AuroraBackgroundRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(
    width: number,
    height: number,
    phase: string,
    _mood: SurfaceMood,
    time: number,
    opacity: number,
  ): void {
    const ctx = this.ctx;
    const colors = PHASE_COLORS[phase as CircadianPhase] ?? PHASE_COLORS.afternoon;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Draw 2-3 flowing gradient bands
    const bandCount = 3;
    for (let b = 0; b < bandCount; b++) {
      const baseY = height * (0.2 + b * 0.25);
      const amplitude = height * 0.08;
      const speed = 0.02 + b * 0.01;
      const offset = time * speed + b * Math.PI * 0.7;

      ctx.beginPath();
      ctx.moveTo(0, baseY);

      // Top edge of band
      for (let x = 0; x <= width; x += 8) {
        const y = baseY + Math.sin((x / width) * Math.PI * 3 + offset) * amplitude;
        ctx.lineTo(x, y);
      }

      // Bottom edge of band
      const bandHeight = height * 0.15;
      for (let x = width; x >= 0; x -= 8) {
        const y = baseY + bandHeight + Math.sin((x / width) * Math.PI * 3 + offset + 0.5) * amplitude;
        ctx.lineTo(x, y);
      }

      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY, 0, baseY + bandHeight);
      const colorIdx = b % 2;
      grad.addColorStop(0, colors[colorIdx]);
      grad.addColorStop(0.5, colors[(colorIdx + 1) % 2]);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  }

  renderStatic(
    width: number,
    height: number,
    phase: string,
    opacity: number,
  ): void {
    const ctx = this.ctx;
    const colors = PHASE_COLORS[phase as CircadianPhase] ?? PHASE_COLORS.afternoon;

    ctx.save();
    ctx.globalAlpha = opacity;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }
}
