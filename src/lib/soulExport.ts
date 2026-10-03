// ============================================================
// Kovy Soul Export/Import — plaintext JSON, versioned schema
// No encryption in 4.0. File includes explicit warning.
// Exports memory summaries (aggregated), NOT raw records.
// ============================================================

import type {
  SoulExportV1, SoulExportV2, SoulEntity, MemorySummary, ScheduleAffinity,
  AppAffinity, MemoryType, PersonalityOffsets, HabitatConfig,
} from "@/store/types";
import { DEFAULT_PERSONALITY } from "@/store/defaults";
import { KOVY_VERSION } from "@/lib/version";
import {
  getMemorySummariesByType, getAppAffinityData, getScheduleData,
} from "@/lib/memoryDb";

const SOUL_VERSION = 2;
const SOUL_WARNING = "This file is not encrypted. Do not share if it contains personal data.";
const MAX_EXPORT_SIZE = 2 * 1024 * 1024; // 2MB

// --- Export ---

export async function exportSoul(
  entityId: string,
  habitat: HabitatConfig
): Promise<string> {
  // Build entity entry (single entity in Phase 2)
  const entity: SoulEntity = {
    id: entityId,
    name: entityId === "kovy-prime" ? "Kovy" : entityId,
    isFounder: entityId === "kovy-prime",
    personality: { ...DEFAULT_PERSONALITY },
    museEnabled: false,
    preferredHomeId: null,
    territoryBias: 0.5,
  };

  // Build memory summaries
  const rawSummaries = await getMemorySummariesByType(entityId);
  const memorySummaries: MemorySummary[] = rawSummaries.map(s => ({
    type: s.type as MemoryType,
    count: s.count,
    avgSignificance: Math.round(s.avg_significance * 100) / 100,
    avgValence: Math.round(s.avg_valence * 100) / 100,
    topTags: extractTopTags(s.all_tags, 10),
  }));

  // Build app affinities
  const rawApps = await getAppAffinityData(entityId);
  const appAffinities: AppAffinity[] = rawApps.slice(0, 20).map(a => ({
    processName: a.app_process,
    familiarity: Math.min(1, a.count / 50),
    valence: Math.round(a.avg_valence * 100) / 100,
    totalDuration: Math.round(a.total_duration),
  }));

  // Build schedule affinities
  const rawSchedule = await getScheduleData(entityId);
  const scheduleAffinities: ScheduleAffinity[] = rawSchedule.slice(0, 48).map(s => ({
    hourOfDay: s.hour,
    dayOfWeek: s.dow,
    typicalMood: "calm", // simplified — would need mood column in schedule query for real mapping
    activityLevel: Math.round(s.avg_stimulation * 100) / 100,
  }));

  // Build habitat affinities
  const favoriteHomeIds = habitat.homes.map(h => h.id);
  const preferredZoneTypes = [...new Set(habitat.zones.map(z => z.type))];

  const soul: SoulExportV2 = {
    version: SOUL_VERSION,
    exportedAt: new Date().toISOString(),
    kovyVersion: KOVY_VERSION,
    warning: SOUL_WARNING,
    entities: [entity],
    globalPreferences: {
      memorySummaries,
      scheduleAffinities,
      appAffinities,
    },
    habitatAffinities: {
      favoriteHomeIds,
      preferredZoneTypes,
    },
    musePreferences: {
      preferredStyle: "subtle",
      contextWeights: {},
    },
    expansionData: {
      ritualHistorySummary: [],
      journalEntryCount: 0,
      appProfileCount: 0,
      activeSkinId: null,
      activeSoundPackId: null,
    },
  };

  let json = JSON.stringify(soul, null, 2);

  // Enforce max size by trimming summaries if needed
  if (json.length > MAX_EXPORT_SIZE) {
    soul.globalPreferences.memorySummaries = memorySummaries.slice(0, 5);
    soul.globalPreferences.appAffinities = appAffinities.slice(0, 10);
    soul.globalPreferences.scheduleAffinities = scheduleAffinities.slice(0, 24);
    json = JSON.stringify(soul, null, 2);
  }

  return json;
}

