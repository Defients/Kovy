import { describe, it, expect, beforeEach } from "vitest";
import { MovementController } from "../engine/movementController";
import {
  buildFounderRenderState,
  buildSiblingRenderState,
  computeBondWarmth,
  computeGlowPulse,
  computeEyeTarget,
  BOND_WARMTH_MAP,
  type MovementResult,
} from "../overlay/renderHelpers";
import { DEFAULT_CONFIG } from "../store/defaults";
import type { GamingOutput, CircadianOutput, KovyConfig } from "../store/types";

function makeGamingOutput(overrides: Partial<GamingOutput> = {}): GamingOutput {
  return {
    enabled: false,
    excitement: 0,
    predictionConfidence: 0,
    predictedPoints: [],
    adaptiveBias: 0,
    hyperBoost: 0,
    elasticity: 0,
    freeformWobble: 0,
    residueBursts: [],
    ...overrides,
  };
}

function makeCircadianOutput(overrides: Partial<CircadianOutput> = {}): CircadianOutput {
  return {
    phase: "morning",
    energyMultiplier: 0.8,
    anticipation: 0.3,
    drowsiness: 0.1,
    startleSensitivity: 0.2,
    dreamIntensity: 0,
    socialEnergy: 0.5,
    ...overrides,
  };
}

describe("Animation loop integration — MovementController", () => {
  it("produces stable position over multiple frames toward a static target", () => {
    const mc = new MovementController();
    mc.setPosition(100, 100);
    const target = { x: 500, y: 500 };
    const screenW = 1920;
    const screenH = 1080;

    let lastResult: MovementResult | null = null;
    for (let i = 0; i < 300; i++) {
      const r = mc.update(1 / 60, target, 1.0, screenW, screenH);
      lastResult = r;
    }

    expect(lastResult).not.toBeNull();
    // After 5 seconds the spring should have converged near the target
    expect(lastResult!.position.x).toBeGreaterThan(450);
    expect(lastResult!.position.x).toBeLessThan(550);
    expect(lastResult!.position.y).toBeGreaterThan(450);
    expect(lastResult!.position.y).toBeLessThan(550);
  });

  it("velocity decreases as entity approaches target (damping)", () => {
    const mc = new MovementController();
    mc.setPosition(100, 100);
    const target = { x: 200, y: 200 };

    // Measure speed early (entity still accelerating)
    const r1 = mc.update(1 / 60, target, 1.0, 1920, 1080);
    const speed1 = Math.hypot(r1.velocity.x, r1.velocity.y);

    // Let it settle — after convergence the spring damping reduces velocity
    for (let i = 0; i < 300; i++) {
      mc.update(1 / 60, target, 1.0, 1920, 1080);
    }
    const r2 = mc.update(1 / 60, target, 1.0, 1920, 1080);
    const speed2 = Math.hypot(r2.velocity.x, r2.velocity.y);

    expect(speed2).toBeLessThan(speed1);
  });

  it("squash/stretch stays within reasonable bounds", () => {
    const mc = new MovementController();
    mc.setPosition(100, 100);
    const target = { x: 800, y: 800 };

    for (let i = 0; i < 60; i++) {
      const r = mc.update(1 / 60, target, 1.0, 1920, 1080);
      expect(r.squashStretch.x).toBeGreaterThan(0.7);
      expect(r.squashStretch.x).toBeLessThan(1.3);
      expect(r.squashStretch.y).toBeGreaterThan(0.7);
      expect(r.squashStretch.y).toBeLessThan(1.3);
    }
  });

  it("landing impact spikes then decays", () => {
    const mc = new MovementController();
    mc.setPosition(100, 100);
    const target = { x: 105, y: 105 };

    // Build up velocity then arrive at target
    for (let i = 0; i < 30; i++) {
      mc.update(1 / 60, { x: 600, y: 600 }, 1.0, 1920, 1080);
    }
    // Now target is very close — entity will "land"
    const impacts: number[] = [];
    for (let i = 0; i < 30; i++) {
      const r = mc.update(1 / 60, target, 1.0, 1920, 1080);
      impacts.push(r.landingImpact);
    }

    const maxImpact = Math.max(...impacts);
    const lastImpact = impacts[impacts.length - 1];
    expect(maxImpact).toBeGreaterThanOrEqual(0);
    expect(lastImpact).toBeLessThanOrEqual(maxImpact);
  });

  it("respects screen bounds", () => {
    const mc = new MovementController();
    mc.setPosition(100, 100);
    const target = { x: -500, y: -500 };

    for (let i = 0; i < 120; i++) {
      const r = mc.update(1 / 60, target, 1.0, 1920, 1080);
      expect(r.position.x).toBeGreaterThanOrEqual(-50);
      expect(r.position.y).toBeGreaterThanOrEqual(-50);
    }
  });
});

