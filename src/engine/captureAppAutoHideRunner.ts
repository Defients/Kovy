// ============================================================
// Capture-App Auto-Hide Runner — periodically probes for known
// screen-capture / streaming applications (OBS, Streamlabs, vMix,
// ShareX, …) and, when `privacy.autoHideOnCaptureApp` is enabled,
// automatically toggles `privacy.hideFromCapture` so Kovy stays
// invisible to the captured feed while any such app is running.
//
// Design:
//   - polls `detectCaptureApps()` every `intervalMs` (default 5s)
//   - when a capture app appears: saves the user's prior
//     `hideFromCapture` preference, forces it to `true`, and
//     dispatches a `kovy-capture-app-detected` event so the overlay
//     can show a toast + sync the backend.
//   - when all capture apps exit: restores the saved preference
//     and dispatches a `kovy-capture-app-cleared` event.
//   - never fights the user: if the user manually toggles
//     `hideFromCapture` while a capture app is running, the runner
//     adopts that as the new "restore" target.
//   - fully cancellable via destroy().
//
// The runner is intentionally side-effect-free in its pure
// evaluation (`shouldHide`) so it can be unit-tested without IPC.
// ============================================================

import { detectCaptureApps, type CaptureAppStatus } from "@/lib/tauriBridge";

export interface CaptureAppAutoHideOptions {
  /** Polling interval in milliseconds. */
  intervalMs: number;
  /** Returns the current value of `privacy.autoHideOnCaptureApp`. */
  getEnabled: () => boolean;
  /** Returns the current value of `privacy.hideFromCapture`. */
  getHideFromCapture: () => boolean;
  /** Sets `privacy.hideFromCapture` (persists + syncs backend). */
  setHideFromCapture: (hide: boolean) => void;
  /** Optional override for the detector (defaults to the Tauri bridge). */
  detector?: () => Promise<CaptureAppStatus>;
}

export interface CaptureAppEventDetail {
  matched: string[];
  hideFromCapture: boolean;
  source: "auto";
}

/** Pure decision function — exported for unit testing. */
export function shouldHide(
  detected: CaptureAppStatus,
  enabled: boolean,
  currentlyHiding: boolean,
  isOverriding: boolean,
): { hide: boolean; beginOverride: boolean; endOverride: boolean } {
  if (!enabled) {
    return { hide: currentlyHiding, beginOverride: false, endOverride: false };
  }
  if (detected.running) {
    // A capture app is running — we should be hiding.
    if (!isOverriding) {
      // Not yet overriding — begin, and force hide on.
      return { hide: true, beginOverride: true, endOverride: false };
    }
    // Already overriding — stay hidden.
    return { hide: true, beginOverride: false, endOverride: false };
  }
  // No capture app running.
  if (isOverriding) {
    // We were overriding — stop, and restore the user's preference.
    return { hide: currentlyHiding, beginOverride: false, endOverride: true };
  }
  return { hide: currentlyHiding, beginOverride: false, endOverride: false };
}

export class CaptureAppAutoHideRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly opts: CaptureAppAutoHideOptions;
  private destroyed = false;
  /** True while the runner is actively overriding the user's preference. */
  private overriding = false;
  /** The preference to restore when the override ends. */
  private savedPreference = false;
  /** The last detected status (for diagnostics / avoiding duplicate events). */
  private lastMatched: string[] = [];

  constructor(opts: CaptureAppAutoHideOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.timer || this.destroyed) return;
    // Probe immediately, then on the interval.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
    this.destroyed = true;
    // If we were overriding, restore the user's preference on teardown.
    if (this.overriding) {
      this.opts.setHideFromCapture(this.savedPreference);
      this.overriding = false;
    }
  }

  /** Returns whether the runner is currently overriding the preference. */
  isOverriding(): boolean {
    return this.overriding;
  }

  /** Returns the saved preference that will be restored on override end. */
  getSavedPreference(): boolean {
    return this.savedPreference;
  }

  private async tick(): Promise<void> {
    if (this.destroyed) return;
    const enabled = this.opts.getEnabled();
    const currentlyHiding = this.opts.getHideFromCapture();
    const detector = this.opts.detector ?? detectCaptureApps;
    let detected: CaptureAppStatus;
    try {
      detected = await detector();
    } catch {
      return; // bridge unavailable — silent
    }

    const decision = shouldHide(detected, enabled, currentlyHiding, this.overriding);

    if (decision.beginOverride) {
      // Save the user's current preference before forcing hide on.
      this.savedPreference = currentlyHiding;
      this.overriding = true;
      if (!currentlyHiding) {
        this.opts.setHideFromCapture(true);
      }
      this.dispatch("kovy-capture-app-detected", {
        matched: detected.matched,
        hideFromCapture: true,
        source: "auto",
      });
    } else if (decision.endOverride) {
      // Restore the user's saved preference.
      this.overriding = false;
      if (currentlyHiding !== this.savedPreference) {
        this.opts.setHideFromCapture(this.savedPreference);
      }
      this.dispatch("kovy-capture-app-cleared", {
        matched: [],
        hideFromCapture: this.savedPreference,
        source: "auto",
      });
    } else if (
      this.overriding &&
      !currentlyHiding &&
      detected.running
    ) {
      // The user (or another code path) turned hiding back off while a
      // capture app is still running and we're overriding. Re-assert.
      this.opts.setHideFromCapture(true);
    }

    this.lastMatched = detected.matched;
  }

  private dispatch(type: string, detail: CaptureAppEventDetail): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
