// ============================================================
// Kovy Dream Engine — visual dream sequences during nap/dream states.
//
// When Kovy enters dream or nap behavior with high dreamIntensity,
// this engine spawns floating, semi-transparent dream particles
// (stars, moons, clouds, tiny fish) that drift upward from Kovy's
// position. Also generates dream-specific thought content and
// a subtle color wash on Kovy's glow.
//
// All local, all heuristic. No AI, no network.
// ============================================================

import type { Vec2, SurfaceMood, BehaviorState, DreamConfig } from "@/store/types";
import { clamp } from "@/lib/utils";

export type DreamParticleType = "star" | "moon" | "cloud" | "fish" | "butterfly" | "balloon" | "heart" | "music";

export interface DreamParticle {
  id: number;
  type: DreamParticleType;
  position: Vec2;
  velocity: Vec2;
  opacity: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  lifetime: number;
  maxLifetime: number;
  hueShift: number;
}

export interface DreamOutput {
  enabled: boolean;
  particles: DreamParticle[];
  colorWashHue: number;
  colorWashIntensity: number;
  dreamThought: string | null;
}

export const NULL_DREAM_OUTPUT: DreamOutput = {
  enabled: false,
  particles: [],
  colorWashHue: 0,
  colorWashIntensity: 0,
  dreamThought: null,
};

const DREAM_THOUGHTS: string[] = [
  "flying over mountains...",
  "chasing a giant butterfly...",
  "floating in space...",
  "swimming through clouds...",
  "dancing with stars...",
  "riding a rainbow...",
  "exploring a candy forest...",
  "talking to the moon...",
  "running through fields of flowers...",
  "catching fireflies in a jar...",
  "sailing on a river of light...",
  "meeting old friends...",
  "discovering a secret garden...",
  "climbing a tower of books...",
  "watching the world from above...",
  "riding a paper airplane...",
  "fishing for stars...",
  "walking through a mirror...",
  "playing hide and seek with the wind...",
  "building a castle of clouds...",
];

const PARTICLE_TYPES: DreamParticleType[] = [
  "star", "moon", "cloud", "fish", "butterfly", "balloon", "heart", "music",
];

let nextParticleId = 0;

export class DreamEngine {
  private particles: DreamParticle[] = [];
  private spawnAccum = 0;
  private thoughtAccum = 0;
  private currentThought: string | null = null;
  private thoughtLifetime = 0;
  private colorWashHue = 0;
  private colorWashIntensity = 0;
  private lastDreamIntensity = 0;

  update(
    dt: number,
    config: DreamConfig,
    position: Vec2,
    behaviorState: BehaviorState,
    dreamIntensity: number,
    surfaceMood: SurfaceMood,
  ): DreamOutput {
    if (!config.enabled) return NULL_DREAM_OUTPUT;

    const isDreaming = behaviorState === "dream" || behaviorState === "nap";
    const effectiveIntensity = isDreaming ? dreamIntensity : 0;

    // Smooth color wash
    const targetWash = config.colorWash && isDreaming ? effectiveIntensity * 0.4 : 0;
    this.colorWashIntensity = clamp(
      this.colorWashIntensity + (targetWash - this.colorWashIntensity) * dt * 2,
      0,
      1,
    );
    // Hue drifts slowly during dreams
    if (isDreaming) {
      this.colorWashHue = (this.colorWashHue + dt * 15) % 360;
    }

    // Spawn particles when dreaming
    if (isDreaming && effectiveIntensity > 0.2) {
      this.spawnAccum += dt * config.particleDensity * effectiveIntensity * 3;
      while (this.spawnAccum >= 1 && this.particles.length < config.maxDreamParticles) {
        this.spawnAccum -= 1;
        this.spawnParticle(position);
      }
    }

    // Update existing particles
    this.particles = this.particles.filter(p => {
      p.lifetime += dt;
      p.position.x += p.velocity.x * dt * 60;
      p.position.y += p.velocity.y * dt * 60;
      p.rotation += p.rotationSpeed * dt;
      // Fade in then out
      const lifeProgress = p.lifetime / p.maxLifetime;
      if (lifeProgress < 0.2) {
        p.opacity = lifeProgress / 0.2 * 0.7;
      } else if (lifeProgress > 0.7) {
        p.opacity = (1 - lifeProgress) / 0.3 * 0.7;
      } else {
        p.opacity = 0.7;
      }
      return p.lifetime < p.maxLifetime;
    });

    // Dream thoughts
    if (isDreaming && effectiveIntensity > 0.3) {
      this.thoughtLifetime += dt;
      if (this.currentThought === null || this.thoughtLifetime > 8) {
        this.thoughtAccum += dt;
        if (this.thoughtAccum > 1 / config.thoughtFrequency) {
          this.thoughtAccum = 0;
          this.currentThought = DREAM_THOUGHTS[Math.floor(Math.random() * DREAM_THOUGHTS.length)];
          this.thoughtLifetime = 0;
        }
      }
    } else {
      this.currentThought = null;
    }

    this.lastDreamIntensity = effectiveIntensity;

    return {
      enabled: true,
      particles: [...this.particles],
      colorWashHue: this.colorWashHue,
      colorWashIntensity: this.colorWashIntensity,
      dreamThought: this.currentThought,
    };
  }

  private spawnParticle(origin: Vec2): void {
    const type = PARTICLE_TYPES[Math.floor(Math.random() * PARTICLE_TYPES.length)];
    const angle = (Math.random() - 0.5) * Math.PI * 0.6 - Math.PI / 2; // upward bias
    const speed = 0.3 + Math.random() * 0.5;
    const spread = 30 + Math.random() * 20;

    this.particles.push({
      id: nextParticleId++,
      type,
      position: {
        x: origin.x + (Math.random() - 0.5) * spread,
        y: origin.y + (Math.random() - 0.5) * 10,
      },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      opacity: 0,
      size: 8 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
      lifetime: 0,
      maxLifetime: 4 + Math.random() * 3,
      hueShift: (Math.random() - 0.5) * 60,
    });
  }

  getParticles(): DreamParticle[] {
    return [...this.particles];
  }

  getDreamThought(): string | null {
    return this.currentThought;
  }

  getColorWash(): { hue: number; intensity: number } {
    return { hue: this.colorWashHue, intensity: this.colorWashIntensity };
  }

  clear(): void {
    this.particles = [];
    this.currentThought = null;
    this.colorWashIntensity = 0;
  }
}
