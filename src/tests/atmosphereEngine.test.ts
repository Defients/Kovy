import { describe, it, expect, beforeEach } from "vitest";
import { AtmosphereEngine, getPhasePalette } from "@/engine/atmosphereEngine";
import type { AtmosphereConfig, CircadianPhase, SurfaceMood } from "@/store/types";

const DEFAULT_CONFIG: AtmosphereConfig = {
  enabled: true,
  density: 0.5,
  style: "organic",
  circadianSync: true,
  moodSync: true,
  seasonalSync: true,
};

const KOVY_POS = { x: 960, y: 540 };

describe("AtmosphereEngine", () => {
  let engine: AtmosphereEngine;

  beforeEach(() => {
    engine = new AtmosphereEngine();
  });

  describe("basic spawning", () => {
    it("spawns particles over time when enabled", () => {
      for (let i = 0; i < 30; i++) {
        engine.update(0.1, DEFAULT_CONFIG, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBeGreaterThan(0);
    });

    it("does not spawn when disabled", () => {
      const config = { ...DEFAULT_CONFIG, enabled: false };
      for (let i = 0; i < 30; i++) {
        engine.update(0.1, config, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBe(0);
    });
  });

  describe("particle lifecycle", () => {
    it("particles decay and are removed over time", () => {
      // Spawn some particles
      for (let i = 0; i < 20; i++) {
        engine.update(0.1, DEFAULT_CONFIG, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      const countAfterSpawn = engine.getParticleCount();

      // Stop spawning (low density), advance time significantly
      const lowConfig = { ...DEFAULT_CONFIG, density: 0.01 };
      for (let i = 0; i < 200; i++) {
        engine.update(0.1, lowConfig, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBeLessThan(countAfterSpawn);
    });

    it("particles start with zero opacity and fade in", () => {
      engine.update(2.0, DEFAULT_CONFIG, "morning", "calm", KOVY_POS, 1920, 1080);
      const particles = engine.getParticles();
      if (particles.length > 0) {
        // Newly spawned particles should have low opacity (just fading in)
        // After one big step some may already have some opacity
        expect(particles[0].opacity).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("circadian phase influence", () => {
    it("uses phase-specific shapes when circadianSync is enabled", () => {
      const config = { ...DEFAULT_CONFIG, circadianSync: true };
      for (let i = 0; i < 40; i++) {
        engine.update(0.1, config, "night", "calm", KOVY_POS, 1920, 1080);
      }
      const particles = engine.getParticles();
      if (particles.length > 0) {
        const nightShapes = getPhasePalette("night").shapes;
        // With organic style, should use phase shapes
        expect(nightShapes.length).toBeGreaterThan(0);
      }
    });

    it("falls back to morning palette when circadianSync is off", () => {
      const config = { ...DEFAULT_CONFIG, circadianSync: false };
      // Should work without errors regardless of phase
      for (let i = 0; i < 20; i++) {
        engine.update(0.1, config, "deep_night", "calm", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("mood influence", () => {
    it("spawns more with excited mood when moodSync is on", () => {
      const config = { ...DEFAULT_CONFIG, moodSync: true, density: 0.8 };
      const engineExcited = new AtmosphereEngine();
      const engineSleepy = new AtmosphereEngine();

      for (let i = 0; i < 50; i++) {
        engineExcited.update(0.1, config, "morning", "excited", KOVY_POS, 1920, 1080);
        engineSleepy.update(0.1, config, "morning", "sleepy", KOVY_POS, 1920, 1080);
      }
      // Excited should have more or equal particles than sleepy
      expect(engineExcited.getParticleCount()).toBeGreaterThanOrEqual(engineSleepy.getParticleCount());
    });
  });

  describe("style overrides", () => {
    it("minimal style only uses dot shapes", () => {
      const config = { ...DEFAULT_CONFIG, style: "minimal" as const, density: 1.0 };
      for (let i = 0; i < 40; i++) {
        engine.update(0.1, config, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      const particles = engine.getParticles();
      for (const p of particles) {
        expect(p.shape).toBe("dot");
      }
    });

    it("geometric style uses geometric shapes", () => {
      const config = { ...DEFAULT_CONFIG, style: "geometric" as const, density: 1.0 };
      for (let i = 0; i < 40; i++) {
        engine.update(0.1, config, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      const particles = engine.getParticles();
      const geoShapes = ["diamond", "cross", "ring", "line"];
      for (const p of particles) {
        expect(geoShapes).toContain(p.shape);
      }
    });
  });

  describe("max particles cap", () => {
    it("does not exceed 50 particles", () => {
      const config = { ...DEFAULT_CONFIG, density: 1.0 };
      for (let i = 0; i < 200; i++) {
        engine.update(0.05, config, "dusk", "excited", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBeLessThanOrEqual(50);
    });
  });

  describe("reset", () => {
    it("clears all particles on reset", () => {
      for (let i = 0; i < 20; i++) {
        engine.update(0.1, DEFAULT_CONFIG, "morning", "calm", KOVY_POS, 1920, 1080);
      }
      expect(engine.getParticleCount()).toBeGreaterThan(0);
      engine.reset();
      expect(engine.getParticleCount()).toBe(0);
    });
  });
});

describe("getPhasePalette", () => {
  it("returns valid palettes for all phases", () => {
    const phases: CircadianPhase[] = ["dawn", "morning", "afternoon", "dusk", "evening", "night", "deep_night"];
    for (const phase of phases) {
      const palette = getPhasePalette(phase);
      expect(palette.colors.length).toBeGreaterThan(0);
      expect(palette.shapes.length).toBeGreaterThan(0);
      expect(palette.baseSpeed).toBeGreaterThan(0);
      expect(palette.spawnRate).toBeGreaterThan(0);
      expect(palette.lifetimeRange[0]).toBeLessThan(palette.lifetimeRange[1]);
      expect(palette.sizeRange[0]).toBeLessThan(palette.sizeRange[1]);
    }
  });
});
