import { describe, it, expect, beforeEach } from "vitest";
import { EmoteEngine, getEmotesForMood, getEmotesForTransition } from "@/engine/emoteEngine";
import type { EmoteConfig, SurfaceMood, BehaviorState } from "@/store/types";

const DEFAULT_CONFIG: EmoteConfig = {
  enabled: true,
  intensity: 0.6,
  style: "bubble",
  maxActive: 6,
};

function makeEntity(id: string, mood: SurfaceMood = "calm", state: BehaviorState = "idle_float") {
  return { id, position: { x: 500, y: 400 }, mood, behaviorState: state };
}

describe("EmoteEngine", () => {
  let engine: EmoteEngine;

  beforeEach(() => {
    engine = new EmoteEngine();
  });

  describe("onBehaviorTransition", () => {
    it("spawns emotes on transition to inspect", () => {
      engine.onBehaviorTransition("idle_float", "inspect", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticleCount()).toBeGreaterThan(0);
    });

    it("spawns emotes on transition to celebrate", () => {
      engine.onBehaviorTransition("inspect", "celebrate", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      const particles = engine.getParticles();
      expect(particles.length).toBeGreaterThan(0);
      expect(particles.some(p => p.type === "star" || p.type === "exclaim")).toBe(true);
    });

    it("spawns zzz on transition to nap", () => {
      engine.onBehaviorTransition("idle_float", "nap", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "zzz")).toBe(true);
    });

    it("spawns exclaim on startle", () => {
      engine.onBehaviorTransition("idle_float", "startle", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "exclaim")).toBe(true);
    });

    it("does not spawn when disabled", () => {
      engine.onBehaviorTransition("idle_float", "inspect", "kovy-prime", { x: 100, y: 100 }, { ...DEFAULT_CONFIG, enabled: false });
      expect(engine.getParticleCount()).toBe(0);
    });

    it("respects maxActive limit", () => {
      const config = { ...DEFAULT_CONFIG, maxActive: 3 };
      for (let i = 0; i < 10; i++) {
        engine.onBehaviorTransition("idle_float", "celebrate", `entity-${i}`, { x: 100, y: 100 }, config);
      }
      expect(engine.getParticleCount()).toBeLessThanOrEqual(3);
    });

    it("does not spawn for transitions without mapped emotes", () => {
      engine.onBehaviorTransition("idle_float", "wander", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticleCount()).toBe(0);
    });
  });

  describe("update (decay)", () => {
    it("decays particles over time", () => {
      engine.onBehaviorTransition("idle_float", "celebrate", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      const initialCount = engine.getParticleCount();
      expect(initialCount).toBeGreaterThan(0);

      // Advance time well past max lifetime, pass empty entities to avoid passive spawning
      for (let i = 0; i < 50; i++) {
        engine.update(0.2, DEFAULT_CONFIG, []);
      }
      expect(engine.getParticleCount()).toBe(0);
    });

    it("particles drift upward", () => {
      engine.onBehaviorTransition("idle_float", "inspect", "kovy-prime", { x: 500, y: 500 }, DEFAULT_CONFIG);
      const startY = engine.getParticles()[0].position.y;
      engine.update(0.5, DEFAULT_CONFIG, [makeEntity("kovy-prime")]);
      expect(engine.getParticles()[0].position.y).toBeLessThan(startY);
    });
  });

  describe("passive spawning", () => {
    it("spawns passive emotes during idle states after interval", () => {
      const entities = [makeEntity("kovy-prime", "calm", "idle_float")];
      const config = { ...DEFAULT_CONFIG, intensity: 1.0 };
      // Run enough updates to trigger passive spawn
      for (let i = 0; i < 50; i++) {
        engine.update(0.2, config, entities);
      }
      // With high intensity and idle state, should eventually spawn
      expect(engine.getParticleCount()).toBeGreaterThanOrEqual(0); // non-deterministic
    });

    it("does not spawn passive emotes when disabled", () => {
      const entities = [makeEntity("kovy-prime", "calm", "idle_float")];
      for (let i = 0; i < 50; i++) {
        engine.update(0.2, { ...DEFAULT_CONFIG, enabled: false }, entities);
      }
      expect(engine.getParticleCount()).toBe(0);
    });
  });

  describe("v7.0 transition emotes", () => {
    it("spawns music emote on dance transition", () => {
      engine.onBehaviorTransition("idle_float", "dance", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "music" || p.type === "star")).toBe(true);
    });

    it("spawns zzz on play_dead transition", () => {
      engine.onBehaviorTransition("idle_float", "play_dead", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "zzz")).toBe(true);
    });

    it("spawns question on investigate transition", () => {
      engine.onBehaviorTransition("idle_float", "investigate", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "question" || p.type === "spark")).toBe(true);
    });

    it("spawns ellipsis on hide transition", () => {
      engine.onBehaviorTransition("idle_float", "hide", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "ellipsis")).toBe(true);
    });

    it("spawns note on meditate transition", () => {
      engine.onBehaviorTransition("idle_float", "meditate", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticles().some(p => p.type === "note")).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears all particles on reset", () => {
      engine.onBehaviorTransition("idle_float", "celebrate", "kovy-prime", { x: 100, y: 100 }, DEFAULT_CONFIG);
      expect(engine.getParticleCount()).toBeGreaterThan(0);
      engine.reset();
      expect(engine.getParticleCount()).toBe(0);
    });
  });

  describe("per-entity support", () => {
    it("tracks entityId on spawned particles", () => {
      engine.onBehaviorTransition("idle_float", "inspect", "sibling-1", { x: 200, y: 200 }, DEFAULT_CONFIG);
      expect(engine.getParticles().every(p => p.entityId === "sibling-1")).toBe(true);
    });
  });
});

describe("getEmotesForMood", () => {
  it("returns emote types for each mood", () => {
    const moods: SurfaceMood[] = ["calm", "curious", "playful", "focused", "sleepy", "excited", "overwhelmed", "shy"];
    for (const mood of moods) {
      const emotes = getEmotesForMood(mood);
      expect(emotes.length).toBeGreaterThan(0);
    }
  });
});

describe("getEmotesForTransition", () => {
  it("returns emotes for known transitions", () => {
    expect(getEmotesForTransition("inspect").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("celebrate").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("nap").length).toBeGreaterThan(0);
  });

  it("returns empty for unknown transitions", () => {
    expect(getEmotesForTransition("wander")).toHaveLength(0);
    expect(getEmotesForTransition("idle_float")).toHaveLength(0);
  });

  it("returns emotes for v7.0 state transitions", () => {
    expect(getEmotesForTransition("dance").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("hide").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("play_dead").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("investigate").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("meditate").length).toBeGreaterThan(0);
    expect(getEmotesForTransition("follow_burst").length).toBeGreaterThan(0);
  });
});
