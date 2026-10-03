import type { MotionRegion, MotionTarget, Vec2, VisionConfig } from "@/store/types";
import { clamp, distance } from "@/lib/utils";

// Processes raw motion regions from Rust backend into scored targets
// with hysteresis, decay, and anti-jitter logic

interface RegionHistory {
  id: number;
  centroid: Vec2;
  seenCount: number;
  lastSeen: number;
  peakScore: number;
  avgEnergy: number;
}

export class MotionInterestEngine {
  private history: Map<number, RegionHistory> = new Map();
  private currentTargets: MotionTarget[] = [];
  private lockedTarget: MotionTarget | null = null;
  private lockTimer: number = 0;
  private retargetCooldown: number = 0;
  private frameCount: number = 0;

  // Scoring weights (tunable from VisionConfig)
  private weights = {
    motion: 0.25,
    size: 0.15,
    persistence: 0.2,
    novelty: 0.2,
    cursor: 0.1,
    notification: 0.05,
    fullscreenPenalty: 0.1,
    flickerPenalty: 0.15,
  };

  // Hysteresis params
  private readonly MIN_LOCK_TIME = 1.5; // seconds minimum before retarget
  private readonly RETARGET_MARGIN = 0.25; // new target must beat current by this margin
  private readonly RETARGET_COOLDOWN = 0.8; // seconds after abandoning before can lock again
  private readonly HISTORY_DECAY_FRAMES = 30;
  private readonly MAX_HISTORY_SIZE = 50;

  processRegions(
    regions: MotionRegion[],
    dt: number,
    config: VisionConfig,
    cursorPos: Vec2,
    screenWidth: number,
    screenHeight: number
  ): { targets: MotionTarget[]; bestTarget: MotionTarget | null } {
    this.frameCount++;

    // Update history with new regions
    this.updateHistory(regions);

    // Score each region
    const scored = regions.map((r) =>
      this.scoreRegion(r, config, cursorPos, screenWidth, screenHeight)
    );

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Build target list (top 5)
    this.currentTargets = scored.slice(0, 5).map((r) => ({
      position: this.scaleToScreen(r.centroid, config.analysisScale, screenWidth, screenHeight),
      score: r.score,
      regionId: r.id,
      age: 0,
    }));

    // Apply hysteresis for target locking
    this.updateTargetLock(dt);

    // Age existing targets
    this.currentTargets.forEach((t) => (t.age += dt));

    // Decay old history
    this.decayHistory();

    return {
      targets: this.currentTargets,
      bestTarget: this.lockedTarget,
    };
  }

  private scoreRegion(
    region: MotionRegion,
    config: VisionConfig,
    cursorPos: Vec2,
    screenW: number,
    screenH: number
  ): MotionRegion {
    const history = this.history.get(region.id);
    const screenArea = screenW * screenH * config.analysisScale * config.analysisScale;

    // Normalized motion energy (0-1)
    const motionScore = clamp(region.energy / 100, 0, 1);

    // Size score: prefer medium regions, penalize very large (full-screen) or tiny (noise)
    const relativeArea = region.area / Math.max(screenArea, 1);
    let sizeScore: number;
    if (relativeArea < 0.005) sizeScore = relativeArea / 0.005 * 0.3; // tiny = low
    else if (relativeArea < 0.15) sizeScore = 0.6 + (relativeArea / 0.15) * 0.4; // medium = good
    else if (relativeArea < 0.5) sizeScore = 1.0 - (relativeArea - 0.15) / 0.35 * 0.5; // large = declining
    else sizeScore = 0.2; // full-screen = boring

    // Persistence: regions seen across multiple frames are more interesting
    const persistenceScore = history
      ? clamp(history.seenCount / config.persistenceThreshold, 0, 1)
      : 0;

    // Novelty: new regions are more interesting
    const noveltyScore = history
      ? clamp(1 - history.seenCount / 20, 0, 1)
      : 1.0;

    // Cursor proximity relevance
    const scaledCentroid = this.scaleToScreen(
      region.centroid, config.analysisScale, screenW, screenH
    );
    const cursorDist = distance(scaledCentroid.x, scaledCentroid.y, cursorPos.x, cursorPos.y);
    const cursorScore = clamp(1 - cursorDist / 400, 0, 1) * config.cursorAdjacentWeight;

    // Flicker penalty: very short-lived regions that appear/disappear
    const flickerPenalty = history && history.seenCount === 1 && this.frameCount - history.lastSeen > 2
      ? 0.3 : 0;

    // Full-screen motion penalty
    const fullscreenPenalty = relativeArea > 0.6 ? 0.4 : 0;

    const score = clamp(
      this.weights.motion * motionScore +
      this.weights.size * sizeScore +
      this.weights.persistence * persistenceScore +
      this.weights.novelty * noveltyScore * config.noveltyWeight +
      this.weights.cursor * cursorScore -
      this.weights.flickerPenalty * flickerPenalty -
      this.weights.fullscreenPenalty * fullscreenPenalty,
      0, 1
    );

    return { ...region, score };
  }

