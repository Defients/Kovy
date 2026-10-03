// ============================================================
// Kovy Muse Engine — heuristic app-class detection + procedural overlay generation
// No OCR, no LLM, no screen understanding. Honest app-class heuristics only.
// ============================================================

import type {
  MuseConfig, MuseContext, MuseOverlayData, MuseMode, MuseMarkType, MuseStyle,
  EntityId, Vec2, SurfaceMood,
} from "@/store/types";
import type { ForegroundAppInfo } from "@/lib/tauriBridge";
import { randomRange, clamp } from "@/lib/utils";

// --- App-class heuristic tables ---

const CODE_APPS = new Set([
  "code.exe", "code", "devenv.exe", "idea64.exe", "idea", "pycharm64.exe",
  "webstorm64.exe", "rider64.exe", "clion64.exe", "goland64.exe",
  "sublime_text.exe", "sublime_text", "atom.exe", "atom",
  "notepad++.exe", "vim", "nvim", "emacs", "terminal", "cmd.exe",
  "powershell.exe", "pwsh.exe", "windowsterminal.exe", "wt.exe",
  "alacritty.exe", "alacritty", "wezterm-gui.exe", "iterm2",
  "eclipse.exe", "netbeans64.exe", "android studio.exe",
  "cursor.exe", "cursor", "windsurf.exe", "windsurf",
  "zed.exe", "zed",
]);

const WRITING_APPS = new Set([
  "winword.exe", "word", "docs", "notion.exe", "notion",
  "obsidian.exe", "obsidian", "typora.exe", "typora",
  "scrivener.exe", "bear", "ulysses", "ia writer",
  "libreoffice", "soffice.exe", "soffice.bin",
  "onenote.exe", "evernote.exe", "simplenote.exe",
  "marktext.exe", "zettlr.exe",
]);

const DESIGN_APPS = new Set([
  "figma.exe", "figma", "sketch", "photoshop.exe", "illustrator.exe",
  "afterfx.exe", "premiere.exe", "davinci resolve.exe",
  "blender.exe", "blender", "gimp.exe", "gimp", "inkscape.exe", "inkscape",
  "canva", "affinity designer.exe", "affinity photo.exe",
  "krita.exe", "krita", "aseprite.exe",
  "unity.exe", "unrealengine", "godot.exe",
]);

// --- Heuristic classifier ---

export function classifyApp(info: ForegroundAppInfo, config: MuseConfig): { mode: MuseMode; confidence: number } {
  if (!info.processName) return { mode: "generic", confidence: 0.1 };

  const proc = info.processName.toLowerCase();

  if (config.codeMode && CODE_APPS.has(proc)) {
    return { mode: "code", confidence: 0.85 };
  }
  if (config.writingMode && WRITING_APPS.has(proc)) {
    return { mode: "writing", confidence: 0.8 };
  }
  if (config.designMode && DESIGN_APPS.has(proc)) {
    return { mode: "design", confidence: 0.8 };
  }

  // Fallback heuristics from window title (lower confidence)
  const title = (info.windowTitle ?? "").toLowerCase();
  if (config.codeMode && (title.includes(".ts") || title.includes(".py") || title.includes(".rs") || title.includes(".js") || title.includes(".cpp") || title.includes("- visual studio"))) {
    return { mode: "code", confidence: 0.5 };
  }
  if (config.writingMode && (title.includes("document") || title.includes("- word") || title.includes("- docs") || title.includes("- notion"))) {
    return { mode: "writing", confidence: 0.45 };
  }
  if (config.designMode && (title.includes("- figma") || title.includes("- photoshop") || title.includes("untitled design"))) {
    return { mode: "design", confidence: 0.45 };
  }

  return { mode: "generic", confidence: 0.2 };
}

// --- Mark type palettes per mode ---

const MODE_MARK_TYPES: Record<MuseMode, MuseMarkType[]> = {
  code: ["bracket", "guide_line", "dot", "emphasis", "circuit", "cross", "underline", "margin_note"],
  writing: ["stroke", "note_anchor", "emphasis", "mood_wash", "wave", "underline", "highlight", "margin_note"],
  design: ["arc", "dot", "guide_line", "stroke", "geometry", "ring_burst", "highlight"],
  generic: ["dot", "mood_wash", "sparkle", "underline"],
  inactive: [],
};

