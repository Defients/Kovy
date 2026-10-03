// ============================================================
// Preset Wizard — guided configuration wizard
//
// Asks the user a series of questions and generates a
// personalized config preset. More intuitive than raw
// settings tabs for new users.
// ============================================================

import type { KovyConfig, BehaviorPreset, VisualPreset, PerformancePreset } from "@/store/types";
import { SCENARIO_PRESETS } from "@/store/scenarioPresets";

export type WizardQuestionId =
  | "personality"
  | "activity_level"
  | "visual_style"
  | "performance"
  | "sound"
  | "privacy"
  | "scenario";

export interface WizardChoice {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface WizardQuestion {
  id: WizardQuestionId;
  title: string;
  subtitle: string;
  choices: WizardChoice[];
}

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: "personality",
    title: "What personality fits you best?",
    subtitle: "This determines Kovy's base behavior and energy",
    choices: [
      { id: "chill", label: "Chill", description: "Calm, relaxed, occasional movement", icon: "😌" },
      { id: "curious", label: "Curious", description: "Explores, inspects, follows motion", icon: "🔍" },
      { id: "goblin", label: "Goblin", description: "Chaotic, unpredictable, hyper bursts", icon: "👹" },
      { id: "focus", label: "Focus", description: "Minimal movement, stays put", icon: "🎯" },
    ],
  },
  {
    id: "activity_level",
    title: "How active should Kovy be?",
    subtitle: "Higher activity means more movement and reactions",
    choices: [
      { id: "low", label: "Low", description: "Mostly idle, occasional wander", icon: "🌙" },
      { id: "medium", label: "Medium", description: "Regular movement and interactions", icon: "🌤️" },
      { id: "high", label: "High", description: "Frequent activity, lots of energy", icon: "⚡" },
    ],
  },
  {
    id: "visual_style",
    title: "What visual style do you prefer?",
    subtitle: "Affects particle effects, glow, and rendering quality",
    choices: [
      { id: "minimal", label: "Minimal", description: "Clean, subtle, few particles", icon: "⚪" },
      { id: "balanced", label: "Balanced", description: "Moderate effects and glow", icon: "🎨" },
      { id: "vibrant", label: "Vibrant", description: "Rich particles, strong glow, full effects", icon: "✨" },
    ],
  },
  {
    id: "performance",
    title: "What's your performance preference?",
    subtitle: "Lower impact uses less CPU and GPU",
    choices: [
      { id: "eco", label: "Eco", description: "Minimal resource usage, capped FPS", icon: "🌱" },
      { id: "balanced", label: "Balanced", description: "Good visuals with reasonable resource use", icon: "⚖️" },
      { id: "performance", label: "Performance", description: "Maximize smoothness, uncapped", icon: "🚀" },
    ],
  },
  {
    id: "sound",
    title: "Should Kovy make sounds?",
    subtitle: "Synthesized audio cues for behaviors and moods",
    choices: [
      { id: "silent", label: "Silent", description: "No audio at all", icon: "🔇" },
      { id: "subtle", label: "Subtle", description: "Quiet sounds only for key events", icon: "🔈" },
      { id: "full", label: "Full", description: "Audio for all behaviors and moods", icon: "🔊" },
    ],
  },
  {
    id: "privacy",
    title: "Privacy settings",
    subtitle: "All processing is local. Choose what to enable.",
    choices: [
      { id: "strict", label: "Strict", description: "No screen capture, no diagnostics", icon: "🔒" },
      { id: "balanced", label: "Balanced", description: "Screen motion detection, no diagnostics", icon: "🔐" },
      { id: "open", label: "Open", description: "Full features including opt-in diagnostics", icon: "🔓" },
    ],
  },
  {
    id: "scenario",
    title: "Any specific scenario?",
    subtitle: "Pre-configured bundles that override the above for a specific use case",
    choices: [
      { id: "none", label: "None", description: "Use my selections above", icon: "✦" },
      { id: "calm", label: "Calm", description: "Peaceful, minimal companion", icon: "🌿" },
      { id: "cozy", label: "Cozy", description: "Warm, comforting evening vibe", icon: "🕯️" },
      { id: "playful", label: "Playful", description: "Fun, energetic, interactive", icon: "🎈" },
      { id: "focus", label: "Focus", description: "Work companion that stays out of the way", icon: "📋" },
      { id: "showcase", label: "Showcase", description: "All features on, maximum visual impact", icon: "🏆" },
    ],
  },
];

