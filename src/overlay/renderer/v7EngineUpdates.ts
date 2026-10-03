// ============================================================
// v7.0 Engine Updates — extracted from KovyRenderer
// Throttled updates for focus, idle, seasonal, growth, stats,
// personality, celebration, thought, whisper, ambient sound,
// entity relations, profiles, and audio reactivity engines.
// ============================================================

import type { EngineContainer } from "../engineManager";
import type { FrameState } from "./frameState";
import type { KovyConfig, SurfaceMood, Vec2, BehaviorPreset } from "@/store/types";
import { useKovyStore } from "@/store/kovyStore";
import { useEntityStore, FOUNDER_ID } from "@/store/entityStore";
import { clamp, kovyLog } from "@/lib/utils";
import { ParticleBurstRenderer } from "@/overlay/ParticleBurst";

export interface V7UpdateInputs {
  engines: EngineContainer;
  frameState: FrameState;
  config: KovyConfig;
  dt: number;
  ctx: CanvasRenderingContext2D | null;
  mountedRef: { current: boolean };
  state: ReturnType<typeof useKovyStore.getState>;
  entityState: ReturnType<typeof useEntityStore.getState>;
  moodHue: number;
  position: Vec2;
  surfaceMood: SurfaceMood;
  behaviorState: string;
  behaviorPreset: BehaviorPreset;
}

export interface V7UpdateOutputs {
  focusOut: FrameState["focusOutput"];
  focusSuppressSound: boolean;
}

/**
 * Run all v7.0 throttled engine updates.
 * Returns the current focus output and sound suppression flag for use
 * in subsequent rendering.
 */
