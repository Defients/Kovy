import { getAIRequestBlockReason, type AIRequestBlockReason } from "@/engine/aiRequestPolicy";
import { useConfigStore } from "@/store/configStore";
import { useKovyStore } from "@/store/kovyStore";

export function getLiveAIRequestBlockReason(): AIRequestBlockReason | null {
  const state = useKovyStore.getState();
  return getAIRequestBlockReason({
    enabled: useConfigStore.getState().appliedConfig.ai.enabled,
    isPrivacyPaused: state.isPrivacyPaused,
    isPaused: state.isPaused,
  });
}

export function getLiveChatRequestBlockReason(): AIRequestBlockReason | null {
  return getLiveAIRequestBlockReason()
    ?? (useConfigStore.getState().appliedConfig.chat.enabled ? null : "disabled");
}

/** Cancel immediately on a policy transition, even if React has not rendered yet. */
export function subscribeAIRequestPolicy(
  onBlocked: (reason: AIRequestBlockReason) => void,
  getBlockReason: () => AIRequestBlockReason | null = getLiveAIRequestBlockReason,
): () => void {
  let previous = getBlockReason();
  const check = () => {
    const reason = getBlockReason();
    const changed = reason !== previous;
    previous = reason;
    if (reason && changed) onBlocked(reason);
  };
  const unsubscribeRuntime = useKovyStore.subscribe(check);
  const unsubscribeConfig = useConfigStore.subscribe(check);
  return () => {
    unsubscribeRuntime();
    unsubscribeConfig();
  };
}
