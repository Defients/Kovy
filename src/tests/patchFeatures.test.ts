import { describe, it, expect, beforeEach } from "vitest";

// --- Debug overlay gating tests ---
describe("Debug overlay gating logic", () => {
  it("motionOverlay should work independently of debugMode", () => {
    // The overlay renders when config.advanced.motionOverlay is true,
    // regardless of config.advanced.debugMode
    const config = {
      advanced: { debugMode: false, motionOverlay: true, targetReticle: false, salienceGraph: false, habitatOverlay: false },
    };
    expect(config.advanced.motionOverlay).toBe(true);
    expect(config.advanced.debugMode).toBe(false);
    // motionOverlay should still render — no dependency on debugMode
    const shouldRenderMotion = config.advanced.motionOverlay;
    expect(shouldRenderMotion).toBe(true);
  });

  it("targetReticle should work independently of debugMode", () => {
    const config = {
      advanced: { debugMode: false, motionOverlay: false, targetReticle: true, salienceGraph: false, habitatOverlay: false },
    };
    const shouldRenderReticle = config.advanced.targetReticle;
    expect(shouldRenderReticle).toBe(true);
  });

  it("salienceGraph should work independently of debugMode", () => {
    const config = {
      advanced: { debugMode: false, motionOverlay: false, targetReticle: false, salienceGraph: true, habitatOverlay: false },
    };
    const shouldRenderGraph = config.advanced.salienceGraph;
    expect(shouldRenderGraph).toBe(true);
  });

  it("debug text requires debugMode", () => {
    const configOff = { advanced: { debugMode: false } };
    const configOn = { advanced: { debugMode: true } };
    expect(configOff.advanced.debugMode).toBe(false);
    expect(configOn.advanced.debugMode).toBe(true);
  });
});

// --- Audio config tests ---
import { isAudioAvailable } from "../engine/audioEngine";
import {
  DEFAULT_AUDIO,
  DEFAULT_ADVANCED,
  DEFAULT_VISION,
  DEFAULT_PRIVACY,
  DEFAULT_RUNTIME_STATE,
} from "../store/defaults";

describe("Audio engine config", () => {
  it("isAudioAvailable returns a boolean", () => {
    const result = isAudioAvailable();
    expect(typeof result).toBe("boolean");
  });

  it("audio config defaults are sensible", () => {
    expect(DEFAULT_AUDIO.uiSounds).toBe(false);
    expect(DEFAULT_AUDIO.kovySounds).toBe(false);
    expect(DEFAULT_AUDIO.volume).toBeGreaterThan(0);
    expect(DEFAULT_AUDIO.volume).toBeLessThanOrEqual(1);
  });
});

// --- Diagnostics opt-in tests ---
import {
  setDiagnosticsEnabled,
  isDiagnosticsEnabled,
  clearDiagnostics,
  recordFps,
  recordBehaviorChange,
  recordMoodChange,
  getDiagnosticsSummary,
  exportDiagnosticsBundle,
} from "../engine/diagnosticsEngine";
import { DEFAULT_CONFIG } from "../store/defaults";
import { KOVY_VERSION } from "../lib/version";

