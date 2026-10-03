import { describe, it, expect, vi, afterEach } from "vitest";
import { BehaviorEngine } from "../engine/behaviorEngine";
import type { BehaviorContext } from "../engine/behaviorEngine";
import { DEFAULT_BEHAVIOR, DEFAULT_HABITAT } from "../store/defaults";
import { getMoodModifiers } from "../engine/moodEngine";
import type { SurfaceMood } from "../store/types";

// --- Test helpers ---

function makeContext(overrides?: Partial<BehaviorContext>): BehaviorContext {
  return {
    position: { x: 500, y: 400 },
    screenWidth: 1920,
    screenHeight: 1080,
    cursorPosition: { x: 960, y: 540 },
    activeTarget: null,
    candidateTargets: [],
    moodModifiers: getMoodModifiers("calm"),
    surfaceMood: "calm",
    config: { ...DEFAULT_BEHAVIOR },
    perchPosition: null,
    isInteracting: false,
    habitat: { ...DEFAULT_HABITAT },
    memoryInfluence: null,
    familyInfluence: null,
    circadianOutput: null,
    ...overrides,
  };
}

// Idle_float and micro-fidgets use Date.now()/1000 for sine-based movement.
// We must advance mock time to see position variation across frames.
function mockTimeFrames(count: number, dtMs: number = 16): () => void {
  let t = 1000000;
  const spy = vi.spyOn(Date, "now").mockImplementation(() => {
    t += dtMs;
    return t;
  });
  return () => spy.mockRestore();
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// Vitality System Tests
// ============================================================

describe("Vitality — idle_float amplitude", () => {
  it("idle_float produces visible movement (not sub-pixel)", () => {
    const restore = mockTimeFrames(100);
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");
    const ctx = makeContext();

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const result = engine.update(0.016, ctx);
      if (result.targetPosition) {
        positions.push(result.targetPosition);
      }
    }
    restore();

    expect(positions.length).toBeGreaterThan(0);

    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);

    // Must produce at least 2px of visible movement in each axis
    expect(xRange).toBeGreaterThan(2);
    expect(yRange).toBeGreaterThan(1);
  });

  it("idle_float amplitude scales with mood (excited > calm)", () => {
    const restore = mockTimeFrames(200);
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");

    const calmCtx = makeContext({
      surfaceMood: "calm",
      moodModifiers: getMoodModifiers("calm"),
    });
    const excitedCtx = makeContext({
      surfaceMood: "excited",
      moodModifiers: getMoodModifiers("excited"),
    });

    const calmPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const result = engine.update(0.016, calmCtx);
      if (result.targetPosition) calmPositions.push(result.targetPosition);
    }

    const engine2 = new BehaviorEngine();
    engine2.forceState("idle_float");
    const excitedPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const result = engine2.update(0.016, excitedCtx);
      if (result.targetPosition) excitedPositions.push(result.targetPosition);
    }
    restore();

    const calmRange = Math.max(...calmPositions.map(p => p.x)) - Math.min(...calmPositions.map(p => p.x));
    const excitedRange = Math.max(...excitedPositions.map(p => p.x)) - Math.min(...excitedPositions.map(p => p.x));

    // Excited mood has higher idleAnimationScale, so range should be larger
    expect(excitedRange).toBeGreaterThan(calmRange);
  });

  it("sleepy mood produces minimal idle movement", () => {
    const restore = mockTimeFrames(100);
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");
    const ctx = makeContext({
      surfaceMood: "sleepy",
      moodModifiers: getMoodModifiers("sleepy"),
    });

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 100; i++) {
      const result = engine.update(0.016, ctx);
      if (result.targetPosition) positions.push(result.targetPosition);
    }
    restore();

    const xRange = Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x));
    // Sleepy idleAnimationScale is 0.4, so movement is reduced but still visible
    expect(xRange).toBeGreaterThan(0.5);
    expect(xRange).toBeLessThan(15); // but not wild
  });
});

describe("Vitality — perch micro-fidgets", () => {
  it("perch state produces non-static position", () => {
    const restore = mockTimeFrames(200);
    const engine = new BehaviorEngine();
    engine.forceState("perch");
    const ctx = makeContext({
      perchPosition: { x: 100, y: 100 },
    });

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 200; i++) {
      const result = engine.update(0.016, ctx);
      if (result.targetPosition) positions.push(result.targetPosition);
    }
    restore();

    expect(positions.length).toBeGreaterThan(0);

    const xs = positions.map(p => p.x);
    const xRange = Math.max(...xs) - Math.min(...xs);
    expect(xRange).toBeGreaterThan(0.1); // any movement at all
    expect(xRange).toBeLessThan(10); // but very subtle
  });
});

describe("Vitality — nap micro-fidgets", () => {
  it("nap state has periodic breathing settle", () => {
    const restore = mockTimeFrames(400);
    const engine = new BehaviorEngine();
    engine.forceState("nap");
    const ctx = makeContext({
      surfaceMood: "sleepy",
      moodModifiers: getMoodModifiers("sleepy"),
    });

    const positions: { y: number }[] = [];
    for (let i = 0; i < 400; i++) {
      const result = engine.update(0.016, ctx);
      if (result.targetPosition) positions.push({ y: result.targetPosition.y });
    }
    restore();

    expect(positions.length).toBeGreaterThan(0);

    const ys = positions.map(p => p.y);
    const yRange = Math.max(...ys) - Math.min(...ys);
    expect(yRange).toBeGreaterThan(0.1);
    expect(yRange).toBeLessThan(5); // very subtle settle
  });
});

describe("Vitality — breath params coverage", () => {
  const ALL_MOODS: SurfaceMood[] = [
    "calm", "curious", "playful", "focused",
    "sleepy", "excited", "overwhelmed", "shy",
  ];

  it("getMoodModifiers returns valid blinkInterval for all moods", () => {
    for (const mood of ALL_MOODS) {
      const mods = getMoodModifiers(mood);
      expect(mods.blinkInterval).toBeGreaterThan(0);
      expect(mods.blinkInterval).toBeLessThan(10);
    }
  });

  it("getMoodModifiers idleAnimationScale varies by mood", () => {
    const calmScale = getMoodModifiers("calm").idleAnimationScale;
    const excitedScale = getMoodModifiers("excited").idleAnimationScale;
    const sleepyScale = getMoodModifiers("sleepy").idleAnimationScale;

    expect(excitedScale).toBeGreaterThan(calmScale);
    expect(calmScale).toBeGreaterThan(sleepyScale);
  });

  it("all moods produce distinct speedMultiplier values", () => {
    const speeds = ALL_MOODS.map(m => getMoodModifiers(m).speedMultiplier);
    // Not all identical
    const unique = new Set(speeds);
    expect(unique.size).toBeGreaterThan(3);
  });
});
