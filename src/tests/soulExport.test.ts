import { describe, it, expect } from "vitest";
import { importSoul } from "../lib/soulExport";
import type { SoulExportV1 } from "../store/types";
import { DEFAULT_PERSONALITY } from "../store/defaults";

function makeValidSoul(): SoulExportV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    kovyVersion: "4.0.0",
    warning: "This file is not encrypted. Do not share if it contains personal data.",
    entities: [
      {
        id: "kovy-prime",
        name: "Kovy",
        isFounder: true,
        personality: { ...DEFAULT_PERSONALITY },
        museEnabled: false,
        preferredHomeId: null,
        territoryBias: 0.5,
      },
    ],
    globalPreferences: {
      memorySummaries: [
        { type: "app_session", count: 10, avgSignificance: 0.6, avgValence: 0.2, topTags: ["app:code"] },
      ],
      scheduleAffinities: [],
      appAffinities: [
        { processName: "code.exe", familiarity: 0.8, valence: 0.3, totalDuration: 36000 },
      ],
    },
    habitatAffinities: {
      favoriteHomeIds: [],
      preferredZoneTypes: [],
    },
    musePreferences: {
      preferredStyle: "subtle",
      contextWeights: {},
    },
  };
}

describe("Soul import", () => {
  it("imports a valid soul file", () => {
    const soul = makeValidSoul();
    const json = JSON.stringify(soul);
    const result = importSoul(json);
    expect(result.success).toBe(true);
    expect(result.entity).not.toBeNull();
    expect(result.entity!.id).toBe("kovy-prime");
    expect(result.entity!.name).toBe("Kovy");
    expect(result.entity!.isFounder).toBe(true);
    expect(result.memorySummaryCount).toBe(1);
    expect(result.appAffinityCount).toBe(1);
  });

  it("rejects invalid JSON", () => {
    const result = importSoul("not json at all {{{");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.entity).toBeNull();
  });

  it("rejects non-object input", () => {
    const result = importSoul('"just a string"');
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes("not a valid object"))).toBe(true);
  });

  it("rejects missing version", () => {
    const result = importSoul(JSON.stringify({ entities: [] }));
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes("version"))).toBe(true);
  });

  it("rejects future version", () => {
    const soul = makeValidSoul();
    (soul as any).version = 99;
    const result = importSoul(JSON.stringify(soul));
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes("newer"))).toBe(true);
  });

  it("handles missing entity gracefully", () => {
    const soul = makeValidSoul();
    soul.entities = [];
    const result = importSoul(JSON.stringify(soul));
    expect(result.success).toBe(true); // no entity is not an error — just empty
    expect(result.entity).toBeNull();
  });

  it("clamps personality offsets to valid ranges", () => {
    const soul = makeValidSoul();
    soul.entities[0].personality = {
      curiosityBias: 5.0, // way out of range
      energyBias: -10.0,
      shynessBias: 0.1,
      playfulnessBias: 0,
      wanderBias: 0,
      colorHueOffset: 100,
      sizeOffset: -1.0,
    };
    const result = importSoul(JSON.stringify(soul));
    expect(result.success).toBe(true);
    expect(result.entity!.personality.curiosityBias).toBe(0.3);
    expect(result.entity!.personality.energyBias).toBe(-0.3);
    expect(result.entity!.personality.colorHueOffset).toBe(30);
    expect(result.entity!.personality.sizeOffset).toBe(-0.5);
  });

  it("fills missing personality fields with defaults", () => {
    const soul = makeValidSoul();
    (soul.entities[0] as any).personality = { curiosityBias: 0.1 };
    const result = importSoul(JSON.stringify(soul));
    expect(result.success).toBe(true);
    expect(result.entity!.personality.energyBias).toBe(0);
    expect(result.entity!.personality.wanderBias).toBe(0);
  });

  it("includes warning field in export schema", () => {
    const soul = makeValidSoul();
    expect(soul.warning).toContain("not encrypted");
  });

  it("handles entity with missing optional fields", () => {
    const soul = makeValidSoul();
    (soul.entities[0] as any) = { id: "test-kovy" };
    const result = importSoul(JSON.stringify(soul));
    expect(result.success).toBe(true);
    expect(result.entity!.name).toBe("Kovy"); // falls back to default
    expect(result.entity!.isFounder).toBe(true); // falls back to default
    expect(result.entity!.personality.curiosityBias).toBe(0);
  });

  it("counts memory summaries and app affinities correctly", () => {
    const soul = makeValidSoul();
    soul.globalPreferences.memorySummaries = [
      { type: "app_session", count: 5, avgSignificance: 0.5, avgValence: 0.1, topTags: [] },
      { type: "interaction", count: 3, avgSignificance: 0.7, avgValence: 0.3, topTags: [] },
      { type: "mood_episode", count: 8, avgSignificance: 0.4, avgValence: -0.1, topTags: [] },
    ];
    soul.globalPreferences.appAffinities = [
      { processName: "a.exe", familiarity: 0.5, valence: 0.2, totalDuration: 1000 },
      { processName: "b.exe", familiarity: 0.3, valence: -0.1, totalDuration: 500 },
    ];
    const result = importSoul(JSON.stringify(soul));
    expect(result.memorySummaryCount).toBe(3);
    expect(result.appAffinityCount).toBe(2);
  });
});
