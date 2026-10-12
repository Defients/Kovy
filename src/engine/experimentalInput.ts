import { invoke } from "@tauri-apps/api/core";
import { nativePolicyRevision } from "@/lib/nativePolicy";
import type { Vec2 } from "@/store/types";

export interface InteractionTarget extends Vec2 { id: string }
export interface ExperimentalInputAdapter {
  lookup(target: InteractionTarget): Promise<InteractionTarget | null>;
  dispatch(target: InteractionTarget, action: "click" | "hover"): Promise<void>;
}

/** M1 only offers validated candidates; native production dispatch remains unavailable. */
export const nativeExperimentalInput: ExperimentalInputAdapter = {
  lookup: async (target) => target,
  async dispatch(target, action) {
    const revision = await nativePolicyRevision();
    await invoke("experimental_interact", { target, action, revision });
  },
};
