import type { AIRejectReason } from "@/store/types";

export type AIRequestBlockReason = Extract<AIRejectReason, "disabled" | "privacy-paused" | "analysis-paused">;

export const AI_REQUEST_BLOCK_MESSAGES: Record<AIRequestBlockReason, string> = {
  disabled: "AI is turned off",
  "privacy-paused": "Privacy pause is active",
  "analysis-paused": "Analysis is paused",
};

/** Shared by conversational chat and screen-context AI, using live runtime state. */
export function getAIRequestBlockReason(state: {
  enabled: boolean;
  isPrivacyPaused: boolean;
  isPaused: boolean;
}): AIRequestBlockReason | null {
  if (state.isPrivacyPaused) return "privacy-paused";
  if (state.isPaused) return "analysis-paused";
  if (!state.enabled) return "disabled";
  return null;
}
