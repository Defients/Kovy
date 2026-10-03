// ============================================================
// Kovy Interaction Engine — proximity-based interaction detection
//
// Detects pokes, hovers, and swipes based on cursor proximity
// to Kovy's position. Works without click events (the overlay
// is click-through), using cursor movement patterns instead:
//
// - Poke:   cursor rapidly approaches and stops near Kovy
// - Hover:  cursor lingers within interaction radius for >0.5s
// - Swipe:  cursor passes through interaction radius at high speed
//
// All detection is local heuristic. No AI, no network, no cloud.
// ============================================================

import type { Vec2 } from "@/store/types";
import { clamp, distance } from "@/lib/utils";

export type InteractionType = "poke" | "hover" | "swipe" | "return" | "double_click" | "right_click";

export interface InteractionEvent {
  type: InteractionType;
  position: Vec2;
  timestamp: number;
}

// --- Detection parameters ---

const POKE_SPEED_THRESHOLD = 600;     // px/s — cursor must be moving fast
const POKE_PROXIMITY = 0.7;           // fraction of interactionRadius for poke proximity
const POKE_DECEL_FACTOR = 0.15;       // speed must drop to this fraction of peak
const HOVER_DURATION = 0.5;           // seconds cursor must linger
const HOVER_SPEED_THRESHOLD = 50;     // px/s — cursor must be slow to hover
const SWIPE_SPEED_THRESHOLD = 800;    // px/s — cursor must be fast for swipe
const SWIPE_COOLDOWN = 1.0;           // seconds between swipe detections
const POKE_COOLDOWN = 0.8;            // seconds between poke detections
const HOVER_COOLDOWN = 2.0;           // seconds between hover detections
const RETURN_IDLE_THRESHOLD = 120;    // seconds of no cursor movement before return celebration
const RETURN_COOLDOWN = 300;          // seconds between return celebrations (avoid spamming)

// --- Interaction Engine ---

export class InteractionEngine {
  private interactionRadius: number = 80;
  private pokeStartleChance: number = 0.3;

  // Cursor tracking state
  private prevCursor: Vec2 | null = null;
  private prevCursorTime: number = 0;
  private cursorSpeed: number = 0;

  // Poke detection state
  private pokePeakSpeed: number = 0;
  private pokeApproaching: boolean = false;

  // Hover detection state
  private hoverTimer: number = 0;
  private hoverActive: boolean = false;

  // Cooldowns
  private pokeCooldownTimer: number = 0;
  private hoverCooldownTimer: number = 0;
  private swipeCooldownTimer: number = 0;

  // Time accumulator
  private time: number = 0;

  // Return celebration state
  private idleTimer: number = 0;          // seconds since last cursor movement
  private wasIdle: boolean = false;       // true when idle threshold was crossed
  private returnCooldownTimer: number = 0;

  // Double-click detection (v7.0)
  private lastClickTime: number = 0;
  private readonly DOUBLE_CLICK_WINDOW = 0.4; // seconds
  private doubleClickCooldown = 0;

  // Last emitted event (for consumers to poll)
  private lastEvent: InteractionEvent | null = null;

  setInteractionRadius(radius: number): void {
    this.interactionRadius = clamp(radius, 30, 150);
  }

  setPokeStartleChance(chance: number): void {
    this.pokeStartleChance = clamp(chance, 0, 1);
  }

  /** Returns true if the next poke should cause a startle (vs celebrate) */
  shouldPokeStartle(): boolean {
    return Math.random() < this.pokeStartleChance;
  }

