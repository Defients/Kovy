// ============================================================
// Kovy Chronicle Engine — Longitudinal Companion Trends (v8.3)
//
// The Chronicle is the temporal companion to the Digest. Where the
// Digest summarizes the companion relationship *right now*, the
// Chronicle persists one lightweight snapshot per day and derives
// week-over-week trends, streaks, and human-readable insights from
// the accumulated history.
//
// All public functions are pure and side-effect-free so they can be
// unit-tested without spinning up storage or the render loop. The
// only impure surface is `chronicleStorage.ts` (localStorage I/O)
// and `chronicleRunner.ts` (the polling scheduler).
//
// Privacy: snapshots are stored locally in localStorage only. Each
// snapshot is ~12 numbers + 2 short strings — roughly 150 bytes/day,
// ~54 KB for a full year. No data ever leaves the device.
// ============================================================

import type {
  SurfaceMood,
  BondLevel,
  GrowthStage,
} from "@/store/types";
import type { BondState } from "@/store/types";
import type { StatsData } from "./statsEngine";
import type { GrowthOutput } from "./growthEngine";
import type { JournalEntry } from "./journalEngine";
import type { DigestHighlight } from "./digestEngine";
import { getBondLevel } from "./bondEngine";

// --- Snapshot: one persisted per day ---

export interface ChronicleSnapshot {
  /** Local date string YYYY-MM-DD. Acts as the unique key for the day. */
  dateStr: string;
  /** Epoch ms when the snapshot was persisted. */
  timestamp: number;
  bondPoints: number;
  bondLevel: BondLevel;
  surfaceMood: SurfaceMood;
  growthStage: GrowthStage | null;
  /** Cumulative totals at snapshot time — trends derive deltas from these. */
  focusMinutes: number;
  gamingSessions: number;
  emotes: number;
  thoughts: number;
  whispers: number;
  milestoneCount: number;
  activeSeconds: number;
  /** One-line title of the day's highlight, or null if none. */
  highlightTitle: string | null;
}

// --- Inputs for building a snapshot ---

export interface ChronicleSnapshotInputs {
  bondState: BondState | null;
  stats: StatsData | null;
  surfaceMood: SurfaceMood;
  growth: GrowthOutput | null;
  milestoneCount: number;
  activeSeconds: number;
  /** Most recent qualifying journal highlight, or null. */
  highlight: DigestHighlight | null;
  /** Override for the current date (testing). Defaults to now. */
  now?: Date;
}

// --- Trends: derived from the snapshot history ---

export interface ChronicleTrends {
  snapshotCount: number;
  /** Days between the first and most recent snapshot (inclusive). */
  daysSpan: number;
  /** Consecutive days ending today or yesterday with a snapshot. */
  currentStreak: number;
  bondPointsNow: number;
  /** Bond points from ~7 days ago, or null if <8 snapshots. */
  bondPointsWeekAgo: number | null;
  /** bondPointsNow - bondPointsWeekAgo (null if week-ago unavailable). */
  bondDeltaWeek: number | null;
  /** Focus minutes accumulated during the most recent day (delta). */
  focusMinutesToday: number;
  /** Mean daily focus-minute delta across all available days. */
  focusMinutesAvgPerDay: number;
  /** The day with the largest single-day focus delta. */
  bestFocusDay: { dateStr: string; minutes: number } | null;
  /** Gaming sessions accumulated during the most recent day (delta). */
  gamingSessionsToday: number;
  /** Most frequent surface mood across the last 7 snapshots. */
  dominantMoodThisWeek: SurfaceMood | null;
  /** The last 7 snapshots' bond points, oldest→newest, for sparkline rendering. */
  bondSparkline: number[];
}

export const NULL_TRENDS: ChronicleTrends = {
  snapshotCount: 0,
  daysSpan: 0,
  currentStreak: 0,
  bondPointsNow: 0,
  bondPointsWeekAgo: null,
  bondDeltaWeek: null,
  focusMinutesToday: 0,
  focusMinutesAvgPerDay: 0,
  bestFocusDay: null,
  gamingSessionsToday: 0,
  dominantMoodThisWeek: null,
  bondSparkline: [],
};

