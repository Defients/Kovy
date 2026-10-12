// ============================================================
// Kovy Configuration Types — strongly typed, versioned schema
// ============================================================

export const CONFIG_VERSION = 24;

// --- Enums ---

export type VisualPreset = "minimal" | "balanced" | "high" | "ultra";
export type PerformancePreset = "battery" | "balanced" | "quality" | "ultra";
export type BehaviorPreset = "chill" | "curious" | "goblin" | "hyper" | "focus";
export type MonitorMode = "primary" | "current" | string;
export type EyeStyle = "round" | "soft" | "narrow" | "dot" | "sparkle" | "heart" | "crescent";
export type BodyStyle = "classic" | "blob" | "ghost" | "star" | "crystal";

export type MouthShape = "smile" | "grin" | "frown" | "flat" | "o" | "wavy" | "none";
export type EyebrowShape = "raised" | "furrowed" | "relaxed" | "angled" | "none";

export type ToneMode = "single" | "dual";

export type DisplayMonitor = "global" | "primary" | string;

export interface EntityVisualConfig {
  customColorsEnabled: boolean;
  primaryColor: string;           // hex "#rrggbb"
  secondaryColor: string | null;  // hex or null
  toneMode: ToneMode;
  opacity: number;                // 0.1 - 1.0
  rimLightIntensity: number;      // 0 - 1, strength of rim/edge glow
}

export type SurfaceMood =
  | "calm"
  | "curious"
  | "playful"
  | "focused"
  | "sleepy"
  | "excited"
  | "overwhelmed"
  | "shy"
  | "content"
  | "anxious"
  | "nostalgic"
  | "determined";

export type BehaviorState =
  | "idle_float"
  | "wander"
  | "perch"
  | "inspect"
  | "orbit"
  | "follow_burst"
  | "nap"
  | "peek"
  | "celebrate"
  | "recover"
  | "dash_inspect"
  | "burst_orbit"
  | "chain_seek"
  | "snap_perch"
  | "startle"
  | "dream"
  | "stretch"
  | "look_around"
  | "yawn"
  | "dance"
  | "hide"
  | "play_dead"
  | "investigate"
  | "meditate";

// --- Config Sections ---

export type ExperienceMode = "lite" | "full";

export interface GeneralConfig {
  launchAtStartup: boolean;
  startMinimized: boolean;
  monitorMode: MonitorMode;
  pauseOnFullscreen: boolean;
  pauseOnApps: string[];
  streamSafe: boolean;           // hide from screen capture, suppress emotes/sounds
  experienceMode: ExperienceMode; // lite = simplified UI + constrained features, full = everything
}

export interface AppearanceConfig {
  size: number; // 0.5 - 2.0 scale factor
  opacity: number; // 0.3 - 1.0
  glowIntensity: number; // 0 - 1
  particleAmount: number; // 0 - 1
  trailLength: number; // 0 - 1
  shadowSoftness: number; // 0 - 1
  eyeStyle: EyeStyle;
  bodyStyle: BodyStyle;
  emoteIntensity: number; // 0 - 1
  moodColorShift: boolean;
  reducedMotion: boolean;
  visualPreset: VisualPreset;
  renderFpsCap: number; // 15, 30, 60, 120
  accessoriesEnabled: boolean; // auto accessories (sleep cap, party hat, etc.)
  auroraBackground: boolean; // aurora gradient background
  particleBursts: boolean; // behavior-change burst effects
}

export interface HyperConfig {
  dashStrength: number; // 0 - 1, burst acceleration intensity
  chainDelay: number; // 0.1 - 2.0 seconds between chain targets
  orbitBurstDuration: number; // 0.3 - 3.0 seconds of burst orbit
  targetChainThreshold: number; // 0 - 1, minimum score to chain
  maxChainRate: number; // 1 - 10, max chains per 10 seconds
  dashCooldown: number; // 0.2 - 3.0 seconds between dashes
}

export interface BehaviorConfig {
  preset: BehaviorPreset;
  curiosityStrength: number; // 0 - 1
  attractionStrength: number; // 0 - 1
  boredomRate: number; // 0 - 1
  dwellTime: number; // seconds, 1 - 30
  perchPreference: number; // 0 - 1
  wanderAmount: number; // 0 - 1
  cursorAvoidRadius: number; // pixels, 0 - 400
  cursorCuriosity: boolean;
  interactionMode: boolean;
  returnToPerchTendency: number; // 0 - 1
  hyper: HyperConfig;
}

export interface VisionConfig {
  enabled: boolean;
  analysisFps: number; // 1 - 15
  analysisScale: number; // 0.1 - 0.5 (downscale factor)
  motionThreshold: number; // 5 - 80 (pixel diff threshold)
  persistenceThreshold: number; // 1 - 10 (frames)
  targetSmoothing: number; // 0 - 1
  noveltyWeight: number; // 0 - 1
  cursorAdjacentWeight: number; // 0 - 1
  ocrEnabled: boolean;
  ocrCooldownMs: number; // 2000 - 30000 ms between OCR runs
  ocrMaxRegions: number; // 1 - 3 top regions to OCR
  appBlacklist: string[];
  appWhitelist: string[];
}

export interface MoodConfig {
  enabled: boolean;
  intensity: number; // 0 - 1
  recoverySpeed: number; // 0 - 1
  overwhelmThreshold: number; // 0 - 1
  energyBaseline: number; // 0 - 1
  sleepinessBaseline: number; // 0 - 1
  playfulnessBias: number; // -1 to 1
  shynessBias: number; // -1 to 1
  focusBias: number; // -1 to 1
  manualOverride: SurfaceMood | null;
  randomDrift: number; // 0 - 1
  moodToColor: boolean;
  moodToParticles: boolean;
  moodColorTransitionSpeed: number; // 0-1, 0=instant, 1=2s smooth transition
}

