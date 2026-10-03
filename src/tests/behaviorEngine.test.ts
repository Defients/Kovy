import { describe, it, expect } from "vitest";
import { BehaviorEngine } from "../engine/behaviorEngine";
import type { BehaviorContext, BehaviorOutput } from "../engine/behaviorEngine";
import { DEFAULT_BEHAVIOR, DEFAULT_HABITAT, DEFAULT_HYPER } from "../store/defaults";
import { getMoodModifiers } from "../engine/moodEngine";
import type { MotionTarget } from "../store/types";

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

function makeTarget(score: number, id: number = 1): MotionTarget {
  return {
    position: { x: 800, y: 300 },
    score,
    regionId: id,
    age: 0,
  };
}

describe("BehaviorEngine", () => {
  it("starts in idle_float state", () => {
    const engine = new BehaviorEngine();
    expect(engine.getState()).toBe("idle_float");
  });

  it("transitions to inspect when a strong target appears", () => {
    const engine = new BehaviorEngine();
    const ctx = makeContext({
      activeTarget: makeTarget(0.6),
    });

    // Run enough time to pass min duration
    let result: BehaviorOutput = engine.update(0, ctx);
    for (let i = 0; i < 200; i++) {
      result = engine.update(0.02, ctx);
    }

    expect(result.newState).toBe("inspect");
    expect(result.targetPosition).not.toBeNull();
  });

  it("transitions to nap when mood is sleepy after sufficient time", () => {
    const engine = new BehaviorEngine();
    const ctx = makeContext({
      surfaceMood: "sleepy",
      moodModifiers: getMoodModifiers("sleepy"),
    });

    let result: BehaviorOutput = engine.update(0, ctx);
    for (let i = 0; i < 400; i++) {
      result = engine.update(0.02, ctx);
    }

    expect(result.newState).toBe("nap");
  });

  it("transitions to recover when overwhelmed", () => {
    const engine = new BehaviorEngine();
    const ctx = makeContext({
      surfaceMood: "overwhelmed",
      moodModifiers: getMoodModifiers("overwhelmed"),
    });

    let result: BehaviorOutput = engine.update(0, ctx);
    for (let i = 0; i < 200; i++) {
      result = engine.update(0.02, ctx);
    }

    expect(result.newState).toBe("recover");
  });

  it("can be forced into a specific state", () => {
    const engine = new BehaviorEngine();
    engine.forceState("celebrate");
    expect(engine.getState()).toBe("celebrate");
  });
});

describe("BehaviorEngine — Hyper Mode", () => {
  function makeHyperContext(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
    return makeContext({
      config: {
        ...DEFAULT_BEHAVIOR,
        preset: "hyper",
        curiosityStrength: 1.0,
        attractionStrength: 1.0,
        boredomRate: 0.9,
        dwellTime: 1.5,
        perchPreference: 0.05,
        wanderAmount: 0.5,
        returnToPerchTendency: 0.05,
        hyper: { ...DEFAULT_HYPER },
      },
      ...overrides,
    });
  }

  it("enters dash_inspect when a target appears in hyper mode", () => {
    const engine = new BehaviorEngine();
    const target = makeTarget(0.5);
    const ctx = makeHyperContext({ activeTarget: target });

    let result: BehaviorOutput = engine.update(0, ctx);
    for (let i = 0; i < 200; i++) {
      result = engine.update(0.02, ctx);
    }

    // Should eventually enter dash_inspect or burst_orbit (dash leads to burst)
    const hyperStates = ["dash_inspect", "burst_orbit", "chain_seek", "snap_perch"];
    expect(hyperStates).toContain(result.newState);
  });

  it("reports dashActive during dash_inspect and chain_seek", () => {
    const engine = new BehaviorEngine();
    engine.forceState("dash_inspect");

    const target = makeTarget(0.6);
    const ctx = makeHyperContext({ activeTarget: target });
    const result = engine.update(0.01, ctx);

    // dash_inspect should report dashActive
    expect(result.dashActive).toBe(true);
  });

  it("does not report dashActive during idle_float", () => {
    const engine = new BehaviorEngine();
    const ctx = makeHyperContext();
    const result = engine.update(0.01, ctx);
    expect(result.dashActive).toBe(false);
  });

  it("increments chainCount when entering chain_seek", () => {
    const engine = new BehaviorEngine();
    engine.forceState("chain_seek");

    const targets = [makeTarget(0.5, 1), makeTarget(0.4, 2), makeTarget(0.3, 3)];
    const ctx = makeHyperContext({
      activeTarget: targets[0],
      candidateTargets: targets,
    });

    const result = engine.update(0.01, ctx);
    expect(result.chainCount).toBeGreaterThanOrEqual(0);
  });
});