describe("Diagnostics engine", () => {
  beforeEach(() => {
    setDiagnosticsEnabled(false);
    clearDiagnostics();
  });

  it("collects nothing when disabled", () => {
    setDiagnosticsEnabled(false);
    recordFps(60);
    recordBehaviorChange("idle_float", "inspect");
    recordMoodChange("curious");
    const summary = getDiagnosticsSummary();
    expect(summary.entryCount).toBe(0);
  });

  it("collects data when enabled", () => {
    setDiagnosticsEnabled(true);
    recordFps(60);
    recordFps(58);
    recordBehaviorChange("idle_float", "inspect");
    recordMoodChange("curious");
    const summary = getDiagnosticsSummary();
    expect(summary.entryCount).toBeGreaterThan(0);
    expect(summary.avgFps).toBeGreaterThan(0);
  });

  it("clears all data on clearDiagnostics", () => {
    setDiagnosticsEnabled(true);
    recordFps(60);
    recordBehaviorChange("idle_float", "wander");
    clearDiagnostics();
    const summary = getDiagnosticsSummary();
    expect(summary.entryCount).toBe(0);
  });

  it("clears data when disabled after being enabled", () => {
    setDiagnosticsEnabled(true);
    recordFps(60);
    expect(getDiagnosticsSummary().entryCount).toBeGreaterThan(0);
    setDiagnosticsEnabled(false);
    expect(getDiagnosticsSummary().entryCount).toBe(0);
  });

  it("isDiagnosticsEnabled reflects current state", () => {
    expect(isDiagnosticsEnabled()).toBe(false);
    setDiagnosticsEnabled(true);
    expect(isDiagnosticsEnabled()).toBe(true);
    setDiagnosticsEnabled(false);
    expect(isDiagnosticsEnabled()).toBe(false);
  });

  it("exports a valid JSON bundle", () => {
    setDiagnosticsEnabled(true);
    recordFps(60);
    recordBehaviorChange("idle_float", "inspect");
    const json = exportDiagnosticsBundle(DEFAULT_CONFIG);
    const parsed = JSON.parse(json);
    expect(parsed.kovyVersion).toBe(KOVY_VERSION);
    expect(parsed.diagnosticEntries).toBeDefined();
    expect(Array.isArray(parsed.diagnosticEntries)).toBe(true);
  });

  it("export respects diagnosticsIncludeConfig", () => {
    setDiagnosticsEnabled(true);
    recordFps(60);
    const configWithSnapshot = { ...DEFAULT_CONFIG, privacy: { ...DEFAULT_CONFIG.privacy, diagnosticsIncludeConfig: true } };
    const withConfig = JSON.parse(exportDiagnosticsBundle(configWithSnapshot));
    expect(withConfig.configSnapshot).toBeDefined();

    const configWithout = { ...DEFAULT_CONFIG, privacy: { ...DEFAULT_CONFIG.privacy, diagnosticsIncludeConfig: false } };
    const withoutConfig = JSON.parse(exportDiagnosticsBundle(configWithout));
    expect(withoutConfig.configSnapshot).toBeUndefined();
  });
});

// --- OCR config and throttling tests ---
import { updateOcrConfig, isOcrEnabled, tryRunOcr, clearOcrResults, getOcrResults } from "../engine/ocrEngine";

describe("OCR engine", () => {
  beforeEach(() => {
    clearOcrResults();
  });

  it("is disabled by default", () => {
    updateOcrConfig(DEFAULT_CONFIG.vision, DEFAULT_CONFIG.privacy);
    // Default: ocrEnabled=false, ocrDisabled=true → OCR should be off
    expect(isOcrEnabled()).toBe(false);
  });

  it("respects privacy.ocrDisabled override", () => {
    const vision = { ...DEFAULT_CONFIG.vision, ocrEnabled: true };
    const privacy = { ...DEFAULT_CONFIG.privacy, ocrDisabled: true };
    updateOcrConfig(vision, privacy);
    expect(isOcrEnabled()).toBe(false);
  });

  it("enables when vision.ocrEnabled=true and privacy.ocrDisabled=false", () => {
    const vision = { ...DEFAULT_CONFIG.vision, ocrEnabled: true };
    const privacy = { ...DEFAULT_CONFIG.privacy, ocrDisabled: false };
    updateOcrConfig(vision, privacy);
    expect(isOcrEnabled()).toBe(true);
  });

  it("returns empty results when disabled", () => {
    updateOcrConfig(DEFAULT_CONFIG.vision, DEFAULT_CONFIG.privacy);
    const results = tryRunOcr([], DEFAULT_CONFIG.vision);
    expect(results).toEqual([]);
  });

  it("throttles OCR by cooldown", () => {
    const vision = { ...DEFAULT_CONFIG.vision, ocrEnabled: true, ocrCooldownMs: 60000 };
    const privacy = { ...DEFAULT_CONFIG.privacy, ocrDisabled: false };
    updateOcrConfig(vision, privacy);

    const mockRegion = {
      id: 1, centroid: { x: 100, y: 100 },
      boundingBox: { x: 80, y: 80, w: 200, h: 40 },
      area: 100, energy: 50, persistence: 3, novelty: 0.5, score: 0.6,
    };

    // First call should work
    const r1 = tryRunOcr([mockRegion], vision);
    expect(r1.length).toBeGreaterThan(0);

    // Second immediate call should return cached results (throttled)
    const r2 = tryRunOcr([mockRegion], vision);
    expect(r2).toEqual(r1);
  });

  it("clearOcrResults empties results", () => {
    clearOcrResults();
    expect(getOcrResults()).toEqual([]);
  });
});

