// ============================================================
// Kovy Muse Overlay Renderer — draws procedural marks on canvas
// Each mark type has a distinct visual style per Muse mode.
// ============================================================

import type { MuseOverlayData, MuseMarkType } from "@/store/types";

export class MuseOverlayRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Render all active muse overlays. Call after entity rendering. */
  renderAll(overlays: readonly MuseOverlayData[]): void {
    for (const overlay of overlays) {
      if (overlay.opacity <= 0.005) continue;
      this.renderMark(overlay);
    }
  }

  private renderMark(o: MuseOverlayData): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = o.opacity;
    
    // Apply velocity drift based on maxLifetime vs lifetime
    const elapsed = o.maxLifetime - o.lifetime;
    const dx = o.position.x + o.velocity.x * elapsed;
    const dy = o.position.y + o.velocity.y * elapsed;
    
    ctx.translate(dx, dy);
    
    // Apply rotation spin based on elapsed time
    ctx.rotate(o.rotation + o.rotationSpeed * elapsed);

    switch (o.type) {
      case "dot": this.drawDot(ctx, o); break;
      case "stroke": this.drawStroke(ctx, o); break;
      case "arc": this.drawArc(ctx, o); break;
      case "bracket": this.drawBracket(ctx, o); break;
      case "emphasis": this.drawEmphasis(ctx, o); break;
      case "guide_line": this.drawGuideLine(ctx, o); break;
      case "mood_wash": this.drawMoodWash(ctx, o); break;
      case "note_anchor": this.drawNoteAnchor(ctx, o); break;
      case "sparkle": this.drawSparkle(ctx, o); break;
      case "cross": this.drawCross(ctx, o); break;
      case "wave": this.drawWave(ctx, o); break;
      case "circuit": this.drawCircuit(ctx, o); break;
      case "geometry": this.drawGeometry(ctx, o); break;
      case "ring_burst": this.drawRingBurst(ctx, o); break;
    }

    ctx.restore();
  }

  private drawDot(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r = o.size * 0.5;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, o.color);
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  private drawStroke(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const len = o.size * 2.5;
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    // Slight curve for organic feel
    ctx.quadraticCurveTo(0, -o.size * 0.3, len * 0.5, 0);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.15);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawArc(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r = o.size * 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.12);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  private drawBracket(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const h = o.size * 1.5;
    const w = o.size * 0.4;
    ctx.beginPath();
    ctx.moveTo(w, -h * 0.5);
    ctx.lineTo(0, -h * 0.5);
    ctx.lineTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  private drawEmphasis(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    // Three small dots in a row — like an ellipsis or emphasis marks
    const spacing = o.size * 0.6;
    const dotR = o.size * 0.2;
    ctx.fillStyle = o.color;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * spacing, 0, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGuideLine(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const len = o.size * 3;
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(0.5, o.size * 0.06);
    ctx.setLineDash([o.size * 0.3, o.size * 0.2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawMoodWash(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r = o.size * 2;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, o.color);
    grad.addColorStop(0.6, this.fadeColor(o.color, 0.3));
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  private drawNoteAnchor(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    // Small circle with a tail — like a pin or anchor
    const r = o.size * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, r + o.size * 0.8);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(0.5, o.size * 0.08);
    ctx.stroke();
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r1 = o.size * 0.15;
    const r2 = o.size * 0.8;
    ctx.fillStyle = o.color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle1 = (i * Math.PI) / 2;
      const angle2 = angle1 + Math.PI / 4;
      ctx.lineTo(Math.cos(angle1) * r2, Math.sin(angle1) * r2);
      ctx.lineTo(Math.cos(angle2) * r1, Math.sin(angle2) * r1);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawCross(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const len = o.size * 0.7;
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-len, -len);
    ctx.lineTo(len, len);
    ctx.moveTo(len, -len);
    ctx.lineTo(-len, len);
    ctx.stroke();
  }

  private drawWave(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const width = o.size * 2.5;
    const height = o.size * 0.4;
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.bezierCurveTo(
      -width / 4, -height,
      width / 4, height,
      width / 2, 0
    );
    ctx.stroke();
  }

  private drawCircuit(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const l1 = o.size * 0.8;
    const l2 = o.size * 0.6;
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    ctx.moveTo(-l1, l2);
    ctx.lineTo(0, 0);
    ctx.lineTo(l1, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-l1, l2, o.size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(l1, 0, o.size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGeometry(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r = o.size * 0.8;
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(1, o.size * 0.08);
    ctx.lineJoin = "round";
    
    // Triangle
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.866, r * 0.5);
    ctx.lineTo(-r * 0.866, r * 0.5);
    ctx.closePath();
    ctx.stroke();
  }

  private drawRingBurst(ctx: CanvasRenderingContext2D, o: MuseOverlayData): void {
    const r1 = o.size * 0.5;
    const r2 = o.size * 1.2;
    
    ctx.strokeStyle = o.color;
    ctx.lineWidth = Math.max(0.5, o.size * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, r1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([o.size * 0.15, o.size * 0.2]);
    ctx.beginPath();
    ctx.arc(0, 0, r2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Reduce alpha of an HSL color string */
  private fadeColor(hsl: string, alpha: number): string {
    // Convert "hsl(h, s%, l%)" to "hsla(h, s%, l%, alpha)"
    const match = hsl.match(/hsl\(([^)]+)\)/);
    if (match) {
      return `hsla(${match[1]}, ${alpha})`;
    }
    return hsl;
  }
}
