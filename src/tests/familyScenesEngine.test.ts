// ============================================================
// Family Scenes Engine Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  FamilyScenesEngine,
  SCENE_DEFS,
  createDefaultFamilyScenesState,
  type SceneType,
} from "@/engine/familyScenesEngine";
import type { EntityId, Vec2 } from "@/store/types";

describe("FamilyScenesEngine", () => {
  let engine: FamilyScenesEngine;

  beforeEach(() => {
    engine = new FamilyScenesEngine();
  });

  it("has 7 scene definitions", () => {
    expect(SCENE_DEFS).toHaveLength(7);
  });

  it("starts with no active scene", () => {
    const state = engine.getState();
    expect(state.activeScene).toBeNull();
  });

  it("starts with initial cooldown", () => {
    expect(engine.getState().sceneCooldown).toBeGreaterThan(0);
  });

  it("does not trigger scene with fewer than 2 entities", () => {
    const positions = new Map<EntityId, Vec2>([["e1", { x: 100, y: 100 }]]);
    engine.update(31, ["e1"], positions, Date.now());
    expect(engine.getState().activeScene).toBeNull();
  });

  it("triggers a scene when cooldown expires with 2+ entities", () => {
    const positions = new Map<EntityId, Vec2>([
      ["e1", { x: 100, y: 100 }],
      ["e2", { x: 150, y: 120 }],
    ]);
    // Burn through cooldown
    for (let i = 0; i < 35; i++) {
      engine.update(1, ["e1", "e2"], positions, Date.now());
    }
    // May or may not trigger (random), but cooldown should be 0 or scene active
    const state = engine.getState();
    expect(state.sceneCooldown <= 0 || state.activeScene !== null).toBe(true);
  });

  it("forceScene sets an active scene", () => {
    engine.forceScene("cuddle_pile", ["e1", "e2"], 1000);
    const state = engine.getState();
    expect(state.activeScene).not.toBeNull();
    expect(state.activeScene!.type).toBe("cuddle_pile");
    expect(state.activeScene!.participants).toHaveLength(2);
  });

  it("getEntityBehavior returns behavior for role", () => {
    engine.forceScene("cuddle_pile", ["e1", "e2"], 1000);
    expect(engine.getEntityBehavior("e1")).toBe("nap");
    expect(engine.getEntityBehavior("e2")).toBe("nap");
  });

  it("getEntityBehavior returns null for unknown entity", () => {
    engine.forceScene("chase", ["e1", "e2"], 1000);
    expect(engine.getEntityBehavior("e3")).toBeNull();
  });

  it("getEntityBehavior returns null when no scene active", () => {
    expect(engine.getEntityBehavior("e1")).toBeNull();
  });

  it("getMoodBias returns bias from active scene", () => {
    engine.forceScene("cuddle_pile", ["e1", "e2"], 1000);
    const bias = engine.getMoodBias();
    expect(bias.calm).toBeGreaterThan(0);
  });

  it("getMoodBias returns empty when no scene", () => {
    expect(engine.getMoodBias()).toEqual({});
  });

  it("scene ends after duration", () => {
    const start = Date.now();
    engine.forceScene("chase", ["e1", "e2"], start);
    // Chase duration is 20 seconds
    engine.update(0, ["e1", "e2"], new Map(), start + 21000);
    expect(engine.getState().activeScene).toBeNull();
  });

  it("ended scene is added to history", () => {
    const start = Date.now();
    engine.forceScene("chase", ["e1", "e2"], start);
    engine.update(0, ["e1", "e2"], new Map(), start + 21000);
    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe("chase");
  });

  it("reset clears all state", () => {
    engine.forceScene("cuddle_pile", ["e1", "e2"], 1000);
    engine.reset();
    expect(engine.getState().activeScene).toBeNull();
    expect(engine.getHistory()).toHaveLength(0);
  });

  it("createDefaultFamilyScenesState returns valid state", () => {
    const state = createDefaultFamilyScenesState();
    expect(state.activeScene).toBeNull();
    expect(state.sceneCooldown).toBeGreaterThan(0);
    expect(state.sceneHistory).toEqual([]);
  });

  it("does not trigger scene when entities are too far apart", () => {
    const positions = new Map<EntityId, Vec2>([
      ["e1", { x: 0, y: 0 }],
      ["e2", { x: 1000, y: 1000 }],
    ]);
    // Burn through cooldown
    for (let i = 0; i < 35; i++) {
      engine.update(1, ["e1", "e2"], positions, Date.now());
    }
    // Should not trigger due to distance > 400
    expect(engine.getState().activeScene).toBeNull();
  });
});

