// ============================================================
// Kovy Emote Engine — contextual emote particle spawning
// driven by mood state, behavior transitions, and family proximity.
//
// Emotes are short-lived symbolic particles (hearts, stars, ZZZs)
// that communicate Kovy's inner state visually. They are the
// primary channel through which Kovy "speaks" without words.
//
// Local heuristic system. No AI, no network, no cloud.
// ============================================================

import type {
  EmoteConfig, EmoteType, EmoteParticle,
  SurfaceMood, BehaviorState, EntityId, Vec2,
} from "@/store/types";
import { clamp } from "@/lib/utils";

// --- Mood → Emote type mapping ---

const MOOD_EMOTES: Record<SurfaceMood, EmoteType[]> = {
  calm:        ["flower", "note"],
  curious:     ["question", "spark"],
  playful:     ["heart", "star", "note"],
  focused:     ["ellipsis", "spark"],
  sleepy:      ["zzz", "ellipsis"],
  excited:     ["star", "exclaim", "spark", "heart"],
  overwhelmed: ["sweat", "swirl", "spiral"],
  shy:         ["ellipsis", "flower", "sweat"],
  content:     ["flower", "note", "sun"],
  anxious:     ["sweat", "swirl", "lightning"],
  nostalgic:   ["moon", "note", "rainbow"],
  determined:  ["fire", "exclaim", "spark"],
};

// --- Behavior transition → Emote burst mapping ---

const TRANSITION_EMOTES: Partial<Record<BehaviorState, EmoteType[]>> = {
  inspect:      ["question"],
  celebrate:    ["star", "exclaim"],
  nap:          ["zzz"],
  dream:        ["zzz", "star"],
  startle:      ["exclaim"],
  recover:      ["sweat"],
  perch:        ["flower"],
  dash_inspect: ["spark"],
  burst_orbit:  ["spark", "star"],
  chain_seek:   ["exclaim"],
  peek:         ["question", "ellipsis"],
  stretch:      ["sweat"],
  look_around:  ["question", "ellipsis"],
  yawn:         ["zzz"],
  snap_perch:   ["spark"],
  follow_burst: ["spark", "exclaim"],
  dance:        ["music", "star"],
  hide:         ["ellipsis"],
  play_dead:    ["zzz"],
  investigate:  ["question", "spark"],
  meditate:     ["note"],
};

// --- Emote Engine ---

let nextParticleId = 0;

export class EmoteEngine {
  private particles: EmoteParticle[] = [];
  private passiveAccum = 0;
  private readonly PASSIVE_INTERVAL = 3.0; // seconds between passive emotes

  /**
   * Called on behavior state transitions.
   * Spawns 1-2 emotes matching the new state.
   */
  onBehaviorTransition(
    prevState: BehaviorState,
    newState: BehaviorState,
    entityId: EntityId,
    position: Vec2,
    config: EmoteConfig,
  ): void {
    if (!config.enabled) return;

    const types = TRANSITION_EMOTES[newState];
    if (!types || types.length === 0) return;

    // Spawn 1-2 emotes
    const count = config.intensity > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= config.maxActive) break;
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnEmote(type, entityId, position, config);
    }
  }

  /**
   * Called every frame. Handles passive emote spawning and particle decay.
   */
  update(
    dt: number,
    config: EmoteConfig,
    entities: ReadonlyArray<{
      id: EntityId;
      position: Vec2;
      mood: SurfaceMood;
      behaviorState: BehaviorState;
    }>,
  ): void {
    if (!config.enabled) {
      this.particles = [];
      return;
    }

    // Decay existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifetime -= dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.rotation += p.rotationSpeed * dt;

      // Fade: full opacity for first 60%, then linear fade
      const lifeFrac = clamp(p.lifetime / p.maxLifetime, 0, 1);
      if (lifeFrac < 0.4) {
        p.opacity = lifeFrac / 0.4;
      }

      // Gentle upward drift + deceleration
      p.velocity.y -= 8 * dt;
      p.velocity.x *= 0.98;

      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Passive spawning (mood-driven, throttled)
    this.passiveAccum += dt;
    const passiveInterval = this.PASSIVE_INTERVAL / Math.max(config.intensity, 0.1);
    if (this.passiveAccum >= passiveInterval) {
      this.passiveAccum = 0;

      for (const entity of entities) {
        if (this.particles.length >= config.maxActive) break;

        // Only spawn passive emotes for sustained mood states
        if (entity.behaviorState === "idle_float" ||
            entity.behaviorState === "perch" ||
            entity.behaviorState === "nap" ||
            entity.behaviorState === "dream") {
          const types = MOOD_EMOTES[entity.mood];
          if (types.length > 0 && Math.random() < config.intensity * 0.6) {
            const type = types[Math.floor(Math.random() * types.length)];
            this.spawnEmote(type, entity.id, entity.position, config);
          }
        }
      }
    }
  }

  /**
   * Spawn a single emote particle near the entity.
   */
  private spawnEmote(
    type: EmoteType,
    entityId: EntityId,
    position: Vec2,
    config: EmoteConfig,
  ): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // mostly upward
    const speed = 20 + Math.random() * 25;
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = -20 - Math.random() * 15; // above entity

    this.particles.push({
      id: nextParticleId++,
      type,
      position: { x: position.x + offsetX, y: position.y + offsetY },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      opacity: config.intensity * 0.8,
      lifetime: 1.5 + Math.random() * 1.0,
      maxLifetime: 1.5 + Math.random() * 1.0,
      size: 10 + Math.random() * 6,
      entityId,
      rotation: (Math.random() - 0.5) * 0.3,
      rotationSpeed: (Math.random() - 0.5) * 0.8,
    });

    // Fix: maxLifetime should equal lifetime at spawn
    const p = this.particles[this.particles.length - 1];
    p.maxLifetime = p.lifetime;
  }

  /** Get all active particles for rendering */
  getParticles(): readonly EmoteParticle[] {
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
    this.passiveAccum = 0;
  }
}

// --- Exported helpers ---

/** Get emote types appropriate for a mood */
export function getEmotesForMood(mood: SurfaceMood): EmoteType[] {
  return MOOD_EMOTES[mood];
}

/** Get emote types appropriate for a behavior transition */
export function getEmotesForTransition(state: BehaviorState): EmoteType[] {
  return TRANSITION_EMOTES[state] ?? [];
}