export interface PerformanceConfig {
  preset: PerformancePreset;
  backgroundThrottling: boolean;
  batteryThrottling: boolean;
  gpuAcceleration: boolean;
  cpuBudget: number; // 1 - 20 percent target
  maxAnalysisFps: number; // 1 - 15
  maxRenderFps: number; // 15 - 120
  lowPowerIdle: boolean;
  suspendOnSystemIdle: boolean;
  frameSkipping: boolean;
  adaptiveQuality: boolean; // auto-reduce visual fidelity when FPS drops
}

export interface PrivacyConfig {
  sensitiveApps: string[];
  ocrDisabled: boolean;
  retainZeroFrames: boolean;
  diagnosticsOptIn: boolean;
  diagnosticsIncludeConfig: boolean;
  diagnosticsIncludeErrors: boolean;
  /**
   * When true, the overlay window is marked WDA_EXCLUDEFROMCAPTURE on Windows,
   * hiding it from OBS, screen recording, and screenshots — and from Kovy's
   * own motion analyzer (no self-detection). When false, the overlay is visible
   * to capture tools, and the frontend sends overlay masks (one per entity) so
   * Kovy's analyzer ignores its own rendered bodies (founder + siblings).
   */
  hideFromCapture: boolean;
  /**
   * When true, Kovy periodically probes for known screen-capture / streaming
   * applications (OBS, Streamlabs, vMix, ShareX, …) and automatically enables
   * `hideFromCapture` while any are running, restoring the previous preference
   * when they exit. Only the process image names are inspected — no window
   * content is read. Windows-only; no-op elsewhere.
   */
  autoHideOnCaptureApp: boolean;
}

export type SoundCategory = "ambient" | "reaction" | "mood" | "social" | "ui";

export interface SoundEnableEntry {
  id: string;
  enabled: boolean;
}

export interface AudioConfig {
  uiSounds: boolean;
  kovySounds: boolean;
  volume: number; // 0 - 1
  ambientFrequency: number;      // 0 - 1
  reactionFrequency: number;     // 0 - 1
  moodFrequency: number;         // 0 - 1
  globalCooldownMs: number;      // 500 - 5000
  soundEnables: SoundEnableEntry[];
  emoteSounds: boolean;          // per-category: emote chirps
  whisperSounds: boolean;        // per-category: whisper notifications
  celebrationSounds: boolean;    // per-category: celebration bursts
  focusSounds: boolean;          // per-category: focus state changes
  familySounds: boolean;         // per-category: family interactions
}

export interface HotkeyConfig {
  toggleVisibility: string;
  openSettings: string;
  pauseAnalysis: string;
  sleepWake: string;
  privacyPause: string;
  resetPosition: string;
  toggleMuse: string;
  toggleGaming: string;
  toggleDrag: string;       // toggle click-through for drag interaction
  toggleFocus: string;      // toggle focus mode
  switchProfile: string;    // cycle config profiles
  toggleExperienceMode: string; // toggle between lite and full mode
  askKovy: string;              // trigger immediate AI screen analysis
  commandPalette: string;       // open the command palette
  showDigest: string;           // show the companion digest overlay card
  showChronicle: string;        // show the companion chronicle (trends) overlay card
  showStory: string;            // show the companion story chapter overlay card
  openChat: string;             // open the conversational chat panel
}

export interface AdvancedConfig {
  debugMode: boolean;
  motionOverlay: boolean;
  targetReticle: boolean;
  reticleStyle: "crosshair" | "dot" | "circle" | "square" | "custom";
  customReticleDataUrl: string | null;
  salienceGraph: boolean;
  logLevel: "off" | "error" | "warn" | "info" | "debug";
  habitatOverlay: boolean;
}

// --- Habitat / World Types ---

export interface HabitatHome {
  id: string;
  position: Vec2;
  label: string;
}

export type HabitatZoneType = "attract" | "avoid" | "chill" | "hyper" | "water" | "garden" | "sky";

export interface HabitatZone {
  id: string;
  type: HabitatZoneType;
  rect: { x: number; y: number; w: number; h: number };
  strength: number; // 0 - 1
  label: string;
}

export interface HabitatRail {
  id: string;
  points: Vec2[]; // at least 2 points
  label: string;
}

export interface HabitatNode {
  id: string;
  position: Vec2;
  label: string;
}

export interface HabitatConfig {
  enabled: boolean;
  homes: HabitatHome[];
  zones: HabitatZone[];
  rails: HabitatRail[];
  nodes: HabitatNode[];
  railInfluence: number; // 0-1: how much rails affect wander/movement paths
}

// --- Memory Palace Types ---

export type MemoryType =
  | "app_session"
  | "interaction"
  | "mood_episode"
  | "quiet_period"
  | "high_activity"
  | "habitat_use"
  | "schedule_pattern"
  | "preference"
  | "aversion"
  | "family_event";

export interface MemoryRecord {
  id: number;
  entityId: string;
  type: MemoryType;
  significance: number;    // 0-1
  timestamp: number;       // unix ms
  duration: number;        // seconds
  valence: number;         // -1 to 1
  stimulation: number;     // 0-1
  tags: string;            // comma-separated
  appProcess: string | null;
  appTitle: string | null;
  summary: string;
  data: string | null;     // optional JSON blob
}

export interface MemoryInfluence {
  preferredApps: string[];      // process names with positive valence
  aversionApps: string[];       // process names with negative valence
  timeOfDayMoodBias: Partial<InternalMoodState> | null;
  comfortLevel: number;         // 0-1
  curiosityBias: number;        // -0.3 to 0.3
}

export interface MemoryConfig {
  enabled: boolean;
  maxMemories: number;              // 500-5000
  retentionDays: number;            // 7-365
  significanceThreshold: number;    // 0-1, min significance to store
  storeAppNames: boolean;
  storeWindowTitles: boolean;
  pruneOnStartup: boolean;
  autoExportSoulDays: number;       // 0=disabled
}

