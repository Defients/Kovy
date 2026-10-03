// ============================================================
// Kovy Family Scenes Engine — coordinated multi-entity behaviors
//
// Triggers group scenes when multiple entities are present:
// cuddle pile, chase, synchronized orbit, grooming, etc.
// All local-only, no network.
// ============================================================

import type { EntityId, BehaviorState, SurfaceMood, Vec2 } from "@/store/types";
import type { EntityRelation } from "@/engine/entityRelationsEngine";

export type SceneType =
  | "cuddle_pile"
  | "chase"
  | "synchronized_orbit"
  | "grooming"
  | "play_fight"
  | "group_nap"
  | "parade";

export interface SceneDef {
  type: SceneType;
  title: string;
  icon: string;
  description: string;
  minEntities: number;
  maxEntities: number;
  duration: number; // seconds
  moodBias: Partial<Record<SurfaceMood, number>>;
  behaviorsAssigned: Record<string, BehaviorState>; // role → behavior
}

export const SCENE_DEFS: SceneDef[] = [
  {
    type: "cuddle_pile",
    title: "Cuddle Pile",
    icon: "🫂",
    description: "Entities gather together for a cozy cuddle",
    minEntities: 2,
    maxEntities: 5,
    duration: 30,
    moodBias: { calm: 0.3, sleepy: 0.2 },
    behaviorsAssigned: { leader: "nap", follower: "nap" },
  },
  {
    type: "chase",
    title: "Chase",
    icon: "🏃",
    description: "One entity chases another in a playful game",
    minEntities: 2,
    maxEntities: 3,
    duration: 20,
    moodBias: { playful: 0.4, excited: 0.2 },
    behaviorsAssigned: { leader: "follow_burst", follower: "wander" },
  },
  {
    type: "synchronized_orbit",
    title: "Synchronized Orbit",
    icon: "🌀",
    description: "Entities orbit together in perfect harmony",
    minEntities: 2,
    maxEntities: 5,
    duration: 25,
    moodBias: { focused: 0.3, calm: 0.1 },
    behaviorsAssigned: { leader: "orbit", follower: "orbit" },
  },
  {
    type: "grooming",
    title: "Grooming",
    icon: "🧼",
    description: "Entities gently groom each other",
    minEntities: 2,
    maxEntities: 2,
    duration: 15,
    moodBias: { calm: 0.3 },
    behaviorsAssigned: { leader: "perch", follower: "perch" },
  },
  {
    type: "play_fight",
    title: "Play Fight",
    icon: "⚔️",
    description: "Entities engage in friendly roughhousing",
    minEntities: 2,
    maxEntities: 4,
    duration: 15,
    moodBias: { playful: 0.3, excited: 0.3 },
    behaviorsAssigned: { leader: "follow_burst", follower: "follow_burst" },
  },
  {
    type: "group_nap",
    title: "Group Nap",
    icon: "💤",
    description: "All entities settle down for a nap together",
    minEntities: 2,
    maxEntities: 5,
    duration: 60,
    moodBias: { sleepy: 0.4, calm: 0.2 },
    behaviorsAssigned: { leader: "nap", follower: "nap" },
  },
  {
    type: "parade",
    title: "Parade",
    icon: "🚶",
    description: "Entities line up and follow each other in a parade",
    minEntities: 3,
    maxEntities: 5,
    duration: 20,
    moodBias: { playful: 0.2, excited: 0.1 },
    behaviorsAssigned: { leader: "wander", follower: "wander" },
  },
];

export interface ActiveScene {
  type: SceneType;
  startTime: number;
  duration: number;
  participants: EntityId[];
  roles: Map<EntityId, "leader" | "follower">;
}

export interface FamilyScenesState {
  activeScene: ActiveScene | null;
  sceneCooldown: number; // seconds until next scene can trigger
  sceneHistory: Array<{ type: SceneType; timestamp: number; participants: number }>;
}

const SCENE_COOLDOWN = 120; // 2 minutes between scenes
const MAX_HISTORY = 50;

export function createDefaultFamilyScenesState(): FamilyScenesState {
  return {
    activeScene: null,
    sceneCooldown: 30, // initial delay
    sceneHistory: [],
  };
}

export class FamilyScenesEngine {
  private state: FamilyScenesState;

  constructor(initialState?: FamilyScenesState) {
    this.state = initialState ?? createDefaultFamilyScenesState();
  }

  getState(): FamilyScenesState {
    return {
      activeScene: this.state.activeScene ? {
        ...this.state.activeScene,
        roles: new Map(this.state.activeScene.roles),
      } : null,
      sceneCooldown: this.state.sceneCooldown,
      sceneHistory: [...this.state.sceneHistory],
    };
  }

  /** Update — manages active scene lifecycle and triggers new scenes */
  update(
    dt: number,
    entityIds: EntityId[],
    positions: Map<EntityId, Vec2>,
    time: number,
    relations?: EntityRelation[],
  ): ActiveScene | null {
    // Manage active scene
    if (this.state.activeScene) {
      const elapsed = (time - this.state.activeScene.startTime) / 1000;
      if (elapsed >= this.state.activeScene.duration) {
        // Scene ends
        this.state.sceneHistory.push({
          type: this.state.activeScene.type,
          timestamp: time,
          participants: this.state.activeScene.participants.length,
        });
        if (this.state.sceneHistory.length > MAX_HISTORY) {
          this.state.sceneHistory = this.state.sceneHistory.slice(-MAX_HISTORY);
        }
        this.state.activeScene = null;
        this.state.sceneCooldown = SCENE_COOLDOWN;
      }
    }

    // Cooldown
    if (this.state.sceneCooldown > 0) {
      this.state.sceneCooldown -= dt;
      return this.state.activeScene;
    }

    // Try to trigger a new scene
    if (!this.state.activeScene && entityIds.length >= 2) {
      this.tryTriggerScene(entityIds, positions, time, relations);
    }

    return this.state.activeScene;
  }

