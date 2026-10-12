import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AICoordinator } from "@/engine/aiCoordinator";
import type { AIConfig } from "@/store/types";
import { aiRequest, aiHasApiKey, getForegroundApp } from "@/lib/tauriBridge";

const response = {
  request_id: "test",
  source: "periodic",
  thought_text: "Thought",
  whisper_text: "Whisper",
  whisper_category: "encouragement",
  confidence: 0.9,
  created_at: 0,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

vi.mock("@/lib/tauriBridge", () => ({
  aiRequest: vi.fn().mockRejectedValue(new Error("not in tauri")),
  aiHasApiKey: vi.fn().mockResolvedValue(true),
  getForegroundApp: vi.fn().mockResolvedValue({ processName: null, windowTitle: null, windowBounds: null }),
}));

const mockConfig: AIConfig = {
  enabled: true,
  provider: "openrouter",
  model: "openrouter/auto",
  periodicEnabled: false,
  periodicIntervalSec: 300,
  periodicInsightPriority: 0.8,
  sendScreenshot: false,
  screenshotMaxWidth: 1280,
  screenshotJpegQuality: 75,
  screenshotMonitorIndices: [],
  screenshotMonitorQualities: {},
  includeForegroundApp: true,
  instaSendCooldownSec: 2,
  requestTimeoutSec: 30,
  maxThoughtChars: 120,
  maxWhisperChars: 180,
};

describe("AICoordinator", () => {
  let coordinator: AICoordinator;

  beforeEach(() => {
    coordinator = new AICoordinator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    coordinator.destroy();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("canStartRequest", () => {
    it("rejects when disabled", async () => {
      await coordinator.updateConfig({ ...mockConfig, enabled: false });
      const result = coordinator.canStartRequest("ask-kovy");
      expect(result.canStart).toBe(false);
      expect(result.reason).toBe("disabled");
    });

    it("rejects when busy", async () => {
      await coordinator.updateConfig(mockConfig);
      // Start a request to make it busy
      const startResult = await coordinator.startRequest("ask-kovy");
      expect(startResult.accepted).toBe(true);
      if (startResult.accepted) {
        startResult.completion.catch(() => { /* expected to fail in test env */ });
      }
      // Now try another
      const result = coordinator.canStartRequest("ask-kovy");
      expect(result.canStart).toBe(false);
      expect(result.reason).toBe("busy");
    });

    it("rejects with cooldown for ask-kovy", async () => {
      await coordinator.updateConfig(mockConfig);
      const startResult = await coordinator.startRequest("ask-kovy");
      expect(startResult.accepted).toBe(true);
      if (startResult.accepted) {
        startResult.completion.catch(() => { /* expected to fail in test env */ });
      }
      // Wait for the first request to complete (it will fail since aiRequest is mocked)
      await vi.runAllTimersAsync();
      // Now cooldown should be active
      const result = coordinator.canStartRequest("ask-kovy");
      expect(result.canStart).toBe(false);
      expect(result.reason).toBe("cooldown");
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("accepts when enabled and not busy", async () => {
      await coordinator.updateConfig(mockConfig);
      const result = coordinator.canStartRequest("ask-kovy");
      expect(result.canStart).toBe(true);
    });
  });

  describe("startRequest", () => {
    it("returns accepted result with requestId", async () => {
      await coordinator.updateConfig(mockConfig);
      const result = await coordinator.startRequest("ask-kovy");
      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.requestId).toMatch(/^ai-\d+-/);
        expect(result.completion).toBeInstanceOf(Promise);
      }
    });

    it("returns rejected result when disabled", async () => {
      await coordinator.updateConfig({ ...mockConfig, enabled: false });
      const result = await coordinator.startRequest("ask-kovy");
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.reason).toBe("disabled");
      }
    });
  });

  describe("isBusy", () => {
    it("is false initially", () => {
      expect(coordinator.isBusy()).toBe(false);
    });

    it("is true after starting a request", async () => {
      await coordinator.updateConfig(mockConfig);
      const r = await coordinator.startRequest("ask-kovy");
      if (r.accepted) r.completion.catch(() => {});
      expect(coordinator.isBusy()).toBe(true);
    });
  });

  describe("cancelPending", () => {
    it("clears pending state", async () => {
      await coordinator.updateConfig(mockConfig);
      const r = await coordinator.startRequest("ask-kovy");
      if (r.accepted) r.completion.catch(() => {});
      expect(coordinator.isBusy()).toBe(true);
      coordinator.cancelPending();
      expect(coordinator.isBusy()).toBe(false);
    });
  });

  describe("getCooldownRemainingMs", () => {
    it("returns 0 when no request has been made", async () => {
      await coordinator.updateConfig(mockConfig);
      expect(coordinator.getCooldownRemainingMs()).toBe(0);
    });
  });

  describe("callbacks", () => {
    it("fires onThinking when request starts", async () => {
      const onThinking = vi.fn();
      coordinator.setCallbacks({ onThinking });
      await coordinator.updateConfig(mockConfig);
      const r = await coordinator.startRequest("ask-kovy");
      if (r.accepted) r.completion.catch(() => {});
      expect(onThinking).toHaveBeenCalledWith(true);
    });

    it("fires onInsight when request completes", async () => {
      const { aiRequest } = await import("@/lib/tauriBridge");
      (aiRequest as any).mockResolvedValueOnce({
        request_id: "test-1",
        source: "ask-kovy",
        thought_text: "Oh! Code!",
        whisper_text: "You're doing great!",
        whisper_category: "encouragement",
        confidence: 0.9,
        created_at: 12345,
      });

      const onInsight = vi.fn();
      coordinator.setCallbacks({ onInsight });
      await coordinator.updateConfig(mockConfig);
      const result = await coordinator.startRequest("ask-kovy");
      expect(result.accepted).toBe(true);
      if (result.accepted) {
        await result.completion;
        expect(onInsight).toHaveBeenCalledWith(expect.objectContaining({
          thoughtText: "Oh! Code!",
          whisperText: "You're doing great!",
        }));
      }
    });
  });

  describe("periodic timer", () => {
    it("does not start when periodicEnabled is false", async () => {
      await coordinator.updateConfig({ ...mockConfig, periodicEnabled: false });
      expect(coordinator.isBusy()).toBe(false);
    });

    it("starts when periodicEnabled is true", async () => {
      const onError = vi.fn();
      coordinator.setCallbacks({ onError });
      await coordinator.updateConfig({ ...mockConfig, periodicEnabled: true, periodicIntervalSec: 60 });
      expect(coordinator.isBusy()).toBe(false);
      // Advance timer to trigger periodic request
      await vi.advanceTimersByTimeAsync(61000);
      // Allow microtasks to settle
      await Promise.resolve();
      await Promise.resolve();
      // The periodic request will fail since aiRequest is mocked to reject
      expect(onError).toHaveBeenCalled();
    });
  });

  describe("request lifecycle regressions", () => {
    it("keeps a replacement request busy when a cancelled request settles", async () => {
      const firstResponse = deferred<typeof response>();
      const secondResponse = deferred<typeof response>();
      vi.mocked(aiRequest).mockReturnValueOnce(firstResponse.promise).mockReturnValueOnce(secondResponse.promise);
      const onThinking = vi.fn();
      const onError = vi.fn();
      coordinator.setCallbacks({ onThinking, onError });
      await coordinator.updateConfig({ ...mockConfig, includeForegroundApp: false });
      const first = await coordinator.startRequest("periodic");
      coordinator.cancelPending();
      const second = await coordinator.startRequest("periodic");
      onThinking.mockClear();
      firstResponse.resolve(response);
      if (first.accepted) await first.completion;
      expect(coordinator.isBusy()).toBe(true);
      expect(onThinking).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      secondResponse.resolve(response);
      if (second.accepted) await second.completion;
      expect(coordinator.isBusy()).toBe(false);
    });

    it("does not publish replies after AI is disabled", async () => {
      const pendingResponse = deferred<typeof response>();
      vi.mocked(aiRequest).mockReturnValueOnce(pendingResponse.promise);
      const onInsight = vi.fn();
      coordinator.setCallbacks({ onInsight });
      await coordinator.updateConfig({ ...mockConfig, includeForegroundApp: false });
      const pending = await coordinator.startRequest("periodic");
      await coordinator.updateConfig({ ...mockConfig, enabled: false });
      pendingResponse.resolve(response);
      if (pending.accepted) await pending.completion;
      expect(onInsight).not.toHaveBeenCalled();
      expect(coordinator.isBusy()).toBe(false);
    });

    it("does not let an old credential lookup re-enable a disabled coordinator", async () => {
      const key = deferred<boolean>();
      vi.mocked(aiHasApiKey).mockReturnValueOnce(key.promise);
      const oldUpdate = coordinator.updateConfig(mockConfig);
      await coordinator.updateConfig({ ...mockConfig, enabled: false });
      key.resolve(true);
      await oldUpdate;
      // Enabling again must await a fresh key check, not trust the stale result.
      const freshKey = deferred<boolean>();
      vi.mocked(aiHasApiKey).mockReturnValueOnce(freshKey.promise);
      const freshUpdate = coordinator.updateConfig(mockConfig);
      expect(coordinator.canStartRequest("periodic")).toEqual({ canStart: false, reason: "missing-key" });
      freshKey.resolve(false);
      await freshUpdate;
    });

    it("applies a changed periodic interval immediately", async () => {
      await coordinator.updateConfig({ ...mockConfig, periodicEnabled: true, periodicIntervalSec: 300 });
      await coordinator.updateConfig({ ...mockConfig, periodicEnabled: true, periodicIntervalSec: 60 });
      vi.mocked(aiRequest).mockClear();
      await vi.advanceTimersByTimeAsync(60000);
      expect(aiRequest).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a cancelled request after foreground lookup", async () => {
      const foreground = deferred<Awaited<ReturnType<typeof getForegroundApp>>>();
      vi.mocked(getForegroundApp).mockReturnValueOnce(foreground.promise);
      const onScreenshot = vi.fn();
      coordinator.setCallbacks({ onScreenshot });
      await coordinator.updateConfig({ ...mockConfig, sendScreenshot: true });
      const pending = await coordinator.startRequest("periodic");
      coordinator.cancelPending();
      foreground.resolve({ processName: null, windowTitle: null, windowBounds: null });
      if (pending.accepted) await pending.completion;
      expect(aiRequest).not.toHaveBeenCalled();
      expect(onScreenshot).not.toHaveBeenCalled();
    });

    it("does not restart a periodic timer after destruction during credential lookup", async () => {
      const key = deferred<boolean>();
      vi.mocked(aiHasApiKey).mockReturnValueOnce(key.promise);
      const update = coordinator.updateConfig({ ...mockConfig, periodicEnabled: true });
      coordinator.destroy();
      key.resolve(true);
      await update;
      expect(vi.getTimerCount()).toBe(0);
      expect(coordinator.canStartRequest("periodic").reason).toBe("disabled");
    });

    it("fails closed when the credential lookup rejects", async () => {
      vi.mocked(aiHasApiKey).mockRejectedValueOnce(new Error("Vault unavailable"));
      await expect(coordinator.updateConfig(mockConfig)).resolves.toBeUndefined();
      expect(coordinator.canStartRequest("periodic").reason).toBe("missing-key");
    });
  });
});
