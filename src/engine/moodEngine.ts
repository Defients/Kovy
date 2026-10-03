import type { InternalMoodState, SurfaceMood, MoodConfig, MemoryInfluence, CircadianOutput } from "@/store/types";
import { clamp, lerp } from "@/lib/utils";

// Derives the dominant surface mood from continuous internal values
export function deriveSurfaceMood(state: InternalMoodState, config: MoodConfig): SurfaceMood {
  if (config.manualOverride) return config.manualOverride;

  const {
    curiosity, comfort, stimulation, fatigue,
    overwhelm, boredom, confidence,
  } = state;

  // Score each candidate mood. Highest score wins.
  const scores: Record<SurfaceMood, number> = {
    calm:        comfort * 0.4 + (1 - stimulation) * 0.3 + (1 - overwhelm) * 0.2 + (1 - boredom) * 0.1,
    curious:     curiosity * 0.5 + stimulation * 0.2 + (1 - fatigue) * 0.2 + confidence * 0.1,
    playful:     (1 - fatigue) * 0.3 + stimulation * 0.25 + confidence * 0.25 + curiosity * 0.2,
    focused:     (1 - boredom) * 0.3 + stimulation * 0.2 + (1 - overwhelm) * 0.3 + confidence * 0.2,
    sleepy:      fatigue * 0.5 + (1 - stimulation) * 0.3 + comfort * 0.2,
    excited:     stimulation * 0.4 + curiosity * 0.25 + (1 - fatigue) * 0.2 + confidence * 0.15,
    overwhelmed: overwhelm * 0.5 + stimulation * 0.2 + fatigue * 0.2 + (1 - comfort) * 0.1,
    shy:         (1 - confidence) * 0.4 + (1 - comfort) * 0.3 + overwhelm * 0.15 + fatigue * 0.15,
    content:     comfort * 0.5 + (1 - overwhelm) * 0.3 + (1 - boredom) * 0.1 + confidence * 0.1,
    anxious:     overwhelm * 0.3 + (1 - comfort) * 0.3 + stimulation * 0.2 + (1 - confidence) * 0.2,
    nostalgic:   comfort * 0.3 + (1 - stimulation) * 0.2 + fatigue * 0.2 + confidence * 0.3,
    determined:  confidence * 0.4 + (1 - fatigue) * 0.3 + stimulation * 0.2 + (1 - overwhelm) * 0.1,
  };

  // Apply config biases
  scores.playful += config.playfulnessBias * 0.2;
  scores.shy += config.shynessBias * 0.2;
  scores.focused += config.focusBias * 0.2;

  let best: SurfaceMood = "calm";
  let bestScore = -1;
  for (const [mood, score] of Object.entries(scores) as [SurfaceMood, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = mood;
    }
  }
  return best;
}