// --- Soul Export Types ---

export interface MemorySummary {
  type: MemoryType;
  count: number;
  avgSignificance: number;
  avgValence: number;
  topTags: string[];
}

export interface ScheduleAffinity {
  hourOfDay: number;      // 0-23
  dayOfWeek: number;      // 0-6
  typicalMood: SurfaceMood;
  activityLevel: number;  // 0-1
}

export interface AppAffinity {
  processName: string;
  familiarity: number;    // 0-1
  valence: number;        // -1 to 1
  totalDuration: number;  // accumulated seconds
}

export interface PersonalityOffsets {
  curiosityBias: number;    // -0.3 to 0.3
  energyBias: number;       // -0.3 to 0.3
  shynessBias: number;      // -0.3 to 0.3
  playfulnessBias: number;  // -0.3 to 0.3
  wanderBias: number;       // -0.3 to 0.3
  colorHueOffset: number;   // -30 to 30 degrees
  sizeOffset: number;       // -0.15 to 0.15 scale
}

// --- Multi-Entity (Family) Runtime Types ---

export type EntityId = string;

export interface KovyEntityInfo {
  id: EntityId;
  name: string;
  isFounder: boolean;
  personality: PersonalityOffsets;
  preferredHomeId: string | null;
  territoryBias: number;       // 0-1, how strongly this entity stays near its preferred home
  visual: EntityVisualConfig;
  displayMonitor: DisplayMonitor; // which monitor this entity is assigned to
}

export interface SoulEntity {
  id: string;
  name: string;
  isFounder: boolean;
  personality: PersonalityOffsets;
  museEnabled: boolean;
  preferredHomeId: string | null;
  territoryBias: number;
}

export interface SoulExportV1 {
  version: 1;
  exportedAt: string;
  kovyVersion: string;
  warning: string;
  entities: SoulEntity[];
  globalPreferences: {
    memorySummaries: MemorySummary[];
    scheduleAffinities: ScheduleAffinity[];
    appAffinities: AppAffinity[];
  };
  habitatAffinities: {
    favoriteHomeIds: string[];
    preferredZoneTypes: string[];
  };
  musePreferences: {
    preferredStyle: string;
    contextWeights: Record<string, number>;
  };
}

export interface SoulExpansionData {
  ritualHistorySummary: Array<{ ritual: string; count: number; lastPerformed: string }>;
  journalEntryCount: number;
  appProfileCount: number;
  activeSkinId: string | null;
  activeSoundPackId: string | null;
}

export interface SoulExportV2 extends Omit<SoulExportV1, "version"> {
  version: 2;
  expansionData: SoulExpansionData;
}

// --- Family Config (stub for v4 migration — runtime in Phase 3) ---

export interface FamilyDynamics {
  curiosityContagion: number;     // 0-1
  comfortInfluence: number;       // 0-1
  playfulChaseChance: number;     // 0-1
  synchronizedOrbit: boolean;
  groupHyperBursts: boolean;
  territoryRespect: number;       // 0-1
  interEntityBonds: boolean;      // siblings develop bonds with each other
  groupEmotes: boolean;           // synchronized emote bursts when 2+ entities are happy
}

export interface FamilyConfig {
  maxEntities: number;              // 1-5
  dynamics: FamilyDynamics;
  showFamilyNames: boolean;
  familyUpdateIntervalMs: number;   // 200-2000
}

// --- Gaming Mode Config (v4.5) ---

export type GamingVisualStyle = "surge" | "feral" | "arcade" | "neon" | "retro";

export type GamingResidueType =
  | "afterimage"
  | "ribbon_streak"
  | "arc_slash"
  | "impact_ring"
  | "ghost_shell"
  | "energy_shard"
  | "velocity_smear"
  | "pulse_echo";

export interface GamingConfig {
  enabled: boolean;
  hotkey: string;                // default "Alt+Shift+G"
  predictiveBias: number;        // 0-1, how aggressively prediction biases targeting
  excitementGain: number;        // 0-1, how fast excitement grows
  hyperBlend: number;            // 0-1, how much gaming modulates hyper behavior
  residueAmount: number;         // 0-1, spawn rate multiplier
  residueLifetime: number;       // 0.08-1.2 seconds
  elasticDeformation: number;    // 0-1, body deformation intensity
  freeformWobble: number;        // 0-1, body wobble/noise intensity
  visualStyle: GamingVisualStyle;
  comboSystem: boolean;          // enable combo multiplier for consecutive targets
  comboDecayRate: number;        // 0.1-2.0, how fast combo decays per second
}

export interface GamingResidueMark {
  type: GamingResidueType;
  position: Vec2;
  velocity: Vec2;
  lifetime: number;
  maxLifetime: number;
  opacity: number;
  size: number;
  rotation: number;
  color: string;
}

export interface GamingResidueBurst {
  position: Vec2;
  velocity: Vec2;
  type: GamingResidueType;
  intensity: number;             // 0-1
}

export interface GamingOutput {
  enabled: boolean;
  excitement: number;            // 0-1
  predictionConfidence: number;  // 0-1
  predictedPoints: Vec2[];       // 0-3 predicted future interest points
  adaptiveBias: number;          // 0-1, salience bias strength
  hyperBoost: number;            // 0-1, hyper behavior modulation
  elasticity: number;            // 0-1, body deformation amount
  freeformWobble: number;        // 0-1, body wobble amount
  residueBursts: GamingResidueBurst[];
  comboCount?: number;           // v7.0 combo counter
}

// --- Circadian Config (v5.0) ---

export type CircadianPhase =
  | "dawn"
  | "morning"
  | "afternoon"
  | "dusk"
  | "evening"
  | "night"
  | "deep_night";

