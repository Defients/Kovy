import { describe, it, expect } from "vitest";
import {
  buildChronicleSnapshot,
  buildTrends,
  generateInsights,
  summarizeChronicle,
  pruneSnapshots,
  mergeSnapshot,
  localDateStr,
  NULL_TRENDS,
  type ChronicleSnapshot,
  type ChronicleSnapshotInputs,
} from "../engine/chronicleEngine";
import type { BondState, SurfaceMood, GrowthStage } from "../store/types";
import type { StatsData } from "../engine/statsEngine";
import type { GrowthOutput } from "../engine/growthEngine";
import type { DigestHighlight } from "../engine/digestEngine";

// --- Fixtures ---

function makeBondState(overrides: Partial<BondState> = {}): BondState {
  return {
    bondPoints: 200,
    bondLevel: "companion",
    daysTogether: 12,
    totalPokes: 30,
    totalHovers: 50,
    totalSwipes: 10,
    lastInteractionDate: "2026-08-11",
    streakDays: 4,
    firstLaunchDate: "2026-07-30",
    ...overrides,
  };
}

function makeStats(overrides: Partial<StatsData> = {}): StatsData {
  return {
    totalPokes: 30, totalHovers: 50, totalSwipes: 10,
    totalFocusMinutes: 120, totalIdleMinutes: 40,
    totalGamingSessions: 5, totalEmotes: 80,
    totalThoughts: 200, totalWhispers: 60,
    totalDragReleases: 15, totalProfileSwitches: 3,
    totalRituals: 8, totalFamilyInteractions: 12,
    totalWeatherChanges: 4, totalSeasonalEvents: 2,
    totalGrowthEvents: 1,
    longestFocusSession: 45, daysActive: 12,
    lastActiveDate: "2026-08-11",
    ...overrides,
  };
}

function makeGrowth(overrides: Partial<GrowthOutput> = {}): GrowthOutput {
  return {
    enabled: true,
    stage: "young" as GrowthStage,
    ageDays: 12,
    progressToNext: 0.4,
    sizeMultiplier: 0.9,
    ...overrides,
  };
}

