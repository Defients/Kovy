// ============================================================
// AI Request Coordinator — manages the lifecycle of AI requests
// including concurrency control, cooldown enforcement, periodic
// scheduling, and immediate "Ask Kovy" triggering.
//
// Privacy guarantees:
// - No API key stored in config or localStorage
// - Screenshots only sent when ai.sendScreenshot is true
// - All requests go through Rust backend (never from renderer)
// - Cancellation support for in-flight requests
// ============================================================

import type { AIConfig, AIInsight, AIRequestSource, AIRejectReason, AIStartResult, AIWhisperCategory } from "@/store/types";
import { aiRequest, getForegroundApp, aiHasApiKey, type AiInsightResponse } from "@/lib/tauriBridge";
import { kovyLog } from "@/lib/utils";

type InsightCallback = (insight: AIInsight) => void;
type ThinkingCallback = (isThinking: boolean) => void;
type ErrorCallback = (source: AIRequestSource, error: string) => void;
type ScreenshotCallback = (source: AIRequestSource, monitorNames: string[]) => void;

interface PendingRequest {
  requestId: string;
  source: AIRequestSource;
  abortController: AbortController;
  promise: Promise<AIInsight>;
}

function generateRequestId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapInsightResponse(resp: AiInsightResponse): AIInsight {
  return {
    requestId: resp.request_id,
    source: resp.source as AIRequestSource,
    thoughtText: resp.thought_text,
    whisperText: resp.whisper_text,
    whisperCategory: resp.whisper_category as AIWhisperCategory,
    confidence: resp.confidence,
    createdAt: resp.created_at,
  };
}

export class AICoordinator {
  private config: AIConfig | null = null;
  private pending: PendingRequest | null = null;
  private lastInstaSendTime = 0;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;
  private hasApiKey: boolean = false;

  private onInsight: InsightCallback | null = null;
  private onThinking: ThinkingCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onScreenshot: ScreenshotCallback | null = null;

  setCallbacks(callbacks: {
    onInsight?: InsightCallback;
    onThinking?: ThinkingCallback;
    onError?: ErrorCallback;
    onScreenshot?: ScreenshotCallback;
  }): void {
    if (callbacks.onInsight) this.onInsight = callbacks.onInsight;
    if (callbacks.onThinking) this.onThinking = callbacks.onThinking;
    if (callbacks.onError) this.onError = callbacks.onError;
    if (callbacks.onScreenshot) this.onScreenshot = callbacks.onScreenshot;
  }

  async updateConfig(config: AIConfig): Promise<void> {
    const wasEnabled = this.config?.enabled ?? false;
    const wasPeriodic = this.config?.periodicEnabled ?? false;
    this.config = config;

    if (config.enabled) {
      this.hasApiKey = await aiHasApiKey();
    } else {
      this.hasApiKey = false;
    }

    // Restart periodic timer if settings changed
    if (config.enabled && config.periodicEnabled) {
      if (!wasEnabled || !wasPeriodic || this.periodicTimer === null) {
        this.startPeriodic();
      }
    } else {
      this.stopPeriodic();
    }
  }

  private startPeriodic(): void {
    this.stopPeriodic();
    if (!this.config || !this.config.enabled || !this.config.periodicEnabled) return;

    const intervalMs = this.config.periodicIntervalSec * 1000;
    this.periodicTimer = setInterval(() => {
      this.startRequest("periodic").catch((e) => {
        kovyLog.warn("AI: periodic request failed", e);
      });
    }, intervalMs);
  }

