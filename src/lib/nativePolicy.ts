import { invoke, isTauri } from "@tauri-apps/api/core";
import type { KovyConfig } from "@/store/types";

let policySync: Promise<unknown> = Promise.resolve();
let runtimeSync: Promise<unknown> = Promise.resolve();

/** Only the settings entry point calls this, with applied (never preview) config. */
export function applyNativePolicy(config: KovyConfig): Promise<unknown> {
  if (!isTauri()) return Promise.resolve();
  const policy = {
    aiEnabled: config.ai.enabled,
    chatEnabled: config.chat.enabled,
    screenshots: config.ai.sendScreenshot,
    foreground: config.ai.includeForegroundApp,
    monitors: [...config.ai.screenshotMonitorIndices],
    experimentalEnabled: config.experimental.enabled,
    experimentalOptIn: config.experimental.optInAcknowledged,
    targetMode: config.experimental.targetMode,
    actions: [...config.experimental.allowedInteractions],
    cooldownSecs: Math.max(1, Math.ceil(config.experimental.rateLimitSec)),
    targets: [
      ...(config.toys.enabled ? config.toys.placedToys.map(t => ({ id: `toy:${t.id}`, ...t.position })) : []),
      ...(config.habitatObjects.enabled ? config.habitatObjects.objects.map(t => ({ id: `habitat:${t.id}`, ...t.position })) : []),
    ],
  };
  policySync = policySync.catch(() => undefined).then(() => invoke("apply_native_policy", { policy }));
  return policySync;
}

/** Runtime revocation is sent synchronously from the overlay's store subscription. */
export function syncNativePause(paused: boolean): Promise<unknown> {
  if (!isTauri()) return Promise.resolve();
  runtimeSync = runtimeSync.catch(() => undefined).then(() => invoke(paused ? "pause_capture" : "resume_capture"));
  return runtimeSync;
}

export async function nativePolicyRevision(): Promise<number> {
  await policySync;
  await runtimeSync;
  return invoke<number>("native_policy_revision");
}

export async function cancelNativeAI(requestId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("cancel_ai_request", { requestId }).catch(() => {
    console.warn("Kovy: native cancellation unavailable");
  });
}

/** Signal owns both the wait for native policy and the eventual transport. */
export async function invokeOwnedAI<T>(command: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const requestId = params.requestId as string;
  if (signal?.aborted) throw new Error("cancelled");
  const revision = await nativePolicyRevision();
  if (signal?.aborted) throw new Error("cancelled");
  const cancel = () => { void cancelNativeAI(requestId); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const response = await invoke<T>(command, { ...params, revision });
    if (signal?.aborted) throw new Error("cancelled");
    return response;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
