// ============================================================
// Tests for multi-entity overlay mask computation.
// Verifies that every visible entity gets its own mask rect and
// that hidden entities are skipped.
// ============================================================

import { describe, it, expect } from "vitest";
import { computeEntityMaskRects, maskRectsKey } from "@/lib/overlayMaskUtils";

describe("computeEntityMaskRects", () => {
  it("returns no rects when no entities are visible", () => {
    const rects = computeEntityMaskRects(
      [{ x: 100, y: 200, visible: false }],
      1.0,
    );
    expect(rects).toEqual([]);
  });

  it("returns one rect for a single visible entity", () => {
    const rects = computeEntityMaskRects(
      [{ x: 500, y: 400, visible: true }],
      1.0,
    );
    expect(rects.length).toBe(1);
    const pad = 90 + 50 * 1.0; // 140
    expect(rects[0]).toEqual({
      x: 360,   // 500 - 140
      y: 260,   // 400 - 140
      w: 280,   // 140 * 2
      h: 280,
    });
  });

  it("returns one rect per visible entity (multi-entity)", () => {
    const rects = computeEntityMaskRects(
      [
        { x: 100, y: 100, visible: true },
        { x: 800, y: 600, visible: true },
        { x: 300, y: 300, visible: false }, // hidden — skipped
        { x: 1200, y: 100, visible: true },
      ],
      1.0,
    );
    expect(rects.length).toBe(3);
    // Each rect is centered on its entity
    expect(rects[0].x + rects[0].w / 2).toBe(100);
    expect(rects[1].x + rects[1].w / 2).toBe(800);
    expect(rects[2].x + rects[2].w / 2).toBe(1200);
  });

  it("scales padding with appearance.size", () => {
    const small = computeEntityMaskRects([{ x: 500, y: 400, visible: true }], 0.3)[0];
    const large = computeEntityMaskRects([{ x: 500, y: 400, visible: true }], 3.0)[0];
    expect(large.w).toBeGreaterThan(small.w);
    expect(large.h).toBeGreaterThan(small.h);
    // size 0.3 → pad 105, size 3.0 → pad 240
    expect(small.w).toBe(210);
    expect(large.w).toBe(480);
  });

  it("produces integer (rounded) coordinates", () => {
    const rects = computeEntityMaskRects(
      [{ x: 100.4, y: 200.6, visible: true }],
      1.0,
    );
    expect(Number.isInteger(rects[0].x)).toBe(true);
    expect(Number.isInteger(rects[0].y)).toBe(true);
    expect(Number.isInteger(rects[0].w)).toBe(true);
    expect(Number.isInteger(rects[0].h)).toBe(true);
  });

  it("returns empty array for empty entity list", () => {
    expect(computeEntityMaskRects([], 1.0)).toEqual([]);
  });
});

describe("maskRectsKey", () => {
  it("produces a stable key for the same rects", () => {
    const rects = [
      { x: 10, y: 20, w: 30, h: 40 },
      { x: 50, y: 60, w: 70, h: 80 },
    ];
    expect(maskRectsKey(rects)).toBe(maskRectsKey(rects));
  });

  it("produces different keys for different rects", () => {
    const a = [{ x: 10, y: 20, w: 30, h: 40 }];
    const b = [{ x: 11, y: 20, w: 30, h: 40 }];
    expect(maskRectsKey(a)).not.toBe(maskRectsKey(b));
  });

  it("produces empty string for empty array", () => {
    expect(maskRectsKey([])).toBe("");
  });

  it("encodes multiple rects with pipe separator", () => {
    const key = maskRectsKey([
      { x: 1, y: 2, w: 3, h: 4 },
      { x: 5, y: 6, w: 7, h: 8 },
    ]);
    expect(key).toBe("1,2,3,4|5,6,7,8");
  });
});