// --- Import ---

export interface SoulImportResult {
  success: boolean;
  errors: string[];
  entity: SoulEntity | null;
  memorySummaryCount: number;
  appAffinityCount: number;
}

export function importSoul(json: string): SoulImportResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return {
      success: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`],
      entity: null,
      memorySummaryCount: 0,
      appAffinityCount: 0,
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      success: false,
      errors: ["Soul file is not a valid object"],
      entity: null,
      memorySummaryCount: 0,
      appAffinityCount: 0,
    };
  }

  const soul = parsed as Record<string, unknown>;

  // Version check
  if (typeof soul.version !== "number") {
    errors.push("Missing version field");
    return { success: false, errors, entity: null, memorySummaryCount: 0, appAffinityCount: 0 };
  }

  if (soul.version > SOUL_VERSION) {
    errors.push(`Soul version ${soul.version} is newer than supported ${SOUL_VERSION}`);
    return { success: false, errors, entity: null, memorySummaryCount: 0, appAffinityCount: 0 };
  }

  // v1 souls are still importable — they just lack expansionData
  if (soul.version < SOUL_VERSION) {
    // v1 → v2: expansionData fields default to empty
  }

  // Extract entity
  const entities = soul.entities as SoulEntity[] | undefined;
  const entity = entities && entities.length > 0 ? validateEntity(entities[0], errors) : null;

  // Count imported data
  const prefs = soul.globalPreferences as Record<string, unknown> | undefined;
  const memorySummaryCount = Array.isArray(prefs?.memorySummaries) ? (prefs.memorySummaries as unknown[]).length : 0;
  const appAffinityCount = Array.isArray(prefs?.appAffinities) ? (prefs.appAffinities as unknown[]).length : 0;

  return {
    success: errors.length === 0,
    errors,
    entity,
    memorySummaryCount,
    appAffinityCount,
  };
}

// --- Helpers ---

function validateEntity(raw: unknown, errors: string[]): SoulEntity | null {
  if (typeof raw !== "object" || raw === null) {
    errors.push("Invalid entity object");
    return null;
  }

  const obj = raw as Record<string, unknown>;

  const entity: SoulEntity = {
    id: typeof obj.id === "string" ? obj.id : "kovy-prime",
    name: typeof obj.name === "string" ? obj.name : "Kovy",
    isFounder: typeof obj.isFounder === "boolean" ? obj.isFounder : true,
    personality: validatePersonality(obj.personality),
    museEnabled: typeof obj.museEnabled === "boolean" ? obj.museEnabled : false,
    preferredHomeId: typeof obj.preferredHomeId === "string" ? obj.preferredHomeId : null,
    territoryBias: typeof obj.territoryBias === "number" ? Math.max(0, Math.min(1, obj.territoryBias)) : 0.5,
  };

  return entity;
}

function validatePersonality(raw: unknown): PersonalityOffsets {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PERSONALITY };

  const obj = raw as Record<string, unknown>;
  const clampBias = (v: unknown, range: number) =>
    typeof v === "number" ? Math.max(-range, Math.min(range, v)) : 0;

  return {
    curiosityBias: clampBias(obj.curiosityBias, 0.3),
    energyBias: clampBias(obj.energyBias, 0.3),
    shynessBias: clampBias(obj.shynessBias, 0.3),
    playfulnessBias: clampBias(obj.playfulnessBias, 0.3),
    wanderBias: clampBias(obj.wanderBias, 0.3),
    colorHueOffset: clampBias(obj.colorHueOffset, 30),
    sizeOffset: clampBias(obj.sizeOffset, 0.5),
  };
}

function extractTopTags(allTags: string, limit: number): string[] {
  if (!allTags) return [];
  const tagCounts = new Map<string, number>();
  const tags = allTags.split(",").map(t => t.trim()).filter(Boolean);
  for (const tag of tags) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
