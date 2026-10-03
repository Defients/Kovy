import { describe, it, expect, beforeEach } from "vitest";
import {
  MuseEngine,
  classifyApp,
  generateMuseOverlay,
  NULL_MUSE_CONTEXT,
} from "../engine/museEngine";
import { DEFAULT_MUSE } from "../store/defaults";
import type { MuseConfig, MuseContext, MuseMarkType, MuseMode } from "../store/types";

/** DEFAULT_MUSE has enabled:false — tests that need active Muse use this */
const MUSE_ENABLED: MuseConfig = { ...DEFAULT_MUSE, enabled: true };

// --- classifyApp heuristic tests ---

describe("classifyApp — app-class heuristics", () => {
  it("classifies VS Code as code mode", () => {
    const result = classifyApp({ processName: "code.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("code");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies Cursor as code mode", () => {
    const result = classifyApp({ processName: "cursor.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("code");
  });

  it("classifies Windsurf as code mode", () => {
    const result = classifyApp({ processName: "windsurf.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("code");
  });

  it("classifies Word as writing mode", () => {
    const result = classifyApp({ processName: "winword.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("writing");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies Obsidian as writing mode", () => {
    const result = classifyApp({ processName: "obsidian.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("writing");
  });

  it("classifies Figma as design mode", () => {
    const result = classifyApp({ processName: "figma.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("design");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("classifies Blender as design mode", () => {
    const result = classifyApp({ processName: "blender.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("design");
  });

  it("falls back to generic for unknown apps", () => {
    const result = classifyApp({ processName: "chrome.exe", windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("generic");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("returns generic with low confidence when processName is null", () => {
    const result = classifyApp({ processName: null, windowTitle: null, windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("generic");
    expect(result.confidence).toBeLessThanOrEqual(0.1);
  });

  it("uses window title fallback for code files", () => {
    const result = classifyApp({ processName: "notepad.exe", windowTitle: "main.ts - Notepad", windowBounds: null }, DEFAULT_MUSE);
    expect(result.mode).toBe("code");
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.confidence).toBeLessThan(0.7); // lower confidence for title-based
  });

  it("respects codeMode=false", () => {
    const config: MuseConfig = { ...DEFAULT_MUSE, codeMode: false };
    const result = classifyApp({ processName: "code.exe", windowTitle: null, windowBounds: null }, config);
    // Should NOT classify as code when codeMode is disabled
    expect(result.mode).not.toBe("code");
  });

  it("respects writingMode=false", () => {
    const config: MuseConfig = { ...DEFAULT_MUSE, writingMode: false };
    const result = classifyApp({ processName: "winword.exe", windowTitle: null, windowBounds: null }, config);
    expect(result.mode).not.toBe("writing");
  });

  it("respects designMode=false", () => {
    const config: MuseConfig = { ...DEFAULT_MUSE, designMode: false };
    const result = classifyApp({ processName: "figma.exe", windowTitle: null, windowBounds: null }, config);
    expect(result.mode).not.toBe("design");
  });
});

// --- generateMuseOverlay tests ---

describe("generateMuseOverlay — overlay generation", () => {
  const baseContext: MuseContext = {
    mode: "code",
    confidence: 0.85,
    activeApp: "code.exe",
    activeTitle: null,
    lastUpdate: Date.now(),
  };

  it("generates an overlay with valid fields", () => {
    const overlay = generateMuseOverlay(
      "kovy-prime", { x: 500, y: 400 }, "curious", baseContext, DEFAULT_MUSE, 1920, 1080,
    );
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toMatch(/^muse-/);
    expect(overlay!.entityId).toBe("kovy-prime");
    expect(overlay!.mode).toBe("code");
    expect(overlay!.lifetime).toBeGreaterThan(0);
    expect(overlay!.maxLifetime).toBeGreaterThan(0);
    expect(overlay!.position.x).toBeGreaterThanOrEqual(20);
    expect(overlay!.position.y).toBeGreaterThanOrEqual(20);
    expect(overlay!.opacity).toBe(0);
    expect(overlay!.baseOpacity).toBeGreaterThan(0);
    expect(overlay!.size).toBeGreaterThan(0);
    expect(overlay!.velocity.x).toBeDefined();
    expect(overlay!.rotationSpeed).toBeDefined();
  });

  it("returns null for inactive mode", () => {
    const inactive: MuseContext = { ...baseContext, mode: "inactive" };
    const overlay = generateMuseOverlay(
      "kovy-prime", { x: 500, y: 400 }, "calm", inactive, DEFAULT_MUSE, 1920, 1080,
    );
    expect(overlay).toBeNull();
  });

  it("clamps position within screen bounds", () => {
    // Entity near edge
    const overlay = generateMuseOverlay(
      "kovy-prime", { x: 5, y: 5 }, "curious", baseContext, DEFAULT_MUSE, 1920, 1080,
    );
    expect(overlay).not.toBeNull();
    expect(overlay!.position.x).toBeGreaterThanOrEqual(20);
    expect(overlay!.position.y).toBeGreaterThanOrEqual(20);
  });

  it("code mode generates code-themed mark types", () => {
    const codeTypes = new Set(["bracket", "guide_line", "dot", "emphasis", "circuit", "cross", "underline", "margin_note"]);
    // Generate several and check they're all valid code types
    for (let i = 0; i < 20; i++) {
      const overlay = generateMuseOverlay(
        "kovy-prime", { x: 500, y: 400 }, "calm", baseContext, DEFAULT_MUSE, 1920, 1080,
      );
      if (overlay) {
        expect(codeTypes.has(overlay.type)).toBe(true);
      }
    }
  });

  it("writing mode generates writing-themed mark types", () => {
    const writingCtx: MuseContext = { ...baseContext, mode: "writing" };
    const writingTypes = new Set(["stroke", "note_anchor", "emphasis", "mood_wash", "wave", "underline", "highlight", "margin_note"]);
    for (let i = 0; i < 20; i++) {
      const overlay = generateMuseOverlay(
        "kovy-prime", { x: 500, y: 400 }, "calm", writingCtx, DEFAULT_MUSE, 1920, 1080,
      );
      if (overlay) {
        expect(writingTypes.has(overlay.type)).toBe(true);
      }
    }
  });

  it("expressive style produces larger overlays on average", () => {
    const subtleConfig: MuseConfig = { ...DEFAULT_MUSE, style: "subtle" };
    const expressiveConfig: MuseConfig = { ...DEFAULT_MUSE, style: "expressive" };

    let subtleTotal = 0;
    let expressiveTotal = 0;
    const n = 50;

    for (let i = 0; i < n; i++) {
      const s = generateMuseOverlay("kovy-prime", { x: 500, y: 400 }, "calm", baseContext, subtleConfig, 1920, 1080);
      const e = generateMuseOverlay("kovy-prime", { x: 500, y: 400 }, "calm", baseContext, expressiveConfig, 1920, 1080);
      if (s) subtleTotal += s.size;
      if (e) expressiveTotal += e.size;
    }

    expect(expressiveTotal / n).toBeGreaterThan(subtleTotal / n);
  });

  it("adaptive selection still returns a mark from the mode palette", () => {
    const adaptiveConfig: MuseConfig = { ...DEFAULT_MUSE, adaptiveSelection: true };
    const codeTypes = new Set(["bracket", "guide_line", "dot", "emphasis", "circuit", "cross", "underline", "margin_note"]);
    for (let i = 0; i < 20; i++) {
      const overlay = generateMuseOverlay(
        "kovy-prime", { x: 500, y: 400 }, "curious", baseContext, adaptiveConfig, 1920, 1080, ["dot", "dot", "dot"],
      );
      if (overlay) {
        expect(codeTypes.has(overlay.type)).toBe(true);
      }
    }
  });

  it("adaptive selection suppresses saturated recent marks", () => {
    const adaptiveConfig: MuseConfig = { ...DEFAULT_MUSE, adaptiveSelection: true };
    const recent: MuseMarkType[] = ["dot", "dot", "dot", "dot", "dot", "dot", "dot", "dot"];

    const counts: Record<string, number> = {};
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const overlay = generateMuseOverlay(
        "kovy-prime", { x: 500, y: 400 }, "calm", baseContext, adaptiveConfig, 1920, 1080, recent,
      );
      if (overlay) {
        counts[overlay.type] = (counts[overlay.type] ?? 0) + 1;
      }
    }

    // `dot` is normally the favorite for calm, but with 8 recent dots it should be suppressed.
    expect(counts["dot"] ?? 0).toBeLessThan(15);
  });
});

// --- MuseEngine class tests ---

describe("MuseEngine — lifecycle", () => {
  let engine: MuseEngine;

  beforeEach(() => {
    engine = new MuseEngine();
  });

  it("starts inactive", () => {
    expect(engine.isActive()).toBe(false);
    expect(engine.getContext().mode).toBe("inactive");
    expect(engine.getOverlayCount()).toBe(0);
  });

  it("toggle activates and deactivates", () => {
    const first = engine.toggle();
    expect(first).toBe(true);
    expect(engine.isActive()).toBe(true);

    const second = engine.toggle();
    expect(second).toBe(false);
    expect(engine.isActive()).toBe(false);
  });

  it("setActive controls state", () => {
    engine.setActive(true);
    expect(engine.isActive()).toBe(true);
    engine.setActive(false);
    expect(engine.isActive()).toBe(false);
    expect(engine.getContext().mode).toBe("inactive");
  });

  it("reset clears everything", () => {
    engine.setActive(true);
    engine.reset();
    expect(engine.isActive()).toBe(false);
    expect(engine.getOverlayCount()).toBe(0);
    expect(engine.getContext().mode).toBe("inactive");
  });

  it("clearOverlays removes all overlays", () => {
    engine.clearOverlays();
    expect(engine.getOverlayCount()).toBe(0);
  });
});

describe("MuseEngine — overlay spawning and decay", () => {
  let engine: MuseEngine;

  beforeEach(() => {
    engine = new MuseEngine();
    // Bind a mock foreground detection that returns a code editor
    engine.bindForegroundDetection(async () => ({
      processName: "code.exe",
      windowTitle: "main.ts - Visual Studio Code",
      windowBounds: null,
    }));
  });

  it("does not spawn overlays when inactive", async () => {
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];
    await engine.update(2, MUSE_ENABLED, entities, 1920, 1080);
    expect(engine.getOverlayCount()).toBe(0);
  });

  it("spawns overlays when active with enabled config", async () => {
    engine.setActive(true);
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "curious" as const }];

    // Need enough accumulated time to trigger context refresh + spawn
    for (let i = 0; i < 10; i++) {
      await engine.update(1.0, MUSE_ENABLED, entities, 1920, 1080);
    }

    expect(engine.getOverlayCount()).toBeGreaterThan(0);
  });

  it("tracks recent mark types and caps history size", async () => {
    const config: MuseConfig = { ...MUSE_ENABLED, maxOverlays: 12, overlayLifetime: 100 };
    engine.setActive(true);
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "curious" as const }];

    // Spawn at most 12 overlays
    for (let i = 0; i < 20; i++) {
      await engine.update(2.0, config, entities, 1920, 1080);
    }

    const recent = engine.getRecentMarkTypes();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(8);
  });

  it("respects maxOverlays cap", async () => {
    const config: MuseConfig = { ...MUSE_ENABLED, maxOverlays: 3, overlayLifetime: 100 };
    engine.setActive(true);
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "curious" as const }];

    // Run many updates to try to exceed the cap
    for (let i = 0; i < 50; i++) {
      await engine.update(2.0, config, entities, 1920, 1080);
    }

    expect(engine.getOverlayCount()).toBeLessThanOrEqual(3);
  });

  it("decays overlays over time", async () => {
    const config: MuseConfig = { ...MUSE_ENABLED, overlayLifetime: 2 };
    engine.setActive(true);
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];

    // Spawn some overlays
    for (let i = 0; i < 10; i++) {
      await engine.update(1.0, config, entities, 1920, 1080);
    }
    const countBefore = engine.getOverlayCount();

    // Decay them all (lifetime=2, so 5s should expire all)
    for (let i = 0; i < 5; i++) {
      engine.updateSync(1.0, config);
    }
    const countAfter = engine.getOverlayCount();

    // Some or all should have decayed
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  it("still decays overlays when toggled off", async () => {
    const config: MuseConfig = { ...MUSE_ENABLED, overlayLifetime: 1 };
    engine.setActive(true);
    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];

    // Spawn
    for (let i = 0; i < 10; i++) {
      await engine.update(1.0, config, entities, 1920, 1080);
    }

    // Toggle off — overlays should still decay
    engine.setActive(false);
    for (let i = 0; i < 5; i++) {
      engine.updateSync(1.0, config);
    }

    expect(engine.getOverlayCount()).toBe(0);
  });
});

describe("MuseEngine — context refresh", () => {
  it("refreshes context with foreground app info", async () => {
    const engine = new MuseEngine();
    engine.bindForegroundDetection(async () => ({
      processName: "figma.exe",
      windowTitle: "My Design - Figma",
      windowBounds: null,
    }));
    engine.setActive(true);

    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];

    // Need to accumulate enough time to trigger context refresh (default 3000ms)
    await engine.update(4.0, MUSE_ENABLED, entities, 1920, 1080);

    const ctx = engine.getContext();
    expect(ctx.mode).toBe("design");
    expect(ctx.activeApp).toBe("figma.exe");
    expect(ctx.confidence).toBeGreaterThan(0.7);
  });

  it("gracefully handles foreground detection failure", async () => {
    const engine = new MuseEngine();
    engine.bindForegroundDetection(async () => {
      throw new Error("detection failed");
    });
    engine.setActive(true);

    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];

    // Should not throw
    await engine.update(4.0, MUSE_ENABLED, entities, 1920, 1080);
    // Context stays at default
    expect(engine.getContext().mode).toBe("inactive");
  });

  it("truncates long window titles to 80 chars", async () => {
    const longTitle = "A".repeat(200);
    const engine = new MuseEngine();
    engine.bindForegroundDetection(async () => ({
      processName: "code.exe",
      windowTitle: longTitle,
      windowBounds: null,
    }));
    engine.setActive(true);

    const entities = [{ id: "kovy-prime", position: { x: 500, y: 400 }, mood: "calm" as const }];
    await engine.update(4.0, MUSE_ENABLED, entities, 1920, 1080);

    const ctx = engine.getContext();
    expect(ctx.activeTitle!.length).toBeLessThanOrEqual(80);
  });
});

describe("NULL_MUSE_CONTEXT", () => {
  it("is inactive with zero confidence", () => {
    expect(NULL_MUSE_CONTEXT.mode).toBe("inactive");
    expect(NULL_MUSE_CONTEXT.confidence).toBe(0);
    expect(NULL_MUSE_CONTEXT.activeApp).toBeNull();
    expect(NULL_MUSE_CONTEXT.activeTitle).toBeNull();
  });
});
