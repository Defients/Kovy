// ============================================================
// Kovy Gaming Engine — adaptive salience, short-horizon prediction,
// excitement state, residue burst generation, and hyper modulation.
//
// This is a local, bounded, heuristic/predictive system.
// It is NOT machine learning, neural training, or reinforcement learning.
// It uses recent motion history, centroid velocity, and linear
// extrapolation to produce believable adaptive behavior.
// ============================================================

import type {
  GamingConfig, GamingOutput, GamingResidueBurst, GamingResidueType,
  GamingVisualStyle, MotionTarget, Vec2,
} from "@/store/types";
import { clamp } from "@/lib/utils";

// --- Hotspot history entry ---

interface HotspotEntry {
  position: Vec2;
  score: number;
  timestamp: number; // monotonic seconds
}

// --- Prediction point with confirmation tracking ---

interface PredictionPoint {
  position: Vec2;
  createdAt: number;
  confirmed: boolean;
}

// --- Style-specific residue type palettes ---

const STYLE_RESIDUE_TYPES: Record<GamingVisualStyle, GamingResidueType[]> = {
  surge: ["afterimage", "velocity_smear", "pulse_echo", "impact_ring", "energy_shard"],
  feral: ["arc_slash", "ghost_shell", "ribbon_streak", "energy_shard", "velocity_smear"],
  arcade: ["impact_ring", "pulse_echo", "afterimage", "ribbon_streak", "arc_slash"],
  neon: ["afterimage", "pulse_echo", "energy_shard", "impact_ring"],
  retro: ["impact_ring", "pulse_echo", "velocity_smear"],
};

const STYLE_COLORS: Record<GamingVisualStyle, string[]> = {
  surge: [
    "hsl(200, 80%, 60%)", "hsl(180, 70%, 55%)", "hsl(220, 75%, 65%)",
    "hsl(160, 60%, 50%)", "hsl(240, 60%, 70%)",
  ],
  feral: [
    "hsl(0, 75%, 55%)", "hsl(20, 80%, 55%)", "hsl(340, 70%, 50%)",
    "hsl(40, 85%, 55%)", "hsl(10, 65%, 60%)",
  ],
  arcade: [
    "hsl(280, 75%, 60%)", "hsl(300, 70%, 55%)", "hsl(320, 80%, 60%)",
    "hsl(260, 65%, 65%)", "hsl(180, 80%, 55%)",
  ],
  neon: [
    "hsl(320, 100%, 60%)", "hsl(280, 100%, 55%)", "hsl(180, 100%, 50%)",
    "hsl(60, 100%, 55%)", "hsl(0, 100%, 55%)",
  ],
  retro: [
    "hsl(120, 60%, 45%)", "hsl(0, 60%, 45%)", "hsl(240, 60%, 50%)",
    "hsl(200, 50%, 40%)", "hsl(40, 70%, 50%)",
  ],
};

// --- Null output ---

export const NULL_GAMING_OUTPUT: GamingOutput = {
  enabled: false,
  excitement: 0,
  predictionConfidence: 0,
  predictedPoints: [],
  adaptiveBias: 0,
  hyperBoost: 0,
  elasticity: 0,
  freeformWobble: 0,
  residueBursts: [],
};

// --- Gaming Engine ---

export class GamingEngine {
  // Rolling hotspot history (ring buffer)
  private hotspotHistory: HotspotEntry[] = [];
  private readonly MAX_HISTORY = 60;

  // Centroid velocity (EMA-smoothed)
  private centroidVelocity: Vec2 = { x: 0, y: 0 };
  private lastCentroid: Vec2 | null = null;

  // Prediction
  private predictions: PredictionPoint[] = [];
  private readonly MAX_PREDICTIONS = 3;
  private readonly PREDICTION_CONFIRM_RADIUS = 120; // pixels
  private readonly PREDICTION_LIFETIME = 2.0; // seconds

  // Confirmation scoring
  private confirmCount = 0;
  private missCount = 0;
  private predictionConfidence = 0; // 0-1, EMA

  // Excitement state
  private excitement = 0; // 0-1

  // Combo system (v7.0)
  private comboCount = 0;
  private comboTimer = 0;
  private readonly COMBO_WINDOW = 3.0; // seconds to maintain combo

  // Timing
  private time = 0;
  private predictionSpawnAccum = 0;
  private residueSpawnAccum = 0;

  // Active state
  private active = false;

  // --- Public API ---

