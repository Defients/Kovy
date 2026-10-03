import type {
  KovyConfig,
  GeneralConfig,
  AppearanceConfig,
  BehaviorConfig,
  VisionConfig,
  MoodConfig,
  PerformanceConfig,
  PrivacyConfig,
  AudioConfig,
  HotkeyConfig,
  AdvancedConfig,
  HyperConfig,
  HabitatConfig,
  MemoryConfig,
  FamilyConfig,
  FamilyDynamics,
  MuseConfig,
  GamingConfig,
  CircadianConfig,
  EmoteConfig,
  AtmosphereConfig,
  BondConfig,
  MilestoneConfig,
  RitualConfig,
  JournalConfig,
  WeatherConfig,
  SkinPackConfig,
  SoundPackConfig,
  FamilyScenesConfig,
  AppProfileConfig,
  HabitatObjectsConfig,
  AudioReactivityConfig,
  ThoughtConfig,
  SeasonalConfig,
  GrowthConfig,
  StatsConfig,
  FocusConfig,
  IdleConfig,
  PersonalityEvolutionConfig,
  CelebrationConfig,
  AmbientSoundConfig,
  WhisperConfig,
  EntityRelationsConfig,
  DragConfig,
  ProfilesConfig,
  DreamConfig,
  FocusTargetConfig,
  AIConfig,
  ToyConfig,
  ExperimentalConfig,
  DigestConfig,
  ChronicleConfig,
  IntentConfig,
  StoryConfig,
  RecallConfig,
  ChatConfig,
  PersonalityOffsets,
  EntityVisualConfig,
  InternalMoodState,
  KovyRuntimeState,
  BehaviorPreset,
} from "./types";
import { CONFIG_VERSION } from "./types";

export const DEFAULT_GENERAL: GeneralConfig = {
  launchAtStartup: false,
  startMinimized: false,
  monitorMode: "primary",
  pauseOnFullscreen: false,
  pauseOnApps: [],
  streamSafe: false,
  experienceMode: "lite",
};

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  size: 1.0,
  opacity: 0.95,
  glowIntensity: 0.6,
  particleAmount: 0.5,
  trailLength: 0.4,
  shadowSoftness: 0.5,
  eyeStyle: "round",
  bodyStyle: "classic",
  emoteIntensity: 0.6,
  moodColorShift: true,
  reducedMotion: false,
  visualPreset: "balanced",
  renderFpsCap: 60,
  accessoriesEnabled: true,
  auroraBackground: true,
  particleBursts: true,
};

export const DEFAULT_HYPER: HyperConfig = {
  dashStrength: 0.7,
  chainDelay: 0.4,
  orbitBurstDuration: 0.8,
  targetChainThreshold: 0.3,
  maxChainRate: 6,
  dashCooldown: 0.5,
};

export const DEFAULT_BEHAVIOR: BehaviorConfig = {
  preset: "curious",
  curiosityStrength: 0.6,
  attractionStrength: 0.5,
  boredomRate: 0.3,
  dwellTime: 8,
  perchPreference: 0.5,
  wanderAmount: 0.4,
  cursorAvoidRadius: 120,
  cursorCuriosity: false,
  interactionMode: true,
  returnToPerchTendency: 0.4,
  hyper: { ...DEFAULT_HYPER },
};

export const DEFAULT_VISION: VisionConfig = {
  enabled: true,
  analysisFps: 4,
  analysisScale: 0.15,
  motionThreshold: 20,
  persistenceThreshold: 3,
  targetSmoothing: 0.7,
  noveltyWeight: 0.6,
  cursorAdjacentWeight: 0.3,
  ocrEnabled: false,
  ocrCooldownMs: 5000,
  ocrMaxRegions: 1,
  appBlacklist: [],
  appWhitelist: [],
};

export const DEFAULT_MOOD: MoodConfig = {
  enabled: true,
  intensity: 0.6,
  recoverySpeed: 0.4,
  overwhelmThreshold: 0.7,
  energyBaseline: 0.6,
  sleepinessBaseline: 0.3,
  playfulnessBias: 0,
  shynessBias: 0,
  focusBias: 0,
  manualOverride: null,
  randomDrift: 0.15,
  moodToColor: true,
  moodToParticles: true,
  moodColorTransitionSpeed: 0.5,
};

