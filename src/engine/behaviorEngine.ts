import type {
  BehaviorState, BehaviorConfig, Vec2, MotionTarget, SurfaceMood,
  HabitatConfig, HabitatHome, HabitatNode, MemoryInfluence, CircadianOutput,
  FocusTargetConfig,
} from "@/store/types";
import type { MoodModifiers } from "./moodEngine";
import type { FamilyInfluence } from "./familyEngine";
import { clamp, randomRange, distance } from "@/lib/utils";
import { randomPointOnRails, findNearestRailPoint, advanceAlongRail, sampleRailPath, nearestRailDistance } from "./railHelper";

export interface BehaviorContext {
  position: Vec2;
  screenWidth: number;
  screenHeight: number;
  cursorPosition: Vec2;
  activeTarget: MotionTarget | null;
  candidateTargets: MotionTarget[];
  moodModifiers: MoodModifiers;
  surfaceMood: SurfaceMood;
  config: BehaviorConfig;
  perchPosition: Vec2 | null;
  isInteracting: boolean;
  habitat: HabitatConfig;
  memoryInfluence: MemoryInfluence | null;
  familyInfluence: FamilyInfluence | null;
  circadianOutput: CircadianOutput | null;
  startleTriggered?: boolean;
  predictedPoints?: Vec2[];
  focusTarget?: FocusTargetInfo | null;
}

export interface FocusTargetInfo {
  windowCenter: Vec2 | null;
  cursorPosition: Vec2;
  isGamingMode: boolean;
  config: FocusTargetConfig;
}

export interface BehaviorOutput {
  newState: BehaviorState;
  targetPosition: Vec2 | null;
  stateTimer: number;
  newPerchPosition: Vec2 | null;
  // Hyper mode outputs
  dashActive: boolean;
  chainCount: number;
  dashCooldownTimer: number;
}

// Minimum time in each state before transition
const STATE_MIN_DURATION: Record<BehaviorState, number> = {
  idle_float: 2.0,
  wander: 1.5,
  perch: 3.0,
  inspect: 1.0,
  orbit: 2.0,
  follow_burst: 0.5,
  nap: 5.0,
  peek: 1.0,
  celebrate: 0.8,
  recover: 2.0,
  // Hyper states — shorter durations for kinetic feel
  dash_inspect: 0.2,
  burst_orbit: 0.3,
  chain_seek: 0.1,
  snap_perch: 0.4,
  // Circadian states
  startle: 0.3,
  dream: 8.0,
  // Expressive idle states (v5.7)
  stretch: 1.5,
  look_around: 2.0,
  yawn: 1.2,
  // v7.0 new states
  dance: 2.0,
  hide: 3.0,
  play_dead: 2.0,
  investigate: 1.5,
  meditate: 5.0,
};

export class BehaviorEngine {
  private stateTimer: number = 0;
  private currentState: BehaviorState = "idle_float";
  private wanderTarget: Vec2 | null = null;
  private orbitAngle: number = 0;
  private orbitRadius: number = 80;

  // Hyper mode state
  private dashCooldownTimer: number = 0;
  private chainCount: number = 0;
  private chainWindowTimer: number = 0; // tracks 10-second window for maxChainRate
  private chainWindowCount: number = 0; // chains in current window
  private dashTarget: Vec2 | null = null;
  private burstOrbitAngle: number = 0;
  private chainQueue: MotionTarget[] = [];
  // Rail-glide state: waypoints along a rail for smooth following
  private railGlideWaypoints: Vec2[] = [];
  private railGlideIndex: number = 0;

  // Startle state
  private startleRecoilDir: Vec2 = { x: 0, y: 0 };

  private isHyperMode(ctx: BehaviorContext): boolean {
    return ctx.config.preset === "hyper";
  }

  update(dt: number, ctx: BehaviorContext): BehaviorOutput {
    this.stateTimer += dt;
    this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);

    // Chain rate window: reset every 10 seconds
    this.chainWindowTimer += dt;
    if (this.chainWindowTimer >= 10) {
      this.chainWindowTimer = 0;
      this.chainWindowCount = 0;
    }

    const minDur = STATE_MIN_DURATION[this.currentState];
    let targetPosition: Vec2 | null = null;
    let newPerch = ctx.perchPosition;

    // Startle interrupt: overrides normal transitions if triggered
    if (ctx.startleTriggered && this.currentState !== "startle" && this.currentState !== "recover") {
      this.onStateExit(this.currentState);
      this.currentState = "startle";
      this.stateTimer = 0;
      this.onStateEnter("startle", ctx);
    }

    // Check for state transitions
    if (this.stateTimer >= minDur) {
      const next = this.isHyperMode(ctx)
        ? this.evaluateHyperTransition(ctx)
        : this.evaluateTransition(ctx);
      if (next !== this.currentState) {
        this.onStateExit(this.currentState);
        this.currentState = next;
        this.stateTimer = 0;
        this.onStateEnter(next, ctx);
      }
    }

