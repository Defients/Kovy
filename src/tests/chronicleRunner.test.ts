import { describe, it, expect } from "vitest";
import { shouldPersistToday } from "../engine/chronicleRunner";
import type { ChronicleSnapshot } from "../engine/chronicleEngine";
import { localDateStr } from "../engine/chronicleEngine";

function snap(date: Date): ChronicleSnapshot {
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
    highlightTitle: null,
  };
}

describe("shouldPersistToday", () => {
  it("returns false when disabled", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    expect(shouldPersistToday(false, 21, now, [])).toBe(false);
  });

  it("returns false when current hour is before snapshot hour", () => {
    const now = new Date(2026, 7, 11, 10, 0, 0);
    expect(shouldPersistToday(true, 21, now, [])).toBe(false);
  });

  it("returns true when hour has reached snapshot hour and no snapshot exists today", () => {
    const now = new Date(2026, 7, 11, 21, 0, 0);
    expect(shouldPersistToday(true, 21, now, [])).toBe(true);
  });

  it("returns true when hour is after snapshot hour and no snapshot exists today", () => {
    const now = new Date(2026, 7, 11, 23, 59, 0);
    expect(shouldPersistToday(true, 21, now, [])).toBe(true);
  });

  it("returns false when a snapshot already exists for today", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const todaySnap = snap(new Date(2026, 7, 11, 21, 0, 0));
    expect(shouldPersistToday(true, 21, now, [todaySnap])).toBe(false);
  });

  it("returns true when existing snapshots are from other days only", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    const yesterday = snap(new Date(2026, 7, 10, 21, 0, 0));
    expect(shouldPersistToday(true, 21, now, [yesterday])).toBe(true);
  });

  it("handles snapshot hour 0 (midnight)", () => {
    const now = new Date(2026, 7, 11, 0, 0, 0);
    expect(shouldPersistToday(true, 0, now, [])).toBe(true);
  });

  it("handles snapshot hour 23 (late night)", () => {
    const now = new Date(2026, 7, 11, 22, 0, 0);
    expect(shouldPersistToday(true, 23, now, [])).toBe(false);
    const lateNow = new Date(2026, 7, 11, 23, 30, 0);
    expect(shouldPersistToday(true, 23, lateNow, [])).toBe(true);
  });
});
