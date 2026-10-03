import type {
  EntityId,
  KovyEntityInfo,
  KovyRuntimeState,
  FamilyConfig,
  FamilyDynamics,
  PersonalityOffsets,
  Vec2,
  SurfaceMood,
  InternalMoodState,
  BehaviorState,
  HabitatConfig,
} from "@/store/types";
import type { EntityState } from "@/store/entityStore";
import type { EntityRelation } from "@/engine/entityRelationsEngine";
import { clamp, lerp, distance, randomRange } from "@/lib/utils";

// --- Family Interaction Result ---

export interface FamilyInfluence {
  curiosityContagion: number;   // -0.3 to 0.3
  comfortContagion: number;     // -0.3 to 0.3
  playfulChase: boolean;        // should this entity chase another?
  chaseTargetId: EntityId | null;
  chaseTargetPos: Vec2 | null;
  syncOrbit: boolean;           // should this entity sync orbit with others?
  syncOrbitCenter: Vec2 | null;
  groupHyperBurst: boolean;     // is a group hyper burst active?
  territoryPull: Vec2 | null;   // pull toward preferred home
  nearbyCount: number;          // how many siblings are close
}

export const NULL_FAMILY_INFLUENCE: FamilyInfluence = {
  curiosityContagion: 0,
  comfortContagion: 0,
  playfulChase: false,
  chaseTargetId: null,
  chaseTargetPos: null,
  syncOrbit: false,
  syncOrbitCenter: null,
  groupHyperBurst: false,
  territoryPull: null,
  nearbyCount: 0,
};

// --- Proximity Thresholds ---

const NEARBY_RADIUS = 250;
const CHASE_TRIGGER_RADIUS = 400;
const CHASE_CATCH_RADIUS = 60;
const TERRITORY_PULL_RADIUS = 500;
const SYNC_ORBIT_RADIUS = 200;

// --- Family Engine ---

export class FamilyEngine {
  private chaseState: Map<EntityId, { targetId: EntityId; timer: number }> = new Map();
  private groupHyperTimer = 0;
  private groupHyperActive = false;

  update(
    dt: number,
    entities: EntityState[],
    dynamics: FamilyDynamics,
    habitat: HabitatConfig,
    relations?: EntityRelation[],
  ): Map<EntityId, FamilyInfluence> {
    const results = new Map<EntityId, FamilyInfluence>();

    if (entities.length <= 1) {
      for (const e of entities) {
        results.set(e.meta.id, { ...NULL_FAMILY_INFLUENCE });
      }
      return results;
    }

    // Update group hyper timer
    this.groupHyperTimer = Math.max(0, this.groupHyperTimer - dt);
    if (this.groupHyperTimer <= 0) this.groupHyperActive = false;

    // Update chase timers
    for (const [id, chase] of this.chaseState) {
      chase.timer -= dt;
      if (chase.timer <= 0) this.chaseState.delete(id);
    }

    for (const entity of entities) {
      const influence = this.computeInfluence(dt, entity, entities, dynamics, habitat, relations);
      results.set(entity.meta.id, influence);
    }

    return results;
  }

  private computeInfluence(
    _dt: number,
    entity: EntityState,
    allEntities: EntityState[],
    dynamics: FamilyDynamics,
    habitat: HabitatConfig,
    relations?: EntityRelation[],
  ): FamilyInfluence {
    const pos = entity.runtime.position;
    const siblings = allEntities.filter((e) => e.meta.id !== entity.meta.id);
    const influence: FamilyInfluence = { ...NULL_FAMILY_INFLUENCE };

    // Build relation lookup map for O(1) access: key = "idA:idB" (sorted)
    const relMap = new Map<string, EntityRelation>();
    if (relations) {
      for (const r of relations) {
        const key = r.entityA < r.entityB
          ? `${r.entityA}:${r.entityB}`
          : `${r.entityB}:${r.entityA}`;
        relMap.set(key, r);
      }
    }
    const getRelation = (a: EntityId, b: EntityId): EntityRelation | undefined => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      return relMap.get(key);
    };

    // --- Nearby count ---
    const nearby = siblings.filter(
      (s) => distance(pos.x, pos.y, s.runtime.position.x, s.runtime.position.y) < NEARBY_RADIUS
    );
    influence.nearbyCount = nearby.length;

