import type { ExperimentalConfig, ExperimentalInteraction, Vec2, BehaviorState } from "@/store/types";
import type { VirtualDesktopBounds } from "@/lib/monitorUtils";
import { nativeExperimentalInput, type ExperimentalInputAdapter, type InteractionTarget } from "./experimentalInput";

const INTERACTION_BEHAVIORS: BehaviorState[] = ["inspect", "wander", "orbit"];
export interface InteractionLogEntry {
  timestamp: number; type: ExperimentalInteraction; position: Vec2;
  targetElement: string; success: boolean; error?: string;
}
export class ExperimentalEngine {
  private config: ExperimentalConfig | null = null;
  private lastInteractionTime = -Infinity;
  private log: InteractionLogEntry[] = [];
  private targets: InteractionTarget[] = [];
  private generation = 0;
  private inFlight = false;
  private virtualDesktop: VirtualDesktopBounds = { x: 0, y: 0, width: 1920, height: 1080 };

  constructor(private readonly input: ExperimentalInputAdapter = nativeExperimentalInput,
    private readonly isPaused: () => boolean = () => true) {}

  updateConfig(config: ExperimentalConfig): void {
    if (JSON.stringify(config) !== JSON.stringify(this.config)) this.generation++;
    this.config = structuredClone(config);
  }
  updateTargets(targets: InteractionTarget[]): void { this.targets = targets.map(t => ({ ...t })); }
  updateVirtualDesktop(vd: VirtualDesktopBounds): void { this.virtualDesktop = vd; }
  isEnabled(): boolean { return this.config?.enabled ?? false; }
  private authorized(behavior: BehaviorState, paused: boolean): boolean {
    return !!this.config?.enabled && this.config.optInAcknowledged && this.config.autoInteract
      && this.config.targetMode === "toys" && !paused && !this.isPaused()
      && INTERACTION_BEHAVIORS.includes(behavior);
  }
  canInteract(behavior: BehaviorState, paused: boolean): boolean {
    return this.authorized(behavior, paused) && !this.inFlight && this.getCooldownRemaining() === 0;
  }
  private valid(target: InteractionTarget, origin: Vec2): boolean {
    return Number.isFinite(target.x) && Number.isFinite(target.y)
      && (target.id.startsWith("toy:") || target.id.startsWith("habitat:"))
      && target.x >= 0 && target.y >= 0 && target.x < this.virtualDesktop.width && target.y < this.virtualDesktop.height
      && Math.hypot(target.x - origin.x, target.y - origin.y) <= (this.config?.interactionRadius ?? 0)
      && this.targets.some(t => t.id === target.id && t.x === target.x && t.y === target.y);
  }
  async tryInteract(origin: Vec2, behavior: BehaviorState, paused: boolean): Promise<InteractionLogEntry | null> {
    if (!this.canInteract(behavior, paused)) return null;
    const actions = this.config!.allowedInteractions.filter((a): a is "click" | "hover" => a === "click" || a === "hover");
    const target = this.targets.find(t => this.valid(t, origin));
    if (!target || !actions.length) return null;
    const action = actions[0];
    const generation = this.generation;
    this.inFlight = true;
    this.lastInteractionTime = Date.now(); // Reserve before the first await, including failures.
    try {
      const resolved = await this.input.lookup({ ...target });
      if (generation !== this.generation || !this.authorized(behavior, paused)
          || !resolved || !this.valid(resolved, origin) || resolved.id !== target.id) return null;
      await this.input.dispatch(resolved, action);
      if (generation !== this.generation || !this.authorized(behavior, paused)) return null;
      return this.record(action, resolved, true);
    } catch {
      if (generation !== this.generation || !this.authorized(behavior, paused)) return null;
      return this.record(action, target, false, "Desktop input is unavailable or blocked");
    } finally { this.inFlight = false; }
  }
  private record(type: ExperimentalInteraction, target: InteractionTarget, success: boolean, error?: string): InteractionLogEntry {
    const entry = { timestamp: Date.now(), type, position: { x: target.x, y: target.y }, targetElement: "local companion object", success, error };
    this.log.unshift(entry); this.log = this.log.slice(0, 50); return entry;
  }
  getLog(): InteractionLogEntry[] { return [...this.log]; }
  getCooldownRemaining(): number { return Math.max(0, Math.max(1, this.config?.rateLimitSec ?? 1) - (Date.now() - this.lastInteractionTime) / 1000); }
  clearLog(): void { this.log = []; }
  destroy(): void { this.generation++; this.config = null; this.targets = []; this.log = []; }
}
