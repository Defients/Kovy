import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSnapshots,
  saveSnapshots,
  persistSnapshot,
  clearSnapshots,
  CHRONICLE_STORAGE_KEY,
} from "../engine/chronicleStorage";
import type { ChronicleSnapshot } from "../engine/chronicleEngine";
import { localDateStr } from "../engine/chronicleEngine";

// Stub localStorage for each test
const store: Record<string, string> = {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 11, 21, 0, 0));
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function snap(date: Date, overrides: Partial<ChronicleSnapshot> = {}): ChronicleSnapshot {
  return {
    dateStr: localDateStr(date),
    timestamp: date.getTime(),
    bondPoints: 200,
    bondLevel: "companion",
    surfaceMood: "curious",
    growthStage: "young",
    focusMinutes: 100,
    gamingSessions: 2,
    emotes: 10,
    thoughts: 20,
    whispers: 5,
    milestoneCount: 3,
    activeSeconds: 3600,
    highlightTitle: "✦ A good day",
    ...overrides,
  };
}

describe("loadSnapshots", () => {
  it("returns [] when localStorage is empty", () => {
    expect(loadSnapshots()).toEqual([]);
  });

  it("returns [] when the stored payload is not an array", () => {
    store[CHRONICLE_STORAGE_KEY] = JSON.stringify({ not: "an array" });
    expect(loadSnapshots()).toEqual([]);
  });

  it("returns [] when the stored payload is corrupt JSON", () => {
    store[CHRONICLE_STORAGE_KEY] = "{not valid json";
    expect(loadSnapshots()).toEqual([]);
  });

  it("returns [] when localStorage is undefined (SSR/test env)", () => {
    vi.unstubAllGlobals();
    expect(loadSnapshots()).toEqual([]);
  });

  it("round-trips a saved array", () => {
    const a = snap(new Date(2026, 7, 10, 21, 0, 0));
    const b = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    saveSnapshots([a, b]);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(2);
    expect(loaded[0].dateStr).toBe("2026-08-10");
    expect(loaded[1].bondPoints).toBe(250);
  });

  it("drops malformed elements and keeps valid ones", () => {
    const good = snap(new Date(2026, 7, 11, 21, 0, 0));
    const bad = { not: "a snapshot" } as unknown;
    store[CHRONICLE_STORAGE_KEY] = JSON.stringify([bad, good, "string"]);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(1);
    expect(loaded[0].dateStr).toBe("2026-08-11");
  });

  it("deduplicates by dateStr (keeps latest timestamp)", () => {
    const morning = snap(new Date(2026, 7, 11, 8, 0, 0), { bondPoints: 100 });
    const evening = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    store[CHRONICLE_STORAGE_KEY] = JSON.stringify([morning, evening]);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(1);
    expect(loaded[0].bondPoints).toBe(250);
  });

  it("sorts the result ascending by timestamp", () => {
    const c = snap(new Date(2026, 7, 11, 21, 0, 0));
    const a = snap(new Date(2026, 7, 9, 21, 0, 0));
    const b = snap(new Date(2026, 7, 10, 21, 0, 0));
    store[CHRONICLE_STORAGE_KEY] = JSON.stringify([c, a, b]);
    const loaded = loadSnapshots();
    expect(loaded.map(s => s.dateStr)).toEqual(["2026-08-09", "2026-08-10", "2026-08-11"]);
  });

  it("coerces missing numeric fields to 0", () => {
    const partial = {
      dateStr: "2026-08-11",
      timestamp: Date.now(),
      bondPoints: 100,
      bondLevel: "companion",
      surfaceMood: "curious",
    };
    store[CHRONICLE_STORAGE_KEY] = JSON.stringify([partial]);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(1);
    expect(loaded[0].focusMinutes).toBe(0);
    expect(loaded[0].gamingSessions).toBe(0);
    expect(loaded[0].highlightTitle).toBeNull();
  });
});

