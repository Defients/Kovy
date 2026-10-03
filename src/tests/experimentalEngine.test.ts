// ============================================================
// Experimental Engine tests — v9.0 hardened behavior
// Verifies coordinate conversion, window verification, and
// hover actually moves the cursor.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExperimentalEngine } from "@/engine/experimentalEngine";
import type { ExperimentalConfig, BehaviorState } from "@/store/types";
import type { VirtualDesktopBounds } from "@/lib/monitorUtils";

// Mock tauriBridge
vi.mock("@/lib/tauriBridge", () => ({
  simulateClick: vi.fn().mockResolvedValue(undefined),
  simulateHover: vi.fn().mockResolvedValue(undefined),
  simulateKey: vi.fn().mockResolvedValue(undefined),
  getWindowAtPosition: vi.fn().mockResolvedValue(null),
  getElementInfo: vi.fn().mockResolvedValue(null),
}));

import { simulateClick, simulateHover, simulateKey, getWindowAtPosition } from "@/lib/tauriBridge";

const baseConfig: ExperimentalConfig = {
  enabled: true,
  optInAcknowledged: true,
  autoInteract: true,
  allowedInteractions: ["click", "hover", "type"],
  interactionRadius: 100,
  rateLimitSec: 0.1,
  targetMode: "allowlist",
  allowedApps: [],
};

const vd: VirtualDesktopBounds = { x: -1920, y: 0, width: 3840, height: 1080 };

describe("ExperimentalEngine — v9.0 hardening", () => {
  let engine: ExperimentalEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ExperimentalEngine();
    engine.updateConfig(baseConfig);
    engine.updateVirtualDesktop(vd);
  });

  it("converts overlay-local coordinates to screen coordinates", async () => {
    const kovyPos = { x: 100, y: 200 }; // overlay-local
    const behavior: BehaviorState = "inspect";
    (getWindowAtPosition as any).mockResolvedValue({
      name: "TestWindow",
      elementType: "window",
      bounds: [0, 0, 800, 600],
      isClickable: true,
    });

    await engine.tryInteract(kovyPos, behavior, false);

    // The screen position should be overlay-local + vd offset
    // getWindowAtPosition should have been called with screen coords
    const call = (getWindowAtPosition as any).mock.calls[0];
    expect(call[0]).toBeGreaterThanOrEqual(-1920 + 0); // kovyPos.x + vd.x - radius
    expect(call[0]).toBeLessThanOrEqual(-1920 + 200);  // kovyPos.x + vd.x + radius
    expect(call[1]).toBeGreaterThanOrEqual(0 + 100);   // kovyPos.y + vd.y - radius
    expect(call[1]).toBeLessThanOrEqual(0 + 300);      // kovyPos.y + vd.y + radius
  });

  it("skips interaction when no window exists at target", async () => {
    (getWindowAtPosition as any).mockResolvedValue(null);

    const entry = await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);

    expect(entry).not.toBeNull();
    expect(entry!.success).toBe(false);
    expect(entry!.targetElement).toBe("empty");
    expect(entry!.error).toBe("No window at target position");
    // Should not have clicked
    expect(simulateClick).not.toHaveBeenCalled();
    expect(simulateHover).not.toHaveBeenCalled();
  });

  it("actually moves cursor for hover interactions", async () => {
    (getWindowAtPosition as any).mockResolvedValue({
      name: "Button",
      elementType: "window",
      bounds: [0, 0, 100, 50],
      isClickable: true,
    });

    // Force only hover
    engine.updateConfig({ ...baseConfig, allowedInteractions: ["hover"] });

    const entry = await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);

    expect(entry).not.toBeNull();
    expect(entry!.success).toBe(true);
    expect(entry!.type).toBe("hover");
    expect(simulateHover).toHaveBeenCalledTimes(1);
    expect(simulateClick).not.toHaveBeenCalled();
  });

  it("clicks when a window exists at the target", async () => {
    (getWindowAtPosition as any).mockResolvedValue({
      name: "Notepad",
      elementType: "window",
      bounds: [0, 0, 800, 600],
      isClickable: true,
    });

    engine.updateConfig({ ...baseConfig, allowedInteractions: ["click"] });

    const entry = await engine.tryInteract({ x: 50, y: 50 }, "wander", false);

    expect(entry).not.toBeNull();
    expect(entry!.success).toBe(true);
    expect(entry!.type).toBe("click");
    expect(entry!.targetElement).toBe("Notepad");
    expect(simulateClick).toHaveBeenCalledTimes(1);
  });

  it("moves cursor before typing for type interactions", async () => {
    (getWindowAtPosition as any).mockResolvedValue({
      name: "Editor",
      elementType: "window",
      bounds: [0, 0, 800, 600],
      isClickable: true,
    });

    engine.updateConfig({ ...baseConfig, allowedInteractions: ["type"] });

    const entry = await engine.tryInteract({ x: 50, y: 50 }, "orbit", false);

    expect(entry).not.toBeNull();
    expect(entry!.success).toBe(true);
    expect(entry!.type).toBe("type");
    // Should hover first to focus, then type
    expect(simulateHover).toHaveBeenCalledTimes(1);
    expect(simulateKey).toHaveBeenCalledWith("space");
  });

  it("respects rate limiting", async () => {
    (getWindowAtPosition as any).mockResolvedValue({
      name: "Win",
      elementType: "window",
      bounds: [0, 0, 100, 100],
      isClickable: true,
    });
    engine.updateConfig({ ...baseConfig, rateLimitSec: 100 });

    const entry1 = await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);
    expect(entry1).not.toBeNull();

    const entry2 = await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);
    expect(entry2).toBeNull(); // rate limited
  });

  it("respects privacy pause", async () => {
    const entry = await engine.tryInteract({ x: 50, y: 50 }, "inspect", true);
    expect(entry).toBeNull();
  });

  it("respects opt-in acknowledgment", async () => {
    engine.updateConfig({ ...baseConfig, optInAcknowledged: false });
    const entry = await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);
    expect(entry).toBeNull();
  });

  it("only interacts in curious/playful behaviors", async () => {
    // "nap" is not in INTERACTION_BEHAVIORS
    const entry = await engine.tryInteract({ x: 50, y: 50 }, "nap", false);
    expect(entry).toBeNull();
  });

  it("logs interactions", async () => {
    (getWindowAtPosition as any).mockResolvedValue({
      name: "TestWin",
      elementType: "window",
      bounds: [0, 0, 100, 100],
      isClickable: true,
    });
    engine.updateConfig({ ...baseConfig, allowedInteractions: ["click"] });

    await engine.tryInteract({ x: 50, y: 50 }, "inspect", false);

    const log = engine.getLog();
    expect(log).toHaveLength(1);
    expect(log[0].targetElement).toBe("TestWin");
    expect(log[0].success).toBe(true);
  });

  it("getCooldownRemaining returns remaining seconds", () => {
    engine.updateConfig({ ...baseConfig, rateLimitSec: 100 });
    // No interaction yet → cooldown is 0 (or full? It's 0 because no interaction happened)
    // Actually after canInteract fails, cooldown should be full
    expect(engine.getCooldownRemaining()).toBe(0); // no interaction yet
  });
});
