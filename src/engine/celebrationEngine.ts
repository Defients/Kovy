// ============================================================
// Kovy Celebration Engine — triggers celebration events for
// focus milestones, return celebrations, and weekends.
// ============================================================

import type { CelebrationConfig, BehaviorPreset } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface CelebrationEvent {
  type: "focus_milestone" | "return_celebration" | "weekend";
  message: string;
  intensity: number; // 0-1
}

export interface CelebrationOutput {
  enabled: boolean;
  pendingEvent: CelebrationEvent | null;
}

export const NULL_CELEBRATION_OUTPUT: CelebrationOutput = {
  enabled: false,
  pendingEvent: null,
};

const STORAGE_KEY = "kovy-celebration-state";

const PERSONALITY_MESSAGES: Partial<Record<BehaviorPreset, { focus: string; return: string; weekend: string }>> = {
  chill: { focus: "Nice flow session!", return: "Oh hey, welcome back.", weekend: "Weekend vibes~" },
  curious: { focus: "You discovered deep focus!", return: "You're back! What did you see?", weekend: "Weekend! Let's explore!" },
  goblin: { focus: "FOCUS COMPLETE! Goblins proud!", return: "YOU'RE BACK! MISSED YOU!", weekend: "WEEKEND CHAOS TIME!" },
  hyper: { focus: "FOCUS STREAK ACHIEVED!!", return: "BACK BACK BACK! YES!!", weekend: "WEEKEND MODE GO GO GO!" },
  focus: { focus: "Excellent focus discipline.", return: "Welcome back. Ready to continue?", weekend: "Weekend. Time to recharge." },
};

interface PersistedState {
  lastSeen: number; // timestamp of last user interaction
  lastFocusCelebration: number; // focus minutes at last celebration
  lastWeekendCelebration: string; // date string of last weekend celebration
}

export class CelebrationEngine {
  private state: PersistedState;
  private pendingEvent: CelebrationEvent | null = null;

  constructor() {
    this.state = this.load();
  }

  private load(): PersistedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      lastSeen: Date.now(),
      lastFocusCelebration: 0,
      lastWeekendCelebration: "",
    };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* ignore */ }
  }

  recordUserActivity(): void {
    this.state.lastSeen = Date.now();
    this.save();
  }

  update(config: CelebrationConfig, focusMinutes: number, personalityPreset?: BehaviorPreset): CelebrationOutput {
    if (!config.enabled) return NULL_CELEBRATION_OUTPUT;

    this.pendingEvent = null;

    // Focus milestone celebration
    if (focusMinutes > 0 && focusMinutes >= config.focusThreshold) {
      const milestonesPassed = Math.floor(focusMinutes / config.focusThreshold);
      const lastMilestones = Math.floor(this.state.lastFocusCelebration / config.focusThreshold);
      if (milestonesPassed > lastMilestones) {
        this.pendingEvent = {
          type: "focus_milestone",
          message: this.getMessage(personalityPreset, "focus", `${config.focusThreshold} minutes of focus! Great work!`),
          intensity: 0.8,
        };
        this.state.lastFocusCelebration = focusMinutes;
        this.save();
        return { enabled: true, pendingEvent: this.pendingEvent };
      }
    }

    // Return celebration (user was away for threshold hours)
    const awayHours = (Date.now() - this.state.lastSeen) / (1000 * 60 * 60);
    if (awayHours >= config.returnThreshold) {
      this.pendingEvent = {
        type: "return_celebration",
        message: this.getMessage(personalityPreset, "return", "Welcome back! I missed you!"),
        intensity: clamp(awayHours / (config.returnThreshold * 2), 0.3, 1.0),
      };
      this.state.lastSeen = Date.now();
      this.save();
      return { enabled: true, pendingEvent: this.pendingEvent };
    }

    // Weekend celebration
    if (config.weekendCelebration) {
      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      const todayStr = now.toISOString().slice(0, 10);
      if (isWeekend && this.state.lastWeekendCelebration !== todayStr) {
        this.pendingEvent = {
          type: "weekend",
          message: this.getMessage(personalityPreset, "weekend", "It's the weekend! Time to relax!"),
          intensity: 0.5,
        };
        this.state.lastWeekendCelebration = todayStr;
        this.save();
        return { enabled: true, pendingEvent: this.pendingEvent };
      }
    }

    return { enabled: true, pendingEvent: null };
  }

  consumeEvent(): CelebrationEvent | null {
    const evt = this.pendingEvent;
    this.pendingEvent = null;
    return evt;
  }

  private getMessage(preset: BehaviorPreset | undefined, kind: "focus" | "return" | "weekend", fallback: string): string {
    if (!preset) return fallback;
    const msgs = PERSONALITY_MESSAGES[preset];
    return msgs?.[kind] ?? fallback;
  }
}