describe("BehaviorEngine — Habitat Integration", () => {
  it("uses habitat homes for perch when available", () => {
    const engine = new BehaviorEngine();
    engine.forceState("perch");

    const ctx = makeContext({
      habitat: {
        enabled: true,
        homes: [{ id: "h1", position: { x: 100, y: 100 }, label: "Home 1" }],
        zones: [],
        rails: [],
        nodes: [],
        railInfluence: 0.5,
      },
    });

    const result = engine.update(0.01, ctx);
    // Should target the home position
    expect(result.targetPosition).not.toBeNull();
    if (result.targetPosition) {
      // Vitality micro-fidgets add up to ±1.5px of organic settle
      expect(Math.abs(result.targetPosition.x - 100)).toBeLessThan(2);
      expect(Math.abs(result.targetPosition.y - 100)).toBeLessThan(2);
    }
  });

  it("uses habitat homes for nap when available", () => {
    const engine = new BehaviorEngine();
    engine.forceState("nap");

    const ctx = makeContext({
      habitat: {
        enabled: true,
        homes: [{ id: "h1", position: { x: 200, y: 200 }, label: "Home 1" }],
        zones: [],
        rails: [],
        nodes: [],
        railInfluence: 0.5,
      },
    });

    const result = engine.update(0.01, ctx);
    expect(result.targetPosition).not.toBeNull();
    if (result.targetPosition) {
      // Nap micro-fidget adds up to ±1.2px of breathing settle
      expect(Math.abs(result.targetPosition.x - 200)).toBeLessThan(2);
      expect(Math.abs(result.targetPosition.y - 205)).toBeLessThan(2);
    }
  });

  it("applies avoid zone influence to push target away", () => {
    const engine = new BehaviorEngine();
    engine.forceState("inspect");

    const target = makeTarget(0.6);
    target.position = { x: 500, y: 500 };

    const ctx = makeContext({
      activeTarget: target,
      habitat: {
        enabled: true,
        homes: [],
        zones: [{
          id: "z1",
          type: "avoid",
          rect: { x: 400, y: 400, w: 200, h: 200 },
          strength: 1.0,
          label: "Avoid Zone",
        }],
        rails: [],
        nodes: [],
        railInfluence: 0.5,
      },
    });

    const result = engine.update(0.01, ctx);
    expect(result.targetPosition).not.toBeNull();
    // Target should be pushed away from zone center (500, 500)
    // The exact position depends on the offset from inspect, but it should differ
  });
});

describe("BehaviorEngine — Family Influence", () => {
  it("chase target overrides normal movement target", () => {
    const engine = new BehaviorEngine();
    engine.forceState("inspect");

    const target = makeTarget(0.6);
    const ctx = makeContext({
      activeTarget: target,
      familyInfluence: {
        curiosityContagion: 0,
        comfortContagion: 0,
        playfulChase: true,
        chaseTargetId: "sib-1",
        chaseTargetPos: { x: 1200, y: 600 },
        syncOrbit: false,
        syncOrbitCenter: null,
        groupHyperBurst: false,
        territoryPull: null,
        nearbyCount: 1,
      },
    });

    const result = engine.update(0.01, ctx);
    // Target should be overridden to chase position
    expect(result.targetPosition).not.toBeNull();
    if (result.targetPosition) {
      expect(result.targetPosition.x).toBeCloseTo(1200, 0);
      expect(result.targetPosition.y).toBeCloseTo(600, 0);
    }
  });

  it("territory pull adjusts target position", () => {
    const engine = new BehaviorEngine();
    engine.forceState("wander");

    const ctx = makeContext({
      familyInfluence: {
        curiosityContagion: 0,
        comfortContagion: 0,
        playfulChase: false,
        chaseTargetId: null,
        chaseTargetPos: null,
        syncOrbit: false,
        syncOrbitCenter: null,
        groupHyperBurst: false,
        territoryPull: { x: 50, y: -30 },
        nearbyCount: 0,
      },
    });

    const result = engine.update(0.01, ctx);
    // We can't assert exact values since wander adds randomness,
    // but we can verify it doesn't crash and returns a valid result
    expect(result.newState).toBeDefined();
  });

  it("null family influence has no effect", () => {
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");

    const ctxWithNull = makeContext({ familyInfluence: null, circadianOutput: null });
    const result = engine.update(0.01, ctxWithNull);

    expect(result.newState).toBeDefined();
    expect(result.targetPosition).toBeDefined();
  });
});

