// ============================================================
// Kovy Entity Relations Engine — manages relationships between
// multiple family entities (friend, rival, mentor, playmate).
// Relationships evolve over time based on interactions.
// ============================================================

import type { EntityRelationsConfig, EntityId, EntityRelationType } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface EntityRelation {
  entityA: EntityId;
  entityB: EntityId;
  type: EntityRelationType;
  strength: number; // 0-1
}

export interface EntityRelationsOutput {
  enabled: boolean;
  relations: EntityRelation[];
}

export const NULL_RELATIONS_OUTPUT: EntityRelationsOutput = {
  enabled: false,
  relations: [],
};

const STORAGE_KEY = "kovy-entity-relations";

export class EntityRelationsEngine {
  private relations: EntityRelation[];

  constructor() {
    this.relations = this.load();
  }

  private load(): EntityRelation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.relations));
    } catch { /* ignore */ }
  }

  update(dt: number, config: EntityRelationsConfig, entityIds: EntityId[]): EntityRelationsOutput {
    if (!config.enabled) return NULL_RELATIONS_OUTPUT;

    // Ensure all pairs have relations
    if (config.autoEvolve) {
      for (let i = 0; i < entityIds.length; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          const a = entityIds[i];
          const b = entityIds[j];
          const existing = this.relations.find(
            r => (r.entityA === a && r.entityB === b) || (r.entityA === b && r.entityB === a)
          );
          if (!existing) {
            this.relations.push({
              entityA: a,
              entityB: b,
              type: "friend",
              strength: 0.3,
            });
          } else {
            // Slowly evolve: friends get closer, rivals drift apart slightly
            if (existing.type === "friend") {
              existing.strength = clamp(existing.strength + dt * 0.001, 0, 1);
            } else if (existing.type === "rival") {
              existing.strength = clamp(existing.strength - dt * 0.0005, 0, 1);
            }
          }
        }
      }
      this.save();
    }

    // Clean up relations for entities that no longer exist
    this.relations = this.relations.filter(
      r => entityIds.includes(r.entityA) && entityIds.includes(r.entityB)
    );

    return { enabled: true, relations: [...this.relations] };
  }

  setRelation(a: EntityId, b: EntityId, type: EntityRelationType, strength: number): void {
    const existing = this.relations.find(
      r => (r.entityA === a && r.entityB === b) || (r.entityA === b && r.entityB === a)
    );
    if (existing) {
      existing.type = type;
      existing.strength = clamp(strength, 0, 1);
    } else {
      this.relations.push({ entityA: a, entityB: b, type, strength: clamp(strength, 0, 1) });
    }
    this.save();
  }

  getRelation(a: EntityId, b: EntityId): EntityRelation | null {
    return this.relations.find(
      r => (r.entityA === a && r.entityB === b) || (r.entityA === b && r.entityB === a)
    ) ?? null;
  }
}
