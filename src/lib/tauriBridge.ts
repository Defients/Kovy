// ============================================================
// Typed Tauri bridge — wires frontend config to Rust backend
// ============================================================

import { invokeOwnedAI } from "./nativePolicy";
import type { KovyConfig, MonitorBounds } from "@/store/types";

// --- Invoke wrappers ---

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return await tauriInvoke<T>(cmd, args);
  } catch (e) {
    console.warn(`Kovy bridge: ${cmd} failed`);
    throw e;
  }
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  is_primary: boolean;
}

export async function getMonitors(): Promise<MonitorInfo[]> {
  try {
    return await invoke<MonitorInfo[]>("get_monitors");
  } catch {
    return [];
  }
}

export async function updateCaptureConfig(config: KovyConfig): Promise<void> {
  try {
    await invoke("update_capture_config", {
      enabled: config.vision.enabled,
      analysisFps: config.vision.analysisFps,
      analysisScale: config.vision.analysisScale,
      motionThreshold: config.vision.motionThreshold,
    });
  } catch {
    // Not in Tauri — silent
  }
}

export async function pauseCapture(): Promise<void> {
  try {
    await invoke("pause_capture");
  } catch { /* not in Tauri */ }
}

export async function resumeCapture(): Promise<void> {
  try {
    await invoke("resume_capture");
  } catch { /* not in Tauri */ }
}

export async function setMonitorIndex(index: number): Promise<void> {
  try {
    await invoke("set_monitor_index", { index });
  } catch { /* not in Tauri */ }
}

export type CaptureVisibilityStatus = "not-applied" | "applied-hidden" | "applied-visible" | "failed" | "unsupported" | "unavailable";
export async function getCaptureVisibilityStatus(): Promise<CaptureVisibilityStatus> {
  try { return await invoke<CaptureVisibilityStatus>("capture_visibility_status"); }
  catch { return "unavailable"; }
}
export async function setHideFromCapture(hide: boolean): Promise<CaptureVisibilityStatus> {
  try { return await invoke<CaptureVisibilityStatus>("set_hide_from_capture", { hide }); }
  catch { return "unavailable"; }
}

/**
 * A single overlay mask rectangle in canvas (virtual-desktop physical)
 * coordinates. One per visible entity (founder + siblings).
 */
export interface OverlayMaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Set the overlay masks in canvas (virtual-desktop physical) coordinates so
 * Kovy's motion analyzer ignores pixels inside each entity's bounding box.
 * Pass an empty array to clear all masks. Only meaningful when the overlay
 * is visible to capture (hideFromCapture === false); when hidden, the
 * backend ignores the overlay entirely (WDA_EXCLUDEFROMCAPTURE).
 */
export async function setOverlayMasks(
  rects: OverlayMaskRect[]
): Promise<void> {
  try {
    await invoke("set_overlay_masks", { rects });
  } catch { /* not in Tauri */ }
}

/**
 * Result of probing for known screen-capture / streaming applications.
 * `running` is true if at least one capture app process is currently active;
 * `matched` lists the lowercased process image names that were detected.
 */
export interface CaptureAppStatus {
  running: boolean;
  matched: string[];
}

/**
 * Detect whether a known screen-capture / streaming application (OBS,
 * Streamlabs, vMix, ShareX, etc.) is currently running. Used to auto-enable
 * `hideFromCapture` so Kovy doesn't appear in the captured feed. Returns
 * `{ running: false, matched: [] }` outside Tauri / on non-Windows.
 */
