// ============================================================
// Kovy Config Profiles Engine — save, load, and switch between
// configuration profiles. Stored in localStorage.
// ============================================================

import type { ProfilesConfig, SavedProfile, KovyConfig } from "@/store/types";
import { DEFAULT_CONFIG } from "@/store/defaults";

export interface ProfilesOutput {
  savedProfiles: SavedProfile[];
  activeProfileId: string | null;
}

export const NULL_PROFILES_OUTPUT: ProfilesOutput = {
  savedProfiles: [],
  activeProfileId: null,
};

const STORAGE_KEY = "kovy-saved-profiles";

export class ProfilesEngine {
  private profiles: SavedProfile[] = [];
  private activeProfileId: string | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.profiles = data.profiles ?? [];
        this.activeProfileId = data.activeProfileId ?? null;
      }
    } catch { /* ignore */ }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profiles: this.profiles,
        activeProfileId: this.activeProfileId,
      }));
    } catch { /* ignore */ }
  }

  update(config: ProfilesConfig): ProfilesOutput {
    // Sync from config only if config has profiles and engine doesn't
    // This prevents wiping seeded defaults when config is empty
    if (this.profiles.length === 0 && config.savedProfiles.length > 0) {
      this.profiles = config.savedProfiles;
      this.activeProfileId = config.activeProfileId;
      this.save();
    }
    // v8.1: If the engine has profiles but config has autoSwitchRules,
    // sync the activeProfileId from config (rules are managed by configStore,
    // but the activeProfileId may have been updated by the auto-switch runner)
    if (this.profiles.length > 0 && config.activeProfileId && this.activeProfileId !== config.activeProfileId) {
      // Only update if the target profile exists in the engine
      if (this.profiles.some((p) => p.id === config.activeProfileId)) {
        this.activeProfileId = config.activeProfileId;
        this.save();
      }
    }
    return {
      savedProfiles: [...this.profiles],
      activeProfileId: this.activeProfileId,
    };
  }

  saveProfile(name: string, icon: string, config: KovyConfig): SavedProfile {
    const id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const profile: SavedProfile = {
      id,
      name,
      icon,
      timestamp: Date.now(),
      config,
    };
    this.profiles.push(profile);
    this.save();
    return profile;
  }

  deleteProfile(id: string): void {
    this.profiles = this.profiles.filter(p => p.id !== id);
    if (this.activeProfileId === id) {
      this.activeProfileId = null;
    }
    this.save();
  }

  getProfile(id: string): SavedProfile | null {
    return this.profiles.find(p => p.id === id) ?? null;
  }

  setActiveProfile(id: string | null): void {
    this.activeProfileId = id;
    this.save();
  }

  cycleNext(): SavedProfile | null {
    if (this.profiles.length === 0) return null;
    const currentIdx = this.profiles.findIndex(p => p.id === this.activeProfileId);
    const nextIdx = (currentIdx + 1) % this.profiles.length;
    const next = this.profiles[nextIdx];
    this.setActiveProfile(next.id);
    return next;
  }

  seedDefaultProfiles(): void {
    if (this.profiles.length > 0) return;
    const defaults = createDefaultProfiles();
    this.profiles = defaults;
    this.activeProfileId = defaults[0].id;
    this.save();
  }
}

export function createDefaultProfiles(): SavedProfile[] {
  const base = DEFAULT_CONFIG;
  const now = Date.now();
  return [
    {
      id: "profile-default",
      name: "Default",
      icon: "🐾",
      timestamp: now,
      config: { ...base },
    },
    {
      id: "profile-focus",
      name: "Focus",
      icon: "🎯",
      timestamp: now,
      config: {
        ...base,
        behavior: { ...base.behavior, preset: "focus", curiosityStrength: 0.2, attractionStrength: 0.1, boredomRate: 0.05, dwellTime: 30 },
        focus: { ...base.focus, enabled: true, suppressEmotes: true, suppressSound: true },
        thought: { ...base.thought, frequency: 0.3 },
        whisper: { ...base.whisper, frequency: 0.2 },
        appearance: { ...base.appearance, opacity: 0.6 },
      },
    },
    {
      id: "profile-streaming",
      name: "Streaming",
      icon: "📹",
      timestamp: now,
      config: {
        ...base,
        behavior: { ...base.behavior, preset: "chill", curiosityStrength: 0.2, attractionStrength: 0.15 },
        appearance: { ...base.appearance, opacity: 0.5, size: 0.7 },
        thought: { ...base.thought, frequency: 0.5 },
        whisper: { ...base.whisper, frequency: 0.3 },
        emote: { ...base.emote, enabled: false },
        audio: { ...base.audio, kovySounds: false, uiSounds: false },
      },
    },
    {
      id: "profile-gaming",
      name: "Gaming",
      icon: "🎮",
      timestamp: now,
      config: {
        ...base,
        behavior: { ...base.behavior, preset: "hyper", curiosityStrength: 0.8, attractionStrength: 0.9, boredomRate: 0.6 },
        gaming: { ...base.gaming, enabled: true },
        appearance: { ...base.appearance, opacity: 0.8 },
      },
    },
    {
      id: "profile-low-power",
      name: "Low Power",
      icon: "🔋",
      timestamp: now,
      config: {
        ...base,
        behavior: { ...base.behavior, preset: "chill", curiosityStrength: 0.2, boredomRate: 0.1 },
        performance: { ...base.performance, preset: "battery", maxRenderFps: 24, lowPowerIdle: true, frameSkipping: true },
        appearance: { ...base.appearance, particleAmount: 0, glowIntensity: 0, particleBursts: false },
        emote: { ...base.emote, enabled: false },
        atmosphere: { ...base.atmosphere, enabled: false },
      },
    },
    {
      id: "profile-cozy",
      name: "Cozy",
      icon: "🌙",
      timestamp: now,
      config: {
        ...base,
        behavior: { ...base.behavior, preset: "chill", curiosityStrength: 0.3, attractionStrength: 0.2, boredomRate: 0.1, dwellTime: 20 },
        circadian: { ...base.circadian, enabled: true },
        appearance: { ...base.appearance, opacity: 0.75, glowIntensity: 0.8 },
        audio: { ...base.audio, kovySounds: true, volume: 0.3 },
      },
    },
  ];
}