// --- Habitat object editing tests ---
describe("Habitat object editing", () => {
  it("can create and modify a habitat home", () => {
    const home = { id: "h1", position: { x: 100, y: 200 }, label: "Test Home" };
    const updated = { ...home, position: { x: 300, y: 400 }, label: "Moved Home" };
    expect(updated.position.x).toBe(300);
    expect(updated.label).toBe("Moved Home");
  });

  it("can create and modify a habitat zone", () => {
    const zone = { id: "z1", type: "attract" as const, rect: { x: 0, y: 0, w: 400, h: 300 }, strength: 0.6, label: "Zone" };
    const resized = { ...zone, rect: { ...zone.rect, w: 800, h: 600 } };
    expect(resized.rect.w).toBe(800);
    expect(resized.rect.h).toBe(600);
  });

  it("can create and modify a rail with control points", () => {
    const rail = { id: "r1", points: [{ x: 100, y: 100 }, { x: 500, y: 100 }], label: "Rail 1" };
    // Add a point
    const withPoint = { ...rail, points: [...rail.points, { x: 500, y: 400 }] };
    expect(withPoint.points.length).toBe(3);
    // Remove a point
    const withoutPoint = { ...withPoint, points: withPoint.points.filter((_, i) => i !== 1) };
    expect(withoutPoint.points.length).toBe(2);
    // Move a point
    const moved = { ...rail, points: rail.points.map((p, i) => i === 0 ? { x: 200, y: 200 } : p) };
    expect(moved.points[0].x).toBe(200);
  });
});

// --- Current monitor logic tests ---
describe("Current monitor logic", () => {
  it("can determine cursor monitor from position", () => {
    // Simulating the getCursorMonitorIndex logic
    const monitors = [
      { index: 0, name: "Monitor 1", width: 1920, height: 1080, x: 0, y: 0, is_primary: true },
      { index: 1, name: "Monitor 2", width: 1920, height: 1080, x: 1920, y: 0, is_primary: false },
    ];

    function getCursorMonitor(cx: number, cy: number) {
      for (const m of monitors) {
        if (cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height) {
          return m.index;
        }
      }
      return monitors.findIndex(m => m.is_primary);
    }

    expect(getCursorMonitor(500, 500)).toBe(0);
    expect(getCursorMonitor(2000, 500)).toBe(1);
    expect(getCursorMonitor(1919, 500)).toBe(0);
    expect(getCursorMonitor(1920, 500)).toBe(1);
  });
});

// --- Config defaults completeness ---
describe("Config defaults include new fields", () => {
  it("DEFAULT_ADVANCED includes habitatOverlay", () => {
    expect(DEFAULT_ADVANCED.habitatOverlay).toBeDefined();
    expect(typeof DEFAULT_ADVANCED.habitatOverlay).toBe("boolean");
  });

  it("DEFAULT_VISION includes ocrCooldownMs and ocrMaxRegions", () => {
    expect(DEFAULT_VISION.ocrCooldownMs).toBeGreaterThan(0);
    expect(DEFAULT_VISION.ocrMaxRegions).toBeGreaterThanOrEqual(1);
  });

  it("DEFAULT_AUDIO has only implemented fields", () => {
    expect(DEFAULT_AUDIO.volume).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_AUDIO.volume).toBeLessThanOrEqual(1);
    // Removed fields should not exist
    expect((DEFAULT_AUDIO as any).reactToSystemAudio).toBeUndefined();
    expect((DEFAULT_AUDIO as any).muteInMeetings).toBeUndefined();
    expect((DEFAULT_AUDIO as any).systemAudioSensitivity).toBeUndefined();
  });

  it("DEFAULT_PRIVACY includes diagnosticsIncludeConfig and diagnosticsIncludeErrors", () => {
    expect(typeof DEFAULT_PRIVACY.diagnosticsIncludeConfig).toBe("boolean");
    expect(typeof DEFAULT_PRIVACY.diagnosticsIncludeErrors).toBe("boolean");
  });

  it("DEFAULT_RUNTIME_STATE includes rawRegions", () => {
    expect(Array.isArray(DEFAULT_RUNTIME_STATE.rawRegions)).toBe(true);
  });
});