  /**
   * Main update tick. Call every frame.
   * Returns an InteractionEvent if one was detected this frame, null otherwise.
   */
  update(
    dt: number,
    cursorPos: Vec2,
    kovyPos: Vec2,
    kovyVisible: boolean,
  ): InteractionEvent | null {
    this.time += dt;
    this.lastEvent = null;

    // Decay cooldowns
    this.pokeCooldownTimer = Math.max(0, this.pokeCooldownTimer - dt);
    this.hoverCooldownTimer = Math.max(0, this.hoverCooldownTimer - dt);
    this.swipeCooldownTimer = Math.max(0, this.swipeCooldownTimer - dt);
    this.returnCooldownTimer = Math.max(0, this.returnCooldownTimer - dt);

    if (!kovyVisible) return null;

    // Compute cursor speed
    const now = this.time;
    let speed = 0;
    if (this.prevCursor) {
      const dx = cursorPos.x - this.prevCursor.x;
      const dy = cursorPos.y - this.prevCursor.y;
      const dtCursor = Math.max(0.001, now - this.prevCursorTime);
      speed = Math.sqrt(dx * dx + dy * dy) / dtCursor;
    }
    this.cursorSpeed = speed;
    this.prevCursor = { ...cursorPos };
    this.prevCursorTime = now;

    // --- Return celebration: detect cursor activity after extended idle ---
    const cursorMoving = speed > 5; // px/s threshold for "active"
    if (cursorMoving) {
      if (this.wasIdle && this.returnCooldownTimer <= 0) {
        // User returned after being away — emit return event
        this.wasIdle = false;
        this.idleTimer = 0;
        this.returnCooldownTimer = RETURN_COOLDOWN;
        this.lastEvent = {
          type: "return",
          position: { ...cursorPos },
          timestamp: now,
        };
        return this.lastEvent;
      }
      this.idleTimer = 0;
    } else {
      this.idleTimer += dt;
      if (this.idleTimer >= RETURN_IDLE_THRESHOLD) {
        this.wasIdle = true;
      }
    }

    const distToKovy = distance(cursorPos.x, cursorPos.y, kovyPos.x, kovyPos.y);
    const inRadius = distToKovy < this.interactionRadius;

    // --- Poke detection: fast approach + sudden deceleration near Kovy ---
    if (speed > POKE_SPEED_THRESHOLD && distToKovy < this.interactionRadius * 1.5) {
      if (!this.pokeApproaching) {
        this.pokeApproaching = true;
        this.pokePeakSpeed = speed;
      } else {
        this.pokePeakSpeed = Math.max(this.pokePeakSpeed, speed);
      }
    }

    if (this.pokeApproaching) {
      // Check if cursor has decelerated significantly
      const nearEnough = distToKovy < this.interactionRadius * POKE_PROXIMITY;
      const decelerated = speed < this.pokePeakSpeed * POKE_DECEL_FACTOR;

      if (nearEnough && decelerated && this.pokeCooldownTimer <= 0) {
        this.lastEvent = {
          type: "poke",
          position: { ...cursorPos },
          timestamp: now,
        };
        this.pokeCooldownTimer = POKE_COOLDOWN;
        this.pokeApproaching = false;
        this.pokePeakSpeed = 0;
        return this.lastEvent;
      }

      // Reset approach if cursor leaves the area or too much time passes
      if (distToKovy > this.interactionRadius * 2.5 || speed > this.pokePeakSpeed * 1.5) {
        this.pokeApproaching = false;
        this.pokePeakSpeed = 0;
      }
    }

    // --- Hover detection: cursor lingers near Kovy at low speed ---
    if (inRadius && speed < HOVER_SPEED_THRESHOLD) {
      this.hoverTimer += dt;
      if (this.hoverTimer >= HOVER_DURATION && this.hoverCooldownTimer <= 0 && !this.hoverActive) {
        this.hoverActive = true;
        this.lastEvent = {
          type: "hover",
          position: { ...cursorPos },
          timestamp: now,
        };
        this.hoverCooldownTimer = HOVER_COOLDOWN;
        return this.lastEvent;
      }
    } else {
      this.hoverTimer = Math.max(0, this.hoverTimer - dt * 2);
      if (this.hoverTimer <= 0) {
        this.hoverActive = false;
      }
    }

    // --- Swipe detection: cursor passes through radius at high speed ---
    if (inRadius && speed > SWIPE_SPEED_THRESHOLD && this.swipeCooldownTimer <= 0) {
      this.lastEvent = {
        type: "swipe",
        position: { ...cursorPos },
        timestamp: now,
      };
      this.swipeCooldownTimer = SWIPE_COOLDOWN;
      return this.lastEvent;
    }

    return null;
  }

  /** Get cursor speed for debugging/visualization */
  getCursorSpeed(): number {
    return this.cursorSpeed;
  }

  /** Check if cursor is currently within interaction radius */
  isCursorNear(kovyPos: Vec2, cursorPos: Vec2): boolean {
    return distance(cursorPos.x, cursorPos.y, kovyPos.x, kovyPos.y) < this.interactionRadius;
  }

  /** Handle a click event near Kovy — detects double-clicks (v7.0) */
  handleClick(pos: Vec2, kovyPos: Vec2): InteractionEvent | null {
    if (!this.isCursorNear(kovyPos, pos)) return null;
    const now = this.time;
    this.doubleClickCooldown = Math.max(0, this.doubleClickCooldown - 0.1);

    if (now - this.lastClickTime < this.DOUBLE_CLICK_WINDOW && this.doubleClickCooldown <= 0) {
      this.lastClickTime = 0;
      this.doubleClickCooldown = 1.0;
      this.lastEvent = {
        type: "double_click",
        position: { ...pos },
        timestamp: Date.now(),
      };
      return this.lastEvent;
    }

    this.lastClickTime = now;
    return null;
  }

  /** Handle a right-click event near Kovy (v7.0) */
  handleRightClick(pos: Vec2, kovyPos: Vec2): InteractionEvent | null {
    if (!this.isCursorNear(kovyPos, pos)) return null;
    this.lastEvent = {
      type: "right_click",
      position: { ...pos },
      timestamp: Date.now(),
    };
    return this.lastEvent;
  }

  reset(): void {
    this.prevCursor = null;
    this.prevCursorTime = 0;
    this.cursorSpeed = 0;
    this.pokePeakSpeed = 0;
    this.pokeApproaching = false;
    this.hoverTimer = 0;
    this.hoverActive = false;
    this.pokeCooldownTimer = 0;
    this.hoverCooldownTimer = 0;
    this.swipeCooldownTimer = 0;
    this.returnCooldownTimer = 0;
    this.idleTimer = 0;
    this.wasIdle = false;
    this.time = 0;
    this.lastEvent = null;
    this.lastClickTime = 0;
    this.doubleClickCooldown = 0;
  }
}