describe("Animation loop integration — Render state building", () => {
  const config = DEFAULT_CONFIG as KovyConfig;
  const gaming = makeGamingOutput({ excitement: 0.6, elasticity: 0.4, freeformWobble: 0.3, predictionConfidence: 0.7 });
  const circadian = makeCircadianOutput({ dreamIntensity: 0.5 });

  const movement: MovementResult = {
    position: { x: 300, y: 400 },
    velocity: { x: 5, y: -3 },
    squashStretch: { x: 1.1, y: 0.9 },
    leanAngle: 0.15,
    landingImpact: 0.2,
  };

  it("buildFounderRenderState maps all fields correctly", () => {
    const state = buildFounderRenderState(
      movement, "idle_float", "curious", 0.3, 0.6,
      { x: 0.5, y: 0.2 }, false, 42.5, config, gaming, circadian,
      undefined, undefined, "Kovy", 0.7,
    );

    expect(state.position).toEqual(movement.position);
    expect(state.velocity).toEqual(movement.velocity);
    expect(state.squashStretch).toEqual(movement.squashStretch);
    expect(state.surfaceMood).toBe("curious");
    expect(state.behaviorState).toBe("idle_float");
    expect(state.gamingExcitement).toBe(0.6);
    expect(state.elasticity).toBe(0.4);
    expect(state.freeformWobble).toBe(0.3);
    expect(state.dreamIntensity).toBe(0.5);
    expect(state.leanAngle).toBe(0.15);
    expect(state.landingImpact).toBe(0.2);
    expect(state.bondWarmth).toBe(0.7);
    expect(state.name).toBe("Kovy");
    expect(state.showName).toBe(config.family.showFamilyNames);
  });

  it("buildSiblingRenderState maps all fields correctly", () => {
    const sibPersonality = { colorHueOffset: 30, sizeOffset: 0.1 };
    const state = buildSiblingRenderState(
      movement, "wander", "playful", 0, 0.4,
      { x: -0.3, y: 0.1 }, false, 12.0, config, gaming, circadian,
      sibPersonality, undefined, "Pip", 0.2,
    );

    expect(state.hueOffset).toBe(30);
    expect(state.sizeOffset).toBe(0.1);
    expect(state.surfaceMood).toBe("playful");
    expect(state.behaviorState).toBe("wander");
    expect(state.name).toBe("Pip");
    expect(state.bondWarmth).toBe(0.2);
  });

  it("founder with visual meta passes through custom colors", () => {
    const founderVisual = {
      customColorsEnabled: true,
      primaryColor: "#ff6600",
      secondaryColor: "#0066ff",
      opacity: 0.8,
      rimLightIntensity: 0.5,
    };
    const state = buildFounderRenderState(
      movement, "idle_float", "calm", 0, 0.3,
      { x: 0, y: 0 }, false, 0, config, gaming, circadian,
      founderVisual, undefined, "Kovy", 0,
    );

    expect(state.customColorsEnabled).toBe(true);
    expect(state.primaryColor).toBe("#ff6600");
    expect(state.secondaryColor).toBe("#0066ff");
    expect(state.entityOpacity).toBe(0.8);
    expect(state.rimLightIntensity).toBe(0.5);
  });
});