function makeHighlight(overrides: Partial<DigestHighlight> = {}): DigestHighlight {
  return {
    title: "✦ First Nap",
    body: "I napped!",
    type: "milestone",
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeInputs(overrides: Partial<ChronicleSnapshotInputs> = {}): ChronicleSnapshotInputs {
  return {
    bondState: makeBondState(),
    stats: makeStats(),
    surfaceMood: "curious" as SurfaceMood,
    growth: makeGrowth(),
    milestoneCount: 7,
    activeSeconds: 3600 * 3.5,
    highlight: makeHighlight(),
    ...overrides,
  };
}

/** Build a snapshot for a given Date, with cumulative totals. */
function snap(
  date: Date,
  overrides: Partial<ChronicleSnapshot> = {},
): ChronicleSnapshot {
  return {
    dateStr: localDateStr(date),
    timestamp: date.getTime(),
    bondPoints: 200,
    bondLevel: "companion",
    surfaceMood: "curious" as SurfaceMood,
    growthStage: "young" as GrowthStage,
    focusMinutes: 100,
    gamingSessions: 2,
    emotes: 10,
    thoughts: 20,
    whispers: 5,
    milestoneCount: 3,
    activeSeconds: 3600,
    highlightTitle: "✦ A good day",
    ...overrides,
  };
}

/** Build N consecutive daily snapshots ending at endDate, with rising bond + focus. */
function makeDailySeries(days: number, endDate: Date, startBond = 100): ChronicleSnapshot[] {
  const out: ChronicleSnapshot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    d.setHours(21, 0, 0, 0);
    out.push(snap(d, {
      bondPoints: startBond + (days - 1 - i) * 10,
      focusMinutes: 100 + (days - 1 - i) * 30,
      gamingSessions: 2 + (days - 1 - i),
    }));
  }
  return out;
}

// --- buildChronicleSnapshot ---

describe("buildChronicleSnapshot", () => {
  it("builds a snapshot with all fields populated", () => {
    const now = new Date(2026, 7, 11, 21, 0, 0);
    const s = buildChronicleSnapshot(makeInputs({ now }));
    expect(s.dateStr).toBe("2026-08-11");
    expect(s.bondPoints).toBe(200);
    expect(s.bondLevel).toBe("companion");
    expect(s.surfaceMood).toBe("curious");
    expect(s.growthStage).toBe("young");
    expect(s.focusMinutes).toBe(120);
    expect(s.gamingSessions).toBe(5);
    expect(s.milestoneCount).toBe(7);
    expect(s.activeSeconds).toBe(3600 * 3.5);
    expect(s.highlightTitle).toBe("✦ First Nap");
  });

  it("re-derives bond level from points (ignores stale stored level)", () => {
    const now = new Date(2026, 7, 11, 21, 0, 0);
    const s = buildChronicleSnapshot(makeInputs({
      bondState: makeBondState({ bondPoints: 0, bondLevel: "best_friend" }),
      now,
    }));
    expect(s.bondLevel).toBe("stranger");
  });

  it("nulls growth stage when growth engine is disabled", () => {
    const s = buildChronicleSnapshot(makeInputs({ growth: makeGrowth({ enabled: false }) }));
    expect(s.growthStage).toBeNull();
  });

  it("nulls growth stage when growth is null", () => {
    const s = buildChronicleSnapshot(makeInputs({ growth: null }));
    expect(s.growthStage).toBeNull();
  });

  it("defaults bond points to 0 when bondState is null", () => {
    const s = buildChronicleSnapshot(makeInputs({ bondState: null }));
    expect(s.bondPoints).toBe(0);
    expect(s.bondLevel).toBe("stranger");
  });

  it("defaults cumulative totals to 0 when stats is null", () => {
    const s = buildChronicleSnapshot(makeInputs({ stats: null }));
    expect(s.focusMinutes).toBe(0);
    expect(s.gamingSessions).toBe(0);
    expect(s.emotes).toBe(0);
  });

  it("nulls highlight title when highlight is null", () => {
    const s = buildChronicleSnapshot(makeInputs({ highlight: null }));
    expect(s.highlightTitle).toBeNull();
  });

  it("is pure — same inputs yield equal snapshots (modulo timestamp)", () => {
    const now = new Date(2026, 7, 11, 21, 0, 0);
    const a = buildChronicleSnapshot(makeInputs({ now }));
    const b = buildChronicleSnapshot(makeInputs({ now }));
    expect(a).toEqual(b);
  });
});

// --- buildTrends ---

describe("buildTrends", () => {
  it("returns NULL_TRENDS for empty snapshots", () => {
    const t = buildTrends([], new Date(2026, 7, 11));
    expect(t).toEqual(NULL_TRENDS);
  });

  it("counts a single snapshot with no streak when it's not today/yesterday", () => {
    const date = new Date(2026, 7, 1, 21, 0, 0);
    const now = new Date(2026, 7, 11, 10, 0, 0);
    const t = buildTrends([snap(date)], now);
    expect(t.snapshotCount).toBe(1);
    expect(t.currentStreak).toBe(0);
    expect(t.bondSparkline).toEqual([200]);
  });

  it("counts a streak of 1 when the latest snapshot is today", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const today = new Date(2026, 7, 11, 21, 0, 0);
    const t = buildTrends([snap(today)], now);
    expect(t.currentStreak).toBe(1);
  });

  it("counts a streak of 1 when the latest snapshot is yesterday", () => {
    const now = new Date(2026, 7, 11, 10, 0, 0);
    const yesterday = new Date(2026, 7, 10, 21, 0, 0);
    const t = buildTrends([snap(yesterday)], now);
    expect(t.currentStreak).toBe(1);
  });

  it("computes a multi-day streak ending today", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    const t = buildTrends(series, now);
    expect(t.currentStreak).toBe(5);
  });

  it("breaks the streak when a day is missing", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    // Remove the middle day
    const gap = [series[0], series[1], series[3], series[4]];
    const t = buildTrends(gap, now);
    expect(t.currentStreak).toBe(2); // only the last two days
  });

  it("computes weekly bond delta from a snapshot >=7 days ago", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100); // bond rises 10/day
    const t = buildTrends(series, now);
    expect(t.bondDeltaWeek).not.toBeNull();
    // Latest bond = 100 + 9*10 = 190; ~7 days ago bond ≈ 100 + 2*10 = 120
    expect(t.bondDeltaWeek).toBe(70);
  });

  it("reports null bondDeltaWeek when fewer than 2 snapshots", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const t = buildTrends([snap(now)], now);
    expect(t.bondDeltaWeek).toBeNull();
    expect(t.bondPointsWeekAgo).toBeNull();
  });

  it("computes today's focus delta as latest minus previous", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now); // focus rises 30/day
    const t = buildTrends(series, now);
    expect(t.focusMinutesToday).toBe(30);
  });

  it("reports full cumulative focus as today's delta when only one snapshot", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const t = buildTrends([snap(now, { focusMinutes: 150 })], now);
    expect(t.focusMinutesToday).toBe(150);
  });

  it("computes average daily focus across deltas", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now); // deltas: 100, 30, 30
    const t = buildTrends(series, now);
    // avg = (100 + 30 + 30) / 3 = 53 (rounded)
    expect(t.focusMinutesAvgPerDay).toBe(53);
  });

  it("finds the best focus day", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now); // first delta is 100 (the baseline)
    const t = buildTrends(series, now);
    expect(t.bestFocusDay).not.toBeNull();
    expect(t.bestFocusDay!.minutes).toBe(100);
  });

  it("computes gaming sessions today as latest minus previous", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now); // gaming rises 1/day
    const t = buildTrends(series, now);
    expect(t.gamingSessionsToday).toBe(1);
  });

  it("computes dominant mood this week from last 7 snapshots", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(7, now);
    // Make 4 of them "playful"
    series[0].surfaceMood = "playful" as SurfaceMood;
    series[1].surfaceMood = "playful" as SurfaceMood;
    series[2].surfaceMood = "playful" as SurfaceMood;
    series[3].surfaceMood = "playful" as SurfaceMood;
    const t = buildTrends(series, now);
    expect(t.dominantMoodThisWeek).toBe("playful");
  });

  it("builds a sparkline of the last 7 bond points", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100);
    const t = buildTrends(series, now);
    expect(t.bondSparkline.length).toBe(7);
    // Last 7 bond points: 100+3*10 .. 100+9*10 = 130..190
    expect(t.bondSparkline[0]).toBe(130);
    expect(t.bondSparkline[6]).toBe(190);
  });

  it("deduplicates snapshots by dateStr (keeps latest timestamp)", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const morning = snap(new Date(2026, 7, 11, 8, 0, 0), { bondPoints: 100 });
    const evening = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    const t = buildTrends([morning, evening], now);
    expect(t.snapshotCount).toBe(1);
    expect(t.bondPointsNow).toBe(250);
  });

  it("computes daysSpan between first and last snapshot", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    const t = buildTrends(series, now);
    expect(t.daysSpan).toBe(4);
  });
});