export const DEFAULT_PERFORMANCE: PerformanceConfig = {
  preset: "balanced",
  backgroundThrottling: true,
  batteryThrottling: true,
  gpuAcceleration: true,
  cpuBudget: 5,
  maxAnalysisFps: 6,
  maxRenderFps: 60,
  lowPowerIdle: true,
  suspendOnSystemIdle: true,
  frameSkipping: true,
  adaptiveQuality: false,
};

export const DEFAULT_PRIVACY: PrivacyConfig = {
  sensitiveApps: [],
  ocrDisabled: true,
  retainZeroFrames: true,
  diagnosticsOptIn: false,
  diagnosticsIncludeConfig: true,
  diagnosticsIncludeErrors: true,
  hideFromCapture: false,
  autoHideOnCaptureApp: false,
};

export const DEFAULT_AUDIO: AudioConfig = {
  uiSounds: false,
  kovySounds: false,
  volume: 0.5,
  ambientFrequency: 0.3,
  reactionFrequency: 0.6,
  moodFrequency: 0.4,
  globalCooldownMs: 1500,
  soundEnables: [],
  emoteSounds: true,
  whisperSounds: true,
  celebrationSounds: true,
  focusSounds: true,
  familySounds: true,
};

export const DEFAULT_ENTITY_VISUAL: EntityVisualConfig = {
  customColorsEnabled: false,
  primaryColor: "#5577cc",
  secondaryColor: null,
  toneMode: "single",
  opacity: 0.95,
  rimLightIntensity: 0.3,
};

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  toggleVisibility: "Alt+Shift+K",
  openSettings: "Alt+Shift+S",
  pauseAnalysis: "Alt+Shift+P",
  sleepWake: "Alt+Shift+Z",
  privacyPause: "Alt+Shift+X",
  resetPosition: "Alt+Shift+R",
  toggleMuse: "Alt+Shift+M",
  toggleGaming: "Alt+Shift+G",
  toggleDrag: "Alt+Shift+D",
  toggleFocus: "Alt+Shift+F",
  switchProfile: "Alt+Shift+Tab",
  toggleExperienceMode: "Alt+Shift+L",
  askKovy: "Alt+Shift+A",
  commandPalette: "Alt+Space",
  showDigest: "Alt+Shift+I",
  showChronicle: "Alt+Shift+Y",
  showStory: "Alt+Shift+K",
  openChat: "Alt+Shift+C",
};

export const DEFAULT_ADVANCED: AdvancedConfig = {
  debugMode: false,
  motionOverlay: false,
  targetReticle: false,
  reticleStyle: "crosshair",
  customReticleDataUrl: null,
  salienceGraph: false,
  logLevel: "warn",
  habitatOverlay: false,
};

export const DEFAULT_HABITAT: HabitatConfig = {
  enabled: false,
  homes: [],
  zones: [],
  rails: [],
  nodes: [],
  railInfluence: 0.5,
};

export const DEFAULT_MEMORY: MemoryConfig = {
  enabled: true,
  maxMemories: 2000,
  retentionDays: 90,
  significanceThreshold: 0.3,
  storeAppNames: true,
  storeWindowTitles: false,
  pruneOnStartup: true,
  autoExportSoulDays: 0,
};

export const DEFAULT_FAMILY_DYNAMICS: FamilyDynamics = {
  curiosityContagion: 0.5,
  comfortInfluence: 0.5,
  playfulChaseChance: 0.3,
  synchronizedOrbit: true,
  groupHyperBursts: true,
  territoryRespect: 0.5,
  interEntityBonds: true,
  groupEmotes: true,
};

export const DEFAULT_FAMILY: FamilyConfig = {
  maxEntities: 1,
  dynamics: { ...DEFAULT_FAMILY_DYNAMICS },
  showFamilyNames: false,
  familyUpdateIntervalMs: 500,
};

