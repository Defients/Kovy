// ============================================================
// Config Sync Bus — typed event channel for cross-window
// config propagation between settings window and overlay
// ============================================================

import type { KovyConfig } from "@/store/types";

// Event names used for Tauri cross-window communication
export const CONFIG_EVENTS = {
  /** Settings → Overlay: preview changes without persisting */
  PREVIEW: "kovy:config-preview",
  /** Settings → Overlay + Backend: apply and persist config */
  APPLY: "kovy:config-apply",
  /** Settings → Overlay: revert to last applied config */
  REVERT: "kovy:config-revert",
  /** Any → Any: request current applied config (overlay responds) */
  REQUEST_APPLIED: "kovy:config-request-applied",
  /** Overlay → Settings: respond with current applied config */
  RESPOND_APPLIED: "kovy:config-respond-applied",
} as const;

type ConfigEventPayload = {
  config: KovyConfig;
  timestamp: number;
};

let emitFn: ((event: string, payload: unknown) => Promise<void>) | null = null;
let listenFn: ((event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>) | null = null;

async function ensureTauriEvents() {
  if (emitFn && listenFn) return;
  try {
    const { emit } = await import("@tauri-apps/api/event");
    const { listen } = await import("@tauri-apps/api/event");
    emitFn = emit;
    listenFn = listen;
  } catch {
    // Not in Tauri — use BroadcastChannel fallback for multi-window
    console.log("ConfigSyncBus: Tauri events unavailable, using BroadcastChannel");
  }
}

// BroadcastChannel fallback for dev/browser environments
let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel {
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel("kovy-config-sync");
  }
  return broadcastChannel;
}

/**
 * Emit a config event to all windows
 */
export async function emitConfigEvent(
  event: string,
  config: KovyConfig
): Promise<void> {
  const payload: ConfigEventPayload = {
    config,
    timestamp: Date.now(),
  };

  await ensureTauriEvents();

  if (emitFn) {
    try {
      await emitFn(event, payload);
      return;
    } catch {
      // Fall through to BroadcastChannel
    }
  }

  // Fallback: BroadcastChannel
  try {
    getBroadcastChannel().postMessage({ event, payload });
  } catch {
    console.warn("ConfigSyncBus: Failed to emit event", event);
  }
}

/**
 * Listen for a config event from any window
 * Returns an unlisten function
 */
export async function onConfigEvent(
  event: string,
  handler: (config: KovyConfig) => void
): Promise<() => void> {
  await ensureTauriEvents();

  const unlisteners: Array<() => void> = [];

  if (listenFn) {
    try {
      const unlisten = await listenFn(event, (e) => {
        const payload = e.payload as ConfigEventPayload;
        if (payload && payload.config) {
          handler(payload.config);
        }
      });
      unlisteners.push(unlisten);
    } catch {
      // Fall through to BroadcastChannel
    }
  }

  // Also listen on BroadcastChannel as fallback/supplement
  try {
    const channel = getBroadcastChannel();
    const bcHandler = (e: MessageEvent) => {
      if (e.data && e.data.event === event) {
        const payload = e.data.payload as ConfigEventPayload;
        if (payload && payload.config) {
          handler(payload.config);
        }
      }
    };
    channel.addEventListener("message", bcHandler);
    unlisteners.push(() => channel.removeEventListener("message", bcHandler));
  } catch {
    // BroadcastChannel not available
  }

  return () => {
    unlisteners.forEach((u) => u());
  };
}

/**
 * Emit a preview config to the overlay (non-persisted)
 */
export async function emitPreview(config: KovyConfig): Promise<void> {
  await emitConfigEvent(CONFIG_EVENTS.PREVIEW, config);
}

/**
 * Emit an applied config to all windows (will be persisted)
 */
export async function emitApply(config: KovyConfig): Promise<void> {
  await emitConfigEvent(CONFIG_EVENTS.APPLY, config);
}

/**
 * Emit a revert signal — overlay should revert to last applied
 */
export async function emitRevert(config: KovyConfig): Promise<void> {
  await emitConfigEvent(CONFIG_EVENTS.REVERT, config);
}
