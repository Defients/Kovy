// ============================================================
// Ritual Engine Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  RitualEngine,
  RITUAL_DEFS,
  createDefaultRitualState,
  type RitualId,
} from "@/engine/ritualEngine";

describe("RitualEngine", () => {
  let engine: RitualEngine;

  beforeEach(() => {
    engine = new RitualEngine();
  });

  it("has 7 ritual definitions", () => {
    expect(RITUAL_DEFS).toHaveLength(7);
  });

  it("starts with empty state", () => {
    const state = engine.getState();
    expect(state.records).toHaveLength(0);
    expect(Object.keys(state.streaks)).toHaveLength(0);
    expect(Object.keys(state.totalPerformed)).toHaveLength(0);
  });

  it("getActiveRituals returns rituals for current hour", () => {
    // Morning 8am
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const morningRituals = engine.getActiveRituals(morning);
    expect(morningRituals.some(r => r.id === "morning_greeting")).toBe(true);
    expect(morningRituals.some(r => r.id === "evening_winddown")).toBe(false);
  });

  it("getActiveRituals respects hour windows", () => {
    // Evening 20:00
    const evening = new Date();
    evening.setHours(20, 0, 0, 0);
    const eveningRituals = engine.getActiveRituals(evening);
    expect(eveningRituals.some(r => r.id === "evening_winddown")).toBe(true);
    expect(eveningRituals.some(r => r.id === "morning_greeting")).toBe(false);
  });

  it("getActiveRituals respects daysOfWeek for weekend_special", () => {
    // Saturday
    const saturday = new Date();
    saturday.setHours(10, 0, 0, 0);
    saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));
    const satRituals = engine.getActiveRituals(saturday);
    expect(satRituals.some(r => r.id === "weekend_special")).toBe(true);

    // Wednesday
    const wednesday = new Date();
    wednesday.setHours(10, 0, 0, 0);
    wednesday.setDate(wednesday.getDate() + (3 - wednesday.getDay()));
    const wedRituals = engine.getActiveRituals(wednesday);
    expect(wedRituals.some(r => r.id === "weekend_special")).toBe(false);
  });

  it("performRitual records the ritual", () => {
    const result = engine.performRitual("morning_greeting", "calm", "celebrate");
    expect(result).toBe(true);

    const state = engine.getState();
    expect(state.records).toHaveLength(1);
    expect(state.records[0].ritualId).toBe("morning_greeting");
    expect(state.records[0].mood).toBe("calm");
    expect(state.records[0].behaviorTriggered).toBe("celebrate");
  });

  it("performRitual prevents duplicate same-day performance", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    const result = engine.performRitual("morning_greeting", "playful", "wander");
    expect(result).toBe(false);

    expect(engine.getState().records).toHaveLength(1);
  });

  it("performRitual increments totalPerformed", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    expect(engine.getTotalPerformed("morning_greeting")).toBe(1);
  });

  it("performRitual starts streak at 1", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    expect(engine.getStreak("morning_greeting")).toBe(1);
  });

  it("performRitual rejects unknown ritual id", () => {
    const result = engine.performRitual("unknown_ritual" as RitualId, "calm", "idle_float");
    expect(result).toBe(false);
  });

  it("wasPerformedToday returns true after performing", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    expect(engine.wasPerformedToday("morning_greeting")).toBe(true);
    expect(engine.wasPerformedToday("lunch_companion")).toBe(false);
  });

  it("getPendingRituals returns active unperformed rituals", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const pending = engine.getPendingRituals(morning);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some(r => r.id === "morning_greeting")).toBe(true);

    // After performing, it should not be pending
    engine.performRitual("morning_greeting", "calm", "celebrate");
    const pendingAfter = engine.getPendingRituals(morning);
    expect(pendingAfter.some(r => r.id === "morning_greeting")).toBe(false);
  });

  it("getRecentRecords returns last N records", () => {
    for (let i = 0; i < 5; i++) {
      engine.performRitual(
        ["morning_greeting", "lunch_companion", "afternoon_stretch", "evening_winddown", "midnight_dream"][i] as RitualId,
        "calm", "celebrate"
      );
    }
    const recent = engine.getRecentRecords(3);
    expect(recent).toHaveLength(3);
  });

  it("getHistorySummary returns only performed rituals", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    const summary = engine.getHistorySummary();
    expect(summary).toHaveLength(1);
    expect(summary[0].ritual).toBe("morning_greeting");
    expect(summary[0].count).toBe(1);
  });

  it("reset clears all state", () => {
    engine.performRitual("morning_greeting", "calm", "celebrate");
    engine.reset();
    const state = engine.getState();
    expect(state.records).toHaveLength(0);
    expect(Object.keys(state.totalPerformed)).toHaveLength(0);
  });

  it("update returns newly available rituals", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    const newlyAvailable = engine.update(0.016, morning);
    expect(newlyAvailable.length).toBeGreaterThan(0);

    // Second call should return no new rituals
    const secondCall = engine.update(0.016, morning);
    expect(secondCall).toHaveLength(0);
  });

  it("createDefaultRitualState returns valid empty state", () => {
    const state = createDefaultRitualState();
    expect(state.records).toEqual([]);
    expect(state.streaks).toEqual({});
    expect(state.lastPerformedDay).toEqual({});
    expect(state.totalPerformed).toEqual({});
  });
});
