import { create } from "zustand";
import type {
  EntityId,
  KovyEntityInfo,
  KovyRuntimeState,
  PersonalityOffsets,
  EntityVisualConfig,
  DisplayMonitor,
  Vec2,
  BehaviorState,
  SurfaceMood,
  InternalMoodState,
  MotionTarget,
  MotionRegion,
  MonitorBounds,
} from "./types";
import { DEFAULT_RUNTIME_STATE, DEFAULT_PERSONALITY, DEFAULT_ENTITY_VISUAL } from "./defaults";

function hydrateVisual(raw: Partial<EntityVisualConfig> | undefined): EntityVisualConfig {
  return {
    customColorsEnabled: raw?.customColorsEnabled ?? DEFAULT_ENTITY_VISUAL.customColorsEnabled,
    primaryColor: raw?.primaryColor ?? DEFAULT_ENTITY_VISUAL.primaryColor,
    secondaryColor: raw?.secondaryColor ?? DEFAULT_ENTITY_VISUAL.secondaryColor,
    toneMode: raw?.toneMode ?? DEFAULT_ENTITY_VISUAL.toneMode,
    opacity: raw?.opacity ?? DEFAULT_ENTITY_VISUAL.opacity,
    rimLightIntensity: raw?.rimLightIntensity ?? DEFAULT_ENTITY_VISUAL.rimLightIntensity,
  };
}

function hydrateMeta(raw: any): KovyEntityInfo {
  return {
    id: raw.id,
    name: raw.name,
    isFounder: raw.isFounder ?? false,
    personality: raw.personality ?? { ...DEFAULT_PERSONALITY },
    preferredHomeId: raw.preferredHomeId ?? null,
    territoryBias: raw.territoryBias ?? 0.5,
    visual: hydrateVisual(raw.visual),
    displayMonitor: raw.displayMonitor ?? "global",
  };
}

// --- Constants ---

export const FOUNDER_ID: EntityId = "kovy-prime";
export const MAX_ENTITIES = 11;

const ENTITY_NAMES = ["Pip", "Mochi", "Luma", "Zeph", "Nimbus", "Echo", "Sage", "Pickle", "Bolt", "Wisp"];

// --- Entity State ---

export interface EntityState {
  meta: KovyEntityInfo;
  runtime: KovyRuntimeState;
}

// --- Store Interface ---

interface EntityStore {
  entities: Record<EntityId, EntityState>;
  entityOrder: EntityId[];

  // Initialization
  initFounder: () => void;

  // CRUD
  addEntity: (name?: string, personality?: Partial<PersonalityOffsets>) => EntityId | null;
  removeEntity: (id: EntityId) => boolean;

  // Per-entity runtime updates
  _updateFounderInternal: (patch: Partial<KovyRuntimeState>) => void;
  updateEntityRuntime: (id: EntityId, patch: Partial<KovyRuntimeState>) => void;
  batchUpdateRuntimes: (updates: Record<EntityId, Partial<KovyRuntimeState>>) => void;
  setEntityPosition: (id: EntityId, pos: Vec2) => void;
  setEntityBehaviorState: (id: EntityId, state: BehaviorState) => void;
  setEntityInternalMood: (id: EntityId, mood: InternalMoodState) => void;
  setEntitySurfaceMood: (id: EntityId, mood: SurfaceMood) => void;
  setEntityActiveTarget: (id: EntityId, target: MotionTarget | null) => void;
  setEntityCandidateTargets: (id: EntityId, targets: MotionTarget[]) => void;
  setEntityRawRegions: (id: EntityId, regions: MotionRegion[]) => void;
  setEntityStateTimer: (id: EntityId, t: number) => void;
  setEntityPerchPosition: (id: EntityId, pos: Vec2 | null) => void;
  setEntityVisible: (id: EntityId, v: boolean) => void;
  setEntityAsleep: (id: EntityId, a: boolean) => void;
  setEntityCurrentMonitorBounds: (id: EntityId, b: MonitorBounds | null) => void;

  // Per-entity meta updates
  updateEntityMeta: (id: EntityId, patch: Partial<KovyEntityInfo>) => void;
  setEntityName: (id: EntityId, name: string) => void;
  setEntityPersonality: (id: EntityId, personality: PersonalityOffsets) => void;
  setEntityPreferredHome: (id: EntityId, homeId: string | null) => void;
  setEntityVisual: (id: EntityId, visual: EntityVisualConfig) => void;
  setEntityDisplayMonitor: (id: EntityId, monitor: DisplayMonitor) => void;

