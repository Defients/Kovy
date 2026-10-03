// ============================================================
// Toy Engine — manages toy state, physics, and behavioral influence
//
// Toy types:
// - Physics toys: ball (bounces), balloon (floats up), block (pushes)
// - Behavior toys: bed (sleep nearby), laser (chase dot), treat (eat),
//   mouse (hunt), music_box (dance nearby), mirror (interact)
//
// v9.0 fixes:
// - D3: Physics positions are maintained in a separate map, not
//   by mutating the persisted/applied Zustand config toys in place.
//   getRenderToys() returns toys with physics-applied positions.
// - D4: getDominantBehavior() is now wired into the renderer to
//   actually force behavior states. getConsumedToys() exposes the
//   consumed set so the renderer can hide eaten toys.
// ============================================================

import type { ToyConfig, ToyType, PlacedToy, Vec2, SurfaceMood } from "@/store/types";
import { clamp, distance } from "@/lib/utils";

export interface ToyDefinition {
  type: ToyType;
  category: "physics" | "behavior";
  label: string;
  icon: string;
  color: string;
  size: number;
  description: string;
}

export const TOY_DEFINITIONS: Record<ToyType, ToyDefinition> = {
  ball: {
    type: "ball",
    category: "physics",
    label: "Ball",
    icon: "⚽",
    color: "#f97316",
    size: 18,
    description: "Bounces around — Kovy kicks it when nearby",
  },
  balloon: {
    type: "balloon",
    category: "physics",
    label: "Balloon",
    icon: "🎈",
    color: "#ec4899",
    size: 22,
    description: "Floats upward — Kovy bats it away",
  },
  block: {
    type: "block",
    category: "physics",
    label: "Block",
    icon: "🧱",
    color: "#a78bfa",
    size: 20,
    description: "Sits still — Kovy pushes it around",
  },
  bed: {
    type: "bed",
    category: "behavior",
    label: "Bed",
    icon: "🛏️",
    color: "#60a5fa",
    size: 28,
    description: "Kovy sleeps nearby when tired",
  },
  laser: {
    type: "laser",
    category: "behavior",
    label: "Laser Pointer",
    icon: "🔴",
    color: "#ef4444",
    size: 8,
    description: "A moving dot — Kovy chases it",
  },
  treat: {
    type: "treat",
    category: "behavior",
    label: "Treat",
    icon: "🍪",
    color: "#d97706",
    size: 14,
    description: "Kovy eats it and gets happy",
  },
  mouse: {
    type: "mouse",
    category: "behavior",
    label: "Toy Mouse",
    icon: "🐭",
    color: "#9ca3af",
    size: 16,
    description: "Kovy hunts it across the screen",
  },
  music_box: {
    type: "music_box",
    category: "behavior",
    label: "Music Box",
    icon: "🎵",
    color: "#fbbf24",
    size: 20,
    description: "Kovy dances when nearby",
  },
  mirror: {
    type: "mirror",
    category: "behavior",
    label: "Mirror",
    icon: "🪞",
    color: "#e0e7ff",
    size: 24,
    description: "Kovy interacts with its reflection",
  },
};

export interface ToyInfluence {
  toyType: ToyType;
  toyId: string;
  position: Vec2;
  distance: number;
  behavior: string;
  moodDelta: Partial<Record<SurfaceMood, number>>;
}

/// Mapping from toy behavior strings to BehaviorState values
/// that can be passed to BehaviorEngine.forceState().
const TOY_BEHAVIOR_MAP: Record<string, string> = {
  play: "dance",
  push: "wander",
  sleep_near_toy: "nap",
  hunt: "chase",
  eat: "celebrate",
  dance: "dance",
  interact: "inspect",
};

const PHYSICS_TOY_TYPES: ToyType[] = ["ball", "balloon", "block"];

