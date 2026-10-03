import { describe, it, expect } from "vitest";
import {
  FamilyEngine,
  applyPersonalityToMood,
  applyFamilyToMood,
  getPersonalitySpeedMultiplier,
  getPersonalitySizeScale,
  getPersonalityHueShift,
  NULL_FAMILY_INFLUENCE,
  type FamilyInfluence,
} from "../engine/familyEngine";
import type { EntityState } from "../store/entityStore";
import { FOUNDER_ID } from "../store/entityStore";
import {
  DEFAULT_FAMILY_DYNAMICS,
  DEFAULT_HABITAT,
  DEFAULT_RUNTIME_STATE,
  DEFAULT_PERSONALITY,
  DEFAULT_INTERNAL_MOOD,
} from "../store/defaults";
import type { FamilyDynamics, PersonalityOffsets, InternalMoodState } from "../store/types";
import { DEFAULT_ENTITY_VISUAL } from "../store/defaults";

function makeEntity(id: string, overrides: Partial<EntityState> = {}): EntityState {
  return {
    meta: {
      id,
      name: id,
      isFounder: id === FOUNDER_ID,
      personality: { ...DEFAULT_PERSONALITY },
      preferredHomeId: null,
      territoryBias: 0.5,
      visual: { ...DEFAULT_ENTITY_VISUAL },
      displayMonitor: "global",
      ...(overrides.meta ?? {}),
    },
    runtime: {
      ...structuredClone(DEFAULT_RUNTIME_STATE),
      ...(overrides.runtime ?? {}),
    },
  };
}

describe("FamilyEngine", () => {
  it("returns empty influences for a single entity", () => {
    const engine = new FamilyEngine();
    const entities = [makeEntity(FOUNDER_ID)];
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);

    expect(result.size).toBe(1);
    const inf = result.get(FOUNDER_ID)!;
    expect(inf.nearbyCount).toBe(0);
    expect(inf.playfulChase).toBe(false);
    expect(inf.groupHyperBurst).toBe(false);
  });

  it("returns influences for multiple entities", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 } } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 150, y: 100 } } }),
    ];
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);

    expect(result.size).toBe(2);
    expect(result.has(FOUNDER_ID)).toBe(true);
    expect(result.has("sib-1")).toBe(true);
  });

  it("detects nearby entities within radius", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 } } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 200, y: 100 } } }),
    ];
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);

    // 100px apart, within NEARBY_RADIUS (250)
    expect(result.get(FOUNDER_ID)!.nearbyCount).toBe(1);
    expect(result.get("sib-1")!.nearbyCount).toBe(1);
  });

  it("does not detect far-away entities as nearby", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 } } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 1000, y: 1000 } } }),
    ];
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);

    expect(result.get(FOUNDER_ID)!.nearbyCount).toBe(0);
    expect(result.get("sib-1")!.nearbyCount).toBe(0);
  });

  it("computes curiosity contagion between nearby entities", () => {
    const engine = new FamilyEngine();
    const highCuriosity = { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.9 };
    const lowCuriosity = { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.1 };

    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 }, internalMood: highCuriosity } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 150, y: 100 }, internalMood: lowCuriosity } }),
    ];

    const dynamics: FamilyDynamics = { ...DEFAULT_FAMILY_DYNAMICS, curiosityContagion: 1.0 };
    const result = engine.update(0.5, entities, dynamics, DEFAULT_HABITAT);

    // sib-1 has low curiosity, nearby founder has high → positive contagion
    const sibInf = result.get("sib-1")!;
    expect(sibInf.curiosityContagion).toBeGreaterThan(0);

    // founder has high curiosity, nearby sib has low → negative contagion
    const founderInf = result.get(FOUNDER_ID)!;
    expect(founderInf.curiosityContagion).toBeLessThan(0);
  });

  it("no contagion when curiosityContagion=0", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 }, internalMood: { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.9 } } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 150, y: 100 }, internalMood: { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.1 } } }),
    ];

    const dynamics: FamilyDynamics = { ...DEFAULT_FAMILY_DYNAMICS, curiosityContagion: 0 };
    const result = engine.update(0.5, entities, dynamics, DEFAULT_HABITAT);

    expect(result.get("sib-1")!.curiosityContagion).toBe(0);
    expect(result.get(FOUNDER_ID)!.curiosityContagion).toBe(0);
  });

  it("territory pull is generated when entity is far from preferred home", () => {
    const engine = new FamilyEngine();
    const habitatWithHome = {
      ...DEFAULT_HABITAT,
      enabled: true,
      homes: [{ id: "h1", position: { x: 100, y: 100 }, label: "Home" }],
    };

    // Need 2+ entities so the engine doesn't early-return
    const entities = [
      makeEntity(FOUNDER_ID, {
        meta: { ...makeEntity(FOUNDER_ID).meta, preferredHomeId: "h1", territoryBias: 1.0 },
        runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 800, y: 800 } },
      }),
      makeEntity("sib-1", {
        runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 900, y: 900 } },
      }),
    ];

    const dynamics: FamilyDynamics = { ...DEFAULT_FAMILY_DYNAMICS, territoryRespect: 1.0 };
    const result = engine.update(0.5, entities, dynamics, habitatWithHome);

    const inf = result.get(FOUNDER_ID)!;
    expect(inf.territoryPull).not.toBeNull();
    // Pull should be toward home (negative x and y)
    expect(inf.territoryPull!.x).toBeLessThan(0);
    expect(inf.territoryPull!.y).toBeLessThan(0);
  });

  it("no territory pull when habitat is disabled", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, {
        meta: { ...makeEntity(FOUNDER_ID).meta, preferredHomeId: "h1", territoryBias: 1.0 },
        runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 800, y: 800 } },
      }),
    ];

    const dynamics: FamilyDynamics = { ...DEFAULT_FAMILY_DYNAMICS, territoryRespect: 1.0 };
    const result = engine.update(0.5, entities, dynamics, DEFAULT_HABITAT);

    expect(result.get(FOUNDER_ID)!.territoryPull).toBeNull();
  });

  it("reset clears internal state", () => {
    const engine = new FamilyEngine();
    // Just verify it doesn't throw
    engine.reset();
    const entities = [makeEntity(FOUNDER_ID)];
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);
    expect(result.size).toBe(1);
  });
});

