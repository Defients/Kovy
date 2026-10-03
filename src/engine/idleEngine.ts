// ============================================================
// Kovy Idle Detection Engine — detects user idle periods
// and triggers idle behaviors for Kovy.
// Uses Tauri idle_seconds command or falls back to motion.
// ============================================================

import type { IdleConfig, IdleBehavior } from "@/store/types";
import { getIdleSeconds } from "@/lib/tauriBridge";

export interface IdleOutput {
  enabled: boolean;
  isIdle: boolean;
  idleSeconds: number;
  currentBehavior: IdleBehavior | null;
}

export const NULL_IDLE_OUTPUT: IdleOutput = {
  enabled: false,
  isIdle: false,
  idleSeconds: 0,
  currentBehavior: null,
};

export class IdleEngine {
  private idleSeconds = 0;
  private currentBehavior: IdleBehavior | null = null;
  private behaviorTimer = 0;
  private fallbackIdleSeconds = 0;
  private lastMotionLevel = 0;
  private fallbackLogged = false;

  async update(dt: number, config: IdleConfig, motionLevel: number): Promise<IdleOutput> {
    if (!config.enabled) return NULL_IDLE_OUTPUT;

    // Try to get real idle time from Tauri
    const idle = await getIdleSeconds();
    if (idle !== null) {
      this.idleSeconds = idle;
    } else {
      // Fallback: estimate from motion level
      if (!this.fallbackLogged) {
        this.fallbackLogged = true;
      }
      if (motionLevel < 0.02) {
        this.fallbackIdleSeconds += dt;
      } else {
        this.fallbackIdleSeconds = 0;
      }
      this.idleSeconds = this.fallbackIdleSeconds;
    }

    this.lastMotionLevel = motionLevel;
    const isIdle = this.idleSeconds >= config.idleThresholdSec;

    if (isIdle && config.idleBehaviors.length > 0) {
      this.behaviorTimer += dt;
      // Switch behavior every 10-20 seconds
      if (this.behaviorTimer > 10 + Math.random() * 10 || !this.currentBehavior) {
        this.behaviorTimer = 0;
        const idx = Math.floor(Math.random() * config.idleBehaviors.length);
        this.currentBehavior = config.idleBehaviors[idx];
      }
    } else {
      this.currentBehavior = null;
      this.behaviorTimer = 0;
    }

    return {
      enabled: true,
      isIdle,
      idleSeconds: this.idleSeconds,
      currentBehavior: this.currentBehavior,
    };
  }
}
