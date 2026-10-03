// ============================================================
// Expression Renderer — draws mood-reactive facial expressions
// Mouths, eyebrows, blush, cheeks, and dizzy stars
// ============================================================

import type { SurfaceMood } from "@/store/types";

export class ExpressionRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Draw mouth based on mood. Called within body-local transform. */
  drawMouth(ctx: CanvasRenderingContext2D, radius: number, mood: SurfaceMood, emoteIntensity: number, time: number): void {
    const intensity = emoteIntensity;
    if (intensity < 0.05) return;

    const y = radius * 0.28;
    const w = radius * 0.35 * intensity;
    ctx.save();
    ctx.globalAlpha = intensity * 0.8;

    switch (mood) {
      case "calm":
        this.drawSmile(ctx, 0, y, w, radius * 0.06);
        break;
      case "curious":
        this.drawO(ctx, 0, y, w * 0.5, radius * 0.05);
        break;
      case "playful":
        this.drawGrin(ctx, 0, y, w, radius * 0.08);
        break;
      case "focused":
        this.drawFlat(ctx, 0, y, w);
        break;
      case "sleepy":
        this.drawFlat(ctx, 0, y, w * 0.7);
        break;
      case "excited":
        this.drawGrin(ctx, 0, y, w * 1.2, radius * 0.1);
        break;
      case "overwhelmed":
        this.drawWavy(ctx, 0, y, w, time);
        break;
      case "shy":
        this.drawSmile(ctx, 0, y, w * 0.5, radius * 0.04);
        break;
    }

    ctx.restore();
  }

  /** Draw eyebrows based on mood. Called within body-local transform. */
  drawEyebrows(ctx: CanvasRenderingContext2D, radius: number, mood: SurfaceMood, emoteIntensity: number): void {
    const intensity = emoteIntensity;
    if (intensity < 0.05) return;

    const eyeY = -radius * 0.12;
    const browY = eyeY - radius * 0.18;
    const eyeSpacing = radius * 0.28;
    const browW = radius * 0.18;
    const alpha = intensity * 0.6;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(40, 40, 50, 0.7)";
    ctx.lineWidth = Math.max(1.5, radius * 0.04);
    ctx.lineCap = "round";

    switch (mood) {
      case "calm":
        this.drawBrowRelaxed(ctx, -eyeSpacing, browY, browW);
        this.drawBrowRelaxed(ctx, eyeSpacing, browY, browW);
        break;
      case "curious":
        this.drawBrowRaised(ctx, -eyeSpacing, browY, browW);
        this.drawBrowRaised(ctx, eyeSpacing, browY, browW);
        break;
      case "playful":
        this.drawBrowRaised(ctx, -eyeSpacing, browY, browW);
        this.drawBrowAngled(ctx, eyeSpacing, browY, browW);
        break;
      case "focused":
        this.drawBrowFurrowed(ctx, -eyeSpacing, browY, browW);
        this.drawBrowFurrowed(ctx, eyeSpacing, browY, browW);
        break;
      case "sleepy":
        this.drawBrowRelaxed(ctx, -eyeSpacing, browY + radius * 0.05, browW);
        this.drawBrowRelaxed(ctx, eyeSpacing, browY + radius * 0.05, browW);
        break;
      case "excited":
        this.drawBrowRaised(ctx, -eyeSpacing, browY - radius * 0.04, browW);
        this.drawBrowRaised(ctx, eyeSpacing, browY - radius * 0.04, browW);
        break;
      case "overwhelmed":
        this.drawBrowFurrowed(ctx, -eyeSpacing, browY, browW);
        this.drawBrowFurrowed(ctx, eyeSpacing, browY, browW);
        break;
      case "shy":
        // No eyebrows for shy — just slight raised
        this.drawBrowRelaxed(ctx, -eyeSpacing, browY, browW * 0.7);
        this.drawBrowRelaxed(ctx, eyeSpacing, browY, browW * 0.7);
        break;
    }

    ctx.restore();
  }

  /** Draw blush marks for shy/playful/excited moods */
  drawBlush(ctx: CanvasRenderingContext2D, radius: number, mood: SurfaceMood, time: number): void {
    let strength = 0;
    switch (mood) {
      case "shy": strength = 0.7; break;
      case "playful": strength = 0.4; break;
      case "excited": strength = 0.3; break;
      default: return;
    }

    const pulse = 1 + Math.sin(time * 3) * 0.05;
    const cheekX = radius * 0.38;
    const cheekY = radius * 0.12;
    const cheekR = radius * 0.12 * pulse;

    ctx.save();
    for (const side of [-1, 1]) {
      const grad = ctx.createRadialGradient(side * cheekX, cheekY, 0, side * cheekX, cheekY, cheekR);
      grad.addColorStop(0, `rgba(255, 130, 160, ${strength * 0.5})`);
      grad.addColorStop(0.6, `rgba(255, 130, 160, ${strength * 0.2})`);
      grad.addColorStop(1, "rgba(255, 130, 160, 0)");
      ctx.beginPath();
      ctx.arc(side * cheekX, cheekY, cheekR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Draw soft cheek glow matching mood color */
  drawCheeks(ctx: CanvasRenderingContext2D, radius: number, moodColor: string, time: number): void {
    const pulse = 1 + Math.sin(time * 2) * 0.03;
    const cheekX = radius * 0.42;
    const cheekY = radius * 0.05;
    const cheekR = radius * 0.15 * pulse;

    ctx.save();
    for (const side of [-1, 1]) {
      const grad = ctx.createRadialGradient(side * cheekX, cheekY, 0, side * cheekX, cheekY, cheekR);
      grad.addColorStop(0, this.applyAlpha(moodColor, 0.08));
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(side * cheekX, cheekY, cheekR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Draw dizzy stars orbiting above head for overwhelmed/startled states */
  drawDizzyStars(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, time: number): void {
    const count = 3;
    const orbitR = radius * 0.5;
    const starY = cy - radius - 8;

    ctx.save();
    for (let i = 0; i < count; i++) {
      const angle = time * 3 + (i / count) * Math.PI * 2;
      const x = cx + Math.cos(angle) * orbitR;
      const y = starY + Math.sin(angle) * orbitR * 0.3;
      const size = radius * 0.08;
      const alpha = 0.5 + Math.sin(time * 4 + i) * 0.2;

      ctx.globalAlpha = alpha;
      this.drawSmallStar(ctx, x, y, size);
    }
    ctx.restore();
  }

  // --- Mouth shapes ---

  private drawSmile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + h, x + w, y);
    ctx.strokeStyle = "rgba(40, 30, 50, 0.6)";
    ctx.lineWidth = Math.max(1.5, w * 0.08);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawGrin(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y - h * 0.3);
    ctx.quadraticCurveTo(x, y + h, x + w, y - h * 0.3);
    ctx.quadraticCurveTo(x, y + h * 0.3, x - w, y - h * 0.3);
    ctx.closePath();
    ctx.fillStyle = "rgba(40, 30, 50, 0.5)";
    ctx.fill();
  }

  private drawO(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(40, 30, 50, 0.4)";
    ctx.fill();
  }

  private drawFlat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
    ctx.strokeStyle = "rgba(40, 30, 50, 0.5)";
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawWavy(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, time: number): void {
    ctx.beginPath();
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x - w + t * w * 2;
      const py = y + Math.sin(t * Math.PI * 3 + time * 4) * w * 0.15;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(40, 30, 50, 0.5)";
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // --- Eyebrow shapes ---

  private drawBrowRelaxed(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y + w * 0.15);
    ctx.quadraticCurveTo(x, y - w * 0.1, x + w, y + w * 0.15);
    ctx.stroke();
  }

  private drawBrowRaised(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y + w * 0.2);
    ctx.quadraticCurveTo(x, y - w * 0.3, x + w, y + w * 0.1);
    ctx.stroke();
  }

  private drawBrowFurrowed(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const inner = x > 0 ? -w : w;
    ctx.beginPath();
    ctx.moveTo(x - w, y - w * 0.15);
    ctx.lineTo(x + inner * 0.5, y + w * 0.2);
    ctx.stroke();
  }

  private drawBrowAngled(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    ctx.beginPath();
    ctx.moveTo(x - w, y - w * 0.1);
    ctx.lineTo(x + w, y + w * 0.15);
    ctx.stroke();
  }

  // --- Helpers ---

  private drawSmallStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const innerAngle = angle + Math.PI / 4;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(innerAngle) * size * 0.3, y + Math.sin(innerAngle) * size * 0.3);
    }
    ctx.strokeStyle = "rgba(255, 220, 80, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private applyAlpha(hsl: string, alpha: number): string {
    const match = hsl.match(/hsl\(([^)]+)\)/);
    if (match) return `hsla(${match[1]}, ${alpha})`;
    return hsl;
  }
}
