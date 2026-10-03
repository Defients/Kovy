// ============================================================
// Engine Manager — extracted from KovyRenderer
// Handles initialization, cleanup, and configuration of all
// Kovy engines. Provides a typed container for engine instances.
// ============================================================

import { MotionInterestEngine } from "@/engine/motionInterest";
import { BehaviorEngine } from "@/engine/behaviorEngine";
import { MovementController } from "@/engine/movementController";
import { FamilyEngine, type FamilyInfluence } from "@/engine/familyEngine";
import { MuseEngine } from "@/engine/museEngine";
import { GamingEngine, NULL_GAMING_OUTPUT } from "@/engine/gamingEngine";
import { CircadianEngine, NULL_CIRCADIAN_OUTPUT } from "@/engine/circadianEngine";
import { EmoteEngine } from "@/engine/emoteEngine";
import { AtmosphereEngine } from "@/engine/atmosphereEngine";
import { BondEngine } from "@/engine/bondEngine";
import { InteractionEngine } from "@/engine/interactionEngine";
import { MilestoneEngine } from "@/engine/milestoneEngine";
import { RitualEngine } from "@/engine/ritualEngine";
import { JournalEngine } from "@/engine/journalEngine";
import { WeatherEngine } from "@/engine/weatherEngine";
import { SkinPackEngine, type SkinPack } from "@/engine/skinPackEngine";
import { SoundPackEngine } from "@/engine/soundPackEngine";
import { FamilyScenesEngine } from "@/engine/familyScenesEngine";
import { AppProfileEngine, BUILTIN_APP_PROFILES } from "@/engine/appProfileEngine";
import { HabitatObjectsEngine, type HabitatObjectType } from "@/engine/habitatObjectsEngine";
import { AudioReactivityEngine } from "@/engine/audioReactivityEngine";
import { ThoughtEngine } from "@/engine/thoughtEngine";
import { SeasonalEngine } from "@/engine/seasonalEngine";
import { GrowthEngine } from "@/engine/growthEngine";
import { StatsEngine } from "@/engine/statsEngine";
import { FocusEngine } from "@/engine/focusEngine";
import { IdleEngine } from "@/engine/idleEngine";
import { PersonalityEvolutionEngine } from "@/engine/personalityEvolutionEngine";
import { CelebrationEngine } from "@/engine/celebrationEngine";
import { AmbientSoundEngine } from "@/engine/ambientSoundEngine";
import { WhisperEngine } from "@/engine/whisperEngine";
import { EntityRelationsEngine } from "@/engine/entityRelationsEngine";
import { DragEngine } from "@/engine/dragEngine";
import { ProfilesEngine } from "@/engine/profilesEngine";
import { DreamEngine, NULL_DREAM_OUTPUT } from "@/engine/dreamEngine";
import type { DreamOutput } from "@/engine/dreamEngine";
import { ToyEngine } from "@/engine/toyEngine";
import { ExperimentalEngine } from "@/engine/experimentalEngine";
import { IntentEngine } from "@/engine/intentEngine";
import { RecallEngine } from "@/engine/recallEngine";
import { StoryEngine } from "@/engine/storyEngine";
import { MuseOverlayRenderer } from "@/overlay/MuseOverlay";
import { GamingResidueRenderer } from "@/overlay/GamingResidue";
import { EmoteRenderer } from "@/overlay/EmoteRenderer";
import { AtmosphereRenderer } from "@/overlay/AtmosphereRenderer";
import { ParticleBurstRenderer } from "@/overlay/ParticleBurst";
import { AuroraBackgroundRenderer } from "@/overlay/AuroraBackground";
import { AccessoryRenderer } from "@/overlay/AccessoryRenderer";
import { setSoundPack } from "@/engine/audioEngine";
import { getForegroundApp } from "@/lib/tauriBridge";
import type { KovyConfig, EntityId, MemoryInfluence, BehaviorState, SurfaceMood, Vec2, GamingOutput, CircadianOutput } from "@/store/types";

