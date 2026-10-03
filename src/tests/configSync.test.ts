import { describe, it, expect, afterEach } from "vitest";
import {
  CONFIG_EVENTS,
  emitConfigEvent,
  emitPreview,
  emitApply,
  emitRevert,
} from "../lib/configSyncBus";
import { DEFAULT_CONFIG } from "../store/defaults";
import type { KovyConfig } from "../store/types";

// configSyncBus uses a singleton BroadcastChannel internally.
// BroadcastChannel does not deliver messages to the same instance that sent them.
// In production, each window has its own module instance so this works.
// In tests, we create a separate BroadcastChannel for listening.
const CHANNEL_NAME = "kovy-config-sync";

describe("Config Sync Bus — BroadcastChannel fallback", () => {
  let testChannel: BroadcastChannel | null = null;
  let handler: ((e: MessageEvent) => void) | null = null;

  afterEach(() => {
    if (testChannel && handler) {
      testChannel.removeEventListener("message", handler);
    }
    testChannel = null;
    handler = null;
  });

  function setupListener(eventType: string, onReceived: (cfg: KovyConfig) => void) {
    testChannel = new BroadcastChannel(CHANNEL_NAME);
    handler = (e: MessageEvent) => {
      if (e.data && e.data.event === eventType) {
        const payload = e.data.payload;
        if (payload && payload.config) {
          onReceived(payload.config);
        }
      }
    };
    testChannel.addEventListener("message", handler);
  }

  it("round-trips a config through emit → on", async () => {
    const received: KovyConfig[] = [];
    setupListener(CONFIG_EVENTS.APPLY, (cfg) => received.push(cfg));

    await emitConfigEvent(CONFIG_EVENTS.APPLY, DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].version).toBe(DEFAULT_CONFIG.version);
  });

  it("emitPreview sends PREVIEW event", async () => {
    const received: KovyConfig[] = [];
    setupListener(CONFIG_EVENTS.PREVIEW, (cfg) => received.push(cfg));

    await emitPreview(DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it("emitApply sends APPLY event", async () => {
    const received: KovyConfig[] = [];
    setupListener(CONFIG_EVENTS.APPLY, (cfg) => received.push(cfg));

    await emitApply(DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it("emitRevert sends REVERT event", async () => {
    const received: KovyConfig[] = [];
    setupListener(CONFIG_EVENTS.REVERT, (cfg) => received.push(cfg));

    await emitRevert(DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it("does not receive events for different event types", async () => {
    const received: KovyConfig[] = [];
    setupListener(CONFIG_EVENTS.PREVIEW, (cfg) => received.push(cfg));

    await emitApply(DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBe(0);
  });

  it("preserves config data integrity through round-trip", async () => {
    const modified = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as KovyConfig;
    modified.appearance.size = 2.5;
    modified.behavior.curiosityStrength = 0.8;
    modified.mood.intensity = 0.9;

    let received: KovyConfig | null = null;
    setupListener(CONFIG_EVENTS.APPLY, (cfg) => { received = cfg; });

    await emitApply(modified);
    await new Promise((r) => setTimeout(r, 50));

    expect(received).not.toBeNull();
    expect(received!.appearance.size).toBe(2.5);
    expect(received!.behavior.curiosityStrength).toBe(0.8);
    expect(received!.mood.intensity).toBe(0.9);
  });

  it("multiple separate listeners both receive events", async () => {
    const received1: KovyConfig[] = [];
    const received2: KovyConfig[] = [];

    const ch1 = new BroadcastChannel(CHANNEL_NAME);
    const ch2 = new BroadcastChannel(CHANNEL_NAME);

    const h1 = (e: MessageEvent) => {
      if (e.data?.event === CONFIG_EVENTS.APPLY) received1.push(e.data.payload.config);
    };
    const h2 = (e: MessageEvent) => {
      if (e.data?.event === CONFIG_EVENTS.APPLY) received2.push(e.data.payload.config);
    };

    ch1.addEventListener("message", h1);
    ch2.addEventListener("message", h2);

    await emitApply(DEFAULT_CONFIG);
    await new Promise((r) => setTimeout(r, 50));

    expect(received1.length).toBeGreaterThanOrEqual(1);
    expect(received2.length).toBeGreaterThanOrEqual(1);

    ch1.removeEventListener("message", h1);
    ch2.removeEventListener("message", h2);
  });
});

describe("Config Sync Bus — Event constants", () => {
  it("defines all required event types", () => {
    expect(CONFIG_EVENTS.PREVIEW).toBe("kovy:config-preview");
    expect(CONFIG_EVENTS.APPLY).toBe("kovy:config-apply");
    expect(CONFIG_EVENTS.REVERT).toBe("kovy:config-revert");
    expect(CONFIG_EVENTS.REQUEST_APPLIED).toBe("kovy:config-request-applied");
    expect(CONFIG_EVENTS.RESPOND_APPLIED).toBe("kovy:config-respond-applied");
  });
});
