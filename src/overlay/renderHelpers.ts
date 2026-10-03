// ============================================================
// Render Helpers — extracted from KovyRenderer
// Build KovyRenderState objects for founder and siblings
// ============================================================

import type { KovyRenderState } from "./KovyCharacter";
import type { KovyConfig, Vec2, SurfaceMood, BehaviorState, GamingOutput, CircadianOutput, ToneMode } from "@/store/types";

export type MovementResult = {
  position: Vec2;
  velocity: Vec2;
  squashStretch: Vec2;
  leanAngle: number;
  landingImpact: number;
};

export const BOND_WARMTH_MAP: Record<string, number> = {
  stranger: 0,
  acquaintance: 0.2,
  companion: 0.4,
  friend: 0.7,
  best_friend: 1.0,
};

export interface EntityVisualMeta {
  customColorsEnabled?: boolean;
  primaryColor?: string;
  secondaryColor?: string | null;
  toneMode?: ToneMode;
  opacity?: number;
  rimLightIntensity?: number;
}

export interface EntityPersonalityMeta {
  colorHueOffset?: number;
  sizeOffset?: number;
}

export function buildFounderRenderState(
  movement: MovementResult,
  behaviorState: BehaviorState,
  surfaceMood: SurfaceMood,
  blinkState: number,
  glowPulse: number,
  eyeTarget: Vec2,
  isAsleep: boolean,
  time: number,
  config: KovyConfig,
  gamingOutput: GamingOutput,
  circadianOutput: CircadianOutput,
  founderVisual: EntityVisualMeta | undefined,
  founderPersonality: EntityPersonalityMeta | undefined,
  name: string,
  bondWarmth: number,
): KovyRenderState {
  return {
    position: movement.position,
    velocity: movement.velocity,
    squashStretch: movement.squashStretch,
    surfaceMood,
    behaviorState,
    blinkState,
    glowPulse,
    eyeTarget,
    isAsleep,
    time,
    moodToColor: config.mood.moodToColor,
    moodToParticles: config.mood.moodToParticles,
    eyeStyle: config.appearance.eyeStyle,
    hueOffset: founderPersonality?.colorHueOffset,
    sizeOffset: founderPersonality?.sizeOffset,
    gamingExcitement: gamingOutput.excitement,
    elasticity: gamingOutput.elasticity,
    freeformWobble: gamingOutput.freeformWobble,
    predictionConfidence: gamingOutput.predictionConfidence,
    dreamIntensity: circadianOutput.dreamIntensity,
    isStartled: behaviorState === "startle",
    leanAngle: movement.leanAngle,
    landingImpact: movement.landingImpact,
    showName: config.family.showFamilyNames,
    name,
    customColorsEnabled: founderVisual?.customColorsEnabled,
    primaryColor: founderVisual?.primaryColor,
    secondaryColor: founderVisual?.secondaryColor,
    toneMode: founderVisual?.toneMode as KovyRenderState["toneMode"],
    entityOpacity: founderVisual?.opacity,
    rimLightIntensity: founderVisual?.rimLightIntensity ?? 0.3,
    bondWarmth,
  };
}

export function buildSiblingRenderState(
  movement: MovementResult,
  behaviorState: BehaviorState,
  surfaceMood: SurfaceMood,
  blinkState: number,
  glowPulse: number,
  eyeTarget: Vec2,
  isAsleep: boolean,
  time: number,
  config: KovyConfig,
  gamingOutput: GamingOutput,
  circadianOutput: CircadianOutput,
  sibPersonality: EntityPersonalityMeta,
  sibVisual: EntityVisualMeta | undefined,
  name: string,
  bondWarmth: number,
): KovyRenderState {
  return {
    position: movement.position,
    velocity: movement.velocity,
    squashStretch: movement.squashStretch,
    surfaceMood,
    behaviorState,
    blinkState,
    glowPulse,
    eyeTarget,
    isAsleep,
    time,
    moodToColor: config.mood.moodToColor,
    moodToParticles: config.mood.moodToParticles,
    eyeStyle: config.appearance.eyeStyle,
    hueOffset: sibPersonality.colorHueOffset,
    sizeOffset: sibPersonality.sizeOffset,
    gamingExcitement: gamingOutput.excitement,
    elasticity: gamingOutput.elasticity,
    freeformWobble: gamingOutput.freeformWobble,
    predictionConfidence: gamingOutput.predictionConfidence,
    dreamIntensity: circadianOutput.dreamIntensity,
    isStartled: behaviorState === "startle",
    leanAngle: movement.leanAngle,
    landingImpact: movement.landingImpact,
    showName: config.family.showFamilyNames,
    name,
    customColorsEnabled: sibVisual?.customColorsEnabled,
    primaryColor: sibVisual?.primaryColor,
    secondaryColor: sibVisual?.secondaryColor,
    toneMode: sibVisual?.toneMode,
    entityOpacity: sibVisual?.opacity,
    rimLightIntensity: sibVisual?.rimLightIntensity ?? 0.3,
    bondWarmth,
  };
}

export function computeBondWarmth(
  bondEnabled: boolean,
  bondLevel: string | undefined,
): number {
  if (!bondEnabled || !bondLevel) return 0;
  return BOND_WARMTH_MAP[bondLevel] ?? 0;
}

export function computeGlowPulse(
  time: number,
  glowIntensity: number,
  phaseOffset: number = 0,
): number {
  return (Math.sin(time * 1.5 + phaseOffset) * 0.5 + 0.5) * glowIntensity;
}

export function computeEyeTarget(
  activeTarget: { position: Vec2 } | null,
  cursorPosition: Vec2,
  entityPosition: Vec2,
): Vec2 {
  if (activeTarget) {
    const dx = activeTarget.position.x - entityPosition.x;
    const dy = activeTarget.position.y - entityPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      return { x: dx / dist, y: dy / dist };
    }
  } else {
    const dx = cursorPosition.x - entityPosition.x;
    const dy = cursorPosition.y - entityPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 50) {
      return { x: (dx / dist) * 0.5, y: (dy / dist) * 0.5 };
    }
  }
  return { x: 0, y: 0 };
}
