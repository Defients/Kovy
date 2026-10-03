import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioReactivityEngine, NULL_AUDIO_OUTPUT } from "@/engine/audioReactivityEngine";
import type { AudioReactivityConfig } from "@/store/types";

const defaultConfig: AudioReactivityConfig = {
  enabled: true,
  sensitivity: 0.5,
  beatDetection: true,
  feedMood: true,
  feedGaming: true,
  feedVisualizer: true,
  visualizerStyle: "bars",
};

function setupMockAudio() {
  const stopTrack = vi.fn();
  const closeCtx = vi.fn();
  const mockStream = {
    getTracks: () => [{ stop: stopTrack }],
  };
  const mockAnalyser = {
    fftSize: 256,
    smoothingTimeConstant: 0.7,
    frequencyBinCount: 128,
    getByteFrequencyData: (arr: Uint8Array) => { arr.fill(128); },
    getByteTimeDomainData: () => {},
    connect: () => {},
  };
  const mockCtx = {
    createMediaStreamSource: () => ({ connect: () => {} }),
    createAnalyser: () => mockAnalyser,
    close: closeCtx,
  };

  const fakeWindow = {
    AudioContext: function () { return mockCtx; },
  };
  const fakeNavigator = {
    mediaDevices: {
      getUserMedia: () => Promise.resolve(mockStream),
    },
  };

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("navigator", fakeNavigator);

  return { stopTrack, closeCtx, mockAnalyser };
}

describe("AudioReactivityEngine", () => {
  let engine: AudioReactivityEngine;

  beforeEach(() => {
    engine = new AudioReactivityEngine();
  });

  afterEach(() => {
    engine.dispose();
    vi.unstubAllGlobals();
  });

  it("disabled config returns null output", () => {
    const out = engine.update(0.016, { ...defaultConfig, enabled: false });
    expect(out.enabled).toBe(false);
    expect(out.energy).toBe(0);
    expect(out.beatDetected).toBe(false);
  });

  it("returns null output when not initialized", () => {
    const out = engine.update(0.016, defaultConfig);
    expect(out.enabled).toBe(false);
    expect(out.visualizerBars).toEqual([]);
  });

  it("NULL_AUDIO_OUTPUT has all fields zeroed", () => {
    expect(NULL_AUDIO_OUTPUT.enabled).toBe(false);
    expect(NULL_AUDIO_OUTPUT.energy).toBe(0);
    expect(NULL_AUDIO_OUTPUT.bassEnergy).toBe(0);
    expect(NULL_AUDIO_OUTPUT.beatDetected).toBe(false);
    expect(NULL_AUDIO_OUTPUT.visualizerBars).toEqual([]);
  });

  it("init returns false when AudioContext is unavailable", async () => {
    vi.stubGlobal("window", { AudioContext: undefined });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => Promise.resolve({}) } });
    const result = await engine.init();
    expect(result).toBe(false);
  });

  it("init returns false when getUserMedia is unavailable", async () => {
    vi.stubGlobal("window", { AudioContext: function () { return { close: () => {} }; } });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: undefined } });
    const result = await engine.init();
    expect(result).toBe(false);
  });

  it("dispose stops media tracks and closes audio context", async () => {
    const { stopTrack, closeCtx } = setupMockAudio();
    const eng = new AudioReactivityEngine();
    const ok = await eng.init();
    expect(ok).toBe(true);
    eng.dispose();
    expect(stopTrack).toHaveBeenCalled();
    expect(closeCtx).toHaveBeenCalled();
  });

  it("visualizer bars are empty when feedVisualizer is false", async () => {
    setupMockAudio();
    const eng = new AudioReactivityEngine();
    await eng.init();
    const out = eng.update(0.016, { ...defaultConfig, feedVisualizer: false });
    expect(out.visualizerBars).toEqual([]);
    eng.dispose();
  });

  it("visualizer bars are empty when visualizerStyle is none", async () => {
    setupMockAudio();
    const eng = new AudioReactivityEngine();
    await eng.init();
    const out = eng.update(0.016, { ...defaultConfig, visualizerStyle: "none" });
    expect(out.visualizerBars).toEqual([]);
    eng.dispose();
  });

  it("produces visualizer bars when feedVisualizer is true and style is bars", async () => {
    setupMockAudio();
    const eng = new AudioReactivityEngine();
    await eng.init();
    const out = eng.update(0.016, { ...defaultConfig, feedVisualizer: true, visualizerStyle: "bars" });
    expect(out.visualizerBars.length).toBe(32);
    eng.dispose();
  });

  it("produces energy output when initialized", async () => {
    setupMockAudio();
    const eng = new AudioReactivityEngine();
    await eng.init();
    const out = eng.update(0.016, defaultConfig);
    expect(out.enabled).toBe(true);
    expect(out.energy).toBeGreaterThan(0);
    eng.dispose();
  });
});