export async function detectCaptureApps(): Promise<CaptureAppStatus> {
  try {
    return await invoke<CaptureAppStatus>("detect_capture_apps");
  } catch {
    return { running: false, matched: [] };
  }
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ForegroundAppInfo {
  processName: string | null;
  windowTitle: string | null;
  windowBounds: WindowBounds | null;
}

export async function getForegroundApp(): Promise<ForegroundAppInfo> {
  try {
    return await invoke<ForegroundAppInfo>("get_foreground_app");
  } catch {
    return { processName: null, windowTitle: null, windowBounds: null };
  }
}

// --- Idle detection ---

export async function getIdleSeconds(): Promise<number | null> {
  try {
    return await invoke<number>("get_idle_seconds");
  } catch {
    return null;
  }
}

// --- Weather fetch ---

export async function fetchWeather(location: string): Promise<string | null> {
  try {
    return await invoke<string>("fetch_weather", { location });
  } catch {
    return null;
  }
}

// --- Event listeners ---

type UnlistenFn = () => void;

export async function listenToTrayEvents(handlers: {
  onTogglePause: () => void;
  onToggleSleep: () => void;
  onPrivacyPause: () => void;
  onResetPosition: () => void;
  onToggleHabitatEdit?: () => void;
  onToggleVisibility?: () => void;
  onToggleExperienceMode?: () => void;
  onAskKovy?: () => void;
  onCommandPalette?: () => void;
  onShowDigest?: () => void;
  onShowChronicle?: () => void;
  onShowStory?: () => void;
  onOpenChat?: () => void;
}): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  try {
    const { listen } = await import("@tauri-apps/api/event");

    unlisteners.push(await listen("toggle-pause", () => handlers.onTogglePause()));
    unlisteners.push(await listen("toggle-sleep", () => handlers.onToggleSleep()));
    unlisteners.push(await listen("privacy-pause", () => handlers.onPrivacyPause()));
    unlisteners.push(await listen("reset-position", () => handlers.onResetPosition()));
    if (handlers.onToggleHabitatEdit) {
      unlisteners.push(await listen("toggle-habitat-edit", () => handlers.onToggleHabitatEdit!()));
    }
    if (handlers.onToggleVisibility) {
      unlisteners.push(await listen("toggle-visibility", () => handlers.onToggleVisibility!()));
    }
    if (handlers.onToggleExperienceMode) {
      unlisteners.push(await listen("toggle-experience-mode", () => handlers.onToggleExperienceMode!()));
    }
    if (handlers.onAskKovy) {
      unlisteners.push(await listen("ask-kovy", () => handlers.onAskKovy!()));
    }
    if (handlers.onCommandPalette) {
      unlisteners.push(await listen("command-palette", () => handlers.onCommandPalette!()));
    }
    if (handlers.onShowDigest) {
      unlisteners.push(await listen("show-digest", () => handlers.onShowDigest!()));
    }
    if (handlers.onShowChronicle) {
      unlisteners.push(await listen("show-chronicle", () => handlers.onShowChronicle!()));
    }
    if (handlers.onShowStory) {
      unlisteners.push(await listen("show-story", () => handlers.onShowStory!()));
    }
    if (handlers.onOpenChat) {
      unlisteners.push(await listen("open-chat", () => handlers.onOpenChat!()));
    }
  } catch {
    // Not in Tauri
  }

  return unlisteners;
}

// --- Hotkey registration ---

interface RegisteredShortcut {
  shortcut: string;
  unlisten: UnlistenFn;
}

let registeredShortcuts: RegisteredShortcut[] = [];
// Guard against concurrent registration calls (e.g. React strict-mode double-invoke)
let registrationInProgress = false;
// Queue a re-registration if a call arrives while one is in progress
let pendingRegistration: { hotkeys: KovyConfig["hotkeys"]; handlers: any } | null = null;

