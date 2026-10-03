// ============================================================
// Journal Engine Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  JournalEngine,
  createDefaultJournalState,
  type JournalEntryType,
} from "@/engine/journalEngine";

describe("JournalEngine", () => {
  let journal: JournalEngine;

  beforeEach(() => {
    journal = new JournalEngine();
  });

  it("starts empty", () => {
    expect(journal.getEntryCount()).toBe(0);
    expect(journal.getEntries()).toHaveLength(0);
  });

  it("recordMilestone adds an entry", () => {
    journal.recordMilestone("First Nap", "💤", "calm");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("milestone");
    expect(entry.title).toContain("First Nap");
    expect(entry.mood).toBe("calm");
  });

  it("recordRitual adds an entry with behavior description", () => {
    journal.recordRitual("Morning Greeting", "🌅", "playful", "celebrate");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("ritual");
    expect(entry.body).toContain("celebrated");
  });

  it("recordBondLevel adds an entry", () => {
    journal.recordBondLevel("friend", 50, "excited");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("bond");
    expect(entry.title).toContain("friend");
  });

  it("recordMoodShift adds an entry", () => {
    journal.recordMoodShift("calm", "excited");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("mood_shift");
    expect(entry.body).toContain("peaceful");
    expect(entry.body).toContain("vibrating");
  });

  it("recordGamingSession adds an entry with duration", () => {
    journal.recordGamingSession(1800, 0.85, "excited");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("gaming_session");
    expect(entry.metadata?.durationMinutes).toBe(30);
  });

  it("recordFamilyEvent adds an entry", () => {
    journal.recordFamilyEvent("New sibling arrived", "curious");
    expect(journal.getEntryCount()).toBe(1);
    const entry = journal.getEntries()[0];
    expect(entry.type).toBe("family_event");
    expect(entry.title).toContain("New sibling");
  });

  it("maybeGenerateDailySummary creates one summary per day", () => {
    const first = journal.maybeGenerateDailySummary(3600, "calm");
    expect(first).not.toBeNull();
    expect(first?.type).toBe("daily_summary");

    const second = journal.maybeGenerateDailySummary(7200, "playful");
    expect(second).toBeNull();
  });

  it("getEntriesForDay filters by date string", () => {
    journal.recordMilestone("Test", "✦", "calm");
    const today = new Date().toISOString().slice(0, 10);
    const entries = journal.getEntriesForDay(today);
    expect(entries).toHaveLength(1);
    expect(entries[0].dateStr).toBe(today);
  });

  it("getRecentEntries returns last N entries", () => {
    for (let i = 0; i < 5; i++) {
      journal.recordMilestone(`M${i}`, "✦", "calm");
    }
    const recent = journal.getRecentEntries(3);
    expect(recent).toHaveLength(3);
    expect(recent[2].title).toContain("M4");
  });

  it("exportAsText produces readable text", () => {
    journal.recordMilestone("First Nap", "💤", "calm");
    journal.recordRitual("Morning Greeting", "🌅", "playful", "celebrate");
    const text = journal.exportAsText();
    expect(text).toContain("# Kovy Journal");
    expect(text).toContain("First Nap");
    expect(text).toContain("Morning Greeting");
  });

  it("caps entries at 1000", () => {
    for (let i = 0; i < 1100; i++) {
      journal.recordMilestone(`M${i}`, "✦", "calm");
    }
    expect(journal.getEntryCount()).toBe(1000);
  });

  it("reset clears all entries", () => {
    journal.recordMilestone("Test", "✦", "calm");
    journal.reset();
    expect(journal.getEntryCount()).toBe(0);
  });

  it("createDefaultJournalState returns empty state", () => {
    const state = createDefaultJournalState();
    expect(state.entries).toEqual([]);
    expect(state.lastSummaryDate).toBeNull();
  });

  it("entries have unique ids", () => {
    journal.recordMilestone("A", "✦", "calm");
    journal.recordMilestone("B", "✦", "calm");
    const entries = journal.getEntries();
    expect(entries[0].id).not.toBe(entries[1].id);
  });
});
