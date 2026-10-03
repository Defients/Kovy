// ============================================================
// Kovy Ritual Engine — daily/periodic ritual tracking
//
// Tracks recurring time-based rituals like morning greeting,
// lunch companion, evening wind-down, etc.
// All data local-only, persisted via storage adapter.
// ============================================================

import type { BehaviorState, SurfaceMood } from "@/store/types";

export type RitualId =
  | "morning_greeting"
  | "lunch_companion"
  | "afternoon_stretch"
  | "evening_winddown"
  | "midnight_dream"
  | "return_celebration"
  | "weekend_special";

export interface RitualDef {
  id: RitualId;
  title: string;
  description: string;
  icon: string;
  /** Hour window start (0-23), ritual active during [startHour, endHour) */
  startHour: number;
  endHour: number;
  /** Days of week (0=Sunday..6=Saturday), empty = all days */
  daysOfWeek?: number[];
  /** Minimum bond level required (0=none, 1=acquaintance, 2=companion, 3=friend, 4=best_friend) */
  minBondLevel?: number;
}

export interface RitualRecord {
  ritualId: RitualId;
  performedAt: number; // unix ms
  mood: SurfaceMood;
  behaviorTriggered: BehaviorState;
}

export interface RitualState {
  records: RitualRecord[];
  streaks: Record<string, number>; // ritualId → consecutive days
  lastPerformedDay: Record<string, string>; // ritualId → "YYYY-MM-DD"
  totalPerformed: Record<string, number>; // ritualId → count
}

export const RITUAL_DEFS: RitualDef[] = [
  {
    id: "morning_greeting",
    title: "Morning Greeting",
    description: "Kovy greets you at the start of your day",
    icon: "🌅",
    startHour: 6,
    endHour: 11,
  },
  {
    id: "lunch_companion",
    title: "Lunch Companion",
    description: "Kovy keeps you company during lunch",
    icon: "🍽️",
    startHour: 11,
    endHour: 14,
  },
  {
    id: "afternoon_stretch",
    title: "Afternoon Stretch",
    description: "Kovy stretches to remind you to take a break",
    icon: "🤸",
    startHour: 14,
    endHour: 17,
  },
  {
    id: "evening_winddown",
    title: "Evening Wind-down",
    description: "Kovy settles in for a calm evening",
    icon: "🌙",
    startHour: 18,
    endHour: 23,
  },
  {
    id: "midnight_dream",
    title: "Midnight Dream",
    description: "Kovy dreams peacefully in the late night",
    icon: "✦",
    startHour: 0,
    endHour: 6,
  },
  {
    id: "return_celebration",
    title: "Return Celebration",
    description: "Kovy celebrates your return after absence",
    icon: "🎉",
    startHour: 0,
    endHour: 24,
  },
  {
    id: "weekend_special",
    title: "Weekend Special",
    description: "Kovy has extra playful energy on weekends",
    icon: "🎊",
    startHour: 9,
    endHour: 18,
    daysOfWeek: [0, 6],
  },
];

const RITUAL_IDS = new Set(RITUAL_DEFS.map(r => r.id));
const MAX_RECORDS = 500;

export function createDefaultRitualState(): RitualState {
  return {
    records: [],
    streaks: {},
    lastPerformedDay: {},
    totalPerformed: {},
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(dayStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dayStr === yesterday.toISOString().slice(0, 10);
}

export class RitualEngine {
  private state: RitualState;
  private pendingRituals: RitualDef[] = [];

  constructor(initialState?: RitualState) {
    this.state = initialState ?? createDefaultRitualState();
  }

  getState(): RitualState {
    return {
      ...this.state,
      records: [...this.state.records],
      streaks: { ...this.state.streaks },
      lastPerformedDay: { ...this.state.lastPerformedDay },
      totalPerformed: { ...this.state.totalPerformed },
    };
  }

  /** Check which rituals are currently active based on time and day */
  getActiveRituals(date: Date = new Date()): RitualDef[] {
    const hour = date.getHours();
    const dow = date.getDay();

    return RITUAL_DEFS.filter(def => {
      if (hour < def.startHour || hour >= def.endHour) return false;
      if (def.daysOfWeek && def.daysOfWeek.length > 0) {
        if (!def.daysOfWeek.includes(dow)) return false;
      }
      return true;
    });
  }

  /** Check if a ritual has already been performed today */
  wasPerformedToday(ritualId: RitualId): boolean {
    return this.state.lastPerformedDay[ritualId] === todayStr();
  }

  /** Get rituals that are active but not yet performed today */
  getPendingRituals(date: Date = new Date()): RitualDef[] {
    return this.getActiveRituals(date).filter(
      r => !this.wasPerformedToday(r.id)
    );
  }

  /** Record a ritual performance */
  performRitual(
    ritualId: RitualId,
    mood: SurfaceMood,
    behaviorTriggered: BehaviorState,
  ): boolean {
    if (!RITUAL_IDS.has(ritualId)) return false;
    if (this.wasPerformedToday(ritualId)) return false;

    const now = Date.now();
    const today = todayStr();

    // Record
    this.state.records.push({
      ritualId,
      performedAt: now,
      mood,
      behaviorTriggered,
    });

    // Trim records
    if (this.state.records.length > MAX_RECORDS) {
      this.state.records = this.state.records.slice(-MAX_RECORDS);
    }

    // Update streak
    const lastDay = this.state.lastPerformedDay[ritualId];
    if (lastDay && isYesterday(lastDay)) {
      this.state.streaks[ritualId] = (this.state.streaks[ritualId] ?? 0) + 1;
    } else if (lastDay === today) {
      // Already performed today — shouldn't reach here, but keep streak
    } else {
      this.state.streaks[ritualId] = 1;
    }

    this.state.lastPerformedDay[ritualId] = today;
    this.state.totalPerformed[ritualId] = (this.state.totalPerformed[ritualId] ?? 0) + 1;

    return true;
  }

  /** Get streak for a ritual */
  getStreak(ritualId: RitualId): number {
    return this.state.streaks[ritualId] ?? 0;
  }

  /** Get total times a ritual was performed */
  getTotalPerformed(ritualId: RitualId): number {
    return this.state.totalPerformed[ritualId] ?? 0;
  }

  /** Get recent ritual records */
  getRecentRecords(count: number = 10): RitualRecord[] {
    return this.state.records.slice(-count);
  }

  /** Get ritual history summary for soul export */
  getHistorySummary(): Array<{ ritual: string; count: number; lastPerformed: string }> {
    return RITUAL_DEFS.map(def => {
      const count = this.state.totalPerformed[def.id] ?? 0;
      const lastDay = this.state.lastPerformedDay[def.id];
      return {
        ritual: def.id,
        count,
        lastPerformed: lastDay ?? "",
      };
    }).filter(r => r.count > 0);
  }

  /** Consume pending rituals (for triggering behaviors) */
  consumePendingRituals(): RitualDef[] {
    const result = this.pendingRituals;
    this.pendingRituals = [];
    return result;
  }

  /** Update — checks for newly available rituals */
  update(dt: number, date: Date = new Date()): RitualDef[] {
    const pending = this.getPendingRituals(date);
    const newlyAvailable = pending.filter(
      r => !this.pendingRituals.some(p => p.id === r.id)
    );
    this.pendingRituals = pending;
    return newlyAvailable;
  }

  reset(): void {
    this.state = createDefaultRitualState();
    this.pendingRituals = [];
  }
}
