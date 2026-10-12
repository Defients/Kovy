import { checkMemoryHealth } from "@/lib/memoryDb";
// ============================================================
// Kovy Memory Engine — writes, reads, prunes, and computes
// memory influence for behavior/mood engines.
//
// Significance scoring is heuristic-based:
//   duration, frequency, interaction count, valence intensity.
// Not ML. Not semantic. Honest bounded local memory.
//
// All data local-only. No cloud. No screenshots stored.
// ============================================================

import type {
  MemoryRecord, MemoryType, MemoryConfig, MemoryInfluence,
  InternalMoodState, SurfaceMood, PrivacyConfig,
} from "@/store/types";
import {
  writeMemory, getRecentMemories, getMemoriesByType,
  getAppAffinityData, getScheduleData, pruneMemories,
  getMemoryCount, isMemoryDbAvailable,
} from "@/lib/memoryDb";
import { getForegroundApp } from "@/lib/tauriBridge";
import { clamp } from "@/lib/utils";

// --- Tracking state (in-memory, not persisted) ---

interface AppSessionTracker {
  processName: string;
  windowTitle: string | null;
  startTime: number;
  lastSeenTime: number;
}

interface MoodEpisodeTracker {
  mood: SurfaceMood;
  startTime: number;
  avgStimulation: number;
  sampleCount: number;
}

interface MemoryEngineState {
  initialized: boolean;
  enabled: boolean;
  dbAvailable: boolean;

  // App session tracking
  currentApp: AppSessionTracker | null;
  appPollTimer: number;         // countdown to next foreground poll
  appPollInterval: number;      // seconds between polls (5s)

  // Interaction tracking
  interactionCount: number;
  interactionWindowStart: number;
  lastInteractionCommit: number;

  // Mood episode tracking
  currentMoodEpisode: MoodEpisodeTracker | null;

  // Quiet period tracking
  quietStart: number | null;
  lastActivityTime: number;

  // Write throttle
  writesSinceLastPrune: number;
  lastPruneTime: number;

  // Influence cache
  cachedInfluence: MemoryInfluence | null;
  influenceCacheTime: number;
  influenceCacheTtl: number;    // 60 seconds

  // Config refs
  entityId: string;
  sensitiveApps: string[];
}

const state: MemoryEngineState = {
  initialized: false,
  enabled: false,
  dbAvailable: false,
  currentApp: null,
  appPollTimer: 0,
  appPollInterval: 5,
  interactionCount: 0,
  interactionWindowStart: 0,
  lastInteractionCommit: 0,
  currentMoodEpisode: null,
  quietStart: null,
  lastActivityTime: Date.now(),
  writesSinceLastPrune: 0,
  lastPruneTime: 0,
  cachedInfluence: null,
  influenceCacheTime: 0,
  influenceCacheTtl: 60_000,
  entityId: "kovy-prime",
  sensitiveApps: [],
};

// --- Initialization ---

export async function initMemoryEngine(
  config: MemoryConfig,
  privacy: PrivacyConfig,
  entityId: string = "kovy-prime"
): Promise<void> {
  state.entityId = entityId;
  state.enabled = config.enabled;
  state.sensitiveApps = privacy.sensitiveApps.map(s => s.toLowerCase());

  if (!config.enabled) {
    state.initialized = true;
    return;
  }

  state.dbAvailable = await isMemoryDbAvailable();

  if (state.dbAvailable && config.pruneOnStartup) {
    const pruned = await pruneMemories(config);
    if (pruned > 0) {
      console.log(`Kovy Memory: Pruned ${pruned} old memories on startup`);
    }
  }

  state.lastPruneTime = Date.now();
  state.initialized = true;
}

// --- Config update (called when config changes) ---

export function updateMemoryConfig(config: MemoryConfig, privacy: PrivacyConfig): void {
  state.enabled = config.enabled;
  state.sensitiveApps = privacy.sensitiveApps.map(s => s.toLowerCase());
}

// --- Main update tick (called from animation loop, ~1/s is fine) ---

