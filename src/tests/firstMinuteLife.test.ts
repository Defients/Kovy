import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "@/store/defaults";

describe("First-minute life pass — defaults produce visible life", () => {
  it("Kovy is visible by default", () => {
    expect(DEFAULT_CONFIG.appearance.opacity).toBeGreaterThan(0.5);
    expect(DEFAULT_CONFIG.appearance.size).toBeGreaterThan(0.5);
  });

  it("behavior is curious and active", () => {
    expect(DEFAULT_CONFIG.behavior.preset).toBe("curious");
    expect(DEFAULT_CONFIG.behavior.curiosityStrength).toBeGreaterThan(0.3);
    expect(DEFAULT_CONFIG.behavior.attractionStrength).toBeGreaterThan(0.3);
  });

  it("vision is enabled for motion detection", () => {
    expect(DEFAULT_CONFIG.vision.enabled).toBe(true);
    expect(DEFAULT_CONFIG.vision.analysisFps).toBeGreaterThan(0);
  });

  it("mood system is enabled", () => {
    expect(DEFAULT_CONFIG.mood.enabled).toBe(true);
    expect(DEFAULT_CONFIG.mood.intensity).toBeGreaterThan(0.3);
  });

  it("emotes are enabled", () => {
    expect(DEFAULT_CONFIG.emote.enabled).toBe(true);
    expect(DEFAULT_CONFIG.emote.intensity).toBeGreaterThan(0.3);
  });

  it("atmosphere particles are enabled", () => {
    expect(DEFAULT_CONFIG.atmosphere.enabled).toBe(true);
    expect(DEFAULT_CONFIG.atmosphere.density).toBeGreaterThan(0.2);
  });

  it("thought bubbles are enabled", () => {
    expect(DEFAULT_CONFIG.thought.enabled).toBe(true);
    expect(DEFAULT_CONFIG.thought.frequency).toBeGreaterThan(0);
  });

  it("bond system is enabled for interactions", () => {
    expect(DEFAULT_CONFIG.bond.enabled).toBe(true);
  });

  it("circadian rhythm is enabled", () => {
    expect(DEFAULT_CONFIG.circadian.enabled).toBe(true);
  });

  it("glow and particles make Kovy visually noticeable", () => {
    expect(DEFAULT_CONFIG.appearance.glowIntensity).toBeGreaterThan(0.3);
    expect(DEFAULT_CONFIG.appearance.particleAmount).toBeGreaterThan(0.2);
    expect(DEFAULT_CONFIG.appearance.auroraBackground).toBe(true);
  });

  it("stats tracking is enabled", () => {
    expect(DEFAULT_CONFIG.stats.enabled).toBe(true);
  });

  it("idle behaviors are enabled", () => {
    expect(DEFAULT_CONFIG.idle.enabled).toBe(true);
    expect(DEFAULT_CONFIG.idle.idleBehaviors.length).toBeGreaterThan(0);
  });

  it("rituals are enabled for daily structure", () => {
    expect(DEFAULT_CONFIG.ritual.enabled).toBe(true);
    expect(DEFAULT_CONFIG.ritual.morningGreeting).toBe(true);
  });

  it("cursor attention is possible (interactionMode)", () => {
    expect(DEFAULT_CONFIG.behavior.interactionMode).toBe(true);
  });

  it("sounds are off by default (quiet start, not noisy)", () => {
    expect(DEFAULT_CONFIG.audio.kovySounds).toBe(false);
    expect(DEFAULT_CONFIG.audio.uiSounds).toBe(false);
  });

  it("whispers are off by default (not noisy on first launch)", () => {
    expect(DEFAULT_CONFIG.whisper.enabled).toBe(false);
  });

  it("gaming mode is off by default (not distracting)", () => {
    expect(DEFAULT_CONFIG.gaming.enabled).toBe(false);
  });

  it("muse is off by default (not distracting)", () => {
    expect(DEFAULT_CONFIG.muse.enabled).toBe(false);
  });
});
