import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { onBehaviorChange, playUISound } from "@/engine/audioEngine";
import type { AudioConfig } from "@/store/types";

function makeConfig(overrides: Partial<AudioConfig> = {}): AudioConfig {
  return {
    kovySounds: true,
    uiSounds: true,
    volume: 0.5,
    ambientFrequency: 0.3,
    reactionFrequency: 0.6,
    moodFrequency: 0.4,
    globalCooldownMs: 100,
    soundEnables: [],
    emoteSounds: true,
    whisperSounds: true,
    celebrationSounds: true,
    focusSounds: true,
    familySounds: true,
    ...overrides,
  };
}

describe("Sound category toggles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("playUISound does not throw when uiSounds is false", () => {
    const config = makeConfig({ uiSounds: false });
    expect(() => playUISound("click", config)).not.toThrow();
  });

  it("playUISound does not throw when uiSounds is true", () => {
    const config = makeConfig({ uiSounds: true });
    expect(() => playUISound("click", config)).not.toThrow();
  });

  it("onBehaviorChange does not throw when kovySounds is false", () => {
    const config = makeConfig({ kovySounds: false });
    expect(() => onBehaviorChange("idle_float", "celebrate", "playful", config)).not.toThrow();
  });

  it("onBehaviorChange does not throw with all toggles enabled", () => {
    const config = makeConfig();
    // Advance time past cooldown
    vi.advanceTimersByTime(3000);
    expect(() => onBehaviorChange("idle_float", "celebrate", "playful", config)).not.toThrow();
  });

  it("onBehaviorChange does not throw with all toggles disabled", () => {
    const config = makeConfig({
      emoteSounds: false,
      celebrationSounds: false,
      focusSounds: false,
      familySounds: false,
    });
    vi.advanceTimersByTime(3000);
    expect(() => onBehaviorChange("idle_float", "celebrate", "playful", config)).not.toThrow();
  });

  it("onBehaviorChange does not throw for sibling with familySounds disabled", () => {
    const config = makeConfig({ familySounds: false });
    vi.advanceTimersByTime(3000);
    expect(() => onBehaviorChange("idle_float", "wander", "calm", config, "sibling-1")).not.toThrow();
  });

  it("onBehaviorChange does not throw for nap wake with focusSounds disabled", () => {
    const config = makeConfig({ focusSounds: false });
    vi.advanceTimersByTime(3000);
    expect(() => onBehaviorChange("nap", "idle_float", "sleepy", config)).not.toThrow();
  });

  it("AudioConfig has all 5 category toggle fields", () => {
    const config = makeConfig();
    expect(config).toHaveProperty("emoteSounds");
    expect(config).toHaveProperty("whisperSounds");
    expect(config).toHaveProperty("celebrationSounds");
    expect(config).toHaveProperty("focusSounds");
    expect(config).toHaveProperty("familySounds");
  });
});