export async function updateMemoryEngine(
  dt: number,
  config: MemoryConfig,
  surfaceMood: SurfaceMood,
  stimulation: number,
  motionActivity: number,
  isInteracting: boolean,
): Promise<void> {
  if (!state.initialized || !state.enabled || !state.dbAvailable) return;

  // --- App session polling ---
  state.appPollTimer -= dt;
  if (state.appPollTimer <= 0) {
    state.appPollTimer = state.appPollInterval;
    await pollForegroundApp(config);
  }

  // --- Interaction tracking ---
  if (isInteracting) {
    const now = Date.now();
    if (now - state.interactionWindowStart > 60_000) {
      state.interactionCount = 0;
      state.interactionWindowStart = now;
    }
    state.interactionCount++;

    // Commit interaction memory if burst detected (>3 in 60s)
    if (
      state.interactionCount >= 3 &&
      now - state.lastInteractionCommit > 120_000
    ) {
      state.lastInteractionCommit = now;
      await commitMemory({
        type: "interaction",
        duration: 0,
        valence: 0.3,
        stimulation: 0.5,
        tags: "poke,interaction",
        summary: `Interaction burst: ${state.interactionCount} pokes`,
        appProcess: state.currentApp?.processName ?? null,
        appTitle: null,
        data: null,
      }, config);
      state.interactionCount = 0;
    }
  }

  // --- Mood episode tracking ---
  if (state.currentMoodEpisode) {
    if (state.currentMoodEpisode.mood !== surfaceMood) {
      const episodeDuration = (Date.now() - state.currentMoodEpisode.startTime) / 1000;
      // Commit if sustained mood lasted >3 minutes
      if (episodeDuration > 180) {
        await commitMemory({
          type: "mood_episode",
          duration: episodeDuration,
          valence: moodToValence(state.currentMoodEpisode.mood),
          stimulation: state.currentMoodEpisode.avgStimulation,
          tags: `mood:${state.currentMoodEpisode.mood}`,
          summary: `${state.currentMoodEpisode.mood} mood for ${Math.round(episodeDuration / 60)}min`,
          appProcess: state.currentApp?.processName ?? null,
          appTitle: null,
          data: null,
        }, config);
      }
      // Start new episode
      state.currentMoodEpisode = {
        mood: surfaceMood,
        startTime: Date.now(),
        avgStimulation: stimulation,
        sampleCount: 1,
      };
    } else {
      // Update running average
      state.currentMoodEpisode.avgStimulation =
        (state.currentMoodEpisode.avgStimulation * state.currentMoodEpisode.sampleCount + stimulation) /
        (state.currentMoodEpisode.sampleCount + 1);
      state.currentMoodEpisode.sampleCount++;
    }
  } else {
    state.currentMoodEpisode = {
      mood: surfaceMood,
      startTime: Date.now(),
      avgStimulation: stimulation,
      sampleCount: 1,
    };
  }

  // --- Quiet period tracking ---
  if (motionActivity < 0.05) {
    if (!state.quietStart) {
      state.quietStart = Date.now();
    }
  } else {
    if (state.quietStart) {
      const quietDuration = (Date.now() - state.quietStart) / 1000;
      // Record quiet periods >5 min
      if (quietDuration > 300) {
        await commitMemory({
          type: "quiet_period",
          duration: quietDuration,
          valence: 0.1,
          stimulation: 0.05,
          tags: "quiet,idle",
          summary: `Quiet period: ${Math.round(quietDuration / 60)}min`,
          appProcess: null,
          appTitle: null,
          data: null,
        }, config);
      }
      state.quietStart = null;
    }
    state.lastActivityTime = Date.now();
  }

  // --- High activity tracking ---
  if (motionActivity > 0.7) {
    // Just update lastActivityTime — high activity is tracked via app sessions
    state.lastActivityTime = Date.now();
  }
}

// --- Foreground app polling ---

