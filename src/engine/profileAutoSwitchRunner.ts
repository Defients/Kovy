// ============================================================
// Profile Auto-Switch Runner — periodically evaluates auto-switch
// rules against the current system context (time, foreground app,
// idle seconds) and triggers a profile switch when a rule matches.
//
// This is the glue layer between the pure profileAutoSwitchEngine
// evaluator and the live overlay environment. It:
//   - polls context every `intervalMs` (default 10s)
//   - calls evaluateAutoSwitchRules with current context
//   - on a match, applies the target profile via configStore
//   - dispatches a `kovy-profile-auto-switch` custom event so the
//     overlay can show a toast and record stats
//   - suppresses re-switching to the already-active profile
//   - is fully cancellable via destroy()
// ============================================================

import { evaluateAutoSwitchRules } from "@/engine/profileAutoSwitchEngine";
import type { AutoSwitchRule, SavedProfile } from "@/store/types";
import { getForegroundApp, getIdleSeconds } from "@/lib/tauriBridge";

export interface AutoSwitchRunnerOptions {
  intervalMs: number;
  getRules: () => AutoSwitchRule[];
  getSavedProfiles: () => SavedProfile[];
  getActiveProfileId: () => string | null;
  applyProfile: (profile: SavedProfile) => void;
}

export interface AutoSwitchEventDetail {
  profileId: string;
  profileName: string;
  profileIcon: string;
  ruleId: string;
  reason: string;
  source: "auto";
}

export class ProfileAutoSwitchRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly opts: AutoSwitchRunnerOptions;
  private destroyed = false;

  constructor(opts: AutoSwitchRunnerOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.timer || this.destroyed) return;
    this.timer = setInterval(() => this.tick(), this.opts.intervalMs);
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
  }

  /** Single evaluation cycle — also exposed for testing. */
  async tick(): Promise<void> {
    if (this.destroyed) return;

    const rules = this.opts.getRules();
    if (rules.length === 0) return;

    const enabledRules = rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) return;

    const context = await this.gatherContext();
    const result = evaluateAutoSwitchRules(rules, context);
    if (!result.matchedRule || !result.profileId) return;

    // Don't switch to the already-active profile
    const activeId = this.opts.getActiveProfileId();
    if (activeId === result.profileId) return;

    // Find the target profile
    const profiles = this.opts.getSavedProfiles();
    const target = profiles.find((p) => p.id === result.profileId);
    if (!target) return; // rule references a deleted profile

    // Apply the profile
    this.opts.applyProfile(target);

    // Dispatch event for toast + stats
    const detail: AutoSwitchEventDetail = {
      profileId: target.id,
      profileName: target.name,
      profileIcon: target.icon,
      ruleId: result.matchedRule.id,
      reason: result.reason ?? "Auto-switch rule",
      source: "auto",
    };
    window.dispatchEvent(
      new CustomEvent("kovy-profile-auto-switch", { detail }),
    );
  }

  private async gatherContext() {
    const currentTime = new Date();

    let activeAppName: string | null = null;
    try {
      const fg = await getForegroundApp();
      activeAppName = fg?.processName ?? null;
    } catch {
      activeAppName = null;
    }

    let idleSeconds = 0;
    try {
      const idle = await getIdleSeconds();
      idleSeconds = idle ?? 0;
    } catch {
      idleSeconds = 0;
    }

    return { currentTime, activeAppName, idleSeconds };
  }
}
