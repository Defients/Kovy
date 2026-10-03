// ============================================================
// Intent Engine — goal-driven behavior layer for Kovy v9.0
//
// The Intent Engine sits above the BehaviorEngine and provides
// higher-level goals ("intents") that bias Kovy's behavior toward
// specific activities. Each intent has:
// - A kind (rest, play, explore, socialize, observe, nest)
// - A target position (where Kovy wants to go)
// - A progress value (0-1, how close she is to the goal)
// - A state bias that nudges the BehaviorEngine toward relevant states
//
// Intents shift over time based on:
// - Circadian phase (night → rest, day → explore/play)
// - Bond level (high bond → socialize)
// - Idle time (long idle → rest or nest)
// - Nearby toys (toys → play)
// - Surface mood (excited → play, calm → observe/rest)
// ============================================================

import type { IntentConfig, IntentOutput, IntentKind, Vec2, BehaviorState, SurfaceMood, BondLevel } from "@/store/types";
import { clamp, distance, randomRange } from "@/lib/utils";

const INTENT_BEHAVIOR_BIAS: Record<IntentKind, Partial<Record<BehaviorState, number>>> = {
  rest: { nap: 1.0, idle_float: 0.5, perch: 0.3 },
  play: { dance: 1.0, celebrate: 0.6, burst_orbit: 0.4 },
  explore: { wander: 1.0, inspect: 0.5, orbit: 0.3 },
  socialize: { celebrate: 0.8, dance: 0.5, perch: 0.3 },
  observe: { perch: 1.0, idle_float: 0.5, inspect: 0.3 },
  nest: { nap: 0.8, perch: 0.6, idle_float: 0.4 },
};

const INTENT_DURATION_RANGE: Record<IntentKind, [number, number]> = {
  rest: [60, 180],       // 1-3 minutes
  play: [30, 90],        // 30-90 seconds
  explore: [45, 120],    // 45-120 seconds
  socialize: [20, 60],   // 20-60 seconds
  observe: [30, 90],     // 30-90 seconds
  nest: [90, 240],       // 1.5-4 minutes
};

/// Intent thought messages spawned when intent changes
const INTENT_THOUGHTS: Record<IntentKind, string[]> = {
  rest: ["...time to rest", "...feeling sleepy", "...need a nap"],
  play: ["...want to play!", "...let's have fun", "...playtime!"],
  explore: ["...what's over there?", "...let's explore", "...curious..."],
  socialize: ["...where is everyone?", "...want company", "...miss you"],
  observe: ["...watching...", "...interesting...", "...just observing"],
  nest: ["...going home", "...cozy spot", "...time to settle"],
};

export interface IntentEngineInputs {
  circadianPhase: string;
  bondLevel: BondLevel | null;
  idleSeconds: number;
  surfaceMood: SurfaceMood;
  kovyPos: Vec2;
  screenBounds: { width: number; height: number };
  toyTarget: Vec2 | null;  // nearest toy or laser target
  nestPosition: Vec2 | null; // habitat home zone center
  dt: number;
}

export interface IntentThoughtSpawn {
  text: string;
  position: Vec2;
}

const NULL_OUTPUT: IntentOutput = {
  current: null,
  targetPosition: null,
  progress: 0,
  stateBias: {},
  since: 0,
};

export class IntentEngine {
  private config: IntentConfig | null = null;
  private output: IntentOutput = { ...NULL_OUTPUT };
  private elapsed = 0;
  private duration = 0;
  private thoughtPending: IntentThoughtSpawn | null = null;

  updateConfig(config: IntentConfig): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /// Returns a pending intent thought if one was spawned this update.
  /// The caller is responsible for spawning it in the ThoughtEngine.
  consumeThought(): IntentThoughtSpawn | null {
    const t = this.thoughtPending;
    this.thoughtPending = null;
    return t;
  }

  getOutput(): IntentOutput {
    return { ...this.output };
  }

  /// Force a specific intent (e.g., from context menu or external trigger).
  forceIntent(kind: IntentKind, target: Vec2 | null): void {
    this.output = {
      current: kind,
      targetPosition: target,
      progress: 0,
      stateBias: { ...INTENT_BEHAVIOR_BIAS[kind] },
      since: Date.now(),
    };
    this.elapsed = 0;
    this.duration = randomRange(...INTENT_DURATION_RANGE[kind]);
    if (this.config && Math.random() < this.config.thoughtChance) {
      const msgs = INTENT_THOUGHTS[kind];
      this.thoughtPending = {
        text: msgs[Math.floor(Math.random() * msgs.length)],
        position: { x: 0, y: 0 }, // caller fills in position
      };
    }
  }

  /// Main update — called every frame (or throttled).
  update(inputs: IntentEngineInputs): IntentOutput {
    if (!this.config?.enabled) {
      this.output = { ...NULL_OUTPUT };
      return this.output;
    }

    this.elapsed += inputs.dt;

    // Check if we need to pick a new intent
    if (!this.output.current || this.elapsed >= this.duration) {
      this.pickNewIntent(inputs);
    }

    // Update progress based on distance to target
    if (this.output.targetPosition && this.output.current) {
      const dist = distance(
        inputs.kovyPos.x, inputs.kovyPos.y,
        this.output.targetPosition.x, this.output.targetPosition.y,
      );
      // Progress is 1 - (dist / maxDist), clamped
      const maxDist = Math.max(inputs.screenBounds.width, inputs.screenBounds.height) * 0.5;
      this.output.progress = clamp(1 - dist / maxDist, 0, 1);
    } else {
      // No target → progress based on elapsed time
      this.output.progress = this.duration > 0 ? clamp(this.elapsed / this.duration, 0, 1) : 0;
    }

    return this.getOutput();
  }