// Update internal mood state based on environmental stimuli
export function updateMoodState(
  current: InternalMoodState,
  dt: number,
  config: MoodConfig,
  stimuli: MoodStimuli,
  memoryInfluence?: MemoryInfluence | null,
  circadianOutput?: CircadianOutput | null,
): InternalMoodState {
  if (!config.enabled) return current;

  const intensity = config.intensity;
  const recovery = config.recoverySpeed;
  const rate = dt * intensity;

  let { curiosity, comfort, stimulation, fatigue, overwhelm, trust, boredom, confidence } = current;

  // Stimulation responds to motion activity + audio energy
  const audioStim = stimuli.audioEnergy ? stimuli.audioEnergy * 0.6 : 0;
  const targetStimulation = clamp(stimuli.motionActivity * 1.2 + audioStim, 0, 1);
  stimulation = lerp(stimulation, targetStimulation, rate * 2);

  // Curiosity rises with novel targets, decays with boredom
  if (stimuli.hasNovelTarget) {
    curiosity = lerp(curiosity, 1.0, rate * 1.5);
  } else {
    curiosity = lerp(curiosity, 0.3, rate * 0.3);
  }

  // Boredom rises when nothing is happening
  if (stimuli.motionActivity < 0.1) {
    boredom = lerp(boredom, 1.0, rate * stimuli.boredomRate * 0.5);
  } else {
    boredom = lerp(boredom, 0.0, rate * 0.8);
  }

  // Fatigue slowly increases, recovers when idle
  if (stimulation > 0.6) {
    fatigue = lerp(fatigue, 1.0, rate * 0.15);
  } else {
    fatigue = lerp(fatigue, config.sleepinessBaseline, rate * recovery * 0.3);
  }

  // Overwhelm spikes with too much stimulation
  if (stimulation > config.overwhelmThreshold && fatigue > 0.5) {
    overwhelm = lerp(overwhelm, 1.0, rate * 0.8);
  } else {
    overwhelm = lerp(overwhelm, 0.0, rate * recovery * 0.5);
  }

  // Comfort slowly builds during calm periods, drops with overwhelm
  if (overwhelm < 0.3 && stimulation < 0.5) {
    comfort = lerp(comfort, 0.9, rate * 0.2);
  } else if (overwhelm > 0.5) {
    comfort = lerp(comfort, 0.2, rate * 0.4);
  }

  // Trust builds slowly with user interaction
  if (stimuli.userInteracted) {
    trust = lerp(trust, 1.0, rate * 0.3);
    confidence = lerp(confidence, 1.0, rate * 0.2);
  }

  // Confidence decays slowly without interaction
  confidence = lerp(confidence, 0.4, rate * 0.05);

  // Random drift for organic feel
  if (config.randomDrift > 0) {
    const drift = config.randomDrift * 0.02;
    curiosity += (Math.random() - 0.5) * drift;
    comfort += (Math.random() - 0.5) * drift * 0.5;
    stimulation += (Math.random() - 0.5) * drift * 0.3;
  }

  // Energy baseline pull — modulated by circadian rhythm
  let energyTarget = config.energyBaseline;
  if (circadianOutput) {
    // Circadian energy multiplier shifts the baseline
    energyTarget = lerp(energyTarget, circadianOutput.energyMultiplier, 0.4);
    // Circadian drowsiness accelerates fatigue accumulation
    fatigue = lerp(fatigue, fatigue + circadianOutput.drowsiness * 0.15, rate * 0.3);
    // Anticipation gives a subtle curiosity nudge
    curiosity = lerp(curiosity, curiosity + circadianOutput.anticipation * 0.1, rate * 0.2);
  }
  stimulation = lerp(stimulation, energyTarget, rate * 0.05);

  // Memory influence: gently bias mood toward historical patterns
  if (memoryInfluence) {
    // Memory-derived comfort biases baseline comfort
    comfort = lerp(comfort, memoryInfluence.comfortLevel, rate * 0.03);

    // Curiosity bias from memory exploration patterns
    curiosity = clamp(curiosity + memoryInfluence.curiosityBias * rate * 0.05, 0, 1);

    // Time-of-day mood bias: gently pull toward historical stimulation
    if (memoryInfluence.timeOfDayMoodBias?.stimulation !== undefined) {
      stimulation = lerp(
        stimulation,
        memoryInfluence.timeOfDayMoodBias.stimulation,
        rate * 0.02
      );
    }
  }

  return {
    curiosity: clamp(curiosity, 0, 1),
    comfort: clamp(comfort, 0, 1),
    stimulation: clamp(stimulation, 0, 1),
    fatigue: clamp(fatigue, 0, 1),
    overwhelm: clamp(overwhelm, 0, 1),
    trust: clamp(trust, 0, 1),
    boredom: clamp(boredom, 0, 1),
    confidence: clamp(confidence, 0, 1),
  };
}

export interface MoodStimuli {
  motionActivity: number; // 0-1 how much motion is currently detected
  hasNovelTarget: boolean;
  userInteracted: boolean;
  targetScore: number; // best target score, 0-1
  boredomRate: number; // from behavior config
  audioEnergy?: number; // 0-1 audio reactivity energy (v7.0)
}