export type WizardAnswers = Partial<Record<WizardQuestionId, string>>;

export interface WizardResult {
  behaviorPreset: BehaviorPreset;
  visualPreset: VisualPreset;
  performancePreset: PerformancePreset;
  audioEnabled: boolean;
  audioVolume: number;
  motionDetection: boolean;
  diagnosticsEnabled: boolean;
  scenarioPresetId: string | null;
  configOverrides: Partial<KovyConfig>;
}

export function processWizardAnswers(answers: WizardAnswers): WizardResult {
  // Default values
  let behaviorPreset: BehaviorPreset = "curious";
  let visualPreset: VisualPreset = "balanced";
  let performancePreset: PerformancePreset = "balanced";
  let audioEnabled = true;
  let audioVolume = 0.5;
  let motionDetection = true;
  let diagnosticsEnabled = false;
  let scenarioPresetId: string | null = null;

  // Personality → behavior preset
  const personality = answers.personality;
  if (personality === "chill") behaviorPreset = "chill";
  else if (personality === "curious") behaviorPreset = "curious";
  else if (personality === "goblin") behaviorPreset = "goblin";
  else if (personality === "focus") behaviorPreset = "focus";

  // Activity level → behavior config overrides
  const activity = answers.activity_level;
  const configOverrides: Partial<KovyConfig> = {};
  const behaviorOverrides: Partial<KovyConfig["behavior"]> = {};
  if (activity === "low") {
    behaviorOverrides.dwellTime = 8;
    behaviorOverrides.boredomRate = 0.3;
    behaviorOverrides.attractionStrength = 0.5;
  } else if (activity === "high") {
    behaviorOverrides.dwellTime = 2;
    behaviorOverrides.boredomRate = 1.5;
    behaviorOverrides.attractionStrength = 1.2;
  }
  if (Object.keys(behaviorOverrides).length > 0) {
    configOverrides.behavior = { ...({} as KovyConfig["behavior"]), ...behaviorOverrides };
  }

  // Visual style → visual preset
  const visual = answers.visual_style;
  if (visual === "minimal") visualPreset = "minimal";
  else if (visual === "balanced") visualPreset = "balanced";
  else if (visual === "vibrant") visualPreset = "high";

  // Performance → performance preset
  const perf = answers.performance;
  if (perf === "eco") performancePreset = "battery";
  else if (perf === "balanced") performancePreset = "balanced";
  else if (perf === "performance") performancePreset = "quality";

  // Sound
  const sound = answers.sound;
  if (sound === "silent") { audioEnabled = false; audioVolume = 0; }
  else if (sound === "subtle") { audioEnabled = true; audioVolume = 0.3; }
  else if (sound === "full") { audioEnabled = true; audioVolume = 0.7; }

  // Privacy
  const privacy = answers.privacy;
  if (privacy === "strict") { motionDetection = false; diagnosticsEnabled = false; }
  else if (privacy === "balanced") { motionDetection = true; diagnosticsEnabled = false; }
  else if (privacy === "open") { motionDetection = true; diagnosticsEnabled = true; }

  // Scenario override
  const scenario = answers.scenario;
  if (scenario && scenario !== "none") {
    const preset = SCENARIO_PRESETS.find(p => p.id === scenario);
    if (preset) {
      scenarioPresetId = scenario;
      // Apply scenario overrides on top
      const overrides = preset.apply({} as KovyConfig);
      Object.assign(configOverrides, overrides);
    }
  }

  return {
    behaviorPreset,
    visualPreset,
    performancePreset,
    audioEnabled,
    audioVolume,
    motionDetection,
    diagnosticsEnabled,
    scenarioPresetId,
    configOverrides,
  };
}

export function getWizardStepCount(): number {
  return WIZARD_QUESTIONS.length;
}
