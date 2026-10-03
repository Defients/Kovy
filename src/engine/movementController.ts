import type { Vec2, PersonalityOffsets } from "@/store/types";
import { clamp, dampedSpring } from "@/lib/utils";

// Smooth steering-style movement with inertia, damping, and squash/stretch
// Supports dash mode with burst acceleration for hyper behavior

export interface MovementOptions {
  dashActive?: boolean;
  dashStrength?: number; // 0-1, multiplies burst stiffness
  minX?: number; // minimum x bound (virtual-desktop-absolute, for multi-monitor confinement)
  minY?: number; // minimum y bound (virtual-desktop-absolute, for multi-monitor confinement)
}

export class MovementController {
  private velX: number = 0;
  private velY: number = 0;
  private posX: number = 200;
  private posY: number = 200;

  // Spring params (base values)
  private STIFFNESS: number = 4.0;
  private DAMPING: number = 6.0;

  // Dash params
  private DASH_STIFFNESS: number = 18.0;
  private DASH_DAMPING: number = 8.0;

  // Squash/stretch state
  private ssX: number = 1;
  private ssY: number = 1;
  private ssVelX: number = 0;
  private ssVelY: number = 0;

  // Lean + landing state
  private leanAngle: number = 0;
  private leanVel: number = 0;
  private prevSpeed: number = 0;
  private landingImpact: number = 0;

  setPosition(x: number, y: number) {
    this.posX = x;
    this.posY = y;
  }

  update(
    dt: number,
    target: Vec2 | null,
    speedMultiplier: number,
    screenWidth: number,
    screenHeight: number,
    options?: MovementOptions,
    personality?: PersonalityOffsets | null
  ): { position: Vec2; velocity: Vec2; squashStretch: Vec2; leanAngle: number; landingImpact: number } {
    const maxDt = Math.min(dt, 0.05); // cap dt to prevent instability
    const isDashing = options?.dashActive ?? false;
    const dashStr = options?.dashStrength ?? 0.7;

    // Personality-driven spring target jitter
    let effectiveTarget = target;
    if (personality && personality.wanderBias > 0.1 && effectiveTarget) {
      const jitter = personality.wanderBias * 3;
      effectiveTarget = {
        x: effectiveTarget.x + (Math.random() - 0.5) * jitter,
        y: effectiveTarget.y + (Math.random() - 0.5) * jitter,
      };
    }

    if (effectiveTarget) {
      let stiffness: number;
      let damping: number;

      if (isDashing) {
        // Dash mode: much stiffer spring for burst acceleration, with braking near target
        const distToTarget = Math.sqrt(
          (effectiveTarget.x - this.posX) ** 2 + (effectiveTarget.y - this.posY) ** 2
        );
        const brakingDist = 80;
        const brakingFactor = distToTarget < brakingDist
          ? clamp(distToTarget / brakingDist, 0.2, 1)
          : 1;

        stiffness = this.DASH_STIFFNESS * dashStr * speedMultiplier * brakingFactor;
        damping = this.DASH_DAMPING * (1 + (1 - brakingFactor) * 2); // increase damping on arrival
      } else {
        stiffness = this.STIFFNESS * speedMultiplier;
        damping = this.DAMPING;
      }

      // Personality-driven physics: each entity feels distinct
      if (personality) {
        // Energetic: snappier (higher stiffness, slightly less damping)
        stiffness *= 1 + personality.energyBias * 0.3;
        // Shy: more tentative (higher damping, lower stiffness)
        stiffness *= 1 - personality.shynessBias * 0.25;
        damping *= 1 + personality.shynessBias * 0.4;
        // Playful: bouncy overshoot (lower damping below critical)
        damping *= 1 - personality.playfulnessBias * 0.2;
      }

      const springX = dampedSpring(this.posX, effectiveTarget.x, this.velX, stiffness, damping, maxDt);
      const springY = dampedSpring(this.posY, effectiveTarget.y, this.velY, stiffness, damping, maxDt);

      this.posX = springX.value;
      this.posY = springY.value;
      this.velX = springX.velocity;
      this.velY = springY.velocity;
    } else {
      // Dampen to stop
      this.velX *= Math.pow(0.95, maxDt * 60);
      this.velY *= Math.pow(0.95, maxDt * 60);
      this.posX += this.velX * maxDt;
      this.posY += this.velY * maxDt;
    }

    // Clamp to screen bounds with margin (supports virtual-desktop offset for multi-monitor)
    const margin = 20;
    const clampMinX = options?.minX ?? 0;
    const clampMinY = options?.minY ?? 0;
    this.posX = clamp(this.posX, clampMinX + margin, screenWidth - margin);
    this.posY = clamp(this.posY, clampMinY + margin, screenHeight - margin);

    // Compute squash/stretch from velocity
    const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    const maxSpeed = isDashing ? 1200 : 800;
    const speedNorm = clamp(speed / maxSpeed, 0, 1);

    // Movement direction determines stretch axis
    // Hyper/dash: stronger squash/stretch for kinetic feel
    const ssIntensity = isDashing ? 0.25 : 0.15;
    const targetSSX = 1 + speedNorm * ssIntensity;
    const targetSSY = 1 - speedNorm * ssIntensity * 0.67;

    // Spring the squash/stretch for smooth feel
    const ssx = dampedSpring(this.ssX, targetSSX, this.ssVelX, 12, 8, maxDt);
    const ssy = dampedSpring(this.ssY, targetSSY, this.ssVelY, 12, 8, maxDt);
    this.ssX = ssx.value;
    this.ssY = ssy.value;
    this.ssVelX = ssx.velocity;
    this.ssVelY = ssy.velocity;

    // Lean angle: tilt toward horizontal velocity direction
    const maxLean = isDashing ? 0.2 : 0.12;
    const targetLean = clamp((this.velX / (isDashing ? 1200 : 800)) * maxLean, -maxLean, maxLean);
    const leanSpring = dampedSpring(this.leanAngle, targetLean, this.leanVel, 10, 7, maxDt);
    this.leanAngle = leanSpring.value;
    this.leanVel = leanSpring.velocity;

    // Landing impact: detect rapid deceleration
    const currentSpeed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    const speedDrop = this.prevSpeed - currentSpeed;
    if (speedDrop > 100 && this.prevSpeed > 150) {
      this.landingImpact = clamp(speedDrop / 600, 0, 1);
    }
    this.landingImpact = Math.max(0, this.landingImpact - maxDt * 4); // decay over ~0.25s
    this.prevSpeed = currentSpeed;

    return {
      position: { x: this.posX, y: this.posY },
      velocity: { x: this.velX, y: this.velY },
      squashStretch: { x: this.ssX, y: this.ssY },
      leanAngle: this.leanAngle,
      landingImpact: this.landingImpact,
    };
  }