  private tryTriggerScene(
    entityIds: EntityId[],
    positions: Map<EntityId, Vec2>,
    time: number,
    relations?: EntityRelation[],
  ): void {
    // Find eligible scenes
    const eligible = SCENE_DEFS.filter(
      def => entityIds.length >= def.minEntities &&
             entityIds.length <= def.maxEntities
    );
    if (eligible.length === 0) return;

    // Check proximity — entities need to be reasonably close
    const avgDist = this.computeAverageDistance(entityIds, positions);
    if (avgDist > 400) return; // too far apart

    // Relation-weighted scene selection
    let def: SceneDef;
    if (relations && relations.length > 0) {
      // Compute dominant relation type among participants
      const typeCounts: Record<string, { count: number; strength: number }> = {};
      for (const rel of relations) {
        if (!entityIds.includes(rel.entityA) || !entityIds.includes(rel.entityB)) continue;
        if (!typeCounts[rel.type]) typeCounts[rel.type] = { count: 0, strength: 0 };
        typeCounts[rel.type].count++;
        typeCounts[rel.type].strength += rel.strength;
      }
      const dominantType = Object.entries(typeCounts).sort(
        (a, b) => (b[1].count * b[1].strength) - (a[1].count * a[1].strength)
      )[0]?.[0];

      // Weight scenes by relation type
      const weights = eligible.map(d => {
        let weight = 1.0;
        if (dominantType === "rival") {
          if (d.type === "chase" || d.type === "play_fight") weight = 2.5;
          else if (d.type === "cuddle_pile" || d.type === "grooming") weight = 0.3;
        } else if (dominantType === "friend") {
          if (d.type === "cuddle_pile" || d.type === "grooming" || d.type === "group_nap") weight = 2.0;
          else if (d.type === "play_fight") weight = 0.5;
        } else if (dominantType === "playmate") {
          if (d.type === "play_fight" || d.type === "chase" || d.type === "parade") weight = 1.8;
        } else if (dominantType === "mentor") {
          if (d.type === "synchronized_orbit" || d.type === "parade") weight = 1.5;
        }
        return weight;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalWeight;
      def = eligible[0];
      for (let i = 0; i < eligible.length; i++) {
        r -= weights[i];
        if (r <= 0) { def = eligible[i]; break; }
      }
    } else {
      // No relations — pick randomly as before
      def = eligible[Math.floor(Math.random() * eligible.length)];
    }

    // Assign roles
    const roles = new Map<EntityId, "leader" | "follower">();
    const shuffled = [...entityIds].sort(() => Math.random() - 0.5);
    shuffled.forEach((id, i) => {
      roles.set(id, i === 0 ? "leader" : "follower");
    });

    this.state.activeScene = {
      type: def.type,
      startTime: time,
      duration: def.duration,
      participants: [...shuffled],
      roles,
    };
  }

  private computeAverageDistance(
    entityIds: EntityId[],
    positions: Map<EntityId, Vec2>,
  ): number {
    if (entityIds.length < 2) return 0;
    let totalDist = 0;
    let count = 0;
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const p1 = positions.get(entityIds[i]);
        const p2 = positions.get(entityIds[j]);
        if (p1 && p2) {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          totalDist += Math.sqrt(dx * dx + dy * dy);
          count++;
        }
      }
    }
    return count > 0 ? totalDist / count : 0;
  }

  /** Get the behavior assigned to an entity in the active scene */
  getEntityBehavior(entityId: EntityId): BehaviorState | null {
    if (!this.state.activeScene) return null;
    const role = this.state.activeScene.roles.get(entityId);
    if (!role) return null;
    const def = SCENE_DEFS.find(d => d.type === this.state.activeScene!.type);
    if (!def) return null;
    return def.behaviorsAssigned[role] ?? null;
  }

  /** Get mood bias from active scene */
  getMoodBias(): Partial<Record<SurfaceMood, number>> {
    if (!this.state.activeScene) return {};
    const def = SCENE_DEFS.find(d => d.type === this.state.activeScene!.type);
    return def?.moodBias ?? {};
  }

  /** Force a specific scene (for testing or user trigger) */
  forceScene(type: SceneType, entityIds: EntityId[], time: number): void {
    const def = SCENE_DEFS.find(d => d.type === type);
    if (!def) return;
    const roles = new Map<EntityId, "leader" | "follower">();
    entityIds.forEach((id, i) => {
      roles.set(id, i === 0 ? "leader" : "follower");
    });
    this.state.activeScene = {
      type,
      startTime: time,
      duration: def.duration,
      participants: [...entityIds],
      roles,
    };
  }

  /** Get scene history for journal/export */
  getHistory(): Array<{ type: SceneType; timestamp: number; participants: number }> {
    return [...this.state.sceneHistory];
  }

  reset(): void {
    this.state = createDefaultFamilyScenesState();
  }
}
