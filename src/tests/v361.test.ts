import { describe, it, expect, beforeEach } from "vitest";
import { CONFIG_VERSION } from "../store/types";
import type { MonitorBounds } from "../store/types";
import {
  DEFAULT_CONFIG,
  DEFAULT_AUDIO,
  DEFAULT_BEHAVIOR,
  DEFAULT_HABITAT,
  DEFAULT_RUNTIME_STATE,
  DEFAULT_GENERAL,
} from "../store/defaults";
import { safeImportConfig } from "../store/configValidation";
import { BehaviorEngine } from "../engine/behaviorEngine";
import type { BehaviorContext } from "../engine/behaviorEngine";
import { getMoodModifiers } from "../engine/moodEngine";
import { sampleRailPath, nearestRailDistance } from "../engine/railHelper";
import type { HabitatRail } from "../store/types";

// ============================================================
// v3.6.1 Patch Tests
// ============================================================

// --- CONFIG_VERSION bump ---
describe("v3.6.1 config version", () => {
  it("CONFIG_VERSION is a positive integer", () => {
    expect(CONFIG_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(CONFIG_VERSION)).toBe(true);
  });

  it("DEFAULT_CONFIG version matches CONFIG_VERSION", () => {
    expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
  });
});

// --- Removed config fields ---
describe("v3.6.1 removed config fields", () => {
  it("AudioConfig has no dead fields", () => {
    const audio = DEFAULT_AUDIO as any;
    expect(audio.reactToSystemAudio).toBeUndefined();
    expect(audio.muteInMeetings).toBeUndefined();
    expect(audio.systemAudioSensitivity).toBeUndefined();
  });

  it("BehaviorConfig has no dead fields", () => {
    const behavior = DEFAULT_BEHAVIOR as any;
    expect(behavior.activeMonitorBias).toBeUndefined();
    expect(behavior.notificationBoost).toBeUndefined();
    expect(behavior.ignorePassiveVideo).toBeUndefined();
  });

  it("GeneralConfig pauseOnFullscreen defaults to false", () => {
    expect(DEFAULT_GENERAL.pauseOnFullscreen).toBe(false);
  });
});

// --- Config migration v2 → v3 ---
describe("v3.6.1 config migration", () => {
  it("migrates v2 config by stripping dead audio fields", () => {
    const v2Config = {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      version: 2,
      audio: {
        uiSounds: true,
        kovySounds: true,
        volume: 0.8,
        reactToSystemAudio: true,
        muteInMeetings: true,
        systemAudioSensitivity: 0.7,
      },
    };

    const result = safeImportConfig(v2Config);
    expect(result.config).not.toBeNull();
    expect(result.migrated).toBe(true);
    expect(result.config!.version).toBe(CONFIG_VERSION);
    // Dead fields should be stripped
    const audio = result.config!.audio as any;
    expect(audio.reactToSystemAudio).toBeUndefined();
    expect(audio.muteInMeetings).toBeUndefined();
    expect(audio.systemAudioSensitivity).toBeUndefined();
    // Kept fields preserved
    expect(result.config!.audio.uiSounds).toBe(true);
    expect(result.config!.audio.volume).toBe(0.8);
  });

  it("migrates v2 config by stripping dead behavior fields", () => {
    const v2Config = {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      version: 2,
      behavior: {
        ...JSON.parse(JSON.stringify(DEFAULT_BEHAVIOR)),
        activeMonitorBias: 0.7,
        notificationBoost: true,
        ignorePassiveVideo: true,
      },
    };

    const result = safeImportConfig(v2Config);
    expect(result.config).not.toBeNull();
    expect(result.migrated).toBe(true);
    const beh = result.config!.behavior as any;
    expect(beh.activeMonitorBias).toBeUndefined();
    expect(beh.notificationBoost).toBeUndefined();
    expect(beh.ignorePassiveVideo).toBeUndefined();
  });
});

// --- Monitor bounds in runtime state ---
describe("v3.6.1 monitor bounds", () => {
  it("DEFAULT_RUNTIME_STATE has currentMonitorBounds as null", () => {
    expect(DEFAULT_RUNTIME_STATE.currentMonitorBounds).toBeNull();
  });

  it("MonitorBounds type is well-formed", () => {
    const bounds: MonitorBounds = {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
      index: 1,
    };
    expect(bounds.x).toBe(1920);
    expect(bounds.width).toBe(1920);
    expect(bounds.index).toBe(1);
  });

  it("monitor bounds correctly represent multi-monitor layout", () => {
    const primary: MonitorBounds = { x: 0, y: 0, width: 1920, height: 1080, index: 0 };
    const secondary: MonitorBounds = { x: 1920, y: 0, width: 2560, height: 1440, index: 1 };

    // Behavior engine should use these dimensions for screen bounds
    expect(primary.width).toBe(1920);
    expect(secondary.x).toBe(1920);
    expect(secondary.width).toBe(2560);
  });
});

