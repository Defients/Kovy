import { describe, it, expect } from "vitest";
import {
  clamp, lerp, smoothstep, inverseLerp, mapRange,
  distance, randomRange, vec2Normalize, vec2Length, dampedSpring,
} from "../lib/utils";

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("passes through in range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("handles equal min/max", () => expect(clamp(5, 3, 3)).toBe(3));
});

describe("lerp", () => {
  it("returns a at t=0", () => expect(lerp(10, 20, 0)).toBe(10));
  it("returns b at t=1", () => expect(lerp(10, 20, 1)).toBe(20));
  it("returns midpoint at t=0.5", () => expect(lerp(0, 100, 0.5)).toBe(50));
});

describe("smoothstep", () => {
  it("returns 0 below edge0", () => expect(smoothstep(0, 1, -1)).toBe(0));
  it("returns 1 above edge1", () => expect(smoothstep(0, 1, 2)).toBe(1));
  it("returns ~0.5 at midpoint", () => {
    const val = smoothstep(0, 1, 0.5);
    expect(val).toBeCloseTo(0.5, 1);
  });
});

describe("inverseLerp", () => {
  it("returns 0 at a", () => expect(inverseLerp(10, 20, 10)).toBe(0));
  it("returns 1 at b", () => expect(inverseLerp(10, 20, 20)).toBe(1));
  it("clamps below 0", () => expect(inverseLerp(10, 20, 5)).toBe(0));
  it("handles equal a/b", () => expect(inverseLerp(5, 5, 5)).toBe(0));
});

describe("mapRange", () => {
  it("maps midpoint correctly", () => expect(mapRange(5, 0, 10, 0, 100)).toBe(50));
  it("maps edges", () => {
    expect(mapRange(0, 0, 10, 100, 200)).toBe(100);
    expect(mapRange(10, 0, 10, 100, 200)).toBe(200);
  });
});

describe("distance", () => {
  it("returns 0 for same point", () => expect(distance(3, 4, 3, 4)).toBe(0));
  it("returns correct distance", () => expect(distance(0, 0, 3, 4)).toBe(5));
});

describe("randomRange", () => {
  it("returns values within range", () => {
    for (let i = 0; i < 50; i++) {
      const val = randomRange(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
    }
  });
});

describe("vec2Normalize", () => {
  it("normalizes a vector", () => {
    const { x, y } = vec2Normalize(3, 4);
    expect(Math.sqrt(x * x + y * y)).toBeCloseTo(1, 5);
  });
  it("returns zero for zero vector", () => {
    const { x, y } = vec2Normalize(0, 0);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});

describe("vec2Length", () => {
  it("returns correct length", () => expect(vec2Length(3, 4)).toBe(5));
  it("returns 0 for zero vector", () => expect(vec2Length(0, 0)).toBe(0));
});

describe("dampedSpring", () => {
  it("moves toward target", () => {
    const result = dampedSpring(0, 10, 0, 5, 3, 0.016);
    expect(result.value).toBeGreaterThan(0);
    expect(result.velocity).toBeGreaterThan(0);
  });
  it("decelerates near target", () => {
    const result = dampedSpring(9.9, 10, 0.5, 5, 10, 0.016);
    // Velocity should be dampened
    expect(Math.abs(result.velocity)).toBeLessThan(5);
  });
});