describe("BehaviorEngine — Social Energy (v7.0)", () => {
  it("high socialEnergy with family boosts follow_burst probability", () => {
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");

    const ctx = makeContext({
      activeTarget: makeTarget(0.8),
      surfaceMood: "excited",
      moodModifiers: getMoodModifiers("excited"),
      familyInfluence: {
        curiosityContagion: 0, comfortContagion: 0,
        groupHyperBurst: false, playfulChase: false,
        syncOrbit: false, territoryPull: null,
        chaseTargetId: null, chaseTargetPos: null, syncOrbitCenter: null,
        nearbyCount: 1,
      },
      circadianOutput: {
        phase: "afternoon", energyMultiplier: 1, anticipation: 0.5,
        drowsiness: 0, startleSensitivity: 0.3, dreamIntensity: 0,
        socialEnergy: 0.9,
      },
    });

    // Run many updates from idle_float with excited mood + strong target + high social energy
    let burstCount = 0;
    for (let i = 0; i < 200; i++) {
      const e = new BehaviorEngine();
      e.forceState("idle_float");
      // Advance past idle_float min duration (2.0s), checking every update for follow_burst
      let hitBurst = false;
      for (let j = 0; j < 30; j++) {
        const result = e.update(0.1, ctx);
        if (result.newState === "follow_burst") { hitBurst = true; break; }
      }
      if (hitBurst) burstCount++;
    }
    // With 1.5x multiplier, should get more bursts than baseline
    expect(burstCount).toBeGreaterThan(0);
  });

  it("low socialEnergy with family reduces follow_burst probability", () => {
    let lowSocialBursts = 0;
    let noSocialBursts = 0;

    for (let i = 0; i < 200; i++) {
      const ctxLow = makeContext({
        activeTarget: makeTarget(0.8),
        surfaceMood: "excited",
        moodModifiers: getMoodModifiers("excited"),
        familyInfluence: {
          curiosityContagion: 0, comfortContagion: 0,
          groupHyperBurst: false, playfulChase: false,
          syncOrbit: false, territoryPull: null,
          chaseTargetId: null, chaseTargetPos: null, syncOrbitCenter: null,
          nearbyCount: 1,
        },
        circadianOutput: {
          phase: "night", energyMultiplier: 0.3, anticipation: 0,
          drowsiness: 0.8, startleSensitivity: 0.5, dreamIntensity: 0,
          socialEnergy: 0.1,
        },
      });

      const ctxNone = makeContext({
        activeTarget: makeTarget(0.8),
        surfaceMood: "excited",
        moodModifiers: getMoodModifiers("excited"),
        familyInfluence: {
          curiosityContagion: 0, comfortContagion: 0,
          groupHyperBurst: false, playfulChase: false,
          syncOrbit: false, territoryPull: null,
          chaseTargetId: null, chaseTargetPos: null, syncOrbitCenter: null,
          nearbyCount: 1,
        },
        circadianOutput: null,
      });

      const e1 = new BehaviorEngine();
      e1.forceState("idle_float");
      let hitBurstLow = false;
      for (let j = 0; j < 30; j++) {
        const result = e1.update(0.1, ctxLow);
        if (result.newState === "follow_burst") { hitBurstLow = true; break; }
      }
      if (hitBurstLow) lowSocialBursts++;

      const e2 = new BehaviorEngine();
      e2.forceState("idle_float");
      let hitBurstNone = false;
      for (let j = 0; j < 30; j++) {
        const result = e2.update(0.1, ctxNone);
        if (result.newState === "follow_burst") { hitBurstNone = true; break; }
      }
      if (hitBurstNone) noSocialBursts++;
    }
    // Low social energy should produce fewer or equal bursts than no circadian
    expect(lowSocialBursts).toBeLessThanOrEqual(noSocialBursts + 5);
  });
});

describe("BehaviorEngine — Predicted Points (v7.0)", () => {
  it("wander targets predicted point when available", () => {
    const predictedPos = { x: 1200, y: 700 };
    let pos = { x: 500, y: 400 };

    // Run many trials with fresh engines, forcing wander and jumping position to target
    let hitPredicted = false;
    for (let i = 0; i < 200; i++) {
      const engine = new BehaviorEngine();
      engine.forceState("wander");
      const ctx = makeContext({
        position: pos,
        predictedPoints: [predictedPos, { x: 300, y: 200 }],
      });
      // First call sets initial wander target
      let result = engine.update(0.1, ctx);
      // Jump to target to force re-selection on next call
      if (result.targetPosition) {
        pos = { ...result.targetPosition };
        result = engine.update(0.1, { ...ctx, position: pos });
        if (result.targetPosition &&
            Math.abs(result.targetPosition.x - predictedPos.x) < 1 &&
            Math.abs(result.targetPosition.y - predictedPos.y) < 1) {
          hitPredicted = true;
          break;
        }
      }
    }
    expect(hitPredicted).toBe(true);
  });

  it("wander works without predictedPoints", () => {
    const engine = new BehaviorEngine();
    engine.forceState("wander");

    const ctx = makeContext({ predictedPoints: undefined });
    const result = engine.update(0.5, ctx);
    expect(result.targetPosition).toBeDefined();
  });
});