export interface EngineContainer {
  motion: MotionInterestEngine | null;
  behavior: BehaviorEngine | null;
  movement: MovementController | null;
  family: FamilyEngine | null;
  muse: MuseEngine | null;
  gaming: GamingEngine | null;
  circadian: CircadianEngine | null;
  cachedMemoryInfluence: MemoryInfluence | null;
  cachedFamilyInfluences: Map<EntityId, FamilyInfluence>;
  cachedGamingOutput: GamingOutput;
  cachedCircadianOutput: CircadianOutput;
  cachedDreamOutput: DreamOutput;
  dream: DreamEngine | null;
  emote: EmoteEngine | null;
  atmosphere: AtmosphereEngine | null;
  bond: BondEngine | null;
  interaction: InteractionEngine | null;
  milestone: MilestoneEngine | null;
  ritual: RitualEngine | null;
  journal: JournalEngine | null;
  weather: WeatherEngine | null;
  skinPack: SkinPackEngine | null;
  soundPack: SoundPackEngine | null;
  familyScenes: FamilyScenesEngine | null;
  appProfile: AppProfileEngine | null;
  habitatObjects: HabitatObjectsEngine | null;
  audioReactivity: AudioReactivityEngine | null;
  thought: ThoughtEngine | null;
  seasonal: SeasonalEngine | null;
  growth: GrowthEngine | null;
  stats: StatsEngine | null;
  focus: FocusEngine | null;
  idle: IdleEngine | null;
  personalityEvolution: PersonalityEvolutionEngine | null;
  celebration: CelebrationEngine | null;
  ambientSound: AmbientSoundEngine | null;
  whisper: WhisperEngine | null;
  entityRelations: EntityRelationsEngine | null;
  drag: DragEngine | null;
  profiles: ProfilesEngine | null;
  toy: ToyEngine | null;
  experimental: ExperimentalEngine | null;
  intent: IntentEngine | null;
  recall: RecallEngine | null;
  story: StoryEngine | null;
  // Renderer instances (lazily created)
  museRenderer: MuseOverlayRenderer | null;
  gamingResidue: GamingResidueRenderer | null;
  emoteRenderer: EmoteRenderer | null;
  atmosphereRenderer: AtmosphereRenderer | null;
  particleBurst: ParticleBurstRenderer | null;
  auroraBackground: AuroraBackgroundRenderer | null;
  accessoryRenderer: AccessoryRenderer | null;
  siblings: Map<EntityId, { behavior: BehaviorEngine; movement: MovementController; prevState: BehaviorState }>;
  _emoteEntities: Array<{ id: EntityId; position: Vec2; mood: SurfaceMood; behaviorState: BehaviorState }>;
  _museEntities: Array<{ id: EntityId; position: { x: number; y: number }; mood: SurfaceMood }>;
}

export function createEngineContainer(): EngineContainer {
  return {
    motion: null,
    behavior: null,
    movement: null,
    family: null,
    muse: null,
    gaming: null,
    circadian: null,
    cachedMemoryInfluence: null,
    cachedFamilyInfluences: new Map(),
    cachedGamingOutput: { ...NULL_GAMING_OUTPUT },
    cachedCircadianOutput: { ...NULL_CIRCADIAN_OUTPUT },
    cachedDreamOutput: { ...NULL_DREAM_OUTPUT },
    dream: null,
    emote: null,
    atmosphere: null,
    bond: null,
    interaction: null,
    milestone: null,
    ritual: null,
    journal: null,
    weather: null,
    skinPack: null,
    soundPack: null,
    familyScenes: null,
    appProfile: null,
    habitatObjects: null,
    audioReactivity: null,
    thought: null,
    seasonal: null,
    growth: null,
    stats: null,
    focus: null,
    idle: null,
    personalityEvolution: null,
    celebration: null,
    ambientSound: null,
    whisper: null,
    entityRelations: null,
    drag: null,
    profiles: null,
    toy: null,
    experimental: null,
    intent: null,
    recall: null,
    story: null,
    museRenderer: null,
    gamingResidue: null,
    emoteRenderer: null,
    atmosphereRenderer: null,
    particleBurst: null,
    auroraBackground: null,
    accessoryRenderer: null,
    siblings: new Map(),
    _emoteEntities: [],
    _museEntities: [],
  };
}