  private stopPeriodic(): void {
    if (this.periodicTimer !== null) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  canStartRequest(source: AIRequestSource): { canStart: boolean; reason?: AIRejectReason; retryAfterMs?: number } {
    if (!this.config || !this.config.enabled) {
      return { canStart: false, reason: "disabled" };
    }
    if (!this.hasApiKey) {
      return { canStart: false, reason: "missing-key" };
    }
    if (this.pending !== null) {
      return { canStart: false, reason: "busy" };
    }
    if (source === "ask-kovy") {
      const elapsed = Date.now() - this.lastInstaSendTime;
      const cooldownMs = this.config.instaSendCooldownSec * 1000;
      if (elapsed < cooldownMs) {
        return { canStart: false, reason: "cooldown", retryAfterMs: cooldownMs - elapsed };
      }
    }
    return { canStart: true };
  }

  async startRequest(source: AIRequestSource): Promise<AIStartResult> {
    const check = this.canStartRequest(source);
    if (!check.canStart) {
      return { accepted: false, reason: check.reason!, retryAfterMs: check.retryAfterMs };
    }

    const config = this.config!;
    const requestId = generateRequestId();
    const abortController = new AbortController();

    this.onThinking?.(true);

    const promise = this.executeRequest(requestId, source, config, abortController);

    this.pending = { requestId, source, abortController, promise };

    if (source === "ask-kovy") {
      this.lastInstaSendTime = Date.now();
    }

    const completion = promise.then((insight) => {
      this.pending = null;
      this.onThinking?.(false);
      this.onInsight?.(insight);
      return insight;
    }).catch((err) => {
      this.pending = null;
      this.onThinking?.(false);
      this.onError?.(source, String(err));
      return undefined as unknown as AIInsight;
    });

    return { accepted: true, requestId, completion };
  }

  private async executeRequest(
    requestId: string,
    source: AIRequestSource,
    config: AIConfig,
    abortController: AbortController,
  ): Promise<AIInsight> {
    let foregroundApp: string | null = null;
    let foregroundTitle: string | null = null;

    if (config.includeForegroundApp) {
      try {
        const info = await getForegroundApp();
        foregroundApp = info.processName;
        foregroundTitle = info.windowTitle;
      } catch {
        // Non-fatal — proceed without foreground info
      }
    }

    if (config.sendScreenshot && this.onScreenshot) {
      // Determine which monitor names will be captured
      const monitorNames = this.getMonitorNamesForConfig(config);
      this.onScreenshot(source, monitorNames);
    }

    if (abortController.signal.aborted) {
      throw new Error("cancelled");
    }

    const response = await aiRequest({
      model: config.model,
      sendScreenshot: config.sendScreenshot,
      screenshotMaxWidth: config.screenshotMaxWidth,
      screenshotJpegQuality: config.screenshotJpegQuality,
      screenshotMonitorIndices: config.screenshotMonitorIndices,
      screenshotMonitorQualities: config.screenshotMonitorQualities,
      includeForegroundApp: config.includeForegroundApp,
      foregroundApp,
      foregroundTitle,
      maxThoughtChars: config.maxThoughtChars,
      maxWhisperChars: config.maxWhisperChars,
      timeoutSecs: config.requestTimeoutSec,
      requestId,
      source,
    });

    if (abortController.signal.aborted) {
      throw new Error("cancelled");
    }

    return mapInsightResponse(response);
  }

  cancelPending(): void {
    if (this.pending) {
      this.pending.abortController.abort();
      this.pending = null;
      this.onThinking?.(false);
    }
  }

  isBusy(): boolean {
    return this.pending !== null;
  }

  getCooldownRemainingMs(): number {
    if (!this.config) return 0;
    const elapsed = Date.now() - this.lastInstaSendTime;
    const cooldownMs = this.config.instaSendCooldownSec * 1000;
    return Math.max(0, cooldownMs - elapsed);
  }

  private getMonitorNamesForConfig(config: AIConfig): string[] {
    if (config.screenshotMonitorIndices.length === 0) {
      return ["Primary Monitor"];
    }
    return config.screenshotMonitorIndices.map((idx) => `Monitor ${idx + 1}`);
  }

  destroy(): void {
    this.stopPeriodic();
    this.cancelPending();
    this.config = null;
    this.onInsight = null;
    this.onThinking = null;
    this.onError = null;
    this.onScreenshot = null;
  }
}
