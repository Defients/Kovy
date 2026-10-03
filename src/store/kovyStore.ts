import { create } from "zustand";
import type { KovyRuntimeState, Vec2, MotionTarget, MotionRegion, BehaviorState, SurfaceMood, InternalMoodState, MonitorBounds } from "./types";
import { DEFAULT_RUNTIME_STATE } from "./defaults";
import { useEntityStore, FOUNDER_ID } from "./entityStore";

export { FOUNDER_ID } from "./entityStore";

interface KovyStore extends KovyRuntimeState {
  setPosition: (pos: Vec2) => void;
  setVelocity: (vel: Vec2) => void;
  setTargetPosition: (pos: Vec2 | null) => void;
  setBehaviorState: (state: BehaviorState) => void;
  setActiveTarget: (target: MotionTarget | null) => void;
  setCandidateTargets: (targets: MotionTarget[]) => void;
  setRawRegions: (regions: MotionRegion[]) => void;
  setInternalMood: (mood: InternalMoodState) => void;
  setSurfaceMood: (mood: SurfaceMood) => void;
  setSquashStretch: (ss: Vec2) => void;
  setEyeTarget: (et: Vec2) => void;
  setBlinkState: (bs: number) => void;
  setBlinkTimer: (bt: number) => void;
  setGlowPulse: (gp: number) => void;
  setVisible: (v: boolean) => void;
  setPaused: (p: boolean) => void;
  setAsleep: (a: boolean) => void;
  setInteracting: (i: boolean) => void;
  setClickThrough: (ct: boolean) => void;
  setPrivacyPaused: (pp: boolean) => void;
  setScreenSize: (w: number, h: number) => void;
  setCursorPosition: (pos: Vec2) => void;
  setCurrentFps: (fps: number) => void;
  setAnalysisActive: (a: boolean) => void;
  setStateTimer: (t: number) => void;
  setPerchPosition: (pos: Vec2 | null) => void;
  setParticleSpawnRate: (r: number) => void;
  setDashActive: (d: boolean) => void;
  setChainCount: (c: number) => void;
  setDashCooldownTimer: (t: number) => void;
  setChainQueue: (q: MotionTarget[]) => void;
  setHabitatEditMode: (m: boolean) => void;
  setCurrentMonitorBounds: (b: MonitorBounds | null) => void;
  resetState: () => void;

  updateFrame: (patch: Partial<KovyRuntimeState>) => void;
}

function founderPatch(patch: Partial<KovyRuntimeState>) {
  const es = useEntityStore.getState();
  if (es.hasEntity(FOUNDER_ID)) {
    es._updateFounderInternal(patch);
  }
}

export const useKovyStore = create<KovyStore>((set) => ({
  ...structuredClone(DEFAULT_RUNTIME_STATE),

  setPosition: (pos) => founderPatch({ position: pos }),
  setVelocity: (vel) => founderPatch({ velocity: vel }),
  setTargetPosition: (pos) => founderPatch({ targetPosition: pos }),
  setBehaviorState: (state) => founderPatch({ behaviorState: state }),
  setActiveTarget: (target) => founderPatch({ activeTarget: target }),
  setCandidateTargets: (targets) => founderPatch({ candidateTargets: targets }),
  setRawRegions: (regions) => founderPatch({ rawRegions: regions }),
  setInternalMood: (mood) => founderPatch({ internalMood: mood }),
  setSurfaceMood: (mood) => founderPatch({ surfaceMood: mood }),
  setSquashStretch: (ss) => founderPatch({ squashStretch: ss }),
  setEyeTarget: (et) => founderPatch({ eyeTarget: et }),
  setBlinkState: (bs) => founderPatch({ blinkState: bs }),
  setBlinkTimer: (bt) => founderPatch({ blinkTimer: bt }),
  setGlowPulse: (gp) => founderPatch({ glowPulse: gp }),
  setVisible: (v) => founderPatch({ isVisible: v }),
  setPaused: (p) => founderPatch({ isPaused: p }),
  setAsleep: (a) => founderPatch({ isAsleep: a }),
  setInteracting: (i) => founderPatch({ isInteracting: i }),
  setClickThrough: (ct) => founderPatch({ isClickThrough: ct }),
  setPrivacyPaused: (pp) => founderPatch({ isPrivacyPaused: pp }),
  setScreenSize: (w, h) => founderPatch({ screenWidth: w, screenHeight: h }),
  setCursorPosition: (pos) => founderPatch({ cursorPosition: pos }),
  setCurrentFps: (fps) => founderPatch({ currentFps: fps }),
  setAnalysisActive: (a) => founderPatch({ analysisActive: a }),
  setStateTimer: (t) => founderPatch({ stateTimer: t }),
  setPerchPosition: (pos) => founderPatch({ perchPosition: pos }),
  setParticleSpawnRate: (r) => founderPatch({ particleSpawnRate: r }),
  setDashActive: (d) => founderPatch({ dashActive: d }),
  setChainCount: (c) => founderPatch({ chainCount: c }),
  setDashCooldownTimer: (t) => founderPatch({ dashCooldownTimer: t }),
  setChainQueue: (q) => founderPatch({ chainQueue: q }),
  setHabitatEditMode: (m) => set({ habitatEditMode: m }),
  setCurrentMonitorBounds: (b) => founderPatch({ currentMonitorBounds: b }),
  resetState: () => {
    useEntityStore.getState().resetEntity(FOUNDER_ID);
  },

  updateFrame: (patch) => {
    founderPatch(patch);
  },
}));

let prevFounderRuntime: KovyRuntimeState | undefined;
useEntityStore.subscribe((state) => {
  const founderRuntime = state.entities[FOUNDER_ID]?.runtime;
  if (founderRuntime && founderRuntime !== prevFounderRuntime) {
    prevFounderRuntime = founderRuntime;
    useKovyStore.setState(founderRuntime, false);
  }
});