/** Initialize all engines with the given config and initial position */
export function initEngines(engines: EngineContainer, config: KovyConfig, initialX: number, initialY: number): void {
  engines.motion = new MotionInterestEngine();
  engines.behavior = new BehaviorEngine();
  engines.movement = new MovementController();
  engines.movement.setPosition(initialX, initialY);

  engines.family = new FamilyEngine();
  engines.muse = new MuseEngine();
  engines.muse.setActive(true);
  engines.muse.bindForegroundDetection(getForegroundApp);

  engines.gaming = new GamingEngine();
  engines.circadian = new CircadianEngine();
  engines.dream = new DreamEngine();
  engines.emote = new EmoteEngine();
  engines.atmosphere = new AtmosphereEngine();
  engines.bond = new BondEngine(config.bond);
  engines.interaction = new InteractionEngine();
  engines.interaction.setInteractionRadius(config.bond.interactionRadius);
  engines.interaction.setPokeStartleChance(config.bond.pokeStartleChance);
  engines.milestone = new MilestoneEngine();

  engines.ritual = new RitualEngine();
  engines.journal = new JournalEngine();
  engines.weather = new WeatherEngine();
  engines.skinPack = new SkinPackEngine();
  engines.skinPack.loadCustomPacks(config.skinPack.customPacks as SkinPack[]);
  engines.skinPack.setActivePack(config.skinPack.activePackId);
  engines.appProfile = new AppProfileEngine();
  for (const profile of BUILTIN_APP_PROFILES) {
    engines.appProfile.addProfile(profile);
  }
  for (const profile of config.appProfile.profiles) {
    engines.appProfile.addProfile(profile);
  }
  engines.soundPack = new SoundPackEngine();
  engines.soundPack.setActivePack(config.soundPack.activePackId);
  setSoundPack(engines.soundPack.getActivePack());
  engines.familyScenes = new FamilyScenesEngine();
  engines.habitatObjects = new HabitatObjectsEngine();
  for (const obj of config.habitatObjects.objects) {
    engines.habitatObjects.addObject(obj.type as HabitatObjectType, obj.position);
  }

  engines.audioReactivity = new AudioReactivityEngine();
  engines.thought = new ThoughtEngine();
  engines.seasonal = new SeasonalEngine();
  engines.growth = new GrowthEngine();
  engines.stats = new StatsEngine();
  engines.focus = new FocusEngine();
  engines.idle = new IdleEngine();
  engines.personalityEvolution = new PersonalityEvolutionEngine();
  engines.celebration = new CelebrationEngine();
  engines.ambientSound = new AmbientSoundEngine();
  engines.whisper = new WhisperEngine();
  engines.entityRelations = new EntityRelationsEngine();
  engines.drag = new DragEngine();
  engines.profiles = new ProfilesEngine();
  engines.profiles.seedDefaultProfiles();
  engines.toy = new ToyEngine();
  engines.experimental = new ExperimentalEngine();
  engines.intent = new IntentEngine();
  engines.recall = new RecallEngine();
  engines.story = new StoryEngine();
}

/** Dispose all engines and release resources */
export function disposeEngines(engines: EngineContainer): void {
  engines.motion?.reset();
  engines.motion = null;
  engines.behavior = null;
  engines.movement = null;
  engines.family?.reset();
  engines.family = null;
  engines.siblings.clear();
  engines.cachedFamilyInfluences.clear();
  engines.muse?.reset();
  engines.muse = null;
  engines.museRenderer = null;
  engines.gaming?.reset();
  engines.gaming = null;
  engines.gamingResidue = null;
  engines.cachedGamingOutput = { ...NULL_GAMING_OUTPUT };
  engines.circadian?.reset();
  engines.circadian = null;
  engines.cachedCircadianOutput = { ...NULL_CIRCADIAN_OUTPUT };
  engines.dream?.clear();
  engines.dream = null;
  engines.cachedDreamOutput = { ...NULL_DREAM_OUTPUT };
  engines.emote?.reset();
  engines.emote = null;
  engines.emoteRenderer = null;
  engines.atmosphere?.reset();
  engines.atmosphere = null;
  engines.atmosphereRenderer = null;
  engines.particleBurst = null;
  engines.auroraBackground = null;
  engines.accessoryRenderer = null;
  engines.bond = null;
  engines.interaction?.reset();
  engines.interaction = null;
  engines.milestone?.flush();
  engines.milestone = null;
  engines.ritual = null;
  engines.journal?.flush();
  engines.journal = null;
  engines.weather = null;
  engines.skinPack = null;
  engines.soundPack = null;
  engines.familyScenes = null;
  engines.appProfile = null;
  engines.habitatObjects = null;

  engines.ambientSound?.dispose();
  engines.ambientSound = null;
  engines.audioReactivity?.dispose();
  engines.audioReactivity = null;
  engines.stats?.flushSave();
  engines.stats = null;
  engines.growth?.flush();
  engines.growth = null;
  engines.personalityEvolution?.flush();
  engines.personalityEvolution = null;
  engines.thought = null;
  engines.seasonal = null;
  engines.focus = null;
  engines.idle = null;
  engines.celebration = null;
  engines.whisper = null;
  engines.entityRelations = null;
  engines.drag = null;
  engines.profiles = null;
  engines.toy?.destroy();
  engines.toy = null;
  engines.experimental?.destroy();
  engines.experimental = null;
  engines.intent?.destroy();
  engines.intent = null;
  engines.recall?.destroy();
  engines.recall = null;
  engines.story?.destroy();
  engines.story = null;
}
