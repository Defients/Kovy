// ============================================================
// Kovy Diagnostics Engine — local-only, privacy-first
// Zero data collected when opt-in is disabled.
// No network sending. Export only via explicit user action.
// ============================================================

import type { KovyConfig, BehaviorState, SurfaceMood, EntityId } from "@/store/types";
import { KOVY_VERSION } from "@/lib/version";

export interface DiagnosticEntry {
  timestamp: number;
  type: "fps" | "behavior" | "error" | "target" | "mood" | "entity_count";
  data: Record<string, unknown>;
}

interface DiagnosticsState {
  enabled: boolean;
  entries: DiagnosticEntry[];
  maxEntries: number;
  fpsHistory: number[];
  lastBehaviorState: BehaviorState | null;
  lastMood: SurfaceMood | null;
}

const state: DiagnosticsState = {
  enabled: false,
  entries: [],
  maxEntries: 500,
  fpsHistory: [],
  lastBehaviorState: null,
  lastMood: null,
};

/** Enable or disable diagnostics collection. When disabled, all data is cleared. */
export function setDiagnosticsEnabled(enabled: boolean): void {
  state.enabled = enabled;
  if (!enabled) {
    clearDiagnostics();
  }
}

/** Returns true if diagnostics collection is active */
export function isDiagnosticsEnabled(): boolean {
  return state.enabled;
}

/** Clear all collected diagnostics data */
export function clearDiagnostics(): void {
  state.entries = [];
  state.fpsHistory = [];
  state.lastBehaviorState = null;
  state.lastMood = null;
}

/** Record an FPS sample (called once per second from the render loop) */
export function recordFps(fps: number): void {
  if (!state.enabled) return;
  state.fpsHistory.push(fps);
  if (state.fpsHistory.length > 120) state.fpsHistory.shift();
  pushEntry("fps", { fps });
}

/** Record a behavior state change */
export function recordBehaviorChange(prev: BehaviorState, next: BehaviorState, entityId?: EntityId): void {
  if (!state.enabled) return;
  if (!entityId && next === state.lastBehaviorState) return;
  if (!entityId) state.lastBehaviorState = next;
  pushEntry("behavior", { from: prev, to: next, entityId: entityId ?? "kovy-prime" });
}

/** Record a mood change */
export function recordMoodChange(mood: SurfaceMood, entityId?: EntityId): void {
  if (!state.enabled) return;
  if (!entityId && mood === state.lastMood) return;
  if (!entityId) state.lastMood = mood;
  pushEntry("mood", { mood, entityId: entityId ?? "kovy-prime" });
}

/** Record entity count snapshot */
export function recordEntityCount(count: number): void {
  if (!state.enabled) return;
  pushEntry("entity_count", { count });
}

/** Record a target count snapshot */
export function recordTargetCount(count: number, topScore: number): void {
  if (!state.enabled) return;
  pushEntry("target", { count, topScore: Math.round(topScore * 100) / 100 });
}

/** Record an error */
export function recordError(message: string, source?: string): void {
  if (!state.enabled) return;
  // Never retain arbitrary exception text, URLs, paths, keys or provider bodies.
  void message; void source;
  pushEntry("error", { code: "runtime-error" });
}

function pushEntry(type: DiagnosticEntry["type"], data: Record<string, unknown>): void {
  state.entries.push({ timestamp: Date.now(), type, data });
  if (state.entries.length > state.maxEntries) {
    state.entries.shift();
  }
}

/** Get summary statistics for the diagnostics panel */
export function getDiagnosticsSummary(): {
  entryCount: number;
  avgFps: number;
  recentErrors: number;
  behaviorChanges: number;
} {
  const avgFps = state.fpsHistory.length > 0
    ? Math.round(state.fpsHistory.reduce((a, b) => a + b, 0) / state.fpsHistory.length)
    : 0;
  const recent = Date.now() - 60000; // last minute
  const recentErrors = state.entries.filter(e => e.type === "error" && e.timestamp > recent).length;
  const behaviorChanges = state.entries.filter(e => e.type === "behavior" && e.timestamp > recent).length;

  return {
    entryCount: state.entries.length,
    avgFps,
    recentErrors,
    behaviorChanges,
  };
}

/** System-level summary included in export bundles (privacy-safe, no raw app names or titles) */
export interface SystemSummary {
  entityCount: number;
  memoryEnabled: boolean;
  museActive: boolean;
  museMode: string;          // "code" | "writing" | "design" | "generic" | "inactive"
  museOverlayCount: number;
  gamingActive: boolean;
  milestoneSummary?: {
    enabled: boolean;
    totalMilestones: number;
    unlockedCount: number;
    totalActiveSeconds: number;
    totalInteractions: number;
    maxStreak: number;
  };
}

/**
 * Export diagnostics as a JSON bundle.
 * Includes only what the user has opted into.
 * Never includes screenshots, OCR text, or identifiable data.
 */
export function exportDiagnosticsBundle(config: KovyConfig, systemSummary?: SystemSummary): string {
  const bundle: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    kovyVersion: KOVY_VERSION,
    platform: /Win/i.test(navigator.platform) ? "Windows" : "other",
    diagnosticEntries: state.entries.map(e => ({ timestamp: e.timestamp, type: e.type,
      // Identifiers and arbitrary strings are omitted, even if a caller violates TS types.
      data: Object.fromEntries(Object.entries(e.data).filter(([key, value]) =>
        ["fps", "count", "topScore"].includes(key) && typeof value === "number" && Number.isFinite(value))),
    })),
    fpsHistory: state.fpsHistory.filter(v => typeof v === "number" && Number.isFinite(v)),
  };

  if (systemSummary) {
    bundle.systemSummary = {
      entityCount: typeof systemSummary.entityCount === "number" ? systemSummary.entityCount : 0,
      memoryEnabled: systemSummary.memoryEnabled === true,
      museActive: systemSummary.museActive === true,
      museOverlayCount: typeof systemSummary.museOverlayCount === "number" ? systemSummary.museOverlayCount : 0,
      gamingActive: systemSummary.gamingActive === true,
    };
  }

  if (config.privacy.diagnosticsIncludeConfig) {
    // Purpose-built projection: never recurse into config, profiles, rules or shadow copies.
    bundle.configSnapshot = {
      visionEnabled: config.vision.enabled === true,
      memoryEnabled: config.memory.enabled === true,
      aiEnabled: config.ai.enabled === true,
      screenshotSharing: config.ai.sendScreenshot === true,
      chatEnabled: config.chat.enabled === true,
      diagnosticsEnabled: config.privacy.diagnosticsOptIn === true,
      experimentalEnabled: config.experimental.enabled === true,
    };
  }

  if (!config.privacy.diagnosticsIncludeErrors) {
    // Strip error entries
    bundle.diagnosticEntries = (bundle.diagnosticEntries as DiagnosticEntry[])
      .filter(e => e.type !== "error");
  }

  return JSON.stringify(bundle, null, 2);
}

/**
 * What diagnostics collects (for display in UI):
 * - FPS / frame timing samples
 * - Behavior state transition log
 * - Mood change log
 * - Target count snapshots
 * - Error messages (if opted in)
 * - Sanitized config snapshot (if opted in)
 * - Milestone summary (total/unlocked counts, active time, interactions, max streak)
 *
 * What diagnostics NEVER collects:
 * - Screenshots or image data
 * - OCR text content
 * - Cursor position history
 * - Window titles or app names (Muse mode string only, not raw process names)
 * - Any personally identifiable information
 */