  private pickNewIntent(inputs: IntentEngineInputs): void {
    const weights: Record<IntentKind, number> = {
      rest: 1,
      play: 1,
      explore: 1,
      socialize: 1,
      observe: 1,
      nest: 1,
    };

    // Circadian influence
    const phase = inputs.circadianPhase;
    if (phase === "night" || phase === "late_night" || phase === "deep_night") {
      weights.rest *= 3;
      weights.nest *= 2.5;
      weights.observe *= 0.5;
      weights.play *= 0.3;
    } else if (phase === "morning" || phase === "midday") {
      weights.explore *= 2;
      weights.play *= 1.5;
      weights.socialize *= 1.5;
    } else if (phase === "evening" || phase === "dusk") {
      weights.observe *= 1.5;
      weights.nest *= 1.5;
      weights.rest *= 1.2;
    }

    // Bond influence
    const bondLevel = inputs.bondLevel;
    if (bondLevel === "companion" || bondLevel === "best_friend") {
      weights.socialize *= 2;
      weights.play *= 1.3;
    } else if (bondLevel === "stranger" || bondLevel === "acquaintance") {
      weights.socialize *= 0.5;
      weights.observe *= 1.5;
    }

    // Idle influence
    if (inputs.idleSeconds > 120) {
      weights.rest *= 2;
      weights.nest *= 1.5;
      weights.explore *= 0.5;
    } else if (inputs.idleSeconds < 10) {
      weights.play *= 1.5;
      weights.explore *= 1.3;
    }

    // Mood influence
    const mood = inputs.surfaceMood;
    if (mood === "excited" || mood === "playful") {
      weights.play *= 2;
      weights.explore *= 1.5;
    } else if (mood === "calm" || mood === "sleepy") {
      weights.rest *= 2;
      weights.observe *= 1.5;
    } else if (mood === "curious") {
      weights.explore *= 2;
      weights.observe *= 1.3;
    } else if (mood === "focused") {
      weights.observe *= 2;
      weights.nest *= 1.2;
    }

    // Toy influence
    if (inputs.toyTarget) {
      weights.play *= 2.5;
    }

    // Nest availability
    if (!inputs.nestPosition) {
      weights.nest *= 0.3;
    }

    // Apply changeRate — lower changeRate = more inertia (more likely to keep current intent)
    if (this.output.current && this.config) {
      weights[this.output.current] *= 1 + (1 - this.config.changeRate) * 2;
    }

    // Weighted random selection
    const entries = Object.entries(weights) as [IntentKind, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    let chosen: IntentKind = "explore";
    for (const [kind, w] of entries) {
      r -= w;
      if (r <= 0) {
        chosen = kind;
        break;
      }
    }

    // Pick a target position based on the intent
    let target: Vec2 | null = null;
    switch (chosen) {
      case "rest":
      case "nest":
        target = inputs.nestPosition ?? {
          x: randomRange(50, inputs.screenBounds.width - 50),
          y: randomRange(50, inputs.screenBounds.height - 50),
        };
        break;
      case "play":
        target = inputs.toyTarget ?? {
          x: randomRange(100, inputs.screenBounds.width - 100),
          y: randomRange(100, inputs.screenBounds.height - 100),
        };
        break;
      case "explore":
        target = {
          x: randomRange(50, inputs.screenBounds.width - 50),
          y: randomRange(50, inputs.screenBounds.height - 50),
        };
        break;
      case "socialize":
        // Target near the center of the screen (where the user likely is)
        target = {
          x: inputs.screenBounds.width / 2 + randomRange(-100, 100),
          y: inputs.screenBounds.height / 2 + randomRange(-100, 100),
        };
        break;
      case "observe":
        // Stay near current position
        target = {
          x: inputs.kovyPos.x + randomRange(-50, 50),
          y: inputs.kovyPos.y + randomRange(-50, 50),
        };
        break;
    }

    this.output = {
      current: chosen,
      targetPosition: target,
      progress: 0,
      stateBias: { ...INTENT_BEHAVIOR_BIAS[chosen] },
      since: Date.now(),
    };
    this.elapsed = 0;
    this.duration = randomRange(...INTENT_DURATION_RANGE[chosen]);

    // Maybe spawn a thought
    if (this.config && Math.random() < this.config.thoughtChance) {
      const msgs = INTENT_THOUGHTS[chosen];
      this.thoughtPending = {
        text: msgs[Math.floor(Math.random() * msgs.length)],
        position: { x: inputs.kovyPos.x, y: inputs.kovyPos.y - 40 },
      };
    }
  }

  destroy(): void {
    this.config = null;
    this.output = { ...NULL_OUTPUT };
    this.elapsed = 0;
    this.duration = 0;
    this.thoughtPending = null;
  }
}