async function pollForegroundApp(config: MemoryConfig): Promise<void> {
  if (!config.storeAppNames) return;

  const info = await getForegroundApp();
  const processName = info.processName;

  if (!processName) {
    return;
  }

  // Check if this is a sensitive app
  if (isSensitiveApp(processName)) {
    // End current session without recording the sensitive app
    if (state.currentApp) {
      await endAppSession(config, false);
    }
    state.currentApp = null;
    return;
  }

  const sanitizedTitle = config.storeWindowTitles
    ? sanitizeWindowTitle(info.windowTitle)
    : null;

  if (!state.currentApp || state.currentApp.processName !== processName) {
    // App changed — end previous session and start new one
    if (state.currentApp) {
      await endAppSession(config, true);
    }
    state.currentApp = {
      processName,
      windowTitle: sanitizedTitle,
      startTime: Date.now(),
      lastSeenTime: Date.now(),
    };
  } else {
    // Same app — update last seen
    state.currentApp.lastSeenTime = Date.now();
    if (sanitizedTitle) {
      state.currentApp.windowTitle = sanitizedTitle;
    }
  }
}

async function endAppSession(config: MemoryConfig, record: boolean): Promise<void> {
  if (!state.currentApp || !record) return;

  const duration = (state.currentApp.lastSeenTime - state.currentApp.startTime) / 1000;

  // Only record sessions longer than 5 minutes
  if (duration < 300) return;

  await commitMemory({
    type: "app_session",
    duration,
    valence: 0,   // neutral — valence drifts over time via preference memories
    stimulation: 0.5,
    tags: `app:${state.currentApp.processName}`,
    summary: `${state.currentApp.processName} session: ${Math.round(duration / 60)}min`,
    appProcess: state.currentApp.processName,
    appTitle: state.currentApp.windowTitle,
    data: null,
  }, config);
}

// --- Memory commit with significance scoring ---

interface MemoryDraft {
  type: MemoryType;
  duration: number;
  valence: number;
  stimulation: number;
  tags: string;
  summary: string;
  appProcess: string | null;
  appTitle: string | null;
  data: string | null;
}

async function commitMemory(draft: MemoryDraft, config: MemoryConfig): Promise<void> {
  const significance = computeSignificance(draft);

  if (significance < config.significanceThreshold) return;

  await writeMemory({
    entityId: state.entityId,
    type: draft.type,
    significance,
    timestamp: Date.now(),
    duration: draft.duration,
    valence: draft.valence,
    stimulation: draft.stimulation,
    tags: draft.tags,
    appProcess: draft.appProcess,
    appTitle: draft.appTitle,
    summary: draft.summary,
    data: draft.data,
  });

  state.writesSinceLastPrune++;

  // Prune after every 100 writes
  if (state.writesSinceLastPrune >= 100) {
    state.writesSinceLastPrune = 0;
    await pruneMemories(config);
  }
}

// --- Significance scoring (heuristic) ---

function computeSignificance(draft: MemoryDraft): number {
  let score = 0;

  // Duration component: longer events are more significant (log scale)
  if (draft.duration > 0) {
    score += clamp(Math.log10(draft.duration / 60 + 1) / 2, 0, 0.35);
  }

  // Valence intensity: strong emotions (positive or negative) are more memorable
  score += Math.abs(draft.valence) * 0.25;

  // Stimulation: high-stimulation events are more notable
  score += draft.stimulation * 0.2;

  // Type bonuses
  switch (draft.type) {
    case "interaction": score += 0.15; break;
    case "mood_episode": score += 0.1; break;
    case "app_session": score += 0.1; break;
    case "preference": score += 0.2; break;
    case "aversion": score += 0.2; break;
    default: score += 0.05; break;
  }

  return clamp(score, 0, 1);
}

// --- Memory influence retrieval (cached, called by behavior/mood engines) ---