export function updateV7Engines(inputs: V7UpdateInputs): V7UpdateOutputs {
  const { engines, frameState, config, dt, ctx, mountedRef, state, entityState, moodHue, position, surfaceMood, behaviorState, behaviorPreset } = inputs;

  // --- Focus engine (~2s) ---
  frameState.focusUpdateAccum += dt;
  if (engines.focus && config.focus.enabled && frameState.focusUpdateAccum >= 2) {
    frameState.focusUpdateAccum = 0;
    const motionLevel = engines.motion?.getMotionActivity() ?? 0;
    const focusOut = engines.focus.update(2, config.focus, motionLevel, frameState.appProfileUpdateAccum < 3.0);
    frameState.focusOutput = focusOut;

    if (frameState.prevFocusState !== "unfocused" && focusOut.state === "unfocused") {
      const sessionMin = engines.focus.currentSessionMinutes;
      if (sessionMin > 0.5 && engines.stats && config.stats.enabled) {
        engines.stats.recordFocusMinutes(sessionMin);
      }
      if (sessionMin > 1 && engines.milestone && config.milestone.enabled) {
        engines.milestone.recordFocusSession();
      }
      if (sessionMin > 1 && engines.journal && config.journal.enabled) {
        engines.journal.recordFocusSession(sessionMin, state.surfaceMood);
      }
      if (sessionMin > 1 && !config.appearance.reducedMotion) {
        engines.behavior?.forceState("celebrate");
        if (ctx && !engines.particleBurst) engines.particleBurst = new ParticleBurstRenderer();
        engines.particleBurst?.spawnBurst(state.position.x, state.position.y - 20, "confetti", `hsla(45, 80%, 70%, 0.8)`);
      }
    }
    if (focusOut.suggestedBehavior && focusOut.state !== "unfocused") {
      engines.behavior?.forceState(focusOut.suggestedBehavior);
    }
    frameState.prevFocusState = focusOut.state;
  }
  const focusOut = frameState.focusOutput;
  const focusSuppressSound = focusOut.enabled && focusOut.suppressSound;

  // Apply focus suggested mood
  if (focusOut.enabled && focusOut.suggestedMood && focusOut.state !== "unfocused") {
    const mood = state.internalMood;
    if (focusOut.suggestedMood === "determined") {
      mood.stimulation = clamp(mood.stimulation + 0.02 * dt, 0, 1);
    } else if (focusOut.suggestedMood === "focused") {
      mood.stimulation = clamp(mood.stimulation - 0.01 * dt, 0, 1);
      mood.comfort = clamp(mood.comfort + 0.01 * dt, 0, 1);
    }
    state.setInternalMood(mood);
  }

  // --- Idle engine (~3s) ---
  frameState.idleUpdateAccum += dt;
  if (engines.idle && config.idle.enabled && frameState.idleUpdateAccum >= 3) {
    frameState.idleUpdateAccum = 0;
    const motionLevel = engines.motion?.getMotionActivity() ?? 0;
    engines.idle.update(3, config.idle, motionLevel).then((idleOut) => {
      if (!mountedRef.current) return;
      frameState.idleOutput = idleOut;
      if (idleOut.isIdle && idleOut.currentBehavior && config.idle.enabled) {
        const idleBehaviorMap: Record<string, "nap" | "idle_float" | "wander" | "perch" | "dream"> = {
          explore: "wander", play_alone: "idle_float", nap: "nap",
          dream: "dream", wait_at_door: "perch",
        };
        const mapped = idleBehaviorMap[idleOut.currentBehavior];
        if (mapped) engines.behavior?.forceState(mapped);
      }
      if (idleOut.isIdle) {
        frameState.idleMinutesAccum += 3 / 60;
        if (frameState.idleMinutesAccum >= 1) {
          if (engines.stats && config.stats.enabled) {
            engines.stats.recordIdleMinutes(frameState.idleMinutesAccum);
          }
          frameState.idleMinutesAccum = 0;
        }
      }
    }).catch(() => { kovyLog.warn("Idle engine update failed"); });
  }

  // --- Seasonal engine (~60s) ---
  frameState.seasonalUpdateAccum += dt;
  if (engines.seasonal && config.seasonal.enabled && frameState.seasonalUpdateAccum >= 60) {
    frameState.seasonalUpdateAccum = 0;
    const seasonalOut = engines.seasonal.update(config.seasonal);
    frameState.seasonalOutput = seasonalOut;

    const eventsKey = seasonalOut.activeEvents.map(e => e.id).join(",");
    if (eventsKey !== frameState.prevSeasonalEvents) {
      for (const evt of seasonalOut.activeEvents) {
        if (engines.journal && config.journal.enabled) {
          engines.journal.recordSeasonalEvent(evt.name, evt.icon, state.surfaceMood);
        }
        if (engines.milestone && config.milestone.enabled) {
          engines.milestone.recordSeasonalEvent();
        }
        if (engines.stats && config.stats.enabled) {
          engines.stats.recordSeasonalEvent();
        }
      }
      frameState.prevSeasonalEvents = eventsKey;
    }

    if (seasonalOut.currentSeason !== frameState.prevSeason) {
      frameState.prevSeason = seasonalOut.currentSeason;
      const mood = state.internalMood;
      switch (seasonalOut.currentSeason) {
        case "spring": mood.curiosity = clamp(mood.curiosity + 0.05, 0, 1); break;
        case "summer": mood.stimulation = clamp(mood.stimulation + 0.05, 0, 1); break;
        case "autumn": mood.comfort = clamp(mood.comfort + 0.05, 0, 1); break;
        case "winter": mood.comfort = clamp(mood.comfort + 0.03, 0, 1); break;
      }
      state.setInternalMood(mood);
    }
  }

  // --- Growth engine (~30s) ---
  frameState.growthUpdateAccum += dt;
  if (engines.growth && config.growth.enabled && frameState.growthUpdateAccum >= 30) {
    frameState.growthUpdateAccum = 0;
    const growthOut = engines.growth.update(30, config.growth);
    frameState.growthOutput = growthOut;

    if (growthOut.stage !== frameState.prevGrowthStage) {
      if (frameState.prevGrowthStage !== "") {
        if (engines.journal && config.journal.enabled) {
          engines.journal.recordGrowthEvent(growthOut.stage, growthOut.ageDays, state.surfaceMood);
        }
        if (engines.milestone && config.milestone.enabled) {
          engines.milestone.recordGrowthStage(growthOut.stage);
        }
        if (engines.stats && config.stats.enabled) {
          engines.stats.recordGrowthEvent();
        }
        if (engines.celebration && config.celebration.enabled && !config.appearance.reducedMotion) {
          if (ctx && !engines.particleBurst) engines.particleBurst = new ParticleBurstRenderer();
          engines.particleBurst?.spawnBurst(state.position.x, state.position.y - 20, "heart", `hsla(120, 70%, 70%, 0.8)`);
        }
      }
      frameState.prevGrowthStage = growthOut.stage;
    }
  }

  // --- Stats engine (~10s) ---
  frameState.statsUpdateAccum += dt;
  if (engines.stats && config.stats.enabled && frameState.statsUpdateAccum >= 10) {
    frameState.statsUpdateAccum = 0;
    frameState.statsOutput = engines.stats.update(config.stats);
  }

  // --- Personality evolution (~60s) ---
  frameState.personalityUpdateAccum += dt;
  if (engines.personalityEvolution && config.personalityEvolution.enabled && frameState.personalityUpdateAccum >= 60) {
    frameState.personalityUpdateAccum = 0;
    engines.personalityEvolution.recordMood(state.surfaceMood);
    const persOut = engines.personalityEvolution.update(60, config.personalityEvolution);
    if (persOut.enabled) {
      entityState.setEntityPersonality(FOUNDER_ID, persOut.offsets);
    }
  }

  // --- Celebration engine (~5s) ---
  frameState.celebrationUpdateAccum += dt;
  if (engines.celebration && config.celebration.enabled && frameState.celebrationUpdateAccum >= 5) {
    frameState.celebrationUpdateAccum = 0;
    const focusMin = engines.focus?.currentSessionMinutes ?? 0;
    const celebOut = engines.celebration.update(config.celebration, focusMin, config.behavior.preset);
    frameState.celebrationOutput = celebOut;

    if (celebOut.pendingEvent) {
      const evt = engines.celebration.consumeEvent();
      if (evt) {
        if (!config.appearance.reducedMotion) {
          engines.behavior?.forceState("celebrate");
          if (ctx) {
            if (!engines.particleBurst) engines.particleBurst = new ParticleBurstRenderer();
            engines.particleBurst.spawnBurst(
              state.position.x, state.position.y - 20,
              "confetti",
              `hsla(${moodHue}, 80%, 70%, 0.8)`,
            );
          }
        }
        if (engines.journal && config.journal.enabled) {
          engines.journal.recordCelebration(evt.message, state.surfaceMood);
        }
        if (engines.milestone && config.milestone.enabled) {
          engines.milestone.recordCelebration();
        }
      }
    }
  }

  // --- Thought engine (per-frame) — suppress during focus ---
  if (engines.thought && config.thought.enabled) {
    const thoughtCfg = focusOut.enabled && focusOut.state !== "unfocused"
      ? { ...config.thought, frequency: config.thought.frequency * 0.2 }
      : config.thought;
    const thoughtOut = engines.thought.update(dt, thoughtCfg, surfaceMood, behaviorState as any, position, behaviorPreset as BehaviorPreset, engines.weather?.getState().current);
    frameState.thoughtOutput = thoughtOut;

    const newCount = thoughtOut.bubbles.length;
    if (newCount > frameState.thoughtSpawnCount) {
      if (engines.stats && config.stats.enabled) {
        for (let i = frameState.thoughtSpawnCount; i < newCount; i++) {
          engines.stats.recordThought();
        }
      }
      if (engines.milestone && config.milestone.enabled) {
        engines.milestone.recordThought();
      }
    }
    frameState.thoughtSpawnCount = newCount;
  }

  // --- Whisper engine (~1s) — suppress during focus ---
  if (engines.whisper && config.whisper.enabled && !focusSuppressSound) {
    frameState.whisperUpdateAccum += dt;
    if (frameState.whisperUpdateAccum >= 1) {
      frameState.whisperUpdateAccum = 0;
      const whisperCfg = focusOut.enabled && focusOut.state !== "unfocused"
        ? { ...config.whisper, frequency: 0 }
        : config.whisper;
      const whisperOut = engines.whisper.update(1, whisperCfg, position, behaviorPreset as BehaviorPreset);
      frameState.whisperOutput = whisperOut;

      const newCount = whisperOut.messages.length;
      if (newCount > frameState.whisperSpawnCount) {
        if (engines.stats && config.stats.enabled) {
          for (let i = frameState.whisperSpawnCount; i < newCount; i++) {
            engines.stats.recordWhisper();
            const msg = whisperOut.messages[i];
            if (msg && (msg.category === "encouragement" || msg.category === "comfort")) {
              if (engines.journal && config.journal.enabled) {
                engines.journal.recordWhisper(msg.text, msg.category, state.surfaceMood);
              }
            }
          }
        }
        if (engines.milestone && config.milestone.enabled) {
          engines.milestone.recordWhisper();
        }
      }
      frameState.whisperSpawnCount = newCount;
    }
  }

  // --- Ambient sound engine (~5s) ---
  frameState.ambientSoundUpdateAccum += dt;
  if (engines.ambientSound && config.ambientSound.enabled && frameState.ambientSoundUpdateAccum >= 5) {
    frameState.ambientSoundUpdateAccum = 0;
    engines.ambientSound.update(config.ambientSound);
  }

  // --- Entity relations engine (~10s) ---
  frameState.entityRelationsUpdateAccum += dt;
  if (engines.entityRelations && config.entityRelations.enabled && frameState.entityRelationsUpdateAccum >= 10) {
    frameState.entityRelationsUpdateAccum = 0;
    const entityIds = Object.keys(entityState.entities) as string[];
    const relOut = engines.entityRelations.update(10, config.entityRelations, entityIds);
    frameState.relationsOutput = relOut;

    if (relOut.relations.length > 0 && engines.stats && config.stats.enabled) {
      engines.stats.recordFamilyInteraction();
    }
    if (relOut.relations.length > 0 && engines.milestone && config.milestone.enabled) {
      engines.milestone.recordFamilyInteraction();
    }
  }

  // --- Profiles engine (~5s) ---
  frameState.profilesUpdateAccum += dt;
  if (engines.profiles && frameState.profilesUpdateAccum >= 5) {
    frameState.profilesUpdateAccum = 0;
    engines.profiles.update(config.profiles);
  }

  // --- Audio reactivity engine (per-frame, init is async) ---
  if (engines.audioReactivity && config.audioReactivity.enabled) {
    if (!frameState.audioReactivityInitAttempted) {
      frameState.audioReactivityInitAttempted = true;
      engines.audioReactivity.init().catch(() => { kovyLog.warn("Audio reactivity init failed (microphone permission?)"); });
    }
    const audioOut = engines.audioReactivity.update(dt, config.audioReactivity);
    frameState.audioReactivityOutput = audioOut;
  }

  return { focusOut, focusSuppressSound };
}
