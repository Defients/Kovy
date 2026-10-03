import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DragEngine,
  NULL_DRAG_OUTPUT,
  resolveDragAction,
  type DragOutput,
} from "@/engine/dragEngine";
import type { DragConfig } from "@/store/types";

const defaultConfig: DragConfig = {
  enabled: true,
  grabRadius: 60,
  releaseBehavior: "bounce",
  rememberSpots: true,
};

describe("DragEngine — core mechanics", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns disabled output when config disabled", () => {
    const engine = new DragEngine();
    const out = engine.update(0.016, { ...defaultConfig, enabled: false });
    expect(out.enabled).toBe(false);
    expect(out.isDragging).toBe(false);
  });

  it("startDrag sets isDragging and computes offset", () => {
    const engine = new DragEngine();
    engine.startDrag({ x: 100, y: 100 }, { x: 120, y: 130 });
    const out = engine.update(0.016, defaultConfig);
    expect(out.isDragging).toBe(true);
  });

  it("updateDrag moves position by offset", () => {
    const engine = new DragEngine();
    engine.startDrag({ x: 100, y: 100 }, { x: 120, y: 130 });
    engine.updateDrag({ x: 110, y: 105 }, 0.016);
    const out = engine.update(0.016, defaultConfig);
    expect(out.position.x).toBe(130); // 110 + (120-100)
    expect(out.position.y).toBe(135); // 105 + (130-100)
  });

  it("endDrag sets releaseBehavior and remembers spot", () => {
    const engine = new DragEngine();
    engine.startDrag({ x: 100, y: 100 }, { x: 120, y: 130 });
    engine.updateDrag({ x: 200, y: 200 }, 0.016);
    engine.endDrag(defaultConfig);
    const out = engine.update(0.016, defaultConfig);
    expect(out.isDragging).toBe(false);
    expect(out.releaseBehavior).toBe("bounce");
    expect(out.rememberedSpots.length).toBe(1);
    expect(out.rememberedSpots[0].x).toBe(220); // 200 + offset 20
  });

  it("releaseBehavior clears after 0.5s", () => {
    const engine = new DragEngine();
    engine.startDrag({ x: 100, y: 100 }, { x: 120, y: 130 });
    engine.endDrag(defaultConfig);
    // Before 0.5s — releaseBehavior should still be set
    let out = engine.update(0.3, defaultConfig);
    expect(out.releaseBehavior).toBe("bounce");
    // After 0.5s — should be cleared
    out = engine.update(0.3, defaultConfig);
    expect(out.releaseBehavior).toBeNull();
  });

  it("isWithinGrabRadius detects grab proximity", () => {
    const engine = new DragEngine();
    expect(engine.isWithinGrabRadius({ x: 100, y: 100 }, { x: 120, y: 130 }, defaultConfig)).toBe(true);
    expect(engine.isWithinGrabRadius({ x: 200, y: 200 }, { x: 120, y: 130 }, defaultConfig)).toBe(false);
  });

  it("velocity damps when not dragging", () => {
    const engine = new DragEngine();
    engine.startDrag({ x: 0, y: 0 }, { x: 0, y: 0 });
    engine.updateDrag({ x: 100, y: 0 }, 0.1);
    engine.endDrag(defaultConfig);
    const out1 = engine.update(0.1, defaultConfig);
    const out2 = engine.update(0.1, defaultConfig);
    // Velocity should decrease over time
    expect(Math.abs(out2.velocity.x)).toBeLessThan(Math.abs(out1.velocity.x));
  });
});

describe("resolveDragAction — pure function", () => {
  it("returns 'dragging' when isDragging is true", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: true,
      position: { x: 300, y: 200 },
      velocity: { x: 10, y: 0 },
      releaseBehavior: null,
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("dragging");
    if (action.type === "dragging") {
      expect(action.position).toEqual({ x: 300, y: 200 });
    }
  });

  it("returns 'release' with celebrate behavior for celebrate releaseBehavior", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: false,
      position: { x: 300, y: 200 },
      velocity: { x: 0, y: 0 },
      releaseBehavior: "celebrate",
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("release");
    if (action.type === "release") {
      expect(action.behavior).toBe("celebrate");
      expect(action.releaseBehavior).toBe("celebrate");
    }
  });

  it("returns 'release' with idle_float behavior for bounce releaseBehavior", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: false,
      position: { x: 300, y: 200 },
      velocity: { x: 0, y: 0 },
      releaseBehavior: "bounce",
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("release");
    if (action.type === "release") {
      expect(action.behavior).toBe("idle_float");
      expect(action.releaseBehavior).toBe("bounce");
    }
  });

  it("returns 'release' with idle_float behavior for settle releaseBehavior", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: false,
      position: { x: 300, y: 200 },
      velocity: { x: 0, y: 0 },
      releaseBehavior: "settle",
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("release");
    if (action.type === "release") {
      expect(action.behavior).toBe("idle_float");
      expect(action.releaseBehavior).toBe("settle");
    }
  });

  it("returns 'none' when disabled", () => {
    const action = resolveDragAction(NULL_DRAG_OUTPUT);
    expect(action.type).toBe("none");
  });

  it("returns 'none' when enabled but not dragging and no releaseBehavior", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: false,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      releaseBehavior: null,
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("none");
  });

  it("dragging takes priority over releaseBehavior", () => {
    const output: DragOutput = {
      enabled: true,
      isDragging: true,
      position: { x: 300, y: 200 },
      velocity: { x: 10, y: 0 },
      releaseBehavior: "celebrate", // should be ignored while dragging
      rememberedSpots: [],
    };
    const action = resolveDragAction(output);
    expect(action.type).toBe("dragging");
  });
});

