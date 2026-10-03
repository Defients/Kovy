// ============================================================
// Kovy Scenario Presets — multi-section config patches
// Each preset adjusts multiple settings at once for a coherent experience
// ============================================================

import type { KovyConfig } from "./types";

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (config: KovyConfig) => Partial<KovyConfig>;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "calm",
    name: "Calm",
    description: "Gentle movement, soft visuals, infrequent sounds. Kovy is a quiet companion.",
    icon: "🌙",
    apply: (c) => ({
      behavior: { ...c.behavior, wanderAmount: 0.2, dwellTime: 12, perchPreference: 0.7, cursorAvoidRadius: 200, returnToPerchTendency: 0.7 },
      appearance: { ...c.appearance, glowIntensity: 0.3, particleAmount: 0.2, emoteIntensity: 0.3 },
      mood: { ...c.mood, moodToColor: true, moodToParticles: false },
      audio: { ...c.audio, kovySounds: true, volume: 0.3, ambientFrequency: 0.1, reactionFrequency: 0.3, moodFrequency: 0.2, globalCooldownMs: 3000 },
      emote: { ...c.emote, intensity: 0.3, maxActive: 3 },
      atmosphere: { ...c.atmosphere, enabled: true, density: 0.2 },
    }),
  },
  {
    id: "extreme",
    name: "Extreme",
    description: "Maximum visuals, frequent sounds, hyper behavior. Kovy goes wild.",
    icon: "⚡",
    apply: (c) => ({
      behavior: { ...c.behavior, wanderAmount: 0.9, dwellTime: 2, perchPreference: 0.05, curiosityStrength: 1.0, attractionStrength: 1.0, boredomRate: 0.9, hyper: { ...c.behavior.hyper, dashStrength: 1.0, chainDelay: 0.2, dashCooldown: 0.3 } },
      appearance: { ...c.appearance, glowIntensity: 1.0, particleAmount: 1.0, emoteIntensity: 1.0, trailLength: 1.0 },
      mood: { ...c.mood, moodToColor: true, moodToParticles: true },
      audio: { ...c.audio, kovySounds: true, volume: 0.8, ambientFrequency: 0.8, reactionFrequency: 1.0, moodFrequency: 0.8, globalCooldownMs: 500 },
      emote: { ...c.emote, enabled: true, intensity: 1.0, maxActive: 12 },
      atmosphere: { ...c.atmosphere, enabled: true, density: 0.8 },
      performance: { ...c.performance, maxRenderFps: 60 },
    }),
  },
  {
    id: "low_pc",
    name: "Low PC Specs",
    description: "Minimal effects, 30 FPS cap, reduced particles. Saves CPU/GPU.",
    icon: "🔋",
    apply: (c) => ({
      appearance: { ...c.appearance, glowIntensity: 0.1, particleAmount: 0.05, trailLength: 0.2, shadowSoftness: 0.2, reducedMotion: true },
      audio: { ...c.audio, kovySounds: false, uiSounds: false },
      emote: { ...c.emote, enabled: false },
      atmosphere: { ...c.atmosphere, enabled: false },
      performance: { ...c.performance, maxRenderFps: 30, preset: "battery" },
      muse: { ...c.muse, enabled: false },
      gaming: { ...c.gaming, enabled: false },
    }),
  },
  {
    id: "focus",
    name: "Focus",
    description: "Reduced motion, muted audio, minimal distractions. Kovy stays out of the way.",
    icon: "🎯",
    apply: (c) => ({
      behavior: { ...c.behavior, wanderAmount: 0.15, dwellTime: 20, perchPreference: 0.8, cursorAvoidRadius: 200, returnToPerchTendency: 0.7 },
      appearance: { ...c.appearance, glowIntensity: 0.2, particleAmount: 0.1, emoteIntensity: 0.2 },
      audio: { ...c.audio, kovySounds: false, volume: 0.2, ambientFrequency: 0.0, reactionFrequency: 0.1, moodFrequency: 0.0 },
      emote: { ...c.emote, intensity: 0.2, maxActive: 2 },
      atmosphere: { ...c.atmosphere, density: 0.1 },
    }),
  },
  {
    id: "cozy",
    name: "Cozy",
    description: "Warm atmosphere, bubble emotes, medium everything. Comfortable desktop companion.",
    icon: "☕",
    apply: (c) => ({
      behavior: { ...c.behavior, wanderAmount: 0.35, dwellTime: 8, perchPreference: 0.5 },
      appearance: { ...c.appearance, glowIntensity: 0.5, particleAmount: 0.4, emoteIntensity: 0.6 },
      mood: { ...c.mood, moodToColor: true, moodToParticles: true },
      audio: { ...c.audio, kovySounds: true, volume: 0.4, ambientFrequency: 0.3, reactionFrequency: 0.5, moodFrequency: 0.4, globalCooldownMs: 2000 },
      emote: { ...c.emote, enabled: true, intensity: 0.6, style: "bubble", maxActive: 6 },
      atmosphere: { ...c.atmosphere, enabled: true, density: 0.5, circadianSync: true, moodSync: true },
    }),
  },
  {
    id: "silent",
    name: "Silent",
    description: "All audio off, reduced emotes. Kovy is seen but not heard.",
    icon: "🔇",
    apply: (c) => ({
      audio: { ...c.audio, kovySounds: false, uiSounds: false, volume: 0 },
      emote: { ...c.emote, intensity: 0.3, maxActive: 3 },
    }),
  },
  {
    id: "playful",
    name: "Playful",
    description: "High energy, frequent sounds, expressive emotes. Kovy wants to play.",
    icon: "🎮",
    apply: (c) => ({
      behavior: { ...c.behavior, wanderAmount: 0.7, dwellTime: 3, perchPreference: 0.2, curiosityStrength: 0.9, boredomRate: 0.7, hyper: { ...c.behavior.hyper, dashStrength: 0.8, chainDelay: 0.3 } },
      appearance: { ...c.appearance, glowIntensity: 0.7, particleAmount: 0.7, emoteIntensity: 0.9, trailLength: 0.8 },
      audio: { ...c.audio, kovySounds: true, volume: 0.6, ambientFrequency: 0.5, reactionFrequency: 0.9, moodFrequency: 0.7, globalCooldownMs: 800 },
      emote: { ...c.emote, enabled: true, intensity: 0.9, maxActive: 10 },
      atmosphere: { ...c.atmosphere, enabled: true, density: 0.5 },
      gaming: { ...c.gaming, enabled: true },
    }),
  },
  {
    id: "showcase",
    name: "Showcase",
    description: "Ultra visuals, all effects on. Best for screenshots and demos.",
    icon: "✨",
    apply: (c) => ({
      appearance: { ...c.appearance, glowIntensity: 1.0, particleAmount: 1.0, emoteIntensity: 1.0, trailLength: 1.0, shadowSoftness: 0.8 },
      mood: { ...c.mood, moodToColor: true, moodToParticles: true },
      emote: { ...c.emote, enabled: true, intensity: 1.0, style: "bubble", maxActive: 12 },
      atmosphere: { ...c.atmosphere, enabled: true, density: 0.9, style: "organic", circadianSync: true, moodSync: true },
      muse: { ...c.muse, enabled: true },
      gaming: { ...c.gaming, enabled: true },
      performance: { ...c.performance, maxRenderFps: 60 },
    }),
  },
];

export function getPresetById(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find(p => p.id === id);
}
