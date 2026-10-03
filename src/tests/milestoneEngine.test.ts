import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MilestoneEngine,
  MILESTONE_DEFS,
  createDefaultMilestoneState,
  type MilestoneState,
} from "@/engine/milestoneEngine";

// Helper: create a fresh engine with clean state
function makeEngine(state?: Partial<MilestoneState>): MilestoneEngine {
  const base = createDefaultMilestoneState();
  const full = { ...base, ...state } as MilestoneState;
  return new MilestoneEngine(full);
}

describe("MilestoneEngine — defaults and structure", () => {
  it("createDefaultMilestoneState returns correct defaults", () => {
    const s = createDefaultMilestoneState();
    expect(s.unlocked).toEqual({});
    expect(s.totalInteractions).toBe(0);
    expect(s.totalPokes).toBe(0);
    expect(s.totalHovers).toBe(0);
    expect(s.totalSwipes).toBe(0);
    expect(s.maxStreak).toBe(0);
    expect(s.moodsExperienced).toEqual([]);
    expect(s.statesExperienced).toEqual([]);
    expect(s.familyMemberAdded).toBe(false);
    expect(s.museOverlaySpawned).toBe(false);
    expect(s.gamingActivated).toBe(false);
    expect(s.totalActiveSeconds).toBe(0);
  });

  it("MILESTONE_DEFS has 48 milestones", () => {
    expect(MILESTONE_DEFS.length).toBe(48);
  });

  it("all milestone IDs are unique", () => {
    const ids = MILESTONE_DEFS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all milestones have required fields", () => {
    for (const def of MILESTONE_DEFS) {
      expect(def.id).toBeTruthy();
      expect(def.title).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(["behavior", "bond", "mood", "feature", "time", "audio", "thoughts", "seasonal", "growth", "focus", "idle", "drag", "stats", "profiles"]).toContain(def.category);
    }
  });

  it("milestone categories have expected counts", () => {
    const counts = {
      behavior: MILESTONE_DEFS.filter(m => m.category === "behavior").length,
      bond: MILESTONE_DEFS.filter(m => m.category === "bond").length,
      mood: MILESTONE_DEFS.filter(m => m.category === "mood").length,
      feature: MILESTONE_DEFS.filter(m => m.category === "feature").length,
      time: MILESTONE_DEFS.filter(m => m.category === "time").length,
    };
    expect(counts.behavior).toBe(6);
    expect(counts.bond).toBe(11);
    expect(counts.mood).toBe(6);
    expect(counts.feature).toBe(4);
    expect(counts.time).toBe(3);
  });
});

describe("MilestoneEngine — behavior milestones", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("unlocks first_nap on nap state", () => {
    engine.recordBehaviorState("nap");
    expect(engine.isUnlocked("first_nap")).toBe(true);
  });

  it("unlocks first_dream on dream state", () => {
    engine.recordBehaviorState("dream");
    expect(engine.isUnlocked("first_dream")).toBe(true);
  });

  it("unlocks first_startle on startle state", () => {
    engine.recordBehaviorState("startle");
    expect(engine.isUnlocked("first_startle")).toBe(true);
  });

  it("unlocks first_stretch on stretch state", () => {
    engine.recordBehaviorState("stretch");
    expect(engine.isUnlocked("first_stretch")).toBe(true);
  });

  it("unlocks first_yawn on yawn state", () => {
    engine.recordBehaviorState("yawn");
    expect(engine.isUnlocked("first_yawn")).toBe(true);
  });

  it("does not unlock first_nap twice", () => {
    engine.recordBehaviorState("nap");
    engine.recordBehaviorState("nap");
    const unlocked = engine.getUnlocked();
    const napCount = unlocked.filter(u => u.id === "first_nap").length;
    expect(napCount).toBe(1);
  });

  it("unlocks all_behaviors when all standard states experienced", () => {
    const states = [
      "idle_float", "wander", "perch", "inspect", "orbit", "follow_burst",
      "nap", "peek", "celebrate", "recover", "stretch", "look_around", "yawn",
    ];
    for (const s of states) {
      engine.recordBehaviorState(s as any);
    }
    expect(engine.isUnlocked("all_behaviors")).toBe(true);
  });

  it("does not unlock all_behaviors when missing states", () => {
    const partial = ["idle_float", "wander", "perch", "nap"];
    for (const s of partial) {
      engine.recordBehaviorState(s as any);
    }
    expect(engine.isUnlocked("all_behaviors")).toBe(false);
  });
});

