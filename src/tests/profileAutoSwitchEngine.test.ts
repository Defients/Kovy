import { describe, it, expect } from "vitest";
import {
  evaluateAutoSwitchRules,
  createAutoSwitchRule,
  type AutoSwitchContext,
} from "@/engine/profileAutoSwitchEngine";
import type { AutoSwitchRule } from "@/store/types";

function ctx(overrides: Partial<AutoSwitchContext> = {}): AutoSwitchContext {
  return {
    currentTime: new Date("2024-01-15T09:05:00"),
    activeAppName: null,
    idleSeconds: 0,
    ...overrides,
  };
}

function rule(
  type: AutoSwitchRule["type"],
  condition: string,
  profileId = "profile-x",
  enabled = true,
): AutoSwitchRule {
  return {
    id: `rule_${type}_${condition}_${profileId}_${enabled}`,
    type,
    condition,
    profileId,
    enabled,
  };
}

describe("profileAutoSwitchEngine — evaluateAutoSwitchRules", () => {
  // --- Time rules ---

  it("matches a time rule within the 30-minute window", () => {
    const r = rule("time", "09:00", "profile-focus");
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:05:00") }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.profileId).toBe("profile-focus");
    expect(result.reason).toContain("Time rule: 09:00");
  });

  it("matches a time rule at the exact start of the window", () => {
    const r = rule("time", "09:00");
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:00:00") }));
    expect(result.matchedRule).not.toBeNull();
  });

  it("matches a time rule at the last minute of the window (29 minutes after)", () => {
    const r = rule("time", "09:00");
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:29:00") }));
    expect(result.matchedRule).not.toBeNull();
  });

  it("does not match a time rule 30 minutes after (boundary exclusive)", () => {
    const r = rule("time", "09:00");
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:30:00") }));
    expect(result.matchedRule).toBeNull();
  });

  it("does not match a time rule before the target time", () => {
    const r = rule("time", "09:00");
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T08:59:00") }));
    expect(result.matchedRule).toBeNull();
  });

  it("handles invalid time condition gracefully", () => {
    expect(evaluateAutoSwitchRules([rule("time", "invalid")], ctx()).matchedRule).toBeNull();
    expect(evaluateAutoSwitchRules([rule("time", "25:99")], ctx()).matchedRule).toBeNull();
    expect(evaluateAutoSwitchRules([rule("time", "")], ctx()).matchedRule).toBeNull();
  });

  // --- App rules ---

  it("matches an app rule when active app contains the condition (case-insensitive)", () => {
    const r = rule("app", "Chrome");
    const result = evaluateAutoSwitchRules([r], ctx({ activeAppName: "chrome.exe" }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.reason).toContain("App rule: Chrome");
  });

  it("matches an app rule when active app equals the condition exactly", () => {
    const r = rule("app", "code");
    const result = evaluateAutoSwitchRules([r], ctx({ activeAppName: "code" }));
    expect(result.matchedRule).not.toBeNull();
  });

  it("does not match an app rule when active app is null", () => {
    const r = rule("app", "chrome");
    const result = evaluateAutoSwitchRules([r], ctx({ activeAppName: null }));
    expect(result.matchedRule).toBeNull();
  });

  it("does not match an app rule when active app does not contain condition", () => {
    const r = rule("app", "chrome");
    const result = evaluateAutoSwitchRules([r], ctx({ activeAppName: "notepad.exe" }));
    expect(result.matchedRule).toBeNull();
  });

  // --- Idle rules ---

  it("matches an idle rule when idle exceeds threshold", () => {
    const r = rule("idle", "600");
    const result = evaluateAutoSwitchRules([r], ctx({ idleSeconds: 700 }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.reason).toContain("Idle rule: 600s");
  });

  it("matches an idle rule when idle equals threshold exactly", () => {
    const r = rule("idle", "600");
    const result = evaluateAutoSwitchRules([r], ctx({ idleSeconds: 600 }));
    expect(result.matchedRule).not.toBeNull();
  });

  it("does not match an idle rule when idle is below threshold", () => {
    const r = rule("idle", "600");
    const result = evaluateAutoSwitchRules([r], ctx({ idleSeconds: 599 }));
    expect(result.matchedRule).toBeNull();
  });

  it("handles invalid idle condition gracefully", () => {
    expect(evaluateAutoSwitchRules([rule("idle", "abc")], ctx({ idleSeconds: 999 })).matchedRule).toBeNull();
    expect(evaluateAutoSwitchRules([rule("idle", "")], ctx({ idleSeconds: 999 })).matchedRule).toBeNull();
  });

  // --- Disabled rules ---

  it("skips disabled rules", () => {
    const r = rule("time", "09:00", "profile-focus", false);
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:05:00") }));
    expect(result.matchedRule).toBeNull();
    expect(result.profileId).toBeNull();
  });

  it("skips disabled rules and matches the next enabled one", () => {
    const r1 = rule("time", "09:00", "profile-a", false);
    const r2 = rule("time", "09:00", "profile-b", true);
    const result = evaluateAutoSwitchRules([r1, r2], ctx({ currentTime: new Date("2024-01-15T09:05:00") }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.profileId).toBe("profile-b");
  });

  // --- Multiple rules / priority ---

  it("returns the first matching rule when multiple match", () => {
    const r1 = rule("idle", "0", "profile-a");
    const r2 = rule("idle", "0", "profile-b");
    const result = evaluateAutoSwitchRules([r1, r2], ctx({ idleSeconds: 100 }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.profileId).toBe("profile-a");
  });

  it("returns null when no rules match", () => {
    const r1 = rule("time", "23:00");
    const r2 = rule("app", "nonexistent");
    const r3 = rule("idle", "99999");
    const result = evaluateAutoSwitchRules([r1, r2, r3], ctx());
    expect(result.matchedRule).toBeNull();
    expect(result.profileId).toBeNull();
    expect(result.reason).toBeNull();
  });

  it("returns null when rules array is empty", () => {
    const result = evaluateAutoSwitchRules([], ctx());
    expect(result.matchedRule).toBeNull();
    expect(result.profileId).toBeNull();
  });

  // --- Unknown rule type ---

  it("handles unknown rule type gracefully", () => {
    const r = { ...rule("time", "09:00"), type: "unknown" as any };
    const result = evaluateAutoSwitchRules([r], ctx({ currentTime: new Date("2024-01-15T09:05:00") }));
    expect(result.matchedRule).toBeNull();
  });
});

describe("profileAutoSwitchEngine — createAutoSwitchRule", () => {
  it("creates a rule with a unique id", () => {
    const r1 = createAutoSwitchRule("time", "09:00", "profile-a");
    const r2 = createAutoSwitchRule("time", "09:00", "profile-a");
    expect(r1.id).not.toBe(r2.id);
  });

  it("creates a rule with the correct type, condition, and profileId", () => {
    const r = createAutoSwitchRule("app", "chrome", "profile-b");
    expect(r.type).toBe("app");
    expect(r.condition).toBe("chrome");
    expect(r.profileId).toBe("profile-b");
  });

  it("creates a rule that is enabled by default", () => {
    const r = createAutoSwitchRule("idle", "600", "profile-c");
    expect(r.enabled).toBe(true);
  });

  it("creates rules that pass evaluateAutoSwitchRules", () => {
    const r = createAutoSwitchRule("idle", "0", "profile-test");
    const result = evaluateAutoSwitchRules([r], ctx({ idleSeconds: 1 }));
    expect(result.matchedRule).not.toBeNull();
    expect(result.profileId).toBe("profile-test");
  });
});
