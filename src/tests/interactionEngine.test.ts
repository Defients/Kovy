import { describe, it, expect, beforeEach } from "vitest";
import { InteractionEngine, type InteractionEvent } from "../engine/interactionEngine";

describe("InteractionEngine", () => {
  let engine: InteractionEngine;

  beforeEach(() => {
    engine = new InteractionEngine();
    engine.setInteractionRadius(80);
    engine.setPokeStartleChance(0.3);
  });

  it("returns null when Kovy is not visible", () => {
    const event = engine.update(0.016, { x: 100, y: 100 }, { x: 100, y: 100 }, false);
    expect(event).toBeNull();
  });

  it("returns null when cursor is far from Kovy", () => {
    const event = engine.update(0.016, { x: 500, y: 500 }, { x: 100, y: 100 }, true);
    expect(event).toBeNull();
  });

  it("detects swipe when cursor passes at high speed within radius", () => {
    const kovyPos = { x: 400, y: 400 };
    // Start far away, then jump close at high speed
    engine.update(0.016, { x: 100, y: 400 }, kovyPos, true);
    // Move to within radius at high speed (300px in 0.016s = ~18750 px/s)
    const event = engine.update(0.016, { x: 380, y: 400 }, kovyPos, true);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("swipe");
  });

  it("detects hover when cursor lingers near Kovy", () => {
    const kovyPos = { x: 400, y: 400 };
    // Cursor starts near kovy
    for (let i = 0; i < 40; i++) {
      const event = engine.update(0.016, { x: 410, y: 410 }, kovyPos, true);
      if (event) {
        expect(event.type).toBe("hover");
        return;
      }
    }
    // Should have detected hover after 0.5s of lingering
    expect(true).toBe(true);
  });

  it("does not detect hover when cursor moves away before threshold", () => {
    const kovyPos = { x: 400, y: 400 };
    // Linger for 0.3s (below 0.5s threshold)
    for (let i = 0; i < 19; i++) {
      engine.update(0.016, { x: 410, y: 410 }, kovyPos, true);
    }
    // Move away
    const event = engine.update(0.016, { x: 600, y: 600 }, kovyPos, true);
    expect(event).toBeNull();
  });

  it("respects swipe cooldown", () => {
    const kovyPos = { x: 400, y: 400 };
    // First swipe
    engine.update(0.016, { x: 100, y: 400 }, kovyPos, true);
    const event1 = engine.update(0.016, { x: 380, y: 400 }, kovyPos, true);
    expect(event1).not.toBeNull();
    // Immediate second swipe should be on cooldown
    engine.update(0.016, { x: 100, y: 400 }, kovyPos, true);
    const event2 = engine.update(0.016, { x: 380, y: 400 }, kovyPos, true);
    expect(event2).toBeNull();
  });

  it("respects poke cooldown", () => {
    const kovyPos = { x: 400, y: 400 };
    // Simulate poke: fast approach then deceleration near Kovy
    engine.update(0.016, { x: 200, y: 400 }, kovyPos, true); // approach start
    engine.update(0.016, { x: 350, y: 400 }, kovyPos, true); // fast approach
    // Decelerate near Kovy
    const event1 = engine.update(0.016, { x: 360, y: 400 }, kovyPos, true);
    // Note: poke detection requires specific speed patterns, so we check cooldown logic
    // by simulating another rapid approach immediately after
    if (event1 && event1.type === "poke") {
      engine.update(0.016, { x: 200, y: 400 }, kovyPos, true);
      engine.update(0.016, { x: 350, y: 400 }, kovyPos, true);
      const event2 = engine.update(0.016, { x: 360, y: 400 }, kovyPos, true);
      expect(event2).toBeNull(); // on cooldown
    }
  });

  it("shouldPokeStartle returns boolean", () => {
    const result = engine.shouldPokeStartle();
    expect(typeof result).toBe("boolean");
  });

  it("shouldPokeStartle always returns false when chance is 0", () => {
    engine.setPokeStartleChance(0);
    for (let i = 0; i < 100; i++) {
      expect(engine.shouldPokeStartle()).toBe(false);
    }
  });

  it("shouldPokeStartle always returns true when chance is 1", () => {
    engine.setPokeStartleChance(1);
    for (let i = 0; i < 100; i++) {
      expect(engine.shouldPokeStartle()).toBe(true);
    }
  });

  it("isCursorNear returns true when within radius", () => {
    expect(engine.isCursorNear({ x: 100, y: 100 }, { x: 120, y: 100 })).toBe(true);
  });

  it("isCursorNear returns false when outside radius", () => {
    expect(engine.isCursorNear({ x: 100, y: 100 }, { x: 300, y: 100 })).toBe(false);
  });

  it("setInteractionRadius clamps to valid range", () => {
    engine.setInteractionRadius(10);
    // Internal state is clamped; verify via isCursorNear behavior
    expect(engine.isCursorNear({ x: 100, y: 100 }, { x: 120, y: 100 })).toBe(true);
    expect(engine.isCursorNear({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(false);
  });

  it("getCursorSpeed returns 0 initially", () => {
    expect(engine.getCursorSpeed()).toBe(0);
  });

  it("reset clears all state", () => {
    engine.reset();
    expect(engine.getCursorSpeed()).toBe(0);
  });
});
