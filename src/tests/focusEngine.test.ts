// ============================================================
// Focus Engine tests — v9.0
// Verifies focus state detection, accumulation/decay, session
// minutes, suppression flags, mood/behavior suggestions, and
// config-driven behavior.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { FocusEngine, NULL_FOCUS_OUTPUT } from "@/engine/focusEngine";
import type { FocusConfig } from "@/store/types";

const baseConfig: FocusConfig = {
  enabled: true,
  detectionSensitivity: 1.0,
  focusBehavior: "perch",
  suppressEmotes: true,
  suppressSound: true,
};

describe("FocusEngine — v9.0", () => {
  let engine: FocusEngine;

  beforeEach(() => {
    engine = new FocusEngine();
  });

  describe("basic functionality", () => {
    it("returns NULL_FOCUS_OUTPUT when disabled", () => {
      const out = engine.update(0.016, { ...baseConfig, enabled: false }, 0, true);
      expect(out).toEqual(NULL_FOCUS_OUTPUT);
      expect(out.enabled).toBe(false);
    });

    it("starts unfocused with zero session minutes", () => {
      const out = engine.update(0.016, baseConfig, 1.0, false);
      expect(out.state).toBe("unfocused");
      expect(out.focusMinutes).toBe(0);
    });

    it("returns enabled output when enabled", () => {
      const out = engine.update(0.016, baseConfig, 0, true);
      expect(out.enabled).toBe(true);
    });

    it("state getter reflects last computed state", () => {
      engine.update(0.016, baseConfig, 1.0, false);
      expect(engine.state).toBe("unfocused");
    });

    it("currentSessionMinutes getter matches output focusMinutes", () => {
      // drive into focus
      for (let i = 0; i < 200; i++) engine.update(0.5, baseConfig, 0, true);
      const out = engine.update(0.5, baseConfig, 0, true);
      expect(engine.currentSessionMinutes).toBeCloseTo(out.focusMinutes, 5);
    });
  });

  describe("focus accumulation", () => {
    it("enters light_focus when motion is low and app is stable", () => {
      // low motion, stable app, sensitivity 1.0 -> focusGain = 1 * 1 * 1 = 1 per sec
      // need netFocus > 0.3
      for (let i = 0; i < 50; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.state).not.toBe("unfocused");
    });

    it("enters deep_focus with sustained low motion", () => {
      for (let i = 0; i < 200; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.state).toBe("deep_focus");
    });

    it("stays unfocused with high motion", () => {
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 1.0, true);
      const out = engine.update(0.02, baseConfig, 1.0, true);
      expect(out.state).toBe("unfocused");
    });

    it("reduces focus gain when app is not stable", () => {
      // appStable false -> gain * 0.3, much slower
      for (let i = 0; i < 50; i++) engine.update(0.02, baseConfig, 0, false);
      const out = engine.update(0.02, baseConfig, 0, false);
      // with 0.3 multiplier and only ~1s elapsed, likely still unfocused or light
      // focusGain=0.3/sec, after ~1s focusAccum ~0.3, decay 0 -> netFocus ~0.3 (boundary)
      // Just verify it does not jump straight to deep_focus
      expect(out.state).not.toBe("deep_focus");
    });
  });

  describe("session minutes", () => {
    it("accumulates session minutes while focused", () => {
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.focusMinutes).toBeGreaterThan(0);
    });

    it("resets session minutes to zero when unfocused", () => {
      // build up focus
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 0, true);
      // then introduce high motion to drop to unfocused
      for (let i = 0; i < 200; i++) engine.update(0.02, baseConfig, 1.0, false);
      const out = engine.update(0.02, baseConfig, 1.0, false);
      expect(out.state).toBe("unfocused");
      expect(out.focusMinutes).toBe(0);
    });
  });

  describe("suppression flags", () => {
    it("suppresses emotes when focused and config enabled", () => {
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.suppressEmotes).toBe(true);
    });

    it("does not suppress emotes when unfocused", () => {
      const out = engine.update(0.02, baseConfig, 1.0, false);
      expect(out.suppressEmotes).toBe(false);
    });

    it("does not suppress emotes when config suppressEmotes is false", () => {
      const cfg = { ...baseConfig, suppressEmotes: false };
      for (let i = 0; i < 100; i++) engine.update(0.02, cfg, 0, true);
      const out = engine.update(0.02, cfg, 0, true);
      expect(out.suppressEmotes).toBe(false);
    });

    it("suppresses sound when focused and config enabled", () => {
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.suppressSound).toBe(true);
    });

    it("does not suppress sound when config suppressSound is false", () => {
      const cfg = { ...baseConfig, suppressSound: false };
      for (let i = 0; i < 100; i++) engine.update(0.02, cfg, 0, true);
      const out = engine.update(0.02, cfg, 0, true);
      expect(out.suppressSound).toBe(false);
    });
  });

  describe("suggestions", () => {
    it("suggests focusBehavior when focused", () => {
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.suggestedBehavior).toBe("perch");
    });

    it("suggests null behavior when unfocused", () => {
      const out = engine.update(0.02, baseConfig, 1.0, false);
      expect(out.suggestedBehavior).toBeNull();
    });

    it("suggests calm mood when unfocused", () => {
      const out = engine.update(0.02, baseConfig, 1.0, false);
      expect(out.suggestedMood).toBe("calm");
    });

    it("suggests focused mood for light_focus", () => {
      for (let i = 0; i < 60; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      if (out.state === "light_focus") {
        expect(out.suggestedMood).toBe("focused");
      } else {
        // if it already went deep, mood is determined
        expect(out.suggestedMood).toBe("determined");
      }
    });

    it("suggests determined mood for deep_focus", () => {
      for (let i = 0; i < 200; i++) engine.update(0.02, baseConfig, 0, true);
      const out = engine.update(0.02, baseConfig, 0, true);
      expect(out.state).toBe("deep_focus");
      expect(out.suggestedMood).toBe("determined");
    });
  });

  describe("config updates", () => {
    it("detectionSensitivity affects focus gain speed", () => {
      const lowSens = { ...baseConfig, detectionSensitivity: 0.1 };
      // With low sensitivity, focus accumulates much slower
      for (let i = 0; i < 50; i++) engine.update(0.02, lowSens, 0, true);
      const out = engine.update(0.02, lowSens, 0, true);
      // gain = 0.1/sec, after ~1s netFocus ~0.1 -> unfocused
      expect(out.state).toBe("unfocused");
    });

    it("focusBehavior change is reflected in suggestions", () => {
      const cfg = { ...baseConfig, focusBehavior: "wander" as never };
      for (let i = 0; i < 100; i++) engine.update(0.02, cfg, 0, true);
      const out = engine.update(0.02, cfg, 0, true);
      expect(out.suggestedBehavior).toBe("wander");
    });
  });

  describe("edge cases", () => {
    it("handles zero dt without changing state", () => {
      const out = engine.update(0, baseConfig, 0, true);
      expect(out.state).toBe("unfocused");
      expect(out.focusMinutes).toBe(0);
    });

    it("clamps motion level above 1", () => {
      // motion > 1 should be clamped to 1 internally
      const out = engine.update(0.02, baseConfig, 5.0, true);
      expect(out.state).toBe("unfocused");
    });

    it("clamps motion level below 0", () => {
      // negative motion clamps to 0 -> treated as low motion
      for (let i = 0; i < 100; i++) engine.update(0.02, baseConfig, -1.0, true);
      const out = engine.update(0.02, baseConfig, -1.0, true);
      expect(out.state).not.toBe("unfocused");
    });
  });
});