export interface CircadianConfig {
  enabled: boolean;
  adaptationRate: number;        // 0-1, how fast the rhythm adapts to activity patterns
  amplifyDayNight: number;       // 0-1, how much to exaggerate day/night behavioral differences
  dreamEnabled: boolean;         // whether dream visuals appear during sleep/nap states
  startleEnabled: boolean;       // whether sudden stimuli trigger startle reflex
  startleCooldown: number;       // 1-30 seconds between startle reactions
  customSchedule: boolean;       // use custom day/night times instead of solar
  dayStartTime: number;          // 0-23, hour when "day" starts (custom schedule)
  nightStartTime: number;        // 0-23, hour when "night" starts (custom schedule)
  sleepTracking: boolean;        // detect and adapt to user's sleep patterns
  alarmTime: number | null;      // 0-23.5, time for gentle wake-up alarm (null = disabled)
}

export interface CircadianOutput {
  phase: CircadianPhase;
  energyMultiplier: number;      // 0-1, modulates base energy/stimulation
  anticipation: number;          // 0-1, rises before historically active periods
  drowsiness: number;            // 0-1, rises during historically quiet hours
  startleSensitivity: number;    // 0-1, how easily startled (higher when drowsy)
  dreamIntensity: number;        // 0-1, how vivid dream state should be
  socialEnergy: number;          // 0-1, appetite for family interaction
}

// --- Muse Config (stub for v4 migration — runtime in Phase 4) ---

export type MuseStyle = "subtle" | "expressive";

export interface MuseConfig {
  enabled: boolean;
  hotkey: string;
  maxOverlays: number;              // 1-12
  overlayLifetime: number;          // 2-8 seconds
  style: MuseStyle;
  contextUpdateIntervalMs: number;  // 1000-10000
  codeMode: boolean;
  writingMode: boolean;
  designMode: boolean;
  adaptiveSelection: boolean;       // marks adapt based on app class and content
}

// --- Muse Runtime Types (not persisted) ---

export type MuseMode = "code" | "writing" | "design" | "generic" | "inactive";

export type MuseMarkType =
  | "dot"
  | "stroke"
  | "arc"
  | "bracket"
  | "emphasis"
  | "guide_line"
  | "mood_wash"
  | "note_anchor"
  | "sparkle"
  | "cross"
  | "wave"
  | "circuit"
  | "geometry"
  | "ring_burst"
  | "underline"
  | "highlight"
  | "margin_note";

export interface MuseContext {
  mode: MuseMode;
  confidence: number;       // 0-1, how confident the classification is
  activeApp: string | null;  // foreground process name
  activeTitle: string | null; // truncated window title (only if storeWindowTitles)
  lastUpdate: number;         // timestamp
}

export interface MuseOverlayData {
  id: string;
  type: MuseMarkType;
  position: Vec2;
  velocity: Vec2;           // for drift animation
  size: number;
  rotation: number;
  rotationSpeed: number;    // for spinning animation
  opacity: number;          // current rendered opacity
  baseOpacity: number;      // target max opacity
  color: string;            // HSL string
  lifetime: number;         // seconds remaining
  maxLifetime: number;
  entityId: EntityId;       // which Kovy generated this
  mode: MuseMode;           // context that spawned it
}

// --- Emote Config (v5.5) ---

export type EmoteType =
  | "heart"
  | "zzz"
  | "spark"
  | "question"
  | "star"
  | "swirl"
  | "note"
  | "ellipsis"
  | "exclaim"
  | "sweat"
  | "flower"
  | "spiral"
  | "music"
  | "fire"
  | "moon"
  | "sun"
  | "rainbow"
  | "lightning";

export interface EmoteConfig {
  enabled: boolean;
  intensity: number;          // 0-1, frequency and opacity
  style: "bubble" | "raw";    // bubble = circled emotes, raw = floating symbols
  maxActive: number;          // 3-12 max concurrent emote particles
}

export interface EmoteParticle {
  id: number;
  type: EmoteType;
  position: Vec2;
  velocity: Vec2;
  opacity: number;
  lifetime: number;
  maxLifetime: number;
  size: number;
  entityId: EntityId;
  rotation: number;
  rotationSpeed: number;
}

// --- Atmosphere Config (v5.5) ---

export type AtmosphereStyle = "organic" | "geometric" | "minimal";

export type AtmosphereShape = "dot" | "ring" | "diamond" | "line" | "cross" | "wisp" | "heart" | "star" | "bubble" | "snowflake" | "square" | "triangle" | "petal" | "hexagon";

export interface AtmosphereConfig {
  enabled: boolean;
  density: number;              // 0-1
  style: AtmosphereStyle;
  circadianSync: boolean;       // tie visuals to circadian phase
  moodSync: boolean;            // tie visuals to mood
  seasonalSync: boolean;        // tie particle types to current season
}

export interface AtmosphereParticle {
  position: Vec2;
  velocity: Vec2;
  size: number;
  opacity: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  shape: AtmosphereShape;
  phase: number;                // animation phase offset
}

// --- Bond / Relationship Config (v5.7) ---

export type BondLevel = "stranger" | "acquaintance" | "companion" | "friend" | "best_friend";

export interface BondConfig {
  enabled: boolean;
  bondDecayPerDay: number;     // 0-0.05, how much bond decays per day without interaction
  interactionRadius: number;   // 30-150 pixels, proximity threshold for interaction
  pokeStartleChance: number;   // 0-1, chance a poke causes startle vs celebrate
  bondMilestoneVfx: boolean;   // trigger special VFX on bond level transitions
  doubleClickAction: "celebrate" | "settings" | "none";  // double-click behavior
  rightClickMenu: boolean;     // show context menu on right-click
}