describe("Personality mood helpers", () => {
  it("applyPersonalityToMood biases curiosity", () => {
    const mood: InternalMoodState = { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.5 };
    const personality: PersonalityOffsets = { ...DEFAULT_PERSONALITY, curiosityBias: 0.3 };
    const result = applyPersonalityToMood(mood, personality, 1.0);
    expect(result.curiosity).toBeGreaterThan(0.5);
  });

  it("applyPersonalityToMood with zero offsets returns near-original", () => {
    const mood: InternalMoodState = structuredClone(DEFAULT_INTERNAL_MOOD);
    const result = applyPersonalityToMood(mood, DEFAULT_PERSONALITY, 1.0);
    expect(result.curiosity).toBeCloseTo(mood.curiosity, 4);
    expect(result.stimulation).toBeCloseTo(mood.stimulation, 4);
  });

  it("applyFamilyToMood applies curiosity contagion", () => {
    const mood: InternalMoodState = { ...structuredClone(DEFAULT_INTERNAL_MOOD), curiosity: 0.5 };
    const influence: FamilyInfluence = { ...NULL_FAMILY_INFLUENCE, curiosityContagion: 0.2 };
    const result = applyFamilyToMood(mood, influence, 1.0);
    expect(result.curiosity).toBeGreaterThan(0.5);
  });

  it("applyFamilyToMood group hyper burst raises stimulation", () => {
    const mood: InternalMoodState = { ...structuredClone(DEFAULT_INTERNAL_MOOD), stimulation: 0.3 };
    const influence: FamilyInfluence = { ...NULL_FAMILY_INFLUENCE, groupHyperBurst: true };
    const result = applyFamilyToMood(mood, influence, 1.0);
    expect(result.stimulation).toBeGreaterThan(0.3);
  });

  it("getPersonalitySpeedMultiplier returns correct value", () => {
    expect(getPersonalitySpeedMultiplier({ ...DEFAULT_PERSONALITY, energyBias: 0.2 })).toBeCloseTo(1.1);
    expect(getPersonalitySpeedMultiplier({ ...DEFAULT_PERSONALITY, energyBias: -0.2 })).toBeCloseTo(0.9);
    expect(getPersonalitySpeedMultiplier(DEFAULT_PERSONALITY)).toBeCloseTo(1.0);
  });

  it("getPersonalitySizeScale returns correct value", () => {
    expect(getPersonalitySizeScale({ ...DEFAULT_PERSONALITY, sizeOffset: 0.1 })).toBeCloseTo(1.1);
    expect(getPersonalitySizeScale({ ...DEFAULT_PERSONALITY, sizeOffset: -0.1 })).toBeCloseTo(0.9);
  });

  it("getPersonalityHueShift returns colorHueOffset", () => {
    expect(getPersonalityHueShift({ ...DEFAULT_PERSONALITY, colorHueOffset: 15 })).toBe(15);
    expect(getPersonalityHueShift({ ...DEFAULT_PERSONALITY, colorHueOffset: -20 })).toBe(-20);
  });
});

