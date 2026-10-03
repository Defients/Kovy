import { describe, it, expect, beforeEach } from "vitest";
import { useEntityStore, FOUNDER_ID, MAX_ENTITIES } from "../store/entityStore";
import { DEFAULT_PERSONALITY } from "../store/defaults";

beforeEach(() => {
  // Reset entity store between tests
  useEntityStore.setState({ entities: {}, entityOrder: [] });
});

describe("EntityStore — Initialization", () => {
  it("starts with no entities", () => {
    const state = useEntityStore.getState();
    expect(state.getEntityCount()).toBe(0);
    expect(state.entityOrder).toEqual([]);
  });

  it("initFounder creates the founder entity", () => {
    const state = useEntityStore.getState();
    state.initFounder();

    expect(state.getEntityCount()).toBe(1);
    expect(state.hasEntity(FOUNDER_ID)).toBe(true);

    const founder = state.getFounder();
    expect(founder).toBeDefined();
    expect(founder!.meta.id).toBe(FOUNDER_ID);
    expect(founder!.meta.name).toBe("Kovy");
    expect(founder!.meta.isFounder).toBe(true);
  });

  it("initFounder is idempotent", () => {
    const state = useEntityStore.getState();
    state.initFounder();
    state.initFounder();
    state.initFounder();

    expect(state.getEntityCount()).toBe(1);
  });
});

describe("EntityStore — CRUD", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("addEntity creates a new sibling", () => {
    const state = useEntityStore.getState();
    const id = state.addEntity("Pip");

    expect(id).not.toBeNull();
    expect(state.getEntityCount()).toBe(2);

    const entity = state.getEntity(id!);
    expect(entity).toBeDefined();
    expect(entity!.meta.name).toBe("Pip");
    expect(entity!.meta.isFounder).toBe(false);
  });

  it("addEntity auto-picks a name if none given", () => {
    const state = useEntityStore.getState();
    const id = state.addEntity();
    expect(id).not.toBeNull();

    const entity = state.getEntity(id!);
    expect(entity!.meta.name.length).toBeGreaterThan(0);
  });

  it("addEntity respects MAX_ENTITIES limit", () => {
    const state = useEntityStore.getState();
    // Founder = 1, add MAX_ENTITIES-1 more
    for (let i = 0; i < MAX_ENTITIES - 1; i++) {
      const id = state.addEntity();
      expect(id).not.toBeNull();
    }
    expect(state.getEntityCount()).toBe(MAX_ENTITIES);

    // One more should fail
    const extra = state.addEntity();
    expect(extra).toBeNull();
    expect(state.getEntityCount()).toBe(MAX_ENTITIES);
  });

  it("addEntity accepts personality overrides", () => {
    const state = useEntityStore.getState();
    const id = state.addEntity("Custom", { energyBias: 0.25 });
    expect(id).not.toBeNull();

    const entity = state.getEntity(id!);
    expect(entity!.meta.personality.energyBias).toBe(0.25);
  });

  it("removeEntity removes a sibling", () => {
    const state = useEntityStore.getState();
    const id = state.addEntity("Pip")!;
    expect(state.getEntityCount()).toBe(2);

    const removed = state.removeEntity(id);
    expect(removed).toBe(true);
    expect(state.getEntityCount()).toBe(1);
    expect(state.hasEntity(id)).toBe(false);
  });

  it("removeEntity cannot remove founder", () => {
    const state = useEntityStore.getState();
    const removed = state.removeEntity(FOUNDER_ID);
    expect(removed).toBe(false);
    expect(state.getEntityCount()).toBe(1);
  });

  it("removeEntity returns false for non-existent id", () => {
    const state = useEntityStore.getState();
    const removed = state.removeEntity("does-not-exist");
    expect(removed).toBe(false);
  });
});

