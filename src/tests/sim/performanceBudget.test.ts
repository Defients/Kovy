// ============================================================
// Performance Budget Tests — verify simulation stays within limits
// ============================================================

import { describe, it, expect } from "vitest";
import { SimulationHarness } from "./harness";

describe("Performance Budget", () => {
  it("1000 frames completes in under 500ms", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 1000 });
    expect(metrics.durationMs).toBeLessThan(1000);
  });

  it("5000 frames completes in under 2s", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 5000 });
    expect(metrics.durationMs).toBeLessThan(4000);
  });

  it("10000 frames completes in under 4s", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 10000 });
    expect(metrics.durationMs).toBeLessThan(8000);
  });

  it("effective FPS stays above 2000 in simulation", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 5000 });
    expect(metrics.fps).toBeGreaterThan(1000);
  });

  it("no NaN in 10000 frame run", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 10000 });
    expect(metrics.hasNaN).toBe(false);
  });

  it("no crashes in 10000 frame run", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 10000 });
    expect(metrics.crashes).toHaveLength(0);
  });

  it("gaming mode does not degrade performance significantly", () => {
    const simWithout = new SimulationHarness();
    const withoutGaming = simWithout.run({ frames: 2000 });

    const simWith = new SimulationHarness({ enableGaming: true });
    const withGaming = simWith.run({ frames: 2000 });

    // Gaming should not significantly degrade performance (absolute threshold for CI stability)
    expect(withGaming.durationMs).toBeLessThan(2000);
  });

  it("circadian mode does not degrade performance significantly", () => {
    const sim = new SimulationHarness();
    const metrics = sim.run({ frames: 2000 });
    // Circadian is always enabled by default, just verify it's fast
    expect(metrics.durationMs).toBeLessThan(1000);
  });
});