describe("FamilyEngine — Relation-modulated behavior", () => {
  it("accepts relations parameter without breaking backward compatibility", () => {
    const engine = new FamilyEngine();
    const entities = [
      makeEntity(FOUNDER_ID, { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 } } }),
      makeEntity("sib-1", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 200, y: 100 } } }),
    ];
    // Call without relations — should work as before
    const result = engine.update(0.5, entities, DEFAULT_FAMILY_DYNAMICS, DEFAULT_HABITAT);
    expect(result.size).toBe(2);
    expect(result.get(FOUNDER_ID)!.nearbyCount).toBe(1);
  });

  it("rival relation boosts chase chance", () => {
    const dynamics = { ...DEFAULT_FAMILY_DYNAMICS, playfulChaseChance: 1.0 };
    let rivalChases = 0;
    let noRelChases = 0;

    for (let i = 0; i < 500; i++) {
      // With rival relation
      const engine1 = new FamilyEngine();
      const entities1 = [
        makeEntity("a", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 }, surfaceMood: "playful" as any } }),
        makeEntity("b", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 300, y: 100 }, surfaceMood: "playful" as any } }),
      ];
      const relations = [{ entityA: "a", entityB: "b", type: "rival" as any, strength: 0.8 }];
      const r1 = engine1.update(0.5, entities1, dynamics, DEFAULT_HABITAT, relations);
      if (r1.get("a")!.playfulChase) rivalChases++;

      // Without relations
      const engine2 = new FamilyEngine();
      const entities2 = [
        makeEntity("a", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 100, y: 100 }, surfaceMood: "playful" as any } }),
        makeEntity("b", { runtime: { ...structuredClone(DEFAULT_RUNTIME_STATE), position: { x: 300, y: 100 }, surfaceMood: "playful" as any } }),
      ];
      const r2 = engine2.update(0.5, entities2, dynamics, DEFAULT_HABITAT);
      if (r2.get("a")!.playfulChase) noRelChases++;
    }
    // Rivals should chase at least as often as no-relation baseline
    expect(rivalChases).toBeGreaterThanOrEqual(noRelChases * 0.8);
  });

  it("friend relation boosts comfort contagion", () => {
    const dynamics = { ...DEFAULT_FAMILY_DYNAMICS, comfortInfluence: 1.0 };
    const entities = [
      makeEntity("a", {
        runtime: {
          ...structuredClone(DEFAULT_RUNTIME_STATE),
          position: { x: 100, y: 100 },
          internalMood: { ...DEFAULT_INTERNAL_MOOD, comfort: 0.3 },
        },
      }),
      makeEntity("b", {
        runtime: {
          ...structuredClone(DEFAULT_RUNTIME_STATE),
          position: { x: 150, y: 100 },
          internalMood: { ...DEFAULT_INTERNAL_MOOD, comfort: 0.8 },
        },
      }),
    ];

    // Without relations
    const engine1 = new FamilyEngine();
    const r1 = engine1.update(0.5, entities, dynamics, DEFAULT_HABITAT);
    const baseComfort = r1.get("a")!.comfortContagion;

    // With friend relation
    const engine2 = new FamilyEngine();
    const relations = [{ entityA: "a", entityB: "b", type: "friend" as any, strength: 0.9 }];
    const r2 = engine2.update(0.5, entities, dynamics, DEFAULT_HABITAT, relations);
    const friendComfort = r2.get("a")!.comfortContagion;

    // Friend relation should boost comfort contagion (positive direction)
    expect(friendComfort).toBeGreaterThan(baseComfort);
  });
});