  private updateHistory(regions: MotionRegion[]) {
    for (const r of regions) {
      const existing = this.history.get(r.id);
      if (existing) {
        existing.seenCount++;
        existing.lastSeen = this.frameCount;
        existing.centroid = r.centroid;
        existing.avgEnergy = existing.avgEnergy * 0.8 + r.energy * 0.2;
        existing.peakScore = Math.max(existing.peakScore, r.score);
      } else {
        this.history.set(r.id, {
          id: r.id,
          centroid: r.centroid,
          seenCount: 1,
          lastSeen: this.frameCount,
          peakScore: r.score,
          avgEnergy: r.energy,
        });
      }
    }
  }

  private decayHistory() {
    const cutoff = this.frameCount - this.HISTORY_DECAY_FRAMES;
    for (const [id, h] of this.history) {
      if (h.lastSeen < cutoff) {
        this.history.delete(id);
      }
    }
    // Evict oldest if too large
    if (this.history.size > this.MAX_HISTORY_SIZE) {
      const sorted = [...this.history.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
      const toRemove = sorted.slice(0, this.history.size - this.MAX_HISTORY_SIZE);
      for (const [id] of toRemove) {
        this.history.delete(id);
      }
    }
  }

  private updateTargetLock(dt: number) {
    this.lockTimer += dt;
    this.retargetCooldown = Math.max(0, this.retargetCooldown - dt);

    const best = this.currentTargets[0] ?? null;

    if (!this.lockedTarget) {
      // No current lock — acquire if good enough and cooldown expired
      if (best && best.score > 0.2 && this.retargetCooldown <= 0) {
        this.lockedTarget = best;
        this.lockTimer = 0;
      }
      return;
    }

    // Check if locked target still exists in current targets
    const stillExists = this.currentTargets.find(
      (t) => t.regionId === this.lockedTarget!.regionId
    );

    if (!stillExists) {
      // Target gone — release after minimum lock time
      if (this.lockTimer > this.MIN_LOCK_TIME) {
        this.lockedTarget = null;
        this.retargetCooldown = this.RETARGET_COOLDOWN;
      }
      return;
    }

    // Update locked target position
    this.lockedTarget.position = stillExists.position;
    this.lockedTarget.score = stillExists.score;

    // Check if a much better target has appeared
    if (
      best &&
      best.regionId !== this.lockedTarget.regionId &&
      best.score > this.lockedTarget.score + this.RETARGET_MARGIN &&
      this.lockTimer > this.MIN_LOCK_TIME
    ) {
      this.lockedTarget = best;
      this.lockTimer = 0;
    }
  }

  private scaleToScreen(
    point: Vec2, analysisScale: number, _screenW: number, _screenH: number
  ): Vec2 {
    return {
      x: point.x / analysisScale,
      y: point.y / analysisScale,
    };
  }

  getMotionActivity(): number {
    if (this.currentTargets.length === 0) return 0;
    return clamp(
      this.currentTargets.reduce((sum, t) => sum + t.score, 0) / 3,
      0, 1
    );
  }

  hasNovelTarget(): boolean {
    return this.currentTargets.some((t) => {
      const h = this.history.get(t.regionId);
      return !h || h.seenCount < 5;
    });
  }

  /** Called when backend emits empty regions — decay and clear stale targets */
  clearStaleTargets(dt: number): { targets: MotionTarget[]; bestTarget: MotionTarget | null } {
    this.frameCount++;
    this.currentTargets = [];
    this.decayHistory();

    // Decay locked target
    if (this.lockedTarget) {
      this.lockTimer += dt;
      if (this.lockTimer > this.MIN_LOCK_TIME) {
        this.lockedTarget = null;
        this.retargetCooldown = this.RETARGET_COOLDOWN;
      }
    }

    return {
      targets: [],
      bestTarget: this.lockedTarget,
    };
  }

  reset() {
    this.history.clear();
    this.currentTargets = [];
    this.lockedTarget = null;
    this.lockTimer = 0;
    this.retargetCooldown = 0;
    this.frameCount = 0;
  }
}
