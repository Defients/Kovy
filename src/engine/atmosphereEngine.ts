// ============================================================
// Kovy Atmosphere Engine — procedural ambient particle generation
// driven by circadian phase, mood state, and user configuration.
//
// Creates a living environmental ambience around Kovy: warm motes
// at dawn, crisp sparkles in morning, lazy dust in afternoon,
// fireflies at dusk, cool wisps at night, nebula drift at deep night.
//
// Local heuristic system. No AI, no network, no cloud.
// ============================================================

import type {
  AtmosphereConfig, AtmosphereParticle, AtmosphereShape, AtmosphereStyle,
  CircadianPhase, SurfaceMood, Vec2,
} from "@/store/types";
import { clamp } from "@/lib/utils";

// --- Phase-specific palettes ---

interface PhasePalette {
  colors: string[];
  shapes: AtmosphereShape[];
  baseSpeed: number;       // base drift speed multiplier
  spawnRate: number;        // relative spawn rate multiplier
  lifetimeRange: [number, number]; // [min, max] seconds
  sizeRange: [number, number];     // [min, max] pixels
}

const PHASE_PALETTES: Record<CircadianPhase, PhasePalette> = {
  dawn: {
    colors: ["hsla(35, 80%, 70%, 0.4)", "hsla(25, 90%, 65%, 0.35)", "hsla(45, 75%, 75%, 0.3)"],
    shapes: ["dot", "wisp"],
    baseSpeed: 8,
    spawnRate: 0.8,
    lifetimeRange: [4, 8],
    sizeRange: [2, 5],
  },
  morning: {
    colors: ["hsla(200, 60%, 80%, 0.3)", "hsla(180, 50%, 85%, 0.25)", "hsla(220, 40%, 90%, 0.2)"],
    shapes: ["dot", "diamond"],
    baseSpeed: 5,
    spawnRate: 0.6,
    lifetimeRange: [3, 6],
    sizeRange: [1.5, 3.5],
  },
  afternoon: {
    colors: ["hsla(40, 50%, 75%, 0.2)", "hsla(30, 40%, 80%, 0.15)", "hsla(50, 45%, 70%, 0.2)"],
    shapes: ["dot", "line"],
    baseSpeed: 3,
    spawnRate: 0.4,
    lifetimeRange: [5, 10],
    sizeRange: [1.5, 4],
  },
  dusk: {
    colors: ["hsla(20, 80%, 60%, 0.35)", "hsla(350, 60%, 65%, 0.3)", "hsla(40, 70%, 55%, 0.3)"],
    shapes: ["dot", "ring", "wisp"],
    baseSpeed: 6,
    spawnRate: 1.0,
    lifetimeRange: [4, 9],
    sizeRange: [2, 5],
  },
  evening: {
    colors: ["hsla(220, 50%, 65%, 0.25)", "hsla(240, 40%, 70%, 0.2)", "hsla(200, 45%, 75%, 0.2)"],
    shapes: ["dot", "wisp", "ring"],
    baseSpeed: 4,
    spawnRate: 0.7,
    lifetimeRange: [5, 10],
    sizeRange: [1.5, 4],
  },
  night: {
    colors: ["hsla(230, 30%, 80%, 0.2)", "hsla(210, 25%, 85%, 0.15)", "hsla(250, 35%, 75%, 0.18)"],
    shapes: ["dot", "cross"],
    baseSpeed: 2,
    spawnRate: 0.5,
    lifetimeRange: [6, 14],
    sizeRange: [1, 3],
  },
  deep_night: {
    colors: ["hsla(270, 30%, 50%, 0.15)", "hsla(280, 25%, 55%, 0.12)", "hsla(260, 35%, 60%, 0.1)"],
    shapes: ["dot", "wisp"],
    baseSpeed: 1.5,
    spawnRate: 0.3,
    lifetimeRange: [8, 18],
    sizeRange: [1.5, 5],
  },
};

// --- Style modifiers ---

const STYLE_SHAPE_OVERRIDE: Record<AtmosphereStyle, AtmosphereShape[] | null> = {
  organic: null, // use phase default
  geometric: ["diamond", "cross", "ring", "line"],
  minimal: ["dot"],
};

// --- Mood modulation ---

