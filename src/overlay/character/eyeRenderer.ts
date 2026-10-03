import type { AppearanceConfig } from "@/store/types";
import { randomRange } from "@/lib/utils";
import { getMoodModifiers } from "@/engine/moodEngine";
import type { KovyRenderState } from "../KovyCharacter";

export class EyeRenderer {
  private blinkTimer: number = 3;
  private blinkState: number = 0;
  private blinkDuration: number = 0.15;
  private nextBlinkInterval: number = 3;
  private blinkClusterRemaining: number = 0;
  private blinkPartialAmount: number = 1.0;

  private eyeDriftX: number = 0;
  private eyeDriftY: number = 0;
  private eyeDriftTargetX: number = 0;
  private eyeDriftTargetY: number = 0;
  private eyeDriftTimer: number = 2;

  update(dt: number, state: KovyRenderState): void {
    this.updateBlink(dt, state);
    this.updateEyeDrift(dt, state);
  }

  getBlinkState(): number {
    return this.blinkState;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    let style = state.eyeStyle || "round";

    if (style === "heart" && !(state.surfaceMood === "playful" || state.surfaceMood === "excited")) {
      style = "round";
    }
    if (style === "crescent" && !(state.surfaceMood === "sleepy" || state.surfaceMood === "calm")) {
      style = "round";
    }

    const eyeSpacing = radius * 0.38;
    const eyeY = -radius * 0.1;
    let eyeRadius = radius * 0.18;
    let pupilRadius = eyeRadius * 0.55;
    let eyeAspect = 1.0;

    switch (style) {
      case "soft":
        eyeRadius = radius * 0.20;
        pupilRadius = eyeRadius * 0.50;
        eyeAspect = 1.15;
        break;
      case "narrow":
        eyeRadius = radius * 0.16;
        pupilRadius = eyeRadius * 0.6;
        eyeAspect = 1.6;
        break;
      case "dot":
        eyeRadius = radius * 0.10;
        pupilRadius = eyeRadius * 0.85;
        eyeAspect = 1.0;
        break;
      case "sparkle":
        eyeRadius = radius * 0.18;
        pupilRadius = eyeRadius * 0.55;
        eyeAspect = 1.0;
        break;
      case "heart":
        eyeRadius = radius * 0.16;
        pupilRadius = eyeRadius * 0.5;
        eyeAspect = 1.0;
        break;
      case "crescent":
        eyeRadius = radius * 0.18;
        pupilRadius = eyeRadius * 0.5;
        eyeAspect = 1.0;
        break;
      case "round":
      default:
        break;
    }

    const blinkAmount = this.blinkState;
    const eyeOpenness = 1 - blinkAmount;
    const startleWiden = state.isStartled ? -0.25 : 0;
    const sleepyLid = state.isAsleep ? 0.7 : state.surfaceMood === "sleepy" ? 0.4 : 0;
    const effectiveOpenness = Math.max(0, eyeOpenness - sleepyLid - startleWiden);

    if (effectiveOpenness < 0.05) return;

    for (const side of [-1, 1]) {
      const ex = eyeSpacing * side;
      const ey = eyeY;

      ctx.save();
      ctx.translate(ex, ey);

      ctx.beginPath();
      ctx.ellipse(0, 0, eyeRadius * eyeAspect, eyeRadius * effectiveOpenness, 0, 0, Math.PI * 2);
      ctx.save();
      ctx.clip();

      // Enhanced eye-white gradient with depth
      const eyeGrad = ctx.createRadialGradient(0, -eyeRadius * 0.2, 0, 0, 0, eyeRadius * 1.1);
      eyeGrad.addColorStop(0, "rgba(248, 250, 255, 0.98)");
      eyeGrad.addColorStop(0.6, "rgba(235, 240, 250, 0.92)");
      eyeGrad.addColorStop(1, "rgba(200, 210, 230, 0.82)");
      ctx.fillStyle = eyeGrad;
      ctx.fill();

      // Upper eyelid shadow for depth
      const lidGrad = ctx.createLinearGradient(0, -eyeRadius * effectiveOpenness, 0, 0);
      lidGrad.addColorStop(0, "rgba(0, 0, 20, 0.15)");
      lidGrad.addColorStop(0.4, "rgba(0, 0, 20, 0.04)");
      lidGrad.addColorStop(1, "rgba(0, 0, 20, 0)");
      ctx.fillStyle = lidGrad;
      ctx.fillRect(-eyeRadius * eyeAspect, -eyeRadius * effectiveOpenness, eyeRadius * eyeAspect * 2, eyeRadius * effectiveOpenness);

      const trackX = (state.eyeTarget.x + this.eyeDriftX) * eyeRadius * 0.35;
      const trackY = (state.eyeTarget.y + this.eyeDriftY) * eyeRadius * 0.25;

      const pupilDilation = state.surfaceMood === "excited" ? 1.2
        : state.surfaceMood === "curious" ? 1.15
        : state.surfaceMood === "playful" ? 1.1
        : state.surfaceMood === "overwhelmed" ? 1.25
        : state.surfaceMood === "focused" ? 0.85
        : state.surfaceMood === "shy" ? 0.9
        : 1.0;
      const dilatedPupil = pupilRadius * pupilDilation;

      const mods = getMoodModifiers(state.surfaceMood);
      const irisHue = mods.colorHue;
      const irisGrad = ctx.createRadialGradient(trackX, trackY, 0, trackX, trackY, dilatedPupil * 1.4);
      irisGrad.addColorStop(0, `hsl(${irisHue}, 80%, 25%)`);
      irisGrad.addColorStop(0.6, `hsl(${irisHue}, 70%, 40%)`);
      irisGrad.addColorStop(1, `hsl(${irisHue}, 60%, 55%)`);

      ctx.beginPath();
      ctx.arc(trackX, trackY, dilatedPupil * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = irisGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(trackX, trackY, dilatedPupil * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 10, 20, 0.9)";
      ctx.fill();

      // Primary catchlight
      ctx.beginPath();
      ctx.arc(trackX - dilatedPupil * 0.3, trackY - dilatedPupil * 0.3, dilatedPupil * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fill();

      // Secondary smaller catchlight for realism
      ctx.beginPath();
      ctx.arc(trackX + dilatedPupil * 0.2, trackY + dilatedPupil * 0.35, dilatedPupil * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();

      // --- Style-specific overlays ---

      if (style === "soft") {
        // Gentle lower eyelid curve for friendlier look
        ctx.beginPath();
        ctx.arc(0, eyeRadius * 0.5, eyeRadius * 0.8, Math.PI * 0.15, Math.PI * 0.85);
        ctx.strokeStyle = "rgba(200, 210, 230, 0.5)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      if (style === "narrow") {
        // Sharp eyeliner stroke along upper edge
        ctx.beginPath();
        ctx.ellipse(0, -eyeRadius * 0.1, eyeRadius * eyeAspect, eyeRadius * 0.15, 0, Math.PI * 0.1, Math.PI * 0.9);
        ctx.strokeStyle = "rgba(20, 20, 30, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      if (style === "dot") {
        // Subtle glow ring around each dot
        ctx.beginPath();
        ctx.arc(trackX, trackY, dilatedPupil * 1.6, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${irisHue}, 70%, 60%, 0.25)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (style === "sparkle") {
        // 6-point star with twinkle particles
        const starAngle = state.time * 1.5;
        const starSize = eyeRadius * 0.4;
        ctx.save();
        ctx.translate(trackX, trackY);
        ctx.rotate(starAngle);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const ia = a + Math.PI / 6;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * starSize, Math.sin(a) * starSize);
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ia) * starSize * 0.35, Math.sin(ia) * starSize * 0.35);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.stroke();

        // Tiny twinkle particles orbiting
        for (let i = 0; i < 3; i++) {
          const ta = starAngle * 0.5 + (i / 3) * Math.PI * 2;
          const tr = starSize * 0.7;
          const tx = Math.cos(ta) * tr;
          const ty = Math.sin(ta) * tr;
          const ts = 0.5 + Math.sin(state.time * 3 + i * 2) * 0.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 0.8 * ts, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * ts})`;
          ctx.fill();
        }
        ctx.restore();
      }

      if (style === "heart") {
        // Soft pink glow halo behind heart
        const hs = eyeRadius * 0.5;
        const pulse = 1 + Math.sin(state.time * 4) * 0.08;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, eyeRadius * 0.8, 0, Math.PI * 2);
        const haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeRadius * 0.8);
        haloGrad.addColorStop(0, "rgba(255, 150, 180, 0.2)");
        haloGrad.addColorStop(1, "rgba(255, 150, 180, 0)");
        ctx.fillStyle = haloGrad;
        ctx.fill();
        ctx.restore();

        // Heart shape with improved curves
        ctx.save();
        ctx.translate(trackX, trackY);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        const top = -hs * 0.3;
        ctx.moveTo(0, hs * 0.4);
        ctx.bezierCurveTo(-hs * 0.55, top - hs * 0.18, -hs * 0.85, top + hs * 0.25, 0, top + hs * 0.75);
        ctx.bezierCurveTo(hs * 0.85, top + hs * 0.25, hs * 0.55, top - hs * 0.18, 0, hs * 0.4);
        ctx.fillStyle = "rgba(255, 100, 140, 0.92)";
        ctx.fill();
        // Highlight on heart
        ctx.beginPath();
        ctx.arc(-hs * 0.2, top + hs * 0.15, hs * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 200, 210, 0.6)";
        ctx.fill();
        ctx.restore();
      }

      if (style === "crescent") {
        const cs = eyeRadius * 0.55;
        const rot = state.time * 0.5;
        ctx.save();
        ctx.translate(trackX, trackY);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.arc(0, 0, cs, Math.PI * 0.25, Math.PI * 1.75);
        ctx.arc(cs * 0.4, 0, cs * 0.85, Math.PI * 1.75, Math.PI * 0.25, true);
        ctx.closePath();
        ctx.fillStyle = "rgba(220, 220, 240, 0.85)";
        ctx.fill();

        // Star sparkle at crescent inner curve
        const sx = -cs * 0.3;
        const sy = 0;
        const sts = 0.5 + Math.sin(state.time * 2) * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8 * sts, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * sts})`;
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();
    }

    if (config.emoteIntensity > 0.2) {
      this.drawEmoteAccents(ctx, radius, state, eyeY, config);
    }
  }

  private drawEmoteAccents(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    eyeY: number,
    config: AppearanceConfig,
  ): void {
    const intensity = config.emoteIntensity;

    if (state.surfaceMood === "excited" || state.surfaceMood === "playful") {
      ctx.beginPath();
      ctx.arc(0, eyeY + radius * 0.45, radius * 0.12, 0, Math.PI);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * intensity})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (state.surfaceMood === "shy" || state.surfaceMood === "overwhelmed") {
      ctx.beginPath();
      ctx.arc(0, eyeY + radius * 0.5, radius * 0.08, Math.PI, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 200, 200, ${0.3 * intensity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (state.surfaceMood === "shy" && intensity > 0.3) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(
          radius * 0.35 * side, eyeY + radius * 0.25,
          radius * 0.12, radius * 0.08, 0, 0, Math.PI * 2
        );
        ctx.fillStyle = `rgba(255, 150, 150, ${0.2 * intensity})`;
        ctx.fill();
      }
    }
  }

  private updateBlink(dt: number, state: KovyRenderState): void {
    this.blinkTimer -= dt;

    if (this.blinkState > 0) {
      this.blinkState -= dt / this.blinkDuration;
      if (this.blinkState <= 0) {
        this.blinkState = 0;
        if (this.blinkClusterRemaining > 0) {
          this.blinkClusterRemaining--;
          this.blinkTimer = 0.08 + Math.random() * 0.07;
        }
      }
    } else if (this.blinkTimer <= 0) {
      if (this.blinkClusterRemaining <= 0) {
        const clusterChance = state.surfaceMood === "shy" ? 0.4
          : state.surfaceMood === "overwhelmed" ? 0.35
          : state.surfaceMood === "sleepy" ? 0.3
          : 0.15;
        this.blinkClusterRemaining = Math.random() < clusterChance
          ? (Math.random() < 0.3 ? 2 : 1)
          : 0;
      }
      this.blinkPartialAmount = Math.random() < 0.2 ? randomRange(0.5, 0.8) : 1.0;
      this.blinkState = this.blinkPartialAmount;
      this.blinkDuration = state.surfaceMood === "sleepy" ? 0.25
        : state.surfaceMood === "excited" ? 0.10
        : 0.15;
      const mods = getMoodModifiers(state.surfaceMood);
      this.nextBlinkInterval = mods.blinkInterval + randomRange(-1, 1);
      this.blinkTimer = this.nextBlinkInterval;
    }
  }

  private updateEyeDrift(dt: number, state: KovyRenderState): void {
    const targetMag = Math.sqrt(state.eyeTarget.x ** 2 + state.eyeTarget.y ** 2);
    if (targetMag > 0.15) {
      this.eyeDriftX *= Math.max(0, 1 - dt * 5);
      this.eyeDriftY *= Math.max(0, 1 - dt * 5);
      return;
    }

    this.eyeDriftTimer -= dt;
    if (this.eyeDriftTimer <= 0) {
      this.eyeDriftTargetX = (Math.random() - 0.5) * 0.6;
      this.eyeDriftTargetY = (Math.random() - 0.5) * 0.4;
      if (Math.random() < 0.3) {
        this.eyeDriftTargetX = 0;
        this.eyeDriftTargetY = 0;
      }
      const mods = getMoodModifiers(state.surfaceMood);
      this.eyeDriftTimer = 1.5 + Math.random() * 2.5 / Math.max(0.3, mods.curiosityMultiplier);
    }

    const speed = Math.min(1, dt * 3);
    this.eyeDriftX += (this.eyeDriftTargetX - this.eyeDriftX) * speed;
    this.eyeDriftY += (this.eyeDriftTargetY - this.eyeDriftY) * speed;
  }
}