// --- Insights: human-readable pattern surfacing ---

export type InsightKind =
  | "bond_growth"
  | "focus_trend"
  | "streak"
  | "best_day"
  | "mood_pattern"
  | "consistency";

export type InsightTone = "positive" | "neutral" | "encouraging";

export interface ChronicleInsight {
  kind: InsightKind;
  text: string;
  tone: InsightTone;
}

// --- Date helpers (local time, pure) ---

/** Format a Date as a local YYYY-MM-DD string. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days between two YYYY-MM-DD strings (b - a), clamped to >= 0. */
function dayDiff(aStr: string, bStr: string): number {
  const a = new Date(aStr + "T00:00:00");
  const b = new Date(bStr + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/** Most frequent value in a list (ties broken by first-seen order). */
function mode<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  let best: T = values[0];
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

// --- buildChronicleSnapshot ---

/**
 * Build a ChronicleSnapshot from aggregated engine outputs. Pure.
 * The snapshot captures cumulative totals so trends can derive
 * per-day deltas later. Bond level is re-derived from points (not
 * trusted from a potentially-stale stored level) for consistency
 * with the Digest engine.
 */
export function buildChronicleSnapshot(inputs: ChronicleSnapshotInputs): ChronicleSnapshot {
  const {
    bondState,
    stats,
    surfaceMood,
    growth,
    milestoneCount,
    activeSeconds,
    highlight,
    now = new Date(),
  } = inputs;

  const bondPoints = bondState?.bondPoints ?? 0;
  const bondLevel = getBondLevel(bondPoints);

  return {
    dateStr: localDateStr(now),
    timestamp: now.getTime(),
    bondPoints,
    bondLevel,
    surfaceMood,
    growthStage: growth && growth.enabled ? growth.stage : null,
    focusMinutes: stats?.totalFocusMinutes ?? 0,
    gamingSessions: stats?.totalGamingSessions ?? 0,
    emotes: stats?.totalEmotes ?? 0,
    thoughts: stats?.totalThoughts ?? 0,
    whispers: stats?.totalWhispers ?? 0,
    milestoneCount,
    activeSeconds,
    highlightTitle: highlight?.title ?? null,
  };
}

// --- buildTrends ---

/**
 * Derive trends from a snapshot history. Pure and deterministic.
 * Snapshots are sorted internally by timestamp; duplicate dateStr
 * entries are deduplicated by keeping the latest.
 */
export function buildTrends(snapshots: ChronicleSnapshot[], now: Date = new Date()): ChronicleTrends {
  if (snapshots.length === 0) return { ...NULL_TRENDS };

  // Deduplicate by dateStr (keep latest timestamp) and sort ascending.
  const byDate = new Map<string, ChronicleSnapshot>();
  for (const s of snapshots) {
    const existing = byDate.get(s.dateStr);
    if (!existing || s.timestamp > existing.timestamp) {
      byDate.set(s.dateStr, s);
    }
  }
  const sorted = [...byDate.values()].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];

  // --- Streak: consecutive days ending today or yesterday ---
  const todayStr = localDateStr(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);

  let currentStreak = 0;
  // The streak anchor must be today or yesterday; otherwise streak is 0.
  if (latest.dateStr === todayStr || latest.dateStr === yesterdayStr) {
    const dateSet = new Set(sorted.map(s => s.dateStr));
    let cursor = new Date(latest.dateStr + "T00:00:00");
    while (dateSet.has(localDateStr(cursor))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // --- Weekly bond delta ---
  // Find the snapshot closest to 7 days ago (on or before that point).
  const weekAgoMs = now.getTime() - 7 * 86400000;
  let weekAgoSnap: ChronicleSnapshot | null = null;
  for (const s of sorted) {
    if (s.timestamp <= weekAgoMs) {
      weekAgoSnap = s; // keep the latest one on-or-before the cutoff
    } else {
      break;
    }
  }
  // If we have >=8 snapshots, the week-ago reference is meaningful.
  // With fewer, we can still report a delta from the earliest, but we
  // only surface it when there's a genuine 7-day span.
  const bondPointsWeekAgo = weekAgoSnap && sorted.length >= 2 ? weekAgoSnap.bondPoints : null;
  const bondDeltaWeek = bondPointsWeekAgo !== null ? latest.bondPoints - bondPointsWeekAgo : null;

  // --- Daily deltas (focus, gaming) ---
  const dailyDeltas: Array<{ dateStr: string; focusDelta: number; gamingDelta: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const focusDelta = prev ? cur.focusMinutes - prev.focusMinutes : cur.focusMinutes;
    const gamingDelta = prev ? cur.gamingSessions - prev.gamingSessions : cur.gamingSessions;
    dailyDeltas.push({ dateStr: cur.dateStr, focusDelta: Math.max(0, focusDelta), gamingDelta: Math.max(0, gamingDelta) });
  }

  const focusDeltas = dailyDeltas.map(d => d.focusDelta);
  const focusMinutesAvgPerDay = focusDeltas.length > 0
    ? Math.round(focusDeltas.reduce((a, b) => a + b, 0) / focusDeltas.length)
    : 0;

  let bestFocusDay: { dateStr: string; minutes: number } | null = null;
  for (const d of dailyDeltas) {
    if (!bestFocusDay || d.focusDelta > bestFocusDay.minutes) {
      bestFocusDay = { dateStr: d.dateStr, minutes: d.focusDelta };
    }
  }

  const lastDelta = dailyDeltas[dailyDeltas.length - 1];
  const focusMinutesToday = lastDelta ? lastDelta.focusDelta : 0;
  const gamingSessionsToday = lastDelta ? lastDelta.gamingDelta : 0;

  // --- Dominant mood this week (last 7 snapshots) ---
  const recent = sorted.slice(-7);
  const dominantMoodThisWeek = mode(recent.map(s => s.surfaceMood));

  // --- Sparkline: last 7 bond points ---
  const bondSparkline = recent.map(s => s.bondPoints);

  // --- Days span ---
  const first = sorted[0];
  const daysSpan = dayDiff(first.dateStr, latest.dateStr);

  return {
    snapshotCount: sorted.length,
    daysSpan,
    currentStreak,
    bondPointsNow: latest.bondPoints,
    bondPointsWeekAgo,
    bondDeltaWeek,
    focusMinutesToday,
    focusMinutesAvgPerDay,
    bestFocusDay,
    gamingSessionsToday,
    dominantMoodThisWeek,
    bondSparkline,
  };
}

// --- generateInsights ---

/**
 * Surface 0-3 human-readable insights from trends + snapshot history.
 * Pure and deterministic — same inputs always yield the same insights.
 * Insights are ordered by perceived value (bond growth first, then
 * focus, then streak/consistency, then mood).
 */
export function generateInsights(trends: ChronicleTrends, snapshots: ChronicleSnapshot[]): ChronicleInsight[] {
  const insights: ChronicleInsight[] = [];
  if (trends.snapshotCount === 0) return insights;

  // Bond growth over the available window
  if (trends.bondDeltaWeek !== null && trends.bondDeltaWeek !== 0) {
    if (trends.bondDeltaWeek > 0) {
      insights.push({
        kind: "bond_growth",
        text: `Your bond grew by ${trends.bondDeltaWeek} points this week.`,
        tone: "positive",
      });
    } else {
      insights.push({
        kind: "bond_growth",
        text: `Your bond slipped by ${Math.abs(trends.bondDeltaWeek)} points this week — drop by to rebuild it.`,
        tone: "encouraging",
      });
    }
  }

  // Focus trend
  if (trends.focusMinutesAvgPerDay > 0) {
    const todayVsAvg = trends.focusMinutesToday - trends.focusMinutesAvgPerDay;
    if (todayVsAvg > 5) {
      insights.push({
        kind: "focus_trend",
        text: `Today's ${trends.focusMinutesToday}m of focus is above your ${trends.focusMinutesAvgPerDay}m daily average.`,
        tone: "positive",
      });
    } else if (todayVsAvg < -10) {
      insights.push({
        kind: "focus_trend",
        text: `A lighter focus day — your average is ${trends.focusMinutesAvgPerDay}m. Tomorrow's a fresh start.`,
        tone: "encouraging",
      });
    } else {
      insights.push({
        kind: "focus_trend",
        text: `You average ${trends.focusMinutesAvgPerDay} focus minutes per day.`,
        tone: "neutral",
      });
    }
  }

  // Streak
  if (trends.currentStreak >= 3) {
    insights.push({
      kind: "streak",
      text: `${trends.currentStreak} days and counting — keep showing up.`,
      tone: "positive",
    });
  }

  // Best focus day
  if (trends.bestFocusDay && trends.bestFocusDay.minutes > 0) {
    const pretty = trends.bestFocusDay.dateStr.slice(5); // MM-DD
    insights.push({
      kind: "best_day",
      text: `Your best focus day was ${pretty} with ${trends.bestFocusDay.minutes} minutes.`,
      tone: "neutral",
    });
  }

  // Consistency: every snapshot in the last 7 days present
  if (trends.snapshotCount >= 7 && trends.currentStreak >= 7) {
    insights.push({
      kind: "consistency",
      text: `Perfect check-ins this week — every day captured.`,
      tone: "positive",
    });
  }

  // Mood pattern
  if (trends.dominantMoodThisWeek) {
    insights.push({
      kind: "mood_pattern",
      text: `Kovy has felt mostly ${trends.dominantMoodThisWeek} this week.`,
      tone: "neutral",
    });
  }

  // The engine returns all relevant insights in priority order; the
  // presentation layer (chronicleToast) caps the visible count. This
  // keeps the engine pure and lets callers choose how many to show.
  return insights;
}

// --- summarizeChronicle ---

/**
 * Compose a short one-liner for tray tooltips / accessibility.
 */
export function summarizeChronicle(trends: ChronicleTrends): string {
  if (trends.snapshotCount === 0) return "Kovy — no chronicle yet.";
  const parts: string[] = [];
  parts.push(`${trends.snapshotCount} day${trends.snapshotCount === 1 ? "" : "s"} recorded`);
  if (trends.currentStreak > 0) {
    parts.push(`${trends.currentStreak}-day streak`);
  }
  if (trends.bondDeltaWeek !== null && trends.bondDeltaWeek !== 0) {
    parts.push(trends.bondDeltaWeek > 0 ? `+${trends.bondDeltaWeek} bond` : `${trends.bondDeltaWeek} bond`);
  }
  return `Kovy chronicle — ${parts.join(", ")}.`;
}

// --- pruneSnapshots ---

/**
 * Drop snapshots older than `retentionDays` from `now`. Pure — returns
 * a new array. Keeps at least the most recent snapshot regardless of
 * age so the chronicle is never entirely empty while the feature is on.
 */
export function pruneSnapshots(
  snapshots: ChronicleSnapshot[],
  retentionDays: number,
  now: Date = new Date(),
): ChronicleSnapshot[] {
  if (snapshots.length === 0) return [];
  const cutoff = now.getTime() - retentionDays * 86400000;
  const kept = snapshots.filter(s => s.timestamp >= cutoff);
  if (kept.length === 0) {
    // Preserve the single most recent so the chronicle isn't blanked.
    const latest = [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[0];
    return [latest];
  }
  return kept;
}

// --- mergeSnapshot (pure helper for storage layer) ---

/**
 * Insert or replace a snapshot by dateStr, keeping the array sorted
 * ascending by timestamp. Pure — returns a new array. If a snapshot
 * for the same dateStr exists, the newer one (by timestamp) wins.
 */
export function mergeSnapshot(
  existing: ChronicleSnapshot[],
  incoming: ChronicleSnapshot,
): ChronicleSnapshot[] {
  const map = new Map<string, ChronicleSnapshot>();
  for (const s of existing) map.set(s.dateStr, s);
  const prev = map.get(incoming.dateStr);
  if (!prev || incoming.timestamp >= prev.timestamp) {
    map.set(incoming.dateStr, incoming);
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}
