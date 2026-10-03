// ============================================================
// Chat Engine tests — v9.0
// Verifies conversation management, history ring buffer,
// persistence, and error handling.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ChatEngine, clearChatHistory, type ChatTurn } from "@/engine/chatEngine";
import type { ChatConfig, SurfaceMood, BondLevel, BehaviorState } from "@/store/types";

// Mock the Tauri bridge
vi.mock("@/lib/tauriBridge", () => ({
  aiChat: vi.fn(),
}));

import { aiChat } from "@/lib/tauriBridge";

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

const baseConfig: ChatConfig = {
  enabled: true,
  persistHistory: false,
  maxTurns: 12,
  sendScreenshot: false,
  panelPosition: "near-kovy",
};

const baseCtx = {
  kovyName: "Kovy",
  mood: "calm" as SurfaceMood,
  bondLevel: "friend" as BondLevel,
  behaviorState: "idle_float" as BehaviorState,
  model: "test-model",
  timeoutSecs: 30,
};

describe("ChatEngine — v9.0", () => {
  let engine: ChatEngine;

  beforeEach(() => {
    engine = new ChatEngine();
    engine.updateConfig({ ...baseConfig });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("basic functionality", () => {
    it("isEnabled returns config state", () => {
      expect(engine.isEnabled()).toBe(true);
      engine.updateConfig({ ...baseConfig, enabled: false });
      expect(engine.isEnabled()).toBe(false);
    });

    it("starts with empty history", () => {
      expect(engine.getHistory()).toEqual([]);
    });

    it("starts with no error", () => {
      const state = engine.getState();
      expect(state.error).toBeNull();
      expect(state.isTyping).toBe(false);
    });
  });

  describe("sendMessage", () => {
    it("sends a message and receives a reply", async () => {
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Hi there!",
        model: "test-model",
        created_at: Date.now(),
      });

      const reply = await engine.sendMessage("Hello!", baseCtx);
      expect(reply).toBe("Hi there!");
      const history = engine.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe("user");
      expect(history[0].content).toBe("Hello!");
      expect(history[1].role).toBe("assistant");
      expect(history[1].content).toBe("Hi there!");
    });

    it("returns null when disabled", async () => {
      engine.updateConfig({ ...baseConfig, enabled: false });
      const reply = await engine.sendMessage("Hello!", baseCtx);
      expect(reply).toBeNull();
      expect(engine.getState().error).not.toBeNull();
    });

    it("returns null for empty message", async () => {
      const reply = await engine.sendMessage("", baseCtx);
      expect(reply).toBeNull();
    });

    it("returns null for whitespace-only message", async () => {
      const reply = await engine.sendMessage("   ", baseCtx);
      expect(reply).toBeNull();
    });

    it("sets isTyping during request", async () => {
      let resolveFn: (v: any) => void;
      vi.mocked(aiChat).mockReturnValue(new Promise((resolve) => { resolveFn = resolve; }));

      const promise = engine.sendMessage("Hello!", baseCtx);
      expect(engine.getState().isTyping).toBe(true);

      resolveFn!({ reply: "Hi!", model: "test", created_at: 0 });
      await promise;
      expect(engine.getState().isTyping).toBe(false);
    });

    it("handles API errors gracefully", async () => {
      vi.mocked(aiChat).mockRejectedValue(new Error("Network error"));
      const reply = await engine.sendMessage("Hello!", baseCtx);
      expect(reply).toBeNull();
      expect(engine.getState().error).toBe("Network error");
      expect(engine.getState().isTyping).toBe(false);
    });

    it("adds user message to history even on error", async () => {
      vi.mocked(aiChat).mockRejectedValue(new Error("Failed"));
      await engine.sendMessage("Hello!", baseCtx);
      const history = engine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe("user");
    });
  });

  describe("history ring buffer", () => {
    it("trims history to maxTurns", async () => {
      engine.updateConfig({ ...baseConfig, maxTurns: 4 });
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Reply",
        model: "test",
        created_at: 0,
      });

      // Send 3 messages (each adds 2 turns: user + assistant)
      await engine.sendMessage("Msg 1", baseCtx);
      await engine.sendMessage("Msg 2", baseCtx);
      await engine.sendMessage("Msg 3", baseCtx);

      // Should have 6 turns total, but trimmed to 4
      expect(engine.getHistory().length).toBeLessThanOrEqual(4);
    });

    it("keeps most recent turns when trimming", async () => {
      engine.updateConfig({ ...baseConfig, maxTurns: 2 });
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Reply",
        model: "test",
        created_at: 0,
      });

      await engine.sendMessage("First", baseCtx);
      await engine.sendMessage("Second", baseCtx);

      const history = engine.getHistory();
      expect(history.length).toBeLessThanOrEqual(2);
      // Should keep the most recent turns
      if (history.length === 2) {
        expect(history[0].content).toBe("Second");
      }
    });
  });

  describe("persistence", () => {
    it("persists history when persistHistory is true", async () => {
      engine.updateConfig({ ...baseConfig, persistHistory: true });
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Hi!",
        model: "test",
        created_at: 0,
      });

      await engine.sendMessage("Hello!", baseCtx);

      const stored = localStorageMock.getItem("kovy-chat-history");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(2);
    });

    it("does not persist when persistHistory is false", async () => {
      engine.updateConfig({ ...baseConfig, persistHistory: false });
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Hi!",
        model: "test",
        created_at: 0,
      });

      await engine.sendMessage("Hello!", baseCtx);

      const stored = localStorageMock.getItem("kovy-chat-history");
      expect(stored).toBeNull();
    });

    it("loads persisted history on config update", () => {
      const turns: ChatTurn[] = [
        { role: "user", content: "Old message", timestamp: 1000 },
        { role: "assistant", content: "Old reply", timestamp: 1001 },
      ];
      localStorageMock.setItem("kovy-chat-history", JSON.stringify(turns));

      const newEngine = new ChatEngine();
      newEngine.updateConfig({ ...baseConfig, persistHistory: true });
      expect(newEngine.getHistory()).toHaveLength(2);
    });

    it("clearHistory removes persisted history", async () => {
      engine.updateConfig({ ...baseConfig, persistHistory: true });
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Hi!",
        model: "test",
        created_at: 0,
      });

      await engine.sendMessage("Hello!", baseCtx);
      expect(localStorageMock.getItem("kovy-chat-history")).not.toBeNull();

      engine.clearHistory();
      expect(engine.getHistory()).toHaveLength(0);
      expect(localStorageMock.getItem("kovy-chat-history")).toBeNull();
    });
  });

  describe("clearChatHistory (module function)", () => {
    it("clears localStorage", () => {
      localStorageMock.setItem("kovy-chat-history", "[]");
      clearChatHistory();
      expect(localStorageMock.getItem("kovy-chat-history")).toBeNull();
    });
  });

  describe("destroy", () => {
    it("clears all state", async () => {
      vi.mocked(aiChat).mockResolvedValue({
        reply: "Hi!",
        model: "test",
        created_at: 0,
      });
      await engine.sendMessage("Hello!", baseCtx);
      engine.destroy();
      expect(engine.getHistory()).toHaveLength(0);
      expect(engine.isEnabled()).toBe(false);
    });
  });
});