    // --- Curiosity contagion ---
    if (dynamics.curiosityContagion > 0 && nearby.length > 0) {
      let avgCuriosity = 0;
      for (const s of nearby) {
        avgCuriosity += s.runtime.internalMood.curiosity;
      }
      avgCuriosity /= nearby.length;
      const selfCuriosity = entity.runtime.internalMood.curiosity;
      influence.curiosityContagion = (avgCuriosity - selfCuriosity) * dynamics.curiosityContagion * 0.3;
      influence.curiosityContagion = clamp(influence.curiosityContagion, -0.3, 0.3);
    }

    // --- Comfort influence (modulated by entity relations) ---
    if (dynamics.comfortInfluence > 0 && nearby.length > 0) {
      let avgComfort = 0;
      for (const s of nearby) {
        avgComfort += s.runtime.internalMood.comfort;
      }
      avgComfort /= nearby.length;
      const selfComfort = entity.runtime.internalMood.comfort;
      let comfortMod = 1.0;
      if (relations && relations.length > 0) {
        for (const s of nearby) {
          const rel = getRelation(entity.meta.id, s.meta.id);
          if (rel) {
            if (rel.type === "friend") comfortMod += rel.strength * 0.3;
            else if (rel.type === "rival") comfortMod -= rel.strength * 0.2;
          }
        }
        comfortMod = clamp(comfortMod, 0.3, 1.5);
      }
      influence.comfortContagion = (avgComfort - selfComfort) * dynamics.comfortInfluence * 0.3 * comfortMod;
      influence.comfortContagion = clamp(influence.comfortContagion, -0.3, 0.3);
    }

    // --- Playful chase (modulated by entity relations) ---
    if (dynamics.playfulChaseChance > 0) {
      const existingChase = this.chaseState.get(entity.meta.id);
      if (existingChase) {
        const target = siblings.find((s) => s.meta.id === existingChase.targetId);
        if (target) {
          const d = distance(pos.x, pos.y, target.runtime.position.x, target.runtime.position.y);
          if (d < CHASE_CATCH_RADIUS) {
            // Caught! End chase
            this.chaseState.delete(entity.meta.id);
          } else {
            influence.playfulChase = true;
            influence.chaseTargetId = existingChase.targetId;
            influence.chaseTargetPos = { ...target.runtime.position };
          }
        }
      } else if (isPlayfulMood(entity.runtime.surfaceMood)) {
        // Check if we should start a chase
        const chaseCandidates = siblings.filter((s) => {
          const d = distance(pos.x, pos.y, s.runtime.position.x, s.runtime.position.y);
          return d < CHASE_TRIGGER_RADIUS && d > CHASE_CATCH_RADIUS && isPlayfulMood(s.runtime.surfaceMood);
        });
        if (chaseCandidates.length > 0) {
          // Relation-modulated chase chance: rivals chase more, friends chase less
          let chaseChance = dynamics.playfulChaseChance * 0.02;
          if (relations && relations.length > 0) {
            // Pick the best candidate weighted by relation
            const weighted = chaseCandidates.map(s => {
              const rel = getRelation(entity.meta.id, s.meta.id);
              let weight = 1.0;
              if (rel) {
                if (rel.type === "rival") weight = 1.0 + rel.strength * 0.8;
                else if (rel.type === "friend") weight = 1.0 - rel.strength * 0.4;
                else if (rel.type === "playmate") weight = 1.0 + rel.strength * 0.3;
              }
              return { s, weight };
            });
            // Apply weighted chance
            const bestWeighted = weighted.reduce((best, w) => w.weight > best.weight ? w : best, weighted[0]);
            chaseChance *= bestWeighted.weight;
          }
          if (Math.random() < chaseChance) {
            const target = chaseCandidates[Math.floor(Math.random() * chaseCandidates.length)];
            this.chaseState.set(entity.meta.id, { targetId: target.meta.id, timer: 4 + Math.random() * 3 });
            influence.playfulChase = true;
            influence.chaseTargetId = target.meta.id;
            influence.chaseTargetPos = { ...target.runtime.position };
          }
        }
      }
    }