describe("DragEngine — integration with resolveDragAction", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("full drag cycle: idle → drag → release → idle", () => {
    const engine = new DragEngine();
    const cfg = { ...defaultConfig, releaseBehavior: "celebrate" as const };

    // Initially idle
    let out = engine.update(0.016, cfg);
    expect(resolveDragAction(out).type).toBe("none");

    // Start drag
    engine.startDrag({ x: 100, y: 100 }, { x: 150, y: 150 });
    out = engine.update(0.016, cfg);
    expect(resolveDragAction(out).type).toBe("dragging");

    // Move during drag
    engine.updateDrag({ x: 200, y: 200 }, 0.016);
    out = engine.update(0.016, cfg);
    const dragAction = resolveDragAction(out);
    expect(dragAction.type).toBe("dragging");
    if (dragAction.type === "dragging") {
      expect(dragAction.position.x).toBe(250); // 200 + offset 50
      expect(dragAction.position.y).toBe(250);
    }

    // End drag → release
    engine.endDrag(cfg);
    out = engine.update(0.016, cfg);
    const releaseAction = resolveDragAction(out);
    expect(releaseAction.type).toBe("release");
    if (releaseAction.type === "release") {
      expect(releaseAction.behavior).toBe("celebrate");
    }

    // After 0.5s → back to none
    engine.update(0.6, cfg);
    out = engine.update(0.016, cfg);
    expect(resolveDragAction(out).type).toBe("none");
  });

  it("disabled config always returns 'none' action", () => {
    const engine = new DragEngine();
    const cfg = { ...defaultConfig, enabled: false };
    const out = engine.update(0.016, cfg);
    expect(resolveDragAction(out).type).toBe("none");
  });

  it("release event fires exactly once per release cycle (dedup)", () => {
    const engine = new DragEngine();
    const cfg = { ...defaultConfig, releaseBehavior: "celebrate" as const };

    // Start and end a drag
    engine.startDrag({ x: 0, y: 0 }, { x: 50, y: 50 });
    engine.updateDrag({ x: 100, y: 100 }, 0.016);
    engine.endDrag(cfg);

    // Simulate render loop: count how many times resolveDragAction returns "release"
    let releaseCount = 0;
    let currentOutput = engine.update(0.016, cfg);

    // Frame 1: should be release
    let action = resolveDragAction(currentOutput);
    if (action.type === "release") {
      releaseCount++;
      // Simulate renderer clearing releaseBehavior
      currentOutput = { ...currentOutput, releaseBehavior: null };
    }

    // Frame 2: simulate next drag engine update with cleared output
    // The renderer sets frameState.current.dragOutput = { ...dragOut, releaseBehavior: null }
    // So next frame, resolveDragAction should return "none"
    action = resolveDragAction({ ...currentOutput, releaseBehavior: null });
    expect(action.type).toBe("none");

    // Also verify the engine's own releaseBehavior expires after 0.5s
    engine.update(0.6, cfg);
    const expiredOut = engine.update(0.016, cfg);
    expect(resolveDragAction(expiredOut).type).toBe("none");

    expect(releaseCount).toBe(1);
  });

  it("multiple drag cycles each produce exactly one release", () => {
    const engine = new DragEngine();
    const cfg = { ...defaultConfig, releaseBehavior: "bounce" as const };
    let totalReleases = 0;

    for (let cycle = 0; cycle < 5; cycle++) {
      engine.startDrag({ x: 0, y: 0 }, { x: 50, y: 50 });
      engine.updateDrag({ x: 100 + cycle * 10, y: 100 }, 0.016);
      engine.endDrag(cfg);

      let out = engine.update(0.016, cfg);
      let action = resolveDragAction(out);
      if (action.type === "release") {
        totalReleases++;
        // Clear releaseBehavior as renderer does
        out = { ...out, releaseBehavior: null };
      }
      // Verify subsequent frames don't re-trigger
      action = resolveDragAction({ ...out, releaseBehavior: null });
      expect(action.type).toBe("none");

      // Let release expire
      engine.update(0.6, cfg);
    }

    expect(totalReleases).toBe(5);
  });
});
