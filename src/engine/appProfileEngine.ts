// ============================================================
// Per-App Profiles — behavior overrides per foreground app
//
// When Kovy detects a specific app is in the foreground,
// it applies behavior/visual overrides for that app.
// All local-only, no network.
// ============================================================

import type { KovyConfig, BehaviorPreset, VisualPreset } from "@/store/types";

export type AppMatchType = "exe" | "title" | "class";

export interface AppProfile {
  id: string;
  name: string;
  icon: string;
  /** How to match the foreground app */
  matchType: AppMatchType;
  /** Pattern to match (case-insensitive substring) */
  matchPattern: string;
  /** Behavior overrides */
  overrides: AppProfileOverrides;
  enabled: boolean;
}

export interface AppProfileOverrides {
  behaviorPreset?: BehaviorPreset;
  visualPreset?: VisualPreset;
  opacity?: number;
  audioVolume?: number;
  audioEnabled?: boolean;
  moodToColor?: boolean;
  gamingMode?: boolean;
  reducedMotion?: boolean;
  hideKovy?: boolean;
}

export interface AppProfilesState {
  profiles: AppProfile[];
  activeProfileId: string | null;
}

export function createDefaultAppProfilesState(): AppProfilesState {
  return {
    profiles: [],
    activeProfileId: null,
  };
}

// --- Built-in profile templates ---

export const BUILTIN_APP_PROFILES: AppProfile[] = [
  {
    id: "builtin-gaming",
    name: "Gaming",
    icon: "🎮",
    matchType: "exe",
    matchPattern: "game",
    overrides: {
      gamingMode: true,
      behaviorPreset: "goblin",
      visualPreset: "high",
      audioEnabled: true,
      audioVolume: 0.6,
    },
    enabled: true,
  },
  {
    id: "builtin-focus",
    name: "Focus / Work",
    icon: "📋",
    matchType: "exe",
    matchPattern: "code",
    overrides: {
      behaviorPreset: "focus",
      visualPreset: "minimal",
      audioEnabled: false,
      reducedMotion: true,
      opacity: 0.6,
    },
    enabled: true,
  },
  {
    id: "builtin-browser",
    name: "Browser",
    icon: "🌐",
    matchType: "exe",
    matchPattern: "chrome",
    overrides: {
      behaviorPreset: "curious",
      visualPreset: "balanced",
    },
    enabled: true,
  },
  {
    id: "builtin-video",
    name: "Video / Media",
    icon: "🎬",
    matchType: "exe",
    matchPattern: "vlc",
    overrides: {
      hideKovy: true,
    },
    enabled: true,
  },
  {
    id: "builtin-meeting",
    name: "Meeting",
    icon: "📹",
    matchType: "exe",
    matchPattern: "zoom",
    overrides: {
      hideKovy: true,
      audioEnabled: false,
    },
    enabled: true,
  },
];

export class AppProfileEngine {
  private state: AppProfilesState;

  constructor(initialState?: AppProfilesState) {
    this.state = initialState ?? createDefaultAppProfilesState();
  }

  getState(): AppProfilesState {
    return {
      profiles: [...this.state.profiles],
      activeProfileId: this.state.activeProfileId,
    };
  }

  getProfiles(): AppProfile[] {
    return [...this.state.profiles];
  }

  addProfile(profile: AppProfile): void {
    this.state.profiles.push(profile);
  }

  removeProfile(id: string): boolean {
    const idx = this.state.profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.state.profiles.splice(idx, 1);
    if (this.state.activeProfileId === id) {
      this.state.activeProfileId = null;
    }
    return true;
  }

  updateProfile(id: string, updates: Partial<AppProfile>): boolean {
    const profile = this.state.profiles.find(p => p.id === id);
    if (!profile) return false;
    Object.assign(profile, updates);
    return true;
  }

  /** Match a foreground app against profiles and return the first match */
  matchApp(appIdentifier: string): AppProfile | null {
    const enabled = this.state.profiles.filter(p => p.enabled);
    for (const profile of enabled) {
      const pattern = profile.matchPattern.toLowerCase();
      const identifier = appIdentifier.toLowerCase();
      if (identifier.includes(pattern)) {
        return profile;
      }
    }
    return null;
  }

  /** Set the active profile based on foreground app detection */
  setActiveApp(appIdentifier: string): AppProfile | null {
    const match = this.matchApp(appIdentifier);
    this.state.activeProfileId = match?.id ?? null;
    return match;
  }

  /** Get the active profile */
  getActiveProfile(): AppProfile | null {
    if (!this.state.activeProfileId) return null;
    return this.state.profiles.find(p => p.id === this.state.activeProfileId) ?? null;
  }

  /** Get overrides to apply to config */
  getActiveOverrides(): AppProfileOverrides | null {
    const profile = this.getActiveProfile();
    return profile?.overrides ?? null;
  }

  /** Apply overrides to a config object */
  applyOverrides(config: KovyConfig): KovyConfig {
    const overrides = this.getActiveOverrides();
    if (!overrides) return config;

    const result = { ...config };

    if (overrides.opacity !== undefined) {
      result.appearance = { ...result.appearance, opacity: overrides.opacity };
    }
    if (overrides.audioEnabled !== undefined || overrides.audioVolume !== undefined) {
      result.audio = {
        ...result.audio,
        ...(overrides.audioEnabled !== undefined && { enabled: overrides.audioEnabled }),
        ...(overrides.audioVolume !== undefined && { volume: overrides.audioVolume }),
      };
    }
    if (overrides.moodToColor !== undefined) {
      result.mood = { ...result.mood, moodToColor: overrides.moodToColor };
    }
    if (overrides.reducedMotion !== undefined) {
      result.appearance = { ...result.appearance, reducedMotion: overrides.reducedMotion };
    }
    if (overrides.visualPreset !== undefined) {
      result.appearance = { ...result.appearance, visualPreset: overrides.visualPreset };
    }

    return result;
  }

  reset(): void {
    this.state = createDefaultAppProfilesState();
  }
}