export async function registerHotkeys(hotkeys: KovyConfig["hotkeys"], handlers: {
  toggleVisibility: () => void;
  openSettings: () => void;
  pauseAnalysis: () => void;
  sleepWake: () => void;
  privacyPause: () => void;
  resetPosition: () => void;
  toggleMuse?: () => void;
  toggleGaming?: () => void;
  toggleDrag?: () => void;
  toggleFocus?: () => void;
  switchProfile?: () => void;
  toggleExperienceMode?: () => void;
  askKovy?: () => void;
  commandPalette?: () => void;
  showDigest?: () => void;
  showChronicle?: () => void;
  showStory?: () => void;
  openChat?: () => void;
}): Promise<void> {
  // If a registration is already in progress, queue this one and return.
  // The in-progress call will pick up the pending config after it finishes.
  if (registrationInProgress) {
    pendingRegistration = { hotkeys, handlers };
    return;
  }
  registrationInProgress = true;

  // Unregister all existing shortcuts first
  await unregisterAllHotkeys();

  const mappings: Array<{ key: keyof typeof hotkeys; handler: () => void }> = [
    { key: "toggleVisibility", handler: handlers.toggleVisibility },
    { key: "openSettings", handler: handlers.openSettings },
    { key: "pauseAnalysis", handler: handlers.pauseAnalysis },
    { key: "sleepWake", handler: handlers.sleepWake },
    { key: "privacyPause", handler: handlers.privacyPause },
    { key: "resetPosition", handler: handlers.resetPosition },
  ];
  if (handlers.toggleMuse) {
    mappings.push({ key: "toggleMuse", handler: handlers.toggleMuse });
  }
  if (handlers.toggleGaming) {
    mappings.push({ key: "toggleGaming", handler: handlers.toggleGaming });
  }
  if (handlers.toggleDrag) {
    mappings.push({ key: "toggleDrag", handler: handlers.toggleDrag });
  }
  if (handlers.toggleFocus) {
    mappings.push({ key: "toggleFocus", handler: handlers.toggleFocus });
  }
  if (handlers.switchProfile) {
    mappings.push({ key: "switchProfile", handler: handlers.switchProfile });
  }
  if (handlers.toggleExperienceMode) {
    mappings.push({ key: "toggleExperienceMode", handler: handlers.toggleExperienceMode });
  }
  if (handlers.askKovy) {
    mappings.push({ key: "askKovy", handler: handlers.askKovy });
  }
  if (handlers.commandPalette) {
    mappings.push({ key: "commandPalette", handler: handlers.commandPalette });
  }
  if (handlers.showDigest) {
    mappings.push({ key: "showDigest", handler: handlers.showDigest });
  }
  if (handlers.showChronicle) {
    mappings.push({ key: "showChronicle", handler: handlers.showChronicle });
  }
  if (handlers.showStory) {
    mappings.push({ key: "showStory", handler: handlers.showStory });
  }
  if (handlers.openChat) {
    mappings.push({ key: "openChat", handler: handlers.openChat });
  }

  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");

    for (const mapping of mappings) {
      const shortcutStr = hotkeys[mapping.key];
      if (!shortcutStr || shortcutStr.trim() === "") continue;

      try {
        const tauriShortcut = convertToTauriShortcut(shortcutStr);
        if (!tauriShortcut) {
          console.warn(`Kovy: Invalid hotkey string "${shortcutStr}" for ${String(mapping.key)}`);
          continue;
        }

        await register(tauriShortcut, (eventOrShortcut: any) => {
          console.log(`Kovy: Hotkey fired: ${tauriShortcut} → ${String(mapping.key)}`);
          // Tauri v2 plugin passes either a ShortcutEvent object {state, shortcut, id}
          // or just the shortcut string depending on plugin version.
          // Handle both shapes defensively.
          const isString = typeof eventOrShortcut === "string";
          const hasNoState = !isString && (eventOrShortcut?.state == null);
          const isPressed = !isString && eventOrShortcut?.state === "Pressed";
          if (isString || hasNoState || isPressed) {
            mapping.handler();
          }
        });

        registeredShortcuts.push({
          shortcut: tauriShortcut,
          unlisten: async () => {
            try {
              const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
              await unregister(tauriShortcut);
            } catch { /* ignore */ }
          },
        });
        console.log(`Kovy: Registered hotkey "${tauriShortcut}" for ${String(mapping.key)}`);
      } catch (e) {
        console.warn(`Kovy: Failed to register hotkey "${shortcutStr}" for ${String(mapping.key)}:`, e);
      }
    }
  } catch (e) {
    console.log("Kovy: Global shortcuts not available (not in Tauri or plugin missing)", e);
  } finally {
    registrationInProgress = false;
  }

  // If a pending registration was queued while we were busy, process it now
  if (pendingRegistration) {
    const pending = pendingRegistration;
    pendingRegistration = null;
    await registerHotkeys(pending.hotkeys, pending.handlers);
  }
}