export const DEFAULT_MUSE: MuseConfig = {
  enabled: false,
  hotkey: "Alt+Shift+M",
  maxOverlays: 6,
  overlayLifetime: 5,
  style: "subtle",
  contextUpdateIntervalMs: 3000,
  codeMode: true,
  writingMode: true,
  designMode: true,
  adaptiveSelection: true,
};

export const DEFAULT_CIRCADIAN: CircadianConfig = {
  enabled: true,
  adaptationRate: 0.3,
  amplifyDayNight: 0.5,
  dreamEnabled: true,
  startleEnabled: true,
  startleCooldown: 8,
  customSchedule: false,
  dayStartTime: 7,
  nightStartTime: 20,
  sleepTracking: false,
  alarmTime: null,
};

export const DEFAULT_GAMING: GamingConfig = {
  enabled: false,
  hotkey: "Alt+Shift+G",
  predictiveBias: 0.5,
  excitementGain: 0.5,
  hyperBlend: 0.4,
  residueAmount: 0.5,
  residueLifetime: 0.6,
  elasticDeformation: 0.5,
  freeformWobble: 0.3,
  visualStyle: "surge",
  comboSystem: true,
  comboDecayRate: 0.5,
};

export const DEFAULT_EMOTE: EmoteConfig = {
  enabled: true,
  intensity: 0.6,
  style: "bubble",
  maxActive: 6,
};

export const DEFAULT_ATMOSPHERE: AtmosphereConfig = {
  enabled: true,
  density: 0.4,
  style: "organic",
  circadianSync: true,
  moodSync: true,
  seasonalSync: true,
};

export const DEFAULT_BOND: BondConfig = {
  enabled: true,
  bondDecayPerDay: 0.02,
  interactionRadius: 80,
  pokeStartleChance: 0.3,
  bondMilestoneVfx: true,
  doubleClickAction: "celebrate",
  rightClickMenu: true,
};

export const DEFAULT_MILESTONE: MilestoneConfig = {
  enabled: true,
  showNotifications: true,
  showProgressInTray: false,
};

export const DEFAULT_RITUAL: RitualConfig = {
  enabled: true,
  notifyOnRitual: true,
  morningGreeting: true,
  lunchCompanion: true,
  afternoonStretch: true,
  eveningWinddown: true,
  midnightDream: true,
  returnCelebration: true,
  weekendSpecial: true,
  coffeeBreak: true,
  sunsetReflection: true,
  lateNightSnack: true,
  firstSnow: true,
  morningGreetingTime: 8,
  lunchTime: 12,
  afternoonStretchTime: 15,
  eveningWinddownTime: 19,
};

export const DEFAULT_JOURNAL: JournalConfig = {
  enabled: true,
  maxEntries: 1000,
  generateDailySummary: true,
};

export const DEFAULT_WEATHER: WeatherConfig = {
  enabled: true,
  changeInterval: 600,
  intensity: 0.5,
  allowedTypes: ["clear", "cloudy", "rain", "storm", "snow", "fog", "aurora"],
  realWeatherSync: false,
  realWeatherInterval: 1800,
  realWeatherLocation: "",
};

export const DEFAULT_SKIN_PACK: SkinPackConfig = {
  activePackId: "default",
  customPacks: [],
  circadianAutoSwitch: false,
  nightPackId: null,
};

export const DEFAULT_SOUND_PACK: SoundPackConfig = {
  activePackId: "default",
  customPacks: [],
};

export const DEFAULT_FAMILY_SCENES: FamilyScenesConfig = {
  enabled: true,
  cooldownMultiplier: 1.0,
  proximityThreshold: 400,
};

export const DEFAULT_APP_PROFILE: AppProfileConfig = {
  enabled: false,
  autoDetect: true,
  profiles: [],
};

export const DEFAULT_HABITAT_OBJECTS: HabitatObjectsConfig = {
  enabled: true,
  maxObjects: 20,
  objects: [],
};

export const DEFAULT_AUDIO_REACTIVITY: AudioReactivityConfig = {
  enabled: false,
  sensitivity: 0.5,
  beatDetection: true,
  feedMood: true,
  feedGaming: false,
  feedVisualizer: true,
  visualizerStyle: "bars",
};

