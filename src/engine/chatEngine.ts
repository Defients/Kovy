// ============================================================
// Chat Engine — Conversational Kovy (v9.0)
//
// Manages an opt-in chat panel that lets the user talk directly with
// Kovy via the existing Rust OpenRouter transport. The engine:
// - Maintains a ring buffer of conversation turns (configurable max)
// - Builds a system prompt with Kovy's personality, mood, and context
// - Calls the Rust ai_chat command via the Tauri bridge
// - Optionally persists history to localStorage
// - Surfaces a "typing" state for UI feedback
// ============================================================

import type { ChatConfig, SurfaceMood, BondLevel, BehaviorState } from "@/store/types";
import { aiChat, type ChatMessage, type ChatResponse } from "@/lib/tauriBridge";
import { AI_REQUEST_BLOCK_MESSAGES, type AIRequestBlockReason } from "./aiRequestPolicy";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatState {
  history: ChatTurn[];
  isTyping: boolean;
  error: string | null;
  lastResponse: ChatResponse | null;
}

const CHAT_STORAGE_KEY = "kovy-chat-history";

/// Build the system prompt that gives Kovy her personality.
function buildSystemPrompt(
  kovyName: string,
  mood: SurfaceMood,
  bondLevel: BondLevel | null,
  behaviorState: BehaviorState,
): string {
  const bondDesc = bondLevel ? `Your bond with the user is: ${bondLevel}.` : "";
  return `You are ${kovyName}, a cute desktop companion who lives on the user's screen. You are small, curious, and caring. You speak in a warm, friendly, and slightly playful tone — never robotic or formal. Keep responses short (1-3 sentences) unless the user asks for more detail.

Current state:
- Mood: ${mood}
- Behavior: ${behaviorState}
${bondDesc}

You receive the user's chat messages and the companion state above. Do not claim to see their screen or remember events beyond the conversation provided. You care about the user and want to be a good companion. Be genuine and authentic — don't be overly saccharine or fake.`;
}

/// Load persisted chat history from localStorage
function loadPersistedHistory(): ChatTurn[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((turn): turn is ChatTurn =>
      typeof turn === "object" && turn !== null &&
      (turn.role === "user" || turn.role === "assistant") &&
      typeof turn.content === "string" &&
      typeof turn.timestamp === "number" && Number.isFinite(turn.timestamp),
    ).map(({ role, content, timestamp }) => ({ role, content, timestamp }));
  } catch {
    return [];
  }
}

/// Persist chat history to localStorage
function persistHistory(history: ChatTurn[]): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

/// Clear persisted chat history
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export interface ChatSendContext {
  kovyName: string;
  mood: SurfaceMood;
  bondLevel: BondLevel | null;
  behaviorState: BehaviorState;
  model: string;
  timeoutSecs: number;
}

export class ChatEngine {
  private config: ChatConfig | null = null;
  private history: ChatTurn[] = [];
  private isTyping = false;
  private error: string | null = null;
  private lastResponse: ChatResponse | null = null;
  private pendingRequest: symbol | null = null;
  private historyLoaded = false;
  private abortController: AbortController | null = null;

  constructor(private readonly getBlockReason: () => AIRequestBlockReason | null = () => null) {}

  updateConfig(config: ChatConfig): void {
    this.config = config;
    if (!config.enabled) this.cancelPending();
    // Load persisted history if enabled
    if (config.persistHistory && !this.historyLoaded) {
      this.historyLoaded = true;
      if (this.history.length === 0) this.history = loadPersistedHistory();
    }
    // Trim to max turns
    this.trimHistory();
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  getState(): ChatState {
    return {
      history: [...this.history],
      isTyping: this.isTyping,
      error: this.error,
      lastResponse: this.lastResponse,
    };
  }

  getHistory(): ChatTurn[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.cancelPending();
    this.history = [];
    this.error = null;
    this.lastResponse = null;
    this.historyLoaded = true;
    clearChatHistory();
  }

  /** Invalidates local results and asks native transport to stop. Sent data cannot be recalled. */
  cancelPending(reason?: AIRequestBlockReason): void {
    this.abortController?.abort();
    this.abortController = null;
    this.pendingRequest = null;
    this.isTyping = false;
    if (reason) this.error = AI_REQUEST_BLOCK_MESSAGES[reason];
  }

  private trimHistory(): void {
    if (!this.config) return;
    const maxTurns = this.config.maxTurns;
    if (this.history.length > maxTurns) {
      this.history = this.history.slice(-maxTurns);
    }
  }

  private persistIfNeeded(): void {
    if (this.config?.persistHistory) {
      persistHistory(this.history);
    }
  }

  /// Send a user message and get Kovy's reply.
  async sendMessage(text: string, ctx: ChatSendContext): Promise<string | null> {
    if (!this.config?.enabled) {
      this.error = "Chat is not enabled";
      return null;
    }

    const blockReason = this.getBlockReason();
    if (blockReason) {
      this.error = AI_REQUEST_BLOCK_MESSAGES[blockReason];
      return null;
    }
    if (this.pendingRequest !== null) return null;

    if (!text.trim()) {
      return null;
    }

    // Add user message to history
    const userTurn: ChatTurn = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    this.history.push(userTurn);
    this.trimHistory();

    // Build messages for the API
    const systemPrompt = buildSystemPrompt(
      ctx.kovyName,
      ctx.mood,
      ctx.bondLevel,
      ctx.behaviorState,
    );

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...this.history.map((t) => ({ role: t.role, content: t.content })),
    ];

    this.isTyping = true;
    this.error = null;
    const request = Symbol("chat-request");
    this.pendingRequest = request;
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const response = await aiChat({
        requestId: `chat-${crypto.randomUUID()}`,
        model: ctx.model,
        messages,
        timeoutSecs: ctx.timeoutSecs,
      }, controller.signal);

      if (this.pendingRequest !== request) return null;
      const blocked = this.getBlockReason();
      if (blocked) {
        this.error = AI_REQUEST_BLOCK_MESSAGES[blocked];
        return null;
      }

      this.lastResponse = response;

      // Add assistant reply to history
      const assistantTurn: ChatTurn = {
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
      };
      this.history.push(assistantTurn);
      this.trimHistory();
      this.persistIfNeeded();

      return response.reply;
    } catch (err) {
      if (this.pendingRequest !== request) return null;
      const errMsg = err instanceof Error ? err.message : String(err);
      this.error = errMsg;
      return null;
    } finally {
      if (this.pendingRequest === request) {
        this.pendingRequest = null;
        this.abortController = null;
        this.isTyping = false;
      }
    }
  }

  destroy(): void {
    this.cancelPending();
    this.config = null;
    this.history = [];
    this.isTyping = false;
    this.error = null;
    this.lastResponse = null;
    this.historyLoaded = false;
  }
}