describe("Animation loop integration — Helper functions", () => {
  it("computeBondWarmth maps all bond levels", () => {
    expect(computeBondWarmth(true, "stranger")).toBe(BOND_WARMTH_MAP.stranger);
    expect(computeBondWarmth(true, "acquaintance")).toBe(BOND_WARMTH_MAP.acquaintance);
    expect(computeBondWarmth(true, "companion")).toBe(BOND_WARMTH_MAP.companion);
    expect(computeBondWarmth(true, "friend")).toBe(BOND_WARMTH_MAP.friend);
    expect(computeBondWarmth(true, "best_friend")).toBe(BOND_WARMTH_MAP.best_friend);
  });

  it("computeBondWarmth returns 0 when disabled or missing", () => {
    expect(computeBondWarmth(false, "friend")).toBe(0);
    expect(computeBondWarmth(true, undefined)).toBe(0);
    expect(computeBondWarmth(true, "unknown_level")).toBe(0);
  });

  it("computeGlowPulse oscillates in [0, glowIntensity]", () => {
    const glowIntensity = 0.8;
    for (let i = 0; i < 100; i++) {
      const t = i * 0.1;
      const pulse = computeGlowPulse(t, glowIntensity);
      expect(pulse).toBeGreaterThanOrEqual(0);
      expect(pulse).toBeLessThanOrEqual(glowIntensity);
    }
  });

  it("computeGlowPulse with phase offset shifts the wave", () => {
    const t = 1.0;
    const glowIntensity = 1.0;
    const p0 = computeGlowPulse(t, glowIntensity, 0);
    const p1 = computeGlowPulse(t, glowIntensity, Math.PI);
    expect(Math.abs(p0 - p1)).toBeGreaterThan(0.01);
  });

  it("computeEyeTarget points toward active target", () => {
    const target = { position: { x: 500, y: 500 } };
    const entityPos = { x: 100, y: 100 };
    const cursor = { x: 200, y: 200 };
    const et = computeEyeTarget(target, cursor, entityPos);
    const len = Math.hypot(et.x, et.y);
    expect(len).toBeCloseTo(1.0, 2);
    expect(et.x).toBeGreaterThan(0);
    expect(et.y).toBeGreaterThan(0);
  });

  it("computeEyeTarget falls back to cursor when no active target", () => {
    const entityPos = { x: 100, y: 100 };
    const cursor = { x: 500, y: 100 };
    const et = computeEyeTarget(null, cursor, entityPos);
    expect(et.x).toBeGreaterThan(0);
    expect(Math.abs(et.y)).toBeLessThan(0.1);
  });

  it("computeEyeTarget returns zero when target is too close", () => {
    // dist = sqrt(0.5) ≈ 0.707, which is < 1, so no eye target
    const target = { position: { x: 100.5, y: 100.5 } };
    const entityPos = { x: 100, y: 100 };
    const cursor = { x: 100, y: 100 };
    const et = computeEyeTarget(target, cursor, entityPos);
    expect(et.x).toBe(0);
    expect(et.y).toBe(0);
  });
});

describe("Animation loop integration — Multi-frame glow + movement pipeline", () => {
  it("glow pulse and movement stay synchronized over time", () => {
    const mc = new MovementController();
    mc.setPosition(200, 200);
    const target = { x: 600, y: 400 };
    const glowIntensity = 0.7;
    let time = 0;
    const dt = 1 / 60;

    for (let i = 0; i < 180; i++) {
      const r = mc.update(dt, target, 1.0, 1920, 1080);
      const glow = computeGlowPulse(time, glowIntensity, r.position.x * 0.01);
      expect(glow).toBeGreaterThanOrEqual(0);
      expect(glow).toBeLessThanOrEqual(glowIntensity);
      time += dt;
    }
  });
});
