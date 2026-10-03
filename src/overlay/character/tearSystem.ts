import type { AppearanceConfig } from "@/store/types";
import type { KovyRenderState } from "../KovyCharacter";

interface TearDrop {
  x: number;
  y: number;
  vy: number;
  life: number;
  size: number;
  side: number;
}

export class TearSystem {
  private tears: TearDrop[] = [];
  private tearSpawnTimer: number = 0;

  update(dt: number, state: KovyRenderState, radius: number, config: AppearanceConfig): void {
    if (state.surfaceMood === "overwhelmed" && !config.reducedMotion) {
      this.tearSpawnTimer -= dt;
      if (this.tearSpawnTimer <= 0 && this.tears.length < 6) {
        this.tearSpawnTimer = 0.8 + Math.random() * 0.6;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.tears.push({
          x: side * radius * 0.38,
          y: -radius * 0.1 + radius * 0.15,
          vy: 0,
          life: 1,
          size: radius * 0.06,
          side,
        });
      }
    }

    for (let i = this.tears.length - 1; i >= 0; i--) {
      const t = this.tears[i];
      t.vy += 30 * dt;
      t.y += t.vy * dt;
      t.life -= dt * 0.5;
      if (t.life <= 0 || t.y > radius * 1.5) {
        this.tears.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, _radius: number): void {
    ctx.save();
    for (const t of this.tears) {
      const alpha = Math.max(0, t.life) * 0.6;
      const tearX = cx + t.x;
      const tearY = cy + t.y;
      ctx.beginPath();
      ctx.ellipse(tearX, tearY, t.size * 0.6, t.size, 0, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(210, 70%, 80%, ${alpha})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tearX - t.size * 0.2, tearY - t.size * 0.3, t.size * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.fill();
    }
    ctx.restore();
  }

  get hasTears(): boolean {
    return this.tears.length > 0;
  }

  destroy(): void {
    this.tears = [];
  }
}
