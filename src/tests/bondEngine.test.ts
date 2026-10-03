import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BondEngine,
  getBondLevel,
  getBondProgress,
  getBondMoodModifier,
  createDefaultBondState,
} from "../engine/bondEngine";
import type { BondConfig, BondState } from "../store/types";

const mockConfig: BondConfig = {
  enabled: true,
  bondDecayPerDay: 0.02,
  interactionRadius: 80,
  pokeStartleChance: 0.3,
  bondMilestoneVfx: true,
  doubleClickAction: "celebrate",
  rightClickMenu: true,
};

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  });
  return store;
}

describe("getBondLevel", () => {
  it("returns stranger at 0 points", () => {
    expect(getBondLevel(0)).toBe("stranger");
  });

  it("returns acquaintance at 50 points", () => {
    expect(getBondLevel(50)).toBe("acquaintance");
  });

  it("returns companion at 150 points", () => {
    expect(getBondLevel(150)).toBe("companion");
  });

  it("returns friend at 350 points", () => {
    expect(getBondLevel(350)).toBe("friend");
  });

  it("returns best_friend at 600 points", () => {
    expect(getBondLevel(600)).toBe("best_friend");
  });

  it("returns best_friend at max points", () => {
    expect(getBondLevel(1000)).toBe("best_friend");
  });

  it("returns stranger for negative points", () => {
    expect(getBondLevel(-10)).toBe("stranger");
  });
});

describe("getBondProgress", () => {
  it("returns progress toward next level", () => {
    const p = getBondProgress(75);
    expect(p.current).toBe(75);
    expect(p.next).toBe(150);
    expect(p.progress).toBeCloseTo(0.2, 1); // (75-50)/(150-50) = 0.25
  });

  it("returns null next at max level", () => {
    const p = getBondProgress(800);
    expect(p.next).toBeNull();
    expect(p.progress).toBe(1);
  });
});

describe("getBondMoodModifier", () => {
  it("returns zero boosts for stranger", () => {
    const m = getBondMoodModifier("stranger");
    expect(m.trustBoost).toBe(0);
    expect(m.comfortBoost).toBe(0);
  });

  it("returns increasing boosts for higher levels", () => {
    const acquaintance = getBondMoodModifier("acquaintance");
    const friend = getBondMoodModifier("friend");
    const best = getBondMoodModifier("best_friend");
    expect(best.trustBoost).toBeGreaterThan(friend.trustBoost);
    expect(friend.trustBoost).toBeGreaterThan(acquaintance.trustBoost);
    expect(best.emoteBoost).toBeGreaterThan(friend.emoteBoost);
  });
});

describe("createDefaultBondState", () => {
  it("creates state with 0 bond points and stranger level", () => {
    const s = createDefaultBondState();
    expect(s.bondPoints).toBe(0);
    expect(s.bondLevel).toBe("stranger");
    expect(s.totalPokes).toBe(0);
    expect(s.totalHovers).toBe(0);
    expect(s.totalSwipes).toBe(0);
    expect(s.streakDays).toBe(1);
    expect(s.daysTogether).toBe(1);
  });
});

describe("BondEngine", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = mockLocalStorage();
  });

  it("initializes with default state when no stored state", () => {
    const engine = new BondEngine(mockConfig);
    const s = engine.getState();
    expect(s.bondPoints).toBe(0);
    expect(s.bondLevel).toBe("stranger");
  });

  it("loads from localStorage when available", () => {
    const saved: BondState = {
      ...createDefaultBondState(),
      bondPoints: 200,
      bondLevel: "companion",
      totalPokes: 10,
    };
    store["kovy-bond-state"] = JSON.stringify(saved);
    const engine = new BondEngine(mockConfig);
    const s = engine.getState();
    expect(s.bondPoints).toBe(200);
    expect(s.bondLevel).toBe("companion");
    expect(s.totalPokes).toBe(10);
  });

  it("recordPoke increases bond points", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    const s = engine.recordPoke();
    expect(s.bondPoints).toBeGreaterThan(0);
    expect(s.totalPokes).toBe(1);
  });

  it("recordHover increases bond points", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    const s = engine.recordHover();
    expect(s.bondPoints).toBeGreaterThan(0);
    expect(s.totalHovers).toBe(1);
  });

  it("recordSwipe increases bond points", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    const s = engine.recordSwipe();
    expect(s.bondPoints).toBeGreaterThan(0);
    expect(s.totalSwipes).toBe(1);
  });

  it("poke gives more points than hover", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    const pokeState = engine.recordPoke();
    const engine2 = new BondEngine(mockConfig, createDefaultBondState());
    const hoverState = engine2.recordHover();
    expect(pokeState.bondPoints).toBeGreaterThan(hoverState.bondPoints);
  });

  it("does not record when disabled", () => {
    const engine = new BondEngine({ ...mockConfig, enabled: false }, createDefaultBondState());
    const s = engine.recordPoke();
    expect(s.bondPoints).toBe(0);
    expect(s.totalPokes).toBe(0);
  });

  it("bond points are capped at 1000", () => {
    const state: BondState = {
      ...createDefaultBondState(),
      bondPoints: 999,
    };
    const engine = new BondEngine(mockConfig, state);
    engine.recordPoke();
    const s = engine.getState();
    expect(s.bondPoints).toBeLessThanOrEqual(1000);
  });

  it("updates bond level when points cross threshold", () => {
    const state: BondState = {
      ...createDefaultBondState(),
      bondPoints: 48,
    };
    const engine = new BondEngine(mockConfig, state);
    const s = engine.recordPoke(); // +3 = 51
    expect(s.bondLevel).toBe("acquaintance");
  });

  it("persists state to localStorage", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    engine.recordPoke();
    const raw = store["kovy-bond-state"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.bondPoints).toBeGreaterThan(0);
  });

  it("reset clears state", () => {
    const state: BondState = {
      ...createDefaultBondState(),
      bondPoints: 500,
      totalPokes: 50,
    };
    const engine = new BondEngine(mockConfig, state);
    engine.reset();
    const s = engine.getState();
    expect(s.bondPoints).toBe(0);
    expect(s.totalPokes).toBe(0);
  });

  it("updateConfig changes config", () => {
    const engine = new BondEngine(mockConfig, createDefaultBondState());
    engine.updateConfig({ ...mockConfig, enabled: false });
    const s = engine.recordPoke();
    expect(s.bondPoints).toBe(0);
  });

  it("daily bonus applies on first interaction of a new day", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const state: BondState = {
      ...createDefaultBondState(),
      bondPoints: 10,
      lastInteractionDate: yesterday.toISOString().split("T")[0],
      streakDays: 3,
    };
    const engine = new BondEngine(mockConfig, state);
    const before = engine.getState().bondPoints;
    engine.recordPoke();
    const after = engine.getState().bondPoints;
    // Poke (3) + daily bonus (5) + streak bonus (3*0.5=1.5) = 9.5
    expect(after - before).toBeGreaterThan(5);
  });

  it("streak breaks when gap > 1 day", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const state: BondState = {
      ...createDefaultBondState(),
      bondPoints: 100,
      lastInteractionDate: threeDaysAgo.toISOString().split("T")[0],
      streakDays: 5,
    };
    const engine = new BondEngine(mockConfig, state);
    engine.recordPoke();
    const s = engine.getState();
    expect(s.streakDays).toBe(1); // reset to 1
  });
});