export interface BondState {
  bondPoints: number;           // 0-1000
  bondLevel: BondLevel;         // derived from bondPoints
  daysTogether: number;         // days since first launch
  totalPokes: number;
  totalHovers: number;
  totalSwipes: number;
  lastInteractionDate: string;  // ISO date (YYYY-MM-DD)
  streakDays: number;
  firstLaunchDate: string;      // ISO date
}

// --- Milestone Config (v6.0) ---

export interface MilestoneConfig {
  enabled: boolean;
  showNotifications: boolean;   // show a brief visual when a milestone is unlocked
  showProgressInTray: boolean;  // show milestone count in tray tooltip
}

// --- Ritual Config (v6.1) ---

export interface RitualConfig {
  enabled: boolean;
  notifyOnRitual: boolean;       // show a brief visual when a ritual fires
  morningGreeting: boolean;
  lunchCompanion: boolean;
  afternoonStretch: boolean;
  eveningWinddown: boolean;
  midnightDream: boolean;
  returnCelebration: boolean;
  weekendSpecial: boolean;
  coffeeBreak: boolean;          // ~10:30 AM coffee break ritual
  sunsetReflection: boolean;     // sunset time reflection ritual
  lateNightSnack: boolean;       // ~10 PM late night snack ritual
  firstSnow: boolean;            // first snowfall detection ritual
  morningGreetingTime: number;   // 0-23, custom hour for morning greeting
  lunchTime: number;             // 0-23, custom hour for lunch companion
  afternoonStretchTime: number;  // 0-23, custom hour for afternoon stretch
  eveningWinddownTime: number;   // 0-23, custom hour for evening winddown
}

// --- Journal Config (v6.1) ---

export interface JournalConfig {
  enabled: boolean;
  maxEntries: number;            // 100-2000
  generateDailySummary: boolean; // auto-generate end-of-day summary
}

// --- Weather Config (v6.1) ---

export type WeatherType = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "aurora" | "hail" | "sleet" | "wind";

export interface WeatherConfig {
  enabled: boolean;
  changeInterval: number;        // seconds between weather changes (120-3600)
  intensity: number;             // 0-1, multiplier for weather effects
  allowedTypes: WeatherType[];
  realWeatherSync: boolean;      // opt-in: fetch real weather from wttr.in
  realWeatherInterval: number;   // seconds between real weather fetches (300-7200)
  realWeatherLocation: string;   // location string for wttr.in (e.g. "San Francisco")
}

// --- Skin Pack Config (v6.1) ---

export interface SkinPackConfig {
  activePackId: string;
  customPacks: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    primaryColor: string;
    secondaryColor: string | null;
    toneMode: ToneMode;
    eyeStyle: EyeStyle;
    bodyStyle: BodyStyle;
    glowColor: string;
    particleColor: string;
    rimLightColor: string;
    rimLightIntensity: number;
    builtin: boolean;
  }>;
  circadianAutoSwitch: boolean; // auto-switch skin packs for day/night
  nightPackId: string | null;   // skin pack to use at night (null = no switch)
}

// --- Sound Pack Config (v6.1) ---

export interface SoundPackConfig {
  activePackId: string;
  customPacks: Array<{
    id: string;
    name: string;
    icon: string;
    description: string;
    builtin: boolean;
  }>;
}

// --- Family Scenes Config (v6.1) ---

export interface FamilyScenesConfig {
  enabled: boolean;
  cooldownMultiplier: number;    // 0.5-3.0, scales the base cooldown
  proximityThreshold: number;    // 100-800, max distance for scene trigger
}

// --- App Profile Config (v6.1) ---

export interface AppProfileConfig {
  enabled: boolean;
  autoDetect: boolean;
  profiles: Array<{
    id: string;
    name: string;
    icon: string;
    matchType: "exe" | "title" | "class";
    matchPattern: string;
    overrides: {
      behaviorPreset?: BehaviorPreset;
      visualPreset?: VisualPreset;
      opacity?: number;
      audioVolume?: number;
      audioEnabled?: boolean;
      moodToColor?: boolean;
      gamingMode?: boolean;
      reducedMotion?: boolean;
      hideKovy?: boolean;
      moodOverride?: SurfaceMood | null;
      behaviorOverride?: BehaviorState | null;
      atmosphereOverride?: boolean | null;
      emoteOverride?: boolean | null;
    };
    enabled: boolean;
  }>;
}

// --- Habitat Objects Config (v6.1) ---

export interface HabitatObjectsConfig {
  enabled: boolean;
  maxObjects: number;            // 0-50
  objects: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    placedAt: number;
  }>;
}

// --- Audio Reactivity Config (v7.0) ---

export type AudioVisualizerStyle = "bars" | "wave" | "pulse" | "none";

export interface AudioReactivityConfig {
  enabled: boolean;
  sensitivity: number;          // 0-1, microphone/loopback sensitivity
  beatDetection: boolean;       // enable beat onset detection
  feedMood: boolean;            // audio energy influences mood
  feedGaming: boolean;          // beats sync gaming excitement
  feedVisualizer: boolean;      // render audio visualizer overlay
  visualizerStyle: AudioVisualizerStyle;
}

// --- Thought Bubbles Config (v7.0) ---

export type ThoughtStyle = "cloud" | "minimal" | "comic";

export interface ThoughtConfig {
  enabled: boolean;
  frequency: number;            // 0-1, spawn rate multiplier
  maxActive: number;            // 1-5 max concurrent thought bubbles
  style: ThoughtStyle;
  customThoughts: string[];     // user-defined thought strings
}

// --- Seasonal Events Config (v7.0) ---

export type SeasonalEventId =
  | "halloween"
  | "christmas"
  | "newyear"
  | "valentines"
  | "stpatricks"
  | "summerSolstice"
  | "autumnEquinox";

export interface SeasonalConfig {
  enabled: boolean;
  events: SeasonalEventId[];    // enabled holiday events
  customEvents: Array<{
    id: string;
    name: string;
    date: string;               // MM-DD format
    icon: string;
  }>;
  hemisphere: "northern" | "southern";
}

