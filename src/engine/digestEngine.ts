// ============================================================
// Kovy Digest Engine — Companion Digest (v8.2)
//
// Aggregates a snapshot of the user's companion relationship into
// a single structured "Digest" object: bond level & progress, key
// stats, dominant mood, growth stage, milestone count, and a
// recent journal highlight. The digest is rendered as an on-demand
// overlay card (see digestToast.ts) and is fully local / privacy-first.
//
// The core `buildDigest()` function is pure and side-effect-free so
// it can be unit-tested without spinning up the full engine container.
// ============================================================

import type {
  SurfaceMood,
  BondLevel,
  GrowthStage,
  DigestConfig,
} from "@/store/types";
import type { BondState } from "@/store/types";
import type { StatsData } from "./statsEngine";
import type { GrowthOutput } from "./growthEngine";
import type { JournalEntry } from "./journalEngine";
import { getBondProgress, getBondLevel } from "./bondEngine";

// --- Digest output shape ---

export interface DigestBond {
  level: BondLevel;
  points: number;
  /** 0-1 progress toward the next bond level (1 if maxed). */
  progress: number;
  daysTogether: number;
  streakDays: number;
}

export interface DigestStats {
  focusMinutes: number;
  gamingSessions: number;
  emotes: number;
  thoughts: number;
  whispers: number;
  daysActive: number;
  longestFocusMinutes: number;
}

export interface DigestGrowth {
  stage: GrowthStage;
  ageDays: number;
  progressToNext: number;
}

export interface DigestHighlight {
  title: string;
  body: string;
  type: string;
  timestamp: number;
}

export interface Digest {
  generatedAt: number;
  bond: DigestBond | null;
  stats: DigestStats | null;
  mood: SurfaceMood | null;
  growth: DigestGrowth | null;
  milestoneCount: number;
  activeHours: number;
  highlight: DigestHighlight | null;
}

export const NULL_DIGEST: Digest = {
  generatedAt: 0,
  bond: null,
  stats: null,
  mood: null,
  growth: null,
  milestoneCount: 0,
  activeHours: 0,
  highlight: null,
};

// --- Pure inputs for buildDigest ---

export interface DigestInputs {
  config: DigestConfig;
  bondState: BondState | null;
  stats: StatsData | null;
  surfaceMood: SurfaceMood;
  growth: GrowthOutput | null;
  milestoneCount: number;
  activeSeconds: number;
  /** Recent journal entries, newest last. Used to pick a highlight. */
  recentEntries: JournalEntry[];
}

/**
 * Build a Digest from aggregated engine outputs. Pure: no side effects,
 * no randomness, no I/O. Sections are nulled out when their config flag
 * is disabled so the renderer can skip them cleanly.
 */
export function buildDigest(inputs: DigestInputs): Digest {
  const { config, bondState, stats, surfaceMood, growth, milestoneCount, activeSeconds, recentEntries } = inputs;

  const bond: DigestBond | null = config.showBond && bondState
    ? {
      // Re-derive level from points so the digest is always consistent even
      // if the stored bondLevel is stale relative to bondPoints.
      level: getBondLevel(bondState.bondPoints),
      points: bondState.bondPoints,
      progress: getBondProgress(bondState.bondPoints).progress,
      daysTogether: bondState.daysTogether,
      streakDays: bondState.streakDays,
    }
    : null;

  const digestStats: DigestStats | null = config.showStats && stats
    ? {
      focusMinutes: stats.totalFocusMinutes,
      gamingSessions: stats.totalGamingSessions,
      emotes: stats.totalEmotes,
      thoughts: stats.totalThoughts,
      whispers: stats.totalWhispers,
      daysActive: stats.daysActive,
      longestFocusMinutes: stats.longestFocusSession,
    }
    : null;

  const mood: SurfaceMood | null = config.showMood ? surfaceMood : null;

  const digestGrowth: DigestGrowth | null = config.showGrowth && growth && growth.enabled
    ? {
      stage: growth.stage,
      ageDays: growth.ageDays,
      progressToNext: growth.progressToNext,
    }
    : null;

  // Pick a highlight: prefer non-summary, non-whisper entries from the last day.
  // Deterministic selection — the most recent qualifying entry.
  let highlight: DigestHighlight | null = null;
  if (config.showHighlight && recentEntries.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const candidate = [...recentEntries]
      .reverse()
      .find(e => e.dateStr === today && e.type !== "daily_summary" && e.type !== "whisper");
    const chosen = candidate ?? [...recentEntries].reverse().find(e => e.type !== "daily_summary") ?? null;
    if (chosen) {
      highlight = {
        title: chosen.title,
        body: chosen.body,
        type: chosen.type,
        timestamp: chosen.timestamp,
      };
    }
  }

  return {
    generatedAt: Date.now(),
    bond,
    stats: digestStats,
    mood,
    growth: digestGrowth,
    milestoneCount,
    activeHours: Math.round((activeSeconds / 3600) * 10) / 10,
    highlight,
  };
}

/**
 * Compose a short, human-readable one-liner summarizing the digest.
 * Used for tray tooltips / accessibility descriptions.
 */
export function summarizeDigest(digest: Digest): string {
  const parts: string[] = [];
  if (digest.bond) {
    parts.push(`${digest.bond.level.replace("_", " ")} bond`);
  }
  if (digest.mood) {
    parts.push(`feeling ${digest.mood}`);
  }
  if (digest.growth) {
    parts.push(`${digest.growth.stage} stage`);
  }
  if (digest.stats) {
    parts.push(`${digest.stats.focusMinutes}m focused`);
  }
  if (digest.milestoneCount > 0) {
    parts.push(`${digest.milestoneCount} milestones`);
  }
  return parts.length > 0 ? `Kovy — ${parts.join(", ")}.` : "Kovy — your companion.";
}
