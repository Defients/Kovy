import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AICoordinator } from "@/engine/aiCoordinator";
import type { AIConfig } from "@/store/types";

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
});