const MODE_COLORS: Record<MuseMode, string[]> = {
  code: ["hsl(180, 50%, 60%)", "hsl(210, 45%, 55%)", "hsl(160, 40%, 50%)", "hsl(140, 60%, 55%)"],
  writing: ["hsl(40, 55%, 60%)", "hsl(30, 50%, 55%)", "hsl(50, 45%, 65%)", "hsl(20, 60%, 60%)"],
  design: ["hsl(280, 50%, 60%)", "hsl(320, 45%, 55%)", "hsl(260, 40%, 65%)", "hsl(340, 60%, 60%)"],
  generic: ["hsl(210, 30%, 55%)", "hsl(200, 25%, 50%)", "hsl(220, 40%, 60%)"],
  inactive: [],
};

// Mark types considered emblematic of each mode; high confidence leans into these.
const EMBLEM_MARKS: Record<MuseMode, MuseMarkType[]> = {
  code: ["bracket", "circuit", "guide_line", "cross"],
  writing: ["stroke", "note_anchor", "underline", "margin_note"],
  design: ["arc", "geometry", "ring_burst", "guide_line"],
  generic: ["dot", "mood_wash", "sparkle", "underline"],
  inactive: [],
};

// Mood-based mark preference boost. Positive values gently favor mark types
// that visually match the surface mood; negative values disfavor them.
const MOOD_MARK_BIAS: Record<SurfaceMood, Record<string, number>> = {
  calm: { dot: 0.4, mood_wash: 0.4, guide_line: 0.2, underline: 0.1, ring_burst: -0.2 },
  curious: { circuit: 0.4, bracket: 0.3, dot: 0.3, guide_line: 0.2, wave: 0.1 },
  playful: { wave: 0.4, sparkle: 0.4, ring_burst: 0.3, cross: 0.1, dot: 0.2 },
  focused: { guide_line: 0.4, bracket: 0.3, geometry: 0.2, highlight: 0.2, underline: 0.1, wave: -0.2 },
  sleepy: { dot: 0.5, mood_wash: 0.3, underline: 0.1, wave: 0.1 },
  excited: { ring_burst: 0.4, cross: 0.3, sparkle: 0.3, wave: 0.2, emphasis: 0.2 },
  overwhelmed: { dot: 0.3, mood_wash: 0.3, underline: 0.2, guide_line: 0.1, ring_burst: -0.3 },
  shy: { dot: 0.4, mood_wash: 0.3, underline: 0.1, wave: -0.1 },
  content: { stroke: 0.3, dot: 0.3, note_anchor: 0.2, mood_wash: 0.2 },
  anxious: { cross: 0.2, dot: 0.2, guide_line: 0.1, ring_burst: -0.1 },
  nostalgic: { note_anchor: 0.3, mood_wash: 0.3, underline: 0.2, dot: 0.1 },
  determined: { bracket: 0.3, geometry: 0.3, guide_line: 0.2, emphasis: 0.2 },
};

// --- Adaptive mark selection ---

const RECENT_HISTORY_SIZE = 8;

/**
 * Weighted-random mark selection. When adaptiveSelection is enabled, the
 * choice is informed by the current surface mood, the classifier confidence,
 * and a recency penalty that discourages immediate repetition.
 */
