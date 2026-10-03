// ============================================================
// Kovy Atmosphere Renderer — draws ambient environmental particles.
// Each shape type has a distinct visual suited to its circadian phase.
// Renders BEHIND entities for depth layering.
// ============================================================

import type { AtmosphereParticle } from "@/store/types";

export class AtmosphereRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Render all active atmosphere particles */
  renderAll(particles: readonly AtmosphereParticle[]): void {
    for (const p of particles) {
      if (p.opacity <= 0.005) continue;
      this.renderParticle(p);
    }
  }

  private renderParticle(p: AtmosphereParticle): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.position.x, p.position.y);

    switch (p.shape) {
      case "dot": this.drawDot(ctx, p); break;
      case "ring": this.drawRing(ctx, p); break;
      case "diamond": this.drawDiamond(ctx, p); break;
      case "line": this.drawLine(ctx, p); break;
      case "cross": this.drawCross(ctx, p); break;
      case "wisp": this.drawWisp(ctx, p); break;
      case "heart": this.drawHeart(ctx, p); break;
      case "star": this.drawStar(ctx, p); break;
      case "bubble": this.drawBubble(ctx, p); break;
      case "snowflake": this.drawSnowflake(ctx, p); break;
    }

    ctx.restore();
  }

  private drawDot(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const pulse = 1 + Math.sin(p.phase * 2) * 0.15;
    const r = p.size * pulse;
    // Glow bloom: larger faded copy behind
    const bloomGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
    bloomGrad.addColorStop(0, p.color);
    bloomGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fillStyle = bloomGrad;
    ctx.globalAlpha = p.opacity * 0.3;
    ctx.fill();
    ctx.globalAlpha = p.opacity;
    // Main dot
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  private drawRing(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const pulse = 1 + Math.sin(p.phase * 1.5) * 0.1;
    const r = p.size * 1.5 * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.15);
    ctx.stroke();
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const s = p.size * 1.2;
    const rot = p.phase * 0.3;
    ctx.rotate(rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.5, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  }

  private drawLine(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const len = p.size * 3;
    const rot = p.phase * 0.2;
    ctx.rotate(rot);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.2);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.stroke();
  }

  private drawCross(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const s = p.size * 1.2;
    const pulse = 1 + Math.sin(p.phase * 2.5) * 0.1;
    const arm = s * pulse;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.15);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-arm, 0);
    ctx.lineTo(arm, 0);
    ctx.moveTo(0, -arm);
    ctx.lineTo(0, arm);
    ctx.stroke();
  }

  private drawWisp(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const len = p.size * 4;
    const w = Math.max(1, p.size * 0.3);
    const wave = Math.sin(p.phase * 1.8) * p.size;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.quadraticCurveTo(-len * 0.15, -wave, 0, 0);
    ctx.quadraticCurveTo(len * 0.15, wave, len * 0.5, 0);
    ctx.stroke();
  }

  // --- New atmosphere shapes ---

  private drawHeart(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const s = p.size * 1.2;
    const pulse = 1 + Math.sin(p.phase * 2) * 0.1;
    ctx.scale(pulse, pulse);
    // Glow bloom
    const bloomGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2);
    bloomGrad.addColorStop(0, p.color);
    bloomGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, s * 2, 0, Math.PI * 2);
    ctx.fillStyle = bloomGrad;
    ctx.globalAlpha = p.opacity * 0.2;
    ctx.fill();
    ctx.globalAlpha = p.opacity;
    // Heart shape
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const top = -s * 0.3;
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.5, top - s * 0.15, -s * 0.8, top + s * 0.3, 0, top + s * 0.7);
    ctx.bezierCurveTo(s * 0.8, top + s * 0.3, s * 0.5, top - s * 0.15, 0, s * 0.35);
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const s = p.size * 1.3;
    const pulse = 1 + Math.sin(p.phase * 2.5) * 0.08;
    const rot = p.phase * 0.2;
    ctx.rotate(rot);
    ctx.scale(pulse, pulse);
    // Glow bloom
    const bloomGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.8);
    bloomGrad.addColorStop(0, p.color);
    bloomGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = bloomGrad;
    ctx.globalAlpha = p.opacity * 0.25;
    ctx.fill();
    ctx.globalAlpha = p.opacity;
    // Star shape
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.4;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const r = p.size * 1.2;
    const pulse = 1 + Math.sin(p.phase * 1.5) * 0.08;
    const rp = r * pulse;
    // Bubble outline
    ctx.beginPath();
    ctx.arc(0, 0, rp, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.1);
    ctx.stroke();
    // Highlight
    ctx.beginPath();
    ctx.arc(-rp * 0.3, -rp * 0.3, rp * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.opacity * 0.5;
    ctx.fill();
    ctx.globalAlpha = p.opacity;
  }

  private drawSnowflake(ctx: CanvasRenderingContext2D, p: AtmosphereParticle): void {
    const s = p.size * 1.2;
    const rot = p.phase * 0.15;
    ctx.rotate(rot);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.12);
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cx * s, cy * s);
      ctx.stroke();
      // Small branch lines
      const branchLen = s * 0.3;
      const branchAngle1 = angle + 0.5;
      const branchAngle2 = angle - 0.5;
      const midX = cx * s * 0.6;
      const midY = cy * s * 0.6;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(branchAngle1) * branchLen, midY + Math.sin(branchAngle1) * branchLen);
      ctx.moveTo(midX, midY);
      ctx.lineTo(midX + Math.cos(branchAngle2) * branchLen, midY + Math.sin(branchAngle2) * branchLen);
      ctx.stroke();
    }
  }
}