export async function unregisterAllHotkeys(): Promise<void> {
  try {
    const { unregisterAll } = await import("@tauri-apps/plugin-global-shortcut");
    await unregisterAll();
  } catch { /* not in Tauri or plugin missing */ }
  registeredShortcuts = [];
}

/** Convert user-facing shortcut strings like "Alt+Shift+K" to Tauri format */
function convertToTauriShortcut(input: string): string | null {
  if (!input || input.trim() === "") return null;

  // Tauri v2 global-shortcut uses the same format: Modifier+Key
  // Modifiers: CmdOrControl, Shift, Alt, Super, Option, Cmd, Command, Ctrl, Control, Meta
  const parts = input.split("+").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const validModifiers = ["Alt", "Ctrl", "Control", "Shift", "Super", "Meta", "Command", "Cmd", "Option", "CmdOrControl", "CommandOrControl"];
  const modifiers = parts.slice(0, -1);
  const key = parts[parts.length - 1];

  // Convert modifiers to Tauri preferred format
  const mappedModifiers = modifiers.map(mod => {
    const l = mod.toLowerCase();
    if (l === "ctrl" || l === "control" || l === "cmd" || l === "command") {
      return "CmdOrControl"; // Maps correctly on both Windows and macOS
    }
    if (l === "meta" || l === "super") {
      return "Super";
    }
    // Shift, Alt, Option remain same (capitalize first letter)
    return mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase();
  });

  // Check that all parts except the last are valid modifiers
  for (const mod of modifiers) {
    if (!validModifiers.some(vm => vm.toLowerCase() === mod.toLowerCase())) {
      return null;
    }
  }

  // Check that we have at least one modifier and a key
  if (modifiers.length === 0 || !key) return null;

  // Normalize the key: uppercase single-char keys (A-Z, 0-9),
  // but preserve casing for special keys like Tab, Escape, Enter, etc.
  // Tauri v2's accelerator parser is case-sensitive for multi-char keys.
  const normalizedKey = normalizeKeyName(key);
  return [...mappedModifiers, normalizedKey].join("+");
}

/** Known Tauri v2 special keys (case-sensitive). Maps lowercase → correct casing. */
const SPECIAL_KEYS: Record<string, string> = {
  "tab": "Tab",
  "escape": "Escape",
  "esc": "Escape",
  "enter": "Enter",
  "return": "Return",
  "space": "Space",
  "backspace": "Backspace",
  "insert": "Insert",
  "delete": "Delete",
  "home": "Home",
  "end": "End",
  "pageup": "PageUp",
  "pagedown": "PageDown",
  "arrowup": "ArrowUp",
  "arrowdown": "ArrowDown",
  "arrowleft": "ArrowLeft",
  "arrowright": "ArrowRight",
  "capslock": "CapsLock",
  "printscreen": "PrintScreen",
  "scrolllock": "ScrollLock",
  "numlock": "NumLock",
  "pause": "Pause",
  "contextmenu": "ContextMenu",
};

