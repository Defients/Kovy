// ============================================================
// Particle Burst Renderer — behavior-change burst effects
// Fires sparkle, dust, heart, ring, and confetti bursts
// ============================================================

export type BurstType = "sparkle" | "dust" | "heart" | "ring" | "confetti";

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  type: "sparkle" | "dot" | "heart" | "ring" | "confetti";
  gravity: number;
}

export class ParticleBurstRenderer {
  private particles: BurstParticle[] = [];

  spawnBurst(x: number, y: number, type: BurstType, color: string): void {
    switch (type) {
      case "sparkle":
        this.spawnSparkle(x, y, color);
        break;
      case "dust":
        this.spawnDust(x, y);
        break;
      case "heart":
        this.spawnHeart(x, y, color);
        break;
      case "ring":
        this.spawnRing(x, y, color);
        break;
      case "confetti":
        this.spawnConfetti(x, y);
        break;
    }
  }

  private spawnSparkle(x: number, y: number, color: string): void {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 40 + Math.random() * 60;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        size: 3 + Math.random() * 4,
        color,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        type: "sparkle",
        gravity: 0,
      });
    }
  }

  private spawnDust(x: number, y: number): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 20 + Math.random() * 30;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        size: 4 + Math.random() * 6,
        color: "rgba(180, 170, 160, 0.6)",
        rotation: 0,
        rotationSpeed: 0,
        type: "dot",
        gravity: 80,
      });
    }
  }

  private spawnHeart(x: number, y: number, color: string): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const speed = 30 + Math.random() * 40;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        size: 6 + Math.random() * 4,
        color,
        rotation: 0,
        rotationSpeed: 0,
        type: "heart",
        gravity: -20,
      });
    }
  }

  private spawnRing(x: number, y: number, color: string): void {
    this.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 0,
      maxLife: 0.4,
      size: 10,
      color,
      rotation: 0,
      rotationSpeed: 0,
      type: "ring",
      gravity: 0,
    });
  }

  private spawnConfetti(x: number, y: number): void {
    const count = 16;
    const colors = [
      "rgba(255, 100, 100, 0.8)",
      "rgba(100, 200, 255, 0.8)",
      "rgba(255, 220, 80, 0.8)",
      "rgba(180, 255, 100, 0.8)",
      "rgba(255, 150, 220, 0.8)",
    ];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 50 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
        size: 4 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 12,
        type: "confetti",
        gravity: 120,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.96;
      p.rotation += p.rotationSpeed * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const alpha = 1 - t;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);

      switch (p.type) {
        case "sparkle":
          this.drawSparkle(ctx, p.size, p.rotation, p.color);
          break;
        case "dot":
          this.drawDot(ctx, p.size, p.color);
          break;
        case "heart":
          this.drawHeart(ctx, p.size, p.color);
          break;
        case "ring":
          this.drawRing(ctx, p.size, t, p.color);
          break;
        case "confetti":
          this.drawConfetti(ctx, p.size, p.rotation, p.color);
          break;
      }

      ctx.restore();
    }
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, size: number, rotation: number, color: string): void {
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.15);
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
      ctx.stroke();
    }
  }

  private drawDot(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, size: number, color: string): void {
    const s = size;
    ctx.fillStyle = color;
    ctx.beginPath();
    const top = -s * 0.3;
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.5, top - s * 0.15, -s * 0.8, top + s * 0.3, 0, top + s * 0.7);
    ctx.bezierCurveTo(s * 0.8, top + s * 0.3, s * 0.5, top - s * 0.15, 0, s * 0.35);
    ctx.fill();
  }

  private drawRing(ctx: CanvasRenderingContext2D, baseSize: number, progress: number, color: string): void {
    const r = baseSize + progress * 40;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, 3 * (1 - progress));
    ctx.stroke();
  }

  private drawConfetti(ctx: CanvasRenderingContext2D, size: number, rotation: number, color: string): void {
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
  }

  clear(): void {
    this.particles = [];
  }
}
