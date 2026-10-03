// ============================================================
// Event handlers — extracted from KovyRenderer
// Registers window event listeners for Kovy's custom events
// (toggles, AI insights, digest/chronicle, capture-app, etc.)
// and returns a cleanup function to remove them.
// ============================================================

import type { EngineContainer } from "../engineManager";
import type { FrameState } from "./frameState";
import type { KovyConfig } from "@/store/types";
import type { MutableRefObject } from "react";
import { useKovyStore } from "@/store/kovyStore";
import { useConfigStore } from "@/store/configStore";
import { buildDigest, type DigestInputs, type DigestHighlight } from "@/engine/digestEngine";
import {
  buildTrends,
  generateInsights,
  type ChronicleSnapshotInputs,
} from "@/engine/chronicleEngine";
import { loadSnapshots } from "@/engine/chronicleStorage";
import { ChronicleRunner } from "@/engine/chronicleRunner";
import {
  showProfileSwitchToast,
  showCaptureAppToast,
  showDigestToast, dismissDigestToast,
  showChronicleToast, dismissChronicleToast,
  showStoryToast, dismissStoryToast,
  showScreenshotToast,
} from "../toastHandlers";
import type { WhisperMessage } from "@/engine/whisperEngine";

export interface EventHandlerRefs {
  enginesRef: MutableRefObject<EngineContainer>;
  frameStateRef: MutableRefObject<FrameState>;
  ctxRef: MutableRefObject<CanvasRenderingContext2D | null>;
}

/**
 * Register all Kovy custom-event listeners and start the chronicle runner.
 * Returns a cleanup function that removes listeners and destroys the runner.
 */
