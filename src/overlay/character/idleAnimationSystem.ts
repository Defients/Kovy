import type { BehaviorState } from "@/store/types";
import type { KovyRenderState } from "../KovyCharacter";

type IdleAnimType = "fidget" | "bounce" | "stretch" | "yawn" | "spin" | "look_around" | "dance" | "meditate" | "play_dead" | "none";

export class IdleAnimationSystem {
  private idleAnimType: IdleAnimType = "none";
  private idleAnimTimer: number = 4;
  private idleAnimProgress: number = 0;
  private idleAnimDuration: number = 1;

  update(dt: number, state: KovyRenderState): void {
    const isIdle = state.behaviorState === "idle_float" || state.behaviorState === "perch";
    const isStretch = state.behaviorState === "stretch";
    const isYawn = state.behaviorState === "yawn";
    const isLookAround = state.behaviorState === "look_around";
    const isDance = state.behaviorState === "dance";
    const isMeditate = state.behaviorState === "meditate";
    const isPlayDead = state.behaviorState === "play_dead";
    const isInvestigate = state.behaviorState === "investigate";

    if (isStretch) {
      this.idleAnimType = "stretch";
      this.idleAnimDuration = 1.2;
      this.idleAnimProgress = 0;
    } else if (isYawn) {
      this.idleAnimType = "yawn";
      this.idleAnimDuration = 1.5;
      this.idleAnimProgress = 0;
    } else if (isLookAround) {
      this.idleAnimType = "look_around";
      this.idleAnimDuration = 2.0;
      this.idleAnimProgress = 0;
    } else if (isDance) {
      this.idleAnimType = "dance";
      this.idleAnimDuration = 2.0;
      this.idleAnimProgress = 0;
    } else if (isMeditate) {
      this.idleAnimType = "meditate";
      this.idleAnimDuration = 5.0;
      this.idleAnimProgress = 0;
    } else if (isPlayDead) {
      this.idleAnimType = "play_dead";
      this.idleAnimDuration = 2.0;
      this.idleAnimProgress = 0;
    } else if (isInvestigate) {
      this.idleAnimType = "fidget";
      this.idleAnimDuration = 0.4 + Math.random() * 0.3;
      this.idleAnimProgress = 0;
    } else if (isIdle && this.idleAnimType === "none") {
      this.idleAnimTimer -= dt;
      if (this.idleAnimTimer <= 0) {
        const fidgets: IdleAnimType[] = ["fidget", "bounce", "spin"];
        this.idleAnimType = fidgets[Math.floor(Math.random() * fidgets.length)];
        this.idleAnimDuration = 0.6 + Math.random() * 0.4;
        this.idleAnimProgress = 0;
      }
    }

    if (this.idleAnimType !== "none") {
      this.idleAnimProgress += dt / this.idleAnimDuration;
      if (this.idleAnimProgress >= 1) {
        this.idleAnimType = "none";
        this.idleAnimProgress = 0;
        this.idleAnimTimer = 3 + Math.random() * 4;
      }
    }
  }

  getSquashStretch(): { x: number; y: number } {
    if (this.idleAnimType === "none" || this.idleAnimType === "look_around") {
      return { x: 1, y: 1 };
    }

    const t = this.idleAnimProgress;
    const bell = Math.sin(t * Math.PI);

    switch (this.idleAnimType) {
      case "fidget":
        return { x: 1 + bell * 0.04, y: 1 - bell * 0.03 };
      case "bounce":
        return { x: 1 - bell * 0.06, y: 1 + bell * 0.08 };
      case "spin":
        return { x: 1 - bell * 0.02, y: 1 + bell * 0.02 };
      case "stretch":
        return { x: 1 - bell * 0.08, y: 1 + bell * 0.12 };
      case "yawn":
        return { x: 1 + bell * 0.05, y: 1 - bell * 0.04 };
      case "dance":
        return { x: 1 - bell * 0.05, y: 1 + bell * 0.08 };
      case "meditate":
        return { x: 1 + bell * 0.01, y: 1 - bell * 0.01 };
      case "play_dead":
        return { x: 1 + bell * 0.12, y: 1 - bell * 0.15 };
      default:
        return { x: 1, y: 1 };
    }
  }

  getOffset(): { x: number; y: number; rotation: number } {
    if (this.idleAnimType === "none") {
      return { x: 0, y: 0, rotation: 0 };
    }

    const t = this.idleAnimProgress;
    const bell = Math.sin(t * Math.PI);

    switch (this.idleAnimType) {
      case "bounce":
        return { x: 0, y: -bell * 6, rotation: 0 };
      case "spin":
        return { x: 0, y: 0, rotation: bell * Math.PI * 2 * (t < 0.5 ? 1 : -1) };
      case "look_around": {
        const lookT = Math.sin(t * Math.PI * 2);
        return { x: 0, y: 0, rotation: lookT * 0.15 };
      }
      case "fidget":
        return { x: Math.sin(t * Math.PI * 4) * 1.5, y: 0, rotation: Math.sin(t * Math.PI * 3) * 0.04 };
      case "stretch":
        return { x: 0, y: -bell * 3, rotation: 0 };
      case "yawn":
        return { x: 0, y: bell * 2, rotation: 0 };
      case "dance":
        return { x: Math.sin(t * Math.PI * 4) * 4, y: -Math.abs(Math.sin(t * Math.PI * 2)) * 6, rotation: Math.sin(t * Math.PI * 2) * 0.1 };
      case "meditate":
        return { x: 0, y: -bell * 2, rotation: 0 };
      case "play_dead":
        return { x: 0, y: bell * 4, rotation: 0 };
      default:
        return { x: 0, y: 0, rotation: 0 };
    }
  }
}