  // Batch frame update for animation loop
  updateEntityFrame: (id: EntityId, patch: Partial<KovyRuntimeState>) => void;

  // Queries
  getEntity: (id: EntityId) => EntityState | undefined;
  getEntityRuntime: (id: EntityId) => KovyRuntimeState | undefined;
  getEntityMeta: (id: EntityId) => KovyEntityInfo | undefined;
  getAllEntities: () => EntityState[];
  getNonFounderEntities: () => EntityState[];
  getEntityCount: () => number;
  getFounder: () => EntityState | undefined;
  hasEntity: (id: EntityId) => boolean;

  // Reset
  resetEntity: (id: EntityId) => void;
  resetAll: () => void;
  syncFromLocalStorage: () => void;
}

// --- Helpers ---

export function notifyEntitySync() {
  new BroadcastChannel("kovy-entity-sync").postMessage("update");
}

function generateEntityId(): EntityId {
  return `kovy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function pickEntityName(existing: Record<EntityId, EntityState>): string {
  const usedNames = new Set(Object.values(existing).map((e) => e.meta.name));
  for (const name of ENTITY_NAMES) {
    if (!usedNames.has(name)) return name;
  }
  return `Kovy-${Object.keys(existing).length + 1}`;
}

function randomizePersonality(base: PersonalityOffsets, overrides?: Partial<PersonalityOffsets>): PersonalityOffsets {
  const jitter = (range: number) => (Math.random() - 0.5) * 2 * range;
  return {
    curiosityBias: overrides?.curiosityBias ?? jitter(0.2),
    energyBias: overrides?.energyBias ?? jitter(0.2),
    shynessBias: overrides?.shynessBias ?? jitter(0.15),
    playfulnessBias: overrides?.playfulnessBias ?? jitter(0.2),
    wanderBias: overrides?.wanderBias ?? jitter(0.15),
    colorHueOffset: overrides?.colorHueOffset ?? jitter(25),
    sizeOffset: overrides?.sizeOffset ?? jitter(0.1),
  };
}

function spawnPosition(
  existing: Record<EntityId, EntityState>,
  screenW: number,
  screenH: number
): Vec2 {
  const margin = 120;
  const count = Object.keys(existing).length;
  // Spread entities across the screen horizontally
  const slotWidth = (screenW - margin * 2) / Math.max(count + 1, 2);
  const x = margin + slotWidth * (count % 4) + Math.random() * 60 - 30;
  const y = screenH * 0.4 + Math.random() * (screenH * 0.3);
  return { x: Math.max(margin, Math.min(screenW - margin, x)), y: Math.max(margin, Math.min(screenH - margin, y)) };
}

function makeFounderMeta(): KovyEntityInfo {
  return {
    id: FOUNDER_ID,
    name: "Kovy",
    isFounder: true,
    personality: { ...DEFAULT_PERSONALITY },
    preferredHomeId: null,
    territoryBias: 0.3,
    visual: { ...DEFAULT_ENTITY_VISUAL },
    displayMonitor: "global",
  };
}

function makeFounderState(): EntityState {
  return {
    meta: makeFounderMeta(),
    runtime: structuredClone(DEFAULT_RUNTIME_STATE),
  };
}

// --- Store ---

function saveToLocalStorage(state: any) {
  if (typeof localStorage === "undefined") return;
  try {
    const persistedEntities: Record<EntityId, any> = {};
    for (const [id, entity] of Object.entries(state.entities)) {
      persistedEntities[id] = { meta: (entity as EntityState).meta };
    }
    localStorage.setItem("kovy-family", JSON.stringify({
      entities: persistedEntities,
      entityOrder: state.entityOrder,
    }));
  } catch (e) {
    console.error("Failed to save family", e);
  }
}

function loadFromLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  try {
    const data = localStorage.getItem("kovy-family");
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load family", e);
  }
  return null;
}

export const useEntityStore = create<EntityStore>((set, get) => ({
  entities: {},
  entityOrder: [],

  initFounder: () => {
    const state = get();
    if (state.entities[FOUNDER_ID]) return;
    
    const founder = makeFounderState();
    const newEntities: Record<EntityId, EntityState> = { [FOUNDER_ID]: founder };
    let newOrder: EntityId[] = [FOUNDER_ID];

    // Hydrate siblings from local storage
    const saved = loadFromLocalStorage();
    if (saved && saved.entities && saved.entityOrder) {
      newOrder = saved.entityOrder;
      if (!newOrder.includes(FOUNDER_ID)) newOrder.unshift(FOUNDER_ID);

      // Hydrate founder meta from storage if available (preserves visual customization)
      const savedFounder = saved.entities[FOUNDER_ID];
      if (savedFounder && savedFounder.meta) {
        const hydratedFounderMeta = hydrateMeta(savedFounder.meta);
        hydratedFounderMeta.isFounder = true;
        hydratedFounderMeta.id = FOUNDER_ID;
        if (!hydratedFounderMeta.name) hydratedFounderMeta.name = "Kovy";
        newEntities[FOUNDER_ID] = { ...newEntities[FOUNDER_ID], meta: hydratedFounderMeta };
      }

      for (const id of newOrder) {
        if (id === FOUNDER_ID) continue;
        const savedEntity = saved.entities[id];
        if (savedEntity && savedEntity.meta) {
          const runtime = structuredClone(DEFAULT_RUNTIME_STATE);
          runtime.position = spawnPosition(newEntities, 1920, 1080);
          newEntities[id] = {
            meta: hydrateMeta(savedEntity.meta),
            runtime,
          };
        }
      }
    }

    set({
      entities: newEntities,
      entityOrder: newOrder,
    });
  },

  syncFromLocalStorage: () => {
    const saved = loadFromLocalStorage();
    if (!saved || !saved.entities || !saved.entityOrder) return;

    set((state) => {
      const newEntities = { ...state.entities };
      let newOrder = [...saved.entityOrder];
      
      // Ensure founder is present
      if (!newOrder.includes(FOUNDER_ID)) newOrder.unshift(FOUNDER_ID);

      // Add or update entities from storage
      for (const id of newOrder) {
        const savedEntity = saved.entities[id];
        if (!savedEntity || !savedEntity.meta) continue;

        const hydratedMeta = hydrateMeta(savedEntity.meta);
        if (id === FOUNDER_ID) {
          hydratedMeta.isFounder = true;
          hydratedMeta.id = FOUNDER_ID;
        }

        if (newEntities[id]) {
          // Entity exists, just update meta (preserve runtime state)
          newEntities[id] = {
            ...newEntities[id],
            meta: hydratedMeta,
          };
        } else {
          // Entity is new to this window, create full state
          const runtime = structuredClone(DEFAULT_RUNTIME_STATE);
          // Default to random spawn position
          runtime.position = spawnPosition(newEntities, 1920, 1080);
          newEntities[id] = {
            meta: hydratedMeta,
            runtime,
          };
        }
      }

      // Remove any entities that are no longer in storage (except founder)
      for (const id of Object.keys(newEntities)) {
        if (id !== FOUNDER_ID && !newOrder.includes(id)) {
          delete newEntities[id];
        }
      }

      return {
        entities: newEntities,
        entityOrder: newOrder,
      };
    });
  },

  addEntity: (name, personalityOverrides) => {
    const state = get();
    if (Object.keys(state.entities).length >= MAX_ENTITIES) return null;

    const id = generateEntityId();
    const entityName = name ?? pickEntityName(state.entities);
    const personality = randomizePersonality(DEFAULT_PERSONALITY, personalityOverrides);

    // Get screen size from founder for spawn positioning
    const founder = state.entities[FOUNDER_ID];
    const screenW = founder?.runtime.screenWidth ?? 1920;
    const screenH = founder?.runtime.screenHeight ?? 1080;
    const pos = spawnPosition(state.entities, screenW, screenH);

    const runtime = structuredClone(DEFAULT_RUNTIME_STATE);
    runtime.position = pos;

    const entity: EntityState = {
      meta: {
        id,
        name: entityName,
        isFounder: false,
        personality,
        preferredHomeId: null,
        territoryBias: 0.5,
        visual: { ...DEFAULT_ENTITY_VISUAL },
        displayMonitor: "global",
      },
      runtime,
    };

    set({
      entities: { ...state.entities, [id]: entity },
      entityOrder: [...state.entityOrder, id],
    });

    saveToLocalStorage(get());
    return id;
  },

  removeEntity: (id) => {
    if (id === FOUNDER_ID) return false;
    const state = get();
    if (!state.entities[id]) return false;

    const { [id]: _removed, ...rest } = state.entities;
    set({
      entities: rest,
      entityOrder: state.entityOrder.filter((eid) => eid !== id),
    });
    
    saveToLocalStorage(get());
    return true;
  },

// --- Per-entity runtime setters ---

  _updateFounderInternal: (patch) => {
    set((state) => {
      const entity = state.entities[FOUNDER_ID];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [FOUNDER_ID]: { ...entity, runtime: { ...entity.runtime, ...patch } },
        },
      };
    });
  },

  updateEntityRuntime: (id, patch) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, runtime: { ...entity.runtime, ...patch } },
        },
      };
    });
  },

  batchUpdateRuntimes: (updates) => {
    set((state) => {
      let changed = false;
      const newEntities = { ...state.entities };
      
      for (const [id, patch] of Object.entries(updates)) {
        const entity = newEntities[id];
        if (entity) {
          changed = true;
          newEntities[id] = { ...entity, runtime: { ...entity.runtime, ...patch } };
        }
      }
      
      if (!changed) return state;
      return { entities: newEntities };
    });
  },

  setEntityPosition: (id, pos) => get().updateEntityRuntime(id, { position: pos }),
  setEntityBehaviorState: (id, s) => get().updateEntityRuntime(id, { behaviorState: s }),
  setEntityInternalMood: (id, mood) => get().updateEntityRuntime(id, { internalMood: mood }),
  setEntitySurfaceMood: (id, mood) => get().updateEntityRuntime(id, { surfaceMood: mood }),
  setEntityActiveTarget: (id, target) => get().updateEntityRuntime(id, { activeTarget: target }),
  setEntityCandidateTargets: (id, targets) => get().updateEntityRuntime(id, { candidateTargets: targets }),
  setEntityRawRegions: (id, regions) => get().updateEntityRuntime(id, { rawRegions: regions }),
  setEntityStateTimer: (id, t) => get().updateEntityRuntime(id, { stateTimer: t }),
  setEntityPerchPosition: (id, pos) => get().updateEntityRuntime(id, { perchPosition: pos }),
  setEntityVisible: (id, v) => get().updateEntityRuntime(id, { isVisible: v }),
  setEntityAsleep: (id, a) => get().updateEntityRuntime(id, { isAsleep: a }),
  setEntityCurrentMonitorBounds: (id, b) => get().updateEntityRuntime(id, { currentMonitorBounds: b }),

  // --- Per-entity meta setters ---

  updateEntityMeta: (id, patch) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, meta: { ...entity.meta, ...patch } },
        },
      };
    });
    saveToLocalStorage(get());
  },

  setEntityName: (id, name) => get().updateEntityMeta(id, { name }),
  setEntityPersonality: (id, personality) => get().updateEntityMeta(id, { personality }),
  setEntityPreferredHome: (id, homeId) => get().updateEntityMeta(id, { preferredHomeId: homeId }),
  setEntityVisual: (id, visual) => get().updateEntityMeta(id, { visual }),
  setEntityDisplayMonitor: (id, monitor) => get().updateEntityMeta(id, { displayMonitor: monitor }),

  // --- Batch frame update ---

  updateEntityFrame: (id, patch) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, runtime: { ...entity.runtime, ...patch } },
        },
      };
    });
  },

  // --- Queries ---

  getEntity: (id) => get().entities[id],
  getEntityRuntime: (id) => get().entities[id]?.runtime,
  getEntityMeta: (id) => get().entities[id]?.meta,

  getAllEntities: () => {
    const state = get();
    return state.entityOrder.map((id) => state.entities[id]).filter(Boolean);
  },

  getNonFounderEntities: () => {
    const state = get();
    return state.entityOrder
      .filter((id) => id !== FOUNDER_ID)
      .map((id) => state.entities[id])
      .filter(Boolean);
  },

  getEntityCount: () => Object.keys(get().entities).length,

  getFounder: () => get().entities[FOUNDER_ID],

  hasEntity: (id) => id in get().entities,

  // --- Reset ---

  resetEntity: (id) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, runtime: structuredClone(DEFAULT_RUNTIME_STATE) },
        },
      };
    });
  },

  resetAll: () => {
    set({
      entities: { [FOUNDER_ID]: makeFounderState() },
      entityOrder: [FOUNDER_ID],
    });
    saveToLocalStorage(get());
  },
}));
