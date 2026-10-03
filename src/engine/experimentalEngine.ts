// ============================================================
// Experimental Engine — manages screen interaction state
//
// Safety:
// - Rate limiting enforced (default 5s between interactions)
// - Only interacts when Kovy is in curious/playful states
// - Privacy pause disables all interactions
// - All interactions are logged to journal
//
// v9.0 hardening (D2 fix):
// - Converts overlay-local coordinates to screen coordinates
//   before calling native APIs (SetCursorPos, WindowFromPoint, etc.)
// - Verifies a window actually exists at the target point before
//   interacting, instead of clicking random empty space
// - Hover now actually moves the cursor via simulate_hover
// ============================================================

import type { ExperimentalConfig, ExperimentalInteraction, Vec2, BehaviorState } from "@/store/types";
import type { VirtualDesktopBounds } from "@/lib/monitorUtils";
import { simulateClick, simulateHover, simulateKey, getWindowAtPosition, type ElementInfo } from "@/lib/tauriBridge";

const INTERACTION_BEHAVIORS: BehaviorState[] = ["inspect", "wander", "orbit"];

export interface InteractionLogEntry {
  timestamp: number;
  type: ExperimentalInteraction;
  position: Vec2;
  targetElement: string;
  success: boolean;
  error?: string;
}

export class ExperimentalEngine {
  private config: ExperimentalConfig | null = null;
  private lastInteractionTime = 0;
  private log: InteractionLogEntry[] = [];
  private maxLogSize = 50;
  private virtualDesktop: VirtualDesktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };

  updateConfig(config: ExperimentalConfig): void {
    this.config = config;
  }

  /// Set the virtual desktop bounds used for overlay-local → screen
  /// coordinate conversion. Must be called before tryInteract.
  updateVirtualDesktop(vd: VirtualDesktopBounds): void {
    this.virtualDesktop = vd;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  canInteract(currentBehavior: BehaviorState, isPrivacyPaused: boolean): boolean {
    if (!this.config?.enabled) return false;
    if (!this.config.optInAcknowledged) return false;
    if (isPrivacyPaused) return false;
    if (!INTERACTION_BEHAVIORS.includes(currentBehavior)) return false;

    const now = Date.now();
    const elapsed = (now - this.lastInteractionTime) / 1000;
    if (elapsed < this.config.rateLimitSec) return false;

    return true;
  }

  async tryInteract(
    kovyPosOverlayLocal: Vec2,
    currentBehavior: BehaviorState,
    isPrivacyPaused: boolean,
  ): Promise<InteractionLogEntry | null> {
    if (!this.canInteract(currentBehavior, isPrivacyPaused)) return null;
    if (!this.config) return null;

    const allowed = this.config.allowedInteractions;
    if (allowed.length === 0) return null;

    const interactionType = allowed[Math.floor(Math.random() * allowed.length)];
    const radius = this.config.interactionRadius;

    // Pick a random point within interaction radius (overlay-local coords)
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const targetOverlayLocal: Vec2 = {
      x: Math.round(kovyPosOverlayLocal.x + Math.cos(angle) * dist),
      y: Math.round(kovyPosOverlayLocal.y + Math.sin(angle) * dist),
    };

    // Convert overlay-local coordinates to screen coordinates
    // The virtual desktop offset maps canvas pixels to physical screen pixels
    const targetScreen: Vec2 = {
      x: Math.round(targetOverlayLocal.x + this.virtualDesktop.x),
      y: Math.round(targetOverlayLocal.y + this.virtualDesktop.y),
    };

    let success = false;
    let error: string | undefined;
    let targetElement = "unknown";

    try {
      // Verify a window actually exists at the target screen position.
      // This prevents clicking empty desktop space or off-screen areas.
      const elem = await getWindowAtPosition(targetScreen.x, targetScreen.y);
      if (!elem) {
        // No window at this position — skip interaction
        this.lastInteractionTime = Date.now();
        const entry: InteractionLogEntry = {
          timestamp: Date.now(),
          type: interactionType,
          position: targetScreen,
          targetElement: "empty",
          success: false,
          error: "No window at target position",
        };
        this.log.unshift(entry);
        if (this.log.length > this.maxLogSize) this.log.pop();
        return entry;
      }

      targetElement = elem.name || elem.elementType || "element";

      if (interactionType === "click") {
        await simulateClick(targetScreen.x, targetScreen.y, "left");
        success = true;
      } else if (interactionType === "hover") {
        // Actually move the cursor to the target position (no click)
        await simulateHover(targetScreen.x, targetScreen.y);
        success = true;
      } else if (interactionType === "type") {
        // Focus the window first by moving cursor there, then send key
        await simulateHover(targetScreen.x, targetScreen.y);
        await simulateKey("space");
        success = true;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      success = false;
    }

    this.lastInteractionTime = Date.now();

    const entry: InteractionLogEntry = {
      timestamp: Date.now(),
      type: interactionType,
      position: targetScreen,
      targetElement,
      success,
      error,
    };

    this.log.unshift(entry);
    if (this.log.length > this.maxLogSize) this.log.pop();

    return entry;
  }

  getLog(): InteractionLogEntry[] {
    return [...this.log];
  }

  getCooldownRemaining(): number {
    if (!this.config) return 0;
    const elapsed = (Date.now() - this.lastInteractionTime) / 1000;
    return Math.max(0, this.config.rateLimitSec - elapsed);
  }

  clearLog(): void {
    this.log = [];
  }

  destroy(): void {
    this.config = null;
    this.log = [];
  }
}