function generateId(): string {
  return `toy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PhysicsEntry {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

export class ToyEngine {
  private config: ToyConfig = { enabled: false, placedToys: [], respawnTreatsMin: 10, laserFollowsCursor: false, siblingsPlay: true, maxToys: 30 };
  /// D3 fix: physics positions are kept in a separate map, not on the config toys.
  /// This prevents mutating the persisted/applied Zustand state every frame.
  private physicsPositions: Map<string, PhysicsEntry> = new Map();
  private consumedToys: Set<string> = new Set();
  private laserTarget: Vec2 | null = null;
  private laserTimer = 0;
  /// Track the last dominant behavior we applied to avoid redundant forceState calls
  private lastAppliedBehavior: string | null = null;

  updateConfig(config: ToyConfig): void {
    this.config = config;
    // Initialize physics state for new physics toys
    for (const toy of config.placedToys) {
      if (PHYSICS_TOY_TYPES.includes(toy.type) && !this.physicsPositions.has(toy.id)) {
        this.physicsPositions.set(toy.id, {
          x: toy.position.x,
          y: toy.position.y,
          vx: (Math.random() - 0.5) * 200,
          vy: (Math.random() - 0.5) * 200,
          angle: Math.random() * Math.PI * 2,
        });
      }
    }
    // Clean up removed toys
    const activeIds = new Set(config.placedToys.map((t) => t.id));
    for (const id of this.physicsPositions.keys()) {
      if (!activeIds.has(id)) this.physicsPositions.delete(id);
    }
    for (const id of this.consumedToys) {
      if (!activeIds.has(id)) this.consumedToys.delete(id);
    }
  }

  addToy(type: ToyType, position: Vec2): PlacedToy | null {
    if (!this.config.enabled) return null;
    if (this.config.placedToys.length >= this.config.maxToys) return null;
    const toy: PlacedToy = {
      id: generateId(),
      type,
      position: { ...position },
      rotation: 0,
      spawnedAt: Date.now(),
    };
    if (PHYSICS_TOY_TYPES.includes(type)) {
      toy.velocity = { x: 0, y: 0 };
      this.physicsPositions.set(toy.id, {
        x: position.x,
        y: position.y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        angle: Math.random() * Math.PI * 2,
      });
    }
    this.config.placedToys.push(toy);
    return toy;
  }

  removeToy(id: string): void {
    const idx = this.config.placedToys.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.config.placedToys.splice(idx, 1);
      this.physicsPositions.delete(id);
      this.consumedToys.delete(id);
    }
  }

  clearAllToys(): void {
    this.config.placedToys = [];
    this.physicsPositions.clear();
    this.consumedToys.clear();
  }

  /// D3 fix: returns toys with physics-applied positions for rendering.
  /// Does NOT mutate the config's placedToys.
  getToys(): PlacedToy[] {
    return this.config.placedToys
      .filter((t) => !this.consumedToys.has(t.id))
      .map((t) => {
        const phys = this.physicsPositions.get(t.id);
        if (phys) {
          return { ...t, position: { x: phys.x, y: phys.y }, rotation: phys.angle };
        }
        return { ...t };
      });
  }

  /// D4 fix: expose the consumed toys set so the renderer can hide eaten treats.
  getConsumedToys(): Set<string> {
    return new Set(this.consumedToys);
  }

  /// D5: drag support — update a toy's base position (for non-physics toys)
  /// or physics position (for physics toys).
  dragToy(id: string, position: Vec2): void {
    const toy = this.config.placedToys.find((t) => t.id === id);
    if (!toy) return;
    const phys = this.physicsPositions.get(id);
    if (phys) {
      phys.x = position.x;
      phys.y = position.y;
      phys.vx *= 0.5;
      phys.vy *= 0.5;
    } else {
      toy.position.x = position.x;
      toy.position.y = position.y;
    }
  }

  /// D5: find a toy at a given screen position (for drag hit-testing).
  /// Returns the toy ID or null.
  hitTest(pos: Vec2): string | null {
    for (const toy of this.config.placedToys) {
      if (this.consumedToys.has(toy.id)) continue;
      const phys = this.physicsPositions.get(toy.id);
      const toyPos = phys ? { x: phys.x, y: phys.y } : toy.position;
      const def = TOY_DEFINITIONS[toy.type];
      const dist = distance(pos.x, pos.y, toyPos.x, toyPos.y);
      if (dist <= def.size + 10) {
        return toy.id;
      }
    }
    return null;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Update physics for physics toys. D3 fix: does NOT mutate config toys. */
  updatePhysics(dt: number, bounds: { width: number; height: number }, kovyPos: Vec2): void {
    if (!this.config.enabled) return;

    for (const toy of this.config.placedToys) {
      if (this.consumedToys.has(toy.id)) continue;
      const state = this.physicsPositions.get(toy.id);
      if (!state) continue;

      if (toy.type === "ball") {
        // Gravity + bounce
        state.vy += 400 * dt;
        state.x += state.vx * dt;
        state.y += state.vy * dt;

        // Bounce off floor
        if (state.y > bounds.height - 30) {
          state.y = bounds.height - 30;
          state.vy = -Math.abs(state.vy) * 0.75;
          state.vx *= 0.9;
        }
        // Bounce off walls
        if (state.x < 20) { state.x = 20; state.vx = Math.abs(state.vx) * 0.8; }
        if (state.x > bounds.width - 20) { state.x = bounds.width - 20; state.vx = -Math.abs(state.vx) * 0.8; }

        // Kovy kicks the ball when close
        const dist = distance(kovyPos.x, kovyPos.y, state.x, state.y);
        if (dist < 50) {
          const dx = state.x - kovyPos.x;
          const dy = state.y - kovyPos.y;
          const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          state.vx += (dx / len) * 300;
          state.vy += (dy / len) * 300 - 100;
        }

        state.angle += state.vx * dt * 0.05;
      } else if (toy.type === "balloon") {
        // Float upward with slight sway
        state.vy -= 30 * dt;
        state.vx += Math.sin(Date.now() * 0.002 + toy.spawnedAt) * 20 * dt;
        state.x += state.vx * dt;
        state.y += state.vy * dt;

        // Wrap around top/bottom
        if (state.y < -30) {
          state.y = bounds.height + 20;
        }
        // Bounce off side walls gently
        if (state.x < 20) { state.x = 20; state.vx = Math.abs(state.vx); }
        if (state.x > bounds.width - 20) { state.x = bounds.width - 20; state.vx = -Math.abs(state.vx); }

        // Kovy bats balloon
        const dist = distance(kovyPos.x, kovyPos.y, state.x, state.y);
        if (dist < 50) {
          state.vy = -200;
          state.vx = (state.x - kovyPos.x) * 3;
        }
      } else if (toy.type === "block") {
        // Slides with friction, no gravity (top-down push)
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.vx *= 0.92;
        state.vy *= 0.92;

        // Bounce off walls
        if (state.x < 20) { state.x = 20; state.vx = Math.abs(state.vx) * 0.5; }
        if (state.x > bounds.width - 20) { state.x = bounds.width - 20; state.vx = -Math.abs(state.vx) * 0.5; }
        if (state.y < 20) { state.y = 20; state.vy = Math.abs(state.vy) * 0.5; }
        if (state.y > bounds.height - 20) { state.y = bounds.height - 20; state.vy = -Math.abs(state.vy) * 0.5; }

        // Kovy pushes block
        const dist = distance(kovyPos.x, kovyPos.y, state.x, state.y);
        if (dist < 45) {
          const dx = state.x - kovyPos.x;
          const dy = state.y - kovyPos.y;
          const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          state.vx += (dx / len) * 150;
          state.vy += (dy / len) * 150;
        }
      }
    }

    // Update laser pointer target
    this.laserTimer += dt;
    if (this.laserTimer > 2) {
      this.laserTimer = 0;
      this.laserTarget = {
        x: Math.random() * bounds.width,
        y: Math.random() * bounds.height,
      };
    }
  }

  /** Get the laser pointer position if a laser toy exists */
  getLaserTarget(): Vec2 | null {
    const hasLaser = this.config.placedToys.some((t) => t.type === "laser" && !this.consumedToys.has(t.id));
    return hasLaser ? this.laserTarget : null;
  }

  /** Compute behavioral influence from toys on an entity at a given position */
  getInfluences(entityPos: Vec2, _mood: SurfaceMood): ToyInfluence[] {
    if (!this.config.enabled) return [];
    const influences: ToyInfluence[] = [];

    for (const toy of this.config.placedToys) {
      if (this.consumedToys.has(toy.id)) continue;

      // D3 fix: use physics position if available
      const phys = this.physicsPositions.get(toy.id);
      const toyPos = phys ? { x: phys.x, y: phys.y } : toy.position;

      const dist = distance(entityPos.x, entityPos.y, toyPos.x, toyPos.y);
      const def = TOY_DEFINITIONS[toy.type];
      const range = def.size + 60;

      if (dist > range * 3) continue;

      let behavior = "";
      let moodDelta: Partial<Record<SurfaceMood, number>> = {};

      switch (toy.type) {
        case "ball":
          behavior = dist < range ? "play" : "";
          moodDelta = dist < range ? { excited: 0.1 } : {};
          break;
        case "balloon":
          behavior = dist < range ? "play" : "";
          moodDelta = dist < range ? { playful: 0.05 } : {};
          break;
        case "block":
          behavior = dist < range ? "push" : "";
          break;
        case "bed":
          behavior = dist < range * 2 ? "sleep_near_toy" : "";
          moodDelta = dist < range * 2 ? { calm: 0.08 } : {};
          break;
        case "laser":
          behavior = "hunt";
          moodDelta = { excited: 0.15 };
          break;
        case "treat":
          if (dist < range) {
            behavior = "eat";
            moodDelta = { content: 0.2 };
            this.consumedToys.add(toy.id);
          }
          break;
        case "mouse":
          behavior = dist < range * 4 ? "hunt" : "";
          moodDelta = dist < range * 4 ? { excited: 0.05 } : {};
          break;
        case "music_box":
          behavior = dist < range * 2 ? "dance" : "";
          moodDelta = dist < range * 2 ? { playful: 0.1 } : {};
          break;
        case "mirror":
          behavior = dist < range ? "interact" : "";
          moodDelta = dist < range ? { curious: 0.08 } : {};
          break;
      }

      if (behavior) {
        influences.push({
          toyType: toy.type,
          toyId: toy.id,
          position: toyPos,
          distance: dist,
          behavior,
          moodDelta,
        });
      }
    }

    return influences;
  }

  /** Get the strongest behavior influence for an entity */
  getDominantBehavior(entityPos: Vec2, mood: SurfaceMood): string | null {
    const influences = this.getInfluences(entityPos, mood);
    if (influences.length === 0) return null;
    // Sort by distance (closest first)
    influences.sort((a, b) => a.distance - b.distance);
    return influences[0].behavior;
  }

  /// D4 fix: get the mapped BehaviorState that should be forced on the
  /// BehaviorEngine based on the dominant toy influence. Returns null
  /// if no toy influence is active or the behavior doesn't map to a
  /// known BehaviorState.
  getDominantBehaviorState(entityPos: Vec2, mood: SurfaceMood): string | null {
    const dominant = this.getDominantBehavior(entityPos, mood);
    if (!dominant) return null;
    return TOY_BEHAVIOR_MAP[dominant] ?? null;
  }

  /** Get aggregate mood deltas from all toy influences */
  getMoodDeltas(entityPos: Vec2, mood: SurfaceMood): Partial<Record<SurfaceMood, number>> {
    const influences = this.getInfluences(entityPos, mood);
    const combined: Partial<Record<SurfaceMood, number>> = {};
    for (const inf of influences) {
      for (const [key, val] of Object.entries(inf.moodDelta)) {
        const k = key as SurfaceMood;
        combined[k] = (combined[k] ?? 0) + (val as number);
      }
    }
    return combined;
  }

  /** Get attraction target (e.g., laser dot or nearest toy) */
  getAttractionTarget(entityPos: Vec2): Vec2 | null {
    if (!this.config.enabled) return null;

    // Laser has highest priority
    const laser = this.getLaserTarget();
    if (laser) return laser;

    // Find nearest toy within reasonable range
    let nearest: Vec2 | null = null;
    let nearestDist = Infinity;
    for (const toy of this.config.placedToys) {
      if (this.consumedToys.has(toy.id)) continue;
      if (toy.type === "bed" || toy.type === "music_box" || toy.type === "mirror") continue;
      // D3 fix: use physics position if available
      const phys = this.physicsPositions.get(toy.id);
      const toyPos = phys ? { x: phys.x, y: phys.y } : toy.position;
      const dist = distance(entityPos.x, entityPos.y, toyPos.x, toyPos.y);
      if (dist < nearestDist && dist < 300) {
        nearestDist = dist;
        nearest = toyPos;
      }
    }
    return nearest;
  }

  destroy(): void {
    this.physicsPositions.clear();
    this.consumedToys.clear();
    this.lastAppliedBehavior = null;
    this.config = { enabled: false, placedToys: [], respawnTreatsMin: 10, laserFollowsCursor: false, siblingsPlay: true, maxToys: 30 };
  }
}