function selectMark(
  mode: MuseMode,
  marks: MuseMarkType[],
  mood: SurfaceMood,
  confidence: number,
  adaptive: boolean,
  recentTypes: MuseMarkType[],
): MuseMarkType {
  if (!adaptive || marks.length <= 1) {
    return marks[Math.floor(Math.random() * marks.length)];
  }

  const bias = MOOD_MARK_BIAS[mood] ?? {};
  const emblem = new Set(EMBLEM_MARKS[mode]);
  const recent = recentTypes.slice(-RECENT_HISTORY_SIZE);

  const weights = marks.map((type) => {
    let w = 1.0;

    // Recency penalty: repeated recent types are less likely.
    const recentCount = recent.filter((r) => r === type).length;
    w -= recentCount * 0.35;

    // Mood bias: types that match the surface mood get a gentle boost.
    w += (bias[type] ?? 0) * 0.5;

    // Confidence shaping: high-confidence contexts lean into emblematic
    // mode marks; low confidence flattens the distribution for variety.
    if (emblem.has(type)) {
      w *= 0.75 + confidence * 0.5;
    } else {
      w *= 1.05 - confidence * 0.1;
    }

    return { type, weight: Math.max(0.05, w) };
  });

  const total = weights.reduce((sum, { weight }) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const { type, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return type;
  }

  // Fallback to first mark (should rarely be reached)
  return marks[0];
}

// --- Muse overlay generation ---

let overlayIdCounter = 0;

function generateOverlayId(): string {
  overlayIdCounter += 1;
  return `muse-${overlayIdCounter}-${Date.now().toString(36)}`;
}

export function generateMuseOverlay(
  entityId: EntityId,
  entityPosition: Vec2,
  mood: SurfaceMood,
  context: MuseContext,
  config: MuseConfig,
  screenW: number,
  screenH: number,
  recentTypes: MuseMarkType[] = [],
): MuseOverlayData | null {
  if (context.mode === "inactive") return null;

  const marks = MODE_MARK_TYPES[context.mode];
  const colors = MODE_COLORS[context.mode];
  if (marks.length === 0 || colors.length === 0) return null;

  const type = selectMark(context.mode, marks, mood, context.confidence, config.adaptiveSelection, recentTypes);
  const color = colors[Math.floor(Math.random() * colors.length)];

  // Position: near the entity with some spread
  const spread = config.style === "expressive" ? 250 : 150;
  const angle = Math.random() * Math.PI * 2;
  const dist = randomRange(40, spread);
  const pos: Vec2 = {
    x: clamp(entityPosition.x + Math.cos(angle) * dist, 20, screenW - 20),
    y: clamp(entityPosition.y + Math.sin(angle) * dist, 20, screenH - 20),
  };

  // Dynamics: slight drift and rotation
  const velocity: Vec2 = {
    x: randomRange(-15, 15),
    y: randomRange(-20, -5), // generally drift upward
  };
  const rotationSpeed = randomRange(-0.2, 0.2);

  // Size: mood-influenced
  const moodScale = mood === "curious" || mood === "playful" ? 1.4 : mood === "sleepy" || mood === "overwhelmed" ? 0.6 : 1.0;
  const baseSize = config.style === "expressive" ? randomRange(15, 40) : randomRange(8, 22);
  const size = baseSize * moodScale;

  const lifetime = config.overlayLifetime * randomRange(0.8, 1.2);
  const baseOpacity = config.style === "expressive" ? randomRange(0.4, 0.8) : randomRange(0.2, 0.5);

  return {
    id: generateOverlayId(),
    type,
    position: pos,
    velocity,
    size,
    rotation: randomRange(-Math.PI, Math.PI),
    rotationSpeed,
    opacity: 0, // start invisible and fade in
    baseOpacity,
    color,
    lifetime,
    maxLifetime: lifetime,
    entityId,
    mode: context.mode,
  };
}

// --- Muse Engine class ---

export const NULL_MUSE_CONTEXT: MuseContext = {
  mode: "inactive",
  confidence: 0,
  activeApp: null,
  activeTitle: null,
  lastUpdate: 0,
};

export class MuseEngine {
  private context: MuseContext = { ...NULL_MUSE_CONTEXT };
  private overlays: MuseOverlayData[] = [];
  private active = false;
  private contextUpdateAccum = 0;
  private spawnAccum = 0;
  private recentMarkTypes: MuseMarkType[] = [];
  private getForegroundApp: (() => Promise<ForegroundAppInfo>) | null = null;

  /** Bind the foreground app detection function (injected to avoid direct import in tests) */
  bindForegroundDetection(fn: () => Promise<ForegroundAppInfo>): void {
    this.getForegroundApp = fn;
  }

  /** Toggle Muse active state */
  toggle(): boolean {
    this.active = !this.active;
    if (!this.active) {
      this.context = { ...NULL_MUSE_CONTEXT };
      // Don't immediately clear overlays — let them fade
    }
    return this.active;
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.context = { ...NULL_MUSE_CONTEXT };
    }
  }

  getContext(): MuseContext {
    return this.context;
  }

  getOverlays(): readonly MuseOverlayData[] {
    return this.overlays;
  }

  getOverlayCount(): number {
    return this.overlays.length;
  }

  /** Returns the recently spawned mark types used for adaptive selection. */
  getRecentMarkTypes(): readonly MuseMarkType[] {
    return this.recentMarkTypes;
  }

  /**
   * Main update tick — called every frame from the renderer.
   * Handles context refresh (throttled), overlay spawning (throttled), and overlay lifetime decay.
   */
  async update(
    dt: number,
    config: MuseConfig,
    entities: Array<{ id: EntityId; position: Vec2; mood: SurfaceMood }>,
    screenW: number,
    screenH: number,
  ): Promise<void> {
    if (!this.active || !config.enabled) {
      return;
    }

    // --- Context refresh (throttled) ---
    this.contextUpdateAccum += dt * 1000;
    if (this.contextUpdateAccum >= config.contextUpdateIntervalMs) {
      this.contextUpdateAccum = 0;
      await this.refreshContext(config);
    }

    // --- Spawn new overlays (throttled, ~1 per second base rate) ---
    if (this.context.mode !== "inactive" && entities.length > 0) {
      const spawnInterval = config.style === "expressive" ? 0.6 : 1.2;
      this.spawnAccum += dt;
      if (this.spawnAccum >= spawnInterval) {
        this.spawnAccum = 0;
        this.trySpawnOverlay(config, entities, screenW, screenH);
      }
    }
  }

  /** Synchronous update for frame-based decay only (no async context refresh) */
  updateSync(dt: number, config: MuseConfig): void {
    if (!this.active || !config.enabled) {
      this.decayOverlays(dt);
      return;
    }
    this.decayOverlays(dt);
  }

  private decayOverlays(dt: number): void {
    for (const o of this.overlays) {
      o.lifetime -= dt;
      // Fade in and out
      const lifeFraction = Math.max(0, o.lifetime / o.maxLifetime);
      
      if (lifeFraction > 0.9) {
        // Fade in (first 10% of life)
        const fadeInFraction = (1 - lifeFraction) * 10; // 0 to 1
        o.opacity = o.baseOpacity * fadeInFraction;
      } else if (lifeFraction < 0.3) {
        // Fade out (last 30% of life)
        o.opacity = o.baseOpacity * (lifeFraction / 0.3);
      } else {
        // Full opacity
        o.opacity = o.baseOpacity;
      }
    }
    // Remove expired
    this.overlays = this.overlays.filter((o) => o.lifetime > 0);
  }

  private async refreshContext(config: MuseConfig): Promise<void> {
    if (!this.getForegroundApp) return;

    try {
      const appInfo = await this.getForegroundApp();
      const { mode, confidence } = classifyApp(appInfo, config);

      this.context = {
        mode,
        confidence,
        activeApp: appInfo.processName,
        activeTitle: appInfo.windowTitle ? appInfo.windowTitle.slice(0, 80) : null,
        lastUpdate: Date.now(),
      };
    } catch {
      // Keep existing context on failure — graceful degradation
    }
  }

  private trySpawnOverlay(
    config: MuseConfig,
    entities: Array<{ id: EntityId; position: Vec2; mood: SurfaceMood }>,
    screenW: number,
    screenH: number,
  ): void {
    // Enforce hard cap
    if (this.overlays.length >= config.maxOverlays) return;

    // Pick a random entity to generate from
    const entity = entities[Math.floor(Math.random() * entities.length)];
    if (!entity) return;

    const overlay = generateMuseOverlay(
      entity.id,
      entity.position,
      entity.mood,
      this.context,
      config,
      screenW,
      screenH,
      this.recentMarkTypes,
    );

    if (overlay) {
      this.overlays.push(overlay);
      this.recentMarkTypes.push(overlay.type);
      if (this.recentMarkTypes.length > RECENT_HISTORY_SIZE) {
        this.recentMarkTypes.shift();
      }
    }
  }

  /** Force-clear all overlays */
  clearOverlays(): void {
    this.overlays = [];
  }

  /** Full reset */
  reset(): void {
    this.active = false;
    this.context = { ...NULL_MUSE_CONTEXT };
    this.overlays = [];
    this.recentMarkTypes = [];
    this.contextUpdateAccum = 0;
    this.spawnAccum = 0;
  }
}
