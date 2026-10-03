// ============================================================
// Kovy Focus Engine — detects user focus states based on
// motion analysis, app detection, and idle patterns.
// Triggers focus behavior changes and suppresses distractions.
// ============================================================

import type { FocusConfig, FocusState, SurfaceMood, BehaviorState } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface FocusOutput {
  enabled: boolean;
  state: FocusState;
  focusMinutes: number; // accumulated focus time in current session
  suppressEmotes: boolean;
  suppressSound: boolean;
  suggestedBehavior: BehaviorState | null;
  suggestedMood: SurfaceMood | null;
}

export const NULL_FOCUS_OUTPUT: FocusOutput = {
  enabled: false,
  state: "unfocused",
  focusMinutes: 0,
  suppressEmotes: false,
  suppressSound: false,
  suggestedBehavior: null,
  suggestedMood: null,
};

const FOCUS_MOOD_MAP: Record<FocusState, SurfaceMood> = {
  unfocused: "calm",
  light_focus: "focused",
  deep_focus: "determined",
};

export class FocusEngine {
  private focusAccum = 0;
  private decayAccum = 0;
  private currentState: FocusState = "unfocused";
  private sessionMinutes = 0;
  private lastUpdate = 0;

  update(dt: number, config: FocusConfig, motionLevel: number, appStable: boolean): FocusOutput {
    if (!config.enabled) return NULL_FOCUS_OUTPUT;

    // Focus increases when motion is low and app is stable (same app for a while)
    const focusGain = (1 - clamp(motionLevel, 0, 1)) * config.detectionSensitivity * (appStable ? 1.0 : 0.3);
    const focusDecay = motionLevel * config.detectionSensitivity * 0.5;

    this.focusAccum = clamp(this.focusAccum + focusGain * dt, 0, 1);
    this.decayAccum = clamp(this.decayAccum + focusDecay * dt, 0, 1);

    // Determine focus state
    const netFocus = this.focusAccum - this.decayAccum;
    let newState: FocusState = "unfocused";
    if (netFocus > 0.6) newState = "deep_focus";
    else if (netFocus > 0.3) newState = "light_focus";

    // Track session time
    if (newState !== "unfocused") {
      this.sessionMinutes += dt / 60;
    } else {
      this.sessionMinutes = 0;
    }

    this.currentState = newState;

    return {
      enabled: true,
      state: newState,
      focusMinutes: this.sessionMinutes,
      suppressEmotes: newState !== "unfocused" && config.suppressEmotes,
      suppressSound: newState !== "unfocused" && config.suppressSound,
      suggestedBehavior: newState !== "unfocused" ? config.focusBehavior : null,
      suggestedMood: FOCUS_MOOD_MAP[newState],
    };
  }

  get state(): FocusState { return this.currentState; }
  get currentSessionMinutes(): number { return this.sessionMinutes; }
}
