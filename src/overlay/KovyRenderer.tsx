import { useEffect, useRef, useCallback, useState, type MutableRefObject } from "react";
import { KovyCharacterRenderer, type KovyRenderState } from "./KovyCharacter";
import { useKovyStore } from "@/store/kovyStore";
import { useConfigStore } from "@/store/configStore";
import {
  updateMoodState,
  deriveSurfaceMood,
  getMoodModifiers,
  type MoodStimuli,
} from "@/engine/moodEngine";
import type { KovyConfig, MotionRegion, Vec2, EntityId, BehaviorState, SurfaceMood } from "@/store/types";
import { DEFAULT_HABITAT } from "@/store/defaults";
import { clamp, setLogLevel, kovyLog } from "@/lib/utils";
import { onBehaviorChange, setAudioVolume, setSoundPack, playInteractionSound } from "@/engine/audioEngine";
import {
  setDiagnosticsEnabled,
  recordFps,
  recordBehaviorChange,
  recordMoodChange,
  recordTargetCount,
  recordError,
} from "@/engine/diagnosticsEngine";
import { updateOcrConfig, tryRunOcr } from "@/engine/ocrEngine";
import {
  initMemoryEngine, updateMemoryEngine, getMemoryInfluence,
  updateMemoryConfig, destroyMemoryEngine,
} from "@/engine/memoryEngine";
import { useEntityStore, FOUNDER_ID } from "@/store/entityStore";
import { applyPersonalityToMood, applyFamilyToMood } from "@/engine/familyEngine";
import { BehaviorEngine } from "@/engine/behaviorEngine";
import { MovementController } from "@/engine/movementController";
import type { SkinPack } from "@/engine/skinPackEngine";
import { NULL_GAMING_OUTPUT } from "@/engine/gamingEngine";
import { NULL_DREAM_OUTPUT } from "@/engine/dreamEngine";
import { getBondMoodModifier } from "@/engine/bondEngine";
import { resolveDragAction } from "@/engine/dragEngine";
import { getForegroundApp, setOverlayMasks } from "@/lib/tauriBridge";
import { computeEntityMaskRects, maskRectsKey } from "@/lib/overlayMaskUtils";
import {
  getEntityBounds, computeVirtualDesktop, getMonitorCenter, resolveDisplayMonitor,
  type MonitorInfo as MonitorInfoUtil,
  type VirtualDesktopBounds,
} from "@/lib/monitorUtils";
import {
  toOverlayLocalPosition, toOverlayLocalBounds,
} from "./monitorBounds";
import { drawDebugOverlays } from "./debugOverlays";
import { drawToys } from "./ToyRenderer";
import { loadSnapshots } from "@/engine/chronicleStorage";
import { ParticleBurstRenderer } from "@/overlay/ParticleBurst";
import { MuseOverlayRenderer } from "@/overlay/MuseOverlay";
import { GamingResidueRenderer } from "@/overlay/GamingResidue";
import { EmoteRenderer } from "@/overlay/EmoteRenderer";
import { AccessoryRenderer } from "@/overlay/AccessoryRenderer";
import { drawMilestoneToast } from "./milestoneToast";
import { drawScreenshotToast } from "./screenshotToast";
import { drawProfileSwitchToast } from "./profileSwitchToast";
import { drawCaptureAppToast } from "./captureAppToast";
import { drawDigestToast } from "./digestToast";
import { drawChronicleToast } from "./chronicleToast";
import { renderStoryToast } from "./storyToast";
import {
  BOND_WARMTH_MAP,
} from "./renderHelpers";
import { renderThoughtBubbles, renderWhispers, renderAudioVisualizer } from "./overlayRenderers";
import { type EngineContainer, createEngineContainer, initEngines, disposeEngines } from "./engineManager";
import { type FrameState, createFrameState } from "./renderer/frameState";
import { registerKovyEventHandlers } from "./renderer/eventHandlers";
import { renderBackgroundLayers } from "./renderer/backgroundRenderers";
import { updateV7Engines } from "./renderer/v7EngineUpdates";
import { ContextMenu } from "./ContextMenu";