export const DEFAULT_THOUGHT: ThoughtConfig = {
  enabled: true,
  frequency: 0.3,
  maxActive: 2,
  style: "cloud",
  customThoughts: [],
};

export const DEFAULT_SEASONAL: SeasonalConfig = {
  enabled: true,
  events: ["halloween", "christmas", "newyear", "valentines", "stpatricks", "summerSolstice", "autumnEquinox"],
  customEvents: [],
  hemisphere: "northern",
};

export const DEFAULT_GROWTH: GrowthConfig = {
  enabled: true,
  agingRate: 1.0,
  stageThresholds: { young: 3, mature: 14, elder: 60 },
};

export const DEFAULT_STATS: StatsConfig = {
  enabled: true,
  trackingLevel: "standard",
};

export const DEFAULT_FOCUS: FocusConfig = {
  enabled: true,
  detectionSensitivity: 0.5,
  focusBehavior: "meditate",
  suppressEmotes: true,
  suppressSound: true,
};

export const DEFAULT_IDLE: IdleConfig = {
  enabled: true,
  idleThresholdSec: 120,
  idleBehaviors: ["explore", "play_alone", "nap", "dream"],
};

export const DEFAULT_PERSONALITY_EVOLUTION: PersonalityEvolutionConfig = {
  enabled: true,
  evolutionRate: 0.3,
};

export const DEFAULT_CELEBRATION: CelebrationConfig = {
  enabled: true,
  focusThreshold: 25,
  returnThreshold: 24,
  weekendCelebration: true,
};

export const DEFAULT_AMBIENT_SOUND: AmbientSoundConfig = {
  enabled: false,
  volume: 0.3,
  syncWithWeather: true,
  preferredSounds: ["rain", "cafe", "forest"],
};

export const DEFAULT_WHISPER: WhisperConfig = {
  enabled: false,
  frequency: 0.2,
  style: "subtitle",
  categories: ["encouragement", "humor", "facts", "comfort"],
  customMessages: [],
};

export const DEFAULT_ENTITY_RELATIONS: EntityRelationsConfig = {
  enabled: true,
  relationships: [],
  autoEvolve: true,
};

export const DEFAULT_DRAG: DragConfig = {
  enabled: false,
  grabRadius: 40,
  releaseBehavior: "bounce",
  rememberSpots: true,
};

export const DEFAULT_PROFILES: ProfilesConfig = {
  savedProfiles: [],
  activeProfileId: null,
  hotkeySwap: false,
  autoSwitchRules: [],
};

export const DEFAULT_DREAM: DreamConfig = {
  enabled: true,
  particleDensity: 0.5,
  thoughtFrequency: 0.3,
  colorWash: true,
  maxDreamParticles: 12,
};

export const DEFAULT_PERSONALITY: PersonalityOffsets = {
  curiosityBias: 0,
  energyBias: 0,
  shynessBias: 0,
  playfulnessBias: 0,
  wanderBias: 0,
  colorHueOffset: 0,
  sizeOffset: 0,
};

export const DEFAULT_FOCUS_TARGET: FocusTargetConfig = {
  enabled: true,
  windowAttraction: 0.4,
  cursorAttraction: 0.3,
  gamingWindowBoost: 0.35,
  gamingCursorBoost: 0.3,
  blendFactor: 0.35,
  habitatSoftening: 0.5,
};

export const DEFAULT_AI: AIConfig = {
  enabled: false,
  provider: "openrouter",
  model: "openrouter/auto",
  periodicEnabled: false,
  periodicIntervalSec: 300,
  periodicInsightPriority: 0.8,
  sendScreenshot: false,
  screenshotMaxWidth: 1280,
  screenshotJpegQuality: 75,
  screenshotMonitorIndices: [],
  screenshotMonitorQualities: {},
  includeForegroundApp: true,
  instaSendCooldownSec: 5,
  requestTimeoutSec: 30,
  maxThoughtChars: 120,
  maxWhisperChars: 180,
};