// --- generateInsights ---

describe("generateInsights", () => {
  it("returns no insights for empty trends", () => {
    expect(generateInsights(NULL_TRENDS, [])).toEqual([]);
  });

  it("includes a positive bond growth insight when delta > 0", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    const bond = insights.find(i => i.kind === "bond_growth");
    expect(bond).toBeDefined();
    expect(bond!.tone).toBe("positive");
    expect(bond!.text).toContain("grew");
  });

  it("includes an encouraging bond insight when delta < 0", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 300);
    // Reverse bond growth so it declines
    series.forEach((s, i) => { s.bondPoints = 300 - i * 10; });
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    const bond = insights.find(i => i.kind === "bond_growth");
    expect(bond).toBeDefined();
    expect(bond!.tone).toBe("encouraging");
    expect(bond!.text).toContain("slipped");
  });

  it("includes a streak insight when streak >= 3", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "streak")).toBe(true);
  });

  it("does not include a streak insight when streak < 3", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(2, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "streak")).toBe(false);
  });

  it("includes a focus trend insight when avg focus > 0", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "focus_trend")).toBe(true);
  });

  it("includes a best-day insight when best focus > 0", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(3, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "best_day")).toBe(true);
  });

  it("includes a mood pattern insight when dominant mood exists", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(7, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "mood_pattern")).toBe(true);
  });

  it("includes a consistency insight for a perfect 7-day streak", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(8, now);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    expect(insights.some(i => i.kind === "consistency")).toBe(true);
  });

  it("returns all relevant insights in priority order (presentation layer caps)", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100);
    const t = buildTrends(series, now);
    const insights = generateInsights(t, series);
    // Engine returns all relevant insights; the toast caps the visible count.
    expect(insights.length).toBeGreaterThan(3);
    // Priority order: bond_growth before focus_trend before streak
    const kinds = insights.map(i => i.kind);
    expect(kinds.indexOf("bond_growth")).toBeLessThan(kinds.indexOf("focus_trend"));
    expect(kinds.indexOf("focus_trend")).toBeLessThan(kinds.indexOf("streak"));
  });

  it("is deterministic — same inputs yield same insights", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100);
    const t = buildTrends(series, now);
    const a = generateInsights(t, series);
    const b = generateInsights(t, series);
    expect(a).toEqual(b);
  });
});