// --- Growth / Aging Config (v7.0) ---

export type GrowthStage = "sprout" | "young" | "mature" | "elder";

export interface GrowthConfig {
  enabled: boolean;
  agingRate: number;            // 0.5-2.0, multiplier for aging speed
  stageThresholds: {
    young: number;              // days to reach young stage
    mature: number;             // days to reach mature stage
    elder: number;              // days to reach elder stage
  };
}

// --- Stats Tracking Config (v7.0) ---

export type TrackingLevel = "minimal" | "standard" | "detailed";

export interface StatsConfig {
  enabled: boolean;
  trackingLevel: TrackingLevel;
}

// --- Companion Digest Config (v8.2) ---

export interface DigestConfig {
  enabled: boolean;             // master toggle for the digest feature
  autoDismissSec: number;       // seconds before the digest card auto-fades (4-30)
  showBond: boolean;            // include bond level + progress bar
  showStats: boolean;           // include focus/gaming/emote highlights
  showMood: boolean;            // include dominant mood
  showGrowth: boolean;          // include growth stage + age
  showHighlight: boolean;       // include a recent journal highlight
}

// --- Companion Chronicle Config (v8.3) ---

export interface ChronicleConfig {
  enabled: boolean;             // master toggle for the chronicle feature
  snapshotHour: number;         // local hour (0-23) at which a daily snapshot is taken
  retentionDays: number;        // days of snapshot history to keep (30-365)
  autoDismissSec: number;       // seconds before the chronicle card auto-fades (4-30)
  showTrend: boolean;           // include the 7-day bond sparkline + weekly delta
  showInsights: boolean;        // include generated insight lines
}

// --- Focus Mode Config (v7.0) ---

export type FocusState = "unfocused" | "light_focus" | "deep_focus";

export interface FocusConfig {
  enabled: boolean;
  detectionSensitivity: number; // 0-1, how easily focus is detected
  focusBehavior: BehaviorState;  // behavior state during focus
  suppressEmotes: boolean;       // hide emotes during focus
  suppressSound: boolean;        // hide sounds during focus
}

// --- Idle Detection Config (v7.0) ---

export type IdleBehavior = "explore" | "play_alone" | "nap" | "dream" | "wait_at_door";

export interface IdleConfig {
  enabled: boolean;
  idleThresholdSec: number;     // 30-600, seconds of no activity before idle
  idleBehaviors: IdleBehavior[];
}

// --- Personality Evolution Config (v7.0) ---

export interface PersonalityEvolutionConfig {
  enabled: boolean;
  evolutionRate: number;        // 0-1, how fast personality shifts
}

// --- Celebration Config (v7.0) ---

export interface CelebrationConfig {
  enabled: boolean;
  focusThreshold: number;       // minutes of focus to trigger celebration
  returnThreshold: number;      // hours of absence to trigger return celebration
  weekendCelebration: boolean;
}

// --- Ambient Sound Config (v7.0) ---

export type AmbientSoundType = "rain" | "cafe" | "forest" | "ocean" | "silence";

export interface AmbientSoundConfig {
  enabled: boolean;
  volume: number;               // 0-1
  syncWithWeather: boolean;     // match ambient sound to weather engine
  preferredSounds: AmbientSoundType[];
}

// --- Whisper Config (v7.0) ---

export type WhisperStyle = "speech" | "subtitle" | "popup";

export interface WhisperConfig {
  enabled: boolean;
  frequency: number;            // 0-1, spawn rate multiplier
  style: WhisperStyle;
  categories: Array<"encouragement" | "humor" | "facts" | "comfort">;
  customMessages: string[];
}

// --- Entity Relations Config (v7.0) ---

export type EntityRelationType = "friend" | "rival" | "mentor" | "playmate";

export interface EntityRelationsConfig {
  enabled: boolean;
  relationships: Array<{
    entityA: EntityId;
    entityB: EntityId;
    type: EntityRelationType;
    strength: number;           // 0-1
  }>;
  autoEvolve: boolean;
}

// --- Drag Interaction Config (v7.0) ---

export interface DragConfig {
  enabled: boolean;
  grabRadius: number;           // 20-100, pixel radius for grab detection
  releaseBehavior: "bounce" | "settle" | "celebrate";
  rememberSpots: boolean;       // remember frequently placed positions
}

// --- Config Profiles Config (v7.0) ---

export interface SavedProfile {
  id: string;
  name: string;
  icon: string;
  timestamp: number;
  config: KovyConfig;
}

export interface ProfilesConfig {
  savedProfiles: SavedProfile[];
  activeProfileId: string | null;
  hotkeySwap: boolean;           // enable hotkey cycling through profiles
  autoSwitchRules: AutoSwitchRule[]; // v14: rule-based profile switching
}

export type AutoSwitchRuleType = "time" | "app" | "idle";

export interface AutoSwitchRule {
  id: string;
  type: AutoSwitchRuleType;
  condition: string;  // time: "HH:MM", app: "processName", idle: "secondsThreshold"
  profileId: string;
  enabled: boolean;
}

// --- Dream Config (v14) ---

export interface DreamConfig {
  enabled: boolean;
  particleDensity: number;       // 0-1, spawn rate multiplier
  thoughtFrequency: number;      // 0-1, how often dream thoughts appear
  colorWash: boolean;            // subtle glow hue shift during dreams
  maxDreamParticles: number;     // 5-20
}

// --- Focus Target Config (v15) ---

export interface FocusTargetConfig {
  enabled: boolean;
  windowAttraction: number;     // 0-1, how strongly Kovy is drawn to active window center
  cursorAttraction: number;     // 0-1, how strongly Kovy is drawn to cursor
  gamingWindowBoost: number;    // 0-1, extra window attraction in Gaming mode
  gamingCursorBoost: number;    // 0-1, extra cursor attraction in Gaming mode
  blendFactor: number;          // 0-1, how much focus target blends into final position
  habitatSoftening: number;     // 0-1, how much habitat influence is reduced in Gaming mode
}