    // Execute current state behavior
    switch (this.currentState) {
      case "idle_float":
        targetPosition = this.executeIdleFloat(ctx, dt);
        break;
      case "wander":
        targetPosition = this.executeWander(ctx, dt);
        break;
      case "perch":
        targetPosition = this.executePerch(ctx);
        newPerch = targetPosition;
        break;
      case "inspect":
        targetPosition = this.executeInspect(ctx);
        break;
      case "orbit":
        targetPosition = this.executeOrbit(ctx, dt);
        break;
      case "follow_burst":
        targetPosition = this.executeFollowBurst(ctx);
        break;
      case "nap":
        targetPosition = this.executeNap(ctx);
        break;
      case "peek":
        targetPosition = this.executePeek(ctx);
        break;
      case "celebrate":
        targetPosition = this.executeCelebrate(ctx, dt);
        break;
      case "recover":
        targetPosition = this.executeRecover(ctx);
        break;
      // --- Hyper mode states ---
      case "dash_inspect":
        targetPosition = this.executeDashInspect(ctx);
        break;
      case "burst_orbit":
        targetPosition = this.executeBurstOrbit(ctx, dt);
        break;
      case "chain_seek":
        targetPosition = this.executeChainSeek(ctx);
        break;
      case "snap_perch":
        targetPosition = this.executeSnapPerch(ctx);
        break;
      // --- Circadian states ---
      case "startle":
        targetPosition = this.executeStartle(ctx);
        break;
      case "dream":
        targetPosition = this.executeDream(ctx, dt);
        break;
      // --- Expressive idle states (v5.7) ---
      case "stretch":
        targetPosition = this.executeStretch(ctx);
        break;
      case "look_around":
        targetPosition = this.executeLookAround(ctx, dt);
        break;
      case "yawn":
        targetPosition = this.executeYawn(ctx);
        break;
      // --- v7.0 new states ---
      case "dance":
        targetPosition = this.executeDance(ctx, dt);
        break;
      case "hide":
        targetPosition = this.executeHide(ctx);
        break;
      case "play_dead":
        targetPosition = this.executePlayDead(ctx);
        break;
      case "investigate":
        targetPosition = this.executeInvestigate(ctx, dt);
        break;
      case "meditate":
        targetPosition = this.executeMeditate(ctx, dt);
        break;
    }

    // Vitality: micro-fidgets for resting states
    if (targetPosition) {
      const time = Date.now() / 1000;
      if (this.currentState === "perch" || this.currentState === "snap_perch") {
        targetPosition = {
          x: targetPosition.x + Math.sin(time * 0.25) * 1.5,
          y: targetPosition.y + Math.cos(time * 0.18) * 0.8,
        };
      } else if (this.currentState === "nap") {
        targetPosition = {
          x: targetPosition.x,
          y: targetPosition.y + Math.sin(time * 0.2) * 1.2,
        };
      }
    }

    // Apply family influence: chase override, territory pull
    if (ctx.familyInfluence) {
      if (ctx.familyInfluence.playfulChase && ctx.familyInfluence.chaseTargetPos) {
        // Chase overrides normal target during playful states
        targetPosition = ctx.familyInfluence.chaseTargetPos;
      }
      if (ctx.familyInfluence.territoryPull && targetPosition) {
        targetPosition = {
          x: targetPosition.x + ctx.familyInfluence.territoryPull.x,
          y: targetPosition.y + ctx.familyInfluence.territoryPull.y,
        };
      }
      if (ctx.familyInfluence.syncOrbit && ctx.familyInfluence.syncOrbitCenter && targetPosition) {
        // Blend toward sync orbit center
        targetPosition = {
          x: targetPosition.x * 0.6 + ctx.familyInfluence.syncOrbitCenter.x * 0.4,
          y: targetPosition.y * 0.6 + ctx.familyInfluence.syncOrbitCenter.y * 0.4,
        };
      }
    }

    // Apply habitat zone influence to target
    if (ctx.habitat.enabled && targetPosition) {
      targetPosition = this.applyHabitatInfluence(targetPosition, ctx);
    }

    // Apply focus target attraction (active window + cursor)
    if (ctx.focusTarget && ctx.focusTarget.config.enabled && targetPosition) {
      targetPosition = this.applyFocusAttraction(targetPosition, ctx);
    }

    // Apply cursor avoidance
    if (ctx.config.cursorAvoidRadius > 0 && !ctx.config.cursorCuriosity) {
      targetPosition = this.applyCursorAvoidance(
        targetPosition, ctx.position, ctx.cursorPosition,
        ctx.config.cursorAvoidRadius, ctx.screenWidth, ctx.screenHeight
      );
    }

    const isDashing = this.currentState === "dash_inspect" || this.currentState === "chain_seek";

