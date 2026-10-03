import { useEffect, useState, useCallback, useRef } from "react";
import { KovyRenderer } from "./KovyRenderer";
import { HabitatEditor } from "./HabitatEditor";
import { ErrorBoundary } from "./ErrorBoundary";
import { CommandPalette } from "./CommandPalette";
import { ChatPanel } from "./ChatPanel";
import { useConfigStore } from "@/store/configStore";
import { useKovyStore } from "@/store/kovyStore";
import { useEntityStore } from "@/store/entityStore";
import { DragEngine } from "@/engine/dragEngine";
import { AICoordinator } from "@/engine/aiCoordinator";
import { ProfileAutoSwitchRunner } from "@/engine/profileAutoSwitchRunner";
import { CaptureAppAutoHideRunner } from "@/engine/captureAppAutoHideRunner";
import type { Vec2 } from "@/store/types";
import { commandRegistry } from "@/lib/commandRegistry";
import {
  listenToTrayEvents,
  registerHotkeys,
  unregisterAllHotkeys,
  syncConfigToBackend,
  setOverlayClickThrough,
  pauseCapture,
  resumeCapture,
  showSettings,
  showOverlay,
  hideOverlay,
  setAutostart,
  startCurrentMonitorTracking,
  stopCurrentMonitorTracking,
} from "@/lib/tauriBridge";
import { onConfigEvent, CONFIG_EVENTS } from "@/lib/configSyncBus";

let habitatOverlayPrev: boolean | undefined;