  // Impulse for interactions (poke, celebrate)
  applyImpulse(ix: number, iy: number) {
    this.velX += ix;
    this.velY += iy;
  }

  // Separation: push this entity away from nearby entity positions so family
  // members don't stack on top of each other. Returns the updated pos/vel so the
  // caller can use the corrected values for rendering/dispatch this frame.
  applySeparation(
    others: Vec2[],
    minDist: number,
    strength: number,
    screenWidth?: number,
    screenHeight?: number,
    minX?: number,
    minY?: number,
  ): { position: Vec2; velocity: Vec2 } {
    let pushX = 0;
    let pushY = 0;
    for (const other of others) {
      const dx = this.posX - other.x;
      const dy = this.posY - other.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist * minDist) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          // Smooth repulsion: stronger as they get closer (quadratic falloff)
          const overlap = (minDist - d) / minDist; // 0..1
          const f = overlap * overlap * strength;
          pushX += (dx / d) * f;
          pushY += (dy / d) * f;
        } else {
          // Exactly overlapping: nudge in a random direction to break the tie
          const ang = Math.random() * Math.PI * 2;
          pushX += Math.cos(ang) * strength * 0.5;
          pushY += Math.sin(ang) * strength * 0.5;
        }
      }
    }
    if (pushX !== 0 || pushY !== 0) {
      this.posX += pushX;
      this.posY += pushY;
      // Add a small velocity kick so the spring carries the entity away
      this.velX += pushX * 2;
      this.velY += pushY * 2;
      // Re-clamp to screen bounds so separation never pushes off-screen
      const margin = 20;
      const clampMinX = minX ?? 0;
      const clampMinY = minY ?? 0;
      const maxX = screenWidth ?? Number.POSITIVE_INFINITY;
      const maxY = screenHeight ?? Number.POSITIVE_INFINITY;
      this.posX = clamp(this.posX, clampMinX + margin, maxX - margin);
      this.posY = clamp(this.posY, clampMinY + margin, maxY - margin);
    }
    return { position: { x: this.posX, y: this.posY }, velocity: { x: this.velX, y: this.velY } };
  }

  getSpeed(): number {
    return Math.sqrt(this.velX * this.velX + this.velY * this.velY);
  }
}