    return {
      newState: this.currentState,
      targetPosition,
      stateTimer: this.stateTimer,
      newPerchPosition: newPerch,
      dashActive: isDashing,
      chainCount: this.chainCount,
      dashCooldownTimer: this.dashCooldownTimer,
    };
  }

  // --- State lifecycle hooks ---
  private onStateEnter(state: BehaviorState, ctx?: BehaviorContext) {
    switch (state) {
      case "dash_inspect":
        if (ctx?.activeTarget) {
          this.dashTarget = { ...ctx.activeTarget.position };
        }
        break;
      case "burst_orbit":
        this.burstOrbitAngle = Math.random() * Math.PI * 2;
        break;
      case "chain_seek":
        this.chainCount++;
        this.chainWindowCount++;
        if (ctx) this.pickNextChainTarget(ctx);
        break;
      case "startle": {
        if (!ctx) break;
        const stimulus = ctx.activeTarget?.position ?? ctx.cursorPosition;
        const dx = ctx.position.x - stimulus.x;
        const dy = ctx.position.y - stimulus.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        this.startleRecoilDir = { x: dx / len, y: dy / len };
        break;
      }
    }
  }

  private onStateExit(_state: BehaviorState) {
    // Currently no cleanup needed
  }

  // --- Hyper transition logic ---
  private evaluateHyperTransition(ctx: BehaviorContext): BehaviorState {
    const { activeTarget, config, candidateTargets } = ctx;
    const hyper = config.hyper;
    const hasStrongTarget = activeTarget && activeTarget.score > 0.25;
    const hasChainingTarget = candidateTargets.some(
      (t) => t.score >= hyper.targetChainThreshold &&
        (!activeTarget || t.regionId !== activeTarget.regionId)
    );
    const canChain = this.chainWindowCount < hyper.maxChainRate;
    const dashReady = this.dashCooldownTimer <= 0;

    // Overwhelm still forces recover
    if (ctx.surfaceMood === "overwhelmed") return "recover";

    // Current state specific transitions
    switch (this.currentState) {
      case "idle_float":
      case "wander":
        // In hyper mode, immediately dash to any decent target
        if (hasStrongTarget && dashReady) {
          this.dashCooldownTimer = hyper.dashCooldown;
          return "dash_inspect";
        }
        // Short idle before wandering
        if (this.currentState === "idle_float" && this.stateTimer > 1.5) {
          return "wander";
        }
        break;

      case "dash_inspect":
        // After arriving near target, briefly burst-orbit
        if (this.stateTimer > 0.3 && this.arrivedAtDashTarget(ctx)) {
          return "burst_orbit";
        }
        // Timeout: if dash takes too long, orbit anyway
        if (this.stateTimer > 1.5) {
          return "burst_orbit";
        }
        break;

      case "burst_orbit":
        // After orbit burst duration, chain or idle
        if (this.stateTimer > hyper.orbitBurstDuration) {
          if (hasChainingTarget && canChain && dashReady) {
            this.dashCooldownTimer = hyper.dashCooldown;
            return "chain_seek";
          }
          // Brief snap-perch between bursts
          if (Math.random() < 0.3) return "snap_perch";
          return "idle_float";
        }
        break;

      case "chain_seek":
        // Chain seek transitions to dash_inspect once we have a new target locked
        if (this.stateTimer > hyper.chainDelay) {
          if (activeTarget && activeTarget.score > hyper.targetChainThreshold) {
            this.dashCooldownTimer = hyper.dashCooldown;
            return "dash_inspect";
          }
          return "idle_float";
        }
        break;

      case "snap_perch":
        // Very brief perch, then look for next target
        if (this.stateTimer > 0.6 + Math.random() * 0.8) {
          if (hasStrongTarget && dashReady) {
            this.dashCooldownTimer = hyper.dashCooldown;
            return "dash_inspect";
          }
          return "idle_float";
        }
        break;

      case "perch":
        // Hyper mode doesn't perch long
        if (this.stateTimer > 1.5 + Math.random() * 1.5) {
          if (hasStrongTarget && dashReady) {
            this.dashCooldownTimer = hyper.dashCooldown;
            return "dash_inspect";
          }
          return "wander";
        }
        break;

      case "recover":
        if (this.stateTimer > 2) return "snap_perch";
        break;

      case "nap":
        // Hyper mode wakes quickly
        if (this.stateTimer > 4) return "idle_float";
        break;

      default:
        // Fallthrough to standard transitions for other states
        return this.evaluateTransition(ctx);
    }

    return this.currentState;
  }

  private evaluateTransition(ctx: BehaviorContext): BehaviorState {
    const { activeTarget, config, surfaceMood, memoryInfluence } = ctx;
    const mods = ctx.moodModifiers;
    const hasStrongTarget = activeTarget && activeTarget.score > 0.4;
    const hasWeakTarget = activeTarget && activeTarget.score > 0.15;

    // Social energy from circadian — modulates family-interaction transition probabilities
    const socialEnergy = ctx.circadianOutput?.socialEnergy ?? 0.5;
    const socialMod = socialEnergy > 0.7 ? 1.5 : socialEnergy < 0.3 ? 0.5 : 1.0;
    const hasFamily = !!ctx.familyInfluence;

    // Memory influence: bias curiosity and dwell from learned patterns
    const memoryCuriosityBoost = memoryInfluence?.curiosityBias ?? 0;
    const memoryComfortBoost = memoryInfluence ? (memoryInfluence.comfortLevel - 0.5) * 0.2 : 0;

    // Mood-driven transitions — these take priority over target/idle transitions
    if (surfaceMood === "overwhelmed") return "recover";
    if (surfaceMood === "sleepy" && this.currentState !== "nap" && this.currentState !== "recover") {
      // Lower threshold for idle-like states to reliably transition to nap
      const napThreshold = (this.currentState === "idle_float" || this.currentState === "perch") ? 3 : 6;
      if (this.stateTimer > napThreshold) return "nap";
    }
    if (surfaceMood === "shy" && this.nearCursor(ctx) && this.currentState !== "peek") return "peek";

    // Target-driven transitions
    if (hasStrongTarget) {
      // follow_burst takes priority over celebrate when family is present with high social energy
      if (surfaceMood === "excited" && !(hasFamily && socialEnergy > 0.7 && (this.currentState === "idle_float" || this.currentState === "wander"))) return "celebrate";
      const effectiveDwell = config.dwellTime * mods.dwellTimeMultiplier * (1 + memoryComfortBoost);
      
      if (this.currentState === "orbit") {
        return "orbit";
      }

      if (this.currentState === "inspect" && this.stateTimer > effectiveDwell) {
        return "orbit";
      }

      // follow_burst: excited + strong target + idle/wander → chance to burst
      if ((this.currentState === "idle_float" || this.currentState === "wander") && surfaceMood === "excited") {
        const burstChance = hasFamily ? 0.3 * socialMod : 0.3;
        if (Math.random() < burstChance) {
          return "follow_burst";
        }
      }

      return "inspect";
    }

    const effectiveCuriosity = config.curiosityStrength * mods.curiosityMultiplier + memoryCuriosityBoost;
    if (hasWeakTarget && Math.random() < effectiveCuriosity * 0.3) {
      return "inspect";
    }

    // Idle transitions
    if (this.currentState === "idle_float" && this.stateTimer > 4 + Math.random() * 4) {
      const roll = Math.random();
      const wanderChance = config.wanderAmount * mods.wanderRadius * 0.5;
      let perchChance = wanderChance + config.perchPreference * 0.4;
      // Low social energy: bias toward perch/nap when family is present
      if (hasFamily && socialEnergy < 0.3) {
        perchChance += 0.15;
      }
      // Expressive idle: stretch or look_around occasionally
      const stretchChance = perchChance + 0.08;
      const lookAroundChance = stretchChance + 0.07;
      if (roll < wanderChance) return "wander";
      if (roll < perchChance) return "perch";
      if (roll < stretchChance) return "stretch";
      if (roll < lookAroundChance) return "look_around";
      return "idle_float";
    }

    if (this.currentState === "wander" && this.stateTimer > 3 + Math.random() * 3) {
      if (Math.random() < config.returnToPerchTendency) return "perch";
      return "idle_float";
    }

    if (this.currentState === "perch" && this.stateTimer > 5 + Math.random() * 10) {
      const roll = Math.random();
      if (roll < config.wanderAmount * 0.3) return "wander";
      if (roll < config.wanderAmount * 0.3 + 0.06) return "stretch";
      return "idle_float";
    }

    if (this.currentState === "nap" && this.stateTimer > 10) {
      // Yawn on waking from nap
      if (Math.random() < 0.4) return "yawn";
      return "idle_float";
    }

    if (this.currentState === "recover" && this.stateTimer > 3) {
      return "perch";
    }

    // Dream state: enter from nap if circadian dream intensity is high
    if (this.currentState === "nap" && ctx.circadianOutput) {
      if (ctx.circadianOutput.dreamIntensity > 0.4 && this.stateTimer > 3) {
        return "dream";
      }
    }

    // Dream exits: wake gently when stimulation rises
    if (this.currentState === "dream" && this.stateTimer > 5) {
      if (surfaceMood !== "sleepy" || (ctx.circadianOutput?.drowsiness ?? 0) < 0.3) {
        return "idle_float";
      }
    }

    // Startle exits: brief recoil then curiosity
    if (this.currentState === "startle" && this.stateTimer > 0.5) {
      return ctx.activeTarget ? "inspect" : "idle_float";
    }

    // Circadian drowsiness: bias toward nap during low-energy phases
    if (ctx.circadianOutput && ctx.circadianOutput.drowsiness > 0.7) {
      if (this.currentState === "idle_float" && this.stateTimer > 6) {
        if (Math.random() < ctx.circadianOutput.drowsiness * 0.3) return "nap";
      }
    }

    if (this.currentState === "celebrate" && this.stateTimer > 1.2) {
      return "inspect";
    }

    // Expressive idle state transitions (v5.7)
    if (this.currentState === "stretch" && this.stateTimer > 1.5) {
      return "idle_float";
    }
    if (this.currentState === "look_around" && this.stateTimer > 2.0) {
      if (Math.random() < 0.3) return "wander";
      return "idle_float";
    }
    if (this.currentState === "yawn" && this.stateTimer > 1.2) {
      if (surfaceMood === "sleepy" && Math.random() < 0.5) return "nap";
      return "idle_float";
    }

    // v7.0 new state transitions
    // Dance: enter from idle when playful/excited and idle for 5s+
    if (this.currentState === "idle_float" && this.stateTimer > 5) {
      if ((surfaceMood === "playful" || surfaceMood === "excited") && Math.random() < 0.15) {
        return "dance";
      }
    }
    if (this.currentState === "dance" && this.stateTimer > 2.0) {
      return "idle_float";
    }

    // Hide: enter from shy/anxious when cursor is near
    if ((surfaceMood === "shy" || surfaceMood === "anxious") && this.nearCursor(ctx)) {
      if (this.currentState !== "hide" && this.currentState !== "recover" && this.stateTimer > 1.0) {
        return "hide";
      }
    }
    if (this.currentState === "hide" && this.stateTimer > 3.0) {
      if (!this.nearCursor(ctx)) return "peek";
      return "idle_float";
    }

    // Play dead: rare random event from idle_float after 10s
    if (this.currentState === "idle_float" && this.stateTimer > 10) {
      if (Math.random() < 0.02) return "play_dead";
    }
    if (this.currentState === "play_dead" && this.stateTimer > 2.0) {
      return "stretch";
    }

    // Investigate: enter from inspect when target score is moderate and curiosity is high
    if (this.currentState === "inspect" && this.stateTimer > 1.0) {
      if (hasWeakTarget && !hasStrongTarget && Math.random() < effectiveCuriosity * 0.4) {
        return "investigate";
      }
    }
    if (this.currentState === "investigate" && this.stateTimer > 1.5) {
      return "idle_float";
    }

    // Meditate: enter from perch when circadian drowsiness is moderate and mood is calm/content
    if (this.currentState === "perch" && this.stateTimer > 3.0) {
      const drowsiness = ctx.circadianOutput?.drowsiness ?? 0;
      if ((surfaceMood === "calm" || surfaceMood === "content") && drowsiness > 0.3 && drowsiness < 0.6 && Math.random() < 0.2) {
        return "meditate";
      }
    }
    if (this.currentState === "meditate" && this.stateTimer > 5.0) {
      return "idle_float";
    }

    if (this.currentState === "follow_burst" && this.stateTimer > 0.5) {
      if (hasStrongTarget) return "orbit";
      return "idle_float";
    }

    return this.currentState;
  }

  // --- Standard state executors ---

  private executeIdleFloat(ctx: BehaviorContext, _dt: number): Vec2 {
    const { position } = ctx;
    const time = Date.now() / 1000;
    const scale = ctx.moodModifiers.idleAnimationScale;

    // Multi-frequency drift: primary float loop + secondary organic wobble
    const primaryX = Math.sin(time * 0.4) * 8 * scale;
    const primaryY = Math.cos(time * 0.55) * 5 * scale;
    const secondaryX = Math.sin(time * 1.1 + 0.7) * 2 * scale;
    const secondaryY = Math.cos(time * 0.85 + 1.3) * 1.5 * scale;

    return {
      x: position.x + primaryX + secondaryX,
      y: position.y + primaryY + secondaryY,
    };
  }

  private executeWander(ctx: BehaviorContext, _dt: number): Vec2 {
    const { screenWidth, screenHeight } = ctx;
    const margin = 100;

    // Rail-glide: if we have queued waypoints, follow them
    if (this.railGlideWaypoints.length > 0 && this.railGlideIndex < this.railGlideWaypoints.length) {
      const wp = this.railGlideWaypoints[this.railGlideIndex];
      if (distance(ctx.position.x, ctx.position.y, wp.x, wp.y) < 30) {
        this.railGlideIndex++;
      }
      if (this.railGlideIndex < this.railGlideWaypoints.length) {
        return this.railGlideWaypoints[this.railGlideIndex];
      }
      // Finished rail glide
      this.railGlideWaypoints = [];
      this.railGlideIndex = 0;
    }

    if (!this.wanderTarget || distance(
      ctx.position.x, ctx.position.y,
      this.wanderTarget.x, this.wanderTarget.y
    ) < 30) {
      // Rail-guided wander: if habitat has rails and influence > 0, prefer rail paths
      const useRail = ctx.habitat.enabled
        && ctx.habitat.rails.length > 0
        && ctx.habitat.railInfluence > 0
        && Math.random() < ctx.habitat.railInfluence;

      if (useRail) {
        // Try rail-glide: sample a short path along the nearest rail
        const path = sampleRailPath(ctx.position, ctx.habitat.rails, 3, 80);
        if (path.length > 0) {
          this.railGlideWaypoints = path;
          this.railGlideIndex = 0;
          this.wanderTarget = path[path.length - 1];
          return path[0];
        }
        // Fallback: random point on rails
        const railPt = randomPointOnRails(ctx.habitat.rails);
        if (railPt) {
          this.wanderTarget = railPt;
          return this.wanderTarget;
        }
      }

      // Gaming prediction: occasionally target a predicted interest point
      if (ctx.predictedPoints && ctx.predictedPoints.length > 0 && Math.random() < 0.3) {
        this.wanderTarget = { ...ctx.predictedPoints[0] };
        return this.wanderTarget;
      }

      this.wanderTarget = {
        x: randomRange(margin, screenWidth - margin),
        y: randomRange(margin, screenHeight - margin),
      };
    }

    return this.wanderTarget;
  }

  private executePerch(ctx: BehaviorContext): Vec2 {
    // Prefer habitat homes if available
    if (ctx.habitat.enabled && ctx.habitat.homes.length > 0) {
      const home = this.pickClosestHome(ctx.position, ctx.habitat.homes);
      // Rail-routed perch return: if near a rail, glide toward home via rail
      if (ctx.habitat.rails.length > 0 && ctx.habitat.railInfluence > 0.3) {
        if (this.railGlideWaypoints.length > 0 && this.railGlideIndex < this.railGlideWaypoints.length) {
          const wp = this.railGlideWaypoints[this.railGlideIndex];
          if (distance(ctx.position.x, ctx.position.y, wp.x, wp.y) < 30) {
            this.railGlideIndex++;
          }
          if (this.railGlideIndex < this.railGlideWaypoints.length) {
            return this.railGlideWaypoints[this.railGlideIndex];
          }
          this.railGlideWaypoints = [];
          this.railGlideIndex = 0;
        }
        // Start a rail glide toward the home if we're near a rail
        const railDist = nearestRailDistance(ctx.position, ctx.habitat.rails);
        if (railDist < 150 && this.railGlideWaypoints.length === 0) {
          const path = sampleRailPath(ctx.position, ctx.habitat.rails, 2, 100);
          if (path.length > 0) {
            this.railGlideWaypoints = [...path, home];
            this.railGlideIndex = 0;
            return path[0];
          }
        }
      }
      return home;
    }

    if (ctx.perchPosition) return ctx.perchPosition;

    const { screenWidth, screenHeight } = ctx;
    const margin = 60;
    const positions = [
      { x: margin, y: margin },
      { x: screenWidth - margin, y: margin },
      { x: margin, y: screenHeight - margin },
      { x: screenWidth - margin, y: screenHeight - margin },
      { x: screenWidth / 2, y: margin },
      { x: screenWidth - margin, y: screenHeight / 2 },
    ];

    let closest = positions[0];
    let closestDist = Infinity;
    for (const p of positions) {
      const d = distance(ctx.position.x, ctx.position.y, p.x, p.y);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    }
    return closest;
  }

  private executeInspect(ctx: BehaviorContext): Vec2 | null {
    if (!ctx.activeTarget) return null;
    const t = ctx.activeTarget.position;
    const offset = 60;
    return {
      x: t.x + offset,
      y: t.y - offset * 0.5,
    };
  }

  private executeOrbit(ctx: BehaviorContext, dt: number): Vec2 | null {
    if (!ctx.activeTarget) return null;
    this.orbitAngle += dt * 0.8 * ctx.moodModifiers.speedMultiplier;
    const center = ctx.activeTarget.position;
    return {
      x: center.x + Math.cos(this.orbitAngle) * this.orbitRadius,
      y: center.y + Math.sin(this.orbitAngle) * this.orbitRadius * 0.6,
    };
  }

  private executeFollowBurst(ctx: BehaviorContext): Vec2 | null {
    if (!ctx.activeTarget) return null;
    return ctx.activeTarget.position;
  }

  private executeNap(ctx: BehaviorContext): Vec2 {
    // Prefer habitat home for napping
    if (ctx.habitat.enabled && ctx.habitat.homes.length > 0) {
      const home = this.pickClosestHome(ctx.position, ctx.habitat.homes);
      return { x: home.x, y: home.y + 5 };
    }
    const perch = ctx.perchPosition || {
      x: ctx.screenWidth - 80,
      y: ctx.screenHeight - 80,
    };
    return { x: perch.x, y: perch.y + 5 };
  }

  private executePeek(ctx: BehaviorContext): Vec2 {
    const edge = ctx.position.x < ctx.screenWidth / 2
      ? { x: 30, y: ctx.position.y }
      : { x: ctx.screenWidth - 30, y: ctx.position.y };
    return edge;
  }

  private executeCelebrate(ctx: BehaviorContext, _dt: number): Vec2 {
    const time = this.stateTimer * 8;
    return {
      x: ctx.position.x + Math.sin(time) * 15,
      y: ctx.position.y - Math.abs(Math.sin(time * 0.5)) * 20,
    };
  }

  private executeRecover(ctx: BehaviorContext): Vec2 {
    // Prefer habitat home for recovery
    if (ctx.habitat.enabled && ctx.habitat.homes.length > 0) {
      return this.pickClosestHome(ctx.position, ctx.habitat.homes);
    }
    const { screenWidth, screenHeight } = ctx;
    const margin = 50;
    const corners = [
      { x: margin, y: margin },
      { x: screenWidth - margin, y: margin },
      { x: margin, y: screenHeight - margin },
      { x: screenWidth - margin, y: screenHeight - margin },
    ];

    let closest = corners[0];
    let closestDist = Infinity;
    for (const c of corners) {
      const d = distance(ctx.position.x, ctx.position.y, c.x, c.y);
      if (d < closestDist) {
        closestDist = d;
        closest = c;
      }
    }
    return closest;
  }

  // --- Expressive idle state executors (v5.7) ---

  /** Stretch: stay in place, slight upward movement like reaching */
  private executeStretch(ctx: BehaviorContext): Vec2 {
    const t = this.stateTimer / 1.5; // normalized progress 0-1
    const stretchHeight = Math.sin(t * Math.PI) * 12; // arc up and back
    return {
      x: ctx.position.x,
      y: ctx.position.y - stretchHeight,
    };
  }

  /** Look around: stay in place, slight horizontal sway like scanning */
  private executeLookAround(ctx: BehaviorContext, _dt: number): Vec2 {
    const time = this.stateTimer;
    const swayX = Math.sin(time * 2.5) * 6;
    const swayY = Math.sin(time * 1.8) * 2;
    return {
      x: ctx.position.x + swayX,
      y: ctx.position.y + swayY,
    };
  }

  /** Yawn: stay in place, slight downward drift like settling */
  private executeYawn(ctx: BehaviorContext): Vec2 {
    const t = this.stateTimer / 1.2;
    const settleY = Math.sin(t * Math.PI) * 4; // slight dip
    return {
      x: ctx.position.x,
      y: ctx.position.y + settleY,
    };
  }

  // --- v7.0 new state executors ---

  /** Dance: bouncing figure-8 pattern around current position */
  private executeDance(ctx: BehaviorContext, _dt: number): Vec2 {
    const t = this.stateTimer * 4;
    const amplitude = 12 + ctx.moodModifiers.speedMultiplier * 6;
    return {
      x: ctx.position.x + Math.sin(t) * amplitude,
      y: ctx.position.y - Math.abs(Math.sin(t * 2)) * 10,
    };
  }

  /** Hide: move to nearest screen edge, offset slightly off-screen */
  private executeHide(ctx: BehaviorContext): Vec2 {
    const onLeft = ctx.position.x < ctx.screenWidth / 2;
    const targetX = onLeft ? -15 : ctx.screenWidth + 15;
    // Blend toward edge based on state timer for smooth transition
    const progress = Math.min(1, this.stateTimer / 1.0);
    return {
      x: ctx.position.x + (targetX - ctx.position.x) * progress,
      y: ctx.position.y,
    };
  }

  /** Play dead: stay in place, slight downward drift */
  private executePlayDead(ctx: BehaviorContext): Vec2 {
    const t = this.stateTimer / 2.0;
    const drift = Math.sin(t * Math.PI) * 6;
    return {
      x: ctx.position.x,
      y: ctx.position.y + drift,
    };
  }

  /** Investigate: spiral toward target position with decreasing radius */
  private executeInvestigate(ctx: BehaviorContext, dt: number): Vec2 {
    const target = ctx.activeTarget?.position ?? ctx.position;
    this.orbitAngle += dt * 2.0;
    // Radius shrinks from 60 to 20 over the state duration
    const progress = Math.min(1, this.stateTimer / 1.5);
    const radius = 60 - progress * 40;
    // Spiral toward target
    const blend = 0.3 + progress * 0.5;
    return {
      x: target.x + Math.cos(this.orbitAngle) * radius * (1 - blend) + (ctx.position.x - target.x) * 0,
      y: target.y + Math.sin(this.orbitAngle) * radius * 0.6 * (1 - blend),
    };
  }

  /** Meditate: slow vertical bob at current position, very small amplitude */
  private executeMeditate(ctx: BehaviorContext, _dt: number): Vec2 {
    const time = this.stateTimer;
    const bobY = Math.sin(time * 0.5) * 3;
    const bobX = Math.sin(time * 0.3) * 1.5;
    return {
      x: ctx.position.x + bobX,
      y: ctx.position.y + bobY,
    };
  }

  // --- Hyper mode state executors ---

  /** Dash straight at a target with burst intent */
  private executeDashInspect(ctx: BehaviorContext): Vec2 | null {
    if (this.dashTarget) return this.dashTarget;
    if (!ctx.activeTarget) return null;
    return ctx.activeTarget.position;
  }

  /** Tight fast orbit around current target — kinetic energy burst */
  private executeBurstOrbit(ctx: BehaviorContext, dt: number): Vec2 | null {
    const target = ctx.activeTarget;
    if (!target) return ctx.position;

    // Fast tight orbit: speed = 3x normal, radius = 50% normal
    const speed = 2.4 * ctx.moodModifiers.speedMultiplier;
    this.burstOrbitAngle += dt * speed;
    const burstRadius = 50 + Math.sin(this.stateTimer * 4) * 15;

    return {
      x: target.position.x + Math.cos(this.burstOrbitAngle) * burstRadius,
      y: target.position.y + Math.sin(this.burstOrbitAngle) * burstRadius * 0.7,
    };
  }

  /** Quick scan/seek phase between chains — move toward next queued target, rail-aware */
  private executeChainSeek(ctx: BehaviorContext): Vec2 | null {
    let targetPos: Vec2 | null = null;
    // If we have a chain target queued, move toward it
    if (this.chainQueue.length > 0) {
      targetPos = this.chainQueue[0].position;
    } else if (ctx.candidateTargets.length > 0) {
      targetPos = ctx.candidateTargets[0].position;
    }

    if (!targetPos) return ctx.position;

    // Rail-aware chain: if near a rail, use rail waypoint as intermediate
    if (ctx.habitat.enabled && ctx.habitat.rails.length > 0 && ctx.habitat.railInfluence > 0.4) {
      const nearest = findNearestRailPoint(ctx.position, ctx.habitat.rails);
      if (nearest && nearest.dist < 100) {
        // Advance along the rail toward the target direction
        const advanced = advanceAlongRail(nearest.rail, nearest.segmentIndex, nearest.point, 120);
        // Blend between rail point and actual target
        return {
          x: advanced.x * 0.6 + targetPos.x * 0.4,
          y: advanced.y * 0.6 + targetPos.y * 0.4,
        };
      }
    }

    return targetPos;
  }

  /** Brief intentional pause/perch between bursts — gives rhythm */
  private executeSnapPerch(ctx: BehaviorContext): Vec2 {
    // Orbit node preference if habitat has nodes
    if (ctx.habitat.enabled && ctx.habitat.nodes.length > 0) {
      return this.pickClosestNode(ctx.position, ctx.habitat.nodes);
    }
    // Stay at current position with slight settle
    return {
      x: ctx.position.x,
      y: ctx.position.y + 2,
    };
  }

  // --- Hyper helpers ---

  private arrivedAtDashTarget(ctx: BehaviorContext): boolean {
    if (!this.dashTarget) return true;
    return distance(ctx.position.x, ctx.position.y, this.dashTarget.x, this.dashTarget.y) < 50;
  }

  private pickNextChainTarget(ctx: BehaviorContext) {
    const threshold = ctx.config.hyper.targetChainThreshold;
    const current = ctx.activeTarget;

    this.chainQueue = ctx.candidateTargets
      .filter((t) => t.score >= threshold && (!current || t.regionId !== current.regionId))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // --- Habitat helpers ---

  private pickClosestHome(pos: Vec2, homes: HabitatHome[]): Vec2 {
    let closest = homes[0].position;
    let closestDist = Infinity;
    for (const h of homes) {
      const d = distance(pos.x, pos.y, h.position.x, h.position.y);
      if (d < closestDist) {
        closestDist = d;
        closest = h.position;
      }
    }
    return { ...closest };
  }

  private pickClosestNode(pos: Vec2, nodes: HabitatNode[]): Vec2 {
    let closest = nodes[0].position;
    let closestDist = Infinity;
    for (const n of nodes) {
      const d = distance(pos.x, pos.y, n.position.x, n.position.y);
      if (d < closestDist) {
        closestDist = d;
        closest = n.position;
      }
    }
    return { ...closest };
  }

  /** Adjust target based on habitat zones (softened in Gaming mode) */
  private applyHabitatInfluence(target: Vec2, ctx: BehaviorContext): Vec2 {
    let tx = target.x;
    let ty = target.y;

    // In Gaming mode, reduce habitat influence to prioritize window/cursor
    const habitatSoftening = ctx.focusTarget?.isGamingMode
      ? ctx.focusTarget.config.habitatSoftening
      : 0;

    for (const zone of ctx.habitat.zones) {
      const inZone = this.pointInRect(target, zone.rect);
      const posInZone = this.pointInRect(ctx.position, zone.rect);

      if (!inZone && !posInZone) continue;

      const cx = zone.rect.x + zone.rect.w / 2;
      const cy = zone.rect.y + zone.rect.h / 2;
      const effectiveStrength = zone.strength * (1 - habitatSoftening);

      switch (zone.type) {
        case "attract":
          // Pull target toward zone center
          tx += (cx - tx) * effectiveStrength * 0.15;
          ty += (cy - ty) * effectiveStrength * 0.15;
          break;
        case "avoid":
          // Push target away from zone center
          tx -= (cx - tx) * effectiveStrength * 0.2;
          ty -= (cy - ty) * effectiveStrength * 0.2;
          break;
        case "chill":
          // Reduce movement magnitude toward zone center (dampen)
          tx = tx + (cx - tx) * effectiveStrength * 0.05;
          ty = ty + (cy - ty) * effectiveStrength * 0.05;
          break;
        case "hyper":
          // Zones don't directly move target but are read by the transition evaluator
          // Add slight jitter for visual energy
          tx += (Math.random() - 0.5) * 8 * effectiveStrength;
          ty += (Math.random() - 0.5) * 8 * effectiveStrength;
          break;
      }
    }

    return {
      x: clamp(tx, 30, ctx.screenWidth - 30),
      y: clamp(ty, 30, ctx.screenHeight - 30),
    };
  }

  /** Blend target toward active window center and cursor (focus attraction) */
  private applyFocusAttraction(target: Vec2, ctx: BehaviorContext): Vec2 {
    const ft = ctx.focusTarget!;
    const cfg = ft.config;

    let tx = target.x;
    let ty = target.y;

    // Compute attraction strengths (boosted in Gaming mode)
    const windowStr = ft.windowCenter
      ? cfg.windowAttraction + (ft.isGamingMode ? cfg.gamingWindowBoost : 0)
      : 0;
    const cursorStr = cfg.cursorAttraction + (ft.isGamingMode ? cfg.gamingCursorBoost : 0);

    // Blend target toward window center
    if (ft.windowCenter && windowStr > 0) {
      tx += (ft.windowCenter.x - tx) * windowStr * cfg.blendFactor;
      ty += (ft.windowCenter.y - ty) * windowStr * cfg.blendFactor;
    }

    // Blend target toward cursor (slightly weaker than window)
    if (cursorStr > 0) {
      tx += (ft.cursorPosition.x - tx) * cursorStr * cfg.blendFactor * 0.7;
      ty += (ft.cursorPosition.y - ty) * cursorStr * cfg.blendFactor * 0.7;
    }

    return { x: tx, y: ty };
  }

  private pointInRect(p: Vec2, rect: { x: number; y: number; w: number; h: number }): boolean {
    return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
  }

  // --- Utility ---

  private applyCursorAvoidance(
    target: Vec2 | null,
    _position: Vec2,
    cursor: Vec2,
    radius: number,
    screenW: number,
    screenH: number
  ): Vec2 | null {
    if (!target) return null;
    const dist = distance(target.x, target.y, cursor.x, cursor.y);
    if (dist >= radius) return target;

    const dx = target.x - cursor.x;
    const dy = target.y - cursor.y;
    const len = Math.max(dist, 1);
    const pushDist = radius - dist + 20;

    return {
      x: clamp(target.x + (dx / len) * pushDist, 30, screenW - 30),
      y: clamp(target.y + (dy / len) * pushDist, 30, screenH - 30),
    };
  }

  private nearCursor(ctx: BehaviorContext): boolean {
    return distance(
      ctx.position.x, ctx.position.y,
      ctx.cursorPosition.x, ctx.cursorPosition.y
    ) < ctx.config.cursorAvoidRadius * 1.5;
  }

  forceState(state: BehaviorState, ctx?: BehaviorContext) {
    this.onStateExit(this.currentState);
    this.currentState = state;
    this.stateTimer = 0;
    this.onStateEnter(state, ctx);
  }

  getState(): BehaviorState {
    return this.currentState;
  }

  getStateTimer(): number {
    return this.stateTimer;
  }

  /** Check if position is inside a hyper-type habitat zone */
  isInHyperZone(pos: Vec2, habitat: HabitatConfig): boolean {
    if (!habitat.enabled) return false;
    return habitat.zones.some(
      (z) => z.type === "hyper" && this.pointInRect(pos, z.rect)
    );
  }

  // --- Circadian state executors ---

  /** Startle: sharp recoil away from stimulus */
  private executeStartle(ctx: BehaviorContext): Vec2 {
    const recoilDist = 80 + this.stateTimer * 40; // rapid initial recoil
    const decay = Math.max(0, 1 - this.stateTimer * 2); // fade recoil over 0.5s
    return {
      x: clamp(
        ctx.position.x + this.startleRecoilDir.x * recoilDist * decay,
        30, ctx.screenWidth - 30
      ),
      y: clamp(
        ctx.position.y + this.startleRecoilDir.y * recoilDist * decay,
        30, ctx.screenHeight - 30
      ),
    };
  }

  /** Dream: gentle floating with slow orbital drift, biased toward home */
  private executeDream(ctx: BehaviorContext, dt: number): Vec2 {
    this.orbitAngle += dt * 0.15; // very slow orbit
    const dreamRadius = 30 + Math.sin(this.stateTimer * 0.3) * 15;

    // Dream near home if available
    let center = ctx.perchPosition ?? ctx.position;
    if (ctx.habitat.enabled && ctx.habitat.homes.length > 0) {
      center = this.pickClosestHome(ctx.position, ctx.habitat.homes);
    }

    return {
      x: center.x + Math.cos(this.orbitAngle) * dreamRadius,
      y: center.y + Math.sin(this.orbitAngle * 0.7) * dreamRadius * 0.5 + 3, // slight downward settle
    };
  }

  /** Check if position is inside a chill-type habitat zone */
  isInChillZone(pos: Vec2, habitat: HabitatConfig): boolean {
    if (!habitat.enabled) return false;
    return habitat.zones.some(
      (z) => z.type === "chill" && this.pointInRect(pos, z.rect)
    );
  }
}