export function OverlayApp() {
  const [ready, setReady] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const config = useConfigStore((s) => s.appliedConfig);
  const receiveApplied = useConfigStore((s) => s.receiveAppliedConfig);
  const isVisible = useKovyStore((s) => s.isVisible);
  const interactModeRef = useRef(false);
  // Ref for preview config — used by renderer without causing full re-renders
  const previewConfigRef = useRef(config);
  // AI coordinator instance — manages request lifecycle, cooldown, and periodic scheduling
  const aiCoordinatorRef = useRef<AICoordinator | null>(null);
  // Profile auto-switch runner — periodically evaluates rules and switches profiles
  const autoSwitchRunnerRef = useRef<ProfileAutoSwitchRunner | null>(null);
  const captureAppRunnerRef = useRef<CaptureAppAutoHideRunner | null>(null);

  // --- Initial setup ---
  useEffect(() => {
    loadConfig().then(() => setReady(true));
  }, [loadConfig]);

  // --- Listen for config sync events from settings window ---
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    const safeRegister = (promise: Promise<() => void>) => {
      promise.then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanups.push(unlisten);
        }
      });
    };

    // Apply: settings window committed a config change
    safeRegister(onConfigEvent(CONFIG_EVENTS.APPLY, (newConfig) => {
      receiveApplied(newConfig);
      previewConfigRef.current = newConfig;
      // Sync to Rust backend
      syncConfigToBackend(newConfig);
      // Handle autostart on apply
      setAutostart(newConfig.general.launchAtStartup);
      // Hotkeys are re-registered by the dedicated hotkey effect below
    }));

    // Preview: settings window is live-previewing draft changes
    safeRegister(onConfigEvent(CONFIG_EVENTS.PREVIEW, (previewConfig) => {
      previewConfigRef.current = previewConfig;
    }));

    // Revert: settings window cancelled, go back to applied
    safeRegister(onConfigEvent(CONFIG_EVENTS.REVERT, (appliedConfig) => {
      previewConfigRef.current = appliedConfig;
    }));

    return () => {
      disposed = true;
      cleanups.forEach((u) => u());
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Set click-through on mount ---
  useEffect(() => {
    if (!ready) return;
    setOverlayClickThrough(true);
    useKovyStore.getState().setClickThrough(true);

    // Initial hydration of siblings
    useEntityStore.getState().initFounder();
    
    // Listen for broadcast channel updates from other windows (e.g. settings creating new entities)
    const channel = new BroadcastChannel("kovy-entity-sync");
    const handleMessage = () => {
      useEntityStore.getState().syncFromLocalStorage();
    };
    channel.addEventListener("message", handleMessage);
    return () => channel.removeEventListener("message", handleMessage);
  }, [ready]);

  // --- Sync config to Rust backend when applied config changes ---
  useEffect(() => {
    if (!ready) return;
    syncConfigToBackend(config);
  }, [
    ready,
    config.vision.enabled,
    config.vision.analysisFps,
    config.vision.analysisScale,
    config.vision.motionThreshold,
    config.general.monitorMode,
    config.privacy.hideFromCapture,
  ]);

  // --- Current monitor tracking: follow cursor across monitors ---
  useEffect(() => {
    if (!ready) return;
    if (config.general.monitorMode === "current") {
      startCurrentMonitorTracking(
        () => useKovyStore.getState().cursorPosition,
        (bounds) => {
          useKovyStore.getState().setCurrentMonitorBounds(bounds);
        }
      );
    } else {
      stopCurrentMonitorTracking();
      useKovyStore.getState().setCurrentMonitorBounds(null);
    }
    return () => { stopCurrentMonitorTracking(); };
  }, [ready, config.general.monitorMode]);

  // --- Apply specific monitor positioning on mount and change ---
  useEffect(() => {
    if (!ready) return;
    
    async function updateWindowPosition() {
      if (config.general.monitorMode === "current") {
        return; // Handled by default OS positioning or current tracking
      }
      
      try {
        const { availableMonitors, primaryMonitor, getCurrentWindow } = await import("@tauri-apps/api/window");
        const { PhysicalPosition } = await import("@tauri-apps/api/dpi");
        
        let targetMonitor = null;
        if (config.general.monitorMode === "primary") {
          targetMonitor = await primaryMonitor();
        } else {
          const monitors = await availableMonitors();
          targetMonitor = monitors.find((m, i) => (m.name ?? `monitor_${i}`) === config.general.monitorMode);
        }
        
        if (targetMonitor) {
          const win = getCurrentWindow();
          // Unmaximize before moving to ensure OS lets it change monitors
          await win.unmaximize();
          // Use physical position to move the window to the target monitor
          await win.setPosition(new PhysicalPosition(targetMonitor.position.x, targetMonitor.position.y));
          // Maximize again to fill the new monitor
          await win.maximize();

          // Refresh the location of Kovy and family members to place them on the correct screen
          setTimeout(() => {
            const state = useKovyStore.getState();
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            
            state.setPosition({ x: centerX, y: centerY });
            state.setPerchPosition(null);

            const es = useEntityStore.getState();
            es.getNonFounderEntities().forEach(sib => {
              es.updateEntityRuntime(sib.meta.id, { 
                position: { 
                  x: centerX + (Math.random() * 100 - 50), 
                  y: centerY + (Math.random() * 100 - 50) 
                },
                perchPosition: null
              });
            });
          }, 100);
        }
      } catch (e) {
        console.log("Not in Tauri, skipping window positioning", e);
      }
    }
    
    updateWindowPosition();
  }, [ready, config.general.monitorMode]);

  // --- Pause/resume capture when privacy paused ---
  const isPrivacyPaused = useKovyStore((s) => s.isPrivacyPaused);
  const isPaused = useKovyStore((s) => s.isPaused);
  useEffect(() => {
    if (isPrivacyPaused || isPaused) {
      pauseCapture();
    } else if (config.vision.enabled) {
      resumeCapture();
    }
  }, [isPrivacyPaused, isPaused, config.vision.enabled]);

  // --- AI coordinator: initialize, update config, and handle insights ---
  useEffect(() => {
    if (!ready) return;

    const coordinator = new AICoordinator();
    aiCoordinatorRef.current = coordinator;

    coordinator.setCallbacks({
      onInsight: (insight) => {
        const pos = useKovyStore.getState().position;
        window.dispatchEvent(new CustomEvent("kovy-ai-insight", {
          detail: {
            thoughtText: insight.thoughtText,
            whisperText: insight.whisperText,
            whisperCategory: insight.whisperCategory,
            source: insight.source,
            position: { x: pos.x, y: pos.y },
          },
        }));
      },
      onThinking: (isThinking) => {
        if (!isThinking) {
          window.dispatchEvent(new CustomEvent("kovy-ai-thinking-done"));
        }
      },
      onError: (source, error) => {
        const pos = useKovyStore.getState().position;
        window.dispatchEvent(new CustomEvent("kovy-ai-error", {
          detail: { source, error, position: { x: pos.x, y: pos.y } },
        }));
      },
      onScreenshot: (source, monitorNames) => {
        window.dispatchEvent(new CustomEvent("kovy-ai-screenshot", {
          detail: { source, monitorNames },
        }));
      },
    });

    coordinator.updateConfig(config.ai);

    return () => {
      coordinator.destroy();
      aiCoordinatorRef.current = null;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update AI config when it changes
  useEffect(() => {
    if (!ready || !aiCoordinatorRef.current) return;
    aiCoordinatorRef.current.updateConfig(config.ai);
  }, [ready, config.ai]);

  // --- Profile auto-switch runner: evaluate rules every 10s ---
  useEffect(() => {
    if (!ready) return;

    const runner = new ProfileAutoSwitchRunner({
      intervalMs: 10_000,
      getRules: () => useConfigStore.getState().appliedConfig.profiles.autoSwitchRules,
      getSavedProfiles: () => useConfigStore.getState().appliedConfig.profiles.savedProfiles,
      getActiveProfileId: () => useConfigStore.getState().appliedConfig.profiles.activeProfileId,
      applyProfile: (profile) => {
        const configStore = useConfigStore.getState();
        configStore.importConfig(JSON.stringify(profile.config));
        // Also update the active profile id so we don't re-switch
        configStore.updateDraftProfiles({
          ...configStore.draftConfig.profiles,
          activeProfileId: profile.id,
        });
        // Dispatch the standard profile-switch event for stats/journal
        window.dispatchEvent(new CustomEvent("kovy-profile-switch"));
      },
    });
    autoSwitchRunnerRef.current = runner;
    runner.start();

    return () => {
      runner.destroy();
      autoSwitchRunnerRef.current = null;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Capture-app auto-hide runner: probe for OBS/Streamlabs/etc every 5s ---
  useEffect(() => {
    if (!ready) return;

    const runner = new CaptureAppAutoHideRunner({
      intervalMs: 5_000,
      getEnabled: () => useConfigStore.getState().appliedConfig.privacy.autoHideOnCaptureApp,
      getHideFromCapture: () => useConfigStore.getState().appliedConfig.privacy.hideFromCapture,
      setHideFromCapture: (hide) => useConfigStore.getState().setHideFromCaptureRuntime(hide),
    });
    captureAppRunnerRef.current = runner;
    runner.start();

    return () => {
      runner.destroy();
      captureAppRunnerRef.current = null;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Tray event handlers ---
  const handleTogglePause = useCallback(() => {
    const state = useKovyStore.getState();
    const newPaused = !state.isPaused;
    state.setPaused(newPaused);
    const cfg = useConfigStore.getState().appliedConfig;
    if (newPaused) pauseCapture(); else if (cfg.vision.enabled) resumeCapture();
  }, []);

  const handleToggleSleep = useCallback(() => {
    const state = useKovyStore.getState();
    state.setAsleep(!state.isAsleep);
  }, []);

  const handlePrivacyPause = useCallback(() => {
    const state = useKovyStore.getState();
    state.setPrivacyPaused(!state.isPrivacyPaused);
  }, []);

  const handleResetPosition = useCallback(() => {
    const state = useKovyStore.getState();
    state.setPosition({ x: state.screenWidth / 2, y: state.screenHeight / 2 });
    state.setPerchPosition(null);
  }, []);

  const handleToggleMuse = useCallback(() => {
    // Dispatch a custom event that KovyRenderer listens to
    window.dispatchEvent(new CustomEvent("kovy-muse-toggle"));
  }, []);

  const handleToggleGaming = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kovy-gaming-toggle"));
  }, []);

  const dragEngineRef = useRef<DragEngine | null>(null);
  const isDraggingRef = useRef(false);

  const handleToggleDrag = useCallback(() => {
    // Toggle drag mode: disable click-through so user can grab Kovy
    const state = useKovyStore.getState();
    const newClickThrough = !state.isClickThrough;
    setOverlayClickThrough(newClickThrough);
    state.setClickThrough(newClickThrough);
    state.setInteracting(!newClickThrough);
  }, []);

  const handleToggleFocus = useCallback(() => {
    // Manually toggle focus mode by dispatching event
    window.dispatchEvent(new CustomEvent("kovy-focus-toggle"));
  }, []);

  const handleSwitchProfile = useCallback(() => {
    // Cycle through saved profiles
    const configStore = useConfigStore.getState();
    const profiles = configStore.appliedConfig.profiles?.savedProfiles ?? [];
    if (profiles.length === 0) return;
    const currentId = configStore.appliedConfig.profiles?.activeProfileId ?? "";
    const currentIdx = profiles.findIndex(p => p.id === currentId);
    const nextIdx = (currentIdx + 1) % profiles.length;
    const nextProfile = profiles[nextIdx];
    if (nextProfile) {
      configStore.importConfig(JSON.stringify(nextProfile.config));
      window.dispatchEvent(new CustomEvent("kovy-profile-switch"));
    }
  }, []);

  const handleToggleVisibility = useCallback(() => {
    const state = useKovyStore.getState();
    const newVisible = !state.isVisible;
    state.setVisible(newVisible);
    const es = useEntityStore.getState();
    es.getNonFounderEntities().forEach((e) => {
      es.setEntityVisible(e.meta.id, newVisible);
    });
    if (newVisible) showOverlay(); else hideOverlay();
  }, []);

  const handleOpenSettings = useCallback(() => {
    showSettings();
  }, []);

  const handleToggleExperienceMode = useCallback(() => {
    const configStore = useConfigStore.getState();
    const currentMode = configStore.appliedConfig.general.experienceMode;
    const newMode = currentMode === "lite" ? "full" : "lite";
    configStore.setExperienceMode(newMode);
  }, []);

  // --- Ask Kovy: trigger immediate AI request ---
  const handleAskKovy = useCallback(() => {
    const coordinator = aiCoordinatorRef.current;
    if (!coordinator) return;

    const state = useKovyStore.getState();
    const pos = state.position;

    // Immediately show "thinking..." bubble
    window.dispatchEvent(new CustomEvent("kovy-ai-thinking", {
      detail: { position: { x: pos.x, y: pos.y } },
    }));

    coordinator.startRequest("ask-kovy").then((result) => {
      if (result.accepted) {
        result.completion.catch(() => { /* error already reported via callback */ });
      } else {
        // Rejected — show a brief reason as a thought
        const reasons: Record<string, string> = {
          "disabled": "AI is turned off",
          "missing-key": "I need an API key first!",
          "cooldown": "Give me a moment...",
          "busy": "I'm already thinking!",
        };
        const text = reasons[result.reason] ?? "Hmm, not right now.";
        window.dispatchEvent(new CustomEvent("kovy-ai-rejected", {
          detail: { text, position: { x: pos.x, y: pos.y } },
        }));

        // If screenshots are enabled and rejection was cooldown/busy, show a screenshot-blocked toast
        if (config.ai.sendScreenshot && (result.reason === "cooldown" || result.reason === "busy")) {
          window.dispatchEvent(new CustomEvent("kovy-ai-screenshot", {
            detail: { source: "ask-kovy", monitorNames: [], blocked: true },
          }));
        }
      }
    });
  }, []);

  // --- Show Companion Digest: aggregate engines and render the digest card ---
  const handleShowDigest = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kovy-show-digest"));
  }, []);

  // --- Show Companion Chronicle: render the longitudinal trends card ---
  const handleShowChronicle = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kovy-show-chronicle"));
  }, []);

  // --- Show Companion Story: render the weekly chapter card (v9.0) ---
  const handleShowStory = useCallback(() => {
    window.dispatchEvent(new CustomEvent("kovy-show-story"));
  }, []);

  // --- Open Chat: open the conversational chat panel (v9.0) ---
  const handleOpenChat = useCallback(() => {
    setChatPanelOpen(prev => !prev);
  }, []);

  // --- Register commands for the command palette ---
  useEffect(() => {
    if (!ready) return;
    commandRegistry.register({ id: "toggle-visibility", label: "Toggle Visibility", category: "General", keywords: "show hide visible", action: handleToggleVisibility });
    commandRegistry.register({ id: "open-settings", label: "Open Settings", category: "General", keywords: "settings config options", action: handleOpenSettings });
    commandRegistry.register({ id: "pause-analysis", label: "Pause / Resume Analysis", category: "General", keywords: "pause resume motion vision", action: handleTogglePause });
    commandRegistry.register({ id: "sleep-wake", label: "Sleep / Wake", category: "General", keywords: "sleep wake nap", action: handleToggleSleep });
    commandRegistry.register({ id: "privacy-pause", label: "Privacy Pause", category: "General", keywords: "privacy stop observe", action: handlePrivacyPause });
    commandRegistry.register({ id: "reset-position", label: "Reset Position", category: "General", keywords: "center move position", action: handleResetPosition });
    commandRegistry.register({ id: "toggle-muse", label: "Toggle Muse", category: "Modes", keywords: "muse creative overlay", action: handleToggleMuse });
    commandRegistry.register({ id: "toggle-gaming", label: "Toggle Gaming Mode", category: "Modes", keywords: "gaming game mode", action: handleToggleGaming });
    commandRegistry.register({ id: "toggle-drag", label: "Toggle Drag Mode", category: "Modes", keywords: "drag move grab", action: handleToggleDrag });
    commandRegistry.register({ id: "toggle-focus", label: "Toggle Focus Mode", category: "Modes", keywords: "focus work distraction", action: handleToggleFocus });
    commandRegistry.register({ id: "switch-profile", label: "Switch Profile", category: "Profiles", keywords: "profile preset cycle", action: handleSwitchProfile });
    commandRegistry.register({ id: "toggle-experience", label: "Toggle Lite / Pro Mode", category: "General", keywords: "lite pro experience mode", action: handleToggleExperienceMode });
    commandRegistry.register({ id: "ask-kovy", label: "Ask Kovy", category: "AI", keywords: "ai ask insight", action: handleAskKovy });
    commandRegistry.register({ id: "show-digest", label: "Show Companion Digest", category: "General", keywords: "digest summary stats bond recap", action: handleShowDigest });
    commandRegistry.register({ id: "show-chronicle", label: "Show Companion Chronicle", category: "General", keywords: "chronicle trends history streak insights weekly", action: handleShowChronicle });
    commandRegistry.register({ id: "show-story", label: "Show Companion Story", category: "General", keywords: "story chapter weekly narrative", action: handleShowStory });
    commandRegistry.register({ id: "open-chat", label: "Open Chat", category: "AI", keywords: "chat conversation talk kovy", action: handleOpenChat });
    return () => { commandRegistry.clear(); };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Register tray event listeners ---
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let cleanups: Array<() => void> = [];

    listenToTrayEvents({
      onTogglePause: handleTogglePause,
      onToggleSleep: handleToggleSleep,
      onPrivacyPause: handlePrivacyPause,
      onResetPosition: handleResetPosition,
      onToggleHabitatEdit: () => {
        const state = useKovyStore.getState();
        const entering = !state.habitatEditMode;
        state.setHabitatEditMode(entering);
        if (entering) {
          // Force habitat overlay visible during edit mode
          habitatOverlayPrev = useConfigStore.getState().appliedConfig.advanced.habitatOverlay;
          useConfigStore.getState().updateDraftAdvanced({ habitatOverlay: true });
        } else {
          // Restore previous habitat overlay preference
          const prev = habitatOverlayPrev;
          if (prev !== undefined) {
            useConfigStore.getState().updateDraftAdvanced({ habitatOverlay: prev });
          }
        }
      },
      onToggleVisibility: handleToggleVisibility,
      onToggleExperienceMode: handleToggleExperienceMode,
      onAskKovy: handleAskKovy,
      onShowDigest: handleShowDigest,
      onShowChronicle: handleShowChronicle,
      onShowStory: handleShowStory,
      onOpenChat: handleOpenChat,
      onCommandPalette: () => setCommandPaletteOpen(true),
    }).then((u) => {
      if (disposed) {
        u.forEach((fn) => fn());
      } else {
        cleanups = u;
      }
    });

    return () => {
      disposed = true;
      cleanups.forEach((u) => u());
    };
  }, [ready, handleTogglePause, handleToggleSleep, handlePrivacyPause, handleResetPosition, handleToggleVisibility, handleToggleExperienceMode, handleAskKovy, handleShowDigest, handleShowChronicle, handleShowStory, handleOpenChat]);

  // --- Register global hotkeys ---
  useEffect(() => {
    if (!ready) return;
    registerHotkeys(config.hotkeys, {
      toggleVisibility: handleToggleVisibility,
      openSettings: handleOpenSettings,
      pauseAnalysis: handleTogglePause,
      sleepWake: handleToggleSleep,
      privacyPause: handlePrivacyPause,
      resetPosition: handleResetPosition,
      toggleMuse: handleToggleMuse,
      toggleGaming: handleToggleGaming,
      toggleDrag: handleToggleDrag,
      toggleFocus: handleToggleFocus,
      switchProfile: handleSwitchProfile,
      toggleExperienceMode: handleToggleExperienceMode,
      askKovy: handleAskKovy,
      showDigest: handleShowDigest,
      showChronicle: handleShowChronicle,
      showStory: handleShowStory,
      openChat: handleOpenChat,
      commandPalette: () => setCommandPaletteOpen(true),
    });
    return () => { unregisterAllHotkeys(); };
  }, [ready, config.hotkeys, handleToggleVisibility, handleOpenSettings, handleTogglePause, handleToggleSleep, handlePrivacyPause, handleResetPosition, handleToggleMuse, handleToggleGaming, handleToggleDrag, handleToggleFocus, handleSwitchProfile, handleToggleExperienceMode, handleAskKovy, handleShowDigest, handleShowChronicle, handleShowStory, handleOpenChat]);

  // --- Interaction mode: Alt key toggles click-through ---
  useEffect(() => {
    if (!config.behavior.interactionMode) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Alt" && !interactModeRef.current) {
        interactModeRef.current = true;
        await setOverlayClickThrough(false);
        useKovyStore.getState().setClickThrough(false);
        useKovyStore.getState().setInteracting(true);
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (e.key === "Alt" && interactModeRef.current) {
        interactModeRef.current = false;
        await setOverlayClickThrough(true);
        useKovyStore.getState().setClickThrough(true);
        useKovyStore.getState().setInteracting(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (interactModeRef.current) {
        interactModeRef.current = false;
        setOverlayClickThrough(true);
        useKovyStore.getState().setClickThrough(true);
        useKovyStore.getState().setInteracting(false);
      }
    };
  }, [config.behavior.interactionMode]);

  // --- Interaction: click/poke on Kovy body ---
  useEffect(() => {
    if (!config.behavior.interactionMode) return;

    const handleClick = (e: MouseEvent) => {
      const state = useKovyStore.getState();
      if (state.isClickThrough) return;

      const dx = e.clientX - state.position.x;
      const dy = e.clientY - state.position.y;
      const bodyRadius = 32 * config.appearance.size;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= bodyRadius * 1.5) {
        const mood = state.internalMood;
        state.setInternalMood({
          ...mood,
          trust: Math.min(1, mood.trust + 0.05),
          stimulation: Math.min(1, mood.stimulation + 0.1),
          comfort: Math.min(1, mood.comfort + 0.03),
          confidence: Math.min(1, mood.confidence + 0.04),
        });
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [config.behavior.interactionMode, config.appearance.size]);

  // --- Drag interaction: pointer events when not click-through ---
  useEffect(() => {
    if (!config.drag.enabled) return;
    if (!dragEngineRef.current) dragEngineRef.current = new DragEngine();
    const dragEngine = dragEngineRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      const state = useKovyStore.getState();
      if (state.isClickThrough) return;
      const entityPos = state.position;
      const pointer: Vec2 = { x: e.clientX, y: e.clientY };
      if (dragEngine.isWithinGrabRadius(pointer, entityPos, config.drag)) {
        isDraggingRef.current = true;
        dragEngine.startDrag(pointer, entityPos);
        state.setInteracting(true);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      dragEngine.updateDrag({ x: e.clientX, y: e.clientY }, 1 / 60);
      const out = dragEngine.update(1 / 60, config.drag);
      if (out.isDragging) {
        useKovyStore.getState().setPosition(out.position);
      }
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      dragEngine.endDrag(config.drag);
      useKovyStore.getState().setInteracting(false);
      // Record drag release in stats
      window.dispatchEvent(new CustomEvent("kovy-drag-release"));
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [config.drag.enabled, config.drag.grabRadius, config.drag]);

  // --- Habitat edit mode: Escape exits ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useKovyStore.getState().habitatEditMode) {
        useKovyStore.getState().setHabitatEditMode(false);
        setOverlayClickThrough(true);
        useKovyStore.getState().setClickThrough(true);
        // Restore previous habitat overlay preference
        const prev = habitatOverlayPrev;
        if (prev !== undefined) {
          useConfigStore.getState().updateDraftAdvanced({ habitatOverlay: prev });
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!ready) return null;
  if (!isVisible) return null;

  return (
    <>
      <ErrorBoundary>
        <KovyRenderer previewConfigRef={previewConfigRef} />
      </ErrorBoundary>
      <HabitatEditor />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ChatPanel visible={chatPanelOpen} onClose={() => setChatPanelOpen(false)} />
    </>
  );
}
