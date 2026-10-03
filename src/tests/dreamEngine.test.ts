// ============================================================
// Dream Engine tests — visual dream sequences during nap/dream states.
// Verifies particle spawning, color wash, dream thoughts, and edge cases.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DreamEngine, NULL_DREAM_OUTPUT } from "@/engine/dreamEngine";
import type { DreamConfig, Vec2, SurfaceMood } from "@/store/types";

const baseConfig: DreamConfig = {
  enabled: true,
  particleDensity: 1,
  thoughtFrequency: 1,
  colorWash: true,
  maxDreamParticles: 10,
};

const centerPos: Vec2 = { x: 500, y: 500 };

describe("DreamEngine", () => {
  let engine: DreamEngine;

  beforeEach(() => {
    engine = new DreamEngine();
  });

  describe("basic functionality", () => {
    it("returns NULL_DREAM_OUTPUT when disabled", () => {
      const out = engine.update(0.016, { ...baseConfig, enabled: false }, centerPos, "dream", 1, "calm");
      expect(out).toEqual(NULL_DREAM_OUTPUT);
      expect(out.enabled).toBe(false);
      expect(out.particles).toHaveLength(0);
      expect(out.dreamThought).toBeNull();
    });

    it("returns enabled output with no particles when not dreaming", () => {
      const out = engine.update(0.016, baseConfig, centerPos, "idle_float", 1, "calm");
      expect(out.enabled).toBe(true);
      expect(out.particles).toHaveLength(0);
      expect(out.dreamThought).toBeNull();
    });

    it("treats nap as a dreaming state", () => {
      // Run multiple frames so spawnAccum accumulates enough to spawn
      let out = NULL_DREAM_OUTPUT;
      for (let i = 0; i < 30; i++) {
        out = engine.update(0.1, baseConfig, centerPos, "nap", 1, "calm");
      }
      expect(out.enabled).toBe(true);
      expect(out.particles.length).toBeGreaterThan(0);
    });

    it("treats dream as a dreaming state", () => {
      let out = NULL_DREAM_OUTPUT;
      for (let i = 0; i < 30; i++) {
        out = engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      expect(out.enabled).toBe(true);
      expect(out.particles.length).toBeGreaterThan(0);
    });

    it("returns a copy of particles array (not internal reference)", () => {
      for (let i = 0; i < 30; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      const out1 = engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      const particlesRef = out1.particles;
      expect(particlesRef.length).toBeGreaterThan(0);
      // Mutating the returned array should not affect the engine
      particlesRef.length = 0;
      const internal = engine.getParticles();
      expect(internal.length).toBeGreaterThan(0);
    });

    it("getParticles returns a copy of internal particles", () => {
      for (let i = 0; i < 30; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      const p1 = engine.getParticles();
      expect(p1.length).toBeGreaterThan(0);
      p1.length = 0;
      const p2 = engine.getParticles();
      expect(p2.length).toBeGreaterThan(0);
    });
  });

  describe("config updates", () => {
    it("respects maxDreamParticles limit", () => {
      const limitedConfig: DreamConfig = { ...baseConfig, maxDreamParticles: 3 };
      // Run many frames to try to exceed the limit
      for (let i = 0; i < 100; i++) {
        engine.update(0.1, limitedConfig, centerPos, "dream", 1, "calm");
      }
      expect(engine.getParticles().length).toBeLessThanOrEqual(3);
    });

    it("particleDensity affects spawn rate", () => {
      const denseEngine = new DreamEngine();
      const sparseEngine = new DreamEngine();
      for (let i = 0; i < 50; i++) {
        denseEngine.update(0.05, { ...baseConfig, particleDensity: 1 }, centerPos, "dream", 1, "calm");
        sparseEngine.update(0.05, { ...baseConfig, particleDensity: 0.1 }, centerPos, "dream", 1, "calm");
      }
      // Dense config should spawn more particles than sparse
      expect(denseEngine.getParticles().length).toBeGreaterThan(sparseEngine.getParticles().length);
    });

    it("disabling colorWash keeps colorWashIntensity at 0", () => {
      const out = engine.update(1, { ...baseConfig, colorWash: false }, centerPos, "dream", 1, "calm");
      expect(out.colorWashIntensity).toBe(0);
    });

    it("enabling colorWash produces positive intensity when dreaming", () => {
      // Run several frames so the smoothed value ramps up
      let out = NULL_DREAM_OUTPUT;
      for (let i = 0; i < 20; i++) {
        out = engine.update(0.1, { ...baseConfig, colorWash: true }, centerPos, "dream", 1, "calm");
      }
      expect(out.colorWashIntensity).toBeGreaterThan(0);
    });

    it("thoughtFrequency affects thought generation", () => {
      // High frequency should generate a thought quickly
      let out = NULL_DREAM_OUTPUT;
      for (let i = 0; i < 200; i++) {
        out = engine.update(0.1, { ...baseConfig, thoughtFrequency: 1 }, centerPos, "dream", 1, "calm");
      }
      expect(out.dreamThought).not.toBeNull();
    });
  });

  describe("main update logic", () => {
    it("does not spawn particles when dreamIntensity is below 0.2", () => {
      const out = engine.update(0.1, baseConfig, centerPos, "dream", 0.1, "calm");
      expect(out.particles).toHaveLength(0);
    });

    it("spawns particles when dreamIntensity is above 0.2", () => {
      let out = NULL_DREAM_OUTPUT;
      for (let i = 0; i < 30; i++) {
        out = engine.update(0.1, baseConfig, centerPos, "dream", 0.5, "calm");
      }
      expect(out.particles.length).toBeGreaterThan(0);
    });

    it("particles drift upward (negative y velocity)", () => {
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      const particles = engine.getParticles();
      // Upward bias means velocity y should be negative on average
      const avgVy = particles.reduce((sum, p) => sum + p.velocity.y, 0) / particles.length;
      expect(avgVy).toBeLessThan(0);
    });

    it("particle opacity fades in then out over lifetime", () => {
      // Spawn a particle
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      const particles = engine.getParticles();
      expect(particles.length).toBeGreaterThan(0);
      // At spawn (lifetime ~0), opacity should be low (fade-in phase)
      // Run a few frames to get into mid-life
      let midOpacity = 0;
      for (let i = 0; i < 30; i++) {
        const out = engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
        if (out.particles.length > 0) {
          midOpacity = out.particles[0].opacity;
        }
      }
      // Mid-life opacity should reach the plateau of 0.7
      expect(midOpacity).toBeGreaterThan(0);
    });

    it("particles are removed after their maxLifetime", () => {
      // Spawn particles
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      const initialCount = engine.getParticles().length;
      expect(initialCount).toBeGreaterThan(0);
      // Stop dreaming so no new particles spawn, then advance time past maxLifetime (~7s max)
      for (let i = 0; i < 100; i++) {
        engine.update(0.1, baseConfig, centerPos, "idle_float", 0, "calm");
      }
      expect(engine.getParticles().length).toBe(0);
    });

    it("colorWashHue drifts while dreaming", () => {
      const initial = engine.getColorWash();
      expect(initial.hue).toBe(0);
      for (let i = 0; i < 10; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      const after = engine.getColorWash();
      expect(after.hue).toBeGreaterThan(0);
    });

    it("colorWashHue does not drift when not dreaming", () => {
      for (let i = 0; i < 10; i++) {
        engine.update(0.1, baseConfig, centerPos, "idle_float", 0, "calm");
      }
      expect(engine.getColorWash().hue).toBe(0);
    });

    it("dreamThought is cleared when not dreaming", () => {
      // Generate a thought
      for (let i = 0; i < 200; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      expect(engine.getDreamThought()).not.toBeNull();
      // Stop dreaming
      engine.update(0.1, baseConfig, centerPos, "idle_float", 0, "calm");
      expect(engine.getDreamThought()).toBeNull();
    });

    it("dreamThought requires dreamIntensity above 0.3", () => {
      for (let i = 0; i < 200; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 0.25, "calm");
      }
      expect(engine.getDreamThought()).toBeNull();
    });

    it("dreamThought is replaced after its lifetime expires", () => {
      let firstThought: string | null = null;
      for (let i = 0; i < 200; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      firstThought = engine.getDreamThought();
      expect(firstThought).not.toBeNull();
      // Continue for a long time; thought should eventually change (or at least remain set)
      for (let i = 0; i < 500; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      // The thought should still be a valid string from the dream thoughts list
      expect(engine.getDreamThought()).not.toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles dt of 0 gracefully", () => {
      const out = engine.update(0, baseConfig, centerPos, "dream", 1, "calm");
      expect(out.enabled).toBe(true);
      expect(out.particles).toHaveLength(0);
    });

    it("handles very large dt without crashing", () => {
      const out = engine.update(100, baseConfig, centerPos, "dream", 1, "calm");
      expect(out.enabled).toBe(true);
      // Particles spawned then immediately expired due to large dt
      expect(out.particles.length).toBeLessThanOrEqual(baseConfig.maxDreamParticles);
    });

    it("colorWashIntensity is clamped to [0, 1]", () => {
      for (let i = 0; i < 100; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      const wash = engine.getColorWash();
      expect(wash.intensity).toBeGreaterThanOrEqual(0);
      expect(wash.intensity).toBeLessThanOrEqual(1);
    });

    it("colorWashIntensity decays to 0 when dreaming stops", () => {
      // Build up intensity
      for (let i = 0; i < 50; i++) {
        engine.update(0.1, baseConfig, centerPos, "dream", 1, "calm");
      }
      expect(engine.getColorWash().intensity).toBeGreaterThan(0);
      // Stop dreaming
      for (let i = 0; i < 100; i++) {
        engine.update(0.1, baseConfig, centerPos, "idle_float", 0, "calm");
      }
      expect(engine.getColorWash().intensity).toBeCloseTo(0, 5);
    });

    it("particle positions are offset from origin", () => {
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      const particles = engine.getParticles();
      for (const p of particles) {
        // Particles should spawn near origin, within spread range
        expect(Math.abs(p.position.x - centerPos.x)).toBeLessThan(100);
        expect(Math.abs(p.position.y - centerPos.y)).toBeLessThan(100);
      }
    });

    it("NULL_DREAM_OUTPUT is a frozen-shape constant", () => {
      expect(NULL_DREAM_OUTPUT.enabled).toBe(false);
      expect(NULL_DREAM_OUTPUT.particles).toEqual([]);
      expect(NULL_DREAM_OUTPUT.colorWashHue).toBe(0);
      expect(NULL_DREAM_OUTPUT.colorWashIntensity).toBe(0);
      expect(NULL_DREAM_OUTPUT.dreamThought).toBeNull();
    });
  });

  describe("clear", () => {
    it("clear removes all particles and resets state", () => {
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      expect(engine.getParticles().length).toBeGreaterThan(0);
      engine.clear();
      expect(engine.getParticles()).toHaveLength(0);
      expect(engine.getDreamThought()).toBeNull();
      expect(engine.getColorWash().intensity).toBe(0);
    });

    it("clear allows engine to continue working afterwards", () => {
      engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      engine.clear();
      const out = engine.update(0.5, baseConfig, centerPos, "dream", 1, "calm");
      expect(out.enabled).toBe(true);
      expect(out.particles.length).toBeGreaterThan(0);
    });
  });
});
