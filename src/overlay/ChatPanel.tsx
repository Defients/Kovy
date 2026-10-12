// ============================================================
// Chat Panel — Conversational Kovy UI (v9.0)
//
// A floating panel that lets the user talk directly with Kovy.
// Triggered by the `kovy-open-chat` event or the Alt+Shift+C hotkey.
// Uses the ChatEngine to manage conversation and call the Rust
// OpenRouter transport.
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import { useKovyStore } from "@/store/kovyStore";
import { ChatEngine, type ChatTurn } from "@/engine/chatEngine";
import { AI_REQUEST_BLOCK_MESSAGES, getAIRequestBlockReason } from "@/engine/aiRequestPolicy";
import { getLiveChatRequestBlockReason, subscribeAIRequestPolicy } from "@/lib/aiRuntimePolicy";

interface ChatPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatPanel({ visible, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<ChatEngine | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const appliedConfig = useConfigStore((s) => s.appliedConfig);
  const isPrivacyPaused = useKovyStore((s) => s.isPrivacyPaused);
  const isPaused = useKovyStore((s) => s.isPaused);
  const store = useKovyStore;
  const blockReason = getAIRequestBlockReason({ enabled: appliedConfig.ai.enabled, isPrivacyPaused, isPaused });
  const blockedMessage = blockReason ? AI_REQUEST_BLOCK_MESSAGES[blockReason]
    : !appliedConfig.chat.enabled ? "Chat is not enabled" : null;

  // Initialize chat engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new ChatEngine(getLiveChatRequestBlockReason);
    }
    const engine = engineRef.current;
    const unsubscribePolicy = subscribeAIRequestPolicy((reason) => {
      engine.cancelPending(reason);
      setIsTyping(false);
      setError(engine.getState().error);
    }, getLiveChatRequestBlockReason);
    return () => {
      unsubscribePolicy();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update config when it changes
  useEffect(() => {
    if (engineRef.current && appliedConfig.chat) {
      engineRef.current.updateConfig(appliedConfig.chat);
      setHistory(engineRef.current.getHistory());
      setIsTyping(engineRef.current.getState().isTyping);
    }
  }, [appliedConfig.chat]);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isTyping]);

  // Focus input when panel becomes visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  const handleSend = useCallback(async () => {
    const engine = engineRef.current;
    if (!input.trim() || !engine || engine.getState().isTyping || blockedMessage) return;
    const text = input.trim();
    setInput("");
    setError(null);

    const state = store.getState();
    const aiConfig = useConfigStore.getState().appliedConfig.ai;

    setIsTyping(true);
    try {
      const pending = engine.sendMessage(text, {
        kovyName: "Kovy",
        mood: state.surfaceMood,
        bondLevel: null,
        behaviorState: state.behaviorState,
        model: aiConfig.model,
        timeoutSecs: aiConfig.requestTimeoutSec,
      });
      setHistory(engine.getHistory());
      await pending;
      if (engineRef.current !== engine) return;
      setError(engine.getState().error);
      setHistory(engine.getHistory());
    } catch (err) {
      if (engineRef.current === engine) setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      if (engineRef.current === engine) setIsTyping(engine.getState().isTyping);
    }
  }, [input, blockedMessage, store]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      onClose();
    }
  }, [handleSend, onClose]);

  if (!visible) return null;

  const position = appliedConfig.chat?.panelPosition ?? "bottom-right";
  const positionClass = position === "near-kovy"
    ? "top-20 right-4"
    : "bottom-4 right-4";

  return (
    <div
      className={cn(
        "fixed z-50 w-80 kovy-glass rounded-lg shadow-2xl flex flex-col",
        "max-h-[400px] min-h-[200px]",
        positionClass,
      )}
      role="dialog"
      aria-label="Chat with Kovy"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-kovy-border/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-kovy-accent">Kovy</span>
          {isTyping && (
            <span className="text-xs text-kovy-text-dim animate-pulse">typing...</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-kovy-text-dim hover:text-kovy-text transition-colors"
          aria-label="Close chat"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {history.length === 0 && !isTyping && (
          <div className="text-center text-kovy-text-dim text-sm py-4">
            Say hi to Kovy! 👋
          </div>
        )}
        {history.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              turn.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-3 py-1.5 rounded-lg text-sm",
                turn.role === "user"
                  ? "bg-kovy-accent/20 text-kovy-text"
                  : "bg-kovy-border/30 text-kovy-text",
              )}
            >
              {turn.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-kovy-border/30 px-3 py-1.5 rounded-lg text-sm text-kovy-text-dim">
              ...
            </div>
          </div>
        )}
        {(blockedMessage ?? error) && (
          <div className="text-center text-xs text-red-400 py-1">
            {blockedMessage ?? error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-kovy-border/30">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-sm text-kovy-text placeholder-kovy-text-dim outline-none"
          disabled={isTyping || blockedMessage !== null}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping || blockedMessage !== null}
          className="text-kovy-accent hover:text-kovy-accent/80 disabled:opacity-30 transition-colors"
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
