import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AICoordinator } from "@/engine/aiCoordinator";
import { ChatEngine } from "@/engine/chatEngine";
import { getLiveAIRequestBlockReason, getLiveChatRequestBlockReason, subscribeAIRequestPolicy } from "@/lib/aiRuntimePolicy";
import { useConfigStore } from "@/store/configStore";
import { useKovyStore } from "@/store/kovyStore";
import { aiChat, aiHasApiKey, aiRequest, getForegroundApp } from "@/lib/tauriBridge";

vi.mock("@/lib/tauriBridge", () => ({
  aiChat: vi.fn(),
  aiHasApiKey: vi.fn().mockResolvedValue(true),
  aiRequest: vi.fn(),
  getForegroundApp: vi.fn(),
}));

const initialConfig = useConfigStore.getState();
const initialRuntime = useKovyStore.getState();
const cleanups: Array<() => void> = [];

const insight = {
  request_id: "test", source: "periodic", thought_text: "Thought", whisper_text: "Whisper",
  whisper_category: "encouragement", confidence: 0.9, created_at: 0,
};
const chatReply = { reply: "Reply", model: "test", created_at: 0 };
const ctx = {
  kovyName: "Kovy", mood: "calm" as const, bondLevel: null, behaviorState: "idle_float" as const,
  model: "test", timeoutSecs: 30,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(aiHasApiKey).mockResolvedValue(true);
  useConfigStore.setState({ appliedConfig: {
    ...initialConfig.appliedConfig,
    ai: { ...initialConfig.appliedConfig.ai, enabled: true, periodicEnabled: false, includeForegroundApp: false },
    chat: { ...initialConfig.appliedConfig.chat, enabled: true, persistHistory: false },
  } });
  useKovyStore.setState({ isPrivacyPaused: false, isPaused: false });
});

afterEach(() => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  useConfigStore.setState(initialConfig, true);
  useKovyStore.setState(initialRuntime, true);
});

async function engines() {
  const coordinator = new AICoordinator(getLiveAIRequestBlockReason);
  const chat = new ChatEngine(getLiveChatRequestBlockReason);
  await coordinator.updateConfig(useConfigStore.getState().appliedConfig.ai);
  chat.updateConfig(useConfigStore.getState().appliedConfig.chat);
  cleanups.push(() => { coordinator.destroy(); chat.destroy(); });
  cleanups.push(subscribeAIRequestPolicy(reason => {
    coordinator.cancelPending();
  }));
  cleanups.push(subscribeAIRequestPolicy(reason => chat.cancelPending(reason), getLiveChatRequestBlockReason));
  return { coordinator, chat };
}

