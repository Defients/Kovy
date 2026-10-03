import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThoughtEngine } from "@/engine/thoughtEngine";
import { WhisperEngine } from "@/engine/whisperEngine";
import { CelebrationEngine } from "@/engine/celebrationEngine";
import { PersonalityEvolutionEngine } from "@/engine/personalityEvolutionEngine";
import { createDefaultProfiles, ProfilesEngine } from "@/engine/profilesEngine";
import { useEntityStore, FOUNDER_ID } from "@/store/entityStore";
import type { ThoughtConfig, WhisperConfig, CelebrationConfig, BehaviorPreset, WeatherType } from "@/store/types";
import { CONFIG_VERSION } from "@/store/types";

const thoughtConfig: ThoughtConfig = {
  enabled: true,
  frequency: 1.0,
  maxActive: 5,
  style: "comic",
  customThoughts: [],
};

const whisperConfig: WhisperConfig = {
  enabled: true,
  frequency: 1.0,
  style: "subtitle",
  categories: ["encouragement", "humor", "facts", "comfort"],
  customMessages: [],
};

const celebrationConfig: CelebrationConfig = {
  enabled: true,
  focusThreshold: 5,
  returnThreshold: 72,
  weekendCelebration: true,
};

describe("Personality coherence — thoughts", () => {
  it("goblin personality produces goblin-flavored thoughts", () => {
    const engine = new ThoughtEngine();
    const goblinThoughts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const out = engine.update(10, thoughtConfig, "calm", "idle_float", { x: 100, y: 100 }, "goblin" as BehaviorPreset);
      for (const b of out.bubbles) goblinThoughts.add(b.text);
    }
    const goblinPool = ["hehehe", "mine!", "chaos time!"];
    expect(goblinPool.some(t => goblinThoughts.has(t))).toBe(true);
  });

  it("chill personality produces chill-flavored thoughts", () => {
    const engine = new ThoughtEngine();
    const chillThoughts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const out = engine.update(10, thoughtConfig, "calm", "idle_float", { x: 100, y: 100 }, "chill" as BehaviorPreset);
      for (const b of out.bubbles) chillThoughts.add(b.text);
    }
    const chillPool = ["just vibing", "all is well", "no rush..."];
    expect(chillPool.some(t => chillThoughts.has(t))).toBe(true);
  });

  it("works without personality preset (backward compatible)", () => {
    const engine = new ThoughtEngine();
    const out = engine.update(10, thoughtConfig, "curious", "idle_float", { x: 100, y: 100 });
    expect(out.enabled).toBe(true);
  });
});

describe("Personality coherence — whispers", () => {
  it("goblin personality biases toward humor category", () => {
    const engine = new WhisperEngine();
    const categoryCounts: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const out = engine.update(20, whisperConfig, { x: 100, y: 100 }, "goblin" as BehaviorPreset);
      for (const m of out.messages) {
        categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
      }
    }
    // Goblin weights humor at 1.8 vs others lower — humor should be most common
    const humorCount = categoryCounts["humor"] ?? 0;
    const factsCount = categoryCounts["facts"] ?? 0;
    expect(humorCount).toBeGreaterThan(factsCount);
  });

  it("curious personality biases toward facts category", () => {
    const engine = new WhisperEngine();
    const categoryCounts: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const out = engine.update(20, whisperConfig, { x: 100, y: 100 }, "curious" as BehaviorPreset);
      for (const m of out.messages) {
        categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
      }
    }
    const factsCount = categoryCounts["facts"] ?? 0;
    const comfortCount = categoryCounts["comfort"] ?? 0;
    expect(factsCount).toBeGreaterThan(comfortCount);
  });

  it("works without personality preset (backward compatible)", () => {
    const engine = new WhisperEngine();
    const out = engine.update(20, whisperConfig, { x: 100, y: 100 });
    expect(out.enabled).toBe(true);
  });
});

describe("Personality coherence — celebrations", () => {
  it("goblin personality produces goblin-flavored celebration messages", () => {
    const engine = new CelebrationEngine();
    engine.recordUserActivity();
    // Force a return celebration by manipulating lastSeen to past
    // We'll use focus milestone instead
    const out = engine.update(celebrationConfig, 10, "goblin" as BehaviorPreset);
    expect(out.pendingEvent).not.toBeNull();
    expect(out.pendingEvent!.message).toContain("Goblins");
  });

  it("chill personality produces chill-flavored celebration messages", () => {
    const engine = new CelebrationEngine();
    engine.recordUserActivity();
    const out = engine.update(celebrationConfig, 10, "chill" as BehaviorPreset);
    expect(out.pendingEvent).not.toBeNull();
    expect(out.pendingEvent!.message).toContain("flow");
  });

  it("uses fallback message without personality preset", () => {
    const engine = new CelebrationEngine();
    engine.recordUserActivity();
    const out = engine.update(celebrationConfig, 10);
    expect(out.pendingEvent).not.toBeNull();
    expect(out.pendingEvent!.message).toContain("Great work");
  });
});

describe("Weather-influenced thoughts", () => {
  it("rain weather produces rain-flavored thoughts", () => {
    const engine = new ThoughtEngine();
    const rainThoughts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const out = engine.update(10, thoughtConfig, "calm", "idle_float", { x: 100, y: 100 }, undefined, "rain" as WeatherType);
      for (const b of out.bubbles) rainThoughts.add(b.text);
    }
    const rainPool = ["rainy day...", "listen to the rain", "puddles!"];
    expect(rainPool.some(t => rainThoughts.has(t))).toBe(true);
  });

  it("snow weather produces snow-flavored thoughts", () => {
    const engine = new ThoughtEngine();
    const snowThoughts = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const out = engine.update(10, thoughtConfig, "calm", "idle_float", { x: 100, y: 100 }, undefined, "snow" as WeatherType);
      for (const b of out.bubbles) snowThoughts.add(b.text);
    }
    const snowPool = ["snow!", "so pretty...", "winter wonderland"];
    expect(snowPool.some(t => snowThoughts.has(t))).toBe(true);
  });
});