interface KovyRendererProps {
  previewConfigRef: MutableRefObject<KovyConfig>;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function KovyRenderer({ previewConfigRef }: KovyRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rendererRef = useRef<KovyCharacterRenderer | null>(null);
  const weatherParticlesRef = useRef<{ particles: WeatherParticle[]; type: string; screenW: number; screenH: number }>({
    particles: [],
    type: "",
    screenW: 0,
    screenH: 0,
  });
  const animFrameRef = useRef<number>(0);
  const mountedRef = useRef(true);
  
  // Frame-local timing state
  const frameState = useRef<FrameState>(createFrameState());

  const enginesRef = useRef<EngineContainer>(createEngineContainer());

  const fpsCounterRef = useRef<{ frames: number; lastCheck: number }>({
    frames: 0,
    lastCheck: 0,
  });

  // Monitor geometry for per-entity display confinement
  const monitorsRef = useRef<{
    monitors: MonitorInfoUtil[];
    virtualDesktop: VirtualDesktopBounds;
    primaryIndex: number;
    prevDisplayMonitors: Map<string, string>;
  }>({
    monitors: [],
    virtualDesktop: { x: 0, y: 0, width: 1920, height: 1080 },
    primaryIndex: 0,
    prevDisplayMonitors: new Map(),
  });

  const appliedConfig = useConfigStore((s) => s.appliedConfig);
  const store = useKovyStore;

  // --- Context menu state ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0, y: 0, visible: false,
  });

  // --- D5: Toy drag state ---
  const toyDragRef = useRef<{ id: string | null; offsetX: number; offsetY: number }>({
    id: null, offsetX: 0, offsetY: 0,
  });

  // Listen for right-click near Kovy to show the context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Don't interfere if the overlay is hidden or privacy-paused
      const state = store.getState();
      if (!state.isVisible || state.isPrivacyPaused) return;

      // Check if right-click is near Kovy (within 80px of her position)
      const dx = e.clientX - state.position.x;
      const dy = e.clientY - state.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const kovySize = appliedConfig.appearance.size * 40; // approximate hitbox
      if (dist > Math.max(80, kovySize)) return;

      // Prevent the default browser context menu
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [store, appliedConfig.appearance.size]);

  // D5: Toy drag support — listen for mousedown/mousemove/mouseup to drag toys
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // only left click
      const engines = enginesRef.current;
      if (!engines.toy || !engines.toy.isEnabled()) return;
      const pos = { x: e.clientX, y: e.clientY };
      const toyId = engines.toy.hitTest(pos);
      if (toyId) {
        // Find the toy to calculate offset
        const toys = engines.toy.getToys();
        const toy = toys.find(t => t.id === toyId);
        if (toy) {
          toyDragRef.current = {
            id: toyId,
            offsetX: e.clientX - toy.position.x,
            offsetY: e.clientY - toy.position.y,
          };
          e.preventDefault();
        }
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!toyDragRef.current.id) return;
      const engines = enginesRef.current;
      if (!engines.toy) return;
      engines.toy.dragToy(toyDragRef.current.id, {
        x: e.clientX - toyDragRef.current.offsetX,
        y: e.clientY - toyDragRef.current.offsetY,
      });
    };
    const handleMouseUp = () => {
      toyDragRef.current.id = null;
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleContextMenuAction = useCallback((action: string) => {
    const state = store.getState();
    const engines = enginesRef.current;

    if (action === "pet") {
      engines.bond?.recordPoke();
      engines.behavior?.forceState("celebrate");
      if (engines.stats) engines.stats.recordPoke();
    } else if (action === "feed") {
      engines.bond?.recordHover();
      engines.behavior?.forceState("celebrate");
      if (engines.stats) engines.stats.recordHover();
    } else if (action.startsWith("behavior:")) {
      const behavior = action.slice("behavior:".length) as BehaviorState;
      state.setBehaviorState(behavior);
      engines.behavior?.forceState(behavior);
    } else if (action.startsWith("mood:")) {
      const mood = action.slice("mood:".length) as SurfaceMood;
      state.setSurfaceMood(mood);
    } else if (action === "settings") {
      window.dispatchEvent(new CustomEvent("kovy-open-settings"));
    } else if (action === "hide") {
      state.setVisible(false);
    }
  }, [store]);

  // Initialize engines once
  useEffect(() => {
    const state = store.getState();
    const config = useConfigStore.getState().appliedConfig;

    initEngines(enginesRef.current, config, state.position.x, state.position.y);

    // Register all custom event listeners and start the chronicle runner
    const cleanupEventHandlers = registerKovyEventHandlers(
      { enginesRef, frameStateRef: frameState, ctxRef },
      config,
    );

    // Init memory engine
    initMemoryEngine(config.memory, config.privacy).then(() => {
      if (!mountedRef.current) return;
      frameState.current.memoryInitialized = true;
    });

    // Init entity store founder
    useEntityStore.getState().initFounder();

    // Load monitor geometry for per-entity display confinement
    import("@tauri-apps/api/window").then(async ({ availableMonitors, primaryMonitor }) => {
      if (!mountedRef.current) return;
      try {
        const [mons, primary] = await Promise.all([availableMonitors(), primaryMonitor()]);
        const monInfos: MonitorInfoUtil[] = mons.map((m, i) => {
          const sf = m.scaleFactor ?? 1;
          return {
            name: m.name ?? `monitor_${i}`,
            x: m.position.x / sf,
            y: m.position.y / sf,
            width: m.size.width / sf,
            height: m.size.height / sf,
            scaleFactor: sf,
          };
        });
        const vd = monInfos.length > 0
          ? computeVirtualDesktop(monInfos)
          : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
        const primaryIdx = primary
          ? Math.max(0, mons.findIndex(m => m.name === primary.name))
          : 0;
        monitorsRef.current = {
          monitors: monInfos,
          virtualDesktop: vd,
          primaryIndex: primaryIdx,
          prevDisplayMonitors: new Map(),
        };
      } catch { /* not in Tauri */ }
    }).catch(() => { kovyLog.warn("Monitor geometry loading failed (not in Tauri?)"); });

    return () => {
      disposeEngines(enginesRef.current);

      mountedRef.current = false;

      cleanupEventHandlers();

      destroyMemoryEngine();
      frameState.current.memoryInitialized = false;
    };
  }, [store]);

  // Setup canvas and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeRaf = 0;
    const resize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        store.getState().setScreenSize(canvas.width, canvas.height);
      });
    };

    resize();
    window.addEventListener("resize", resize);

    ctxRef.current = canvas.getContext("2d");
    rendererRef.current = new KovyCharacterRenderer(canvas, appliedConfig.appearance);

    return () => {
      window.removeEventListener("resize", resize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      rendererRef.current?.destroy();
    };
  }, []);

  // Update renderer config when appearance changes
  useEffect(() => {
    rendererRef.current?.updateConfig(appliedConfig.appearance);
  }, [appliedConfig.appearance]);

  // Listen for motion analysis results from Tauri backend
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u = await listen<{
          regions: MotionRegion[];
          captureWidth?: number;
          captureHeight?: number;
          monitorWidth?: number;
          monitorHeight?: number;
        }>(
          "motion-analysis",
          (event) => {
            if (!enginesRef.current.motion) return;
            const state = store.getState();
            if (state.isPaused || state.isPrivacyPaused) return;

            const cfg = useConfigStore.getState().appliedConfig;
            const regions = event.payload.regions;

            // Handle empty regions — clear stale targets
            if (!regions || regions.length === 0) {
              state.setRawRegions([]);
              const result = enginesRef.current.motion.clearStaleTargets(1 / cfg.vision.analysisFps);
              state.setActiveTarget(result.bestTarget);
              state.setCandidateTargets(result.targets);
              return;
            }

            // Compute the DPI scale factor between the physical capture
            // resolution and the logical monitor dimensions. On high-DPI
            // displays (e.g., 4K at 150% scaling), xcap captures at
            // physical resolution (3840×2160) but the overlay canvas uses
            // logical pixels (2560×1440). Without this correction, motion
            // regions near the screen edges map beyond the logical bounds
            // and get clipped — "some of the monitor isn't being captured."
            const captureW = event.payload.captureWidth ?? 0;
            const captureH = event.payload.captureHeight ?? 0;
            const monW = event.payload.monitorWidth ?? captureW;
            const monH = event.payload.monitorHeight ?? captureH;
            const dpiScaleX = monW > 0 && captureW > 0 ? monW / captureW : 1;
            const dpiScaleY = monH > 0 && captureH > 0 ? monH / captureH : 1;

            // Store raw regions with screen-scaled bounding boxes for overlay rendering.
            // Map: frame coords → physical capture coords → logical (canvas) coords
            const scale = cfg.vision.analysisScale;
            const scaledRegions = regions.map(r => ({
              ...r,
              centroid: {
                x: (r.centroid.x / scale) * dpiScaleX,
                y: (r.centroid.y / scale) * dpiScaleY,
              },
              boundingBox: {
                x: (r.boundingBox.x / scale) * dpiScaleX,
                y: (r.boundingBox.y / scale) * dpiScaleY,
                w: (r.boundingBox.w / scale) * dpiScaleX,
                h: (r.boundingBox.h / scale) * dpiScaleY,
              },
            }));
            state.setRawRegions(scaledRegions);

            // Also scale the regions passed to the motion engine so target
            // tracking works in logical pixel space (matching cursor coords
            // and screen dimensions).
            const logicalRegions = regions.map(r => ({
              ...r,
              centroid: {
                x: r.centroid.x / scale * dpiScaleX,
                y: r.centroid.y / scale * dpiScaleY,
              },
              boundingBox: {
                x: r.boundingBox.x / scale * dpiScaleX,
                y: r.boundingBox.y / scale * dpiScaleY,
                w: r.boundingBox.w / scale * dpiScaleX,
                h: r.boundingBox.h / scale * dpiScaleY,
              },
            }));
            const result = enginesRef.current.motion.processRegions(
              logicalRegions,
              1 / cfg.vision.analysisFps,
              cfg.vision,
              state.cursorPosition,
              state.screenWidth,
              state.screenHeight
            );
            state.setActiveTarget(result.bestTarget);
            state.setCandidateTargets(result.targets);
            state.setAnalysisActive(true);
          }
        );
        unlisten = u;
      } catch {
        console.log("Kovy: Running in demo mode (no Tauri backend)");
      }
    }

    setupListener();
    return () => { unlisten?.(); };
  }, [appliedConfig.vision]);

  // Track cursor position
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      store.getState().setCursorPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // --- Overlay self-detection mask (multi-entity) ---
  // When the overlay is visible to screen capture (privacy.hideFromCapture === false),
  // every rendered entity (founder + siblings) would be detected as motion by Kovy's
  // analyzer. Send each visible entity's bounding box (in canvas / virtual-desktop
  // physical coords) to the backend at a throttled rate so the analyzer zeroes out diff
  // inside all of them. The padding scales with appearance.size to cover the body,
  // emotes, and small particles, plus headroom for movement between updates. When hidden
  // from capture, the backend ignores the overlay entirely (WDA_EXCLUDEFROMCAPTURE) so
  // no mask is needed.
  useEffect(() => {
    let lastKey = "";
    const interval = setInterval(() => {
      const cfg = useConfigStore.getState().appliedConfig;
      if (cfg.privacy.hideFromCapture) return; // overlay invisible to analyzer — no mask needed
      const size = cfg.appearance.size;
      const entities = useEntityStore.getState().getAllEntities();
      const rects = computeEntityMaskRects(
        entities.map((e) => ({
          x: e.runtime.position.x,
          y: e.runtime.position.y,
          visible: e.runtime.isVisible,
        })),
        size,
      );
      // Skip IPC if the set of rects hasn't moved meaningfully (coords are
      // rounded, so key equality covers sub-pixel jitter) — saves bandwidth.
      const key = maskRectsKey(rects);
      if (key === lastKey) return;
      lastKey = key;
      setOverlayMasks(rects);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Main animation loop with real FPS capping and performance controls
  const animate = useCallback((timestamp: number) => {
    const state = store.getState();
    // Use preview config ref for live preview support — falls back to applied
    const config = previewConfigRef.current;
    
    // Check if engines are initialized
    const engines = enginesRef.current;
    if (!rendererRef.current || !engines.behavior || !engines.movement) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Cache entity store state once per frame (avoids 8+ redundant getState() calls)
    const entityState = useEntityStore.getState();

    try {

    // Safety: re-derive context if missing
    if (!ctxRef.current && canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d");
    }

    // Delta time
    if (frameState.current.lastTime === 0) frameState.current.lastTime = timestamp;
    const dt = Math.min((timestamp - frameState.current.lastTime) / 1000, 0.1);
    frameState.current.lastTime = timestamp;

    // FPS tracking + diagnostics recording
    fpsCounterRef.current.frames++;
    if (timestamp - fpsCounterRef.current.lastCheck > 1000) {
      const fps = fpsCounterRef.current.frames;
      state.setCurrentFps(fps);
      fpsCounterRef.current.frames = 0;
      fpsCounterRef.current.lastCheck = timestamp;
      // Diagnostics: record FPS sample once per second
      recordFps(fps);
      recordTargetCount(state.candidateTargets.length, state.activeTarget?.score ?? 0);
    }

    // Sync diagnostics + audio + OCR + logLevel + bond config each frame (cheap flag checks)
    setDiagnosticsEnabled(config.privacy.diagnosticsOptIn);
    setAudioVolume(config.audio.volume);

    // Sync active sound pack with the current config (supports live preview changes)
    if (engines.soundPack && engines.soundPack.getState().activePackId !== config.soundPack.activePackId) {
      engines.soundPack.setActivePack(config.soundPack.activePackId);
      setSoundPack(engines.soundPack.getActivePack());
    }
    // Sync active skin pack with the current config (supports live preview changes)
    if (engines.skinPack) {
      const spState = engines.skinPack.getState();
      if (spState.activePackId !== config.skinPack.activePackId) {
        engines.skinPack.loadCustomPacks(config.skinPack.customPacks as SkinPack[]);
        engines.skinPack.setActivePack(config.skinPack.activePackId);
      }
    }
    updateOcrConfig(config.vision, config.privacy);
    setLogLevel(config.advanced.logLevel);
    enginesRef.current.bond?.updateConfig(config.bond);
    enginesRef.current.interaction?.setInteractionRadius(config.bond.interactionRadius);
    enginesRef.current.interaction?.setPokeStartleChance(config.bond.pokeStartleChance);

    // Skip frame if paused, asleep (with reduced rendering), or not visible
    if (!state.isVisible) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Real FPS cap: use both appearance.renderFpsCap and performance.maxRenderFps
    const effectiveFpsCap = Math.min(
      config.appearance.renderFpsCap,
      config.performance.maxRenderFps
    );
    const frameInterval = 1000 / effectiveFpsCap;
    const timeSinceLastRender = timestamp - frameState.current.lastRenderTime;

    // Frame skipping: if enabled and we're behind, skip this frame
    if (config.performance.frameSkipping && timeSinceLastRender < frameInterval * 0.8) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // Low-power idle mode: reduce FPS when Kovy is idle/perched/napping
    const isIdleState = state.behaviorState === "idle_float" ||
      state.behaviorState === "perch" ||
      state.behaviorState === "nap" ||
      state.behaviorState === "meditate" ||
      state.behaviorState === "play_dead";
    const lowPowerActive = config.performance.lowPowerIdle && isIdleState;
    const lowPowerFpsCap = lowPowerActive ? Math.max(15, effectiveFpsCap / 2) : effectiveFpsCap;
    const lowPowerInterval = 1000 / lowPowerFpsCap;

    if (timeSinceLastRender < lowPowerInterval) {
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    frameState.current.lastRenderTime = timestamp;

    // If paused, still render but don't update engines
    if (state.isPaused || state.isPrivacyPaused) {
      // Just re-render the last known state at reduced rate
      if (rendererRef.current) {
        const pausedSkinPack = engines.skinPack && config.skinPack.activePackId !== "default"
          ? engines.skinPack.getActivePack()
          : null;
        const renderState: KovyRenderState = {
          position: state.position,
          velocity: { x: 0, y: 0 },
          squashStretch: { x: 1, y: 1 },
          surfaceMood: state.surfaceMood,
          behaviorState: state.behaviorState,
          blinkState: rendererRef.current.getBlinkState(),
          glowPulse: state.glowPulse,
          eyeTarget: state.eyeTarget,
          isAsleep: state.isAsleep || state.behaviorState === "nap" || state.behaviorState === "meditate" || state.behaviorState === "play_dead",
          time: timestamp / 1000,
          moodToColor: config.mood.moodToColor,
          moodToParticles: config.mood.moodToParticles,
          eyeStyle: pausedSkinPack?.eyeStyle ?? config.appearance.eyeStyle,
          bodyStyle: pausedSkinPack?.bodyStyle ?? config.appearance.bodyStyle,
        };
        rendererRef.current.render(renderState, dt);
      }
      animFrameRef.current = requestAnimationFrame(animate);
      return;
    }

    // --- Memory Engine update (throttled to ~1/s) ---
    updateMemoryConfig(config.memory, config.privacy);
    frameState.current.memoryUpdateAccum += dt;
    if (frameState.current.memoryInitialized && frameState.current.memoryUpdateAccum >= 1.0) {
      frameState.current.memoryUpdateAccum = 0;
      const motionAct = engines.motion?.getMotionActivity() ?? 0;
      updateMemoryEngine(
        1.0, config.memory, state.surfaceMood,
        state.internalMood.stimulation, motionAct, state.isInteracting
      );
    }

    // --- Memory influence refresh (every 60s) ---
    frameState.current.memoryInfluenceAccum += dt;
    if (frameState.current.memoryInitialized && frameState.current.memoryInfluenceAccum >= 60) {
      frameState.current.memoryInfluenceAccum = 0;
      getMemoryInfluence("kovy-prime").then(inf => { if (!mountedRef.current) return; engines.cachedMemoryInfluence = inf; });
    }

    // --- Circadian Engine update (throttled to ~1/s) ---
    frameState.current.circadianUpdateAccum += dt;
    if (engines.circadian && config.circadian.enabled && frameState.current.circadianUpdateAccum >= 1.0) {
      frameState.current.circadianUpdateAccum = 0;
      const motionAct = engines.motion?.getMotionActivity() ?? 0;
      const topScore = state.activeTarget?.score ?? 0;
      engines.cachedCircadianOutput = engines.circadian.update(
        1.0, config.circadian, motionAct, topScore
      );
    }

    // --- Weather Engine update (throttled to ~1/s) ---
    frameState.current.weatherUpdateAccum += dt;
    if (engines.weather && config.weather.enabled && frameState.current.weatherUpdateAccum >= 1.0) {
      frameState.current.weatherUpdateAccum = 0;
      const prevWeather = engines.weather.getState().current;
      engines.weather.update(1.0, {
        enabled: config.weather.enabled,
        changeInterval: config.weather.changeInterval,
        intensity: config.weather.intensity,
        allowedTypes: config.weather.allowedTypes,
      });
      const newWeather = engines.weather.getState().current;
      if (newWeather !== prevWeather && engines.stats && config.stats.enabled) {
        engines.stats.recordWeatherChange();
      }
    }

    // --- App Profile detection (throttled to ~3s) ---
    frameState.current.appProfileUpdateAccum += dt;
    if (engines.appProfile && config.appProfile.enabled && config.appProfile.autoDetect && frameState.current.appProfileUpdateAccum >= 3.0) {
      frameState.current.appProfileUpdateAccum = 0;
      getForegroundApp().then((appInfo) => {
        if (!mountedRef.current) return;
        const appName = appInfo.processName ?? appInfo.windowTitle;
        if (!appName) return;
        const profile = engines.appProfile?.setActiveApp(appName);
        if (profile?.overrides.hideKovy) {
          store.getState().setVisible(false);
        } else if (profile && !profile.overrides.hideKovy) {
          store.getState().setVisible(true);
        }
      }).catch(() => { kovyLog.warn("App profile detection failed"); });
    }

    // --- Foreground window bounds polling for focus targeting (throttled to ~1s) ---
    frameState.current.foregroundBoundsAccum += dt;
    if (frameState.current.foregroundBoundsAccum >= 1.0) {
      frameState.current.foregroundBoundsAccum = 0;
      getForegroundApp().then((appInfo) => {
        if (!mountedRef.current) return;
        const vd = monitorsRef.current.virtualDesktop;
        if (appInfo.windowBounds) {
          const center = toOverlayLocalPosition({
            x: appInfo.windowBounds.x + appInfo.windowBounds.width / 2,
            y: appInfo.windowBounds.y + appInfo.windowBounds.height / 2,
          }, vd);
          frameState.current.cachedFocusTarget = {
            windowCenter: center,
            cursorPosition: state.cursorPosition,
            isGamingMode: engines.cachedGamingOutput.enabled,
            config: config.focusTarget,
          };
        } else {
          frameState.current.cachedFocusTarget = {
            windowCenter: null,
            cursorPosition: state.cursorPosition,
            isGamingMode: engines.cachedGamingOutput.enabled,
            config: config.focusTarget,
          };
        }
      }).catch(() => {});
    }

    // --- Ritual Engine update (throttled to ~5s) ---
    frameState.current.ritualUpdateAccum += dt;
    if (engines.ritual && config.ritual.enabled && frameState.current.ritualUpdateAccum >= 5.0) {
      frameState.current.ritualUpdateAccum = 0;
      const newlyAvailable = engines.ritual.update(5.0);
      for (const ritual of newlyAvailable) {
        // Check if this ritual is enabled in config
        const configKey = ritual.id as keyof typeof config.ritual;
        if (configKey in config.ritual && !config.ritual[configKey]) continue;

        // Trigger appropriate behavior based on ritual type
        const mood = state.surfaceMood;
        let behavior: "celebrate" | "stretch" | "nap" | "idle_float" | "wander" = "idle_float";
        if (ritual.id === "morning_greeting" || ritual.id === "return_celebration") behavior = "celebrate";
        else if (ritual.id === "afternoon_stretch") behavior = "stretch";
        else if (ritual.id === "evening_winddown" || ritual.id === "midnight_dream") behavior = "nap";
        else if (ritual.id === "lunch_companion") behavior = "wander";
        else if (ritual.id === "weekend_special") behavior = "celebrate";

        engines.ritual.performRitual(ritual.id, mood, behavior);
        engines.behavior?.forceState(behavior);

        // Record to journal + stats
        if (engines.journal && config.journal.enabled) {
          engines.journal.recordRitual(ritual.title, ritual.icon, mood, behavior);
        }
        if (engines.stats && config.stats.enabled) {
          engines.stats.recordRitual();
        }
      }
    }

    // --- Mood Engine ---
    if (config.mood.enabled) {
      const stimuli: MoodStimuli = {
        motionActivity: engines.motion?.getMotionActivity() ?? 0,
        hasNovelTarget: engines.motion?.hasNovelTarget() ?? false,
        userInteracted: state.isInteracting,
        targetScore: state.activeTarget?.score ?? 0,
        boredomRate: config.behavior.boredomRate,
        audioEnergy: frameState.current.audioReactivityOutput.enabled && config.audioReactivity.feedMood
          ? frameState.current.audioReactivityOutput.energy
          : undefined,
      };

      let newMood = updateMoodState(
        state.internalMood, dt, config.mood, stimuli,
        engines.cachedMemoryInfluence, engines.cachedCircadianOutput
      );
      // Apply founder personality + family influence to mood (parity with siblings)
      const founderPers = entityState.getEntityMeta(FOUNDER_ID)?.personality;
      if (founderPers) {
        newMood = applyPersonalityToMood(newMood, founderPers, dt);
      }
      const founderFamilyInf = engines.cachedFamilyInfluences.get(FOUNDER_ID) ?? null;
      if (founderFamilyInf) {
        newMood = applyFamilyToMood(newMood, founderFamilyInf, dt);
      }
      // Apply bond mood modifiers (v5.7)
      if (engines.bond && config.bond.enabled) {
        const bondState = engines.bond.getState();
        const bondMod = getBondMoodModifier(bondState.bondLevel);
        newMood.trust = clamp(newMood.trust + bondMod.trustBoost * dt, 0, 1);
        newMood.comfort = clamp(newMood.comfort + bondMod.comfortBoost * dt, 0, 1);
      }
      // Apply weather mood influence (v6.1)
      if (engines.weather && config.weather.enabled) {
        const weatherInf = engines.weather.getMoodInfluence();
        newMood.curiosity = clamp(newMood.curiosity + weatherInf.curiosity * dt, 0, 1);
        newMood.comfort = clamp(newMood.comfort + weatherInf.comfort * dt, 0, 1);
        newMood.stimulation = clamp(newMood.stimulation + weatherInf.energy * dt, 0, 1);
      }
      // Apply habitat objects mood influence (v6.1)
      if (engines.habitatObjects && config.habitatObjects.enabled) {
        const habInf = engines.habitatObjects.getMoodInfluence(state.position);
        newMood.curiosity = clamp(newMood.curiosity + habInf.curiosity * dt, 0, 1);
        newMood.comfort = clamp(newMood.comfort + habInf.comfort * dt, 0, 1);
        newMood.stimulation = clamp(newMood.stimulation + habInf.energy * dt, 0, 1);
      }
      // Apply toy mood influence (v8.1)
      if (engines.toy && config.toys.enabled) {
        const toyMood = engines.toy.getMoodDeltas(state.position, state.surfaceMood);
        if (toyMood.excited) newMood.stimulation = clamp(newMood.stimulation + toyMood.excited * dt, 0, 1);
        if (toyMood.calm) newMood.comfort = clamp(newMood.comfort + toyMood.calm * dt, 0, 1);
        if (toyMood.playful) newMood.curiosity = clamp(newMood.curiosity + toyMood.playful * dt, 0, 1);
        if (toyMood.content) newMood.comfort = clamp(newMood.comfort + toyMood.content * dt, 0, 1);
        if (toyMood.curious) newMood.curiosity = clamp(newMood.curiosity + toyMood.curious * dt, 0, 1);
      }
      const newSurface = deriveSurfaceMood(newMood, config.mood);
      state.setInternalMood(newMood);
      state.setSurfaceMood(newSurface);
    }

    const moodMods = getMoodModifiers(state.surfaceMood);

    // --- Interaction + Bond Engine (v5.7) ---
    if (engines.interaction && engines.bond && config.bond.enabled) {
      const interaction = engines.interaction.update(
        dt,
        state.cursorPosition,
        state.position,
        state.isVisible,
      );
      if (interaction) {
        if (interaction.type === "poke") {
          engines.bond.recordPoke();
          if (engines.stats && config.stats.enabled) engines.stats.recordPoke();
          // Poke can trigger startle or celebrate
          if (engines.interaction.shouldPokeStartle()) {
            engines.behavior?.forceState("startle", {
              position: state.position,
              screenWidth: state.screenWidth,
              screenHeight: state.screenHeight,
              cursorPosition: state.cursorPosition,
              activeTarget: state.activeTarget,
              candidateTargets: state.candidateTargets,
              moodModifiers: moodMods,
              surfaceMood: state.surfaceMood,
              config: config.behavior,
              perchPosition: state.perchPosition,
              isInteracting: state.isInteracting,
              habitat: config.habitat ?? DEFAULT_HABITAT,
              memoryInfluence: engines.cachedMemoryInfluence,
              familyInfluence: engines.cachedFamilyInfluences.get(FOUNDER_ID) ?? null,
              circadianOutput: engines.cachedCircadianOutput,
            });
          } else {
            engines.behavior?.forceState("celebrate");
          }
        } else if (interaction.type === "hover") {
          engines.bond.recordHover();
          if (engines.stats && config.stats.enabled) engines.stats.recordHover();
          if (config.audio.kovySounds) {
            playInteractionSound("hover", config.audio);
          }
        } else if (interaction.type === "swipe") {
          engines.bond.recordSwipe();
          if (engines.stats && config.stats.enabled) engines.stats.recordSwipe();
          if (config.audio.kovySounds) {
            playInteractionSound("swipe", config.audio);
          }
        } else if (interaction.type === "return") {
          // Return celebration — Kovy is happy to see you again
          engines.behavior?.forceState("celebrate");
          // Record bond interaction (counts as a hover for bond points)
          engines.bond.recordHover();
          if (engines.stats && config.stats.enabled) engines.stats.recordHover();
        }
      }

      // Periodic bond tick for day rollover (~1/s)
      frameState.current.bondTickAccum += dt;
      if (frameState.current.bondTickAccum >= 1.0) {
        frameState.current.bondTickAccum = 0;
        engines.bond.tick();
        // Milestone: record streak
        if (engines.milestone && config.milestone.enabled) {
          const bondState = engines.bond.getState();
          engines.milestone.recordStreak(bondState.streakDays);
          engines.milestone.recordBondLevel(bondState.bondLevel);
          // Journal: record bond level change (v6.1)
          if (engines.journal && config.journal.enabled && bondState.bondLevel !== frameState.current.prevBondLevel) {
            engines.journal.recordBondLevel(bondState.bondLevel, bondState.totalPokes + bondState.totalHovers + bondState.totalSwipes, state.surfaceMood);
            frameState.current.prevBondLevel = bondState.bondLevel;
          }
        }
      }

      // Milestone: record interactions (exclude 'return', 'double_click', 'right_click')
      if (engines.milestone && config.milestone.enabled && interaction &&
          (interaction.type === "poke" || interaction.type === "hover" || interaction.type === "swipe")) {
        engines.milestone.recordInteraction(interaction.type);
      }
    }

    // --- Gaming Engine update ---
    if (engines.gaming && config.gaming.enabled) {
      engines.cachedGamingOutput = engines.gaming.update(
        dt, config.gaming,
        state.candidateTargets, state.activeTarget,
        engines.motion?.getMotionActivity() ?? 0,
        state.position, state.velocity,
      );
      // Audio reactivity → gaming excitement boost (v7.0) — gated by feedGaming
      if (frameState.current.audioReactivityOutput.enabled && config.audioReactivity.feedGaming && frameState.current.audioReactivityOutput.beatDetected) {
        engines.cachedGamingOutput = {
          ...engines.cachedGamingOutput,
          excitement: Math.min(1, engines.cachedGamingOutput.excitement + 0.15),
        };
      }
      // Track gaming session for journal (v6.1)
      if (engines.cachedGamingOutput.enabled && !frameState.current.gamingActive) {
        frameState.current.gamingActive = true;
        frameState.current.gamingStartTime = timestamp;
        frameState.current.gamingPeakExcitement = 0;
      }
      if (frameState.current.gamingActive) {
        frameState.current.gamingPeakExcitement = Math.max(
          frameState.current.gamingPeakExcitement,
          engines.cachedGamingOutput.excitement,
        );
      }
    } else if (engines.gaming && !config.gaming.enabled) {
      engines.cachedGamingOutput = { ...NULL_GAMING_OUTPUT };
    }
    // Record gaming session end to journal + stats
    if (!engines.cachedGamingOutput.enabled && frameState.current.gamingActive) {
      const duration = (timestamp - frameState.current.gamingStartTime) / 1000;
      if (engines.journal && config.journal.enabled && duration > 10) {
        engines.journal.recordGamingSession(duration, frameState.current.gamingPeakExcitement, state.surfaceMood);
      }
      if (engines.stats && config.stats.enabled) {
        engines.stats.recordGamingSession();
      }
      frameState.current.gamingActive = false;
    }

    // Drag engine (per-frame, before behavior engine so dragOutput is current)
    if (engines.drag && config.drag.enabled) {
      frameState.current.dragOutput = engines.drag.update(dt, config.drag);
    }

    // --- Behavior Engine ---
    // Update focus target cursor position and gaming mode every frame (cheap)
    if (frameState.current.cachedFocusTarget) {
      frameState.current.cachedFocusTarget.cursorPosition = state.cursorPosition;
      frameState.current.cachedFocusTarget.isGamingMode = engines.cachedGamingOutput.enabled;
    }
    // Use monitor bounds for screen dimensions when in current-monitor mode
    const monBounds = state.currentMonitorBounds;
    const effectiveScreenW = monBounds ? monBounds.width : state.screenWidth;
    const effectiveScreenH = monBounds ? monBounds.height : state.screenHeight;

    // Per-entity display monitor confinement bounds
    const { monitors: availMons, virtualDesktop: vd, primaryIndex: primIdx, prevDisplayMonitors } = monitorsRef.current;

    let founderMinX = 0, founderMinY = 0;
    let founderMovMaxX = effectiveScreenW, founderMovMaxY = effectiveScreenH;
    if (availMons.length > 0) {
      const founderDisplayMonitor = entityState.getEntityMeta(FOUNDER_ID)?.displayMonitor ?? "global";
      const founderBounds = toOverlayLocalBounds(
        getEntityBounds(founderDisplayMonitor, availMons, vd, primIdx),
        vd
      );
      founderMinX = founderBounds.x;
      founderMinY = founderBounds.y;
      founderMovMaxX = founderBounds.x + founderBounds.width;
      founderMovMaxY = founderBounds.y + founderBounds.height;

      // Teleport to center of assigned monitor when displayMonitor changes
      const prevFDM = prevDisplayMonitors.get(FOUNDER_ID);
      if (prevFDM !== undefined && prevFDM !== founderDisplayMonitor) {
        const targetMon = resolveDisplayMonitor(founderDisplayMonitor, availMons, primIdx);
        const center = toOverlayLocalPosition(targetMon
          ? getMonitorCenter(targetMon)
          : { x: vd.x + vd.width / 2, y: vd.y + vd.height / 2 }, vd);
        state.setPosition(center);
        engines.movement?.setPosition(center.x, center.y);
      }
      prevDisplayMonitors.set(FOUNDER_ID, founderDisplayMonitor);
    }

    const habitat = config.habitat ?? DEFAULT_HABITAT;

    // Gaming hyper blend: modulate behavior config temporarily
    let effectiveBehavior = config.behavior;
    if (engines.cachedGamingOutput.enabled && engines.cachedGamingOutput.hyperBoost > 0.01) {
      const hb = engines.cachedGamingOutput.hyperBoost;
      const ab = engines.cachedGamingOutput.adaptiveBias;
      effectiveBehavior = {
        ...config.behavior,
        dwellTime: config.behavior.dwellTime * (1 - hb * 0.5),
        curiosityStrength: clamp(config.behavior.curiosityStrength + ab * 0.3, 0, 1),
        hyper: {
          ...config.behavior.hyper,
          dashCooldown: config.behavior.hyper.dashCooldown * (1 - hb * 0.3),
          chainDelay: config.behavior.hyper.chainDelay * (1 - hb * 0.2),
        },
      };
    }

    // Skip behavior updates while being dragged or apply release behavior
    const dragOut = frameState.current.dragOutput;
    const dragAction = resolveDragAction(dragOut);
    if (dragAction.type === "dragging") {
      engines.movement?.setPosition(dragAction.position.x, dragAction.position.y);
      state.setPosition(dragAction.position);
      state.setBehaviorState("perch");
      state.setStateTimer(0);
    } else if (dragAction.type === "release") {
      engines.behavior?.forceState(dragAction.behavior);
      window.dispatchEvent(new CustomEvent("kovy-drag-release"));
      frameState.current.dragOutput = { ...dragOut, releaseBehavior: null };
    }

    const behaviorResult = dragAction.type === "dragging"
      ? { newState: "perch" as const, targetPosition: dragAction.position, stateTimer: 0, newPerchPosition: null, dashActive: false }
      : engines.behavior.update(dt, {
      position: state.position,
      screenWidth: founderMovMaxX,
      screenHeight: founderMovMaxY,
      cursorPosition: state.cursorPosition,
      activeTarget: state.activeTarget,
      candidateTargets: state.candidateTargets,
      moodModifiers: moodMods,
      surfaceMood: state.surfaceMood,
      config: effectiveBehavior,
      perchPosition: state.perchPosition,
      isInteracting: state.isInteracting,
      habitat,
      memoryInfluence: engines.cachedMemoryInfluence,
      familyInfluence: engines.cachedFamilyInfluences.get(FOUNDER_ID) ?? null,
      circadianOutput: engines.cachedCircadianOutput,
      startleTriggered: engines.circadian?.shouldStartle(
        config.circadian,
        state.activeTarget?.score ?? 0,
        engines.cachedCircadianOutput,
      ) ?? false,
      predictedPoints: engines.cachedGamingOutput.predictedPoints,
      focusTarget: frameState.current.cachedFocusTarget,
    });

    // Track prev top score for startle detection
    frameState.current.prevTopScore = state.activeTarget?.score ?? 0;

    state.setBehaviorState(behaviorResult.newState);
    state.setStateTimer(behaviorResult.stateTimer);
    if (behaviorResult.newPerchPosition) {
      state.setPerchPosition(behaviorResult.newPerchPosition);
    }

    // --- Audio: play sounds on behavior state changes ---
    const streamSafe = config.general.streamSafe;
    if (behaviorResult.newState !== frameState.current.prevBehaviorState) {
      const isFocusSound = frameState.current.focusOutput.enabled;
      const isCelebrate = behaviorResult.newState === "celebrate";
      const isReaction = behaviorResult.newState === "startle" || behaviorResult.newState === "celebrate";
      const soundAllowed = !streamSafe &&
        !(frameState.current.focusOutput.enabled && frameState.current.focusOutput.suppressSound) &&
        (!isFocusSound || config.audio.focusSounds) &&
        (!isCelebrate || config.audio.celebrationSounds) &&
        (!isReaction || config.audio.emoteSounds);
      if (soundAllowed) {
        onBehaviorChange(
          frameState.current.prevBehaviorState,
          behaviorResult.newState,
          state.surfaceMood,
          config.audio
        );
      }
      recordBehaviorChange(frameState.current.prevBehaviorState, behaviorResult.newState);
      // Emote transition burst for founder (uses state.position since movement not yet computed)
      if (engines.emote && config.emote.enabled) {
        engines.emote.onBehaviorTransition(
          frameState.current.prevBehaviorState,
          behaviorResult.newState,
          FOUNDER_ID,
          state.position,
          config.emote,
        );
      }
      // Particle burst on behavior change
      if (config.appearance.particleBursts && !config.appearance.reducedMotion) {
        const ctx = ctxRef.current;
        if (ctx) {
          if (!engines.particleBurst) engines.particleBurst = new ParticleBurstRenderer();
          const burstType: "confetti" | "sparkle" | "heart" | "dust" = behaviorResult.newState === "celebrate" ? "confetti"
            : behaviorResult.newState === "startle" ? "sparkle"
            : behaviorResult.newState === "nap" || behaviorResult.newState === "dream" ? "heart"
            : behaviorResult.newState === "dance" ? "sparkle"
            : behaviorResult.newState === "meditate" ? "heart"
            : behaviorResult.newState === "investigate" ? "sparkle"
            : behaviorResult.newState === "follow_burst" ? "sparkle"
            : "dust";
          engines.particleBurst.spawnBurst(
            state.position.x, state.position.y - 20,
            burstType,
            `hsla(${moodMods.colorHue}, 70%, 70%, 0.8)`,
          );
        }
      }
      frameState.current.prevBehaviorState = behaviorResult.newState;
      // Milestone: record behavior state
      if (engines.milestone && config.milestone.enabled) {
        engines.milestone.recordBehaviorState(behaviorResult.newState);
      }
    }

    // --- Diagnostics: record mood changes ---
    recordMoodChange(state.surfaceMood);
    // Milestone: record mood
    if (engines.milestone && config.milestone.enabled) {
      engines.milestone.recordMood(state.surfaceMood);
    }
    // Journal: record mood shift (v6.1)
    if (engines.journal && config.journal.enabled && state.surfaceMood !== frameState.current.prevSurfaceMood) {
      engines.journal.recordMoodShift(frameState.current.prevSurfaceMood, state.surfaceMood);
      frameState.current.prevSurfaceMood = state.surfaceMood;
    }

    // --- OCR: run on raw regions (throttled internally) ---
    if (state.rawRegions.length > 0) {
      tryRunOcr(state.rawRegions, config.vision);
    }

    // --- Movement Controller with target smoothing ---
    const smoothing = config.vision.targetSmoothing;
    let smoothedTarget = behaviorResult.targetPosition;
    if (smoothedTarget && smoothing > 0 && state.targetPosition) {
      smoothedTarget = {
        x: state.targetPosition.x + (smoothedTarget.x - state.targetPosition.x) * (1 - smoothing),
        y: state.targetPosition.y + (smoothedTarget.y - state.targetPosition.y) * (1 - smoothing),
      };
    }
    // Toy attraction: override target toward toy when toys enabled and no strong motion target
    if (engines.toy && config.toys.enabled && (!state.activeTarget || (state.activeTarget.score ?? 0) < 0.3)) {
      const toyTarget = engines.toy.getAttractionTarget(state.position);
      if (toyTarget) {
        smoothedTarget = toyTarget;
      }
    }

    // Reduced motion: limit movement speed
    const speedMult = config.appearance.reducedMotion
      ? moodMods.speedMultiplier * config.behavior.attractionStrength * 0.4
      : moodMods.speedMultiplier * config.behavior.attractionStrength;

    // --- Movement Controller with target smoothing ---
    // Skip movement physics while being dragged — position is set directly from dragOutput
    let movement = dragAction.type === "dragging"
      ? { position: dragAction.position, velocity: { x: 0, y: 0 }, squashStretch: { x: 1, y: 1 }, leanAngle: 0, landingImpact: 0 }
      : engines.movement.update(
      dt,
      smoothedTarget,
      speedMult,
      founderMovMaxX,
      founderMovMaxY,
      {
        dashActive: behaviorResult.dashActive,
        dashStrength: config.behavior.hyper?.dashStrength ?? 0.7,
        minX: founderMinX,
        minY: founderMinY,
      }
    );

    // --- Dream Engine update ---
    if (engines.dream && config.dream.enabled) {
      engines.cachedDreamOutput = engines.dream.update(
        dt,
        config.dream,
        movement.position,
        state.behaviorState,
        engines.cachedCircadianOutput.dreamIntensity,
        state.surfaceMood,
      );
    } else if (engines.dream) {
      engines.cachedDreamOutput = { ...NULL_DREAM_OUTPUT };
    }

    // --- Eye tracking ---
    let eyeTarget = { x: 0, y: 0 };
    if (state.activeTarget) {
      const dx = state.activeTarget.position.x - movement.position.x;
      const dy = state.activeTarget.position.y - movement.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        eyeTarget = { x: dx / dist, y: dy / dist };
      }
    } else {
      const dx = state.cursorPosition.x - movement.position.x;
      const dy = state.cursorPosition.y - movement.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 50) {
        eyeTarget = { x: (dx / dist) * 0.5, y: (dy / dist) * 0.5 };
      }
    }

    // --- Glow pulse ---
    const glowPulse = (Math.sin(timestamp / 1000 * 1.5) * 0.5 + 0.5) * moodMods.glowIntensity;

    // --- Render aurora background BEHIND everything ---
    rendererRef.current.clearCanvas();
    renderBackgroundLayers({
      engines,
      config,
      ctx: ctxRef.current,
      dt,
      timestamp,
      effectiveScreenW,
      effectiveScreenH,
      surfaceMood: state.surfaceMood,
      movementPosition: movement.position,
      moodHue: moodMods.colorHue,
      weatherParticlesRef,
      dreamOutput: engines.cachedDreamOutput,
    });
    const dreamOut = engines.cachedDreamOutput;

    // --- Render founder ---
    const founderVisual = entityState.getEntityMeta(FOUNDER_ID)?.visual;
    const founderPersonality = entityState.getEntityMeta(FOUNDER_ID)?.personality;
    // Resolve skin pack overrides (v6.1)
    const activeSkinPack = engines.skinPack && config.skinPack.activePackId !== "default"
      ? engines.skinPack.getActivePack()
      : null;
    const skinOverrideColors = activeSkinPack && !founderVisual?.customColorsEnabled;
    const founderRenderState: KovyRenderState = {
      position: movement.position,
      velocity: movement.velocity,
      squashStretch: movement.squashStretch,
      surfaceMood: state.surfaceMood,
      behaviorState: state.behaviorState,
      blinkState: rendererRef.current.getBlinkState(),
      glowPulse,
      eyeTarget,
      isAsleep: state.isAsleep || state.behaviorState === "nap" || state.behaviorState === "meditate" || state.behaviorState === "play_dead",
      time: timestamp / 1000,
      moodToColor: config.mood.moodToColor,
      moodToParticles: config.mood.moodToParticles,
      eyeStyle: activeSkinPack?.eyeStyle ?? config.appearance.eyeStyle,
      bodyStyle: activeSkinPack?.bodyStyle ?? config.appearance.bodyStyle,
      hueOffset: founderPersonality?.colorHueOffset,
      sizeOffset: founderPersonality?.sizeOffset,
      // Gaming Mode deformation
      gamingExcitement: engines.cachedGamingOutput.excitement,
      elasticity: engines.cachedGamingOutput.elasticity,
      freeformWobble: engines.cachedGamingOutput.freeformWobble,
      predictionConfidence: engines.cachedGamingOutput.predictionConfidence,
      // Circadian dream + startle
      dreamIntensity: engines.cachedCircadianOutput.dreamIntensity,
      isStartled: state.behaviorState === "startle",
      // Movement feel
      leanAngle: movement.leanAngle,
      landingImpact: movement.landingImpact,
      showName: config.family.showFamilyNames,
      name: entityState.getEntityMeta(FOUNDER_ID)?.name || "Kovy",
      // Per-entity visual customization (skin pack overrides if no custom colors)
      customColorsEnabled: founderVisual?.customColorsEnabled ?? !!skinOverrideColors,
      primaryColor: founderVisual?.customColorsEnabled ? founderVisual?.primaryColor : (activeSkinPack?.primaryColor ?? founderVisual?.primaryColor),
      secondaryColor: founderVisual?.customColorsEnabled ? founderVisual?.secondaryColor : (activeSkinPack?.secondaryColor ?? founderVisual?.secondaryColor),
      toneMode: founderVisual?.customColorsEnabled ? founderVisual?.toneMode : (activeSkinPack?.toneMode ?? founderVisual?.toneMode),
      entityOpacity: founderVisual?.opacity,
      rimLightIntensity: founderVisual?.rimLightIntensity ?? activeSkinPack?.rimLightIntensity ?? 0.3,
      // Bond warmth aura (v6.0): 0 at stranger, 1 at best_friend
      bondWarmth: engines.bond && config.bond.enabled
        ? BOND_WARMTH_MAP[engines.bond.getState().bondLevel] ?? 0
        : 0,
      // Growth scale (v7.0): multiplicative size from GrowthEngine
      growthScale: frameState.current.growthOutput.enabled
        ? frameState.current.growthOutput.sizeMultiplier
        : 1,
      // Mood posture (v7.0): droop when sad/shy/overwhelmed, perk when excited/playful
      postureDroop: (() => {
        const m = state.surfaceMood;
        if (m === "shy" || m === "anxious" || m === "overwhelmed") return 0.12;
        if (m === "sleepy") return 0.08;
        if (m === "nostalgic") return 0.05;
        if (m === "excited" || m === "playful") return -0.06;
        if (m === "determined" || m === "content") return -0.03;
        return 0;
      })(),
      // Attention seeking (v7.0): wiggle after being idle for 30+ seconds, ramps up to 60s
      attentionWiggle: (() => {
        const isIdleBeh = state.behaviorState === "idle_float" || state.behaviorState === "perch";
        if (isIdleBeh) {
          frameState.current.idleDurationAccum += dt;
        } else {
          frameState.current.idleDurationAccum = 0;
        }
        const idleSecs = frameState.current.idleDurationAccum;
        if (idleSecs < 30) return 0;
        if (idleSecs > 60) return 1;
        return (idleSecs - 30) / 30;
      })(),
      // Gaming combo count (v7.0): visual escalation at high combos
      comboCount: engines.cachedGamingOutput.comboCount,
    };

    const ctx = ctxRef.current;
    if (ctx && dreamOut.colorWashIntensity > 0) {
      ctx.save();
      ctx.filter = `hue-rotate(${dreamOut.colorWashHue * dreamOut.colorWashIntensity}deg)`;
      rendererRef.current.renderEntity(founderRenderState, dt);
      ctx.restore();
    } else {
      rendererRef.current.renderEntity(founderRenderState, dt);
    }

    // --- Render accessories for founder ---
    if (config.appearance.accessoriesEnabled && !config.appearance.reducedMotion) {
      const ctx = ctxRef.current;
      if (ctx) {
        if (!engines.accessoryRenderer) engines.accessoryRenderer = new AccessoryRenderer(ctx);
        const weatherType = engines.weather?.getState().current;
        engines.accessoryRenderer.render(
          movement.position.x, movement.position.y,
          28 * config.appearance.size * (1 + (founderPersonality?.sizeOffset ?? 0)),
          state.surfaceMood, state.behaviorState,
          weatherType, timestamp / 1000,
          0.9, config.appearance.reducedMotion,
        );
      }
    }

    // --- Update and render particle bursts ---
    if (engines.particleBurst) {
      engines.particleBurst.update(dt);
      const burstCtx = ctxRef.current;
      if (burstCtx) engines.particleBurst.render(burstCtx);
    }

    // --- Update and render sibling entities ---
    const allEntities = entityState.getAllEntities();
    const siblings = entityState.getNonFounderEntities();

    if (siblings.length > 0 && engines.family) {
      // Family engine update (throttled by config interval)
      const familyInterval = (config.family.familyUpdateIntervalMs ?? 500) / 1000;
      frameState.current.familyUpdateAccum += dt;
      if (frameState.current.familyUpdateAccum >= familyInterval) {
        frameState.current.familyUpdateAccum = 0;
        engines.cachedFamilyInfluences = engines.family.update(
          familyInterval, allEntities, config.family.dynamics, habitat,
          frameState.current.relationsOutput.relations,
        );
      }

      // Family Scenes engine update (v6.1) — only when 2+ entities exist
      if (engines.familyScenes && config.familyScenes.enabled && allEntities.length >= 2) {
        const positions = new Map<string, { x: number; y: number }>();
        positions.set(FOUNDER_ID, movement.position);
        for (const sib of siblings) {
          positions.set(sib.meta.id, sib.runtime.position);
        }
        const activeScene = engines.familyScenes.update(
          familyInterval, allEntities.map(e => e.meta.id), positions, Date.now(),
          frameState.current.relationsOutput.relations,
        );
        // Record scene to journal when it starts (transition from null to active)
        if (activeScene && !frameState.current.prevSceneType) {
          if (engines.journal && config.journal.enabled) {
            engines.journal.recordFamilyEvent(activeScene.type, state.surfaceMood);
          }
        }
        frameState.current.prevSceneType = activeScene?.type ?? "";
      }

      // Collect all updates to perform one batch dispatch per frame
      const siblingUpdates: Record<string, Partial<typeof state>> = {};

      for (const sib of siblings) {
        // Ensure engines exist for this sibling
        if (!engines.siblings.has(sib.meta.id)) {
          engines.siblings.set(sib.meta.id, {
            behavior: new BehaviorEngine(),
            movement: new MovementController(),
            prevState: "idle_float",
          });
          // Milestone: first family member added
          if (engines.milestone && config.milestone.enabled) {
            engines.milestone.recordFamilyMemberAdded();
          }
        }
        const eng = engines.siblings.get(sib.meta.id)!;
        const sibRuntime = sib.runtime;
        const sibPersonality = sib.meta.personality;
        const sibFamilyInf = engines.cachedFamilyInfluences.get(sib.meta.id) ?? null;
        
        let newInternalMood = sibRuntime.internalMood;
        let newSurfaceMood = sibRuntime.surfaceMood;

        // Mood update with personality + family contagion
        if (config.mood.enabled) {
          const sibStimuli: MoodStimuli = {
            motionActivity: engines.motion?.getMotionActivity() ?? 0,
            hasNovelTarget: false,
            userInteracted: false,
            targetScore: 0,
            boredomRate: config.behavior.boredomRate,
          };
          let sibMood = updateMoodState(sibRuntime.internalMood, dt, config.mood, sibStimuli);
          sibMood = applyPersonalityToMood(sibMood, sibPersonality, dt);
          if (sibFamilyInf) sibMood = applyFamilyToMood(sibMood, sibFamilyInf, dt);
          newInternalMood = sibMood;
          newSurfaceMood = deriveSurfaceMood(sibMood, config.mood);
        }

        // Per-sibling display monitor confinement bounds
        let sibMinX = 0, sibMinY = 0;
        let sibMovMaxX = effectiveScreenW, sibMovMaxY = effectiveScreenH;
        if (availMons.length > 0) {
          const sibDisplayMonitor = sib.meta.displayMonitor ?? "global";
          const sibBounds = toOverlayLocalBounds(
            getEntityBounds(sibDisplayMonitor, availMons, vd, primIdx),
            vd
          );
          sibMinX = sibBounds.x;
          sibMinY = sibBounds.y;
          sibMovMaxX = sibBounds.x + sibBounds.width;
          sibMovMaxY = sibBounds.y + sibBounds.height;

          // Teleport to center of assigned monitor when displayMonitor changes
          const prevSibDM = prevDisplayMonitors.get(sib.meta.id);
          if (prevSibDM !== undefined && prevSibDM !== sibDisplayMonitor) {
            const targetMon = resolveDisplayMonitor(sibDisplayMonitor, availMons, primIdx);
            const center = toOverlayLocalPosition(targetMon
              ? getMonitorCenter(targetMon)
              : { x: vd.x + vd.width / 2, y: vd.y + vd.height / 2 }, vd);
            eng.movement.setPosition(center.x, center.y);
          }
          prevDisplayMonitors.set(sib.meta.id, sibDisplayMonitor);
        }

        // Behavior update
        const sibMoodMods = getMoodModifiers(newSurfaceMood);
        const sibBehavior = eng.behavior.update(dt, {
          position: sibRuntime.position,
          screenWidth: sibMovMaxX,
          screenHeight: sibMovMaxY,
          cursorPosition: state.cursorPosition,
          activeTarget: null,
          candidateTargets: [],
          moodModifiers: sibMoodMods,
          surfaceMood: newSurfaceMood,
          config: config.behavior,
          perchPosition: sibRuntime.perchPosition,
          isInteracting: false,
          habitat,
          memoryInfluence: null,
          familyInfluence: sibFamilyInf,
          circadianOutput: engines.cachedCircadianOutput,
          focusTarget: frameState.current.cachedFocusTarget,
        });

        // Movement update
        const sibSpeedMult = sibMoodMods.speedMultiplier * config.behavior.attractionStrength;
        const sibMovement = eng.movement.update(
          dt, sibBehavior.targetPosition, sibSpeedMult,
          sibMovMaxX, sibMovMaxY,
          { dashActive: sibBehavior.dashActive, dashStrength: config.behavior.hyper?.dashStrength ?? 0.7, minX: sibMinX, minY: sibMinY }
        );

        siblingUpdates[sib.meta.id] = {
          internalMood: newInternalMood,
          surfaceMood: newSurfaceMood,
          behaviorState: sibBehavior.newState,
          stateTimer: sibBehavior.stateTimer,
          perchPosition: sibBehavior.newPerchPosition ?? sibRuntime.perchPosition,
          position: sibMovement.position,
          velocity: sibMovement.velocity,
          squashStretch: sibMovement.squashStretch,
        };

        // Audio on behavior change (per-entity rate limited) — gated by familySounds
        if (sibBehavior.newState !== eng.prevState) {
          if (config.audio.familySounds) {
            onBehaviorChange(eng.prevState, sibBehavior.newState, newSurfaceMood, config.audio, sib.meta.id);
          }
          // Emote transition burst for sibling
          if (engines.emote && config.emote.enabled) {
            engines.emote.onBehaviorTransition(
              eng.prevState, sibBehavior.newState,
              sib.meta.id, sibMovement.position, config.emote,
            );
          }
          eng.prevState = sibBehavior.newState;
        }

        // --- Sibling gaze: look at nearest other entity ---
        let sibEyeTarget = { x: 0, y: 0 };
        const gazeRadius = 250;
        let closestDist = gazeRadius;
        // Check founder
        const dxF = movement.position.x - sibMovement.position.x;
        const dyF = movement.position.y - sibMovement.position.y;
        const distF = Math.sqrt(dxF * dxF + dyF * dyF);
        if (distF < closestDist && distF > 1) {
          closestDist = distF;
          sibEyeTarget = { x: dxF / distF, y: dyF / distF };
        }
        // Check other siblings
        for (const otherSib of siblings) {
          if (otherSib.meta.id === sib.meta.id) continue;
          const dxS = otherSib.runtime.position.x - sibMovement.position.x;
          const dyS = otherSib.runtime.position.y - sibMovement.position.y;
          const distS = Math.sqrt(dxS * dxS + dyS * dyS);
          if (distS < closestDist && distS > 1) {
            closestDist = distS;
            sibEyeTarget = { x: dxS / distS, y: dyS / distS };
          }
        }

        // Render sibling
        const sibGlowPulse = (Math.sin(timestamp / 1000 * 1.5 + sib.meta.id.charCodeAt(5) * 0.5) * 0.5 + 0.5) * sibMoodMods.glowIntensity;
        const sibRenderState: KovyRenderState = {
          position: sibMovement.position,
          velocity: sibMovement.velocity,
          squashStretch: sibMovement.squashStretch,
          surfaceMood: newSurfaceMood,
          behaviorState: sibBehavior.newState,
          blinkState: rendererRef.current!.getBlinkState(),
          glowPulse: sibGlowPulse,
          eyeTarget: sibEyeTarget,
          isAsleep: sibRuntime.isAsleep || sibBehavior.newState === "nap",
          time: timestamp / 1000,
          moodToColor: config.mood.moodToColor,
          moodToParticles: config.mood.moodToParticles,
          eyeStyle: activeSkinPack?.eyeStyle ?? config.appearance.eyeStyle,
          bodyStyle: activeSkinPack?.bodyStyle ?? config.appearance.bodyStyle,
          hueOffset: sibPersonality.colorHueOffset,
          sizeOffset: sibPersonality.sizeOffset,
          // Gaming Mode deformation (shared global output, per-entity jitter via hueOffset phase)
          gamingExcitement: engines.cachedGamingOutput.excitement,
          elasticity: engines.cachedGamingOutput.elasticity,
          freeformWobble: engines.cachedGamingOutput.freeformWobble,
          predictionConfidence: engines.cachedGamingOutput.predictionConfidence,
          // Circadian
          dreamIntensity: engines.cachedCircadianOutput.dreamIntensity,
          isStartled: sibBehavior.newState === "startle",
          // Movement feel
          leanAngle: sibMovement.leanAngle,
          landingImpact: sibMovement.landingImpact,
          showName: config.family.showFamilyNames,
          name: sib.meta.name,
          // Per-entity visual customization (skin pack overrides if no custom colors)
          customColorsEnabled: sib.meta.visual?.customColorsEnabled ?? !!activeSkinPack,
          primaryColor: sib.meta.visual?.customColorsEnabled ? sib.meta.visual?.primaryColor : (activeSkinPack?.primaryColor ?? sib.meta.visual?.primaryColor),
          secondaryColor: sib.meta.visual?.customColorsEnabled ? sib.meta.visual?.secondaryColor : (activeSkinPack?.secondaryColor ?? sib.meta.visual?.secondaryColor),
          toneMode: sib.meta.visual?.customColorsEnabled ? sib.meta.visual?.toneMode : (activeSkinPack?.toneMode ?? sib.meta.visual?.toneMode),
          entityOpacity: sib.meta.visual?.opacity,
          rimLightIntensity: sib.meta.visual?.rimLightIntensity ?? activeSkinPack?.rimLightIntensity ?? 0.3,
          // Bond warmth aura (v6.0): siblings share founder's bond level
          bondWarmth: engines.bond && config.bond.enabled
            ? BOND_WARMTH_MAP[engines.bond.getState().bondLevel] ?? 0
            : 0,
          // Mood posture (v7.0)
          postureDroop: (() => {
            const m = newSurfaceMood;
            if (m === "shy" || m === "anxious" || m === "overwhelmed") return 0.12;
            if (m === "sleepy") return 0.08;
            if (m === "excited" || m === "playful") return -0.06;
            return 0;
          })(),
        };
        rendererRef.current!.renderEntity(sibRenderState, dt);

        // --- Render accessories for sibling ---
        if (config.appearance.accessoriesEnabled && !config.appearance.reducedMotion) {
          const ctx = ctxRef.current;
          if (ctx) {
            if (!engines.accessoryRenderer) engines.accessoryRenderer = new AccessoryRenderer(ctx);
            const weatherType = engines.weather?.getState().current;
            engines.accessoryRenderer.render(
              sibMovement.position.x, sibMovement.position.y,
              28 * config.appearance.size * (1 + (sibPersonality.sizeOffset ?? 0)),
              newSurfaceMood, sibBehavior.newState,
              weatherType, timestamp / 1000,
              0.9, config.appearance.reducedMotion,
            );
          }
        }
      }

      // --- Separation pass: prevent Kovy and family members from stacking ---
      // Run after all per-entity movements are computed so every entity sees the
      // freshest positions. Each entity is pushed away from others that are closer
      // than SEPARATION_MIN_DIST, with a smooth quadratic falloff.
      if (siblings.length > 0) {
        const SEPARATION_MIN_DIST = 70;   // px — keep entities at least this far apart
        const SEPARATION_STRENGTH = 320;  // repulsion strength
        // Gather this frame's positions for every entity
        const allPositions: { id: EntityId; pos: Vec2 }[] = [];
        allPositions.push({ id: FOUNDER_ID, pos: movement.position });
        for (const sib of siblings) {
          const upd = siblingUpdates[sib.meta.id];
          if (upd?.position) allPositions.push({ id: sib.meta.id, pos: upd.position });
        }
        // Founder separation (skip while being dragged — user controls position)
        if (dragAction.type !== "dragging") {
          const founderOthers = allPositions
            .filter((p) => p.id !== FOUNDER_ID)
            .map((p) => p.pos);
          if (founderOthers.length > 0) {
            const sep = engines.movement.applySeparation(
              founderOthers, SEPARATION_MIN_DIST, SEPARATION_STRENGTH,
              founderMovMaxX, founderMovMaxY, founderMinX, founderMinY,
            );
            movement = { ...movement, position: sep.position, velocity: sep.velocity };
          }
        }
        // Sibling separation
        for (const sib of siblings) {
          const eng = engines.siblings.get(sib.meta.id);
          if (!eng) continue;
          const upd = siblingUpdates[sib.meta.id];
          if (!upd?.position) continue;
          const others = allPositions
            .filter((p) => p.id !== sib.meta.id)
            .map((p) => p.pos);
          if (others.length === 0) continue;
          // Re-derive this sibling's movement bounds (computed earlier in the loop)
          let sMinX = 0, sMinY = 0;
          let sMaxX = effectiveScreenW, sMaxY = effectiveScreenH;
          if (availMons.length > 0) {
            const sibDisplayMonitor = sib.meta.displayMonitor ?? "global";
            const sibBounds = toOverlayLocalBounds(
              getEntityBounds(sibDisplayMonitor, availMons, vd, primIdx), vd,
            );
            sMinX = sibBounds.x;
            sMinY = sibBounds.y;
            sMaxX = sibBounds.x + sibBounds.width;
            sMaxY = sibBounds.y + sibBounds.height;
          }
          const sep = eng.movement.applySeparation(
            others, SEPARATION_MIN_DIST, SEPARATION_STRENGTH,
            sMaxX, sMaxY, sMinX, sMinY,
          );
          siblingUpdates[sib.meta.id].position = sep.position;
          siblingUpdates[sib.meta.id].velocity = sep.velocity;
        }
      }

      if (Object.keys(siblingUpdates).length > 0) {
        entityState.batchUpdateRuntimes(siblingUpdates);
      }
    }

    // Clean up engines for removed entities
    for (const [id] of engines.siblings) {
      if (!entityState.hasEntity(id)) engines.siblings.delete(id);
    }

    // --- Emote engine update + rendering (after entities) ---
    if (engines.emote && config.emote.enabled && !(frameState.current.focusOutput.enabled && frameState.current.focusOutput.suppressEmotes) && !streamSafe) {
      // Build entity list for passive emote spawning (reuse persistent array)
      const emoteEntities = engines._emoteEntities;
      emoteEntities.length = 0;
      emoteEntities.push({ id: FOUNDER_ID, position: movement.position, mood: state.surfaceMood, behaviorState: state.behaviorState });
      for (const sib of siblings) {
        emoteEntities.push({ id: sib.meta.id, position: sib.runtime.position, mood: sib.runtime.surfaceMood, behaviorState: sib.runtime.behaviorState });
      }
      const prevEmoteCount = engines.emote.getParticleCount();
      engines.emote.update(dt, config.emote, emoteEntities);
      const emoteParticles = engines.emote.getParticles();
      const newEmoteCount = emoteParticles.length;
      if (newEmoteCount > prevEmoteCount && engines.stats && config.stats.enabled) {
        for (let i = prevEmoteCount; i < newEmoteCount; i++) {
          engines.stats.recordEmote();
        }
      }
      if (emoteParticles.length > 0) {
        const ctx = ctxRef.current;
        if (ctx) {
          if (!engines.emoteRenderer) engines.emoteRenderer = new EmoteRenderer(ctx);
          engines.emoteRenderer.renderAll(emoteParticles, config.emote);
        }
      }
    }

    // --- Gaming residue rendering (after entities, before Muse) ---
    if (engines.cachedGamingOutput.enabled && engines.cachedGamingOutput.residueBursts.length > 0) {
      const ctx = ctxRef.current;
      if (ctx) {
        if (!engines.gamingResidue) engines.gamingResidue = new GamingResidueRenderer(ctx);
        engines.gamingResidue.ingestBursts(engines.cachedGamingOutput.residueBursts, config.gaming);
      }
    }
    if (engines.gamingResidue) {
      engines.gamingResidue.updateMarks(dt);
      engines.gamingResidue.renderAll();
    }

    // --- Muse overlay rendering ---
    if (engines.muse && config.muse.enabled) {
      // Sync decay every frame
      engines.muse.updateSync(dt, config.muse);

      // Async context refresh + spawn (throttled, ~1/s)
      frameState.current.museUpdateAccum += dt;
      if (frameState.current.museUpdateAccum >= 0.25) {
        const updateDt = frameState.current.museUpdateAccum;
        frameState.current.museUpdateAccum = 0;
        // Collect entity positions for overlay spawning (reuse persistent array)
        const museEntities = engines._museEntities;
        museEntities.length = 0;
        museEntities.push({ id: FOUNDER_ID, position: movement.position, mood: state.surfaceMood });
        for (const sib of (entityState.getNonFounderEntities())) {
          museEntities.push({ id: sib.meta.id, position: sib.runtime.position, mood: sib.runtime.surfaceMood });
        }
        engines.muse.update(updateDt, config.muse, museEntities, effectiveScreenW, effectiveScreenH).catch(() => { kovyLog.warn("Muse engine update failed"); });
      }

      // Render muse overlays
      const museOverlays = engines.muse.getOverlays();
      if (museOverlays.length > 0) {
        const ctx = ctxRef.current;
        if (ctx) {
          if (!engines.museRenderer) engines.museRenderer = new MuseOverlayRenderer(ctx);
          engines.museRenderer.renderAll(museOverlays);
        }
      }
    }

    // --- Toy Engine: update physics, wire behaviors, and render ---
    if (engines.toy && config.toys.enabled) {
      engines.toy.updateConfig(config.toys);
      const canvas = ctxRef.current?.canvas;
      const bounds = canvas
        ? { width: canvas.width, height: canvas.height }
        : { width: 1920, height: 1080 };
      engines.toy.updatePhysics(dt, bounds, movement.position);

      // D4 fix: wire toy behaviors into BehaviorEngine
      const toyBehavior = engines.toy.getDominantBehaviorState(state.position, state.surfaceMood);
      if (toyBehavior && engines.behavior) {
        engines.behavior.forceState(toyBehavior as any);
      }

      // D4 fix: pass the actual consumed toys set to the renderer
      const toys = engines.toy.getToys();
      const consumed = engines.toy.getConsumedToys();
      if (toys.length > 0 || consumed.size > 0) {
        const ctx = ctxRef.current;
        if (ctx) {
          drawToys(ctx, toys, consumed, performance.now());
        }
      }
    }

    // --- Intent Engine: goal-driven behavior (v9.0) ---
    if (engines.intent && config.intent.enabled) {
      engines.intent.updateConfig(config.intent);
      const canvas = ctxRef.current?.canvas;
      const bounds = canvas
        ? { width: canvas.width, height: canvas.height }
        : { width: 1920, height: 1080 };
      const bondState = engines.bond?.getState() ?? null;
      const toyTarget = engines.toy?.getAttractionTarget(state.position) ?? null;
      const nestPos = config.habitat.homes[0]?.position ?? null;
      const intentOut = engines.intent.update({
        circadianPhase: engines.cachedCircadianOutput.phase,
        bondLevel: bondState?.bondLevel ?? null,
        idleSeconds: frameState.current.idleOutput.isIdle ? frameState.current.idleMinutesAccum * 60 : 0,
        surfaceMood: state.surfaceMood,
        kovyPos: movement.position,
        screenBounds: bounds,
        toyTarget,
        nestPosition: nestPos,
        dt,
      });
      // Spawn intent thought if pending
      const thought = engines.intent.consumeThought();
      if (thought && engines.thought) {
        engines.thought.spawnCustom(thought.text, { x: movement.position.x, y: movement.position.y - 40 }, "cloud");
      }
      // Apply intent state bias to behavior engine
      if (intentOut.current && intentOut.stateBias && engines.behavior) {
        const biasEntries = Object.entries(intentOut.stateBias) as [BehaviorState, number][];
        if (biasEntries.length > 0) {
          // Pick the highest-biased state and nudge toward it
          const [topState, topWeight] = biasEntries.reduce((a, b) => a[1] > b[1] ? a : b);
          if (topWeight > 0.5 && Math.random() < 0.02) {
            engines.behavior.forceState(topState);
          }
        }
      }
      // Draw intent debug overlay
      if (config.intent.showInDebug && config.advanced.debugMode && intentOut.current && intentOut.targetPosition) {
        const ctx = ctxRef.current;
        if (ctx) {
          ctx.save();
          ctx.strokeStyle = "rgba(100, 200, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(movement.position.x, movement.position.y);
          ctx.lineTo(intentOut.targetPosition.x, intentOut.targetPosition.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
          ctx.beginPath();
          ctx.arc(intentOut.targetPosition.x, intentOut.targetPosition.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`intent: ${intentOut.current}`, intentOut.targetPosition.x, intentOut.targetPosition.y - 8);
          ctx.restore();
        }
      }
    }

    // --- Recall Engine: Memory-Palace recall thoughts (v9.0) ---
    if (engines.recall && config.recall.enabled) {
      engines.recall.updateConfig(config.recall);
      // Throttle recall checks — only run when memory is initialized
      if (frameState.current.memoryInitialized) {
        frameState.current.recallAccum = (frameState.current.recallAccum ?? 0) + dt;
        if (frameState.current.recallAccum >= 30) {
          frameState.current.recallAccum = 0;
          engines.recall.update(dt, FOUNDER_ID, movement.position, state.surfaceMood).then(() => {
            const thought = engines.recall?.consumeThought();
            if (thought && engines.thought) {
              engines.thought.spawnCustom(thought.text, thought.position, "cloud");
              // Record recall in journal
              if (engines.journal && config.journal.enabled) {
                engines.journal.recordAiInsight(
                  "recall",
                  `Recalled a ${thought.memoryType} memory from ${thought.ageDays} days ago`,
                  thought.text,
                  state.surfaceMood,
                );
              }
            }
          }).catch(() => { /* silently ignore recall errors */ });
        }
      }
    }

    // --- Story Engine: weekly chapter generation (v9.0) ---
    if (engines.story && config.story.enabled) {
      engines.story.updateConfig(config.story);
      // Throttle story checks — only run every 60 seconds
      frameState.current.storyCheckAccum = (frameState.current.storyCheckAccum ?? 0) + dt;
      if (frameState.current.storyCheckAccum >= 60) {
        frameState.current.storyCheckAccum = 0;
        // Gather inputs for story generation
        const snapshots = loadSnapshots();
        const bondState = engines.bond?.getState() ?? null;
        const inputs = {
          snapshots,
          bondLevel: bondState?.bondLevel ?? null,
          totalInteractions: 0, // stats engine doesn't expose getData; use snapshots for highlights
          dominantMood: state.surfaceMood,
          streakDays: bondState?.streakDays ?? 0,
          kovyName: "Kovy",
        };
        const chapter = engines.story.run({
          config: config.story,
          inputs,
        });
        if (chapter) {
          // Show the story toast
          const ctx = ctxRef.current;
          if (ctx) {
            import("./storyToast").then(({ showStoryToast }) => {
              showStoryToast(chapter, config.story.autoDismissSec, performance.now());
            });
          }
          // Record in journal
          if (engines.journal && config.journal.enabled) {
            engines.journal.recordAiInsight(
              "story",
              `New chapter: ${chapter.title}`,
              chapter.sections.map(s => `${s.heading}: ${s.body}`).join(" | "),
              state.surfaceMood,
            );
          }
        }
      }
    }

    // --- Experimental Engine: auto-interact with screen elements ---
    if (engines.experimental && config.experimental.enabled && config.experimental.autoInteract) {
      engines.experimental.updateConfig(config.experimental);
      engines.experimental.updateVirtualDesktop(vd);
      const isPrivacyPaused = state.isPrivacyPaused ?? false;
      engines.experimental.tryInteract(movement.position, state.behaviorState, isPrivacyPaused).then((entry) => {
        if (entry && engines.journal && config.journal.enabled) {
          engines.journal.recordAiInsight(
            "experimental",
            `${entry.type} on ${entry.targetElement}`,
            entry.success ? "Interaction succeeded" : `Failed: ${entry.error ?? "unknown"}`,
            state.surfaceMood,
          );
        }
      }).catch(() => { /* silently ignore interaction errors */ });
    }

    // --- Overlays: motion regions, target reticle, salience graph, habitat ---
    // These are independent of debugMode — each has its own toggle
    const hasAnyOverlay = config.advanced.motionOverlay ||
      config.advanced.targetReticle ||
      config.advanced.debugMode ||
      config.advanced.salienceGraph ||
      config.advanced.habitatOverlay ||
      state.habitatEditMode; // always draw in edit mode regardless of config flag
    if (hasAnyOverlay) {
      const ctx = ctxRef.current;
      if (ctx) {
        drawDebugOverlays(ctx, { ...state, focusTarget: frameState.current.cachedFocusTarget }, config, movement.position);
      }
    }

    // Update store with final position
    state.updateFrame({
      position: movement.position,
      velocity: movement.velocity,
      squashStretch: movement.squashStretch,
      targetPosition: smoothedTarget,
      eyeTarget,
      glowPulse,
    });

    // --- Milestone: active time tracking + notifications ---
    if (engines.milestone && config.milestone.enabled) {
      engines.milestone.recordActiveTime(dt);

      // Feed newly unlocked milestones to the toast system
      const newMilestones = engines.milestone.consumeNewlyUnlocked();
      if (newMilestones.length > 0 && config.milestone.showNotifications) {
        const ctx = ctxRef.current;
        if (ctx) {
          drawMilestoneToast(ctx, newMilestones, timestamp);
        }
      } else if (config.milestone.showNotifications) {
        // Continue rendering active toast across frames
        const ctx = ctxRef.current;
        if (ctx) {
          drawMilestoneToast(ctx, [], timestamp);
        }
      }

      // Screenshot toast (AI screenshot notification)
      {
        const ctx = ctxRef.current;
        if (ctx) {
          drawScreenshotToast(ctx, timestamp);
        }
      }

      // Profile auto-switch toast
      {
        const ctx = ctxRef.current;
        if (ctx) {
          drawProfileSwitchToast(ctx, timestamp);
        }
      }

      // Capture-app auto-hide toast
      {
        const ctx = ctxRef.current;
        if (ctx) {
          drawCaptureAppToast(ctx, timestamp);
        }
      }

      // Journal: record milestone unlocks (v6.1)
      if (engines.journal && config.journal.enabled) {
        for (const ms of newMilestones) {
          engines.journal.recordMilestone(ms.title, ms.icon, state.surfaceMood);
        }
      }
    }

    // Companion Digest card (v8.2) — rendered every frame while active.
    // Lives outside the milestone block so it shows even if milestones are disabled.
    {
      const ctx = ctxRef.current;
      if (ctx) {
        drawDigestToast(ctx, timestamp);
      }
    }

    // Companion Chronicle card (v8.3) — rendered every frame while active.
    // Lives outside the milestone block so it shows even if milestones are disabled.
    {
      const ctx = ctxRef.current;
      if (ctx) {
        drawChronicleToast(ctx, timestamp);
      }
    }

    // Companion Story card (v9.0) — rendered every frame while active.
    {
      const ctx = ctxRef.current;
      if (ctx) {
        renderStoryToast(ctx, timestamp);
      }
    }

    // --- Journal: daily summary check (v6.1) ---
    if (engines.journal && config.journal.enabled) {
      frameState.current.journalSummaryAccum += dt;
      if (frameState.current.journalSummaryAccum >= 60) {
        frameState.current.journalSummaryAccum = 0;
        if (config.journal.generateDailySummary) {
          const activeSeconds = engines.milestone?.getState().totalActiveSeconds ?? 0;
          engines.journal.maybeGenerateDailySummary(activeSeconds, state.surfaceMood);
        }
      }
    }

    // --- v7.0 Engine Updates (throttled, outputs stored for rendering) ---
    updateV7Engines({
      engines,
      frameState: frameState.current,
      config,
      dt,
      ctx: ctxRef.current,
      mountedRef,
      state,
      entityState,
      moodHue: moodMods.colorHue,
      position: state.position,
      surfaceMood: state.surfaceMood,
      behaviorState: state.behaviorState,
      behaviorPreset: config.behavior.preset,
    });

    // --- Render thought bubbles on canvas (above all entities) ---
    {
      const ctx = ctxRef.current;
      if (ctx) {
        renderThoughtBubbles(ctx, frameState.current.thoughtOutput);
        // Render dream thought bubble alongside regular thoughts
        if (dreamOut.enabled && dreamOut.dreamThought) {
          renderThoughtBubbles(ctx, {
            enabled: true,
            bubbles: [
              {
                id: -1,
                text: dreamOut.dreamThought,
                position: { x: movement.position.x, y: movement.position.y - 45 * config.appearance.size },
                lifetime: 4,
                maxLifetime: 4,
                style: "cloud" as const,
              },
            ],
          });
        }
      }
    }

    // --- Render whispers on canvas (below thoughts, more intimate) ---
    {
      const ctx = ctxRef.current;
      if (ctx) renderWhispers(ctx, frameState.current.whisperOutput);
    }

    // --- Render audio visualizer bars (subtle, bottom of entity) ---
    {
      const ctx = ctxRef.current;
      if (ctx) renderAudioVisualizer(ctx, frameState.current.audioReactivityOutput, config, movement.position, moodMods.colorHue);
    }

    } catch (err) {
      recordError(`Animation loop error: ${err}`, "KovyRenderer.animate");
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
      />
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        onAction={handleContextMenuAction}
        onClose={() => setContextMenu(c => ({ ...c, visible: false }))}
      />
    </>
  );
}