describe("EntityStore — Runtime Updates", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("updateEntityRuntime patches runtime state", () => {
    const state = useEntityStore.getState();
    state.updateEntityRuntime(FOUNDER_ID, { position: { x: 500, y: 300 } });

    const runtime = state.getEntityRuntime(FOUNDER_ID);
    expect(runtime!.position).toEqual({ x: 500, y: 300 });
  });

  it("setEntityPosition updates position", () => {
    const state = useEntityStore.getState();
    state.setEntityPosition(FOUNDER_ID, { x: 42, y: 84 });
    expect(state.getEntityRuntime(FOUNDER_ID)!.position).toEqual({ x: 42, y: 84 });
  });

  it("setEntityBehaviorState updates behaviorState", () => {
    const state = useEntityStore.getState();
    state.setEntityBehaviorState(FOUNDER_ID, "inspect");
    expect(state.getEntityRuntime(FOUNDER_ID)!.behaviorState).toBe("inspect");
  });

  it("updateEntityRuntime no-ops for non-existent entity", () => {
    const state = useEntityStore.getState();
    // Should not throw
    state.updateEntityRuntime("ghost", { position: { x: 0, y: 0 } });
    expect(state.hasEntity("ghost")).toBe(false);
  });
});

describe("EntityStore — Meta Updates", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("setEntityName updates name", () => {
    const state = useEntityStore.getState();
    state.setEntityName(FOUNDER_ID, "Mr. Kovy");
    expect(state.getEntityMeta(FOUNDER_ID)!.name).toBe("Mr. Kovy");
  });

  it("setEntityPersonality updates personality", () => {
    const state = useEntityStore.getState();
    const newP = { ...DEFAULT_PERSONALITY, curiosityBias: 0.2 };
    state.setEntityPersonality(FOUNDER_ID, newP);
    expect(state.getEntityMeta(FOUNDER_ID)!.personality.curiosityBias).toBe(0.2);
  });

  it("setEntityPreferredHome updates preferredHomeId", () => {
    const state = useEntityStore.getState();
    state.setEntityPreferredHome(FOUNDER_ID, "home-1");
    expect(state.getEntityMeta(FOUNDER_ID)!.preferredHomeId).toBe("home-1");
  });
});

describe("EntityStore — Queries", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("getAllEntities returns entities in order", () => {
    const state = useEntityStore.getState();
    state.addEntity("A");
    state.addEntity("B");

    const all = state.getAllEntities();
    expect(all.length).toBe(3);
    expect(all[0].meta.id).toBe(FOUNDER_ID);
  });

  it("getNonFounderEntities excludes founder", () => {
    const state = useEntityStore.getState();
    state.addEntity("A");
    state.addEntity("B");

    const siblings = state.getNonFounderEntities();
    expect(siblings.length).toBe(2);
    expect(siblings.every((s) => !s.meta.isFounder)).toBe(true);
  });

  it("getFounder returns the founder", () => {
    const state = useEntityStore.getState();
    const founder = state.getFounder();
    expect(founder).toBeDefined();
    expect(founder!.meta.isFounder).toBe(true);
  });
});

describe("EntityStore — Reset", () => {
  it("resetEntity resets runtime to defaults", () => {
    useEntityStore.getState().initFounder();
    const state = useEntityStore.getState();
    state.updateEntityRuntime(FOUNDER_ID, { position: { x: 999, y: 999 } });
    state.resetEntity(FOUNDER_ID);

    const runtime = state.getEntityRuntime(FOUNDER_ID);
    expect(runtime!.position).toEqual({ x: 200, y: 200 });
  });

  it("resetAll clears all entities and re-creates founder", () => {
    useEntityStore.getState().initFounder();
    const state = useEntityStore.getState();
    state.addEntity("A");
    state.addEntity("B");
    expect(state.getEntityCount()).toBe(3);

    state.resetAll();
    expect(state.getEntityCount()).toBe(1);
    expect(state.hasEntity(FOUNDER_ID)).toBe(true);
  });
});
