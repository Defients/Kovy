// ============================================================
// Intent Engine tests — v9.0
// Verifies goal-driven behavior, intent switching, thought spawning,
// and state bias mapping.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { IntentEngine } from "@/engine/intentEngine";
import type { IntentConfig, IntentKind, SurfaceMood, BondLevel, Vec2 } from "@/store/types";

const baseConfig: IntentConfig = {
  enabled: true,
  changeRate: 0.5,
  showInDebug: true,
  thoughtChance: 1.0, // always spawn thoughts for testing
};

const baseInputs = {
  circadianPhase: "morning",
  bondLevel: "friend" as BondLevel,
  idleSeconds: 0,
  surfaceMood: "calm" as SurfaceMood,
  kovyPos: { x: 500, y: 500 } as Vec2,
  screenBounds: { width: 1920, height: 1080 },
  toyTarget: null as Vec2 | null,
  nestPosition: { x: 100, y: 100 } as Vec2 | null,
  dt: 0.016,
};

describe("IntentEngine — v9.0", () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine();
    engine.updateConfig({ ...baseConfig });
  });

  describe("basic functionality", () => {
    it("starts with null intent", () => {
      const out = engine.getOutput();
      expect(out.current).toBeNull();
      expect(out.targetPosition).toBeNull();
      expect(out.progress).toBe(0);
    });

    it("picks an intent on first update", () => {
      const out = engine.update(baseInputs);
      expect(out.current).not.toBeNull();
      expect(out.targetPosition).not.toBeNull();
      expect(out.stateBias).toBeDefined();
    });

    it("returns null output when disabled", () => {
      engine.updateConfig({ ...baseConfig, enabled: false });
      const out = engine.update(baseInputs);
      expect(out.current).toBeNull();
    });

    it("isEnabled returns config state", () => {
      expect(engine.isEnabled()).toBe(true);
      engine.updateConfig({ ...baseConfig, enabled: false });
      expect(engine.isEnabled()).toBe(false);
    });
  });

  describe("intent switching", () => {
    it("picks rest more often at night", () => {
      let restCount = 0;
      for (let i = 0; i < 100; i++) {
        const e = new IntentEngine();
        e.updateConfig({ ...baseConfig, thoughtChance: 0 });
        const out = e.update({ ...baseInputs, circadianPhase: "deep_night" });
        if (out.current === "rest") restCount++;
      }
      // Should pick rest significantly more than random (1/6 = ~16)
      expect(restCount).toBeGreaterThan(30);
    });

    it("picks play more often with toys nearby", () => {
      let playCount = 0;
      for (let i = 0; i < 100; i++) {
        const e = new IntentEngine();
        e.updateConfig({ ...baseConfig, thoughtChance: 0 });
        const out = e.update({ ...baseInputs, toyTarget: { x: 400, y: 400 } });
        if (out.current === "play") playCount++;
      }
      expect(playCount).toBeGreaterThan(20);
    });

    it("picks socialize more often with high bond", () => {
      let socCount = 0;
      for (let i = 0; i < 100; i++) {
        const e = new IntentEngine();
        e.updateConfig({ ...baseConfig, thoughtChance: 0 });
        const out = e.update({ ...baseInputs, bondLevel: "best_friend" });
        if (out.current === "socialize") socCount++;
      }
      expect(socCount).toBeGreaterThan(15);
    });

    it("picks rest more often when idle for long", () => {
      let restCount = 0;
      for (let i = 0; i < 100; i++) {
        const e = new IntentEngine();
        e.updateConfig({ ...baseConfig, thoughtChance: 0 });
        const out = e.update({ ...baseInputs, idleSeconds: 300 });
        if (out.current === "rest") restCount++;
      }
      expect(restCount).toBeGreaterThan(20);
    });

    it("reduces nest weight when no nest position", () => {
      let nestCount = 0;
      for (let i = 0; i < 100; i++) {
        const e = new IntentEngine();
        e.updateConfig({ ...baseConfig, thoughtChance: 0 });
        const out = e.update({ ...baseInputs, nestPosition: null });
        if (out.current === "nest") nestCount++;
      }
      // Should be rare without a nest
      expect(nestCount).toBeLessThan(20);
    });
  });

  describe("forceIntent", () => {
    it("forces a specific intent", () => {
      engine.forceIntent("play", { x: 300, y: 300 });
      const out = engine.getOutput();
      expect(out.current).toBe("play");
      expect(out.targetPosition).toEqual({ x: 300, y: 300 });
    });

    it("sets state bias for the forced intent", () => {
      engine.forceIntent("rest", null);
      const out = engine.getOutput();
      expect(out.stateBias.nap).toBeGreaterThan(0);
    });

    it("can spawn a thought when forced", () => {
      engine.forceIntent("play", { x: 300, y: 300 });
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.text).toContain("...");
    });
  });

  describe("thoughts", () => {
    it("spawns thoughts on intent change", () => {
      engine.update(baseInputs);
      const thought = engine.consumeThought();
      expect(thought).not.toBeNull();
      expect(thought!.text).toBeDefined();
    });

    it("does not spawn thoughts when thoughtChance is 0", () => {
      engine.updateConfig({ ...baseConfig, thoughtChance: 0 });
      engine.update(baseInputs);
      const thought = engine.consumeThought();
      expect(thought).toBeNull();
    });

    it("consumeThought clears the pending thought", () => {
      engine.update(baseInputs);
      const t1 = engine.consumeThought();
      expect(t1).not.toBeNull();
      const t2 = engine.consumeThought();
      expect(t2).toBeNull();
    });
  });

  describe("progress", () => {
    it("progress increases as Kovy approaches target", () => {
      engine.forceIntent("play", { x: 510, y: 510 });
      // Kovy is at 500,500 — very close to target
      engine.update({ ...baseInputs, kovyPos: { x: 500, y: 500 } });
      const out = engine.getOutput();
      expect(out.progress).toBeGreaterThan(0.9);
    });

    it("progress is lower when far from target", () => {
      engine.forceIntent("play", { x: 1000, y: 1000 });
      engine.update({ ...baseInputs, kovyPos: { x: 100, y: 100 } });
      const out = engine.getOutput();
      expect(out.progress).toBeLessThan(0.5);
    });
  });

  describe("state bias", () => {
    it("rest intent biases toward nap", () => {
      engine.forceIntent("rest", null);
      const out = engine.getOutput();
      expect(out.stateBias.nap).toBe(1.0);
    });

    it("play intent biases toward dance", () => {
      engine.forceIntent("play", null);
      const out = engine.getOutput();
      expect(out.stateBias.dance).toBe(1.0);
    });

    it("explore intent biases toward wander", () => {
      engine.forceIntent("explore", null);
      const out = engine.getOutput();
      expect(out.stateBias.wander).toBe(1.0);
    });

    it("observe intent biases toward perch", () => {
      engine.forceIntent("observe", null);
      const out = engine.getOutput();
      expect(out.stateBias.perch).toBe(1.0);
    });
  });

  describe("destroy", () => {
    it("clears state on destroy", () => {
      engine.forceIntent("play", { x: 300, y: 300 });
      engine.destroy();
      const out = engine.getOutput();
      expect(out.current).toBeNull();
      expect(engine.isEnabled()).toBe(false);
    });
  });
});