// --- AI Config (v16) ---

export type AIProvider = "openrouter";

export type AIWhisperCategory = "encouragement" | "humor" | "facts" | "comfort";

export type AIRequestSource = "periodic" | "ask-kovy";

export type AIRejectReason =
  | "disabled"
  | "missing-key"
  | "cooldown"
  | "busy"
  | "privacy-paused"
  | "analysis-paused"
  | "blocked-app"
  | "not-whitelisted"
  | "unavailable";

export type AIErrorCode =
  | "capture-failed"
  | "credential-unavailable"
  | "network"
  | "timeout"
  | "unauthorized"
  | "rate-limited"
  | "provider-error"
  | "invalid-response"
  | "unsupported-model"
  | "cancelled";

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  model: string;
  periodicEnabled: boolean;
  periodicIntervalSec: number;
  periodicInsightPriority: number;
  sendScreenshot: boolean;
  screenshotMaxWidth: number;
  screenshotJpegQuality: number;
  screenshotMonitorIndices: number[]; // empty = primary only, populated = selected monitors
  screenshotMonitorQualities: Record<number, number>; // monitor index → JPEG quality override (40-90)
  includeForegroundApp: boolean;
  instaSendCooldownSec: number;
  requestTimeoutSec: number;
  maxThoughtChars: number;
  maxWhisperChars: number;
}

export interface AIInsight {
  requestId: string;
  source: AIRequestSource;
  thoughtText: string;
  whisperText: string;
  whisperCategory: AIWhisperCategory;
  confidence: number;
  createdAt: number;
}

export type AIStartResult =
  | { accepted: true; requestId: string; completion: Promise<AIInsight | undefined> }
  | { accepted: false; reason: AIRejectReason; retryAfterMs?: number };

// --- Toys ---

export type ToyType =
  | "ball"
  | "balloon"
  | "block"
  | "bed"
  | "laser"
  | "treat"
  | "mouse"
  | "music_box"
  | "mirror";

export type ToyCategory = "physics" | "behavior";

export interface PlacedToy {
  id: string;
  type: ToyType;
  position: Vec2;
  rotation: number;
  velocity?: Vec2;
  spawnedAt: number;
}

export interface ToyConfig {
  enabled: boolean;
  placedToys: PlacedToy[];
  respawnTreatsMin: number;       // 0 = off, minutes between treat respawns
  laserFollowsCursor: boolean;    // laser toy follows the cursor when active
  siblingsPlay: boolean;          // siblings also interact with toys
  maxToys: number;                // 5-30, maximum number of placed toys
}

// --- Experimental Mode ---

export type ExperimentalInteraction = "click" | "hover" | "type";

export type ExperimentalTargetMode = "toys" | "allowlist";

export interface ExperimentalConfig {
  enabled: boolean;
  interactionRadius: number;      // max reach (no random points)
  autoInteract: boolean;
  allowedInteractions: ExperimentalInteraction[];
  rateLimitSec: number;
  optInAcknowledged: boolean;
  targetMode: ExperimentalTargetMode; // "toys" = only toys/habitat objects, "allowlist" = only allowed apps
  allowedApps: string[];              // process names allowed in allowlist mode
}

// --- Intent Config (v9.0) ---

export type IntentKind = "rest" | "play" | "explore" | "socialize" | "observe" | "nest";

export interface IntentConfig {
  enabled: boolean;
  changeRate: number;            // 0-1, how quickly intents shift
  showInDebug: boolean;          // show intent label + target line in debug overlay
  thoughtChance: number;         // 0-1, chance to spawn an intent thought on change
}

export interface IntentOutput {
  current: IntentKind | null;
  targetPosition: Vec2 | null;
  progress: number;              // 0-1
  stateBias: Partial<Record<BehaviorState, number>>;
  since: number;                 // unix ms when current intent started
}

// --- Story Config (v9.0) ---

export interface StoryConfig {
  enabled: boolean;
  weekday: number;               // 0-6 (0=Sunday), day of week to build chapter
  hour: number;                  // 0-23, hour to build chapter
  retentionWeeks: number;        // 4-52, weeks of chapter history to keep
  autoDismissSec: number;        // seconds before story card auto-fades
  aiPolish: boolean;             // use AI to polish chapter text (requires AI enabled)
}

// --- Recall Config (v9.0) ---

export interface RecallConfig {
  enabled: boolean;
  chance: number;                // 0-1, chance per recall tick to spawn a recall thought
  minSignificance: number;       // 0.4-0.9, minimum memory significance to recall
  maxAgeDays: number;            // 7-180, maximum age of memories to recall
}

// --- Chat Config (v9.0) ---

export type ChatPanelPosition = "near-kovy" | "bottom-right";

export interface ChatConfig {
  enabled: boolean;
  persistHistory: boolean;       // persist chat history across sessions
  maxTurns: number;              // 4-30, max conversation turns in history ring
  sendScreenshot: boolean;       // include screenshot in chat context (separate consent)
  panelPosition: ChatPanelPosition;
}

// --- Full Config ---

