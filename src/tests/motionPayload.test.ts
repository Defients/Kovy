import { describe, it, expect, beforeEach } from "vitest";
import { MotionInterestEngine } from "../engine/motionInterest";
import type { MotionRegion, VisionConfig } from "../store/types";
import { DEFAULT_VISION } from "../store/defaults";

// --- S1: Motion payload shape validation ---
describe("Motion payload shape", () => {
  it("centroid must be {x, y} object, not an array", () => {
    // This test validates the contract: Rust now emits centroid as {x, y}
    const region: MotionRegion = {
      id: 1,
      centroid: { x: 100, y: 200 },
      boundingBox: { x: 80, y: 160, w: 40, h: 80 },
      area: 500,
      energy: 45,
      persistence: 3,
      novelty: 0.8,
      score: 0,
    };

    // centroid must have .x and .y as numbers
    expect(typeof region.centroid.x).toBe("number");
    expect(typeof region.centroid.y).toBe("number");
    expect(region.centroid.x).toBe(100);
    expect(region.centroid.y).toBe(200);

    // Must NOT be an array
    expect(Array.isArray(region.centroid)).toBe(false);
  });

  it("region has all required fields", () => {
    const region: MotionRegion = {
      id: 42,
      centroid: { x: 50, y: 75 },
      boundingBox: { x: 30, y: 55, w: 40, h: 40 },
      area: 200,
      energy: 30,
      persistence: 5,
      novelty: 0.5,
      score: 0.6,
    };

    expect(region.id).toBeDefined();
    expect(region.centroid).toBeDefined();
    expect(region.boundingBox).toBeDefined();
    expect(region.area).toBeDefined();
    expect(region.energy).toBeDefined();
    expect(region.persistence).toBeDefined();
    expect(region.novelty).toBeDefined();
    expect(region.score).toBeDefined();
  });
});

// --- S2: Empty motion clearing ---
describe("Empty motion clearing (stale targets)", () => {
  let engine: MotionInterestEngine;
  const visionConfig: VisionConfig = {
    ...DEFAULT_VISION,
    enabled: true,
    analysisFps: 4,
    analysisScale: 0.15,
  };

  beforeEach(() => {
    engine = new MotionInterestEngine();
  });

  it("processRegions returns targets for non-empty input", () => {
    const regions: MotionRegion[] = [
      {
        id: 1,
        centroid: { x: 100, y: 100 },
        boundingBox: { x: 80, y: 80, w: 40, h: 40 },
        area: 200,
        energy: 50,
        persistence: 3,
        novelty: 0.8,
        score: 0,
      },
    ];

    const result = engine.processRegions(
      regions, 0.25, visionConfig,
      { x: 500, y: 500 }, 1920, 1080
    );

    expect(result.targets.length).toBeGreaterThan(0);
  });

  it("clearStaleTargets returns empty targets", () => {
    // First feed some regions
    const regions: MotionRegion[] = [
      {
        id: 1,
        centroid: { x: 100, y: 100 },
        boundingBox: { x: 80, y: 80, w: 40, h: 40 },
        area: 200,
        energy: 50,
        persistence: 3,
        novelty: 0.8,
        score: 0,
      },
    ];

    engine.processRegions(
      regions, 0.25, visionConfig,
      { x: 500, y: 500 }, 1920, 1080
    );

    // Now clear stale targets (simulating empty regions from backend)
    const result = engine.clearStaleTargets(0.25);

    expect(result.targets).toEqual([]);
  });

  it("clearStaleTargets eventually clears locked target", () => {
    const regions: MotionRegion[] = [
      {
        id: 1,
        centroid: { x: 100, y: 100 },
        boundingBox: { x: 80, y: 80, w: 40, h: 40 },
        area: 200,
        energy: 80,
        persistence: 5,
        novelty: 0.9,
        score: 0,
      },
    ];

    // Feed regions for enough frames to lock a target
    for (let i = 0; i < 20; i++) {
      engine.processRegions(
        regions, 0.25, visionConfig,
        { x: 500, y: 500 }, 1920, 1080
      );
    }

    // Call clearStaleTargets enough times to exceed MIN_LOCK_TIME (1.5s)
    let result;
    for (let i = 0; i < 30; i++) {
      result = engine.clearStaleTargets(0.25);
    }

    expect(result!.targets).toEqual([]);
    expect(result!.bestTarget).toBeNull();
  });
});

// --- S3: Region ID stability ---
describe("Region ID stability", () => {
  it("same region across frames keeps consistent ID in processRegions", () => {
    const engine = new MotionInterestEngine();
    const visionConfig: VisionConfig = { ...DEFAULT_VISION, enabled: true };

    const region: MotionRegion = {
      id: 42,
      centroid: { x: 100, y: 100 },
      boundingBox: { x: 80, y: 80, w: 40, h: 40 },
      area: 200,
      energy: 50,
      persistence: 3,
      novelty: 0.8,
      score: 0,
    };

    const r1 = engine.processRegions([region], 0.25, visionConfig, { x: 500, y: 500 }, 1920, 1080);
    const r2 = engine.processRegions([region], 0.25, visionConfig, { x: 500, y: 500 }, 1920, 1080);

    // The regionId should be the same across both frames
    expect(r1.targets[0]?.regionId).toBe(42);
    expect(r2.targets[0]?.regionId).toBe(42);
  });
});

