import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProfileAutoSwitchRunner } from "@/engine/profileAutoSwitchRunner";
import type { AutoSwitchRule, SavedProfile, KovyConfig } from "@/store/types";

// Mock the Tauri bridge so we can control foreground app and idle seconds
vi.mock("@/lib/tauriBridge", () => ({
  getForegroundApp: vi.fn(),
  getIdleSeconds: vi.fn(),
}));

import { getForegroundApp, getIdleSeconds } from "@/lib/tauriBridge";

const mockGetForegroundApp = vi.mocked(getForegroundApp);
const mockGetIdleSeconds = vi.mocked(getIdleSeconds);

// Stub a minimal `window` since the test environment is Node and the runner
// dispatches CustomEvents on window.
const dispatchedEvents: CustomEvent[] = [];
const windowStub = {
  dispatchEvent: vi.fn((e: Event) => {
    dispatchedEvents.push(e as CustomEvent);
    return true;
  }),
  CustomEvent,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

function makeProfile(id: string, name: string, icon = "⭐"): SavedProfile {
  return {
    id,
    name,
    icon,
    timestamp: Date.now(),
    config: {} as KovyConfig,
  };
}

function makeRule(
  type: AutoSwitchRule["type"],
  condition: string,
  profileId: string,
  enabled = true,
): AutoSwitchRule {
  return {
    id: `rule_${type}_${condition}_${profileId}`,
    type,
    condition,
    profileId,
    enabled,
  };
}

describe("ProfileAutoSwitchRunner", () => {
  let appliedProfile: SavedProfile | null;
  let activeProfileId: string | null;
  let rules: AutoSwitchRule[];
  let profiles: SavedProfile[];

  beforeEach(() => {
    vi.stubGlobal("window", windowStub);
    dispatchedEvents.length = 0;
    windowStub.dispatchEvent.mockClear();

    appliedProfile = null;
    activeProfileId = "profile-default";
    rules = [];
    profiles = [
      makeProfile("profile-default", "Default", "🐾"),
      makeProfile("profile-focus", "Focus", "🎯"),
      makeProfile("profile-gaming", "Gaming", "🎮"),
    ];
    mockGetForegroundApp.mockResolvedValue({ processName: null, windowTitle: null, windowBounds: null });
    mockGetIdleSeconds.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeRunner(): ProfileAutoSwitchRunner {
    return new ProfileAutoSwitchRunner({
      intervalMs: 1000,
      getRules: () => rules,
      getSavedProfiles: () => profiles,
      getActiveProfileId: () => activeProfileId,
      applyProfile: (p) => {
        appliedProfile = p;
        activeProfileId = p.id;
      },
    });
  }

  it("does nothing when there are no rules", async () => {
    const runner = makeRunner();
    await runner.tick();
    expect(appliedProfile).toBeNull();
    expect(dispatchedEvents.find((e) => e.type === "kovy-profile-auto-switch")).toBeUndefined();
  });

  it("does nothing when all rules are disabled", async () => {
    rules = [makeRule("time", "09:00", "profile-focus", false)];
    const runner = makeRunner();
    await runner.tick();
    expect(appliedProfile).toBeNull();
  });

  it("fires a time rule when current time is within the match window", async () => {
    const now = new Date();
    now.setHours(9, 5, 0, 0); // 09:05 — within 09:00 + 30min window
    vi.useFakeTimers();
    vi.setSystemTime(now);

    rules = [makeRule("time", "09:00", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).not.toBeNull();
    expect(appliedProfile?.id).toBe("profile-focus");

    // Check event was dispatched
    const autoSwitchEvent = dispatchedEvents.find((e) => e.type === "kovy-profile-auto-switch");
    expect(autoSwitchEvent).toBeDefined();
    const detail = autoSwitchEvent!.detail;
    expect(detail.profileName).toBe("Focus");
    expect(detail.profileIcon).toBe("🎯");
    expect(detail.source).toBe("auto");

    vi.useRealTimers();
  });

  it("does not fire a time rule when outside the match window", async () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0); // 10:00 — outside 09:00 + 30min window
    vi.useFakeTimers();
    vi.setSystemTime(now);

    rules = [makeRule("time", "09:00", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).toBeNull();
    vi.useRealTimers();
  });

  it("fires an app rule when foreground app matches", async () => {
    mockGetForegroundApp.mockResolvedValue({
      processName: "chrome.exe",
      windowTitle: "Google",
      windowBounds: null,
    });

    rules = [makeRule("app", "chrome", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).not.toBeNull();
    expect(appliedProfile?.id).toBe("profile-focus");
  });

  it("does not fire an app rule when foreground app does not match", async () => {
    mockGetForegroundApp.mockResolvedValue({
      processName: "notepad.exe",
      windowTitle: "",
      windowBounds: null,
    });

    rules = [makeRule("app", "chrome", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).toBeNull();
  });

  it("fires an idle rule when idle seconds exceed threshold", async () => {
    mockGetIdleSeconds.mockResolvedValue(700); // 700s > 600s threshold

    rules = [makeRule("idle", "600", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).not.toBeNull();
    expect(appliedProfile?.id).toBe("profile-focus");
  });

  it("does not fire an idle rule when idle seconds are below threshold", async () => {
    mockGetIdleSeconds.mockResolvedValue(300); // 300s < 600s threshold

    rules = [makeRule("idle", "600", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).toBeNull();
  });

  it("does not switch to the already-active profile", async () => {
    activeProfileId = "profile-focus"; // already on focus

    const now = new Date();
    now.setHours(9, 5, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    rules = [makeRule("time", "09:00", "profile-focus")];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).toBeNull();
    vi.useRealTimers();
  });

  it("does not fire when the target profile has been deleted", async () => {
    rules = [makeRule("time", "09:00", "profile-deleted")];
    const now = new Date();
    now.setHours(9, 5, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile).toBeNull();
    vi.useRealTimers();
  });

  it("evaluates rules in order and fires the first match", async () => {
    mockGetIdleSeconds.mockResolvedValue(700);

    rules = [
      makeRule("idle", "600", "profile-gaming"), // first match
      makeRule("app", "chrome", "profile-focus"), // would also match if app was chrome
    ];
    const runner = makeRunner();
    await runner.tick();

    expect(appliedProfile?.id).toBe("profile-gaming");
  });

  it("start/stop controls the interval timer", async () => {
    const now = new Date();
    now.setHours(9, 5, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    rules = [makeRule("time", "09:00", "profile-focus")];
    const runner = makeRunner();

    // Start and let one tick fire
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(appliedProfile).not.toBeNull();

    // Reset and stop — no more ticks should fire
    appliedProfile = null;
    runner.stop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(appliedProfile).toBeNull();

    vi.useRealTimers();
  });

  it("destroy stops the runner and prevents future ticks", async () => {
    const runner = makeRunner();
    runner.start();
    runner.destroy();

    // tick after destroy should be a no-op
    rules = [makeRule("idle", "0", "profile-focus")];
    mockGetIdleSeconds.mockResolvedValue(999);
    await runner.tick();
    expect(appliedProfile).toBeNull();
  });
});
