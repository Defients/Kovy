// ============================================================
// Toy Engine tests — v9.0 Toys v2
// Verifies D3 (no config mutation), D4 (behavior wiring + consumed
// toys exposed), and D5 (drag support).
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { ToyEngine, TOY_DEFINITIONS } from "@/engine/toyEngine";
import type { ToyConfig, ToyType, PlacedToy, SurfaceMood } from "@/store/types";

const baseConfig: ToyConfig = {
  enabled: true,
  placedToys: [],
  respawnTreatsMin: 10,
  laserFollowsCursor: false,
  siblingsPlay: true,
  maxToys: 30,
};

describe("ToyEngine — v9.0 Toys v2", () => {
  let engine: ToyEngine;

  beforeEach(() => {
    engine = new ToyEngine();
    engine.updateConfig({ ...baseConfig, placedToys: [] });
  });

  describe("D3: physics does not mutate config toys", () => {
    it("maintains separate physics positions", () => {
      const toy = engine.addToy("ball", { x: 100, y: 100 });
      expect(toy).not.toBeNull();
      if (!toy) return;

      // Update config to get the toy into the config
      const config = engine["config"];
      expect(config.placedToys[0].position.x).toBe(100);
      expect(config.placedToys[0].position.y).toBe(100);

      // Run physics for a few frames
      engine.updatePhysics(0.016, { width: 1920, height: 1080 }, { x: 500, y: 500 });

      // The config toy position should NOT have changed
      expect(config.placedToys[0].position.x).toBe(100);
      expect(config.placedToys[0].position.y).toBe(100);

      // But getToys() should return the physics-applied position
      const toys = engine.getToys();
      expect(toys[0].position.x).not.toBe(100); // should have moved due to initial velocity
    });

    it("getToys returns physics positions for physics toys", () => {
      engine.addToy("ball", { x: 500, y: 500 });
      engine.updatePhysics(0.1, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      const toys = engine.getToys();
      // Ball should have moved from its initial position due to gravity + initial velocity
      expect(toys[0].position.x).not.toBe(500);
      expect(toys[0].position.y).not.toBe(500);
    });

    it("getToys returns original positions for non-physics toys", () => {
      engine.addToy("bed", { x: 200, y: 200 });
      engine.updatePhysics(0.1, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      const toys = engine.getToys();
      expect(toys[0].position.x).toBe(200);
      expect(toys[0].position.y).toBe(200);
    });
  });

  describe("D4: behavior wiring and consumed toys", () => {
    it("getDominantBehaviorState returns mapped behavior for nearby toy", () => {
      engine.addToy("music_box", { x: 100, y: 100 });
      const behavior = engine.getDominantBehaviorState({ x: 100, y: 100 }, "calm" as SurfaceMood);
      expect(behavior).toBe("dance");
    });

    it("getDominantBehaviorState returns null when no toy nearby", () => {
      engine.addToy("bed", { x: 100, y: 100 });
      const behavior = engine.getDominantBehaviorState({ x: 2000, y: 2000 }, "calm" as SurfaceMood);
      expect(behavior).toBeNull();
    });

    it("getDominantBehaviorState maps hunt to chase", () => {
      engine.addToy("laser", { x: 100, y: 100 });
      const behavior = engine.getDominantBehaviorState({ x: 100, y: 100 }, "calm" as SurfaceMood);
      expect(behavior).toBe("chase");
    });

    it("getDominantBehaviorState maps sleep_near_toy to nap", () => {
      engine.addToy("bed", { x: 100, y: 100 });
      const behavior = engine.getDominantBehaviorState({ x: 100, y: 100 }, "calm" as SurfaceMood);
      expect(behavior).toBe("nap");
    });

    it("getConsumedToys returns consumed set after eating", () => {
      engine.addToy("treat", { x: 100, y: 100 });
      // Trigger eat by getting influences at the treat position
      engine.getInfluences({ x: 100, y: 100 }, "calm" as SurfaceMood);
      const consumed = engine.getConsumedToys();
      expect(consumed.size).toBe(1);
    });

    it("getToys excludes consumed toys", () => {
      const treat = engine.addToy("treat", { x: 100, y: 100 });
      engine.getInfluences({ x: 100, y: 100 }, "calm" as SurfaceMood);
      const toys = engine.getToys();
      expect(toys.find(t => t.id === treat!.id)).toBeUndefined();
    });

    it("getDominantBehaviorState maps eat to celebrate", () => {
      engine.addToy("treat", { x: 100, y: 100 });
      const behavior = engine.getDominantBehaviorState({ x: 100, y: 100 }, "calm" as SurfaceMood);
      expect(behavior).toBe("celebrate");
    });
  });

  describe("D5: drag support", () => {
    it("hitTest finds toy at position", () => {
      engine.addToy("bed", { x: 200, y: 200 });
      const id = engine.hitTest({ x: 205, y: 205 });
      expect(id).not.toBeNull();
    });

    it("hitTest returns null when no toy at position", () => {
      engine.addToy("bed", { x: 200, y: 200 });
      const id = engine.hitTest({ x: 500, y: 500 });
      expect(id).toBeNull();
    });

    it("hitTest uses physics position for physics toys", () => {
      engine.addToy("ball", { x: 500, y: 500 });
      engine.updatePhysics(0.1, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      const toys = engine.getToys();
      const id = engine.hitTest(toys[0].position);
      expect(id).not.toBeNull();
    });

    it("dragToy updates non-physics toy position", () => {
      const toy = engine.addToy("bed", { x: 200, y: 200 });
      engine.dragToy(toy!.id, { x: 400, y: 300 });
      const toys = engine.getToys();
      expect(toys[0].position.x).toBe(400);
      expect(toys[0].position.y).toBe(300);
    });

    it("dragToy updates physics toy position", () => {
      const toy = engine.addToy("ball", { x: 500, y: 500 });
      engine.dragToy(toy!.id, { x: 300, y: 300 });
      const toys = engine.getToys();
      expect(toys[0].position.x).toBe(300);
      expect(toys[0].position.y).toBe(300);
    });

    it("dragToy damps velocity for physics toys", () => {
      const toy = engine.addToy("ball", { x: 500, y: 500 });
      // Run physics to build up velocity
      engine.updatePhysics(0.1, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      // Drag should damp velocity
      engine.dragToy(toy!.id, { x: 300, y: 300 });
      // After drag, velocity should be reduced (we can't check exact value
      // but we can verify the toy doesn't fly away immediately)
      engine.updatePhysics(0.016, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      const toys = engine.getToys();
      // Position should be close to 300, not far away
      expect(Math.abs(toys[0].position.x - 300)).toBeLessThan(50);
      expect(Math.abs(toys[0].position.y - 300)).toBeLessThan(50);
    });
  });

  describe("basic toy engine functionality", () => {
    it("addToy respects maxToys limit", () => {
      engine.updateConfig({ ...baseConfig, placedToys: [], maxToys: 2 });
      engine.addToy("ball", { x: 100, y: 100 });
      engine.addToy("ball", { x: 200, y: 200 });
      const result = engine.addToy("ball", { x: 300, y: 300 });
      expect(result).toBeNull();
    });

    it("addToy returns null when disabled", () => {
      engine.updateConfig({ ...baseConfig, placedToys: [], enabled: false });
      const result = engine.addToy("ball", { x: 100, y: 100 });
      expect(result).toBeNull();
    });

    it("removeToy removes the toy", () => {
      const toy = engine.addToy("ball", { x: 100, y: 100 });
      engine.removeToy(toy!.id);
      expect(engine.getToys()).toHaveLength(0);
    });

    it("clearAllToys removes everything", () => {
      engine.addToy("ball", { x: 100, y: 100 });
      engine.addToy("bed", { x: 200, y: 200 });
      engine.clearAllToys();
      expect(engine.getToys()).toHaveLength(0);
    });

    it("getAttractionTarget returns laser target when laser exists", () => {
      engine.addToy("laser", { x: 100, y: 100 });
      // Laser target updates every 2 seconds — run enough physics time
      engine.updatePhysics(2.1, { width: 1920, height: 1080 }, { x: 0, y: 0 });
      const target = engine.getAttractionTarget({ x: 500, y: 500 });
      expect(target).not.toBeNull();
    });

    it("getAttractionTarget returns nearest toy", () => {
      engine.addToy("ball", { x: 300, y: 300 });
      const target = engine.getAttractionTarget({ x: 200, y: 200 });
      expect(target).not.toBeNull();
    });

    it("getMoodDeltas aggregates from multiple toys", () => {
      engine.addToy("ball", { x: 100, y: 100 });
      engine.addToy("music_box", { x: 110, y: 110 });
      const deltas = engine.getMoodDeltas({ x: 100, y: 100 }, "calm" as SurfaceMood);
      expect(deltas.excited).toBeGreaterThan(0);
      expect(deltas.playful).toBeGreaterThan(0);
    });

    it("TOY_DEFINITIONS has all toy types", () => {
      const types: ToyType[] = ["ball", "balloon", "block", "bed", "laser", "treat", "mouse", "music_box", "mirror"];
      for (const type of types) {
        expect(TOY_DEFINITIONS[type]).toBeDefined();
        expect(TOY_DEFINITIONS[type].label).toBeDefined();
        expect(TOY_DEFINITIONS[type].icon).toBeDefined();
      }
    });
  });
});
