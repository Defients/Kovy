// ============================================================
// Simulation Harness — headless engine runner for testing
// Initializes all engines with default config and runs N frames
// with mock motion data. Collects metrics for assertions.
// ============================================================

import { BehaviorEngine } from "@/engine/behaviorEngine";
import { MovementController } from "@/engine/movementController";
import { MotionInterestEngine } from "@/engine/motionInterest";
import {
  updateMoodState,
  deriveSurfaceMood,
  getMoodModifiers,
  type MoodStimuli,
} from "@/engine/moodEngine";
import { CircadianEngine, NULL_CIRCADIAN_OUTPUT } from "@/engine/circadianEngine";
import { EmoteEngine } from "@/engine/emoteEngine";
import { AtmosphereEngine } from "@/engine/atmosphereEngine";
import { BondEngine } from "@/engine/bondEngine";
import { InteractionEngine } from "@/engine/interactionEngine";
import { MilestoneEngine } from "@/engine/milestoneEngine";
import { FamilyEngine } from "@/engine/familyEngine";
import { GamingEngine, NULL_GAMING_OUTPUT } from "@/engine/gamingEngine";
import { ThoughtEngine, NULL_THOUGHT_OUTPUT, type ThoughtOutput } from "@/engine/thoughtEngine";
import { WhisperEngine, NULL_WHISPER_OUTPUT, type WhisperOutput } from "@/engine/whisperEngine";
import { FocusEngine, NULL_FOCUS_OUTPUT, type FocusOutput } from "@/engine/focusEngine";
import { IdleEngine, NULL_IDLE_OUTPUT, type IdleOutput } from "@/engine/idleEngine";
import { GrowthEngine, NULL_GROWTH_OUTPUT, type GrowthOutput } from "@/engine/growthEngine";
import { SeasonalEngine, NULL_SEASONAL_OUTPUT, type SeasonalOutput } from "@/engine/seasonalEngine";
import { CelebrationEngine, NULL_CELEBRATION_OUTPUT, type CelebrationOutput } from "@/engine/celebrationEngine";
import { StatsEngine, NULL_STATS_OUTPUT, type StatsOutput } from "@/engine/statsEngine";
import { DEFAULT_CONFIG, DEFAULT_INTERNAL_MOOD } from "@/store/defaults";
import { FOUNDER_ID } from "@/store/entityStore";
import type {
  KovyConfig, Vec2, CircadianOutput, GamingOutput,
  SurfaceMood, BehaviorState, BondLevel,
} from "@/store/types";

export interface SimMetrics {
  framesRun: number;
  fps: number;
  behaviorStates: Record<string, number>;
  moodDistribution: Record<string, number>;
  milestonesUnlocked: string[];
  bondLevel: BondLevel | null;
  hasNaN: boolean;
  crashes: string[];
  durationMs: number;
  // v7.0 engine metrics
  thoughtsSpawned: number;
  whispersSpawned: number;
  focusSessionStarted: boolean;
  idleBehaviorsTriggered: number;
  growthStage: string;
  seasonalEventsActive: number;
  celebrationsTriggered: number;
  statsRecorded: boolean;
}

export interface SimOptions {
  frames?: number;
  config?: Partial<KovyConfig>;
  mockMotionActivity?: number;
  mockTargetScore?: number;
  enableMilestones?: boolean;
  enableBond?: boolean;
  enableGaming?: boolean;
  enableCircadian?: boolean;
}

export class SimulationHarness {
  private behavior: BehaviorEngine;
  private movement: MovementController;
  private motion: MotionInterestEngine;
  private circadian: CircadianEngine;
  private emote: EmoteEngine;
  private atmosphere: AtmosphereEngine;
  private bond: BondEngine;
  private interaction: InteractionEngine;
  private milestone: MilestoneEngine;
  private family: FamilyEngine;
  private gaming: GamingEngine;
  // v7.0 engines
  private thought: ThoughtEngine;
  private whisper: WhisperEngine;
  private focus: FocusEngine;
  private idle: IdleEngine;
  private growth: GrowthEngine;
  private seasonal: SeasonalEngine;
  private celebration: CelebrationEngine;
  private stats: StatsEngine;

