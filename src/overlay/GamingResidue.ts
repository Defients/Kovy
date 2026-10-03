// ============================================================
// Kovy Gaming Residue Renderer — fast-fade kinetic visual marks
// Distinct from Muse overlays: shorter-lived, non-semantic,
// reactive to movement and excitement state.
// ============================================================

import type { GamingResidueMark, GamingResidueBurst, GamingResidueType, GamingConfig } from "@/store/types";
import { getGamingStyleColors } from "@/engine/gamingEngine";
import { clamp } from "@/lib/utils";

const MAX_RESIDUE_MARKS = 40;

export class GamingResidueRenderer {
  private ctx: CanvasRenderingContext2D;
  private marks: GamingResidueMark[] = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Ingest new bursts from the gaming engine and convert to renderable marks */
  ingestBursts(bursts: readonly GamingResidueBurst[], config: GamingConfig): void {
    const colors = getGamingStyleColors(config.visualStyle);

    for (const burst of bursts) {
      if (this.marks.length >= MAX_RESIDUE_MARKS) break;

      const color = colors[Math.floor(Math.random() * colors.length)];
      const lifetime = config.residueLifetime * (0.6 + Math.random() * 0.8);
      const size = (8 + Math.random() * 18) * (0.6 + burst.intensity * 0.8);

      this.marks.push({
        type: burst.type,
        position: { ...burst.position },
        velocity: { ...burst.velocity },
        lifetime,
        maxLifetime: lifetime,
        opacity: burst.intensity * 0.8,
        size,
        rotation: Math.random() * Math.PI * 2,
        color,
      });
    }
  }

  /** Decay marks, update positions, remove expired. Call every frame. */
  updateMarks(dt: number): void {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      m.lifetime -= dt;
      m.position.x += m.velocity.x * dt;
      m.position.y += m.velocity.y * dt;
      // Slight deceleration
      m.velocity.x *= 0.97;
      m.velocity.y *= 0.97;
      m.rotation += dt * 0.5;

      // Fade: full opacity at start, smooth fade out
      const lifeFrac = clamp(m.lifetime / m.maxLifetime, 0, 1);
      m.opacity = lifeFrac * lifeFrac * 0.8; // quadratic fade for softer tail

      if (m.lifetime <= 0) {
        this.marks.splice(i, 1);
      }
    }
  }

  /** Render all active residue marks. Call after entity rendering. */
  renderAll(): void {
    for (const mark of this.marks) {
      if (mark.opacity <= 0.005) continue;
      this.renderMark(mark);
    }
  }

  /** Get current mark count (for diagnostics/tests) */
  getMarkCount(): number {
    return this.marks.length;
  }

  /** Clear all marks */
  clear(): void {
    this.marks = [];
  }

  // --- Mark renderers ---

  private renderMark(m: GamingResidueMark): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = m.opacity;
    ctx.translate(m.position.x, m.position.y);
    ctx.rotate(m.rotation);

    switch (m.type) {
      case "afterimage": this.drawAfterimage(ctx, m); break;
      case "ribbon_streak": this.drawRibbonStreak(ctx, m); break;
      case "arc_slash": this.drawArcSlash(ctx, m); break;
      case "impact_ring": this.drawImpactRing(ctx, m); break;
      case "ghost_shell": this.drawGhostShell(ctx, m); break;
      case "energy_shard": this.drawEnergyShard(ctx, m); break;
      case "velocity_smear": this.drawVelocitySmear(ctx, m); break;
      case "pulse_echo": this.drawPulseEcho(ctx, m); break;
    }

    ctx.restore();
  }

  private drawAfterimage(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const r = m.size * 0.8;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, m.color);
    grad.addColorStop(0.5, this.fadeColor(m.color, 0.4));
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  private drawRibbonStreak(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const len = m.size * 3;
    const w = Math.max(1, m.size * 0.15);
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.quadraticCurveTo(-len * 0.1, -m.size * 0.4, 0, 0);
    ctx.quadraticCurveTo(len * 0.1, m.size * 0.4, len * 0.5, 0);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawArcSlash(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const r = m.size * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = Math.max(1.5, m.size * 0.18);
    ctx.lineCap = "round";
    ctx.stroke();

    // Secondary thin arc
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, -Math.PI * 0.2, Math.PI * 0.2);
    ctx.lineWidth = Math.max(0.5, m.size * 0.06);
    ctx.stroke();
  }

  private drawImpactRing(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const lifeFrac = clamp(m.lifetime / m.maxLifetime, 0, 1);
    // Ring expands as it fades
    const r = m.size * (1 + (1 - lifeFrac) * 1.5);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = Math.max(1, m.size * 0.12 * lifeFrac);
    ctx.stroke();
  }

  private drawGhostShell(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const r = m.size * 0.6;
    const grad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.6, this.fadeColor(m.color, 0.3));
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Thin shell outline
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = this.fadeColor(m.color, 0.5);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  private drawEnergyShard(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const s = m.size * 0.6;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    // Diamond/shard shape
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.35, 0);
    ctx.lineTo(0, s * 0.6);
    ctx.lineTo(-s * 0.35, 0);
    ctx.closePath();
    ctx.fill();
  }

  private drawVelocitySmear(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const len = m.size * 2.5;
    const w = Math.max(2, m.size * 0.25);
    const grad = ctx.createLinearGradient(-len * 0.5, 0, len * 0.5, 0);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.3, m.color);
    grad.addColorStop(0.7, m.color);
    grad.addColorStop(1, "transparent");

    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawPulseEcho(ctx: CanvasRenderingContext2D, m: GamingResidueMark): void {
    const lifeFrac = clamp(m.lifetime / m.maxLifetime, 0, 1);
    // Two concentric rings that expand
    const r1 = m.size * (0.5 + (1 - lifeFrac) * 0.8);
    const r2 = m.size * (0.8 + (1 - lifeFrac) * 1.2);

    ctx.strokeStyle = m.color;
    ctx.lineWidth = Math.max(0.5, m.size * 0.08 * lifeFrac);

    ctx.beginPath();
    ctx.arc(0, 0, r1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(0.5, m.size * 0.05 * lifeFrac);
    ctx.beginPath();
    ctx.arc(0, 0, r2, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Convert HSL color to HSLA with given alpha */
  private fadeColor(hsl: string, alpha: number): string {
    const match = hsl.match(/hsl\(([^)]+)\)/);
    if (match) {
      return `hsla(${match[1]}, ${alpha})`;
    }
    return hsl;
  }
}
