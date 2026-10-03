import type { AppearanceConfig, BodyStyle, SurfaceMood } from "@/store/types";
import { hexToHsl, hexToRgba } from "@/lib/colorUtils";
import { getMoodGlowColor } from "@/engine/moodEngine";
import type { KovyRenderState } from "../KovyCharacter";
import { lightenHSL, darkenHSL, lerpHSL, shiftHSLHue, type ColorTransitionManager } from "./colorHelper";

interface TentacleState {
  baseAngle: number;
  phase: number;
  reach: number;
  targetReach: number;
  currentAngle: number;
  targetAngle: number;
  lengthMul: number;
}

export class BodyRenderer {
  private tentacles: TentacleState[] = [];
  private tentaclesInitialized: boolean = false;

  constructor(
    private colorMgr: ColorTransitionManager,
    private getBreathPhase: () => number,
  ) {}

  draw(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    this.drawByStyle(ctx, radius, state, config);
  }

  drawShadow(ctx: CanvasRenderingContext2D, radius: number, config: AppearanceConfig): void {
    const softness = config.shadowSoftness;
    if (softness < 0.05) return;

    const shadowY = radius * 1.1;
    const shadowRx = radius * 0.7;
    const shadowRy = radius * 0.15;

    ctx.save();
    ctx.translate(0, shadowY);
    ctx.beginPath();
    ctx.ellipse(0, 0, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowRx);
    grad.addColorStop(0, `rgba(0, 0, 0, ${0.25 * softness})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  drawGlowHalo(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const intensity = config.glowIntensity;
    if (intensity < 0.05) return;
    const entityAlpha = state.entityOpacity ?? 1;

    const glowRadius = radius * 2.2;
    const pulseScale = 1 + state.glowPulse * 0.15;

    let glowColor: string;
    if (state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor) {
      glowColor = hexToRgba(state.secondaryColor, 0.3 * intensity * entityAlpha);
    } else if (state.customColorsEnabled && state.primaryColor) {
      glowColor = hexToRgba(state.primaryColor, 0.3 * intensity * entityAlpha);
    } else {
      glowColor = getMoodGlowColor(state.surfaceMood, state.glowPulse);
    }

    ctx.save();
    ctx.scale(pulseScale, pulseScale);
    const grad = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, glowRadius);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, `${0.15 * intensity * entityAlpha})`));
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  drawHighlight(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState | undefined,
    config: AppearanceConfig,
  ): void {
    const hlGrad = ctx.createRadialGradient(
      -radius * 0.25, -radius * 0.35, 0,
      -radius * 0.15, -radius * 0.25, radius * 0.52
    );

    if (state?.customColorsEnabled && state.primaryColor) {
      const tinted = lightenHSL(this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0), 38);
      const tintedA = (v: number) => tinted.replace('hsl(', 'hsla(').replace('%)', `%, ${v})`);
      hlGrad.addColorStop(0, tintedA(0.38));
      hlGrad.addColorStop(0.45, tintedA(0.15));
      hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
      hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      hlGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.07)');
      hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    ctx.beginPath();
    if (state) {
      this.traceBodyPath(ctx, radius, state, config);
    } else {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = hlGrad;
    ctx.fill();
  }

  drawRimLight(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const rimIntensity = (state.rimLightIntensity ?? 0.3) * (state.entityOpacity ?? 1) * config.opacity;
    if (rimIntensity < 0.02 || config.reducedMotion) return;

    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    let rimColor: string;
    if (state.customColorsEnabled && state.toneMode === 'dual' && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      rimColor = `hsl(${Math.round(h2)}, ${Math.min(100, Math.round(s2 * 100) + 15)}%, ${Math.min(90, Math.round(l2 * 100) + 18)}%)`;
    } else {
      rimColor = lightenHSL(moodColor, 32);
    }

    ctx.save();
    ctx.beginPath();
    this.traceBodyPath(ctx, radius - 0.5, state, config);
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = rimIntensity * 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawBondWarmthAura(
    ctx: CanvasRenderingContext2D,
    radius: number,
    warmth: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;
    const pulseScale = 1 + Math.sin(state.time * 1.5) * 0.04;
    const auraRadius = radius * (1.15 + warmth * 0.25) * pulseScale;

    ctx.save();
    const grad = ctx.createRadialGradient(0, 0, radius * 0.85, 0, 0, auraRadius);
    const innerAlpha = warmth * 0.35 * entityAlpha;
    const midAlpha = warmth * 0.18 * entityAlpha;
    grad.addColorStop(0, `rgba(255, 200, 100, ${innerAlpha})`);
    grad.addColorStop(0.5, `rgba(255, 180, 80, ${midAlpha})`);
    grad.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  traceBodyPath(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const style = this.getBodyStyle(state, config);
    switch (style) {
      case "blob":
        this.traceBlobPath(ctx, radius, state);
        break;
      case "ghost":
        this.traceGhostPath(ctx, radius, state);
        break;
      case "star":
        this.traceStarPath(ctx, radius, state);
        break;
      case "crystal":
        this.traceCrystalPath(ctx, radius);
        break;
      case "classic":
      default:
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        break;
    }
  }

  updateTentacles(dt: number, state: KovyRenderState, _radius: number, config: AppearanceConfig): void {
    if (!this.isBlob(config, state)) return;
    if (!this.tentaclesInitialized) this.initTentacles();

    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);
    const velAngle = speed > 1 ? Math.atan2(state.velocity.y, state.velocity.x) : 0;

    const moodReach: Record<string, number> = {
      excited: 0.9, playful: 0.8, curious: 0.7,
      calm: 0.4, shy: 0.2, focused: 0.3, sleepy: 0.15, overwhelmed: 0.35,
    };
    const baseReach = moodReach[state.surfaceMood] ?? 0.4;

    for (let i = 0; i < this.tentacles.length; i++) {
      const tent = this.tentacles[i];
      tent.phase += dt * (1.5 + (state.surfaceMood === "excited" ? 1.0 : 0));
      tent.targetReach = baseReach + Math.min(0.4, speed / 200);

      if (speed > 5) {
        tent.targetAngle = velAngle + Math.PI + (i === 0 ? -0.3 : 0.3);
      } else {
        tent.targetAngle = tent.baseAngle + (i === 0 ? -0.2 : 0.2);
      }

      const smoothSpeed = Math.min(1, dt * 3);
      tent.reach += (tent.targetReach - tent.reach) * smoothSpeed;

      let dAngle = tent.targetAngle - tent.currentAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      tent.currentAngle += dAngle * smoothSpeed;
    }
  }

  destroy(): void {
    this.tentacles = [];
    this.tentaclesInitialized = false;
  }

  // --- Private helpers ---

  private getBodyStyle(state?: KovyRenderState, config?: AppearanceConfig): BodyStyle {
    return (state?.bodyStyle ?? config?.bodyStyle ?? "classic") as BodyStyle;
  }

  private isBlob(config: AppearanceConfig, state?: KovyRenderState): boolean {
    return this.getBodyStyle(state, config) === "blob";
  }

  private getMoodWobbleAmount(mood: SurfaceMood): number {
    switch (mood) {
      case "excited":     return 1.5;
      case "playful":     return 1.3;
      case "overwhelmed": return 1.4;
      case "curious":     return 1.0;
      case "calm":        return 0.7;
      case "shy":         return 0.5;
      case "focused":     return 0.4;
      case "sleepy":      return 0.6;
      case "content":     return 0.6;
      case "anxious":     return 1.2;
      case "nostalgic":   return 0.5;
      case "determined":  return 0.8;
    }
  }

  private drawByStyle(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const style = this.getBodyStyle(state, config);
    switch (style) {
      case "blob":
        this.drawTentacles(ctx, radius, state, config);
        this.drawBlobBody(ctx, radius, state, config);
        break;
      case "ghost":
        this.drawGhostBody(ctx, radius, state, config);
        break;
      case "star":
        this.drawStarBody(ctx, radius, state, config);
        break;
      case "crystal":
        this.drawCrystalBody(ctx, radius, state, config);
        break;
      case "classic":
      default:
        this.drawClassicBody(ctx, radius, state, config);
        break;
    }
  }

  private fillBodyGradient(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * 1;

    const grad = ctx.createRadialGradient(
      -radius * 0.15, -radius * 0.2, radius * 0.08,
      0, 0, radius
    );

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    grad.addColorStop(0, lightenHSL(baseColor, 32));
    grad.addColorStop(0.25, lightenHSL(baseColor, 12));
    grad.addColorStop(0.5, baseColor);
    if (isDual) {
      const midTone = lerpHSL(baseColor, outerColor, 0.5);
      grad.addColorStop(0.65, midTone);
      grad.addColorStop(0.82, outerColor);
      grad.addColorStop(1, darkenHSL(outerColor, 22));
    } else {
      grad.addColorStop(0.75, darkenHSL(baseColor, 8));
      grad.addColorStop(1, darkenHSL(baseColor, 30));
    }

    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawClassicBody(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;

    const grad = ctx.createRadialGradient(
      -radius * 0.15, -radius * 0.2, radius * 0.08,
      0, 0, radius
    );

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    grad.addColorStop(0, lightenHSL(baseColor, 32));
    grad.addColorStop(0.25, lightenHSL(baseColor, 12));
    grad.addColorStop(0.5, baseColor);
    if (isDual) {
      const midTone = lerpHSL(baseColor, outerColor, 0.5);
      grad.addColorStop(0.65, midTone);
      grad.addColorStop(0.82, outerColor);
      grad.addColorStop(1, darkenHSL(outerColor, 22));
    } else {
      grad.addColorStop(0.75, darkenHSL(baseColor, 8));
      grad.addColorStop(1, darkenHSL(baseColor, 30));
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();

    // Inner gradient ring for depth
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = lightenHSL(baseColor, 15);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.12 * entityAlpha;
    ctx.stroke();
    ctx.restore();

    // Soft specular highlight at top-left
    ctx.save();
    const specGrad = ctx.createRadialGradient(
      -radius * 0.3, -radius * 0.35, 0,
      -radius * 0.25, -radius * 0.3, radius * 0.4
    );
    specGrad.addColorStop(0, `rgba(255, 255, 255, ${0.22 * entityAlpha})`);
    specGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.06 * entityAlpha})`);
    specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = specGrad;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = lightenHSL(baseColor, 18);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.28 * entityAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawBlobBody(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;

    const grad = ctx.createRadialGradient(
      -radius * 0.15, -radius * 0.2, radius * 0.08,
      0, 0, radius
    );

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    grad.addColorStop(0, lightenHSL(baseColor, 32));
    grad.addColorStop(0.25, lightenHSL(baseColor, 12));
    grad.addColorStop(0.5, baseColor);
    if (isDual) {
      const midTone = lerpHSL(baseColor, outerColor, 0.5);
      grad.addColorStop(0.65, midTone);
      grad.addColorStop(0.82, outerColor);
      grad.addColorStop(1, darkenHSL(outerColor, 22));
    } else {
      grad.addColorStop(0.75, darkenHSL(baseColor, 8));
      grad.addColorStop(1, darkenHSL(baseColor, 30));
    }

    ctx.beginPath();
    this.traceBlobPath(ctx, radius, state);
    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();

    // Soft specular highlight for gelatinous sheen
    ctx.save();
    ctx.beginPath();
    this.traceBlobPath(ctx, radius, state);
    ctx.clip();
    const specGrad = ctx.createRadialGradient(
      -radius * 0.3, -radius * 0.35, 0,
      -radius * 0.25, -radius * 0.3, radius * 0.45
    );
    specGrad.addColorStop(0, `rgba(255, 255, 255, ${0.18 * entityAlpha})`);
    specGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.04 * entityAlpha})`);
    specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = specGrad;
    ctx.fillRect(-radius * 1.2, -radius * 1.2, radius * 2.4, radius * 2.4);
    ctx.restore();

    ctx.beginPath();
    this.traceBlobPath(ctx, radius, state);
    ctx.strokeStyle = lightenHSL(baseColor, 18);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.28 * entityAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawGhostBody(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;
    const breathPulse = 1 + Math.sin(this.getBreathPhase()) * 0.03;

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    const buildGrad = () => {
      const g = ctx.createRadialGradient(
        -radius * 0.15, -radius * 0.2, radius * 0.08,
        0, 0, radius
      );
      g.addColorStop(0, lightenHSL(baseColor, 32));
      g.addColorStop(0.25, lightenHSL(baseColor, 12));
      g.addColorStop(0.5, baseColor);
      if (isDual) {
        const midTone = lerpHSL(baseColor, outerColor, 0.5);
        g.addColorStop(0.65, midTone);
        g.addColorStop(0.82, outerColor);
        g.addColorStop(1, darkenHSL(outerColor, 22));
      } else {
        g.addColorStop(0.75, darkenHSL(baseColor, 8));
        g.addColorStop(1, darkenHSL(baseColor, 30));
      }
      return g;
    };

    // First pass: translucent outer layer
    ctx.beginPath();
    this.traceGhostPath(ctx, radius * breathPulse * 1.04, state);
    ctx.fillStyle = buildGrad();
    ctx.globalAlpha = entityAlpha * 0.35;
    ctx.fill();

    // Second pass: main body
    ctx.beginPath();
    this.traceGhostPath(ctx, radius * breathPulse, state);
    ctx.fillStyle = buildGrad();
    ctx.globalAlpha = entityAlpha * 0.85;
    ctx.fill();

    // Trailing wisp particles at bottom edge
    const bp = this.getBreathPhase();
    const wispCount = 5;
    ctx.save();
    for (let i = 0; i < wispCount; i++) {
      const t = (i + 0.5) / wispCount;
      const angle = Math.PI * 0.5 + (t - 0.5) * Math.PI * 0.8;
      const drift = Math.sin(bp * 1.2 + i * 1.3) * radius * 0.08;
      const wx = Math.cos(angle) * radius * 0.7 + drift;
      const wy = Math.sin(angle) * radius * 0.85 + radius * 0.15;
      const wispR = radius * (0.08 - i * 0.01) * (0.8 + Math.sin(bp * 2 + i) * 0.2);
      ctx.beginPath();
      ctx.arc(wx, wy, wispR, 0, Math.PI * 2);
      ctx.fillStyle = lightenHSL(baseColor, 20);
      ctx.globalAlpha = entityAlpha * 0.15 * (1 - t * 0.5);
      ctx.fill();
    }
    ctx.restore();

    ctx.beginPath();
    this.traceGhostPath(ctx, radius * breathPulse, state);
    ctx.strokeStyle = lightenHSL(baseColor, 18);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3 * entityAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawStarBody(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;
    const bp = this.getBreathPhase();

    const grad = ctx.createRadialGradient(
      -radius * 0.15, -radius * 0.2, radius * 0.08,
      0, 0, radius
    );

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    grad.addColorStop(0, lightenHSL(baseColor, 32));
    grad.addColorStop(0.25, lightenHSL(baseColor, 12));
    grad.addColorStop(0.5, baseColor);
    if (isDual) {
      const midTone = lerpHSL(baseColor, outerColor, 0.5);
      grad.addColorStop(0.65, midTone);
      grad.addColorStop(0.82, outerColor);
      grad.addColorStop(1, darkenHSL(outerColor, 22));
    } else {
      grad.addColorStop(0.75, darkenHSL(baseColor, 8));
      grad.addColorStop(1, darkenHSL(baseColor, 30));
    }

    // Soft glow at each outer point
    const points = 5;
    ctx.save();
    ctx.beginPath();
    this.traceStarPath(ctx, radius, state);
    ctx.clip();
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * radius * 0.8;
      const py = Math.sin(angle) * radius * 0.8;
      const glowR = radius * 0.3 * (0.8 + Math.sin(bp * 1.5 + i) * 0.2);
      const glowGrad = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      glowGrad.addColorStop(0, `rgba(255, 255, 255, ${0.15 * entityAlpha})`);
      glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    }
    ctx.restore();

    ctx.beginPath();
    this.traceStarPath(ctx, radius, state);
    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();

    // Gentle rotation shimmer along edges
    ctx.save();
    ctx.beginPath();
    this.traceStarPath(ctx, radius, state);
    ctx.clip();
    const shimmerAngle = bp * 0.3;
    const shimmerGrad = ctx.createLinearGradient(
      Math.cos(shimmerAngle) * radius, Math.sin(shimmerAngle) * radius,
      Math.cos(shimmerAngle + Math.PI) * radius, Math.sin(shimmerAngle + Math.PI) * radius
    );
    shimmerGrad.addColorStop(0, `rgba(255, 255, 255, ${0.08 * entityAlpha})`);
    shimmerGrad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    shimmerGrad.addColorStop(1, `rgba(255, 255, 255, ${0.08 * entityAlpha})`);
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.beginPath();
    this.traceStarPath(ctx, radius, state);
    ctx.strokeStyle = lightenHSL(baseColor, 18);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.28 * entityAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawCrystalBody(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;
    const bp = this.getBreathPhase();
    const shimmer = 0.7 + Math.sin(bp * 1.5) * 0.3;

    const isDual = state.customColorsEnabled && state.toneMode === "dual" && state.secondaryColor;
    const baseColor = moodColor;
    let outerColor = moodColor;
    if (isDual && state.secondaryColor) {
      const [h2, s2, l2] = hexToHsl(state.secondaryColor);
      outerColor = `hsl(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%)`;
    }

    const grad = ctx.createRadialGradient(
      -radius * 0.15, -radius * 0.2, radius * 0.08,
      0, 0, radius
    );
    grad.addColorStop(0, lightenHSL(baseColor, 32));
    grad.addColorStop(0.25, lightenHSL(baseColor, 12));
    grad.addColorStop(0.5, baseColor);
    if (isDual) {
      const midTone = lerpHSL(baseColor, outerColor, 0.5);
      grad.addColorStop(0.65, midTone);
      grad.addColorStop(0.82, outerColor);
      grad.addColorStop(1, darkenHSL(outerColor, 22));
    } else {
      grad.addColorStop(0.75, darkenHSL(baseColor, 8));
      grad.addColorStop(1, darkenHSL(baseColor, 30));
    }

    ctx.beginPath();
    this.traceCrystalPath(ctx, radius);
    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();

    const facets = 6;
    ctx.save();
    ctx.globalAlpha = entityAlpha * 0.3 * shimmer;
    for (let i = 0; i < facets; i++) {
      const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      const hue = (i / facets) * 360;
      ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Cross-shaped sparkles at each vertex
    ctx.save();
    ctx.globalAlpha = entityAlpha * shimmer * 0.7;
    for (let i = 0; i < facets; i++) {
      const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const sparkSize = radius * 0.08;
      const twinkle = 0.7 + Math.sin(bp * 2 + i * 1.5) * 0.3;

      // Central dot
      ctx.beginPath();
      ctx.arc(x, y, sparkSize * 0.5 * twinkle, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fill();

      // Cross-shaped glint
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bp * 0.5 + i);
      ctx.beginPath();
      ctx.moveTo(-sparkSize * twinkle, 0);
      ctx.lineTo(sparkSize * twinkle, 0);
      ctx.moveTo(0, -sparkSize * twinkle);
      ctx.lineTo(0, sparkSize * twinkle);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * twinkle})`;
      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Chromatic aberration edge refraction
    ctx.save();
    ctx.globalAlpha = entityAlpha * 0.2;
    ctx.beginPath();
    this.traceCrystalPath(ctx, radius + 1.5);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    this.traceCrystalPath(ctx, radius - 1.5);
    ctx.strokeStyle = "rgba(80, 80, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    this.traceCrystalPath(ctx, radius);
    ctx.strokeStyle = lightenHSL(baseColor, 18);
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.28 * entityAlpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private traceBlobPath(ctx: CanvasRenderingContext2D, radius: number, state: KovyRenderState): void {
    const points = 28;
    const wobbleAmount = this.getMoodWobbleAmount(state.surfaceMood);
    const gElasticity = state.elasticity ?? 0;
    const totalWobble = wobbleAmount * (1 + gElasticity * 0.5);
    const time = state.time;
    const bp = this.getBreathPhase();

    const verts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const w1 = Math.sin(angle * 2 + bp * 0.8) * 0.08;
      const w2 = Math.sin(angle * 3 + bp * 1.3 + time * 0.3) * 0.05;
      const w3 = Math.sin(angle * 5 + time * 0.5) * 0.03;
      const w4 = Math.sin(angle * 7 + bp * 0.5 + time * 0.2) * 0.02;
      const wobble = 1 + (w1 + w2 + w3 + w4) * totalWobble;
      const r = radius * wobble;
      verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    const mid0x = (verts[verts.length - 1].x + verts[0].x) / 2;
    const mid0y = (verts[verts.length - 1].y + verts[0].y) / 2;
    ctx.moveTo(mid0x, mid0y);
    for (let i = 0; i < verts.length; i++) {
      const curr = verts[i];
      const next = verts[(i + 1) % verts.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }
    ctx.closePath();
  }

  private traceGhostPath(ctx: CanvasRenderingContext2D, radius: number, state: KovyRenderState): void {
    const time = state.time;
    const bp = this.getBreathPhase();
    const wobble = this.getMoodWobbleAmount(state.surfaceMood);
    const segments = 32;
    const topCount = Math.floor(segments * 0.6);

    ctx.moveTo(0, -radius);
    for (let i = 1; i <= topCount; i++) {
      const angle = -Math.PI / 2 + (i / topCount) * Math.PI;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    const bottomStart = Math.PI / 2;
    const bottomEnd = Math.PI * 1.5;
    const bottomSegs = segments - topCount;
    const waveCount = 4;
    for (let i = 0; i <= bottomSegs; i++) {
      const t = i / bottomSegs;
      const angle = bottomStart + t * Math.PI;
      const wave = Math.sin(t * Math.PI * waveCount + bp * 1.5 + time * 0.5) * 0.08 * wobble;
      const r = radius * (1 + wave);
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
  }

  private traceStarPath(ctx: CanvasRenderingContext2D, radius: number, state: KovyRenderState): void {
    const points = 5;
    const wobble = this.getMoodWobbleAmount(state.surfaceMood);
    const time = state.time;
    const bp = this.getBreathPhase();
    const outerR = radius;
    const innerR = radius * 0.5;

    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const isOuter = i % 2 === 0;
      const baseR = isOuter ? outerR : innerR;
      const wobbleAmt = Math.sin(angle * 3 + bp * 0.8 + time * 0.3) * 0.04 * wobble;
      const r = baseR * (1 + wobbleAmt);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevAngle = ((i - 1) / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const midAngle = (prevAngle + angle) / 2;
        const midR = (isOuter ? innerR : outerR) * 0.85;
        ctx.quadraticCurveTo(Math.cos(midAngle) * midR, Math.sin(midAngle) * midR, x, y);
      }
    }
    ctx.closePath();
  }

  private traceCrystalPath(ctx: CanvasRenderingContext2D, radius: number): void {
    const facets = 6;
    for (let i = 0; i < facets; i++) {
      const angle = (i / facets) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private initTentacles(): void {
    this.tentacles = [
      {
        baseAngle: Math.PI * 0.65,
        phase: Math.random() * Math.PI * 2,
        reach: 0.3,
        targetReach: 0.3,
        currentAngle: Math.PI * 0.65,
        targetAngle: Math.PI * 0.65,
        lengthMul: 1.0,
      },
      {
        baseAngle: Math.PI * 0.35,
        phase: Math.random() * Math.PI * 2,
        reach: 0.3,
        targetReach: 0.3,
        currentAngle: Math.PI * 0.35,
        targetAngle: Math.PI * 0.35,
        lengthMul: 0.85,
      },
    ];
    this.tentaclesInitialized = true;
  }

  private drawTentacles(
    ctx: CanvasRenderingContext2D,
    radius: number,
    state: KovyRenderState,
    config: AppearanceConfig,
  ): void {
    if (!this.tentaclesInitialized) this.initTentacles();

    const moodColor = this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0);
    const entityAlpha = (state.entityOpacity ?? 1) * config.opacity;
    const bodyColor = darkenHSL(moodColor, 8);

    for (const tent of this.tentacles) {
      const baseX = Math.cos(tent.baseAngle) * radius * 0.85;
      const baseY = Math.sin(tent.baseAngle) * radius * 0.85;

      const length = radius * (1.2 + tent.reach * 1.8) * tent.lengthMul;
      const segments = 14;

      const pts: Array<{ x: number; y: number; w: number }> = [];
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const waveAmp = 0.35 * t;
        const wave = Math.sin(tent.phase + t * Math.PI * 2.5) * waveAmp;
        const wave2 = Math.sin(tent.phase * 1.3 + t * Math.PI * 1.8) * 0.15 * t;
        const angle = tent.currentAngle + wave + wave2;

        const blendAngle = tent.baseAngle + (angle - tent.baseAngle) * t;
        const dist = t * length;
        const x = baseX + Math.cos(blendAngle) * dist;
        const y = baseY + Math.sin(blendAngle) * dist;
        const w = radius * 0.28 * (1 - t * 0.82) * (0.5 + tent.reach * 0.5);
        pts.push({ x, y, w });
      }

      ctx.beginPath();
      for (let s = 0; s < pts.length; s++) {
        const p = pts[s];
        const prev = pts[Math.max(0, s - 1)];
        const next = pts[Math.min(pts.length - 1, s + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const lx = p.x + nx * p.w / 2;
        const ly = p.y + ny * p.w / 2;
        if (s === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      }
      for (let s = pts.length - 1; s >= 0; s--) {
        const p = pts[s];
        const prev = pts[Math.max(0, s - 1)];
        const next = pts[Math.min(pts.length - 1, s + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const rx = p.x - nx * p.w / 2;
        const ry = p.y - ny * p.w / 2;
        ctx.lineTo(rx, ry);
      }
      ctx.closePath();

      const tipX = pts[pts.length - 1].x;
      const tipY = pts[pts.length - 1].y;
      const tentGrad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      tentGrad.addColorStop(0, lightenHSL(bodyColor, 12));
      tentGrad.addColorStop(0.6, bodyColor);
      tentGrad.addColorStop(1, darkenHSL(bodyColor, 20));
      ctx.fillStyle = tentGrad;
      ctx.globalAlpha = entityAlpha * 0.9;
      ctx.fill();

      // Rounded tip cap for organic look
      ctx.beginPath();
      ctx.arc(tipX, tipY, pts[pts.length - 1].w * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = darkenHSL(bodyColor, 22);
      ctx.globalAlpha = entityAlpha * 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