function getMoodSpawnMultiplier(mood: SurfaceMood): number {
  switch (mood) {
    case "excited": return 1.6;
    case "playful": return 1.3;
    case "curious": return 1.1;
    case "calm": return 1.0;
    case "focused": return 0.7;
    case "shy": return 0.6;
    case "sleepy": return 0.4;
    case "overwhelmed": return 0.3;
    case "content": return 0.9;
    case "anxious": return 1.2;
    case "nostalgic": return 0.5;
    case "determined": return 0.8;
  }
}

// --- Atmosphere Engine ---

const MAX_PARTICLES = 50;

export class AtmosphereEngine {
  private particles: AtmosphereParticle[] = [];
  private spawnAccum = 0;

  /**
   * Main update tick. Call every frame from the renderer.
   */
  update(
    dt: number,
    config: AtmosphereConfig,
    phase: CircadianPhase,
    mood: SurfaceMood,
    kovyPosition: Vec2,
    screenWidth: number,
    screenHeight: number,
  ): void {
    if (!config.enabled) {
      this.particles = [];
      return;
    }

    const palette = PHASE_PALETTES[config.circadianSync ? phase : "morning"];
    const moodMult = config.moodSync ? getMoodSpawnMultiplier(mood) : 1.0;

    // --- Decay existing particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime -= dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.phase += dt;

      // Gentle sinusoidal drift for organic feel
      p.position.x += Math.sin(p.phase * 0.5) * 0.3 * dt;

      // Fade: smooth in during first 20%, hold, fade out in last 30%
      const lifeFrac = clamp(p.lifetime / p.maxLifetime, 0, 1);
      const fadeIn = clamp(1 - lifeFrac, 0, 0.2) / 0.2; // 0→1 over first 20%
      const fadeOut = lifeFrac < 0.3 ? lifeFrac / 0.3 : 1; // 1→0 over last 30%
      p.opacity = fadeIn * fadeOut * config.density;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // --- Spawn new particles ---
    const baseInterval = 0.6 / (palette.spawnRate * config.density * moodMult + 0.01);
    this.spawnAccum += dt;

    if (this.spawnAccum >= baseInterval && this.particles.length < MAX_PARTICLES) {
      this.spawnAccum = 0;
      this.spawnParticle(config, palette, kovyPosition, screenWidth, screenHeight);
    }
  }

  private spawnParticle(
    config: AtmosphereConfig,
    palette: PhasePalette,
    kovyPos: Vec2,
    screenW: number,
    screenH: number,
  ): void {
    // Spawn in a wide ring around Kovy
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 250;
    const x = clamp(kovyPos.x + Math.cos(angle) * dist, 10, screenW - 10);
    const y = clamp(kovyPos.y + Math.sin(angle) * dist, 10, screenH - 10);

    // Drift direction: mostly upward with slight horizontal variance
    const driftAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = palette.baseSpeed * (0.5 + Math.random() * 1.0);

    const color = palette.colors[Math.floor(Math.random() * palette.colors.length)];
    const shapes = STYLE_SHAPE_OVERRIDE[config.style] ?? palette.shapes;
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const lifetime = palette.lifetimeRange[0] + Math.random() * (palette.lifetimeRange[1] - palette.lifetimeRange[0]);
    const size = palette.sizeRange[0] + Math.random() * (palette.sizeRange[1] - palette.sizeRange[0]);

    this.particles.push({
      position: { x, y },
      velocity: { x: Math.cos(driftAngle) * speed, y: Math.sin(driftAngle) * speed },
      size,
      opacity: 0, // starts invisible, fades in
      lifetime,
      maxLifetime: lifetime,
      color,
      shape,
      phase: Math.random() * Math.PI * 2,
    });
  }

  /** Get all active particles for rendering */
  getParticles(): readonly AtmosphereParticle[] {
    return this.particles;
  }

  /** Get particle count (diagnostics/tests) */
  getParticleCount(): number {
    return this.particles.length;
  }

  /** Clear all particles */
  clear(): void {
    this.particles = [];
  }

  /** Full reset */
  reset(): void {
    this.particles = [];
    this.spawnAccum = 0;
  }
}

// --- Exported helpers ---

/** Get the palette for a circadian phase (for tests/diagnostics) */
export function getPhasePalette(phase: CircadianPhase): PhasePalette {
  return PHASE_PALETTES[phase];
}