describe("AI runtime policy integration", () => {
  it.each(["privacy-paused", "analysis-paused", "disabled"] as const)(
    "blocks both transports immediately for %s", async reason => {
      const { coordinator, chat } = await engines();
      if (reason === "privacy-paused") useKovyStore.setState({ isPrivacyPaused: true });
      else if (reason === "analysis-paused") useKovyStore.setState({ isPaused: true });
      else {
        const config = useConfigStore.getState().appliedConfig;
        useConfigStore.setState({ appliedConfig: { ...config, ai: { ...config.ai, enabled: false } } });
      }
      expect(await coordinator.startRequest("periodic")).toEqual({ accepted: false, reason, retryAfterMs: undefined });
      expect(await chat.sendMessage("Do not send", ctx)).toBeNull();
      expect(chat.getHistory()).toEqual([]);
      expect(aiRequest).not.toHaveBeenCalled();
      expect(aiChat).not.toHaveBeenCalled();
    },
  );

  it("cancels a foreground lookup across a rapid privacy pause and resume", async () => {
    const { coordinator } = await engines();
    await coordinator.updateConfig({ ...useConfigStore.getState().appliedConfig.ai, includeForegroundApp: true, sendScreenshot: true });
    const foreground = deferred<Awaited<ReturnType<typeof getForegroundApp>>>();
    vi.mocked(getForegroundApp).mockReturnValueOnce(foreground.promise);
    const onScreenshot = vi.fn();
    coordinator.setCallbacks({ onScreenshot });
    const pending = await coordinator.startRequest("periodic");
    expect(pending.accepted).toBe(true);
    useKovyStore.setState({ isPrivacyPaused: true });
    useKovyStore.setState({ isPrivacyPaused: false });
    foreground.resolve({ processName: "editor", windowTitle: "Private", windowBounds: null });
    if (pending.accepted) expect(await pending.completion).toBeUndefined();
    expect(aiRequest).not.toHaveBeenCalled();
    expect(onScreenshot).not.toHaveBeenCalled();
  });

  it("keeps resumed requests intact when pre-pause replies settle", async () => {
    const { coordinator, chat } = await engines();
    const oldInsight = deferred<typeof insight>();
    const newInsight = deferred<typeof insight>();
    const oldChat = deferred<typeof chatReply>();
    const newChat = deferred<typeof chatReply>();
    vi.mocked(aiRequest).mockReturnValueOnce(oldInsight.promise).mockReturnValueOnce(newInsight.promise);
    vi.mocked(aiChat).mockReturnValueOnce(oldChat.promise).mockReturnValueOnce(newChat.promise);
    const onInsight = vi.fn();
    coordinator.setCallbacks({ onInsight });
    const oldRequest = await coordinator.startRequest("periodic");
    const oldSend = chat.sendMessage("Old message", ctx);
    expect(oldRequest.accepted).toBe(true);
    useKovyStore.setState({ isPrivacyPaused: true });
    expect(coordinator.isBusy()).toBe(false);
    expect(chat.getState().isTyping).toBe(false);
    useKovyStore.setState({ isPrivacyPaused: false });
    const newRequest = await coordinator.startRequest("periodic");
    const newSend = chat.sendMessage("New message", ctx);
    expect(newRequest.accepted).toBe(true);
    oldInsight.resolve(insight);
    oldChat.resolve({ ...chatReply, reply: "Stale reply" });
    if (oldRequest.accepted) expect(await oldRequest.completion).toBeUndefined();
    expect(await oldSend).toBeNull();
    expect(coordinator.isBusy()).toBe(true);
    expect(chat.getState().isTyping).toBe(true);
    expect(onInsight).not.toHaveBeenCalled();
    newInsight.resolve(insight);
    newChat.resolve(chatReply);
    if (newRequest.accepted) await newRequest.completion;
    expect(await newSend).toBe("Reply");
    expect(onInsight).toHaveBeenCalledTimes(1);
    expect(chat.getHistory().map(turn => turn.content)).toEqual(["Old message", "New message", "Reply"]);
  });

  it("unsubscribes both stores when the owner is destroyed", () => {
    const onBlocked = vi.fn();
    const unsubscribe = subscribeAIRequestPolicy(onBlocked);
    unsubscribe();
    useKovyStore.setState({ isPrivacyPaused: true });
    const config = useConfigStore.getState().appliedConfig;
    useConfigStore.setState({ appliedConfig: { ...config, ai: { ...config.ai, enabled: false } } });
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("handles a callback that synchronously updates the runtime store", () => {
    const onBlocked = vi.fn(() => {
      if (!useKovyStore.getState().isPaused) useKovyStore.setState({ isPaused: true });
    });
    cleanups.push(subscribeAIRequestPolicy(onBlocked));
    useKovyStore.setState({ isPrivacyPaused: true });
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("invalidates chat immediately when its opt-in is revoked before a React effect", async () => {
    const { chat, coordinator } = await engines();
    const pendingReply = deferred<typeof chatReply>();
    vi.mocked(aiChat).mockReturnValueOnce(pendingReply.promise);
    const pending = chat.sendMessage("Private", ctx);
    const config = useConfigStore.getState().appliedConfig;
    useConfigStore.setState({ appliedConfig: { ...config, chat: { ...config.chat, enabled: false } } });
    expect(chat.getState().isTyping).toBe(false);
    expect(coordinator.canStartRequest("periodic").canStart).toBe(true);
    pendingReply.resolve(chatReply);
    expect(await pending).toBeNull();
    expect(chat.getState().lastResponse).toBeNull();
    expect(await chat.sendMessage("Do not send", ctx)).toBeNull();
    expect(aiChat).toHaveBeenCalledTimes(1);
  });
});
