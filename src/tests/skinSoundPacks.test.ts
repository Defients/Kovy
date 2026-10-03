// ============================================================
// Skin Packs & Sound Packs Tests
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  SkinPackEngine,
  BUILTIN_SKIN_PACKS,
  createDefaultSkinPackState,
  type SkinPack,
} from "@/engine/skinPackEngine";
import {
  SoundPackEngine,
  BUILTIN_SOUND_PACKS,
  createDefaultSoundPackState,
  type SoundPack,
} from "@/engine/soundPackEngine";

// --- Skin Pack Tests ---

describe("SkinPackEngine", () => {
  let engine: SkinPackEngine;

  beforeEach(() => {
    engine = new SkinPackEngine();
  });

  it("has 8 builtin skin packs", () => {
    expect(BUILTIN_SKIN_PACKS).toHaveLength(8);
  });

  it("starts with default pack active", () => {
    expect(engine.getState().activePackId).toBe("default");
  });

  it("getActivePack returns the active pack", () => {
    const pack = engine.getActivePack();
    expect(pack.id).toBe("default");
    expect(pack.primaryColor).toBeTruthy();
  });

  it("setActivePack changes active pack", () => {
    expect(engine.setActivePack("ember")).toBe(true);
    expect(engine.getActivePack().id).toBe("ember");
  });

  it("setActivePack returns false for unknown id", () => {
    expect(engine.setActivePack("nonexistent")).toBe(false);
  });

  it("getAllPacks returns builtin + custom", () => {
    const custom: SkinPack = {
      ...BUILTIN_SKIN_PACKS[0],
      id: "custom",
      name: "Custom",
      builtin: false,
    };
    engine.addCustomPack(custom);
    const all = engine.getAllPacks();
    expect(all.length).toBe(BUILTIN_SKIN_PACKS.length + 1);
    expect(all.some(p => p.id === "custom")).toBe(true);
  });

  it("addCustomPack marks as non-builtin", () => {
    engine.addCustomPack({ ...BUILTIN_SKIN_PACKS[0], id: "test" });
    const custom = engine.getCustomPacks();
    expect(custom[0].builtin).toBe(false);
  });

  it("removeCustomPack removes by id", () => {
    engine.addCustomPack({ ...BUILTIN_SKIN_PACKS[0], id: "test" });
    expect(engine.removeCustomPack("test")).toBe(true);
    expect(engine.getCustomPacks()).toHaveLength(0);
  });

  it("removeCustomPack resets active if removed", () => {
    engine.addCustomPack({ ...BUILTIN_SKIN_PACKS[0], id: "test" });
    engine.setActivePack("test");
    engine.removeCustomPack("test");
    expect(engine.getState().activePackId).toBe("default");
  });

  it("reset restores default state", () => {
    engine.addCustomPack({ ...BUILTIN_SKIN_PACKS[0], id: "test" });
    engine.setActivePack("ember");
    engine.reset();
    expect(engine.getState().activePackId).toBe("default");
    expect(engine.getCustomPacks()).toHaveLength(0);
  });

  it("createDefaultSkinPackState returns valid state", () => {
    const state = createDefaultSkinPackState();
    expect(state.activePackId).toBe("default");
    expect(state.customPacks).toEqual([]);
  });

  it("all builtin packs have valid colors", () => {
    for (const pack of BUILTIN_SKIN_PACKS) {
      expect(pack.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      if (pack.secondaryColor) {
        expect(pack.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

// --- Sound Pack Tests ---

describe("SoundPackEngine", () => {
  let engine: SoundPackEngine;

  beforeEach(() => {
    engine = new SoundPackEngine();
  });

  it("has 7 builtin sound packs", () => {
    expect(BUILTIN_SOUND_PACKS).toHaveLength(7);
  });

  it("starts with default pack active", () => {
    expect(engine.getState().activePackId).toBe("default");
  });

  it("getActivePack returns the active pack", () => {
    const pack = engine.getActivePack();
    expect(pack.id).toBe("default");
    expect(pack.sounds.poke).toBeTruthy();
  });

  it("setActivePack changes active pack", () => {
    expect(engine.setActivePack("chimes")).toBe(true);
    expect(engine.getActivePack().id).toBe("chimes");
  });

  it("setActivePack returns false for unknown id", () => {
    expect(engine.setActivePack("nonexistent")).toBe(false);
  });

  it("silent pack has zero volume for all sounds", () => {
    engine.setActivePack("silent");
    const pack = engine.getActivePack();
    expect(pack.sounds.poke.volume).toBe(0);
    expect(pack.sounds.celebrate.volume).toBe(0);
  });

  it("addCustomPack adds a custom pack", () => {
    const custom: SoundPack = {
      ...BUILTIN_SOUND_PACKS[0],
      id: "custom",
      name: "Custom",
      builtin: false,
    };
    engine.addCustomPack(custom);
    expect(engine.getCustomPacks()).toHaveLength(1);
  });

  it("removeCustomPack removes by id", () => {
    engine.addCustomPack({ ...BUILTIN_SOUND_PACKS[0], id: "test" });
    expect(engine.removeCustomPack("test")).toBe(true);
    expect(engine.getCustomPacks()).toHaveLength(0);
  });

  it("reset restores default state", () => {
    engine.setActivePack("retro");
    engine.reset();
    expect(engine.getState().activePackId).toBe("default");
  });

  it("createDefaultSoundPackState returns valid state", () => {
    const state = createDefaultSoundPackState();
    expect(state.activePackId).toBe("default");
    expect(state.customPacks).toEqual([]);
  });

  it("all builtin packs have all 10 sound types", () => {
    for (const pack of BUILTIN_SOUND_PACKS) {
      expect(pack.sounds.poke).toBeDefined();
      expect(pack.sounds.hover).toBeDefined();
      expect(pack.sounds.swipe).toBeDefined();
      expect(pack.sounds.nap).toBeDefined();
      expect(pack.sounds.dream).toBeDefined();
      expect(pack.sounds.stretch).toBeDefined();
      expect(pack.sounds.yawn).toBeDefined();
      expect(pack.sounds.startle).toBeDefined();
      expect(pack.sounds.celebrate).toBeDefined();
      expect(pack.sounds.wander).toBeDefined();
    }
  });

  it("all non-silent packs have oscillators array with at least 1 entry", () => {
    for (const pack of BUILTIN_SOUND_PACKS) {
      if (pack.id === "silent") continue;
      for (const snd of Object.values(pack.sounds)) {
        expect(snd.oscillators).toBeDefined();
        expect(snd.oscillators.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("vinyl pack has noise on poke", () => {
    const vinyl = BUILTIN_SOUND_PACKS.find(p => p.id === "vinyl");
    expect(vinyl).toBeDefined();
    expect(vinyl!.sounds.poke.noise).toBeDefined();
    expect(vinyl!.sounds.poke.noise!.volume).toBeGreaterThan(0);
  });

  it("cosmic pack has vibrato on dream", () => {
    const cosmic = BUILTIN_SOUND_PACKS.find(p => p.id === "cosmic");
    expect(cosmic).toBeDefined();
    expect(cosmic!.sounds.dream.vibrato).toBeDefined();
    expect(cosmic!.sounds.dream.vibrato!.rate).toBeGreaterThan(0);
  });
});