export const DEFAULT_TOYS: ToyConfig = {
  enabled: false,
  placedToys: [],
  respawnTreatsMin: 10,
  laserFollowsCursor: false,
  siblingsPlay: true,
  maxToys: 30,
};

export const DEFAULT_EXPERIMENTAL: ExperimentalConfig = {
  enabled: false,
  interactionRadius: 150,
  autoInteract: false,
  allowedInteractions: ["click"],
  rateLimitSec: 5,
  optInAcknowledged: false,
  targetMode: "toys",
  allowedApps: [],
};

export const DEFAULT_DIGEST: DigestConfig = {
  enabled: true,
  autoDismissSec: 9,
  showBond: true,
  showStats: true,
  showMood: true,
  showGrowth: true,
  showHighlight: true,
};

export const DEFAULT_CHRONICLE: ChronicleConfig = {
  enabled: true,
  snapshotHour: 21,       // 9 PM local — end-of-day recap window
  retentionDays: 90,      // ~3 months of daily snapshots (~13 KB)
  autoDismissSec: 12,     // slightly longer than digest — more to read
  showTrend: true,
  showInsights: true,
};

export const DEFAULT_INTENT: IntentConfig = {
  enabled: true,
  changeRate: 0.5,
  showInDebug: true,
  thoughtChance: 0.4,
};

export const DEFAULT_STORY: StoryConfig = {
  enabled: true,
  weekday: 0,              // Sunday
  hour: 20,                // 8 PM
  retentionWeeks: 26,      // ~6 months
  autoDismissSec: 15,
  aiPolish: false,
};

export const DEFAULT_RECALL: RecallConfig = {
  enabled: true,
  chance: 0.25,
  minSignificance: 0.6,
  maxAgeDays: 60,
};

export const DEFAULT_CHAT: ChatConfig = {
  enabled: false,
  persistHistory: false,
  maxTurns: 12,
  sendScreenshot: false,
  panelPosition: "near-kovy",
};

export const DEFAULT_CONFIG: KovyConfig = {
  version: CONFIG_VERSION,
  general: { ...DEFAULT_GENERAL },
  appearance: { ...DEFAULT_APPEARANCE },
  behavior: { ...DEFAULT_BEHAVIOR },
  vision: { ...DEFAULT_VISION },
  mood: { ...DEFAULT_MOOD },
  performance: { ...DEFAULT_PERFORMANCE },
  privacy: { ...DEFAULT_PRIVACY },
  audio: { ...DEFAULT_AUDIO },
  hotkeys: { ...DEFAULT_HOTKEYS },
  advanced: { ...DEFAULT_ADVANCED },
  habitat: { ...DEFAULT_HABITAT },
  memory: { ...DEFAULT_MEMORY },
  family: { ...DEFAULT_FAMILY },
  muse: { ...DEFAULT_MUSE },
  gaming: { ...DEFAULT_GAMING },
  circadian: { ...DEFAULT_CIRCADIAN },
  emote: { ...DEFAULT_EMOTE },
  atmosphere: { ...DEFAULT_ATMOSPHERE },
  bond: { ...DEFAULT_BOND },
  milestone: { ...DEFAULT_MILESTONE },
  ritual: { ...DEFAULT_RITUAL },
  journal: { ...DEFAULT_JOURNAL },
  weather: { ...DEFAULT_WEATHER },
  skinPack: { ...DEFAULT_SKIN_PACK },
  soundPack: { ...DEFAULT_SOUND_PACK },
  familyScenes: { ...DEFAULT_FAMILY_SCENES },
  appProfile: { ...DEFAULT_APP_PROFILE },
  habitatObjects: { ...DEFAULT_HABITAT_OBJECTS },
  audioReactivity: { ...DEFAULT_AUDIO_REACTIVITY },
  thought: { ...DEFAULT_THOUGHT },
  seasonal: { ...DEFAULT_SEASONAL },
  growth: { ...DEFAULT_GROWTH },
  stats: { ...DEFAULT_STATS },
  focus: { ...DEFAULT_FOCUS },
  idle: { ...DEFAULT_IDLE },
  personalityEvolution: { ...DEFAULT_PERSONALITY_EVOLUTION },
  celebration: { ...DEFAULT_CELEBRATION },
  ambientSound: { ...DEFAULT_AMBIENT_SOUND },
  whisper: { ...DEFAULT_WHISPER },
  entityRelations: { ...DEFAULT_ENTITY_RELATIONS },
  drag: { ...DEFAULT_DRAG },
  profiles: { ...DEFAULT_PROFILES },
  dream: { ...DEFAULT_DREAM },
  focusTarget: { ...DEFAULT_FOCUS_TARGET },
  ai: { ...DEFAULT_AI },
  toys: { ...DEFAULT_TOYS },
  experimental: { ...DEFAULT_EXPERIMENTAL },
  digest: { ...DEFAULT_DIGEST },
  chronicle: { ...DEFAULT_CHRONICLE },
  intent: { ...DEFAULT_INTENT },
  story: { ...DEFAULT_STORY },
  recall: { ...DEFAULT_RECALL },
  chat: { ...DEFAULT_CHAT },
  shadowConfig: null,
  onboardingComplete: false,
};

