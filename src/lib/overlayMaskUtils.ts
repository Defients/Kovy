// ============================================================
// Overlay mask computation — pure helper that turns entity
// positions + appearance config into the array of canvas-space
// rectangles the backend uses to suppress self-detection.
//
// Extracted from KovyRenderer so the multi-entity masking logic
// is unit-testable without a canvas / React tree.
// ============================================================

import type { OverlayMaskRect } from "@/lib/tauriBridge";

export interface EntityPosition {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Compute one mask rectangle per visible entity, padded around the
 * entity center to cover the body, emotes, and small particles.
 *
 * @param entities  founder + sibling positions (visible flag respected)
 * @param size      appearance.size (0.3 – 3.0) — scales the padding
 * @returns         array of canvas-space rects (empty if none visible)
 */
export function computeEntityMaskRects(
  entities: EntityPosition[],
  size: number,
): OverlayMaskRect[] {
  const pad = 90 + 50 * size; // half-extent in canvas px
  const rects: OverlayMaskRect[] = [];
  for (const e of entities) {
    if (!e.visible) continue;
    rects.push({
      x: Math.round(e.x - pad),
      y: Math.round(e.y - pad),
      w: Math.round(pad * 2),
      h: Math.round(pad * 2),
    });
  }
  return rects;
}

/**
 * Produce a stable string key from a set of mask rects, so callers can
 * skip IPC when nothing has moved meaningfully.
 */
export function maskRectsKey(rects: OverlayMaskRect[]): string {
  return rects.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join("|");
}
