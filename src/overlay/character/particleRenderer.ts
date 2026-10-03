import type { AppearanceConfig } from "@/store/types";
import { randomRange } from "@/lib/utils";
import { getMoodModifiers } from "@/engine/moodEngine";
import { hexToHsl } from "@/lib/colorUtils";
import type { KovyRenderState } from "../KovyCharacter";
import { lerpHSL } from "./colorHelper";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  alpha: number;
  shape: "dot" | "sparkle" | "bokeh" | "heart" | "bubble";
  rotation: number;
  rotationSpeed: number;
}

export class ParticleRenderer {
  private particles: Particle[] = [];

  update(
    dt: number,
    state: KovyRenderState,
    cx: number,
    cy: number,
    radius: number,
    config: AppearanceConfig,
  ): void {
    const amount = config.particleAmount;
    if (amount < 0.05) {
      this.particles = [];
      return;
    }

    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);
    const mods = getMoodModifiers(state.surfaceMood);
    const particleMult = state.moodToParticles ? mods.particleMultiplier : 0.6;
    const spawnRate = (speed / 200 + 0.5) * amount * particleMult;
    const spawnChance = spawnRate * dt * 10;

    const moodShape: Record<string, Particle["shape"]> = {
      playful: "heart",
      excited: "heart",
      calm: "bokeh",
      sleepy: "bokeh",
      curious: "sparkle",
      overwhelmed: "bubble",
      shy: "dot",
      focused: "dot",
    };
    const shape = moodShape[state.surfaceMood] ?? "dot";

    if (Math.random() < spawnChance && this.particles.length < 40) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius * (0.8 + Math.random() * 0.4);
      let particleHue = mods.colorHue + randomRange(-20, 20);
      if (state.customColorsEnabled && state.primaryColor) {
        const [h] = hexToHsl(state.primaryColor);
        particleHue = h + randomRange(-20, 20);
      }
      const isBubble = shape === "bubble";
      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: -state.velocity.x * 0.1 + randomRange(-15, 15),
        vy: -state.velocity.y * 0.1 + randomRange(-25, -5) + (isBubble ? -10 : 0),
        life: 1,
        maxLife: randomRange(0.6, 1.5) * config.trailLength * 2,
        size: randomRange(1.5, 4) * config.size * (shape === "bokeh" ? 2.5 : 1),
        hue: particleHue,
        alpha: randomRange(0.4, 0.8) * (state.entityOpacity ?? 1),
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 4,
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 8 * dt;
      p.size *= 0.995;
      p.rotation += p.rotationSpeed * dt;
      if (p.life <= 0 || p.size < 0.3) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.alpha * Math.max(0, p.life);
      const color = `hsla(${p.hue}, 70%, 70%, ${alpha})`;

      switch (p.shape) {
        case "sparkle":
          this.drawSparkle(ctx, p, color);
          break;
        case "bokeh":
          this.drawBokeh(ctx, p, color);
          break;
        case "heart":
          this.drawHeart(ctx, p, color);
          break;
        case "bubble":
          this.drawBubble(ctx, p, color);
          break;
        case "dot":
        default:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          break;
      }
    }
  }

  drawAmbientMotes(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    config: AppearanceConfig,
    blendedColor: string,
  ): void {
    const time = Date.now() / 1000;
    const count = Math.floor(config.particleAmount * 8);
    const hslMatch = blendedColor.match(/hsl[a]?\((\d+)/);
    const moteHue = hslMatch ? parseInt(hslMatch[1]) : 210;

    for (let i = 0; i < count; i++) {
      const phase = (i / count) * Math.PI * 2;
      const dist = radius * 1.8 + Math.sin(time * 0.3 + phase * 2) * radius * 0.5;
      const x = cx + Math.cos(time * 0.15 + phase) * dist;
      const y = cy + Math.sin(time * 0.2 + phase) * dist * 0.7;
      const pulse = 1 + Math.sin(time * 1.5 + phase) * 0.3;
      const size = (1.5 + Math.sin(time + phase) * 0.5) * pulse * config.size;
      const alpha = 0.2 + Math.sin(time * 0.5 + phase) * 0.15;
      const hueVar = moteHue + Math.sin(phase * 3) * 10;

      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = `hsla(${hueVar}, 65%, 82%, ${alpha})`;
      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";
      for (let j = 0; j < 4; j++) {
        const angle = (j / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * size * 1.5, Math.sin(angle) * size * 1.5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hueVar}, 65%, 82%, ${alpha})`;
      ctx.fill();
      ctx.restore();
    }
  }

  drawDreamConstellation(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    intensity: number,
    config: AppearanceConfig,
  ): void {
    const count = Math.floor(5 + intensity * 8);
    const spread = radius * (2.5 + intensity * 1.5);
    ctx.save();

    for (let i = 0; i < count; i++) {
      const phase = (i / count) * Math.PI * 2;
      const drift = Math.sin(time * 0.2 + phase * 3) * 0.3;
      const dist = spread * (0.4 + 0.6 * ((i * 7 + 3) % count) / count) + drift * radius;
      const angle = phase + time * 0.05 + Math.sin(time * 0.1 + i) * 0.2;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist * 0.6 - radius * 0.3;
      const size = (1 + Math.sin(time * 0.8 + phase * 2) * 0.5) * config.size * intensity;
      const alpha = (0.15 + Math.sin(time * 0.5 + phase) * 0.1) * intensity;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(220, 70%, 85%, ${alpha})`;
      ctx.fill();

      if (i < count - 1) {
        const nextPhase = ((i + 1) / count) * Math.PI * 2;
        const nextDist = spread * (0.4 + 0.6 * (((i + 1) * 7 + 3) % count) / count);
        const nextAngle = nextPhase + time * 0.05 + Math.sin(time * 0.1 + i + 1) * 0.2;
        const nx = cx + Math.cos(nextAngle) * nextDist;
        const ny = cy + Math.sin(nextAngle) * nextDist * 0.6 - radius * 0.3;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = `hsla(220, 60%, 80%, ${alpha * 0.4})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  destroy(): void {
    this.particles = [];
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, p: Particle, color: string): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, p.size * 0.2);
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * p.size, Math.sin(angle) * p.size);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private drawBokeh(ctx: CanvasRenderingContext2D, p: Particle, color: string): void {
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, `${0.3 * p.alpha * Math.max(0, p.life)})`));
    grad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${0.15 * p.alpha * Math.max(0, p.life)})`);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, p: Particle, color: string): void {
    const s = p.size;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation * 0.3);
    ctx.fillStyle = color;
    ctx.beginPath();
    const top = -s * 0.3;
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.5, top - s * 0.15, -s * 0.8, top + s * 0.3, 0, top + s * 0.7);
    ctx.bezierCurveTo(s * 0.8, top + s * 0.3, s * 0.5, top - s * 0.15, 0, s * 0.35);
    ctx.fill();
    ctx.restore();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, p: Particle, color: string): void {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${0.5 * p.alpha * Math.max(0, p.life)})`);
    ctx.fill();
  }
}