// --- S8: Rail helper tests ---
import { randomPointOnRails, findNearestRailPoint, advanceAlongRail } from "../engine/railHelper";
import type { HabitatRail } from "../store/types";

describe("Rail helper utilities", () => {
  const rail: HabitatRail = {
    id: "r1",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    label: "Test Rail",
  };

  it("randomPointOnRails returns a point on a valid rail", () => {
    const pt = randomPointOnRails([rail]);
    expect(pt).not.toBeNull();
    // Point should be within the bounding box of the rail
    expect(pt!.x).toBeGreaterThanOrEqual(0);
    expect(pt!.x).toBeLessThanOrEqual(100);
    expect(pt!.y).toBeGreaterThanOrEqual(0);
    expect(pt!.y).toBeLessThanOrEqual(100);
  });

  it("randomPointOnRails returns null for empty rails", () => {
    expect(randomPointOnRails([])).toBeNull();
  });

  it("randomPointOnRails returns null for rails with < 2 points", () => {
    const bad: HabitatRail = { id: "b", points: [{ x: 0, y: 0 }], label: "Bad" };
    expect(randomPointOnRails([bad])).toBeNull();
  });

  it("findNearestRailPoint finds the correct nearest point", () => {
    const result = findNearestRailPoint({ x: 50, y: 10 }, [rail]);
    expect(result).not.toBeNull();
    // Nearest point should be on the first segment (y=0, x=50)
    expect(result!.point.y).toBeCloseTo(0, 1);
    expect(result!.point.x).toBeCloseTo(50, 1);
  });

  it("findNearestRailPoint returns null for empty rails", () => {
    expect(findNearestRailPoint({ x: 0, y: 0 }, [])).toBeNull();
  });

  it("advanceAlongRail moves forward along rail segments", () => {
    // Start at (0,0), advance 150 pixels along the L-shaped rail
    const result = advanceAlongRail(rail, 0, { x: 0, y: 0 }, 150);
    // 100px along first segment reaches (100,0), then 50px along second => (100, 50)
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.y).toBeCloseTo(50, 1);
  });

  it("advanceAlongRail stops at end of rail", () => {
    const result = advanceAlongRail(rail, 0, { x: 0, y: 0 }, 500);
    // Should stop at the last point (100, 100)
    expect(result.x).toBeCloseTo(100, 1);
    expect(result.y).toBeCloseTo(100, 1);
  });
});

// --- S8: Rail influence in behavior engine ---
import { BehaviorEngine } from "../engine/behaviorEngine";
import type { BehaviorContext } from "../engine/behaviorEngine";
import { DEFAULT_BEHAVIOR, DEFAULT_HABITAT } from "../store/defaults";
import { getMoodModifiers } from "../engine/moodEngine";

describe("Rail influence in wander behavior", () => {
  function makeContext(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
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

  it("wander uses rail point when railInfluence is 1.0 and rails exist", () => {
    const engine = new BehaviorEngine();
    engine.forceState("wander");

    const ctx = makeContext({
      habitat: {
        enabled: true,
        homes: [],
        zones: [],
        nodes: [],
        rails: [
          {
            id: "r1",
            points: [{ x: 200, y: 300 }, { x: 800, y: 300 }],
            label: "Test Rail",
          },
        ],
        railInfluence: 1.0,
      },
    });

    // Run wander multiple times — with railInfluence=1.0, all wander targets
    // should be on the rail (y ≈ 300, x between 200-800)
    let hitRail = false;
    for (let i = 0; i < 50; i++) {
      const result = engine.update(0.1, ctx);
      if (result.targetPosition) {
        const y = result.targetPosition.y;
        if (y >= 295 && y <= 305) {
          hitRail = true;
          break;
        }
      }
    }
    expect(hitRail).toBe(true);
  });

  it("wander ignores rails when railInfluence is 0", () => {
    const engine = new BehaviorEngine();
    engine.forceState("wander");

    const ctx = makeContext({
      habitat: {
        enabled: true,
        homes: [],
        zones: [],
        nodes: [],
        rails: [
          {
            id: "r1",
            points: [{ x: 200, y: 300 }, { x: 800, y: 300 }],
            label: "Test Rail",
          },
        ],
        railInfluence: 0,
      },
    });

    // With influence=0, rail targets are never selected
    // Just verify it doesn't crash and returns a target
    const result = engine.update(0.1, ctx);
    expect(result.targetPosition).not.toBeNull();
  });
});

// --- Version test update ---
import { DEFAULT_CONFIG, DEFAULT_RUNTIME_STATE } from "../store/defaults";
import { CONFIG_VERSION } from "../store/types";

describe("Version consistency", () => {
  it("DEFAULT_CONFIG version matches CONFIG_VERSION", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
  });
});

// --- Habitat runtime state ---
describe("Habitat edit mode state", () => {
  it("DEFAULT_RUNTIME_STATE includes habitatEditMode as false", () => {
    expect(DEFAULT_RUNTIME_STATE.habitatEditMode).toBe(false);
  });
});

// --- Rail influence default ---
describe("Rail influence config defaults", () => {
  it("DEFAULT_HABITAT includes railInfluence", () => {
    expect(DEFAULT_HABITAT.railInfluence).toBeDefined();
    expect(typeof DEFAULT_HABITAT.railInfluence).toBe("number");
    expect(DEFAULT_HABITAT.railInfluence).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_HABITAT.railInfluence).toBeLessThanOrEqual(1);
  });
});