describe("Default profiles", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates 6 default profiles with correct names", () => {
    const profiles = createDefaultProfiles();
    expect(profiles).toHaveLength(6);
    expect(profiles.map(p => p.name)).toEqual(["Default", "Focus", "Streaming", "Gaming", "Low Power", "Cozy"]);
  });

  it("each profile has valid config with version", () => {
    const profiles = createDefaultProfiles();
    for (const p of profiles) {
      expect(p.config.version).toBe(CONFIG_VERSION);
      expect(p.id).toBeTruthy();
      expect(p.icon).toBeTruthy();
    }
  });

  it("focus profile suppresses emotes and sound", () => {
    const profiles = createDefaultProfiles();
    const focus = profiles.find(p => p.name === "Focus")!;
    expect(focus.config.focus.enabled).toBe(true);
    expect(focus.config.focus.suppressEmotes).toBe(true);
    expect(focus.config.focus.suppressSound).toBe(true);
  });

  it("low power profile has battery preset and low FPS", () => {
    const profiles = createDefaultProfiles();
    const lowPower = profiles.find(p => p.name === "Low Power")!;
    expect(lowPower.config.performance.preset).toBe("battery");
    expect(lowPower.config.performance.maxRenderFps).toBe(24);
  });

  it("seedDefaultProfiles populates empty engine", () => {
    const engine = new ProfilesEngine();
    engine.seedDefaultProfiles();
    expect(engine.getProfile("profile-default")).not.toBeNull();
    expect(engine.getProfile("profile-focus")).not.toBeNull();
  });
});

describe("PersonalityEvolutionEngine — drift + entityStore wiring", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    });
    useEntityStore.setState({ entities: {}, entityOrder: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces non-zero offsets after sustained mood history", () => {
    const engine = new PersonalityEvolutionEngine();
    const cfg = { enabled: true, evolutionRate: 1.0 };
    // Record 20 curious moods → curiosityBias should drift positive
    for (let i = 0; i < 20; i++) engine.recordMood("curious");
    const out = engine.update(60, cfg);
    expect(out.enabled).toBe(true);
    expect(out.offsets.curiosityBias).toBeGreaterThan(0);
  });

  it("drift description reflects accumulated offsets", () => {
    const engine = new PersonalityEvolutionEngine();
    const cfg = { enabled: true, evolutionRate: 1.0 };
    // Record 20 playful moods → playfulnessBias should drift positive
    for (let i = 0; i < 20; i++) engine.recordMood("playful");
    // Run enough updates to accumulate > 0.1
    for (let i = 0; i < 20; i++) engine.update(60, cfg);
    const out = engine.update(60, cfg);
    expect(out.driftDescription).toContain("playful");
  });

  it("returns disabled when config disabled", () => {
    const engine = new PersonalityEvolutionEngine();
    const out = engine.update(60, { enabled: false, evolutionRate: 0.3 });
    expect(out.enabled).toBe(false);
    expect(out.offsets.curiosityBias).toBe(0);
  });

  it("wiring: setEntityPersonality updates entityStore meta", () => {
    useEntityStore.getState().initFounder();
    const engine = new PersonalityEvolutionEngine();
    const cfg = { enabled: true, evolutionRate: 1.0 };
    for (let i = 0; i < 20; i++) engine.recordMood("excited");
    const out = engine.update(60, cfg);

    // Simulate the wiring from KovyRenderer.tsx
    useEntityStore.getState().setEntityPersonality(FOUNDER_ID, out.offsets);

    const meta = useEntityStore.getState().getEntityMeta(FOUNDER_ID);
    expect(meta).toBeDefined();
    expect(meta!.personality.energyBias).toBe(out.offsets.energyBias);
    expect(meta!.personality.playfulnessBias).toBe(out.offsets.playfulnessBias);
  });

  it("wiring: personality offsets are reflected in entity metadata for rendering", () => {
    useEntityStore.getState().initFounder();
    const testOffsets = {
      curiosityBias: 0.15,
      energyBias: 0.2,
      shynessBias: -0.1,
      playfulnessBias: 0.05,
      wanderBias: 0.0,
      colorHueOffset: 30,
      sizeOffset: 0.08,
    };
    useEntityStore.getState().setEntityPersonality(FOUNDER_ID, testOffsets);

    const meta = useEntityStore.getState().getEntityMeta(FOUNDER_ID);
    expect(meta!.personality).toEqual(testOffsets);
    // These fields are consumed by KovyCharacterRenderer for hue + size
    expect(meta!.personality.colorHueOffset).toBe(30);
    expect(meta!.personality.sizeOffset).toBe(0.08);
  });

  it("reset clears offsets and mood history", () => {
    const engine = new PersonalityEvolutionEngine();
    const cfg = { enabled: true, evolutionRate: 1.0 };
    for (let i = 0; i < 20; i++) engine.recordMood("curious");
    engine.update(60, cfg);
    engine.reset();
    const out = engine.update(60, cfg);
    expect(out.offsets.curiosityBias).toBe(0);
    expect(out.driftDescription).toBe("stable personality");
  });
});
