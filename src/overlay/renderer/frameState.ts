// ============================================================
// Frame state — extracted from KovyRenderer
// Holds per-frame timing accumulators and cached engine outputs
// that persist across animation frames.
// ============================================================

import type { BehaviorState, SurfaceMood, BondLevel, GrowthStage } from "@/store/types";
import type { FocusTargetInfo } from "@/engine/behaviorEngine";
import { NULL_THOUGHT_OUTPUT, type ThoughtOutput } from "@/engine/thoughtEngine";
import { NULL_WHISPER_OUTPUT, type WhisperOutput } from "@/engine/whisperEngine";
import { NULL_FOCUS_OUTPUT, type FocusOutput } from "@/engine/focusEngine";
import { NULL_IDLE_OUTPUT, type IdleOutput } from "@/engine/idleEngine";
import { NULL_GROWTH_OUTPUT, type GrowthOutput } from "@/engine/growthEngine";
import { NULL_SEASONAL_OUTPUT, type SeasonalOutput } from "@/engine/seasonalEngine";
import { NULL_CELEBRATION_OUTPUT, type CelebrationOutput } from "@/engine/celebrationEngine";
import { NULL_AUDIO_OUTPUT, type AudioReactivityOutput } from "@/engine/audioReactivityEngine";
import { NULL_STATS_OUTPUT, type StatsOutput } from "@/engine/statsEngine";
import { NULL_RELATIONS_OUTPUT, type EntityRelationsOutput } from "@/engine/entityRelationsEngine";
import { NULL_DRAG_OUTPUT, type DragOutput } from "@/engine/dragEngine";

export interface FrameState {
  lastTime: number;
  lastRenderTime: number;
  memoryUpdateAccum: number;
  memoryInfluenceAccum: number;
  familyUpdateAccum: number;
  museUpdateAccum: number;
  circadianUpdateAccum: number;
  bondTickAccum: number;
  prevBehaviorState: BehaviorState;
  prevTopScore: number;
  memoryInitialized: boolean;
  recallAccum: number;
  storyCheckAccum: number;
  ritualUpdateAccum: number;
  weatherUpdateAccum: number;
  appProfileUpdateAccum: number;
  journalSummaryAccum: number;
  prevSurfaceMood: SurfaceMood;
  gamingActive: boolean;
  gamingStartTime: number;
  gamingPeakExcitement: number;
  prevBondLevel: BondLevel | "";
  prevSceneType: string;
  // v7.0 throttled update accumulators
  seasonalUpdateAccum: number;
  growthUpdateAccum: number;
  statsUpdateAccum: number;
  focusUpdateAccum: number;
  idleUpdateAccum: number;
  personalityUpdateAccum: number;
  celebrationUpdateAccum: number;
  thoughtUpdateAccum: number;
  whisperUpdateAccum: number;
  ambientSoundUpdateAccum: number;
  entityRelationsUpdateAccum: number;
  profilesUpdateAccum: number;
  audioReactivityInitAttempted: boolean;
  // v7.0 engine outputs (stored for use in next frame's rendering)
  thoughtOutput: ThoughtOutput;
  whisperOutput: WhisperOutput;
  focusOutput: FocusOutput;
  idleOutput: IdleOutput;
  growthOutput: GrowthOutput;
  seasonalOutput: SeasonalOutput;
  celebrationOutput: CelebrationOutput;
  audioReactivityOutput: AudioReactivityOutput;
  statsOutput: StatsOutput;
  relationsOutput: EntityRelationsOutput;
  dragOutput: DragOutput;
  prevFocusState: string;
  prevGrowthStage: GrowthStage | "";
  prevSeasonalEvents: string;
  prevSeason: string;
  focusSessionRecorded: boolean;
  idleMinutesAccum: number;
  thoughtSpawnCount: number;
  whisperSpawnCount: number;
  idleDurationAccum: number;
  foregroundBoundsAccum: number;
  cachedFocusTarget: FocusTargetInfo | null;
}

export function createFrameState(): FrameState {
  return {
    lastTime: 0,
    lastRenderTime: 0,
    memoryUpdateAccum: 0,
    memoryInfluenceAccum: 0,
    familyUpdateAccum: 0,
    museUpdateAccum: 0,
    circadianUpdateAccum: 0,
    bondTickAccum: 0,
    prevBehaviorState: "idle_float",
    prevTopScore: 0,
    memoryInitialized: false,
    recallAccum: 0,
    storyCheckAccum: 0,
    ritualUpdateAccum: 0,
    weatherUpdateAccum: 0,
    appProfileUpdateAccum: 0,
    journalSummaryAccum: 0,
    prevSurfaceMood: "calm",
    gamingActive: false,
    gamingStartTime: 0,
    gamingPeakExcitement: 0,
    prevBondLevel: "",
    prevSceneType: "",
    seasonalUpdateAccum: 0,
    growthUpdateAccum: 0,
    statsUpdateAccum: 0,
    focusUpdateAccum: 0,
    idleUpdateAccum: 0,
    personalityUpdateAccum: 0,
    celebrationUpdateAccum: 0,
    thoughtUpdateAccum: 0,
    whisperUpdateAccum: 0,
    ambientSoundUpdateAccum: 0,
    entityRelationsUpdateAccum: 0,
    profilesUpdateAccum: 0,
    audioReactivityInitAttempted: false,
    thoughtOutput: NULL_THOUGHT_OUTPUT,
    whisperOutput: NULL_WHISPER_OUTPUT,
    focusOutput: NULL_FOCUS_OUTPUT,
    idleOutput: NULL_IDLE_OUTPUT,
    growthOutput: NULL_GROWTH_OUTPUT,
    seasonalOutput: NULL_SEASONAL_OUTPUT,
    celebrationOutput: NULL_CELEBRATION_OUTPUT,
    audioReactivityOutput: NULL_AUDIO_OUTPUT,
    statsOutput: NULL_STATS_OUTPUT,
    relationsOutput: NULL_RELATIONS_OUTPUT,
    dragOutput: NULL_DRAG_OUTPUT,
    prevFocusState: "unfocused",
    prevGrowthStage: "",
    prevSeasonalEvents: "",
    prevSeason: "",
    focusSessionRecorded: false,
    idleMinutesAccum: 0,
    thoughtSpawnCount: 0,
    whisperSpawnCount: 0,
    idleDurationAccum: 0,
    foregroundBoundsAccum: 0,
    cachedFocusTarget: null,
  };
}