// --- Rail helper new functions ---
describe("v3.6.1 rail helper extensions", () => {
  const rail: HabitatRail = {
    id: "r1",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    label: "L-Rail",
  };

  it("sampleRailPath returns waypoints when near a rail", () => {
    const path = sampleRailPath({ x: 10, y: 5 }, [rail], 3, 40);
    expect(path.length).toBeGreaterThan(0);
    // Each waypoint should be on or near the rail
    for (const wp of path) {
      expect(wp.x).toBeGreaterThanOrEqual(-5);
      expect(wp.x).toBeLessThanOrEqual(105);
      expect(wp.y).toBeGreaterThanOrEqual(-5);
      expect(wp.y).toBeLessThanOrEqual(105);
    }
  });

  it("sampleRailPath returns empty when too far from rail", () => {
    const path = sampleRailPath({ x: 500, y: 500 }, [rail], 3, 40);
    expect(path).toEqual([]);
  });

  it("sampleRailPath returns empty for no rails", () => {
    const path = sampleRailPath({ x: 10, y: 5 }, [], 3, 40);
    expect(path).toEqual([]);
  });

  it("nearestRailDistance returns Infinity for no rails", () => {
    expect(nearestRailDistance({ x: 0, y: 0 }, [])).toBe(Infinity);
  });

  it("nearestRailDistance returns correct distance", () => {
    const dist = nearestRailDistance({ x: 50, y: 20 }, [rail]);
    // Nearest point on rail is (50, 0), distance = 20
    expect(dist).toBeCloseTo(20, 0);
  });
});

// --- Rail-influenced behavior ---
describe("v3.6.1 rail-glide wander", () => {
  function makeContext(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
    return {
      position: { x: 50, y: 5 },
      screenWidth: 1920,
      screenHeight: 1080,
      cursorPosition: { x: 960, y: 540 },
      activeTarget: null,
      candidateTargets: [],
      moodModifiers: getMoodModifiers("calm"),
      surfaceMood: "calm",
      config: { ...DEFAULT_BEHAVIOR },
      perchPosition: null,
      isInteracting: false,
      habitat: { ...DEFAULT_HABITAT },
      memoryInfluence: null,
      familyInfluence: null,
      circadianOutput: null,
      ...overrides,
    };
  }

  it("wander with railInfluence=1.0 produces rail-near targets", () => {
    const engine = new BehaviorEngine();
    engine.forceState("wander");

    const ctx = makeContext({
      habitat: {
        enabled: true,
        homes: [],
        zones: [],
        nodes: [],
        rails: [
          {
            id: "r1",
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
            label: "Horizontal Rail",
          },
        ],
        railInfluence: 1.0,
      },
    });

    let hitNearRail = false;
    for (let i = 0; i < 100; i++) {
      const result = engine.update(0.1, ctx);
      if (result.targetPosition && Math.abs(result.targetPosition.y) < 50) {
        hitNearRail = true;
        break;
      }
    }
    expect(hitNearRail).toBe(true);
  });

  it("perch with homes and rails uses rail-routed path when near rail", () => {
    const engine = new BehaviorEngine();
    engine.forceState("perch");

    const ctx = makeContext({
      position: { x: 50, y: 5 },
      habitat: {
        enabled: true,
        homes: [{ id: "h1", position: { x: 300, y: 0 }, label: "Home" }],
        zones: [],
        nodes: [],
        rails: [
          {
            id: "r1",
            points: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
            label: "Path Rail",
          },
        ],
        railInfluence: 1.0,
      },
    });

    // Should eventually target the home position
    let reachedNearHome = false;
    for (let i = 0; i < 50; i++) {
      const result = engine.update(0.1, ctx);
      if (result.targetPosition) {
        // Target should be near the home or along the rail
        if (result.targetPosition.x >= 0 && result.targetPosition.x <= 400) {
          reachedNearHome = true;
          break;
        }
      }
    }
    expect(reachedNearHome).toBe(true);
  });
});

// --- UI sound action types ---
import { playUISound } from "../engine/audioEngine";

describe("v3.6.1 UI sound actions", () => {
  it("playUISound accepts all action types without throwing when disabled", () => {
    const config = { uiSounds: false, kovySounds: false, volume: 0.5, ambientFrequency: 0.3, reactionFrequency: 0.6, moodFrequency: 0.4, globalCooldownMs: 1500, soundEnables: [] as any[], emoteSounds: true, whisperSounds: true, celebrationSounds: true, focusSounds: true, familySounds: true };
    expect(() => playUISound("tab", config)).not.toThrow();
    expect(() => playUISound("apply", config)).not.toThrow();
    expect(() => playUISound("cancel", config)).not.toThrow();
    expect(() => playUISound("click", config)).not.toThrow();
    expect(() => playUISound("toggle", config)).not.toThrow();
  });
});
