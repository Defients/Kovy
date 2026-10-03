import { describe, it, expect } from "vitest";
import { buildDigest, summarizeDigest, NULL_DIGEST, type DigestInputs } from "../engine/digestEngine";
import type { DigestConfig, BondState, SurfaceMood, GrowthStage } from "../store/types";
import type { StatsData } from "../engine/statsEngine";
import type { GrowthOutput } from "../engine/growthEngine";
import type { JournalEntry } from "../engine/journalEngine";

const FULL_CONFIG: DigestConfig = {
  enabled: true,
  autoDismissSec: 9,
  showBond: true,
  showStats: true,
  showMood: true,
  showGrowth: true,
  showHighlight: true,
};

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

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: `j-${Math.random().toString(36).slice(2, 8)}`,
    type: "milestone",
    timestamp: Date.now(),
    dateStr: new Date().toISOString().slice(0, 10),
    title: "✦ Milestone Unlocked",
    body: "Today I unlocked something cool.",
    mood: "excited" as SurfaceMood,
    ...overrides,
  };
}

function makeInputs(overrides: Partial<DigestInputs> = {}): DigestInputs {
  return {
    config: { ...FULL_CONFIG },
    bondState: makeBondState(),
    stats: makeStats(),
    surfaceMood: "curious" as SurfaceMood,
    growth: makeGrowth(),
    milestoneCount: 7,
    activeSeconds: 3600 * 3.5,
    recentEntries: [makeEntry()],
    ...overrides,
  };
}