function normalizeKeyName(key: string): string {
  // Function keys F1-F24: uppercase
  if (/^f\d{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }
  // Single character (letters, numbers, symbols): uppercase
  if (key.length === 1) {
    return key.toUpperCase();
  }
  // Special keys: map to correct casing
  const lower = key.toLowerCase();
  if (SPECIAL_KEYS[lower]) {
    return SPECIAL_KEYS[lower];
  }
  // Unknown multi-char key: return as-is (let Tauri handle it)
  return key;
}

// --- Autostart ---

export async function setAutostart(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      const { enable } = await import("@tauri-apps/plugin-autostart");
      await enable();
    } else {
      const { disable } = await import("@tauri-apps/plugin-autostart");
      await disable();
    }
  } catch (e) {
    console.warn("Kovy: Failed to set autostart:", e);
  }
}

export async function isAutostartEnabled(): Promise<boolean> {
  try {
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    return await isEnabled();
  } catch {
    return false;
  }
}

// --- Window management ---

export async function showOverlay(): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const overlay = await WebviewWindow.getByLabel("overlay");
    if (overlay) {
      await overlay.show();
    }
  } catch { /* not in Tauri */ }
}

export async function hideOverlay(): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const overlay = await WebviewWindow.getByLabel("overlay");
    if (overlay) {
      await overlay.hide();
    }
  } catch { /* not in Tauri */ }
}

export async function showSettings(): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const settings = await WebviewWindow.getByLabel("settings");
    if (settings) {
      await settings.show();
      await settings.setFocus();
    }
  } catch { /* not in Tauri */ }
}

export async function setOverlayClickThrough(clickThrough: boolean): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setIgnoreCursorEvents(clickThrough);
  } catch { /* not in Tauri */ }
}

// --- Current monitor tracking ---

let currentMonitorInterval: ReturnType<typeof setInterval> | null = null;
let lastSetMonitorIdx = -1;

/**
 * Determine which monitor the cursor is currently on based on position.
 * Returns the monitor index, or -1 if no match.
 */
function getCursorMonitorIndex(
  cursorX: number,
  cursorY: number,
  monitors: MonitorInfo[]
): number {
  for (const m of monitors) {
    if (
      cursorX >= m.x &&
      cursorX < m.x + m.width &&
      cursorY >= m.y &&
      cursorY < m.y + m.height
    ) {
      return m.index;
    }
  }
  // Fallback: primary monitor
  const primary = monitors.findIndex((m) => m.is_primary);
  return primary >= 0 ? primary : 0;
}

/**
 * Start polling cursor position to update capture monitor.
 * Only active when monitorMode === "current".
 * Calls onBoundsChange when the active monitor changes, so the overlay
 * can relocate Kovy's behavioral anchor.
 */
export function startCurrentMonitorTracking(
  getCursorPos: () => { x: number; y: number },
  onBoundsChange?: (bounds: MonitorBounds) => void
): void {
  stopCurrentMonitorTracking();
  currentMonitorInterval = setInterval(async () => {
    try {
      const monitors = await getMonitors();
      if (monitors.length <= 1) return;
      const cursor = getCursorPos();
      const idx = getCursorMonitorIndex(cursor.x, cursor.y, monitors);
      if (idx !== lastSetMonitorIdx && idx >= 0) {
        lastSetMonitorIdx = idx;
        await setMonitorIndex(idx);
        // Notify overlay of new monitor bounds
        const m = monitors[idx];
        if (m && onBoundsChange) {
          onBoundsChange({
            x: m.x,
            y: m.y,
            width: m.width,
            height: m.height,
            index: m.index,
          });
        }
      }
    } catch {
      // Silently fail — not critical
    }
  }, 1000); // Check once per second — low overhead
}

export function stopCurrentMonitorTracking(): void {
  if (currentMonitorInterval !== null) {
    clearInterval(currentMonitorInterval);
    currentMonitorInterval = null;
  }
  lastSetMonitorIdx = -1;
}

// --- Sync config to backend ---

