import type { Vec2, SurfaceMood, AppearanceConfig, BehaviorState, EyeStyle, BodyStyle, ToneMode, GrowthStage } from "@/store/types";
import { clamp } from "@/lib/utils";
import { getMoodModifiers } from "@/engine/moodEngine";
import { ExpressionRenderer } from "./ExpressionRenderer";
import { ColorTransitionManager, shiftHSLHue, lightenHSL, darkenHSL } from "./character/colorHelper";
import { ParticleRenderer } from "./character/particleRenderer";
import { EyeRenderer } from "./character/eyeRenderer";
import { BodyRenderer } from "./character/bodyRenderer";
import { IdleAnimationSystem } from "./character/idleAnimationSystem";
import { TearSystem } from "./character/tearSystem";
import { drawNamePip } from "./character/namePipRenderer";

export interface KovyRenderState {
  position: Vec2;
  velocity: Vec2;
  squashStretch: Vec2;
  surfaceMood: SurfaceMood;
  behaviorState: BehaviorState;
  blinkState: number;
  glowPulse: number;
  eyeTarget: Vec2;
  isAsleep: boolean;
  time: number;
  moodToColor: boolean;
  moodToParticles: boolean;
  eyeStyle: EyeStyle;
  bodyStyle?: BodyStyle;
  hueOffset?: number;
  sizeOffset?: number;
  gamingExcitement?: number;
  elasticity?: number;
  freeformWobble?: number;
  predictionConfidence?: number;
  dreamIntensity?: number;
  isStartled?: boolean;
  leanAngle?: number;
  landingImpact?: number;
  showName?: boolean;
  name?: string;
  customColorsEnabled?: boolean;
  primaryColor?: string;
  secondaryColor?: string | null;
  toneMode?: ToneMode;
  entityOpacity?: number;
  rimLightIntensity?: number;
  bondWarmth?: number;
  growthScale?: number;
  postureDroop?: number;
  attentionWiggle?: number;
  comboCount?: number;
  growthStage?: GrowthStage;
  dreamColorWashHue?: number;
  dreamColorWashIntensity?: number;
}