describe("FamilyScenesEngine — Relation-weighted scene selection", () => {
  it("accepts relations parameter without breaking backward compatibility", () => {
    const engine = new FamilyScenesEngine();
    const positions = new Map<EntityId, Vec2>([
      ["e1", { x: 100, y: 100 }],
      ["e2", { x: 150, y: 120 }],
    ]);
    // Burn through cooldown without relations
    for (let i = 0; i < 35; i++) {
      engine.update(1, ["e1", "e2"], positions, Date.now());
    }
    const state = engine.getState();
    expect(state.sceneCooldown <= 0 || state.activeScene !== null).toBe(true);
  });

  it("rival relations bias toward chase/play_fight scenes", () => {
    const rivalScenes = new Set<SceneType>(["chase", "play_fight"]);
    let rivalCount = 0;
    let noRelCount = 0;
    const positions = new Map<EntityId, Vec2>([
      ["e1", { x: 100, y: 100 }],
      ["e2", { x: 150, y: 120 }],
    ]);
    const relations = [{ entityA: "e1", entityB: "e2", type: "rival" as any, strength: 0.9 }];

    for (let i = 0; i < 200; i++) {
      // With rival relations
      const e1 = new FamilyScenesEngine();
      for (let j = 0; j < 35; j++) e1.update(1, ["e1", "e2"], positions, Date.now(), relations);
      const s1 = e1.getState();
      if (s1.activeScene && rivalScenes.has(s1.activeScene.type)) rivalCount++;

      // Without relations
      const e2 = new FamilyScenesEngine();
      for (let j = 0; j < 35; j++) e2.update(1, ["e1", "e2"], positions, Date.now());
      const s2 = e2.getState();
      if (s2.activeScene && rivalScenes.has(s2.activeScene.type)) noRelCount++;
    }
    // Rivals should produce more chase/play_fight than baseline
    expect(rivalCount).toBeGreaterThan(noRelCount);
  });

  it("friend relations bias toward cuddle/grooming/group_nap scenes", () => {
    const friendScenes = new Set<SceneType>(["cuddle_pile", "grooming", "group_nap"]);
    let friendCount = 0;
    let noRelCount = 0;
    const positions = new Map<EntityId, Vec2>([
      ["e1", { x: 100, y: 100 }],
      ["e2", { x: 150, y: 120 }],
    ]);
    const relations = [{ entityA: "e1", entityB: "e2", type: "friend" as any, strength: 0.9 }];

    for (let i = 0; i < 200; i++) {
      // With friend relations
      const e1 = new FamilyScenesEngine();
      for (let j = 0; j < 35; j++) e1.update(1, ["e1", "e2"], positions, Date.now(), relations);
      const s1 = e1.getState();
      if (s1.activeScene && friendScenes.has(s1.activeScene.type)) friendCount++;

      // Without relations
      const e2 = new FamilyScenesEngine();
      for (let j = 0; j < 35; j++) e2.update(1, ["e1", "e2"], positions, Date.now());
      const s2 = e2.getState();
      if (s2.activeScene && friendScenes.has(s2.activeScene.type)) noRelCount++;
    }
    // Friends should produce more cuddle/grooming/group_nap than baseline
    expect(friendCount).toBeGreaterThan(noRelCount);
  });
});