export async function syncConfigToBackend(config: KovyConfig): Promise<void> {
  await updateCaptureConfig(config);

  // Apply best-effort recording exclusion; masks remain active as defense in depth.
  await setHideFromCapture(config.privacy.hideFromCapture);

  // Set monitor index based on monitor mode
  if (config.general.monitorMode === "primary") {
    stopCurrentMonitorTracking();
    const monitors = await getMonitors();
    const primaryIdx = monitors.findIndex(m => m.is_primary);
    if (primaryIdx >= 0) {
      await setMonitorIndex(primaryIdx);
    }
  } else if (config.general.monitorMode === "current") {
    // Current monitor tracking is started from the overlay, not here.
    // This path just ensures primary-mode tracking is stopped.
  } else if (config.general.monitorMode === "all") {
    stopCurrentMonitorTracking();
    // usize::MAX sentinel means "all monitors" in the Rust backend
    await setMonitorIndex(Number.MAX_SAFE_INTEGER);
  } else {
    // A specific monitor was selected
    stopCurrentMonitorTracking();
    const monitors = await getMonitors();
    const targetMonitor = monitors.find(m => m.name === config.general.monitorMode);
    if (targetMonitor) {
      await setMonitorIndex(targetMonitor.index);
    }
  }
}

// --- AI bridge ---

export interface AiInsightResponse {
  request_id: string;
  source: string;
  thought_text: string;
  whisper_text: string;
  whisper_category: string;
  confidence: number;
  created_at: number;
}

export async function aiStoreApiKey(key: string): Promise<void> {
  await invoke("ai_store_api_key", { key });
}

export async function aiDeleteApiKey(): Promise<void> {
  try {
    await invoke("ai_delete_api_key");
  } catch { /* not in Tauri */ }
}

export async function aiHasApiKey(): Promise<boolean> {
  try {
    return await invoke<boolean>("ai_has_api_key");
  } catch {
    return false;
  }
}

export async function aiRequest(params: {
  model: string;
  sendScreenshot: boolean;
  screenshotMaxWidth: number;
  screenshotJpegQuality: number;
  screenshotMonitorIndices: number[];
  screenshotMonitorQualities: Record<number, number>;
  includeForegroundApp: boolean;
  foregroundApp: string | null;
  foregroundTitle: string | null;
  maxThoughtChars: number;
  maxWhisperChars: number;
  timeoutSecs: number;
  requestId: string;
  source: string;
}, signal?: AbortSignal): Promise<AiInsightResponse> {
  return await invokeOwnedAI<AiInsightResponse>("ai_request", {
    model: params.model,
    sendScreenshot: params.sendScreenshot,
    screenshotMaxWidth: params.screenshotMaxWidth,
    screenshotJpegQuality: params.screenshotJpegQuality,
    screenshotMonitorIndices: params.screenshotMonitorIndices,
    screenshotMonitorQualities: params.screenshotMonitorQualities,
    includeForegroundApp: params.includeForegroundApp,
    foregroundApp: params.foregroundApp,
    foregroundTitle: params.foregroundTitle,
    maxThoughtChars: params.maxThoughtChars,
    maxWhisperChars: params.maxWhisperChars,
    timeoutSecs: params.timeoutSecs,
    requestId: params.requestId,
    source: params.source,
  }, signal);
}

// --- Chat bridge (v9.0) ---

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  created_at: number;
}

export async function aiChat(params: {
  requestId: string;
  model: string;
  messages: ChatMessage[];
  timeoutSecs: number;
}, signal?: AbortSignal): Promise<ChatResponse> {
  return await invokeOwnedAI<ChatResponse>("ai_chat", {
    requestId: params.requestId,
    model: params.model,
    messages: params.messages,
    timeoutSecs: params.timeoutSecs,
  }, signal);
}

// ============================================================
// Experimental Mode — physical OS input is unavailable in M1.
// The only experimental command is `experimental_interact`,
// dispatched through the native ActionGate (see experimentalInput.ts).
// ============================================================
