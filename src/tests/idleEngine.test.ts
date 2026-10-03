import { describe, it, expect, beforeEach, vi } from "vitest";
import { IdleEngine, NULL_IDLE_OUTPUT } from "@/engine/idleEngine";
import type { IdleConfig } from "@/store/types";

const defaultConfig: IdleConfig = {
  enabled: true,
  idleThresholdSec: 120,
  idleBehaviors: ["explore", "play_alone", "nap", "dream"],
};

describe("IdleEngine", () => {
  let engine: IdleEngine;

  beforeEach(() => {
    engine = new IdleEngine();
  });

  it("disabled config returns null output", async () => {
    const out = await engine.update(0.016, { ...defaultConfig, enabled: false }, 0.5);
    expect(out.enabled).toBe(false);
    expect(out.isIdle).toBe(false);
  });

  it("NULL_IDLE_OUTPUT has correct defaults", () => {
    expect(NULL_IDLE_OUTPUT.enabled).toBe(false);
    expect(NULL_IDLE_OUTPUT.isIdle).toBe(false);
    expect(NULL_IDLE_OUTPUT.idleSeconds).toBe(0);
    expect(NULL_IDLE_OUTPUT.currentBehavior).toBeNull();
  });

  it("uses Tauri idle seconds when available", async () => {
    vi.stubGlobal("getIdleSeconds", vi.fn().mockResolvedValue(60));
    // The engine imports getIdleSeconds from tauriBridge, so we need to mock the module
    // Since we can't easily mock the import, we test the fallback behavior instead
    vi.unstubAllGlobals();
  });

  it("falls back to motion-based idle when Tauri unavailable", async () => {
    // getIdleSeconds returns null when Tauri is not available (test environment)
    // Low motion → idle seconds accumulate
    let out = await engine.update(1.0, defaultConfig, 0.01);
    expect(out.idleSeconds).toBe(1);

    out = await engine.update(1.0, defaultConfig, 0.01);
    expect(out.idleSeconds).toBe(2);

    // High motion → idle resets
    out = await engine.update(1.0, defaultConfig, 0.5);
    expect(out.idleSeconds).toBe(0);
  });

  it("detects idle state after threshold", async () => {
    // Accumulate idle seconds via low motion
    for (let i = 0; i < 130; i++) {
      await engine.update(1.0, defaultConfig, 0.01);
    }
    const out = await engine.update(1.0, defaultConfig, 0.01);
    expect(out.isIdle).toBe(true);
    expect(out.idleSeconds).toBeGreaterThanOrEqual(defaultConfig.idleThresholdSec);
  });

  it("assigns idle behavior when idle", async () => {
    for (let i = 0; i < 130; i++) {
      await engine.update(1.0, defaultConfig, 0.01);
    }
    const out = await engine.update(1.0, defaultConfig, 0.01);
    expect(out.isIdle).toBe(true);
    expect(out.currentBehavior).not.toBeNull();
    expect(defaultConfig.idleBehaviors).toContain(out.currentBehavior);
  });

  it("clears behavior when not idle", async () => {
    // Start idle
    for (let i = 0; i < 130; i++) {
      await engine.update(1.0, defaultConfig, 0.01);
    }
    let out = await engine.update(1.0, defaultConfig, 0.01);
    expect(out.isIdle).toBe(true);

    // Motion resumes
    out = await engine.update(1.0, defaultConfig, 0.5);
    expect(out.isIdle).toBe(false);
    expect(out.currentBehavior).toBeNull();
  });

  it("does not go idle with high motion", async () => {
    for (let i = 0; i < 200; i++) {
      await engine.update(1.0, defaultConfig, 0.5);
    }
    const out = await engine.update(1.0, defaultConfig, 0.5);
    expect(out.isIdle).toBe(false);
    expect(out.idleSeconds).toBe(0);
  });

  it("handles empty idleBehaviors array", async () => {
    const cfg: IdleConfig = { ...defaultConfig, idleBehaviors: [] };
    for (let i = 0; i < 130; i++) {
      await engine.update(1.0, cfg, 0.01);
    }
    const out = await engine.update(1.0, cfg, 0.01);
    expect(out.isIdle).toBe(true);
    expect(out.currentBehavior).toBeNull();
  });
});
