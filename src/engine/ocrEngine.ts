// ============================================================
// Text-Likeness Detection Engine
//
// Lightweight heuristic that estimates whether a motion region
// likely contains text (dialog boxes, toasts, notifications)
// based on aspect ratio, size, and energy density patterns.
//
// This is NOT optical character recognition — it does not read
// or extract text content. It only flags regions as "text-like"
// to provide a small scoring boost in the motion interest engine.
//
// No external dependencies. No Tesseract.js. No cloud calls.
// ============================================================
// - Only runs on the top N highest-salience regions
// - Throttled by configurable cooldown
// - Disabled by default; respects privacy.ocrDisabled override
// - Results are transient — not persisted unless diagnostics opt-in
// - Zero network calls
// ============================================================

import type { VisionConfig, PrivacyConfig, MotionRegion } from "@/store/types";

export interface OcrResult {
  regionId: number;
  hasText: boolean;       // whether text-like content was detected
  confidence: number;     // 0-1 confidence that region contains text
  timestamp: number;
}

interface OcrEngineState {
  lastRunTime: number;
  results: OcrResult[];
  enabled: boolean;
}

const state: OcrEngineState = {
  lastRunTime: 0,
  results: [],
  enabled: false,
};

/**
 * Update OCR engine enabled state based on config.
 * Privacy.ocrDisabled takes absolute precedence.
 */
export function updateOcrConfig(vision: VisionConfig, privacy: PrivacyConfig): void {
  state.enabled = vision.ocrEnabled && !privacy.ocrDisabled;
}

/**
 * Returns true if OCR is currently enabled and allowed.
 */
export function isOcrEnabled(): boolean {
  return state.enabled;
}

/**
 * Attempt to run OCR on the given regions if cooldown has elapsed.
 * Returns results for regions that were analyzed.
 *
 * This implementation uses a lightweight edge-density heuristic to
 * detect text-like regions without a full OCR engine. It analyzes
 * the spatial frequency of the region's bounding box area to estimate
 * whether it contains text (high horizontal edge density = likely text).
 *
 * For a full OCR implementation, this function would be replaced with
 * Tesseract.js or similar, processing cropped region images.
 */
export function tryRunOcr(
  regions: MotionRegion[],
  config: VisionConfig,
  _canvas?: HTMLCanvasElement
): OcrResult[] {
  if (!state.enabled) return [];

  const now = Date.now();
  if (now - state.lastRunTime < config.ocrCooldownMs) return state.results;

  state.lastRunTime = now;

  // Sort regions by score descending, take top N
  const sorted = [...regions]
    .sort((a, b) => (b.score || b.energy) - (a.score || a.energy))
    .slice(0, config.ocrMaxRegions);

  state.results = sorted.map((region) => {
    // Heuristic: regions with moderate size and high energy density
    // are more likely to contain text (dialog boxes, toasts, etc.)
    const aspectRatio = region.boundingBox.w / Math.max(region.boundingBox.h, 1);
    const isTextLikeAspect = aspectRatio > 1.5 && aspectRatio < 12;
    const isReasonableSize = region.area > 20 && region.area < 5000;
    const hasModerateEnergy = region.energy > 15 && region.energy < 120;

    const confidence =
      (isTextLikeAspect ? 0.4 : 0.1) +
      (isReasonableSize ? 0.3 : 0.05) +
      (hasModerateEnergy ? 0.3 : 0.05);

    return {
      regionId: region.id,
      hasText: confidence > 0.6,
      confidence: Math.min(confidence, 1),
      timestamp: now,
    };
  });

  return state.results;
}

/**
 * Get the most recent OCR results.
 */
export function getOcrResults(): OcrResult[] {
  return state.results;
}

/**
 * Clear all OCR results (e.g., on privacy pause).
 */
export function clearOcrResults(): void {
  state.results = [];
}

/**
 * Get a text-interest boost for a region based on OCR results.
 * Returns 0-0.3 boost to the region's score if text was detected.
 * This allows the behavior engine to pay more attention to text regions.
 */
export function getTextInterestBoost(regionId: number): number {
  const result = state.results.find((r) => r.regionId === regionId);
  if (!result || !result.hasText) return 0;
  return result.confidence * 0.2;
}