export function registerKovyEventHandlers(
  refs: EventHandlerRefs,
  config: KovyConfig,
): () => void {
  const { enginesRef, frameStateRef, ctxRef } = refs;

  // --- Toggle events ---
  const handleMuseToggle = () => {
    enginesRef.current.muse?.toggle();
    if (enginesRef.current.milestone && config.milestone.enabled) {
      enginesRef.current.milestone.recordMuseOverlay();
    }
  };
  const handleGamingToggle = () => {
    enginesRef.current.gaming?.toggle();
    if (enginesRef.current.milestone && config.milestone.enabled) {
      enginesRef.current.milestone.recordGamingActivated();
    }
  };
  const handleFocusToggle = () => {
    const focusEng = enginesRef.current.focus;
    if (!focusEng) return;
    const current = frameStateRef.current.focusOutput;
    if (current.state === "unfocused") {
      frameStateRef.current.focusOutput = {
        ...current,
        enabled: true,
        state: "light_focus",
        suppressEmotes: true,
        suppressSound: true,
        suggestedBehavior: "perch",
        suggestedMood: "focused",
      };
    } else {
      frameStateRef.current.focusOutput = {
        ...current,
        state: "unfocused",
        suppressEmotes: false,
        suppressSound: false,
        suggestedBehavior: null,
        suggestedMood: null,
      };
    }
  };
  const handleDragRelease = () => {
    if (enginesRef.current.stats && config.stats.enabled) {
      enginesRef.current.stats.recordDragRelease();
    }
    if (enginesRef.current.milestone && config.milestone.enabled) {
      enginesRef.current.milestone.recordDrag();
    }
  };
  const handleProfileSwitch = () => {
    if (enginesRef.current.stats && config.stats.enabled) {
      enginesRef.current.stats.recordProfileSwitch();
    }
  };
  window.addEventListener("kovy-muse-toggle", handleMuseToggle);
  window.addEventListener("kovy-gaming-toggle", handleGamingToggle);
  window.addEventListener("kovy-focus-toggle", handleFocusToggle);
  window.addEventListener("kovy-drag-release", handleDragRelease);
  window.addEventListener("kovy-profile-switch", handleProfileSwitch);

  // --- Profile auto-switch toast ---
  const handleAutoProfileSwitch = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.profileName) {
      showProfileSwitchToast(
        detail.profileName,
        detail.profileIcon ?? "⭐",
        detail.reason ?? "Auto-switch rule",
        performance.now(),
      );
    }
  };
  window.addEventListener("kovy-profile-auto-switch", handleAutoProfileSwitch);

  // --- Capture-app auto-hide toast ---
  const handleCaptureAppDetected = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    showCaptureAppToast(true, detail?.matched ?? [], performance.now());
  };
  const handleCaptureAppCleared = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    showCaptureAppToast(false, detail?.matched ?? [], performance.now());
  };
  window.addEventListener("kovy-capture-app-detected", handleCaptureAppDetected);
  window.addEventListener("kovy-capture-app-cleared", handleCaptureAppCleared);

  // --- Companion Digest ---
  const handleShowDigest = () => {
    const engines = enginesRef.current;
    const cfg = useConfigStore.getState().appliedConfig;
    if (!cfg.digest.enabled) return;
    const state = useKovyStore.getState();
    const bondState = engines.bond ? engines.bond.getState() : null;
    const statsOutput = engines.stats ? engines.stats.update(cfg.stats) : null;
    const growthOutput = engines.growth ? engines.growth.update(0, cfg.growth) : null;
    const milestoneCount = engines.milestone ? engines.milestone.getUnlocked().length : 0;
    const activeSeconds = engines.milestone ? engines.milestone.getState().totalActiveSeconds : 0;
    const recentEntries = engines.journal ? engines.journal.getRecentEntries(40) : [];
    const inputs: DigestInputs = {
      config: cfg.digest,
      bondState,
      stats: statsOutput?.stats ?? null,
      surfaceMood: state.surfaceMood,
      growth: growthOutput,
      milestoneCount,
      activeSeconds,
      recentEntries,
    };
    const digest = buildDigest(inputs);
    const ctx = ctxRef.current;
    if (ctx) {
      showDigestToast(digest, cfg.digest.autoDismissSec, performance.now());
    }
  };
  window.addEventListener("kovy-show-digest", handleShowDigest);

  // --- Companion Chronicle ---
  const handleShowChronicle = () => {
    const cfg = useConfigStore.getState().appliedConfig;
    if (!cfg.chronicle.enabled) return;
    const snapshots = loadSnapshots();
    const trends = buildTrends(snapshots);
    const insights = cfg.chronicle.showInsights ? generateInsights(trends, snapshots) : [];
    const ctx = ctxRef.current;
    if (ctx) {
      showChronicleToast(trends, insights, cfg.chronicle.autoDismissSec, performance.now());
    }
  };
  window.addEventListener("kovy-show-chronicle", handleShowChronicle);

  // --- Companion Story (v9.0) ---
  const handleShowStory = () => {
    const cfg = useConfigStore.getState().appliedConfig;
    if (!cfg.story.enabled) return;
    // Load the most recent chapter from storage
    import("@/engine/storyEngine").then(({ loadStoryChapters }) => {
      const chapters = loadStoryChapters();
      if (chapters.length === 0) return;
      const latest = chapters[chapters.length - 1];
      const ctx = ctxRef.current;
      if (ctx) {
        showStoryToast(latest, cfg.story.autoDismissSec, performance.now());
      }
    });
  };
  window.addEventListener("kovy-show-story", handleShowStory);

  // --- Chronicle runner: persist one companion snapshot per day ---
  const chronicleRunner = new ChronicleRunner({
    intervalMs: 60_000,
    getEnabled: () => useConfigStore.getState().appliedConfig.chronicle.enabled,
    getSnapshotHour: () => useConfigStore.getState().appliedConfig.chronicle.snapshotHour,
    getRetentionDays: () => useConfigStore.getState().appliedConfig.chronicle.retentionDays,
    buildInputs: () => {
      const engines = enginesRef.current;
      const cfg = useConfigStore.getState().appliedConfig;
      const state = useKovyStore.getState();
      const bondState = engines.bond ? engines.bond.getState() : null;
      const statsOutput = engines.stats ? engines.stats.update(cfg.stats) : null;
      const growthOutput = engines.growth ? engines.growth.update(0, cfg.growth) : null;
      const milestoneCount = engines.milestone ? engines.milestone.getUnlocked().length : 0;
      const activeSeconds = engines.milestone ? engines.milestone.getState().totalActiveSeconds : 0;
      const recentEntries = engines.journal ? engines.journal.getRecentEntries(40) : [];
      const today = new Date().toISOString().slice(0, 10);
      const highlightEntry = [...recentEntries]
        .reverse()
        .find(e => e.dateStr === today && e.type !== "daily_summary" && e.type !== "whisper")
        ?? [...recentEntries].reverse().find(e => e.type !== "daily_summary") ?? null;
      const highlight: DigestHighlight | null = highlightEntry
        ? { title: highlightEntry.title, body: highlightEntry.body, type: highlightEntry.type, timestamp: highlightEntry.timestamp }
        : null;
      const inputs: ChronicleSnapshotInputs = {
        bondState,
        stats: statsOutput?.stats ?? null,
        surfaceMood: state.surfaceMood,
        growth: growthOutput,
        milestoneCount,
        activeSeconds,
        highlight,
      };
      return inputs;
    },
  });
  chronicleRunner.start();

  // --- AI event handlers ---
  const handleAiThinking = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const pos = detail?.position ?? useKovyStore.getState().position;
    if (enginesRef.current.thought) {
      enginesRef.current.thought.spawnCustom("...", pos, "comic");
    }
  };
  const handleAiInsight = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const pos = detail?.position ?? useKovyStore.getState().position;
    if (enginesRef.current.thought && detail?.thoughtText) {
      enginesRef.current.thought.spawnCustom(detail.thoughtText, pos, "comic");
    }
    if (enginesRef.current.whisper && detail?.whisperText) {
      const cat = (detail.whisperCategory ?? "encouragement") as WhisperMessage["category"];
      enginesRef.current.whisper.spawnCustom(detail.whisperText, cat, pos, config.whisper.style);
    }
    if (enginesRef.current.journal && config.journal.enabled && detail?.thoughtText) {
      const source = (detail?.source ?? "ask-kovy") as string;
      enginesRef.current.journal.recordAiInsight(
        source,
        detail.thoughtText,
        detail?.whisperText ?? "",
        useKovyStore.getState().surfaceMood,
      );
    }
  };
  const handleAiRejected = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const pos = detail?.position ?? useKovyStore.getState().position;
    if (enginesRef.current.thought && detail?.text) {
      enginesRef.current.thought.spawnCustom(detail.text, pos, "comic");
    }
  };
  const handleAiError = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const pos = detail?.position ?? useKovyStore.getState().position;
    if (enginesRef.current.thought) {
      enginesRef.current.thought.spawnCustom("...something went wrong", pos, "comic");
    }
  };
  const handleAiScreenshot = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const source = (detail?.source ?? "ask-kovy") as "ask-kovy" | "periodic";
    const monitorNames = (detail?.monitorNames ?? []) as string[];
    showScreenshotToast(source, monitorNames, performance.now());
  };
  window.addEventListener("kovy-ai-thinking", handleAiThinking);
  window.addEventListener("kovy-ai-insight", handleAiInsight);
  window.addEventListener("kovy-ai-rejected", handleAiRejected);
  window.addEventListener("kovy-ai-error", handleAiError);
  window.addEventListener("kovy-ai-screenshot", handleAiScreenshot);

  // Return cleanup function
  return () => {
    window.removeEventListener("kovy-muse-toggle", handleMuseToggle);
    window.removeEventListener("kovy-gaming-toggle", handleGamingToggle);
    window.removeEventListener("kovy-focus-toggle", handleFocusToggle);
    window.removeEventListener("kovy-drag-release", handleDragRelease);
    window.removeEventListener("kovy-profile-switch", handleProfileSwitch);
    window.removeEventListener("kovy-profile-auto-switch", handleAutoProfileSwitch);
    window.removeEventListener("kovy-capture-app-detected", handleCaptureAppDetected);
    window.removeEventListener("kovy-capture-app-cleared", handleCaptureAppCleared);
    window.removeEventListener("kovy-show-digest", handleShowDigest);
    dismissDigestToast();
    window.removeEventListener("kovy-show-chronicle", handleShowChronicle);
    dismissChronicleToast();
    window.removeEventListener("kovy-show-story", handleShowStory);
    dismissStoryToast();
    chronicleRunner.destroy();
    window.removeEventListener("kovy-ai-thinking", handleAiThinking);
    window.removeEventListener("kovy-ai-insight", handleAiInsight);
    window.removeEventListener("kovy-ai-rejected", handleAiRejected);
    window.removeEventListener("kovy-ai-error", handleAiError);
    window.removeEventListener("kovy-ai-screenshot", handleAiScreenshot);
  };
}