export interface KovyConfig {
  version: number;
  general: GeneralConfig;
  appearance: AppearanceConfig;
  behavior: BehaviorConfig;
  vision: VisionConfig;
  mood: MoodConfig;
  performance: PerformanceConfig;
  privacy: PrivacyConfig;
  audio: AudioConfig;
  hotkeys: HotkeyConfig;
  advanced: AdvancedConfig;
  habitat: HabitatConfig;
  memory: MemoryConfig;
  family: FamilyConfig;
  muse: MuseConfig;
  gaming: GamingConfig;
  circadian: CircadianConfig;
  emote: EmoteConfig;
  atmosphere: AtmosphereConfig;
  bond: BondConfig;
  milestone: MilestoneConfig;
  ritual: RitualConfig;
  journal: JournalConfig;
  weather: WeatherConfig;
  skinPack: SkinPackConfig;
  soundPack: SoundPackConfig;
  familyScenes: FamilyScenesConfig;
  appProfile: AppProfileConfig;
  habitatObjects: HabitatObjectsConfig;
  audioReactivity: AudioReactivityConfig;
  thought: ThoughtConfig;
  seasonal: SeasonalConfig;
  growth: GrowthConfig;
  stats: StatsConfig;
  focus: FocusConfig;
  idle: IdleConfig;
  personalityEvolution: PersonalityEvolutionConfig;
  celebration: CelebrationConfig;
  ambientSound: AmbientSoundConfig;
  whisper: WhisperConfig;
  entityRelations: EntityRelationsConfig;
  drag: DragConfig;
  profiles: ProfilesConfig;
  dream: DreamConfig;
  focusTarget: FocusTargetConfig;
  ai: AIConfig;
  toys: ToyConfig;
  experimental: ExperimentalConfig;
  digest: DigestConfig;
  chronicle: ChronicleConfig;
  intent: IntentConfig;
  story: StoryConfig;
  recall: RecallConfig;
  chat: ChatConfig;
  shadowConfig: Partial<KovyConfig> | null; // stores pre-Lite settings for restoration
  onboardingComplete: boolean;
}

// --- Runtime State (not persisted) ---

export interface Vec2 {
  x: number;
  y: number;
}

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export interface MotionRegion {
  id: number;
  centroid: Vec2;
  boundingBox: { x: number; y: number; w: number; h: number };
  area: number;
  energy: number;
  persistence: number;
  novelty: number;
  score: number;
}

export interface MotionTarget {
  position: Vec2;
  score: number;
  regionId: number;
  age: number;
}

export interface InternalMoodState {
  curiosity: number; // 0 - 1
  comfort: number; // 0 - 1
  stimulation: number; // 0 - 1
  fatigue: number; // 0 - 1
  overwhelm: number; // 0 - 1
  trust: number; // 0 - 1
  boredom: number; // 0 - 1
  confidence: number; // 0 - 1
}

export interface KovyRuntimeState {
  // Position & movement
  position: Vec2;
  velocity: Vec2;
  targetPosition: Vec2 | null;

  // Behavior
  behaviorState: BehaviorState;
  stateTimer: number;
  perchPosition: Vec2 | null;

  // Hyper mode
  dashActive: boolean;
  chainCount: number;
  dashCooldownTimer: number;
  chainQueue: MotionTarget[];

  // Mood
  internalMood: InternalMoodState;
  surfaceMood: SurfaceMood;
  moodTransitionProgress: number;

  // Motion targets
  activeTarget: MotionTarget | null;
  candidateTargets: MotionTarget[];
  rawRegions: MotionRegion[];

  // Rendering
  squashStretch: Vec2;
  eyeTarget: Vec2;
  blinkTimer: number;
  blinkState: number; // 0 = open, 1 = closed
  glowPulse: number;
  particleSpawnRate: number;

  // App state
  isVisible: boolean;
  isPaused: boolean;
  isAsleep: boolean;
  isInteracting: boolean;
  isClickThrough: boolean;
  isPrivacyPaused: boolean;

  // Screen info
  screenWidth: number;
  screenHeight: number;
  cursorPosition: Vec2;

  // Performance
  currentFps: number;
  analysisActive: boolean;

  // Habitat editing
  habitatEditMode: boolean;

  // Current monitor bounds (for multi-monitor coherence)
  currentMonitorBounds: MonitorBounds | null;
}

// --- Tauri Event Payloads ---

export interface MotionAnalysisResult {
  regions: MotionRegion[];
  frameTime: number;
  analysisScale: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
}

// --- Config Sync Event Types ---

export interface ConfigPreviewEvent {
  config: KovyConfig;
}

export interface ConfigApplyEvent {
  config: KovyConfig;
}

export interface ConfigSections {
  general: GeneralConfig;
  appearance: AppearanceConfig;
  behavior: BehaviorConfig;
  vision: VisionConfig;
  mood: MoodConfig;
  performance: PerformanceConfig;
  privacy: PrivacyConfig;
  audio: AudioConfig;
  hotkeys: HotkeyConfig;
  advanced: AdvancedConfig;
  habitat: HabitatConfig;
  memory: MemoryConfig;
  family: FamilyConfig;
  muse: MuseConfig;
  gaming: GamingConfig;
  circadian: CircadianConfig;
  emote: EmoteConfig;
  atmosphere: AtmosphereConfig;
  bond: BondConfig;
  milestone: MilestoneConfig;
  ritual: RitualConfig;
  journal: JournalConfig;
  weather: WeatherConfig;
  skinPack: SkinPackConfig;
  soundPack: SoundPackConfig;
  familyScenes: FamilyScenesConfig;
  appProfile: AppProfileConfig;
  habitatObjects: HabitatObjectsConfig;
  audioReactivity: AudioReactivityConfig;
  thought: ThoughtConfig;
  seasonal: SeasonalConfig;
  growth: GrowthConfig;
  stats: StatsConfig;
  focus: FocusConfig;
  idle: IdleConfig;
  personalityEvolution: PersonalityEvolutionConfig;
  celebration: CelebrationConfig;
  ambientSound: AmbientSoundConfig;
  whisper: WhisperConfig;
  entityRelations: EntityRelationsConfig;
  drag: DragConfig;
  profiles: ProfilesConfig;
  focusTarget: FocusTargetConfig;
  intent: IntentConfig;
  story: StoryConfig;
  recall: RecallConfig;
  chat: ChatConfig;
}

export type ConfigSectionKey = keyof ConfigSections;