// Mood-derived modifiers for behavior/rendering
export interface MoodModifiers {
  speedMultiplier: number;
  curiosityMultiplier: number;
  dwellTimeMultiplier: number;
  glowIntensity: number;
  particleMultiplier: number;
  blinkInterval: number; // seconds between blinks
  idleAnimationScale: number;
  wanderRadius: number;
  motionSensitivity: number;
  colorHue: number; // 0-360
  colorSaturation: number; // 0-1
}

export function getMoodModifiers(mood: SurfaceMood): MoodModifiers {
  switch (mood) {
    case "calm":
      return {
        speedMultiplier: 0.6, curiosityMultiplier: 0.5, dwellTimeMultiplier: 1.5,
        glowIntensity: 0.4, particleMultiplier: 0.5, blinkInterval: 4.5,
        idleAnimationScale: 0.7, wanderRadius: 0.4, motionSensitivity: 0.6,
        colorHue: 210, colorSaturation: 0.5,
      };
    case "curious":
      return {
        speedMultiplier: 1.0, curiosityMultiplier: 1.3, dwellTimeMultiplier: 0.8,
        glowIntensity: 0.7, particleMultiplier: 0.8, blinkInterval: 3.0,
        idleAnimationScale: 1.0, wanderRadius: 0.8, motionSensitivity: 1.2,
        colorHue: 270, colorSaturation: 0.65,
      };
    case "playful":
      return {
        speedMultiplier: 1.4, curiosityMultiplier: 1.1, dwellTimeMultiplier: 0.5,
        glowIntensity: 0.8, particleMultiplier: 1.2, blinkInterval: 2.5,
        idleAnimationScale: 1.4, wanderRadius: 1.0, motionSensitivity: 1.0,
        colorHue: 180, colorSaturation: 0.7,
      };
    case "focused":
      return {
        speedMultiplier: 0.8, curiosityMultiplier: 0.7, dwellTimeMultiplier: 2.0,
        glowIntensity: 0.6, particleMultiplier: 0.4, blinkInterval: 5.0,
        idleAnimationScale: 0.5, wanderRadius: 0.2, motionSensitivity: 0.8,
        colorHue: 230, colorSaturation: 0.6,
      };
    case "sleepy":
      return {
        speedMultiplier: 0.3, curiosityMultiplier: 0.2, dwellTimeMultiplier: 3.0,
        glowIntensity: 0.3, particleMultiplier: 0.2, blinkInterval: 2.0,
        idleAnimationScale: 0.4, wanderRadius: 0.1, motionSensitivity: 0.3,
        colorHue: 250, colorSaturation: 0.35,
      };
    case "excited":
      return {
        speedMultiplier: 1.6, curiosityMultiplier: 1.5, dwellTimeMultiplier: 0.4,
        glowIntensity: 1.0, particleMultiplier: 1.5, blinkInterval: 1.8,
        idleAnimationScale: 1.5, wanderRadius: 0.9, motionSensitivity: 1.4,
        colorHue: 190, colorSaturation: 0.8,
      };
    case "overwhelmed":
      return {
        speedMultiplier: 0.4, curiosityMultiplier: 0.1, dwellTimeMultiplier: 0.3,
        glowIntensity: 0.9, particleMultiplier: 0.3, blinkInterval: 1.5,
        idleAnimationScale: 0.6, wanderRadius: 0.1, motionSensitivity: 0.2,
        colorHue: 300, colorSaturation: 0.5,
      };
    case "shy":
      return {
        speedMultiplier: 0.5, curiosityMultiplier: 0.3, dwellTimeMultiplier: 1.0,
        glowIntensity: 0.35, particleMultiplier: 0.3, blinkInterval: 2.5,
        idleAnimationScale: 0.5, wanderRadius: 0.2, motionSensitivity: 0.4,
        colorHue: 330, colorSaturation: 0.4,
      };
    case "content":
      return {
        speedMultiplier: 0.7, curiosityMultiplier: 0.6, dwellTimeMultiplier: 1.3,
        glowIntensity: 0.5, particleMultiplier: 0.6, blinkInterval: 4.0,
        idleAnimationScale: 0.8, wanderRadius: 0.5, motionSensitivity: 0.7,
        colorHue: 140, colorSaturation: 0.55,
      };
    case "anxious":
      return {
        speedMultiplier: 1.2, curiosityMultiplier: 0.8, dwellTimeMultiplier: 0.4,
        glowIntensity: 0.85, particleMultiplier: 0.7, blinkInterval: 1.8,
        idleAnimationScale: 1.1, wanderRadius: 0.3, motionSensitivity: 1.3,
        colorHue: 10, colorSaturation: 0.7,
      };
    case "nostalgic":
      return {
        speedMultiplier: 0.5, curiosityMultiplier: 0.4, dwellTimeMultiplier: 2.2,
        glowIntensity: 0.45, particleMultiplier: 0.4, blinkInterval: 3.5,
        idleAnimationScale: 0.6, wanderRadius: 0.3, motionSensitivity: 0.5,
        colorHue: 45, colorSaturation: 0.45,
      };
    case "determined":
      return {
        speedMultiplier: 1.0, curiosityMultiplier: 0.9, dwellTimeMultiplier: 1.8,
        glowIntensity: 0.75, particleMultiplier: 0.5, blinkInterval: 3.5,
        idleAnimationScale: 0.9, wanderRadius: 0.4, motionSensitivity: 0.9,
        colorHue: 15, colorSaturation: 0.75,
      };
  }
}

