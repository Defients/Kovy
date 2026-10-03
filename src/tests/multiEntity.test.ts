import { describe, it, expect, beforeEach } from "vitest";
import { useEntityStore, FOUNDER_ID, MAX_ENTITIES } from "../store/entityStore";
import { useKovyStore } from "../store/kovyStore";

beforeEach(() => {
  useEntityStore.setState({ entities: {}, entityOrder: [] });
});

describe("Multi-entity integration — EntityStore + KovyStore proxy", () => {
  it("kovyStore.setPosition propagates to entityStore founder runtime", () => {
    useEntityStore.getState().initFounder();

    useKovyStore.getState().setPosition({ x: 42, y: 99 });

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder).toBeDefined();
    expect(founder!.runtime.position).toEqual({ x: 42, y: 99 });
  });

  it("kovyStore.setBehaviorState propagates to entityStore", () => {
    useEntityStore.getState().initFounder();

    useKovyStore.getState().setBehaviorState("perch");

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.behaviorState).toBe("perch");
  });

  it("kovyStore.setSurfaceMood propagates to entityStore", () => {
    useEntityStore.getState().initFounder();

    useKovyStore.getState().setSurfaceMood("playful");

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.surfaceMood).toBe("playful");
  });

  it("entityStore updateEntityRuntime reflects in kovyStore via subscription", () => {
    useEntityStore.getState().initFounder();

    useEntityStore.getState().updateEntityRuntime(FOUNDER_ID, {
      surfaceMood: "curious",
      behaviorState: "inspect",
    });

    const kovyState = useKovyStore.getState();
    expect(kovyState.surfaceMood).toBe("curious");
    expect(kovyState.behaviorState).toBe("inspect");
  });

  it("kovyStore.updateFrame patches multiple fields atomically", () => {
    useEntityStore.getState().initFounder();

    useKovyStore.getState().updateFrame({
      position: { x: 10, y: 20 },
      velocity: { x: 1, y: 2 },
      glowPulse: 0.5,
    });

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.position).toEqual({ x: 10, y: 20 });
    expect(founder!.runtime.velocity).toEqual({ x: 1, y: 2 });
    expect(founder!.runtime.glowPulse).toBe(0.5);
  });
});

describe("Multi-entity integration — Multiple entities", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("supports up to MAX_ENTITIES entities", () => {
    for (let i = 1; i < MAX_ENTITIES; i++) {
      const id = useEntityStore.getState().addEntity(`Sibling${i}`);
      expect(id).not.toBeNull();
    }

    expect(useEntityStore.getState().getEntityCount()).toBe(MAX_ENTITIES);

    const overflow = useEntityStore.getState().addEntity("Overflow");
    expect(overflow).toBeNull();
    expect(useEntityStore.getState().getEntityCount()).toBe(MAX_ENTITIES);
  });

  it("each entity has independent runtime state", () => {
    const state = useEntityStore.getState();
    const sibId = state.addEntity("Pip");
    expect(sibId).not.toBeNull();

    useEntityStore.getState().updateEntityRuntime(FOUNDER_ID, { surfaceMood: "calm" });
    useEntityStore.getState().updateEntityRuntime(sibId!, { surfaceMood: "excited" });

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    const sibling = useEntityStore.getState().getEntity(sibId!);

    expect(founder!.runtime.surfaceMood).toBe("calm");
    expect(sibling!.runtime.surfaceMood).toBe("excited");
  });

  it("updateEntityFrame patches runtime without replacing entire entity", () => {
    const state = useEntityStore.getState();
    const sibId = state.addEntity("Pip");

    useEntityStore.getState().updateEntityRuntime(sibId!, { surfaceMood: "curious", behaviorState: "wander" });
    useEntityStore.getState().updateEntityFrame(sibId!, { behaviorState: "perch" });

    const sibling = useEntityStore.getState().getEntity(sibId!);
    expect(sibling!.runtime.surfaceMood).toBe("curious");
    expect(sibling!.runtime.behaviorState).toBe("perch");
  });

  it("removeEntity removes the entity and updates count", () => {
    const state = useEntityStore.getState();
    const sibId = state.addEntity("Pip");
    expect(useEntityStore.getState().getEntityCount()).toBe(2);

    useEntityStore.getState().removeEntity(sibId!);
    expect(useEntityStore.getState().getEntityCount()).toBe(1);
    expect(useEntityStore.getState().hasEntity(sibId!)).toBe(false);
  });

  it("cannot remove the founder", () => {
    expect(useEntityStore.getState().getEntityCount()).toBe(1);

    useEntityStore.getState().removeEntity(FOUNDER_ID);
    expect(useEntityStore.getState().hasEntity(FOUNDER_ID)).toBe(true);
    expect(useEntityStore.getState().getEntityCount()).toBe(1);
  });

  it("resetEntity resets runtime to defaults", () => {
    useEntityStore.getState().updateEntityRuntime(FOUNDER_ID, {
      position: { x: 999, y: 999 },
      surfaceMood: "overwhelmed",
      behaviorState: "startle",
    });

    useEntityStore.getState().resetEntity(FOUNDER_ID);

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.position).toEqual({ x: 200, y: 200 });
    expect(founder!.runtime.surfaceMood).toBe("calm");
    expect(founder!.runtime.behaviorState).toBe("idle_float");
  });

  it("kovyStore.resetState delegates to entityStore.resetEntity", () => {
    useEntityStore.getState().initFounder();

    useKovyStore.getState().setPosition({ x: 500, y: 500 });
    useKovyStore.getState().setSurfaceMood("anxious");

    useKovyStore.getState().resetState();

    const founder = useEntityStore.getState().getEntity(FOUNDER_ID);
    expect(founder!.runtime.position).toEqual({ x: 200, y: 200 });
    expect(founder!.runtime.surfaceMood).toBe("calm");
  });
});

describe("Multi-entity integration — Entity ordering", () => {
  beforeEach(() => {
    useEntityStore.getState().initFounder();
  });

  it("entityOrder tracks creation order", () => {
    const id1 = useEntityStore.getState().addEntity("Pip");
    const id2 = useEntityStore.getState().addEntity("Sage");

    const order = useEntityStore.getState().entityOrder;
    expect(order).toContain(FOUNDER_ID);
    expect(order).toContain(id1);
    expect(order).toContain(id2);
    expect(order.indexOf(FOUNDER_ID)).toBeLessThan(order.indexOf(id1!));
    expect(order.indexOf(id1!)).toBeLessThan(order.indexOf(id2!));
  });

  it("removing an entity updates entityOrder", () => {
    const id1 = useEntityStore.getState().addEntity("Pip");

    useEntityStore.getState().removeEntity(id1!);

    const order = useEntityStore.getState().entityOrder;
    expect(order).not.toContain(id1);
    expect(order).toContain(FOUNDER_ID);
  });
});
