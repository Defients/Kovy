// ============================================================
// Lite Presets — curated bundles for Lite Mode
//
// A mix of new Lite-exclusive presets and existing scenario
// presets reframed with friendly names for the simplified UI.
// ============================================================

import type { KovyConfig } from "./types";
import { SCENARIO_PRESETS } from "./scenarioPresets";

export interface LitePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "new" | "existing";
  apply: (config: KovyConfig) => Partial<KovyConfig>;
}

export const LITE_PRESETS: LitePreset[] = [
  {
    id: "companion",
    name: "Companion",
    description: "A friendly buddy that keeps you company. Balanced movement, gentle emotes, soft sounds.",
    icon: "🤝",
    category: "new",
    apply: (c) => ({
      behavior: { ...c.behavior, preset: "curious", wanderAmount: 0.4, dwellTime: 8, perchPreference: 0.5, curiosityStrength: 0.6, boredomRate: 0.3 },
      appearance: { ...c.appearance, glowIntensity: 0.5, particleAmount: 0.4, emoteIntensity: 0.6, visualPreset: "balanced" },
      audio: { ...c.audio, kovySounds: true, volume: 0.4, ambientFrequency: 0.3, reactionFrequency: 0.5, moodFrequency: 0.3, globalCooldownMs: 2000 },
      emote: { ...c.emote, enabled: true, intensity: 0.6, maxActive: 5 },
      mood: { ...c.mood, enabled: true, moodToColor: true, moodToParticles: false, randomDrift: 0.2 },
      bond: { ...c.bond, enabled: true },
    }),
  },
  {
    id: "work_buddy",
    name: "Work Buddy",
    description: "Stays calm and out of the way while you work. Minimal movement, quiet, supportive.",
    icon: "💼",
    category: "new",
    apply: (c) => ({
      behavior: { ...c.behavior, preset: "focus", wanderAmount: 0.15, dwellTime: 20, perchPreference: 0.8, curiosityStrength: 0.3, boredomRate: 0.1, cursorAvoidRadius: 200 },
      appearance: { ...c.appearance, glowIntensity: 0.3, particleAmount: 0.15, emoteIntensity: 0.3, visualPreset: "minimal", particleBursts: false },
      audio: { ...c.audio, kovySounds: true, volume: 0.2, ambientFrequency: 0.1, reactionFrequency: 0.2, moodFrequency: 0.1, globalCooldownMs: 4000 },
      emote: { ...c.emote, enabled: true, intensity: 0.3, maxActive: 3 },
      mood: { ...c.mood, enabled: true, moodToColor: true, moodToParticles: false, randomDrift: 0.1 },
      focus: { ...c.focus, enabled: true, suppressEmotes: true, suppressSound: true },
    }),
  },
  {
    id: "sleepy_pet",
    name: "Sleepy Pet",
    description: "A drowsy, relaxed companion. Mostly naps, gentle drift, very peaceful.",
    icon: "😴",
    category: "new",
    apply: (c) => ({
      behavior: { ...c.behavior, preset: "chill", wanderAmount: 0.1, dwellTime: 25, perchPreference: 0.9, curiosityStrength: 0.2, boredomRate: 0.05, cursorAvoidRadius: 150 },
      appearance: { ...c.appearance, glowIntensity: 0.25, particleAmount: 0.1, emoteIntensity: 0.2, visualPreset: "minimal", auroraBackground: false },
      audio: { ...c.audio, kovySounds: true, volume: 0.15, ambientFrequency: 0.05, reactionFrequency: 0.1, moodFrequency: 0.05, globalCooldownMs: 5000 },
      emote: { ...c.emote, enabled: true, intensity: 0.2, maxActive: 2 },
      mood: { ...c.mood, enabled: true, moodToColor: true, moodToParticles: false, randomDrift: 0.05, energyBaseline: 0.2, sleepinessBaseline: 0.7 },
    }),
  },
  {
    id: "party_mode",
    name: "Party Mode",
    description: "Fun and energetic! Lots of emotes, bouncy movement, colorful effects.",
    icon: "🎉",
    category: "new",
    apply: (c) => ({
      behavior: { ...c.behavior, preset: "curious", wanderAmount: 0.7, dwellTime: 4, perchPreference: 0.2, curiosityStrength: 0.85, boredomRate: 0.6 },
      appearance: { ...c.appearance, glowIntensity: 0.8, particleAmount: 0.7, emoteIntensity: 0.9, visualPreset: "high", particleBursts: true, auroraBackground: true },
      audio: { ...c.audio, kovySounds: true, volume: 0.6, ambientFrequency: 0.5, reactionFrequency: 0.8, moodFrequency: 0.6, globalCooldownMs: 800 },
      emote: { ...c.emote, enabled: true, intensity: 0.9, maxActive: 8 },
      mood: { ...c.mood, enabled: true, moodToColor: true, moodToParticles: true, randomDrift: 0.4, playfulnessBias: 0.5 },
    }),
  },
  {
    id: "calm",
    name: "Calm",
    description: "Gentle movement, soft visuals, infrequent sounds. A quiet, peaceful companion.",
    icon: "🌙",
    category: "existing",
    apply: (c) => {
      const preset = SCENARIO_PRESETS.find(p => p.id === "calm")!;
      return preset.apply(c);
    },
  },
  {
    id: "cozy",
    name: "Cozy",
    description: "Warm atmosphere, bubble emotes, medium everything. Comfortable desktop companion.",
    icon: "🕯️",
    category: "existing",
    apply: (c) => {
      const preset = SCENARIO_PRESETS.find(p => p.id === "cozy")!;
      return preset.apply(c);
    },
  },
  {
    id: "focus",
    name: "Focus",
    description: "Reduced motion, muted audio, minimal distractions. Kovy stays out of the way.",
    icon: "🎯",
    category: "existing",
    apply: (c) => {
      const preset = SCENARIO_PRESETS.find(p => p.id === "focus")!;
      return preset.apply(c);
    },
  },
  {
    id: "playful",
    name: "Playful",
    description: "High energy, frequent sounds, expressive emotes. Kovy wants to play!",
    icon: "🎈",
    category: "existing",
    apply: (c) => {
      const preset = SCENARIO_PRESETS.find(p => p.id === "playful")!;
      return preset.apply(c);
    },
  },
];

export function getLitePresetById(id: string): LitePreset | undefined {
  return LITE_PRESETS.find(p => p.id === id);
}