// Returns an interpolated color based on mood
export function getMoodColor(mood: SurfaceMood, pulse: number): string {
  const mods = getMoodModifiers(mood);
  const h = mods.colorHue;
  const s = mods.colorSaturation * 100;
  const l = 55 + pulse * 15;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function getMoodGlowColor(mood: SurfaceMood, pulse: number): string {
  const mods = getMoodModifiers(mood);
  const h = mods.colorHue;
  const s = mods.colorSaturation * 100;
  const l = 65 + pulse * 20;
  const a = 0.3 + mods.glowIntensity * 0.4;
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// --- Smooth mood color transition (v7.0) ---

export class MoodColorInterpolator {
  private currentHue: number;
  private currentSat: number;
  private targetHue: number;
  private targetSat: number;
  private transitionSpeed: number;

  constructor(initialMood: SurfaceMood = "calm") {
    const mods = getMoodModifiers(initialMood);
    this.currentHue = mods.colorHue;
    this.currentSat = mods.colorSaturation;
    this.targetHue = mods.colorHue;
    this.targetSat = mods.colorSaturation;
    this.transitionSpeed = 0.5;
  }

  setTarget(mood: SurfaceMood, transitionSpeed: number): void {
    const mods = getMoodModifiers(mood);
    this.targetHue = mods.colorHue;
    this.targetSat = mods.colorSaturation;
    this.transitionSpeed = transitionSpeed;
  }

  update(dt: number): void {
    const lerpSpeed = this.transitionSpeed * 2 * dt;
    // Hue interpolation (shortest path)
    let hueDiff = this.targetHue - this.currentHue;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    this.currentHue = (this.currentHue + hueDiff * Math.min(1, lerpSpeed) + 360) % 360;
    this.currentSat += (this.targetSat - this.currentSat) * Math.min(1, lerpSpeed);
  }

  getColor(pulse: number): string {
    const l = 55 + pulse * 15;
    return `hsl(${this.currentHue}, ${this.currentSat * 100}%, ${l}%)`;
  }

  getGlowColor(pulse: number, glowIntensity: number): string {
    const l = 65 + pulse * 20;
    const a = 0.3 + glowIntensity * 0.4;
    return `hsla(${this.currentHue}, ${this.currentSat * 100}%, ${l}%, ${a})`;
  }
}