describe("saveSnapshots", () => {
  it("persists to the fixed storage key", () => {
    const s = snap(new Date(2026, 7, 11, 21, 0, 0));
    saveSnapshots([s]);
    expect(store[CHRONICLE_STORAGE_KEY]).toBeDefined();
    const parsed = JSON.parse(store[CHRONICLE_STORAGE_KEY]);
    expect(parsed.length).toBe(1);
  });

  it("does not throw when localStorage is undefined", () => {
    vi.unstubAllGlobals();
    expect(() => saveSnapshots([snap(new Date(2026, 7, 11, 21, 0, 0))])).not.toThrow();
  });
});

describe("persistSnapshot", () => {
  it("inserts a new snapshot into an empty store", () => {
    const s = snap(new Date(2026, 7, 11, 21, 0, 0));
    const result = persistSnapshot(s, 90);
    expect(result.length).toBe(1);
    expect(loadSnapshots().length).toBe(1);
  });

  it("is idempotent per day — same dateStr replaces, not appends", () => {
    const morning = snap(new Date(2026, 7, 11, 8, 0, 0), { bondPoints: 100 });
    const evening = snap(new Date(2026, 7, 11, 21, 0, 0), { bondPoints: 250 });
    persistSnapshot(morning, 90);
    persistSnapshot(evening, 90);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(1);
    expect(loaded[0].bondPoints).toBe(250);
  });

  it("prunes snapshots older than retentionDays", () => {
    const old = snap(new Date(2026, 4, 1, 21, 0, 0));
    saveSnapshots([old]);
    const recent = snap(new Date(2026, 7, 11, 21, 0, 0));
    persistSnapshot(recent, 30);
    const loaded = loadSnapshots();
    expect(loaded.length).toBe(1);
    expect(loaded[0].dateStr).toBe("2026-08-11");
  });

  it("keeps multiple days within the retention window", () => {
    const day1 = snap(new Date(2026, 7, 9, 21, 0, 0));
    const day2 = snap(new Date(2026, 7, 10, 21, 0, 0));
    saveSnapshots([day1, day2]);
    const day3 = snap(new Date(2026, 7, 11, 21, 0, 0));
    persistSnapshot(day3, 30);
    expect(loadSnapshots().length).toBe(3);
  });

  it("preserves only the latest snapshot when every snapshot has expired", () => {
    const day1 = snap(new Date(2026, 7, 9, 21, 0, 0));
    const day2 = snap(new Date(2026, 7, 10, 21, 0, 0));
    saveSnapshots([day1, day2]);
    vi.setSystemTime(new Date(2027, 0, 1, 21, 0, 0));
    const day3 = snap(new Date(2026, 7, 11, 21, 0, 0));
    expect(persistSnapshot(day3, 30).map(s => s.dateStr)).toEqual(["2026-08-11"]);
  });

  it("keeps the exact retention boundary and prunes one millisecond earlier", () => {
    const cutoff = Date.now() - 30 * 86400000;
    const old = snap(new Date(cutoff - 1));
    const boundary = snap(new Date(cutoff));
    saveSnapshots([old]);
    const today = snap(new Date());
    expect(persistSnapshot(today, 30).map(s => s.timestamp)).toEqual([today.timestamp]);
    saveSnapshots([boundary]);
    expect(persistSnapshot(today, 30).map(s => s.timestamp)).toEqual([cutoff, today.timestamp]);
  });
});

describe("clearSnapshots", () => {
  it("removes the storage key", () => {
    const s = snap(new Date(2026, 7, 11, 21, 0, 0));
    saveSnapshots([s]);
    expect(store[CHRONICLE_STORAGE_KEY]).toBeDefined();
    clearSnapshots();
    expect(store[CHRONICLE_STORAGE_KEY]).toBeUndefined();
    expect(loadSnapshots()).toEqual([]);
  });

  it("does not throw when localStorage is undefined", () => {
    vi.unstubAllGlobals();
    expect(() => clearSnapshots()).not.toThrow();
  });
});
