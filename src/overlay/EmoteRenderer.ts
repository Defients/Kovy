// ============================================================
// Kovy Emote Renderer — draws symbolic emote particles on canvas.
// Each emote type has a distinct visual: hearts, stars, ZZZs, etc.
// Supports "bubble" (circled) and "raw" (floating symbol) styles.
// ============================================================

import type { EmoteParticle, EmoteConfig } from "@/store/types";

export class EmoteRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Render all active emote particles */
  renderAll(particles: readonly EmoteParticle[], config: EmoteConfig): void {
    for (const p of particles) {
      if (p.opacity <= 0.01) continue;
      this.renderParticle(p, config);
    }
  }

  private renderParticle(p: EmoteParticle, config: EmoteConfig): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(p.rotation);

    if (config.style === "bubble") {
      this.drawBubble(ctx, p.size);
    }

    this.drawSymbol(ctx, p.type, p.size * 0.6);

    ctx.restore();
  }

  /** Draw a soft circle background for bubble style */
  private drawBubble(ctx: CanvasRenderingContext2D, size: number): void {
    const r = size * 0.7;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    grad.addColorStop(0.7, "rgba(255, 255, 255, 0.06)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /** Draw the emote symbol centered at origin */
  private drawSymbol(ctx: CanvasRenderingContext2D, type: string, size: number): void {
    switch (type) {
      case "heart": this.drawHeart(ctx, size); break;
      case "zzz": this.drawZzz(ctx, size); break;
      case "spark": this.drawSpark(ctx, size); break;
      case "question": this.drawQuestion(ctx, size); break;
      case "star": this.drawStar(ctx, size); break;
      case "swirl": this.drawSwirl(ctx, size); break;
      case "note": this.drawNote(ctx, size); break;
      case "ellipsis": this.drawEllipsis(ctx, size); break;
      case "exclaim": this.drawExclaim(ctx, size); break;
      case "sweat": this.drawSweat(ctx, size); break;
      case "flower": this.drawFlower(ctx, size); break;
      case "spiral": this.drawSpiral(ctx, size); break;
      case "music": this.drawMusic(ctx, size); break;
    }
  }

  // --- Symbol renderers ---

  private drawHeart(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = "rgba(255, 120, 150, 0.9)";
    ctx.beginPath();
    const top = -s * 0.3;
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.5, top - s * 0.15, -s * 0.8, top + s * 0.3, 0, top + s * 0.7);
    ctx.bezierCurveTo(s * 0.8, top + s * 0.3, s * 0.5, top - s * 0.15, 0, s * 0.35);
    ctx.fill();
  }

  private drawZzz(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.font = `bold ${s * 0.9}px sans-serif`;
    ctx.fillStyle = "rgba(180, 190, 255, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Z", 0, 0);
  }

  private drawSpark(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.strokeStyle = "rgba(255, 230, 100, 0.9)";
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.lineCap = "round";
    const rays = 4;
    const inner = s * 0.15;
    const outer = s * 0.45;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
  }

  private drawQuestion(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.font = `bold ${s * 1.0}px sans-serif`;
    ctx.fillStyle = "rgba(150, 220, 255, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, 0);
  }

  private drawStar(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = "rgba(255, 220, 80, 0.9)";
    ctx.beginPath();
    const points = 5;
    const outer = s * 0.45;
    const inner = s * 0.2;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawSwirl(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.strokeStyle = "rgba(200, 160, 255, 0.8)";
    ctx.lineWidth = Math.max(1, s * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    const turns = 1.5;
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      const r = t * s * 0.4;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawNote(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = "rgba(160, 230, 200, 0.85)";
    // Note head
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, s * 0.15, s * 0.15, s * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.strokeStyle = "rgba(160, 230, 200, 0.85)";
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.12);
    ctx.lineTo(s * 0.05, -s * 0.3);
    ctx.stroke();
    // Flag
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.25, -s * 0.15, s * 0.1, -s * 0.05);
    ctx.stroke();
  }

  private drawEllipsis(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = "rgba(200, 200, 220, 0.7)";
    const dotR = s * 0.08;
    const spacing = s * 0.22;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * spacing, 0, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawExclaim(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.font = `bold ${s * 1.1}px sans-serif`;
    ctx.fillStyle = "rgba(255, 180, 80, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 0, 0);
  }

  private drawSweat(ctx: CanvasRenderingContext2D, s: number): void {
    // Teardrop shape
    ctx.fillStyle = "rgba(130, 200, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.35);
    ctx.quadraticCurveTo(s * 0.2, 0, 0, s * 0.2);
    ctx.quadraticCurveTo(-s * 0.2, 0, 0, -s * 0.35);
    ctx.fill();
  }

  private drawFlower(ctx: CanvasRenderingContext2D, s: number): void {
    const petals = 5;
    const petalR = s * 0.18;
    const dist = s * 0.2;
    ctx.fillStyle = "rgba(255, 200, 220, 0.8)";
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, petalR, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = "rgba(255, 230, 150, 0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSpiral(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.strokeStyle = "rgba(180, 150, 220, 0.75)";
    ctx.lineWidth = Math.max(0.8, s * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    const turns = 2.5;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      const r = (1 - t) * s * 0.4 + s * 0.05;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private drawMusic(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = "rgba(180, 200, 240, 0.85)";
    // Note head
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, s * 0.25, s * 0.15, s * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.strokeStyle = "rgba(180, 200, 240, 0.85)";
    ctx.lineWidth = Math.max(0.8, s * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, s * 0.2);
    ctx.lineTo(-s * 0.08, -s * 0.35);
    ctx.stroke();
    // Flag
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.35);
    ctx.quadraticCurveTo(s * 0.15, -s * 0.25, s * 0.1, -s * 0.05);
    ctx.stroke();
  }
}