export class KovyCharacterRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: AppearanceConfig;

  private breathPhase: number = 0;
  private breathRate: number = 0.6;
  private breathDepth: number = 0.035;
  private breathOffsetY: number = 0;

  private colorMgr: ColorTransitionManager;
  private particleRenderer: ParticleRenderer;
  private eyeRenderer: EyeRenderer;
  private bodyRenderer: BodyRenderer;
  private idleAnim: IdleAnimationSystem;
  private tearSystem: TearSystem;
  private expressionRenderer: ExpressionRenderer;

  private readonly BASE_RADIUS = 32;

  constructor(canvas: HTMLCanvasElement, config: AppearanceConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.config = config;
    this.colorMgr = new ColorTransitionManager();
    this.particleRenderer = new ParticleRenderer();
    this.eyeRenderer = new EyeRenderer();
    this.bodyRenderer = new BodyRenderer(this.colorMgr, () => this.breathPhase);
    this.idleAnim = new IdleAnimationSystem();
    this.tearSystem = new TearSystem();
    this.expressionRenderer = new ExpressionRenderer(this.ctx);
  }

  updateConfig(config: AppearanceConfig) {
    this.config = config;
  }

  render(state: KovyRenderState, dt: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.renderEntity(state, dt);
  }

  renderEntity(state: KovyRenderState, dt: number) {
    const ctx = this.ctx;
    const sizeOff = state.sizeOffset ?? 0;
    const growthMul = state.growthScale ?? 1;
    const stage = state.growthStage;

    // Growth stage visual modifiers
    let stageSizeMul = 1;
    let stageBreathRateMul = 1;
    let stageBreathDepthMul = 1;
    let stageRimLightBoost = 0;
    let stageDroopBoost = 0;
    if (stage === "sprout") {
      stageSizeMul = 0.75;
      stageBreathDepthMul = 1.4;
      stageBreathRateMul = 1.15;
    } else if (stage === "young") {
      stageSizeMul = 0.9;
      stageBreathRateMul = 1.08;
    } else if (stage === "mature") {
      stageSizeMul = 1.0;
      stageRimLightBoost = 0.05;
    } else if (stage === "elder") {
      stageSizeMul = 1.1;
      stageBreathRateMul = 0.67;
      stageDroopBoost = 0.03;
    }

    const scale = this.config.size * (1 + sizeOff) * clamp(growthMul * stageSizeMul, 0.5, 1.5);
    const radius = this.BASE_RADIUS * scale;
    const cx = state.position.x;
    const cy = state.position.y;

    // Update vitality systems
    const bp = this.getBreathParams(state.surfaceMood);
    this.breathRate += (bp.rate * stageBreathRateMul - this.breathRate) * Math.min(1, dt * 2);
    this.breathDepth += (bp.depth * stageBreathDepthMul - this.breathDepth) * Math.min(1, dt * 2);
    this.breathPhase += dt * this.breathRate * Math.PI * 2;
    const breathIrreg = 1 + Math.sin(this.breathPhase * 1.618) * bp.irregularity;
    this.breathOffsetY = -Math.cos(this.breathPhase) * this.breathDepth * radius * 0.4;

    this.eyeRenderer.update(dt, state);
    this.tearSystem.update(dt, state, radius, this.config);
    this.colorMgr.update(state, dt, this.config.moodColorShift);
    this.particleRenderer.update(dt, state, cx, cy, radius, this.config);
    this.bodyRenderer.updateTentacles(dt, state, radius, this.config);
    this.idleAnim.update(dt, state);

    if (this.config.reducedMotion) {
      this.renderSimple(ctx, state, cx, cy, radius);
      return;
    }

    const gExcitement = state.gamingExcitement ?? 0;
    const gElasticity = state.elasticity ?? 0;
    const gWobble = state.freeformWobble ?? 0;

    const breathScale = 1 + Math.sin(this.breathPhase) * this.breathDepth * breathIrreg;
    const landing = state.landingImpact ?? 0;
    const landSquashX = 1 + landing * 0.15;
    const landSquashY = 1 - landing * 0.12;
    const elasticAmp = 1 + gElasticity * 0.3;
    const idleSS = this.idleAnim.getSquashStretch();
    const ssX = state.squashStretch.x * breathScale * elasticAmp * landSquashX * idleSS.x;
    const ssY = state.squashStretch.y * (2 - breathScale) * elasticAmp * landSquashY * idleSS.y;

    const idleOffset = this.idleAnim.getOffset();

    const wobbleX = gWobble > 0.01
      ? Math.sin(state.time * 8 + (state.hueOffset ?? 0) * 0.5) * gWobble * 3
      : 0;
    const wobbleY = gWobble > 0.01
      ? Math.cos(state.time * 6.5 + (state.hueOffset ?? 0) * 0.3) * gWobble * 2
      : 0;

    // Gaming ghost shell
    if (gExcitement > 0.4) {
      const entityAlpha = (state.entityOpacity ?? 1) * this.config.opacity;
      const ghostAlpha = (gExcitement - 0.4) * 0.25;
      const ghostOffX = -state.velocity.x * 0.03;
      const ghostOffY = -state.velocity.y * 0.03;
      ctx.save();
      ctx.translate(cx + ghostOffX, cy + ghostOffY);
      ctx.scale(ssX * 1.05, ssY * 1.05);
      ctx.globalAlpha = ghostAlpha * entityAlpha;
      ctx.beginPath();
      this.bodyRenderer.traceBodyPath(ctx, radius * 1.05, state, this.config);
      const hueOff = state.hueOffset ?? 0;
      const ghostColor = hueOff !== 0 ? shiftHSLHue(this.colorMgr.currentColor, hueOff) : this.colorMgr.currentColor;
      ctx.fillStyle = ghostColor;
      ctx.fill();
      ctx.restore();
    }

    // Combo ghost shell: extra trail at high combos (v7.0)
    const comboCount = state.comboCount ?? 0;
    if (comboCount > 10 && gExcitement > 0.2) {
      const entityAlpha = (state.entityOpacity ?? 1) * this.config.opacity;
      const comboGhostAlpha = Math.min((comboCount - 10) * 0.015, 0.2);
      const ghostOffX = -state.velocity.x * 0.05;
      const ghostOffY = -state.velocity.y * 0.05;
      ctx.save();
      ctx.translate(cx + ghostOffX, cy + ghostOffY);
      ctx.scale(ssX * 1.08, ssY * 1.08);
      ctx.globalAlpha = comboGhostAlpha * entityAlpha;
      ctx.beginPath();
      this.bodyRenderer.traceBodyPath(ctx, radius * 1.08, state, this.config);
      const hueOff = state.hueOffset ?? 0;
      const comboColor = hueOff !== 0 ? shiftHSLHue(this.colorMgr.currentColor, hueOff) : this.colorMgr.currentColor;
      ctx.fillStyle = comboColor;
      ctx.fill();
      ctx.restore();
    }

    const lean = state.leanAngle ?? 0;
    const droop = (state.postureDroop ?? 0) + stageDroopBoost;
    const postureY = droop * radius * 0.5;
    const postureScaleY = 1 - droop * 0.5;

    const wiggle = state.attentionWiggle ?? 0;
    const wiggleX = wiggle > 0.01
      ? Math.sin(state.time * 12) * wiggle * 4
      : 0;

    ctx.save();
    ctx.translate(cx + wobbleX + idleOffset.x + wiggleX, cy + wobbleY + this.breathOffsetY + idleOffset.y + postureY);
    ctx.rotate(lean + idleOffset.rotation);
    ctx.scale(ssX, ssY * postureScaleY);

    // Layer 1: Shadow
    this.bodyRenderer.drawShadow(ctx, radius, this.config);

    // Layer 2: Glow halo
    const comboGlowBoost = comboCount > 5 ? Math.min(comboCount * 0.02, 0.3) : 0;
    if (gExcitement > 0.01 || comboGlowBoost > 0) {
      const boostedState = { ...state, glowPulse: state.glowPulse + gExcitement * 0.3 + comboGlowBoost };
      this.bodyRenderer.drawGlowHalo(ctx, radius, boostedState, this.config);
    } else {
      this.bodyRenderer.drawGlowHalo(ctx, radius, state, this.config);
    }

    // Layer 3: Body
    this.bodyRenderer.draw(ctx, radius, state, this.config);

    // Layer 4: Eyes
    this.eyeRenderer.draw(ctx, radius, state, this.config);

    // Layer 4b: Expressions
    if (this.config.emoteIntensity > 0.05 && !this.config.reducedMotion) {
      this.expressionRenderer.drawEyebrows(ctx, radius, state.surfaceMood, this.config.emoteIntensity);
      this.expressionRenderer.drawMouth(ctx, radius, state.surfaceMood, this.config.emoteIntensity, state.time);
      this.expressionRenderer.drawBlush(ctx, radius, state.surfaceMood, state.time);
      this.expressionRenderer.drawCheeks(ctx, radius, this.colorMgr.getBlendedMoodColor(state.hueOffset ?? 0), state.time);
    }

    // Layer 5: Highlight
    this.bodyRenderer.drawHighlight(ctx, radius, state, this.config);

    // Layer 5b: Rim light
    this.bodyRenderer.drawRimLight(ctx, radius, state, this.config);

    // Layer 5c: Bond warmth aura
    const bondWarmth = state.bondWarmth ?? 0;
    if (bondWarmth > 0.01) {
      this.bodyRenderer.drawBondWarmthAura(ctx, radius, bondWarmth, state, this.config);
    }

    ctx.restore();

    // Layer 6: Particles
    this.particleRenderer.draw(ctx);

    // Layer 7: Ambient motes
    if (this.config.particleAmount > 0.3) {
      this.particleRenderer.drawAmbientMotes(ctx, cx, cy, radius, this.config, this.colorMgr.getBlendedMoodColor(0));
    }

    // Layer 8: Dream constellation
    const dreamIntensity = state.dreamIntensity ?? 0;
    if (dreamIntensity > 0.1 && (state.behaviorState === "dream" || state.behaviorState === "nap" || state.behaviorState === "meditate")) {
      const meditateScale = state.behaviorState === "meditate" ? 0.5 : 1;
      this.particleRenderer.drawDreamConstellation(ctx, cx, cy, radius, state.time, dreamIntensity * meditateScale, this.config);
    }

    // Layer 9: Name pip
    if (state.showName && state.name) {
      drawNamePip(ctx, cx, cy, radius, state.name, this.colorMgr.currentColor);
    }

    // Layer 10: Tears
    if (this.tearSystem.hasTears) {
      this.tearSystem.draw(ctx, cx, cy, radius);
    }

    // Layer 11: Dizzy stars
    if ((state.surfaceMood === "overwhelmed" || state.isStartled) && this.config.emoteIntensity > 0.2 && !this.config.reducedMotion) {
      this.expressionRenderer.drawDizzyStars(ctx, cx, cy, radius, state.time);
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getBlinkState(): number {
    return this.eyeRenderer.getBlinkState();
  }

  destroy() {
    this.particleRenderer.destroy();
    this.tearSystem.destroy();
    this.bodyRenderer.destroy();
  }

  // --- Private helpers ---

  private getBreathParams(mood: SurfaceMood): { rate: number; depth: number; irregularity: number } {
    switch (mood) {
      case "calm":        return { rate: 0.6,  depth: 0.035, irregularity: 0.05 };
      case "curious":     return { rate: 0.9,  depth: 0.025, irregularity: 0.10 };
      case "playful":     return { rate: 1.2,  depth: 0.030, irregularity: 0.15 };
      case "focused":     return { rate: 0.7,  depth: 0.020, irregularity: 0.03 };
      case "sleepy":      return { rate: 0.35, depth: 0.040, irregularity: 0.05 };
      case "excited":     return { rate: 1.6,  depth: 0.020, irregularity: 0.20 };
      case "overwhelmed": return { rate: 1.4,  depth: 0.025, irregularity: 0.30 };
      case "shy":         return { rate: 0.8,  depth: 0.020, irregularity: 0.10 };
      case "content":     return { rate: 0.65, depth: 0.035, irregularity: 0.04 };
      case "anxious":     return { rate: 1.3,  depth: 0.022, irregularity: 0.25 };
      case "nostalgic":   return { rate: 0.55, depth: 0.030, irregularity: 0.06 };
      case "determined":  return { rate: 0.85, depth: 0.025, irregularity: 0.08 };
    }
  }

  private renderSimple(
    ctx: CanvasRenderingContext2D, state: KovyRenderState,
    cx: number, cy: number, radius: number
  ) {
    const entityAlpha = (state.entityOpacity ?? 1) * this.config.opacity;
    const droop = state.postureDroop ?? 0;
    ctx.save();
    ctx.translate(cx, cy + droop * radius * 0.5);
    ctx.scale(1, 1 - droop * 0.5);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, this.colorMgr.currentColor);
    grad.addColorStop(1, darkenHSL(this.colorMgr.currentColor, 20));
    ctx.beginPath();
    this.bodyRenderer.traceBodyPath(ctx, radius, state, this.config);
    ctx.fillStyle = grad;
    ctx.globalAlpha = entityAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    this.eyeRenderer.draw(ctx, radius, state, this.config);

    ctx.restore();
  }
}
