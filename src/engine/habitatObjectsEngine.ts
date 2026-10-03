// ============================================================
// Kovy Habitat Objects Engine — interactive decor
//
// Manages placeable objects in the habitat that Kovy can
// interact with: toys, plants, lamps, etc.
// All local-only, no network.
// ============================================================

export type HabitatObjectType =
  | "toy"
  | "plant"
  | "lamp"
  | "bed"
  | "food_bowl"
  | "mirror"
  | "window"
  | "crystal";

export interface HabitatObjectDef {
  type: HabitatObjectType;
  name: string;
  icon: string;
  description: string;
  /** Behaviors this object attracts */
  attractsBehaviors: string[];
  /** Mood influence when Kovy is near (-0.2 to 0.2) */
  moodInfluence: { curiosity?: number; comfort?: number; playfulness?: number; energy?: number };
  /** Interaction radius in pixels */
  radius: number;
  /** Whether Kovy can "use" this object (triggers special behavior) */
  interactive: boolean;
}

export interface HabitatObjectInstance {
  id: string;
  type: HabitatObjectType;
  position: { x: number; y: number };
  placedAt: number; // unix ms
}

export const HABITAT_OBJECT_DEFS: Record<HabitatObjectType, HabitatObjectDef> = {
  toy: {
    type: "toy",
    name: "Toy",
    icon: "🧸",
    description: "A small toy that attracts playful behavior",
    attractsBehaviors: ["wander", "follow_burst", "orbit"],
    moodInfluence: { playfulness: 0.15, energy: 0.1 },
    radius: 80,
    interactive: true,
  },
  plant: {
    type: "plant",
    name: "Plant",
    icon: "🪴",
    description: "A calming plant that soothes Kovy",
    attractsBehaviors: ["perch", "idle_float", "nap"],
    moodInfluence: { comfort: 0.15, energy: -0.05 },
    radius: 70,
    interactive: false,
  },
  lamp: {
    type: "lamp",
    name: "Lamp",
    icon: "💡",
    description: "A warm light that attracts Kovy at night",
    attractsBehaviors: ["perch", "idle_float"],
    moodInfluence: { comfort: 0.1 },
    radius: 90,
    interactive: false,
  },
  bed: {
    type: "bed",
    name: "Bed",
    icon: "🛏️",
    description: "A cozy bed for naps",
    attractsBehaviors: ["nap", "dream"],
    moodInfluence: { comfort: 0.2, energy: -0.1 },
    radius: 100,
    interactive: true,
  },
  food_bowl: {
    type: "food_bowl",
    name: "Food Bowl",
    icon: "🍽️",
    description: "Restores Kovy's energy",
    attractsBehaviors: ["idle_float", "perch"],
    moodInfluence: { comfort: 0.1, energy: 0.15 },
    radius: 60,
    interactive: true,
  },
  mirror: {
    type: "mirror",
    name: "Mirror",
    icon: "🪞",
    description: "Kovy can admire itself",
    attractsBehaviors: ["inspect", "look_around"],
    moodInfluence: { curiosity: 0.15 },
    radius: 70,
    interactive: true,
  },
  window: {
    type: "window",
    name: "Window",
    icon: "🪟",
    description: "A window to watch the world",
    attractsBehaviors: ["perch", "inspect", "look_around"],
    moodInfluence: { curiosity: 0.1, comfort: 0.05 },
    radius: 100,
    interactive: false,
  },
  crystal: {
    type: "crystal",
    name: "Crystal",
    icon: "💎",
    description: "A mysterious crystal that energizes Kovy",
    attractsBehaviors: ["orbit", "follow_burst"],
    moodInfluence: { energy: 0.2, curiosity: 0.1 },
    radius: 80,
    interactive: true,
  },
};

export interface HabitatObjectsState {
  objects: HabitatObjectInstance[];
}

export function createDefaultHabitatObjectsState(): HabitatObjectsState {
  return { objects: [] };
}

export class HabitatObjectsEngine {
  private state: HabitatObjectsState;

  constructor(initialState?: HabitatObjectsState) {
    this.state = initialState ?? createDefaultHabitatObjectsState();
  }

  getState(): HabitatObjectsState {
    return { objects: [...this.state.objects] };
  }

  addObject(type: HabitatObjectType, position: { x: number; y: number }): HabitatObjectInstance {
    const instance: HabitatObjectInstance = {
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      position,
      placedAt: Date.now(),
    };
    this.state.objects.push(instance);
    return instance;
  }

  removeObject(id: string): boolean {
    const idx = this.state.objects.findIndex(o => o.id === id);
    if (idx === -1) return false;
    this.state.objects.splice(idx, 1);
    return true;
  }

  getObjects(): HabitatObjectInstance[] {
    return [...this.state.objects];
  }

  /** Find objects within range of a position */
  getNearbyObjects(position: { x: number; y: number }, radius: number): Array<{ obj: HabitatObjectInstance; def: HabitatObjectDef; distance: number }> {
    const results: Array<{ obj: HabitatObjectInstance; def: HabitatObjectDef; distance: number }> = [];
    for (const obj of this.state.objects) {
      const def = HABITAT_OBJECT_DEFS[obj.type];
      const dx = obj.position.x - position.x;
      const dy = obj.position.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius + def.radius) {
        results.push({ obj, def, distance: dist });
      }
    }
    return results.sort((a, b) => a.distance - b.distance);
  }

  /** Get mood influence from all nearby objects */
  getMoodInfluence(position: { x: number; y: number }): { curiosity: number; comfort: number; playfulness: number; energy: number } {
    const nearby = this.getNearbyObjects(position, 200);
    const influence = { curiosity: 0, comfort: 0, playfulness: 0, energy: 0 };
    for (const { def, distance } of nearby) {
      const falloff = Math.max(0, 1 - distance / 200);
      influence.curiosity += (def.moodInfluence.curiosity ?? 0) * falloff;
      influence.comfort += (def.moodInfluence.comfort ?? 0) * falloff;
      influence.playfulness += (def.moodInfluence.playfulness ?? 0) * falloff;
      influence.energy += (def.moodInfluence.energy ?? 0) * falloff;
    }
    return influence;
  }

  /** Get behaviors attracted by nearby objects */
  getAttractedBehaviors(position: { x: number; y: number }): string[] {
    const nearby = this.getNearbyObjects(position, 150);
    const behaviors = new Set<string>();
    for (const { def } of nearby) {
      for (const b of def.attractsBehaviors) {
        behaviors.add(b);
      }
    }
    return Array.from(behaviors);
  }

  reset(): void {
    this.state = createDefaultHabitatObjectsState();
  }
}