    // --- Synchronized orbit ---
    if (dynamics.synchronizedOrbit && nearby.length > 0) {
      const orbitingSiblings = nearby.filter(
        (s) => s.runtime.behaviorState === "orbit" || s.runtime.behaviorState === "burst_orbit"
      );
      if (orbitingSiblings.length > 0 && entity.runtime.behaviorState === "orbit") {
        // Compute center of orbiting siblings
        let cx = 0, cy = 0;
        for (const s of orbitingSiblings) {
          cx += s.runtime.position.x;
          cy += s.runtime.position.y;
        }
        cx /= orbitingSiblings.length;
        cy /= orbitingSiblings.length;
        const d = distance(pos.x, pos.y, cx, cy);
        if (d < SYNC_ORBIT_RADIUS) {
          influence.syncOrbit = true;
          influence.syncOrbitCenter = { x: cx, y: cy };
        }
      }
    }

    // --- Group hyper bursts ---
    if (dynamics.groupHyperBursts) {
      // If any nearby entity just entered a hyper state, trigger group burst
      const hyperSiblings = nearby.filter(
        (s) => s.runtime.behaviorState === "dash_inspect" ||
               s.runtime.behaviorState === "chain_seek" ||
               s.runtime.behaviorState === "burst_orbit"
      );
      if (hyperSiblings.length > 0 && !this.groupHyperActive) {
        if (Math.random() < 0.15) {
          this.groupHyperActive = true;
          this.groupHyperTimer = 2 + Math.random() * 2;
        }
      }
      influence.groupHyperBurst = this.groupHyperActive;
    }

    // --- Territory respect ---
    if (dynamics.territoryRespect > 0 && entity.meta.preferredHomeId && habitat.enabled) {
      const home = habitat.homes.find((h) => h.id === entity.meta.preferredHomeId);
      if (home) {
        const d = distance(pos.x, pos.y, home.position.x, home.position.y);
        if (d > TERRITORY_PULL_RADIUS) {
          // Gentle pull toward home
          const strength = dynamics.territoryRespect * entity.meta.territoryBias * 0.1;
          const dx = home.position.x - pos.x;
          const dy = home.position.y - pos.y;
          influence.territoryPull = {
            x: (dx / d) * strength * d * 0.01,
            y: (dy / d) * strength * d * 0.01,
          };
        }
      }
    }

    return influence;
  }

  reset() {
    this.chaseState.clear();
    this.groupHyperTimer = 0;
    this.groupHyperActive = false;
  }
}

// --- Personality-based mood/behavior offset helpers ---

export function applyPersonalityToMood(
  mood: InternalMoodState,
  personality: PersonalityOffsets,
  dt: number
): InternalMoodState {
  const rate = dt * 0.05;
  return {
    curiosity: clamp(mood.curiosity + personality.curiosityBias * rate, 0, 1),
    comfort: clamp(mood.comfort - personality.shynessBias * rate * 0.5, 0, 1),
    stimulation: clamp(mood.stimulation + personality.energyBias * rate, 0, 1),
    fatigue: mood.fatigue,
    overwhelm: mood.overwhelm,
    trust: mood.trust,
    boredom: clamp(mood.boredom - personality.curiosityBias * rate * 0.3, 0, 1),
    confidence: clamp(mood.confidence - personality.shynessBias * rate * 0.3, 0, 1),
  };
}

export function applyFamilyToMood(
  mood: InternalMoodState,
  influence: FamilyInfluence,
  dt: number
): InternalMoodState {
  const rate = dt;
  return {
    ...mood,
    curiosity: clamp(mood.curiosity + influence.curiosityContagion * rate, 0, 1),
    comfort: clamp(mood.comfort + influence.comfortContagion * rate, 0, 1),
    stimulation: influence.groupHyperBurst
      ? clamp(mood.stimulation + 0.1 * rate, 0, 1)
      : mood.stimulation,
  };
}

export function getPersonalitySpeedMultiplier(personality: PersonalityOffsets): number {
  return 1.0 + personality.energyBias * 0.5;
}

export function getPersonalitySizeScale(personality: PersonalityOffsets): number {
  return 1.0 + personality.sizeOffset;
}

export function getPersonalityHueShift(personality: PersonalityOffsets): number {
  return personality.colorHueOffset;
}

// --- Helpers ---

function isPlayfulMood(mood: SurfaceMood): boolean {
  return mood === "playful" || mood === "excited" || mood === "curious";
}
