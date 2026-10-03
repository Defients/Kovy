// ============================================================
// Kovy Chronicle Storage — localStorage-backed snapshot store (v8.3)
//
// A thin, defensive wrapper around localStorage for persisting the
// daily ChronicleSnapshot array. The store is intentionally
// synchronous (localStorage is synchronous) and self-healing: any
// corrupt or malformed payload is discarded rather than crashing the
// render loop. All mutation paths go through `mergeSnapshot` (pure)
// so the on-disk array is always sorted and deduplicated by dateStr.
//
// The storage key is fixed ("kovy.chronicle.v1") so snapshots survive
// config migrations. Schema versioning lives in the snapshot shape
// itself; a v2 schema would migrate in `chronicleEngine`, not here.
// ============================================================

import type { ChronicleSnapshot } from "./chronicleEngine";
import { mergeSnapshot, pruneSnapshots } from "./chronicleEngine";

export const CHRONICLE_STORAGE_KEY = "kovy.chronicle.v1";

/**
 * Read all snapshots from localStorage. Returns [] when the store is
 * empty, missing, or corrupt. Never throws.
 */
export function loadSnapshots(): ChronicleSnapshot[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(CHRONICLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sanitizeSnapshots(parsed);
  } catch {
    return [];
  }
}

/**
 * Persist the full snapshot array. Never throws.
 */
export function saveSnapshots(snapshots: ChronicleSnapshot[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // Quota exceeded or storage disabled — silent. The chronicle is a
    // nice-to-have; we never want it to break the app.
  }
}

/**
 * Insert or replace a single snapshot (by dateStr), prune to the
 * retention window, and persist. Returns the new array. Never throws.
 */
export function persistSnapshot(
  snapshot: ChronicleSnapshot,
  retentionDays: number,
): ChronicleSnapshot[] {
  const existing = loadSnapshots();
  const merged = mergeSnapshot(existing, snapshot);
  const pruned = pruneSnapshots(merged, retentionDays);
  saveSnapshots(pruned);
  return pruned;
}

/**
 * Wipe the chronicle store entirely. Used by the "clear chronicle"
 * settings action and onboarding reset.
 */
export function clearSnapshots(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(CHRONICLE_STORAGE_KEY);
  } catch {
    // silent
  }
}

// --- Validation ---

/**
 * Coerce an unknown array into a clean ChronicleSnapshot[].
 * Drops any element that doesn't match the expected shape.
 */
function sanitizeSnapshots(arr: unknown[]): ChronicleSnapshot[] {
  const out: ChronicleSnapshot[] = [];
  for (const item of arr) {
    const s = coerceSnapshot(item);
    if (s) out.push(s);
  }
  // Deduplicate by dateStr (keep latest timestamp) and sort.
  const map = new Map<string, ChronicleSnapshot>();
  for (const s of out) {
    const prev = map.get(s.dateStr);
    if (!prev || s.timestamp > prev.timestamp) map.set(s.dateStr, s);
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function coerceSnapshot(item: unknown): ChronicleSnapshot | null {
  if (typeof item !== "object" || item === null) return null;
  const o = item as Record<string, unknown>;
  if (typeof o.dateStr !== "string" || typeof o.timestamp !== "number") return null;
  if (typeof o.bondPoints !== "number" || typeof o.surfaceMood !== "string") return null;
  return {
    dateStr: o.dateStr,
    timestamp: o.timestamp,
    bondPoints: o.bondPoints,
    bondLevel: typeof o.bondLevel === "string" ? (o.bondLevel as ChronicleSnapshot["bondLevel"]) : "stranger",
    surfaceMood: o.surfaceMood as ChronicleSnapshot["surfaceMood"],
    growthStage: typeof o.growthStage === "string" ? (o.growthStage as ChronicleSnapshot["growthStage"]) : null,
    focusMinutes: numOr(o.focusMinutes, 0),
    gamingSessions: numOr(o.gamingSessions, 0),
    emotes: numOr(o.emotes, 0),
    thoughts: numOr(o.thoughts, 0),
    whispers: numOr(o.whispers, 0),
    milestoneCount: numOr(o.milestoneCount, 0),
    activeSeconds: numOr(o.activeSeconds, 0),
    highlightTitle: typeof o.highlightTitle === "string" ? o.highlightTitle : null,
  };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