// --- summarizeChronicle ---

describe("summarizeChronicle", () => {
  it("returns a default message for empty trends", () => {
    expect(summarizeChronicle(NULL_TRENDS)).toBe("Kovy — no chronicle yet.");
  });

  it("includes snapshot count and streak", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    const t = buildTrends(series, now);
    const s = summarizeChronicle(t);
    expect(s).toContain("5 days recorded");
    expect(s).toContain("5-day streak");
  });

  it("includes bond delta when present", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(10, now, 100);
    const t = buildTrends(series, now);
    const s = summarizeChronicle(t);
    expect(s).toContain("+70 bond");
  });
});

// --- pruneSnapshots ---

describe("pruneSnapshots", () => {
  it("returns empty for empty input", () => {
    expect(pruneSnapshots([], 90, new Date())).toEqual([]);
  });

  it("drops snapshots older than retentionDays", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const old = snap(new Date(2026, 4, 1, 21, 0, 0)); // ~3 months ago
    const recent = snap(new Date(2026, 7, 10, 21, 0, 0));
    const pruned = pruneSnapshots([old, recent], 30, now);
    expect(pruned.length).toBe(1);
    expect(pruned[0].dateStr).toBe(recent.dateStr);
  });

  it("keeps the most recent snapshot even if all are older than retention", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const old1 = snap(new Date(2026, 0, 1, 21, 0, 0));
    const old2 = snap(new Date(2026, 0, 2, 21, 0, 0));
    const pruned = pruneSnapshots([old1, old2], 30, now);
    expect(pruned.length).toBe(1);
    expect(pruned[0].dateStr).toBe(old2.dateStr);
  });

  it("keeps all snapshots within the retention window", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const series = makeDailySeries(5, now);
    const pruned = pruneSnapshots(series, 30, now);
    expect(pruned.length).toBe(5);
  });
});

// --- mergeSnapshot ---

describe("mergeSnapshot", () => {
  it("adds a new snapshot to an empty array", () => {
    const s = snap(new Date(2026, 7, 11, 21, 0, 0));
    const merged = mergeSnapshot([], s);
    expect(merged).toEqual([s]);
  });

  it("replaces an existing snapshot for the same dateStr with a newer one", () => {
    const morning = snap(new Date(2026, 7, 11, 8, 0, 0), { bondPoints: 100 });
    const evening = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    const merged = mergeSnapshot([morning], evening);
    expect(merged.length).toBe(1);
    expect(merged[0].bondPoints).toBe(250);
  });

  it("does not replace with an older snapshot", () => {
    const morning = snap(new Date(2026, 7, 11, 8, 0, 0), { bondPoints: 100 });
    const evening = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    const merged = mergeSnapshot([evening], morning);
    expect(merged.length).toBe(1);
    expect(merged[0].bondPoints).toBe(250);
  });

  it("keeps the array sorted ascending by timestamp", () => {
    const a = snap(new Date(2026, 7, 9, 21, 0, 0));
    const c = snap(new Date(2026, 7, 11, 21, 0, 0));
    const b = snap(new Date(2026, 7, 10, 21, 0, 0));
    const merged = mergeSnapshot(mergeSnapshot([a], c), b);
    expect(merged.map(s => s.dateStr)).toEqual(["2026-08-09", "2026-08-10", "2026-08-11"]);
  });
});

// --- localDateStr ---

describe("localDateStr", () => {
  it("formats a Date as YYYY-MM-DD in local time", () => {
    expect(localDateStr(new Date(2026, 7, 11, 23, 59))).toBe("2026-08-11");
  });

  it("pads single-digit months and days", () => {
    expect(localDateStr(new Date(2026, 0, 5, 1, 0))).toBe("2026-01-05");
  });
});