  private config: KovyConfig;
  private position: Vec2 = { x: 400, y: 300 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private behaviorState: BehaviorState = "idle_float";
  private surfaceMood: SurfaceMood = "calm";
  private internalMood = { ...DEFAULT_INTERNAL_MOOD };
  private cursorPosition: Vec2 = { x: 500, y: 400 };
  private perchPosition: Vec2 | null = null;

  private cachedCircadianOutput: CircadianOutput = { ...NULL_CIRCADIAN_OUTPUT };
  private cachedGamingOutput: GamingOutput = { ...NULL_GAMING_OUTPUT };

  constructor(options?: SimOptions) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options?.config ?? {}),
    } as KovyConfig;

    this.behavior = new BehaviorEngine();
    this.movement = new MovementController();
    this.motion = new MotionInterestEngine();
    this.circadian = new CircadianEngine();
    this.emote = new EmoteEngine();
    this.atmosphere = new AtmosphereEngine();
    this.bond = new BondEngine(this.config.bond);
    this.interaction = new InteractionEngine();
    this.milestone = new MilestoneEngine();
    this.family = new FamilyEngine();
    this.gaming = new GamingEngine();
    // v7.0 engines
    this.thought = new ThoughtEngine();
    this.whisper = new WhisperEngine();
    this.focus = new FocusEngine();
    this.idle = new IdleEngine();
    this.growth = new GrowthEngine();
    this.seasonal = new SeasonalEngine();
    this.celebration = new CelebrationEngine();
    this.stats = new StatsEngine();

    // Apply config overrides
    if (options?.enableMilestones === false) {
      this.config.milestone.enabled = false;
    }
    if (options?.enableBond === false) {
      this.config.bond.enabled = false;
    }
    if (options?.enableGaming) {
      this.config.gaming.enabled = true;
    }
    if (options?.enableCircadian === false) {
      this.config.circadian.enabled = false;
    }
  }

  /** Run N frames of simulation and return metrics */
  run(options?: SimOptions): SimMetrics {
    const frames = options?.frames ?? 1000;
    const mockActivity = options?.mockMotionActivity ?? 0.5;
    const mockScore = options?.mockTargetScore ?? 0.6;
    const startTime = performance.now();

    const behaviorStates: Record<string, number> = {};
    const moodDistribution: Record<string, number> = {};
    const crashes: string[] = [];
    let hasNaN = false;
    let frameCount = 0;
    const dt = 1 / 60;
    // v7.0 metrics trackers
    let thoughtsSpawned = 0;
    let whispersSpawned = 0;
    let focusSessionStarted = false;
    let idleBehaviorsTriggered = 0;
    let celebrationsTriggered = 0;
    let prevThoughtBubbles = 0;
    let prevWhisperMessages = 0;
    let prevFocusState = "unfocused";
    let prevIdleBehavior: string | null = null;

    for (let i = 0; i < frames; i++) {
      try {
        // Feed mock motion data
        this.motion.processRegions(
          [{
            id: 0,
            centroid: { x: 600, y: 400 },
            boundingBox: { x: 550, y: 350, w: 100, h: 100 },
            area: 10000,
            energy: mockActivity * 100,
            persistence: 0.8,
            novelty: 0.5,
            score: mockScore,
          }],
          dt,
          this.config.vision,
          this.cursorPosition,
          1920, 1080,
        );

        // Circadian update
        if (this.config.circadian.enabled) {
          this.cachedCircadianOutput = this.circadian.update(
            dt, this.config.circadian, mockActivity, mockScore,
          );
        }

        // Mood update
        if (this.config.mood.enabled) {
          const stimuli: MoodStimuli = {
            motionActivity: mockActivity,
            hasNovelTarget: i % 100 === 0,
            userInteracted: i % 200 === 0,
            targetScore: mockScore,
            boredomRate: this.config.behavior.boredomRate,
          };
          this.internalMood = updateMoodState(
            this.internalMood, dt, this.config.mood, stimuli,
            null, this.cachedCircadianOutput,
          );
          this.surfaceMood = deriveSurfaceMood(this.internalMood, this.config.mood);
        }

        const moodMods = getMoodModifiers(this.surfaceMood);

        // Bond + interaction
        if (this.config.bond.enabled) {
          this.interaction.update(dt, this.cursorPosition, this.position, true);
          if (i % 300 === 0) this.bond.recordPoke();
          if (i % 100 === 0) this.bond.recordHover();
          if (i % 500 === 0) this.bond.recordSwipe();
          if (i % 60 === 0) this.bond.tick();
        }

        // Gaming
        if (this.config.gaming.enabled) {
          this.cachedGamingOutput = this.gaming.update(
            dt, this.config.gaming,
            [], null,
            mockActivity,
            this.position, this.velocity,
          );
        }

        // Behavior
        const behaviorResult = this.behavior.update(dt, {
          position: this.position,
          screenWidth: 1920,
          screenHeight: 1080,
          cursorPosition: this.cursorPosition,
          activeTarget: { position: { x: 600, y: 400 }, score: mockScore, regionId: 0, age: 0 },
          candidateTargets: [],
          moodModifiers: moodMods,
          surfaceMood: this.surfaceMood,
          config: this.config.behavior,
          perchPosition: this.perchPosition,
          isInteracting: false,
          habitat: this.config.habitat,
          memoryInfluence: null,
          familyInfluence: null,
          circadianOutput: this.cachedCircadianOutput,
        });

        this.behaviorState = behaviorResult.newState;
        if (behaviorResult.newPerchPosition) {
          this.perchPosition = behaviorResult.newPerchPosition;
        }

        // Movement
        const movement = this.movement.update(
          dt, behaviorResult.targetPosition,
          moodMods.speedMultiplier * this.config.behavior.attractionStrength,
          1920, 1080,
          { dashActive: behaviorResult.dashActive, dashStrength: 0.7 },
        );

        this.position = movement.position;
        this.velocity = movement.velocity;

        // Check for NaN
        if (isNaN(this.position.x) || isNaN(this.position.y) ||
            isNaN(this.velocity.x) || isNaN(this.velocity.y)) {
          hasNaN = true;
        }

        // Milestones
        if (this.config.milestone.enabled) {
          this.milestone.recordActiveTime(dt);
          this.milestone.recordBehaviorState(this.behaviorState);
          this.milestone.recordMood(this.surfaceMood);
          if (i % 60 === 0) {
            const bondState = this.bond.getState();
            this.milestone.recordStreak(bondState.streakDays);
            this.milestone.recordBondLevel(bondState.bondLevel);
          }
        }

        // v7.0 engine updates (throttled like KovyRenderer)
        // Thought engine (~5s)
        if (this.config.thought.enabled && i % 300 === 0) {
          const thoughtOut = this.thought.update(5, this.config.thought, this.surfaceMood, this.behaviorState, this.position, this.config.behavior?.preset, undefined);
          if (thoughtOut.bubbles.length > prevThoughtBubbles) {
            thoughtsSpawned += thoughtOut.bubbles.length - prevThoughtBubbles;
            this.stats.recordThought();
            this.milestone.recordThought();
          }
          prevThoughtBubbles = thoughtOut.bubbles.length;
        }

        // Whisper engine (~1s)
        if (this.config.whisper.enabled && i % 60 === 0) {
          const whisperOut = this.whisper.update(1, this.config.whisper, this.position, this.config.behavior?.preset);
          if (whisperOut.messages.length > prevWhisperMessages) {
            whispersSpawned += whisperOut.messages.length - prevWhisperMessages;
            this.stats.recordWhisper();
            this.milestone.recordWhisper();
          }
          prevWhisperMessages = whisperOut.messages.length;
        }

        // Focus engine (~2s)
        if (this.config.focus.enabled && i % 120 === 0) {
          const focusOut = this.focus.update(2, this.config.focus, mockActivity, false);
          if (focusOut.state !== "unfocused" && prevFocusState === "unfocused") {
            focusSessionStarted = true;
          }
          if (focusOut.state !== prevFocusState) {
            if (prevFocusState !== "unfocused" && focusOut.state === "unfocused") {
              const sessionMin = this.focus.currentSessionMinutes;
              if (sessionMin > 0.5) {
                this.stats.recordFocusMinutes(sessionMin);
                this.milestone.recordFocusSession();
              }
            }
            prevFocusState = focusOut.state;
          }
        }

        // Idle engine (~3s)
        if (this.config.idle.enabled && i % 180 === 0) {
          // Simulate idle: low motion after first 10s
          const idleMotion = i > 600 ? 0.05 : mockActivity;
          this.idle.update(3, this.config.idle, idleMotion).then((idleOut) => {
            if (idleOut.isIdle && idleOut.currentBehavior && idleOut.currentBehavior !== prevIdleBehavior) {
              idleBehaviorsTriggered++;
              prevIdleBehavior = idleOut.currentBehavior;
            }
            if (idleOut.isIdle) {
              this.stats.recordIdleMinutes(3 / 60);
            }
          }).catch(() => { /* ignore in test */ });
        }

        // Growth engine (~10s)
        if (this.config.growth.enabled && i % 600 === 0) {
          const growthOut = this.growth.update(10, this.config.growth);
          if (growthOut.stage) {
            this.milestone.recordGrowthStage(growthOut.stage);
            this.stats.recordGrowthEvent();
          }
        }

        // Seasonal engine (~30s)
        if (this.config.seasonal.enabled && i % 1800 === 0) {
          const seasonalOut = this.seasonal.update(this.config.seasonal);
          if (seasonalOut.activeEvents.length > 0) {
            this.milestone.recordSeasonalEvent();
            this.stats.recordSeasonalEvent();
          }
        }

        // Celebration engine (~60s)
        if (this.config.celebration.enabled && i % 3600 === 0) {
          const celebOut = this.celebration.update(this.config.celebration, 0, this.config.behavior?.preset);
          if (celebOut.pendingEvent) {
            celebrationsTriggered++;
            this.milestone.recordCelebration();
          }
        }

        // Stats recording
        if (this.config.stats.enabled && i % 3600 === 0) {
          this.stats.update(this.config.stats);
        }

        // Track distributions
        behaviorStates[this.behaviorState] = (behaviorStates[this.behaviorState] ?? 0) + 1;
        moodDistribution[this.surfaceMood] = (moodDistribution[this.surfaceMood] ?? 0) + 1;
        frameCount++;
      } catch (e) {
        crashes.push(`Frame ${i}: ${e instanceof Error ? e.message : String(e)}`);
        if (crashes.length > 10) break;
      }
    }

    const durationMs = performance.now() - startTime;
    const fps = frameCount > 0 ? (frameCount / (durationMs / 1000)) : 0;

    return {
      framesRun: frameCount,
      fps,
      behaviorStates,
      moodDistribution,
      milestonesUnlocked: this.config.milestone.enabled
        ? Object.keys(this.milestone.getState().unlocked)
        : [],
      bondLevel: this.config.bond.enabled
        ? this.bond.getState().bondLevel
        : null,
      hasNaN,
      crashes,
      durationMs,
      // v7.0 metrics
      thoughtsSpawned,
      whispersSpawned,
      focusSessionStarted,
      idleBehaviorsTriggered,
      growthStage: this.config.growth.enabled
        ? this.growth.update(0, this.config.growth).stage
        : "",
      seasonalEventsActive: this.config.seasonal.enabled
        ? this.seasonal.update(this.config.seasonal).activeEvents.length
        : 0,
      celebrationsTriggered,
      statsRecorded: this.config.stats.enabled,
    };
  }

  /** Get individual engines for direct testing */
  getEngines() {
    return {
      behavior: this.behavior,
      movement: this.movement,
      motion: this.motion,
      circadian: this.circadian,
      emote: this.emote,
      atmosphere: this.atmosphere,
      bond: this.bond,
      interaction: this.interaction,
      milestone: this.milestone,
      family: this.family,
      gaming: this.gaming,
      // v7.0 engines
      thought: this.thought,
      whisper: this.whisper,
      focus: this.focus,
      idle: this.idle,
      growth: this.growth,
      seasonal: this.seasonal,
      celebration: this.celebration,
      stats: this.stats,
    };
  }

  /** Get current state */
  getState() {
    return {
      position: this.position,
      velocity: this.velocity,
      behaviorState: this.behaviorState,
      surfaceMood: this.surfaceMood,
      internalMood: this.internalMood,
    };
  }

  /** Reset all engines */
  reset() {
    this.behavior = new BehaviorEngine();
    this.movement = new MovementController();
    this.motion = new MotionInterestEngine();
    this.circadian = new CircadianEngine();
    this.emote = new EmoteEngine();
    this.atmosphere = new AtmosphereEngine();
    this.bond = new BondEngine(this.config.bond);
    this.interaction = new InteractionEngine();
    this.milestone = new MilestoneEngine();
    this.family = new FamilyEngine();
    this.gaming = new GamingEngine();
    // v7.0 engines
    this.thought = new ThoughtEngine();
    this.whisper = new WhisperEngine();
    this.focus = new FocusEngine();
    this.idle = new IdleEngine();
    this.growth = new GrowthEngine();
    this.seasonal = new SeasonalEngine();
    this.celebration = new CelebrationEngine();
    this.stats = new StatsEngine();
    this.position = { x: 400, y: 300 };
    this.behaviorState = "idle_float";
    this.surfaceMood = "calm";
    this.internalMood = { ...DEFAULT_INTERNAL_MOOD };
    this.perchPosition = null;
    this.cachedCircadianOutput = { ...NULL_CIRCADIAN_OUTPUT };
    this.cachedGamingOutput = { ...NULL_GAMING_OUTPUT };
  }
}