export async function getMemoryInfluence(entityId: string): Promise<MemoryInfluence> {
  const now = Date.now();

  // Return cached if fresh
  if (
    state.cachedInfluence &&
    now - state.influenceCacheTime < state.influenceCacheTtl
  ) {
    return state.cachedInfluence;
  }

  const defaultInfluence: MemoryInfluence = {
    preferredApps: [],
    aversionApps: [],
    timeOfDayMoodBias: null,
    comfortLevel: 0.5,
    curiosityBias: 0,
  };

  if (!state.dbAvailable) {
    state.cachedInfluence = defaultInfluence;
    state.influenceCacheTime = now;
    return defaultInfluence;
  }

  try {
    // App affinities
    const appData = await getAppAffinityData(entityId);
    const preferredApps: string[] = [];
    const aversionApps: string[] = [];

    for (const app of appData) {
      if (app.avg_valence > 0.2 && app.count >= 3) {
        preferredApps.push(app.app_process);
      } else if (app.avg_valence < -0.2 && app.count >= 3) {
        aversionApps.push(app.app_process);
      }
    }

    // Time-of-day mood bias from schedule data
    const currentHour = new Date().getHours();
    const scheduleData = await getScheduleData(entityId);
    let timeOfDayMoodBias: Partial<InternalMoodState> | null = null;

    const hourData = scheduleData.filter(s => s.hour === currentHour);
    if (hourData.length > 0) {
      const avgStim = hourData.reduce((sum, h) => sum + h.avg_stimulation, 0) / hourData.length;
      timeOfDayMoodBias = {
        stimulation: avgStim,
      };
    }

    // Comfort level from recent memories
    const recentMemories = await getRecentMemories(entityId, 30);
    let comfortSum = 0;
    let comfortCount = 0;
    for (const mem of recentMemories) {
      if (mem.valence > 0) {
        comfortSum += mem.valence;
        comfortCount++;
      }
    }
    const comfortLevel = comfortCount > 0 ? clamp(comfortSum / comfortCount, 0, 1) : 0.5;

    // Curiosity bias from recent exploration patterns
    const recentHighActivity = recentMemories.filter(m => m.type === "high_activity" || m.stimulation > 0.6);
    const curiosityBias = clamp((recentHighActivity.length / 30) * 0.3 - 0.15, -0.3, 0.3);

    const influence: MemoryInfluence = {
      preferredApps: preferredApps.slice(0, 10),
      aversionApps: aversionApps.slice(0, 10),
      timeOfDayMoodBias,
      comfortLevel,
      curiosityBias,
    };

    state.cachedInfluence = influence;
    state.influenceCacheTime = now;
    return influence;
  } catch (e) {
    console.warn("Kovy Memory: Failed to compute influence", e);
    state.cachedInfluence = defaultInfluence;
    state.influenceCacheTime = now;
    return defaultInfluence;
  }
}

// --- Utility helpers ---

function isSensitiveApp(processName: string): boolean {
  const lower = processName.toLowerCase();
  return state.sensitiveApps.some(s => lower.includes(s));
}

function sanitizeWindowTitle(title: string | null): string | null {
  if (!title) return null;
  let sanitized = title;
  // Truncate to 60 chars
  if (sanitized.length > 60) sanitized = sanitized.slice(0, 60) + "…";
  // Strip common file path patterns
  sanitized = sanitized.replace(/[A-Z]:\\[^\s]+/gi, "[path]");
  // Strip URL-like patterns
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, "[url]");
  return sanitized;
}

function moodToValence(mood: SurfaceMood): number {
  switch (mood) {
    case "calm": return 0.2;
    case "curious": return 0.3;
    case "playful": return 0.4;
    case "focused": return 0.2;
    case "sleepy": return -0.1;
    case "excited": return 0.5;
    case "overwhelmed": return -0.4;
    case "shy": return -0.2;
    default: return 0;
  }
}

// --- Stats for settings UI ---

export async function getMemoryStats(): Promise<{
  totalCount: number; entityCount: number; dbAvailable: boolean; writable: boolean;
}> {
  const health = await checkMemoryHealth();
  const entityCount = health.readable ? await getMemoryCount(state.entityId) : 0;
  return { totalCount: entityCount, entityCount, dbAvailable: health.readable, writable: health.writable };
}

// --- Cleanup ---

export function destroyMemoryEngine(): void {
  // Flush current app session
  if (state.currentApp) {
    state.currentApp = null;
  }
  state.initialized = false;
  state.cachedInfluence = null;
}

// --- Memory timeline for visualization (v7.0) ---

export async function getMemoryTimeline(days: number = 30): Promise<Array<{
  timestamp: number;
  type: string;
  significance: number;
  valence: number;
}>> {
  if (!state.dbAvailable) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const memories = await getRecentMemories(state.entityId, 200);
  return memories
    .filter((m: any) => m.timestamp >= cutoff)
    .map((m: any) => ({
      timestamp: m.timestamp,
      type: m.type,
      significance: m.significance,
      valence: m.valence,
    }));
}
