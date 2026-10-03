// ============================================================
// Engine Error Boundary — wraps engine updates with structured
// error reporting, cooldowns, and auto-disable on repeated failures.
//
// Failed engines get a cooldown (skip updates for N seconds) instead
// of spamming errors. After 10 consecutive failures, the engine is
// auto-disabled until a config change triggers re-enable.
// ============================================================

import { recordError } from "./diagnosticsEngine";

export type EngineHealthStatus = "healthy" | "degraded" | "disabled";

export interface EngineHealth {
  name: string;
  status: EngineHealthStatus;
  failureCount: number;
  consecutiveFailures: number;
  lastError: string | null;
  lastErrorTime: number;
  cooldownUntil: number;
  totalUpdates: number;
  totalFailures: number;
}

const MAX_CONSECUTIVE_FAILURES = 10;
const COOLDOWN_BASE_MS = 2000;
const COOLDOWN_MAX_MS = 30000;

const healthMap = new Map<string, EngineHealth>();

function getOrCreateHealth(name: string): EngineHealth {
  let h = healthMap.get(name);
  if (!h) {
    h = {
      name,
      status: "healthy",
      failureCount: 0,
      consecutiveFailures: 0,
      lastError: null,
      lastErrorTime: 0,
      cooldownUntil: 0,
      totalUpdates: 0,
      totalFailures: 0,
    };
    healthMap.set(name, h);
  }
  return h;
}

/** Check if an engine is allowed to update (not in cooldown or disabled). */
export function canUpdate(engineName: string): boolean {
  const h = getOrCreateHealth(engineName);
  if (h.status === "disabled") return false;
  if (Date.now() < h.cooldownUntil) return false;
  return true;
}

/**
 * Safely execute an engine update function. If it throws, the error
 * is recorded, cooldown is applied, and consecutive failures tracked.
 * Returns the function result or null on failure.
 */
export function safeUpdate<T>(
  engineName: string,
  updateFn: () => T,
): T | null {
  const h = getOrCreateHealth(engineName);

  if (h.status === "disabled") return null;
  if (Date.now() < h.cooldownUntil) return null;

  try {
    const result = updateFn();
    h.totalUpdates++;
    if (h.consecutiveFailures > 0) {
      h.consecutiveFailures = 0;
      h.status = "healthy";
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    h.consecutiveFailures++;
    h.failureCount++;
    h.totalFailures++;
    h.lastError = msg;
    h.lastErrorTime = Date.now();

    const cooldown = Math.min(
      COOLDOWN_BASE_MS * h.consecutiveFailures,
      COOLDOWN_MAX_MS,
    );
    h.cooldownUntil = Date.now() + cooldown;

    if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      h.status = "disabled";
      recordError(
        `Engine "${engineName}" auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Last error: ${msg}`,
        `engineErrorBoundary:${engineName}`,
      );
    } else {
      h.status = "degraded";
      recordError(
        `Engine "${engineName}" update failed (${h.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${msg}`,
        `engineErrorBoundary:${engineName}`,
      );
    }

    return null;
  }
}

/**
 * Async version of safeUpdate for engines that return promises.
 * Catches both sync throws and async rejections.
 */
export async function safeUpdateAsync<T>(
  engineName: string,
  updateFn: () => Promise<T>,
): Promise<T | null> {
  const h = getOrCreateHealth(engineName);

  if (h.status === "disabled") return null;
  if (Date.now() < h.cooldownUntil) return null;

  try {
    const result = await updateFn();
    h.totalUpdates++;
    if (h.consecutiveFailures > 0) {
      h.consecutiveFailures = 0;
      h.status = "healthy";
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    h.consecutiveFailures++;
    h.failureCount++;
    h.totalFailures++;
    h.lastError = msg;
    h.lastErrorTime = Date.now();

    const cooldown = Math.min(
      COOLDOWN_BASE_MS * h.consecutiveFailures,
      COOLDOWN_MAX_MS,
    );
    h.cooldownUntil = Date.now() + cooldown;

    if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      h.status = "disabled";
      recordError(
        `Engine "${engineName}" auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive async failures. Last error: ${msg}`,
        `engineErrorBoundary:${engineName}`,
      );
    } else {
      h.status = "degraded";
      recordError(
        `Engine "${engineName}" async update failed (${h.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${msg}`,
        `engineErrorBoundary:${engineName}`,
      );
    }

    return null;
  }
}

/** Re-enable a previously disabled engine. Call on config change. */
export function reenableEngine(engineName: string): void {
  const h = getOrCreateHealth(engineName);
  h.status = "healthy";
  h.consecutiveFailures = 0;
  h.cooldownUntil = 0;
}

/** Re-enable all engines. Call on major config changes. */
export function reenableAllEngines(): void {
  for (const h of healthMap.values()) {
    h.status = "healthy";
    h.consecutiveFailures = 0;
    h.cooldownUntil = 0;
  }
}

/** Get health info for a specific engine. */
export function getEngineHealth(engineName: string): EngineHealth | null {
  return healthMap.get(engineName) ?? null;
}

/** Get health info for all tracked engines. */
export function getAllEngineHealth(): EngineHealth[] {
  return Array.from(healthMap.values());
}

/** Get a summary of engine health for the diagnostic dashboard. */
export function getEngineHealthSummary(): {
  total: number;
  healthy: number;
  degraded: number;
  disabled: number;
  engines: EngineHealth[];
} {
  const engines = getAllEngineHealth();
  return {
    total: engines.length,
    healthy: engines.filter(e => e.status === "healthy").length,
    degraded: engines.filter(e => e.status === "degraded").length,
    disabled: engines.filter(e => e.status === "disabled").length,
    engines,
  };
}