describe("buildDigest", () => {
  it("returns a digest with all sections populated when config fully enabled", () => {
    const digest = buildDigest(makeInputs());
    expect(digest.bond).not.toBeNull();
    expect(digest.stats).not.toBeNull();
    expect(digest.mood).toBe("curious");
    expect(digest.growth).not.toBeNull();
    expect(digest.milestoneCount).toBe(7);
    expect(digest.highlight).not.toBeNull();
    expect(digest.activeHours).toBe(3.5);
    expect(digest.generatedAt).toBeGreaterThan(0);
  });

  it("computes bond progress between 0 and 1", () => {
    const digest = buildDigest(makeInputs({ bondState: makeBondState({ bondPoints: 0 }) }));
    expect(digest.bond!.level).toBe("stranger");
    expect(digest.bond!.progress).toBeGreaterThanOrEqual(0);
    expect(digest.bond!.progress).toBeLessThanOrEqual(1);
  });

  it("reports progress=1 at max bond level (best_friend)", () => {
    const digest = buildDigest(makeInputs({ bondState: makeBondState({ bondPoints: 1000, bondLevel: "best_friend" }) }));
    expect(digest.bond!.level).toBe("best_friend");
    expect(digest.bond!.progress).toBe(1);
  });

  it("nulls bond section when showBond is false", () => {
    const digest = buildDigest(makeInputs({ config: { ...FULL_CONFIG, showBond: false } }));
    expect(digest.bond).toBeNull();
  });

  it("nulls stats section when showStats is false", () => {
    const digest = buildDigest(makeInputs({ config: { ...FULL_CONFIG, showStats: false } }));
    expect(digest.stats).toBeNull();
  });

  it("nulls mood section when showMood is false", () => {
    const digest = buildDigest(makeInputs({ config: { ...FULL_CONFIG, showMood: false } }));
    expect(digest.mood).toBeNull();
  });

  it("nulls growth section when showGrowth is false", () => {
    const digest = buildDigest(makeInputs({ config: { ...FULL_CONFIG, showGrowth: false } }));
    expect(digest.growth).toBeNull();
  });

  it("nulls growth section when growth engine is disabled", () => {
    const digest = buildDigest(makeInputs({ growth: makeGrowth({ enabled: false }) }));
    expect(digest.growth).toBeNull();
  });

  it("nulls bond section when bondState is null", () => {
    const digest = buildDigest(makeInputs({ bondState: null }));
    expect(digest.bond).toBeNull();
  });

  it("nulls stats section when stats is null", () => {
    const digest = buildDigest(makeInputs({ stats: null }));
    expect(digest.stats).toBeNull();
  });

  it("picks a today highlight that is not a daily_summary or whisper", () => {
    const entries = [
      makeEntry({ type: "whisper", title: "💬 Whisper", body: "hi" }),
      makeEntry({ type: "daily_summary", title: "📖 Daily Summary", body: "summary" }),
      makeEntry({ type: "milestone", title: "✦ First Nap", body: "I napped!" }),
    ];
    const digest = buildDigest(makeInputs({ recentEntries: entries }));
    expect(digest.highlight).not.toBeNull();
    expect(digest.highlight!.title).toBe("✦ First Nap");
  });

  it("falls back to a non-summary entry from another day if no today entry qualifies", () => {
    const entries = [
      makeEntry({ type: "daily_summary", title: "📖 Daily Summary", body: "summary", dateStr: "2026-08-11" }),
      makeEntry({ type: "ritual", title: "☕ Coffee Break", body: "ritual", dateStr: "2026-08-10" }),
    ];
    const digest = buildDigest(makeInputs({ recentEntries: entries }));
    expect(digest.highlight).not.toBeNull();
    expect(digest.highlight!.title).toBe("☕ Coffee Break");
  });

  it("returns null highlight when showHighlight is false", () => {
    const digest = buildDigest(makeInputs({ config: { ...FULL_CONFIG, showHighlight: false } }));
    expect(digest.highlight).toBeNull();
  });

  it("returns null highlight when there are no entries", () => {
    const digest = buildDigest(makeInputs({ recentEntries: [] }));
    expect(digest.highlight).toBeNull();
  });

  it("returns null highlight when only daily_summary entries exist", () => {
    const entries = [makeEntry({ type: "daily_summary", title: "📖 Daily Summary", body: "summary" })];
    const digest = buildDigest(makeInputs({ recentEntries: entries }));
    expect(digest.highlight).toBeNull();
  });

  it("rounds activeHours to one decimal", () => {
    const digest = buildDigest(makeInputs({ activeSeconds: 3600 * 2.25 }));
    expect(digest.activeHours).toBe(2.3);
  });

  it("is pure — calling twice with same inputs yields equal generatedAt-independent fields", () => {
    const inputs = makeInputs();
    const d1 = buildDigest(inputs);
    const d2 = buildDigest(inputs);
    expect(d2.bond).toEqual(d1.bond);
    expect(d2.stats).toEqual(d1.stats);
    expect(d2.mood).toEqual(d1.mood);
    expect(d2.growth).toEqual(d1.growth);
    expect(d2.milestoneCount).toEqual(d1.milestoneCount);
    expect(d2.highlight).toEqual(d1.highlight);
  });

  it("produces NULL_DIGEST-shaped output when everything is disabled", () => {
    const cfg: DigestConfig = {
      enabled: true, autoDismissSec: 9,
      showBond: false, showStats: false, showMood: false,
      showGrowth: false, showHighlight: false,
    };
    const digest = buildDigest(makeInputs({ config: cfg }));
    expect(digest.bond).toBeNull();
    expect(digest.stats).toBeNull();
    expect(digest.mood).toBeNull();
    expect(digest.growth).toBeNull();
    expect(digest.highlight).toBeNull();
    expect(digest.milestoneCount).toBe(7); // milestone count is independent of section toggles
    expect(digest.activeHours).toBe(3.5);
  });
});

describe("summarizeDigest", () => {
  it("returns a non-empty string for a populated digest", () => {
    const digest = buildDigest(makeInputs());
    const summary = summarizeDigest(digest);
    expect(summary).toContain("Kovy");
    expect(summary.length).toBeGreaterThan("Kovy — ".length);
  });

  it("includes bond level in the summary", () => {
    const digest = buildDigest(makeInputs({ bondState: makeBondState({ bondPoints: 400, bondLevel: "friend" }) }));
    expect(summarizeDigest(digest)).toContain("friend");
  });

  it("includes mood in the summary", () => {
    const digest = buildDigest(makeInputs({ surfaceMood: "playful" as SurfaceMood }));
    expect(summarizeDigest(digest)).toContain("playful");
  });

  it("falls back to a default message when no sections are present", () => {
    const summary = summarizeDigest({ ...NULL_DIGEST, generatedAt: Date.now() });
    expect(summary).toBe("Kovy — your companion.");
  });
});