describe("MilestoneEngine — bond milestones", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("unlocks bond_acquaintance at acquaintance level", () => {
    engine.recordBondLevel("acquaintance");
    expect(engine.isUnlocked("bond_acquaintance")).toBe(true);
    expect(engine.isUnlocked("bond_friend")).toBe(false);
  });

  it("unlocks bond_best_friend at best_friend level", () => {
    engine.recordBondLevel("best_friend");
    expect(engine.isUnlocked("bond_best_friend")).toBe(true);
  });

  it("unlocks interactions_10 after 10 interactions", () => {
    for (let i = 0; i < 10; i++) {
      engine.recordInteraction("poke");
    }
    expect(engine.isUnlocked("interactions_10")).toBe(true);
    expect(engine.isUnlocked("interactions_50")).toBe(false);
  });

  it("unlocks interactions_500 after 500 interactions", () => {
    for (let i = 0; i < 500; i++) {
      engine.recordInteraction("hover");
    }
    expect(engine.isUnlocked("interactions_500")).toBe(true);
  });

  it("tracks interaction type counts separately", () => {
    engine.recordInteraction("poke");
    engine.recordInteraction("poke");
    engine.recordInteraction("hover");
    engine.recordInteraction("swipe");
    engine.recordInteraction("swipe");
    engine.recordInteraction("swipe");
    const state = engine.getState();
    expect(state.totalPokes).toBe(2);
    expect(state.totalHovers).toBe(1);
    expect(state.totalSwipes).toBe(3);
    expect(state.totalInteractions).toBe(6);
  });

  it("unlocks streak_3 at 3-day streak", () => {
    engine.recordStreak(3);
    expect(engine.isUnlocked("streak_3")).toBe(true);
    expect(engine.isUnlocked("streak_7")).toBe(false);
  });

  it("unlocks streak_30 at 30-day streak", () => {
    engine.recordStreak(30);
    expect(engine.isUnlocked("streak_30")).toBe(true);
  });

  it("tracks maxStreak correctly", () => {
    engine.recordStreak(5);
    engine.recordStreak(3);
    engine.recordStreak(10);
    expect(engine.getState().maxStreak).toBe(10);
  });
});

describe("MilestoneEngine — mood milestones", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("unlocks mood_curious on curious mood", () => {
    engine.recordMood("curious");
    expect(engine.isUnlocked("mood_curious")).toBe(true);
  });

  it("unlocks mood_playful on playful mood", () => {
    engine.recordMood("playful");
    expect(engine.isUnlocked("mood_playful")).toBe(true);
  });

  it("unlocks mood_overwhelmed on overwhelmed mood", () => {
    engine.recordMood("overwhelmed");
    expect(engine.isUnlocked("mood_overwhelmed")).toBe(true);
  });

  it("unlocks mood_shy on shy mood", () => {
    engine.recordMood("shy");
    expect(engine.isUnlocked("mood_shy")).toBe(true);
  });

  it("unlocks all_moods when all 8 moods experienced", () => {
    const moods = ["calm", "curious", "playful", "focused", "sleepy", "excited", "overwhelmed", "shy"];
    for (const m of moods) {
      engine.recordMood(m as any);
    }
    expect(engine.isUnlocked("all_moods")).toBe(true);
  });

  it("does not unlock all_moods when missing moods", () => {
    engine.recordMood("calm");
    engine.recordMood("curious");
    expect(engine.isUnlocked("all_moods")).toBe(false);
  });

  it("does not double-record moods", () => {
    engine.recordMood("curious");
    engine.recordMood("curious");
    expect(engine.getState().moodsExperienced.filter(m => m === "curious").length).toBe(1);
  });
});

describe("MilestoneEngine — feature milestones", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("unlocks first_family on family member added", () => {
    engine.recordFamilyMemberAdded();
    expect(engine.isUnlocked("first_family")).toBe(true);
  });

  it("unlocks first_muse on muse overlay spawned", () => {
    engine.recordMuseOverlay();
    expect(engine.isUnlocked("first_muse")).toBe(true);
  });

  it("unlocks first_gaming on gaming activated", () => {
    engine.recordGamingActivated();
    expect(engine.isUnlocked("first_gaming")).toBe(true);
  });

  it("unlocks first_habitat on habitat created", () => {
    engine.recordHabitatCreated();
    expect(engine.isUnlocked("first_habitat")).toBe(true);
  });

  it("does not double-unlock first_family", () => {
    engine.recordFamilyMemberAdded();
    engine.recordFamilyMemberAdded();
    const unlocked = engine.getUnlocked().filter(u => u.id === "first_family");
    expect(unlocked.length).toBe(1);
  });
});