  toggle(): boolean {
    this.active = !this.active;
    if (!this.active) {
      this.excitement = 0;
      this.predictionConfidence = 0;
      this.predictions = [];
    }
    return this.active;
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.excitement = 0;
      this.predictionConfidence = 0;
      this.predictions = [];
    }
  }

  /**
   * Main update tick. Call every frame from the renderer.
   * Returns the full GamingOutput for this frame.
   */
  update(
    dt: number,
    config: GamingConfig,
    candidateTargets: readonly MotionTarget[],
    activeTarget: MotionTarget | null,
    motionActivity: number,
    kovyPosition: Vec2,
    kovyVelocity: Vec2,
  ): GamingOutput {
    if (!this.active || !config.enabled) {
      // Decay excitement even when disabled for clean transitions
      this.excitement = Math.max(0, this.excitement - dt * 0.5);
      this.comboCount = 0;
      this.comboTimer = 0;
      return { ...NULL_GAMING_OUTPUT };
    }

    this.time += dt;

    // --- 1. Record hotspot history ---
    this.recordHotspots(candidateTargets, activeTarget);

    // --- 2. Update centroid velocity ---
    this.updateCentroidVelocity(dt, candidateTargets, activeTarget);

    // --- 3. Spawn & check predictions ---
    this.predictionSpawnAccum += dt;
    if (this.predictionSpawnAccum >= 0.5) {
      this.predictionSpawnAccum = 0;
      this.spawnPredictions(config);
    }
    this.checkPredictionConfirmations(candidateTargets, activeTarget);
    this.expirePredictions();

    // --- 4. Update prediction confidence ---
    this.updatePredictionConfidence(dt);

    // --- 5. Update excitement ---
    this.updateExcitement(dt, config, motionActivity);

    // --- 5b. Update combo system (v7.0) ---
    if (config.comboSystem) {
      this.comboTimer -= dt;
      if (motionActivity > 0.5 && this.comboTimer <= 0) {
        this.comboCount++;
        this.comboTimer = this.COMBO_WINDOW;
      }
      if (this.comboTimer <= -this.COMBO_WINDOW) {
        this.comboCount = 0;
      }
      // Combo boosts excitement
      const comboMultiplier = 1 + Math.min(this.comboCount * 0.05, 1.0);
      this.excitement = Math.min(1, this.excitement * comboMultiplier);
    }

    // --- 6. Compute adaptive bias ---
    const adaptiveBias = this.computeAdaptiveBias(config);

    // --- 7. Compute hyper boost ---
    const hyperBoost = this.excitement * config.hyperBlend;

    // --- 8. Compute deformation outputs ---
    const elasticity = this.excitement * config.elasticDeformation;
    const freeformWobble = this.excitement * config.freeformWobble;

    // --- 9. Spawn residue bursts ---
    const residueBursts = this.spawnResidueBursts(
      dt, config, kovyPosition, kovyVelocity
    );

    return {
      enabled: true,
      excitement: this.excitement,
      predictionConfidence: this.predictionConfidence,
      predictedPoints: this.predictions
        .filter(p => !p.confirmed)
        .map(p => p.position),
      adaptiveBias,
      hyperBoost,
      elasticity,
      freeformWobble,
      residueBursts,
      comboCount: config.comboSystem ? this.comboCount : 0,
    } as GamingOutput;
  }

  /** Get current excitement (for external queries) */
  getExcitement(): number {
    return this.excitement;
  }

  /** Get current prediction confidence (for external queries) */
  getPredictionConfidence(): number {
    return this.predictionConfidence;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  /** Full reset */
  reset(): void {
    this.active = false;
    this.hotspotHistory = [];
    this.centroidVelocity = { x: 0, y: 0 };
    this.comboCount = 0;
    this.comboTimer = 0;
    this.lastCentroid = null;
    this.predictions = [];
    this.confirmCount = 0;
    this.missCount = 0;
    this.predictionConfidence = 0;
    this.excitement = 0;
    this.time = 0;
    this.predictionSpawnAccum = 0;
    this.residueSpawnAccum = 0;
  }

  // --- Internal ---

  private recordHotspots(
    candidates: readonly MotionTarget[],
    active: MotionTarget | null,
  ): void {
    // Record active target with higher weight
    if (active && active.score > 0.15) {
      this.pushHotspot(active.position, active.score);
    }
    // Record top candidates
    for (let i = 0; i < Math.min(candidates.length, 3); i++) {
      const c = candidates[i];
      if (c.score > 0.1) {
        this.pushHotspot(c.position, c.score * 0.7);
      }
    }
  }

  private pushHotspot(position: Vec2, score: number): void {
    this.hotspotHistory.push({ position: { ...position }, score, timestamp: this.time });
    if (this.hotspotHistory.length > this.MAX_HISTORY) {
      this.hotspotHistory.shift();
    }
  }

  private updateCentroidVelocity(
    dt: number,
    candidates: readonly MotionTarget[],
    active: MotionTarget | null,
  ): void {
    // Compute current centroid from active + top candidates
    let cx = 0, cy = 0, totalWeight = 0;
    if (active) {
      cx += active.position.x * active.score;
      cy += active.position.y * active.score;
      totalWeight += active.score;
    }
    for (let i = 0; i < Math.min(candidates.length, 3); i++) {
      const c = candidates[i];
      cx += c.position.x * c.score * 0.5;
      cy += c.position.y * c.score * 0.5;
      totalWeight += c.score * 0.5;
    }

    if (totalWeight < 0.01) {
      // No meaningful data — decay velocity
      this.centroidVelocity.x *= 0.9;
      this.centroidVelocity.y *= 0.9;
      return;
    }

    cx /= totalWeight;
    cy /= totalWeight;
    const currentCentroid: Vec2 = { x: cx, y: cy };

    if (this.lastCentroid && dt > 0) {
      const rawVx = (currentCentroid.x - this.lastCentroid.x) / dt;
      const rawVy = (currentCentroid.y - this.lastCentroid.y) / dt;
      // EMA smoothing (alpha = 0.3 for responsiveness without jitter)
      const alpha = 0.3;
      this.centroidVelocity.x = this.centroidVelocity.x * (1 - alpha) + rawVx * alpha;
      this.centroidVelocity.y = this.centroidVelocity.y * (1 - alpha) + rawVy * alpha;
    }

    this.lastCentroid = currentCentroid;
  }

  private spawnPredictions(config: GamingConfig): void {
    // Only spawn if we have meaningful centroid velocity
    const speed = Math.sqrt(
      this.centroidVelocity.x ** 2 + this.centroidVelocity.y ** 2
    );
    if (speed < 20) return; // too slow to predict meaningfully

    // Remove confirmed/expired predictions to make room
    this.predictions = this.predictions.filter(
      p => !p.confirmed && (this.time - p.createdAt) < this.PREDICTION_LIFETIME
    );

    if (this.predictions.length >= this.MAX_PREDICTIONS) return;

    // Linear extrapolation at 0.3s, 0.6s, 1.0s horizons
    const horizons = [0.3, 0.6, 1.0];
    const lastCentroid = this.lastCentroid;
    if (!lastCentroid) return;

    for (const h of horizons) {
      if (this.predictions.length >= this.MAX_PREDICTIONS) break;

      const predicted: Vec2 = {
        x: lastCentroid.x + this.centroidVelocity.x * h * config.predictiveBias,
        y: lastCentroid.y + this.centroidVelocity.y * h * config.predictiveBias,
      };

      // Don't spawn predictions too close to existing ones
      const tooClose = this.predictions.some(
        p => Math.abs(p.position.x - predicted.x) < 60 &&
             Math.abs(p.position.y - predicted.y) < 60
      );
      if (tooClose) continue;

      this.predictions.push({
        position: predicted,
        createdAt: this.time,
        confirmed: false,
      });
    }
  }

  private checkPredictionConfirmations(
    candidates: readonly MotionTarget[],
    active: MotionTarget | null,
  ): void {
    const targets: Vec2[] = [];
    if (active) targets.push(active.position);
    for (const c of candidates) {
      if (c.score > 0.15) targets.push(c.position);
    }

    for (const pred of this.predictions) {
      if (pred.confirmed) continue;

      for (const t of targets) {
        const dx = t.x - pred.position.x;
        const dy = t.y - pred.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.PREDICTION_CONFIRM_RADIUS) {
          pred.confirmed = true;
          this.confirmCount++;
          break;
        }
      }
    }
  }

  private expirePredictions(): void {
    const before = this.predictions.length;
    this.predictions = this.predictions.filter(p => {
      if (p.confirmed) return false; // already counted
      if (this.time - p.createdAt >= this.PREDICTION_LIFETIME) {
        this.missCount++;
        return false;
      }
      return true;
    });
  }

  private updatePredictionConfidence(dt: number): void {
    const total = this.confirmCount + this.missCount;
    if (total > 0) {
      const raw = this.confirmCount / total;
      // EMA toward raw confidence
      const alpha = 0.1;
      this.predictionConfidence = this.predictionConfidence * (1 - alpha) + raw * alpha;
    }

    // Slow decay when no activity
    if (total === 0) {
      this.predictionConfidence = Math.max(0, this.predictionConfidence - dt * 0.05);
    }

    // Decay counters gradually so recent accuracy matters more
    if (total > 20) {
      this.confirmCount = Math.floor(this.confirmCount * 0.95);
      this.missCount = Math.floor(this.missCount * 0.95);
    }

    this.predictionConfidence = clamp(this.predictionConfidence, 0, 1);
  }

  private updateExcitement(dt: number, config: GamingConfig, motionActivity: number): void {
    // Excitement grows from:
    // 1. High motion activity
    // 2. Confirmed predictions (prediction confidence)
    // 3. Rapid hotspot accumulation (many entries in short window)

    const recentHotspots = this.hotspotHistory.filter(
      h => this.time - h.timestamp < 2.0
    ).length;
    const hotspotDensity = clamp(recentHotspots / 20, 0, 1);

    const growthInput =
      motionActivity * 0.4 +
      this.predictionConfidence * 0.35 +
      hotspotDensity * 0.25;

    const gain = config.excitementGain;

    if (growthInput > this.excitement) {
      // Grow toward input
      this.excitement += (growthInput - this.excitement) * gain * dt * 2;
    } else {
      // Cool down gradually (slower than growth for hysteresis)
      this.excitement += (growthInput - this.excitement) * dt * 0.8;
    }

    this.excitement = clamp(this.excitement, 0, 1);
  }

  private computeAdaptiveBias(config: GamingConfig): number {
    // Adaptive bias = how much to bias salience/targeting
    // Grows with excitement and prediction confidence
    return clamp(
      this.excitement * 0.6 + this.predictionConfidence * 0.4,
      0, 1
    ) * config.predictiveBias;
  }

  private spawnResidueBursts(
    dt: number,
    config: GamingConfig,
    kovyPosition: Vec2,
    kovyVelocity: Vec2,
  ): GamingResidueBurst[] {
    const bursts: GamingResidueBurst[] = [];

    // Spawn rate based on excitement and config
    const baseInterval = 0.3 / Math.max(config.residueAmount, 0.1);
    const interval = baseInterval / (1 + this.excitement * 2);
    this.residueSpawnAccum += dt;

    if (this.residueSpawnAccum < interval) return bursts;
    this.residueSpawnAccum = 0;

    // Only spawn when there's meaningful excitement
    if (this.excitement < 0.1) return bursts;

    const speed = Math.sqrt(kovyVelocity.x ** 2 + kovyVelocity.y ** 2);

    // Pick residue type from style palette
    const types = STYLE_RESIDUE_TYPES[config.visualStyle];
    const type = types[Math.floor(Math.random() * types.length)];

    // Spawn at Kovy's position with velocity-influenced offset
    const offset: Vec2 = {
      x: -kovyVelocity.x * 0.05 + (Math.random() - 0.5) * 20,
      y: -kovyVelocity.y * 0.05 + (Math.random() - 0.5) * 20,
    };

    bursts.push({
      position: {
        x: kovyPosition.x + offset.x,
        y: kovyPosition.y + offset.y,
      },
      velocity: {
        x: -kovyVelocity.x * 0.15 + (Math.random() - 0.5) * 30,
        y: -kovyVelocity.y * 0.15 + (Math.random() - 0.5) * 30,
      },
      type,
      intensity: clamp(this.excitement * (0.5 + speed / 600), 0, 1),
    });

    // Extra burst on high excitement + speed (prediction confirmation reward)
    if (this.excitement > 0.6 && speed > 200 && Math.random() < 0.4) {
      const extraType = types[Math.floor(Math.random() * types.length)];
      bursts.push({
        position: {
          x: kovyPosition.x + (Math.random() - 0.5) * 30,
          y: kovyPosition.y + (Math.random() - 0.5) * 30,
        },
        velocity: {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60 - 20,
        },
        type: extraType,
        intensity: clamp(this.excitement * 0.8, 0, 1),
      });
    }

    return bursts;
  }
}

/** Get colors for a gaming visual style */
export function getGamingStyleColors(style: GamingVisualStyle): string[] {
  return STYLE_COLORS[style];
}

/** Get residue types for a gaming visual style */
export function getGamingStyleResidueTypes(style: GamingVisualStyle): GamingResidueType[] {
  return STYLE_RESIDUE_TYPES[style];
}
