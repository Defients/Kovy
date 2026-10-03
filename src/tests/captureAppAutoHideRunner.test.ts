// ============================================================
// Tests for CaptureAppAutoHideRunner and the shouldHide decision
// function. Uses fake timers for deterministic async testing.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CaptureAppAutoHideRunner,
  shouldHide,
} from "@/engine/captureAppAutoHideRunner";
import type { CaptureAppStatus } from "@/lib/tauriBridge";

// --- Pure decision function tests ---

describe("shouldHide (pure decision)", () => {
  const detected = (names: string[]): CaptureAppStatus => ({
    running: names.length > 0,
    matched: names,
  });

  it("does nothing when auto-hide is disabled and nothing is running", () => {
    const r = shouldHide(detected([]), false, false, false);
    expect(r.hide).toBe(false);
    expect(r.beginOverride).toBe(false);
    expect(r.endOverride).toBe(false);
  });

  it("does nothing when disabled even if OBS is running", () => {
    const r = shouldHide(detected(["obs64"]), false, false, false);
    expect(r.hide).toBe(false);
    expect(r.beginOverride).toBe(false);
  });

  it("begins override when OBS appears and auto-hide is enabled", () => {
    const r = shouldHide(detected(["obs64"]), true, false, false);
    expect(r.hide).toBe(true);
    expect(r.beginOverride).toBe(true);
    expect(r.endOverride).toBe(false);
  });

  it("stays hidden while OBS continues and already overriding", () => {
    const r = shouldHide(detected(["obs64"]), true, true, true);
    expect(r.hide).toBe(true);
    expect(r.beginOverride).toBe(false);
    expect(r.endOverride).toBe(false);
  });

  it("ends override when OBS exits", () => {
    const r = shouldHide(detected([]), true, true, true);
    expect(r.endOverride).toBe(true);
    expect(r.beginOverride).toBe(false);
  });

  it("does not begin override again if already overriding", () => {
    const r = shouldHide(detected(["streamlabsobs"]), true, true, true);
    expect(r.beginOverride).toBe(false);
    expect(r.hide).toBe(true);
  });

  it("does nothing when not overriding and nothing is detected", () => {
    const r = shouldHide(detected([]), true, false, false);
    expect(r.hide).toBe(false);
    expect(r.beginOverride).toBe(false);
    expect(r.endOverride).toBe(false);
  });
});

// --- Runner integration tests with fake timers ---

describe("CaptureAppAutoHideRunner", () => {
  let enabled = false;
  let hideFromCapture = false;
  let setCalls: boolean[] = [];
  let fakeDetected: CaptureAppStatus = { running: false, matched: [] };

  function makeRunner(intervalMs = 1000) {
    return new CaptureAppAutoHideRunner({
      intervalMs,
      getEnabled: () => enabled,
      getHideFromCapture: () => hideFromCapture,
      setHideFromCapture: (h) => {
        hideFromCapture = h;
        setCalls.push(h);
      },
      detector: async () => fakeDetected,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    enabled = false;
    hideFromCapture = false;
    setCalls = [];
    fakeDetected = { running: false, matched: [] };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not hide when auto-hide is disabled even if OBS is running", async () => {
    enabled = false;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(1500);
    runner.destroy();
    expect(setCalls).toEqual([]);
    expect(hideFromCapture).toBe(false);
  });

  it("hides when OBS appears and auto-hide is enabled", async () => {
    enabled = true;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    // First tick fires immediately (void this.tick() in start())
    await vi.advanceTimersByTimeAsync(100);
    expect(setCalls).toContain(true);
    expect(hideFromCapture).toBe(true);
    runner.destroy();
  });

  it("restores previous preference when OBS exits", async () => {
    enabled = true;
    hideFromCapture = false; // user's preference is "visible"
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(hideFromCapture).toBe(true); // auto-hidden
    expect(runner.isOverriding()).toBe(true);
    // OBS exits
    fakeDetected = { running: false, matched: [] };
    await vi.advanceTimersByTimeAsync(1100);
    // Should have restored to user's preference (false)
    expect(setCalls).toContain(true);
    expect(setCalls).toContain(false);
    expect(hideFromCapture).toBe(false);
    expect(runner.isOverriding()).toBe(false);
    runner.destroy();
  });

  it("restores preference on destroy if still overriding", async () => {
    enabled = true;
    hideFromCapture = false;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(hideFromCapture).toBe(true); // auto-hidden
    // Destroy while OBS is still running — should restore saved pref (false)
    runner.destroy();
    expect(setCalls).toContain(false); // restore call on destroy
    expect(hideFromCapture).toBe(false);
  });

  it("does not double-set when already hiding and OBS appears", async () => {
    enabled = true;
    hideFromCapture = true; // user already hides
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    // Should NOT call setHideFromCapture(true) since already true
    expect(setCalls).not.toContain(true);
    runner.destroy();
    // On destroy, restores savedPreference which was true
    expect(hideFromCapture).toBe(true);
  });

  it("isOverriding reflects current state", async () => {
    enabled = true;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(runner.isOverriding()).toBe(true);
    fakeDetected = { running: false, matched: [] };
    await vi.advanceTimersByTimeAsync(1100);
    expect(runner.isOverriding()).toBe(false);
    runner.destroy();
  });

  it("start/stop/destroy lifecycle is idempotent", () => {
    const runner = makeRunner(1000);
    runner.start();
    runner.start(); // no-op
    runner.stop();
    runner.stop(); // no-op
    runner.destroy();
    runner.destroy(); // no-op
    expect(true).toBe(true); // no throw
  });

  it("getSavedPreference returns the preference captured at override start", async () => {
    enabled = true;
    hideFromCapture = false;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(runner.getSavedPreference()).toBe(false);
    runner.destroy();
  });

  it("re-asserts hide if user turns it off while capture app still running", async () => {
    enabled = true;
    hideFromCapture = false;
    fakeDetected = { running: true, matched: ["obs64"] };
    const runner = makeRunner(1000);
    runner.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(hideFromCapture).toBe(true);
    // Simulate user (or another code path) turning hiding back off
    hideFromCapture = false;
    setCalls = [];
    // Next tick should re-assert
    await vi.advanceTimersByTimeAsync(1100);
    expect(setCalls).toContain(true);
    expect(hideFromCapture).toBe(true);
    runner.destroy();
  });
});