export const DEFAULT_INTERNAL_MOOD: InternalMoodState = {
  curiosity: 0.5,
  comfort: 0.6,
  stimulation: 0.3,
  fatigue: 0.2,
  overwhelm: 0.0,
  trust: 0.3,
  boredom: 0.2,
  confidence: 0.5,
};

export const DEFAULT_RUNTIME_STATE: KovyRuntimeState = {
  position: { x: 200, y: 200 },
  velocity: { x: 0, y: 0 },
  targetPosition: null,
  behaviorState: "idle_float",
  stateTimer: 0,
  perchPosition: null,
  dashActive: false,
  chainCount: 0,
  dashCooldownTimer: 0,
  chainQueue: [],
  internalMood: { ...DEFAULT_INTERNAL_MOOD },
  surfaceMood: "calm",
  moodTransitionProgress: 0,
  activeTarget: null,
  candidateTargets: [],
  rawRegions: [],
  squashStretch: { x: 1, y: 1 },
  eyeTarget: { x: 0, y: 0 },
  blinkTimer: 3,
  blinkState: 0,
  glowPulse: 0,
  particleSpawnRate: 0,
  isVisible: true,
  isPaused: false,
  isAsleep: false,
  isInteracting: false,
  isClickThrough: true,
  isPrivacyPaused: false,
  screenWidth: 1920,
  screenHeight: 1080,
  cursorPosition: { x: 0, y: 0 },
  currentFps: 60,
  analysisActive: false,
  habitatEditMode: false,
  currentMonitorBounds: null,
};

export const BEHAVIOR_PRESETS: Record<BehaviorPreset, Partial<BehaviorConfig>> = {
  chill: {
    curiosityStrength: 0.3,
    attractionStrength: 0.3,
    boredomRate: 0.15,
    dwellTime: 15,
    perchPreference: 0.8,
    wanderAmount: 0.2,
    returnToPerchTendency: 0.7,
  },
  curious: {
    curiosityStrength: 0.7,
    attractionStrength: 0.6,
    boredomRate: 0.4,
    dwellTime: 6,
    perchPreference: 0.3,
    wanderAmount: 0.6,
    returnToPerchTendency: 0.3,
  },
  goblin: {
    curiosityStrength: 0.95,
    attractionStrength: 0.9,
    boredomRate: 0.7,
    dwellTime: 3,
    perchPreference: 0.1,
    wanderAmount: 0.9,
    returnToPerchTendency: 0.1,
  },
  hyper: {
    curiosityStrength: 1.0,
    attractionStrength: 1.0,
    boredomRate: 0.9,
    dwellTime: 1.5,
    perchPreference: 0.05,
    wanderAmount: 0.5,
    returnToPerchTendency: 0.05,
  },
  focus: {
    curiosityStrength: 0.4,
    attractionStrength: 0.7,
    boredomRate: 0.1,
    dwellTime: 20,
    perchPreference: 0.6,
    wanderAmount: 0.15,
    returnToPerchTendency: 0.6,
  },
};