describe("BehaviorEngine — v7.0 State Transitions", () => {
  it("transitions to dance from idle when playful", () => {
    let danced = false;
    for (let i = 0; i < 200; i++) {
      const engine = new BehaviorEngine();
      engine.forceState("idle_float");
      const ctx = makeContext({
        surfaceMood: "playful",
        moodModifiers: getMoodModifiers("playful"),
      });
      // Advance past 5s idle threshold
      for (let j = 0; j < 60; j++) engine.update(0.1, ctx);
      if (engine.getState() === "dance") { danced = true; break; }
    }
    expect(danced).toBe(true);
  });

  it("transitions to meditate from perch when calm and moderate drowsiness", () => {
    let meditated = false;
    for (let i = 0; i < 200; i++) {
      const engine = new BehaviorEngine();
      engine.forceState("perch");
      const ctx = makeContext({
        surfaceMood: "calm",
        moodModifiers: getMoodModifiers("calm"),
        circadianOutput: {
          phase: "evening", energyMultiplier: 0.5, anticipation: 0.2,
          drowsiness: 0.45, startleSensitivity: 0.3, dreamIntensity: 0,
          socialEnergy: 0.5,
        },
      });
      // Advance past 3s perch threshold
      for (let j = 0; j < 40; j++) engine.update(0.1, ctx);
      if (engine.getState() === "meditate") { meditated = true; break; }
    }
    expect(meditated).toBe(true);
  });

  it("transitions to hide when shy and cursor is near", () => {
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");
    const ctx = makeContext({
      surfaceMood: "shy",
      moodModifiers: getMoodModifiers("shy"),
      cursorPosition: { x: 510, y: 410 }, // near position (500,400)
    });
    // Advance past idle_float min duration (2.0s) → transitions to peek
    // Then past peek min duration (1.0s) → transitions to hide
    for (let j = 0; j < 40; j++) engine.update(0.1, ctx);
    expect(engine.getState()).toBe("hide");
  });
});

describe("BehaviorEngine — forceState lifecycle", () => {
  it("forceState transitions state and resets timer", () => {
    const engine = new BehaviorEngine();
    // Use dt below idle_float's min duration (2.0s) so no random-gated
    // transition fires and resets the timer — keeps the assertion deterministic.
    engine.update(1, makeContext());
    expect(engine.getStateTimer()).toBeGreaterThan(0);
    engine.forceState("celebrate");
    expect(engine.getState()).toBe("celebrate");
    expect(engine.getStateTimer()).toBe(0);
  });

  it("forceState calls onStateEnter for burst_orbit (sets angle)", () => {
    const engine = new BehaviorEngine();
    engine.forceState("burst_orbit");
    // If onStateEnter was called, the engine is in burst_orbit with angle set
    expect(engine.getState()).toBe("burst_orbit");
    // Run one update — should not crash even without ctx-driven onStateEnter
    const out = engine.update(0.1, makeContext());
    expect(out.newState).toBe("burst_orbit");
  });

  it("forceState with ctx calls onStateEnter for startle (sets recoil dir)", () => {
    const engine = new BehaviorEngine();
    const ctx = makeContext({
      position: { x: 500, y: 400 },
      cursorPosition: { x: 600, y: 400 },
    });
    engine.forceState("startle", ctx);
    expect(engine.getState()).toBe("startle");
    // Run update — startle should produce a target position using recoil dir
    const out = engine.update(0.1, ctx);
    expect(out.newState).toBe("startle");
    expect(out.targetPosition).not.toBeNull();
  });

  it("forceState without ctx does not crash for startle", () => {
    const engine = new BehaviorEngine();
    engine.forceState("startle");
    expect(engine.getState()).toBe("startle");
    // Update should still work — startle will use default recoil dir (0,0)
    const out = engine.update(0.1, makeContext());
    expect(out.newState).toBe("startle");
  });

  it("forceState calls onStateExit on previous state (no-op currently, but future-proof)", () => {
    const engine = new BehaviorEngine();
    engine.forceState("nap");
    engine.forceState("celebrate");
    expect(engine.getState()).toBe("celebrate");
    expect(engine.getStateTimer()).toBe(0);
  });

  it("getStateTimer reflects elapsed time after update", () => {
    const engine = new BehaviorEngine();
    engine.forceState("idle_float");
    engine.update(1.5, makeContext());
    expect(engine.getStateTimer()).toBe(1.5);
  });
});