describe("MilestoneEngine — time milestones", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("unlocks time_1h after 3600 seconds", () => {
    engine.recordActiveTime(3600);
    expect(engine.isUnlocked("time_1h")).toBe(true);
    expect(engine.isUnlocked("time_10h")).toBe(false);
  });

  it("unlocks time_100h after 360000 seconds", () => {
    engine.recordActiveTime(360000);
    expect(engine.isUnlocked("time_100h")).toBe(true);
  });

  it("accumulates active time across calls", () => {
    for (let i = 0; i < 360; i++) {
      engine.recordActiveTime(10);
    }
    expect(engine.isUnlocked("time_1h")).toBe(true);
  });

  it("does not unlock time_1h with insufficient time", () => {
    engine.recordActiveTime(3599);
    expect(engine.isUnlocked("time_1h")).toBe(false);
  });
});

describe("MilestoneEngine — newly unlocked notifications", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("consumeNewlyUnlocked returns newly unlocked milestones", () => {
    engine.recordBehaviorState("nap");
    const newOnes = engine.consumeNewlyUnlocked();
    expect(newOnes.length).toBe(1);
    expect(newOnes[0].id).toBe("first_nap");
  });

  it("consumeNewlyUnlocked clears the queue", () => {
    engine.recordBehaviorState("nap");
    engine.consumeNewlyUnlocked();
    const secondCall = engine.consumeNewlyUnlocked();
    expect(secondCall.length).toBe(0);
  });

  it("batch unlocks are all returned", () => {
    engine.recordMood("curious");
    engine.recordMood("playful");
    engine.recordBehaviorState("nap");
    const newOnes = engine.consumeNewlyUnlocked();
    expect(newOnes.length).toBe(3);
  });
});

describe("MilestoneEngine — stats and queries", () => {
  let engine: MilestoneEngine;

  beforeEach(() => {
    engine = makeEngine();
  });

  it("getStats returns correct initial state", () => {
    const stats = engine.getStats();
    expect(stats.totalMilestones).toBe(48);
    expect(stats.unlockedCount).toBe(0);
    expect(stats.lockedCount).toBe(48);
  });

  it("getStats reflects unlocked milestones", () => {
    engine.recordBehaviorState("nap");
    engine.recordMood("curious");
    const stats = engine.getStats();
    expect(stats.unlockedCount).toBe(2);
    expect(stats.lockedCount).toBe(46);
  });

  it("byCategory counts are correct", () => {
    engine.recordBehaviorState("nap");
    engine.recordMood("curious");
    const stats = engine.getStats();
    expect(stats.byCategory.behavior.unlocked).toBe(1);
    expect(stats.byCategory.mood.unlocked).toBe(1);
    expect(stats.byCategory.bond.unlocked).toBe(0);
  });

  it("getLocked returns locked milestones", () => {
    engine.recordBehaviorState("nap");
    const locked = engine.getLocked();
    expect(locked.length).toBe(47);
    expect(locked.find(m => m.id === "first_nap")).toBeUndefined();
  });

  it("getAll returns all milestones with unlock status", () => {
    engine.recordBehaviorState("nap");
    const all = engine.getAll();
    expect(all.length).toBe(48);
    const napEntry = all.find(m => m.def.id === "first_nap");
    expect(napEntry?.unlockedAt).not.toBeNull();
    const lockedEntry = all.find(m => m.def.id === "first_dream");
    expect(lockedEntry?.unlockedAt).toBeNull();
  });
});

describe("MilestoneEngine — reset", () => {
  it("reset clears all unlocked milestones", () => {
    const engine = makeEngine();
    engine.recordBehaviorState("nap");
    engine.recordMood("curious");
    expect(engine.getStats().unlockedCount).toBe(2);

    engine.reset();
    expect(engine.getStats().unlockedCount).toBe(0);
    expect(engine.getState().totalInteractions).toBe(0);
  });
});

describe("MilestoneEngine — invalid unlock attempts", () => {
  it("does not unlock unknown milestone IDs", () => {
    const engine = makeEngine();
    // @ts-expect-error — testing invalid ID
    engine.recordBehaviorState("fake_state");
    expect(engine.getStats().unlockedCount).toBe(0);
  });
});

describe("MilestoneEngine — persistence", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists state to localStorage", () => {
    const engine = new MilestoneEngine();
    engine.recordBehaviorState("nap");
    expect(engine.isUnlocked("first_nap")).toBe(true);

    // Create new engine — should load from localStorage
    const engine2 = new MilestoneEngine();
    expect(engine2.isUnlocked("first_nap")).toBe(true);
  });

  it("handles corrupted localStorage gracefully", () => {
    store["kovy-milestone-state"] = "not valid json";
    const engine = new MilestoneEngine();
    // Should fall back to defaults
    expect(engine.getStats().unlockedCount).toBe(0);
  });

  it("handles empty localStorage gracefully", () => {
    const engine = new MilestoneEngine();
    expect(engine.getStats().unlockedCount).toBe(0);
  });
});
