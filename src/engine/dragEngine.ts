// ============================================================
// Kovy Drag Interaction Engine — allows users to pick up and
// place Kovy. Remembers frequently used spots and applies
// release behaviors (bounce, settle, celebrate).
// ============================================================

import type { DragConfig, Vec2 } from "@/store/types";
import { clamp } from "@/lib/utils";

export interface DragState {
  isDragging: boolean;
  dragOffset: Vec2;
  currentPosition: Vec2;
  velocity: Vec2;
}

export interface DragOutput {
  enabled: boolean;
  isDragging: boolean;
  position: Vec2;
  velocity: Vec2;
  releaseBehavior: "bounce" | "settle" | "celebrate" | null;
  rememberedSpots: Vec2[];
}

export const NULL_DRAG_OUTPUT: DragOutput = {
  enabled: false,
  isDragging: false,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  releaseBehavior: null,
  rememberedSpots: [],
};

const STORAGE_KEY = "kovy-drag-spots";
const SPOT_THRESHOLD = 50; // pixels to consider "same spot"
const MAX_SPOTS = 10;

interface StoredSpot {
  x: number;
  y: number;
  visitCount: number;
  lastVisited: number;
}

export class DragEngine {
  private isDragging = false;
  private dragOffset: Vec2 = { x: 0, y: 0 };
  private position: Vec2 = { x: 0, y: 0 };
  private velocity: Vec2 = { x: 0, y: 0 };
  private lastPosition: Vec2 = { x: 0, y: 0 };
  private spots: StoredSpot[] = [];
  private releaseTimer = 0;
  private pendingRelease: "bounce" | "settle" | "celebrate" | null = null;

  constructor() {
    this.spots = this.loadSpots();
  }

  private loadSpots(): StoredSpot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveSpots(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.spots));
    } catch { /* ignore */ }
  }

  startDrag(grabPos: Vec2, entityPos: Vec2): void {
    this.isDragging = true;
    this.dragOffset = { x: entityPos.x - grabPos.x, y: entityPos.y - grabPos.y };
    this.velocity = { x: 0, y: 0 };
  }

  updateDrag(pointerPos: Vec2, dt: number): void {
    if (!this.isDragging) return;
    const newPos = { x: pointerPos.x + this.dragOffset.x, y: pointerPos.y + this.dragOffset.y };
    if (dt > 0) {
      this.velocity = {
        x: (newPos.x - this.lastPosition.x) / dt,
        y: (newPos.y - this.lastPosition.y) / dt,
      };
    }
    this.position = newPos;
    this.lastPosition = { ...newPos };
  }

  endDrag(config: DragConfig): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.pendingRelease = config.releaseBehavior;
    this.releaseTimer = 0;

    // Remember spot
    if (config.rememberSpots) {
      this.recordSpot(this.position);
    }
  }

  private recordSpot(pos: Vec2): void {
    // Find nearby existing spot
    const nearby = this.spots.find(s =>
      Math.abs(s.x - pos.x) < SPOT_THRESHOLD && Math.abs(s.y - pos.y) < SPOT_THRESHOLD
    );
    if (nearby) {
      nearby.visitCount++;
      nearby.lastVisited = Date.now();
    } else {
      this.spots.push({ x: pos.x, y: pos.y, visitCount: 1, lastVisited: Date.now() });
      if (this.spots.length > MAX_SPOTS) {
        // Remove least visited
        this.spots.sort((a, b) => b.visitCount - a.visitCount);
        this.spots = this.spots.slice(0, MAX_SPOTS);
      }
    }
    this.saveSpots();
  }

  update(dt: number, config: DragConfig): DragOutput {
    if (!config.enabled) return NULL_DRAG_OUTPUT;

    // Handle release behavior animation
    if (this.pendingRelease && !this.isDragging) {
      this.releaseTimer += dt;
      if (this.releaseTimer > 0.5) {
        this.pendingRelease = null;
      }
    }

    // Apply velocity damping when not dragging
    if (!this.isDragging) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.velocity.x *= 0.9;
      this.velocity.y *= 0.9;
    }

    const rememberedSpots = this.spots
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 5)
      .map(s => ({ x: s.x, y: s.y }));

    return {
      enabled: true,
      isDragging: this.isDragging,
      position: { ...this.position },
      velocity: { ...this.velocity },
      releaseBehavior: this.pendingRelease,
      rememberedSpots,
    };
  }

  setPosition(pos: Vec2): void {
    this.position = { ...pos };
    this.lastPosition = { ...pos };
  }

  isWithinGrabRadius(pointer: Vec2, entityPos: Vec2, config: DragConfig): boolean {
    const dx = pointer.x - entityPos.x;
    const dy = pointer.y - entityPos.y;
    return Math.sqrt(dx * dx + dy * dy) <= config.grabRadius;
  }
}

// --- Pure drag action resolver (extracted for testability) ---

export type DragAction =
  | { type: "dragging"; position: Vec2 }
  | { type: "release"; behavior: "celebrate" | "idle_float"; releaseBehavior: "bounce" | "settle" | "celebrate" }
  | { type: "none" };

const RELEASE_BEHAVIOR_MAP: Record<string, "celebrate" | "idle_float"> = {
  celebrate: "celebrate",
  bounce: "idle_float",
  settle: "idle_float",
};

export function resolveDragAction(dragOutput: DragOutput): DragAction {
  if (dragOutput.enabled && dragOutput.isDragging) {
    return { type: "dragging", position: dragOutput.position };
  }
  if (dragOutput.enabled && dragOutput.releaseBehavior) {
    const behavior = RELEASE_BEHAVIOR_MAP[dragOutput.releaseBehavior] ?? "idle_float";
    return { type: "release", behavior, releaseBehavior: dragOutput.releaseBehavior };
  }
  return { type: "none" };
}
