import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useConfigStore } from "@/store/configStore";
import { KOVY_VERSION } from "@/lib/version";
import { WindowChrome } from "./components/WindowChrome";
import { ToastProvider } from "./components/Toast";
import { OnboardingFlow } from "./Onboarding";
import { playUISound } from "@/engine/audioEngine";
import { kovyLog, cn } from "@/lib/utils";
import type { KovyConfig } from "@/store/types";

function getTabEnabledStatus(tabId: string, config: KovyConfig): boolean | null {
  switch (tabId) {
    case "vision": return config.vision.enabled;
    case "mood": return config.mood.enabled;
    case "memory": return config.memory.enabled;
    case "gaming": return config.gaming.enabled;
    case "circadian": return config.circadian.enabled;
    case "muse": return config.muse.enabled;
    case "emote": return config.emote.enabled;
    case "atmosphere": return config.atmosphere.enabled;
    case "bond": return config.bond.enabled;
    case "milestone": return config.milestone.enabled;
    case "ritual": return config.ritual.enabled;
    case "journal": return config.journal.enabled;
    case "habitat": return config.habitat.enabled;
    case "appProfile": return config.appProfile.enabled;
    case "stats": return config.stats.enabled;
    case "ai": return config.ai.enabled;
    case "toys": return config.toys.enabled;
    case "experimental": return config.experimental.enabled;
    case "skinPack": return config.skinPack.activePackId !== "default";
    case "soundPack": return config.soundPack.activePackId !== "default";
    case "family": return config.family.maxEntities > 1;
    default: return null;
  }
}

const GeneralTab = lazy(() => import("./tabs/GeneralTab").then(m => ({ default: m.GeneralTab })));
const AppearanceTab = lazy(() => import("./tabs/AppearanceTab").then(m => ({ default: m.AppearanceTab })));
const BehaviorTab = lazy(() => import("./tabs/BehaviorTab").then(m => ({ default: m.BehaviorTab })));
const VisionTab = lazy(() => import("./tabs/VisionTab").then(m => ({ default: m.VisionTab })));
const MoodTab = lazy(() => import("./tabs/MoodTab").then(m => ({ default: m.MoodTab })));
const PerformanceTab = lazy(() => import("./tabs/PerformanceTab").then(m => ({ default: m.PerformanceTab })));
const PrivacyTab = lazy(() => import("./tabs/PrivacyTab").then(m => ({ default: m.PrivacyTab })));
const AudioTab = lazy(() => import("./tabs/AudioTab").then(m => ({ default: m.AudioTab })));
const HotkeysTab = lazy(() => import("./tabs/HotkeysTab").then(m => ({ default: m.HotkeysTab })));
const AdvancedTab = lazy(() => import("./tabs/AdvancedTab").then(m => ({ default: m.AdvancedTab })));
const HabitatTab = lazy(() => import("./tabs/HabitatTab").then(m => ({ default: m.HabitatTab })));
const MemoryTab = lazy(() => import("./tabs/MemoryTab").then(m => ({ default: m.MemoryTab })));
const FamilyTab = lazy(() => import("./tabs/FamilyTab").then(m => ({ default: m.FamilyTab })));
const MuseTab = lazy(() => import("./tabs/MuseTab").then(m => ({ default: m.MuseTab })));
const GamingTab = lazy(() => import("./tabs/GamingTab").then(m => ({ default: m.GamingTab })));
const CircadianTab = lazy(() => import("./tabs/CircadianTab").then(m => ({ default: m.CircadianTab })));
const EmoteTab = lazy(() => import("./tabs/EmoteTab").then(m => ({ default: m.EmoteTab })));
const AtmosphereTab = lazy(() => import("./tabs/AtmosphereTab").then(m => ({ default: m.AtmosphereTab })));
const BondTab = lazy(() => import("./tabs/BondTab").then(m => ({ default: m.BondTab })));
const MilestoneTab = lazy(() => import("./tabs/MilestoneTab").then(m => ({ default: m.MilestoneTab })));
const RitualTab = lazy(() => import("./tabs/RitualTab").then(m => ({ default: m.RitualTab })));
const JournalTab = lazy(() => import("./tabs/JournalTab").then(m => ({ default: m.JournalTab })));
const SkinPackTab = lazy(() => import("./tabs/SkinPackTab").then(m => ({ default: m.SkinPackTab })));
const SoundPackTab = lazy(() => import("./tabs/SoundPackTab").then(m => ({ default: m.SoundPackTab })));
const AppProfileTab = lazy(() => import("./tabs/AppProfileTab").then(m => ({ default: m.AppProfileTab })));
const StatsTab = lazy(() => import("./tabs/StatsTab").then(m => ({ default: m.StatsTab })));
const ProfilesTab = lazy(() => import("./tabs/ProfilesTab").then(m => ({ default: m.ProfilesTab })));
const DiagnosticsTab = lazy(() => import("./tabs/DiagnosticsTab").then(m => ({ default: m.DiagnosticsTab })));
const AITab = lazy(() => import("./tabs/AITab").then(m => ({ default: m.AITab })));
const ToysTab = lazy(() => import("./tabs/ToysTab").then(m => ({ default: m.ToysTab })));
const ExperimentalTab = lazy(() => import("./tabs/ExperimentalTab").then(m => ({ default: m.ExperimentalTab })));
const AdvancedTuningTab = lazy(() => import("./tabs/AdvancedTuningTab").then(m => ({ default: m.AdvancedTuningTab })));

function TabSkeleton() {
  return (
    <div className="space-y-3">
      <div className="kovy-skeleton h-8 w-48" />
      <div className="kovy-skeleton h-20 w-full" />
      <div className="kovy-skeleton h-20 w-full" />
      <div className="kovy-skeleton h-20 w-full" />
    </div>
  );
}

const TABS = [
  { id: "general", label: "General", icon: "⚙", keywords: "startup launch minimize tray monitor fullscreen" },
  { id: "appearance", label: "Appearance", icon: "✦", keywords: "size opacity glow particle trail shadow eye style color motion visual" },
  { id: "behavior", label: "Behavior", icon: "◎", keywords: "curiosity attraction boredom dwell wander perch cursor interaction hyper dash chain" },
  { id: "vision", label: "Vision", icon: "◉", keywords: "analysis fps scale motion threshold persistence smoothing novelty ocr" },
  { id: "mood", label: "Mood", icon: "♡", keywords: "mood intensity recovery overwhelm energy sleepiness playful shy focus drift override color particle" },
  { id: "habitat", label: "Habitat", icon: "⬡", keywords: "home zone rail node world attract avoid chill hyper perch orbit" },
  { id: "memory", label: "Memory", icon: "◈", keywords: "memory palace remember soul export import retention prune app session significance" },
  { id: "family", label: "Family", icon: "👥", keywords: "family entity multi kovy sibling personality chase contagion territory dynamics" },
  { id: "muse", label: "Muse", icon: "✨", keywords: "muse creative overlay mark code writing design heuristic app class context" },
  { id: "gaming", label: "Gaming", icon: "⚡", keywords: "gaming mode kinetic adaptive salience prediction residue elastic deformation feral arcade surge" },
  { id: "circadian", label: "Circadian", icon: "☾", keywords: "circadian rhythm day night dream startle sleep wake energy drowsiness adaptation" },
  { id: "emote", label: "Emotes", icon: "♥", keywords: "emote particle heart star zzz question exclaim mood expression bubble symbol" },
  { id: "atmosphere", label: "Atmosphere", icon: "☁", keywords: "atmosphere ambient particle mote wisp sparkle environment circadian mood density" },
  { id: "bond", label: "Bond", icon: "🤝", keywords: "bond relationship trust companion friend streak poke hover swipe interaction" },
  { id: "milestone", label: "Milestones", icon: "🏆", keywords: "milestone achievement unlock progress behavior bond mood feature time milestone" },
  { id: "ritual", label: "Rituals", icon: "📅", keywords: "ritual daily greeting morning evening winddown stretch lunch midnight weekend celebration" },
  { id: "journal", label: "Journal", icon: "📖", keywords: "journal entries log diary milestone ritual bond mood gaming family summary export" },
  { id: "skinPack", label: "Skin Packs", icon: "🎨", keywords: "skin pack theme color eye body style glow particle visual preset" },
  { id: "soundPack", label: "Sound Packs", icon: "🎵", keywords: "sound pack audio theme chirp synth chime retro nature silent" },
  { id: "appProfile", label: "App Profiles", icon: "🖥", keywords: "app profile foreground detection exe title class override behavior visual opacity audio gaming hide" },
  { id: "stats", label: "Stats", icon: "📊", keywords: "statistics tracking interactions distance time alive mood distribution focus gaming emotes export" },
  { id: "profiles", label: "Profiles", icon: "🗂", keywords: "profile preset save load switch config snapshot quick swap hotkey" },
  { id: "performance", label: "Performance", icon: "◐", keywords: "throttle battery gpu cpu budget fps idle suspend frame skip" },
  { id: "privacy", label: "Privacy", icon: "🔒", keywords: "sensitive ocr diagnostics local data" },
  { id: "audio", label: "Audio", icon: "♪", keywords: "sound volume chirp mute meeting" },
  { id: "hotkeys", label: "Hotkeys", icon: "⌨", keywords: "shortcut keyboard toggle visibility pause sleep privacy reset" },
  { id: "advanced", label: "Advanced", icon: "⌘", keywords: "debug overlay reticle salience log export import reset" },
  { id: "advancedTuning", label: "Advanced Tuning", icon: "🔧", keywords: "personality evolution entity relations celebration tuning advanced" },
  { id: "diagnostics", label: "Diagnostics", icon: "📈", keywords: "diagnostics engine health fps performance error monitoring" },
  { id: "ai", label: "Ask Kovy", icon: "🤖", keywords: "ai openrouter insight thought whisper screenshot ask kovy intelligent" },
  { id: "toys", label: "Toys", icon: "🧸", keywords: "toys ball balloon block bed laser treat mouse music mirror play" },
  { id: "experimental", label: "Experimental", icon: "⚠️", keywords: "experimental click interact screen accessibility auto interact keyboard mouse" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TabButton({
  tab,
  active,
  onClick,
  enabledStatus,
}: {
  tab: { id: TabId; label: string; icon: string; keywords: string };
  active: boolean;
  onClick: () => void;
  enabledStatus: boolean | null;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${tab.id}`}
      id={`tab-${tab.id}`}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-fast kovy-focus-ring",
        active ? "kovy-tab-active" : "kovy-tab-inactive"
      )}
    >
      <span className="text-sm w-5 text-center opacity-70">{tab.icon}</span>
      {tab.label}
      {enabledStatus !== null && (
        <span
          className={cn(
            "ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0",
            enabledStatus ? "bg-green-400" : "bg-red-400/50"
          )}
          title={enabledStatus ? "Enabled" : "Disabled"}
        />
      )}
    </button>
  );
}

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general": return <GeneralTab />;
    case "appearance": return <AppearanceTab />;
    case "behavior": return <BehaviorTab />;
    case "vision": return <VisionTab />;
    case "mood": return <MoodTab />;
    case "habitat": return <HabitatTab />;
    case "memory": return <MemoryTab />;
    case "family": return <FamilyTab />;
    case "muse": return <MuseTab />;
    case "gaming": return <GamingTab />;
    case "circadian": return <CircadianTab />;
    case "emote": return <EmoteTab />;
    case "atmosphere": return <AtmosphereTab />;
    case "bond": return <BondTab />;
    case "milestone": return <MilestoneTab />;
    case "ritual": return <RitualTab />;
    case "journal": return <JournalTab />;
    case "skinPack": return <SkinPackTab />;
    case "soundPack": return <SoundPackTab />;
    case "appProfile": return <AppProfileTab />;
    case "stats": return <StatsTab />;
    case "profiles": return <ProfilesTab />;
    case "performance": return <PerformanceTab />;
    case "privacy": return <PrivacyTab />;
    case "audio": return <AudioTab />;
    case "hotkeys": return <HotkeysTab />;
    case "advanced": return <AdvancedTab />;
    case "advancedTuning": return <AdvancedTuningTab />;
    case "diagnostics": return <DiagnosticsTab />;
    case "ai": return <AITab />;
    case "toys": return <ToysTab />;
    case "experimental": return <ExperimentalTab />;
  }
}

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const audioConfig = useConfigStore((s) => s.draftConfig.audio);
  const appliedConfig = useConfigStore((s) => s.appliedConfig);

  const contentRef = useRef<HTMLDivElement>(null);

  const handleTabSwitch = useCallback(
    (tabId: TabId) => {
      if (tabId !== activeTab) {
        setActiveTab(tabId);
        playUISound("tab", audioConfig);
        if (contentRef.current) {
          contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    },
    [activeTab, audioConfig]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const loaded = useConfigStore((s) => s.loaded);
  const onboardingComplete = useConfigStore((s) => s.draftConfig.onboardingComplete);
  const isDirty = useConfigStore((s) => s.isDirty);
  const livePreview = useConfigStore((s) => s.livePreview);
  const setLivePreview = useConfigStore((s) => s.setLivePreview);
  const applyConfig = useConfigStore((s) => s.applyConfig);
  const cancelDraft = useConfigStore((s) => s.cancelDraft);
  const setExperienceMode = useConfigStore((s) => s.setExperienceMode);

  useEffect(() => {
    loadConfig().then(() => {
      // Show settings window after config loads, unless startMinimized is true
      const cfg = useConfigStore.getState().appliedConfig;
      if (!cfg.general.startMinimized) {
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
          getCurrentWindow().show().catch(() => { kovyLog.warn("Failed to show window (not in Tauri?)"); });
        }).catch(() => { kovyLog.warn("Tauri window API not available"); });
      }
    });
  }, [loadConfig]);

  // Keyboard shortcuts: Ctrl+Enter to apply, Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey && e.key === "Enter") {
        const store = useConfigStore.getState();
        if (store.isDirty) {
          e.preventDefault();
          store.applyConfig();
          playUISound("apply", audioConfig);
        }
      } else if (e.key === "Escape" && !e.ctrlKey && !e.metaKey) {
        const store = useConfigStore.getState();
        if (store.isDirty) {
          e.preventDefault();
          store.cancelDraft();
          playUISound("cancel", audioConfig);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [audioConfig]);

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-kovy-bg gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-kovy-accent to-kovy-cyan flex items-center justify-center shadow-glow-lg animate-pulse">
          <span className="text-white text-lg font-bold">K</span>
        </div>
        <div className="text-kovy-text-muted text-sm animate-pulse">Loading Kovy...</div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <ToastProvider>
        <OnboardingFlow />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div className="flex flex-col h-screen bg-kovy-bg select-none rounded-lg overflow-hidden">
      {/* Custom window chrome — replaces native title bar */}
      <WindowChrome title="Kovy Settings" />
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-kovy-border/40 flex flex-col bg-kovy-surface/30">
        {/* Header */}
        <div className="px-5 pt-6 pb-3 border-b border-kovy-border/20">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kovy-accent to-kovy-cyan flex items-center justify-center shadow-glow">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-kovy-text">Kovy</h1>
              <p className="text-[10px] text-kovy-text-dim">Settings</p>
            </div>
            {isDirty && (
              <div className="ml-auto w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Unsaved changes" />
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search settings"
            className="kovy-input w-full text-xs py-1.5"
          />
        </div>

        {/* Tab list */}
        <nav role="tablist" aria-label="Settings sections" className="flex-1 px-2 py-1 overflow-y-auto">
          {(() => {
            const TAB_GROUPS = [
              { label: "Core", ids: ["general", "appearance", "behavior", "vision", "mood"] },
              { label: "World", ids: ["habitat", "memory", "family"] },
              { label: "Modes", ids: ["muse", "gaming", "circadian"] },
              { label: "Expression", ids: ["emote", "atmosphere", "bond", "milestone", "ritual", "journal"] },
              { label: "Themes", ids: ["skinPack", "soundPack"] },
              { label: "Adapt", ids: ["appProfile"] },
              { label: "Data", ids: ["stats", "profiles"] },
              { label: "System", ids: ["performance", "privacy", "audio", "hotkeys", "advanced", "advancedTuning", "diagnostics"] },
              { label: "AI", ids: ["ai"] },
            ];
            const filtered = TABS.filter((tab) => {
              if (searchQuery === "") return true;
              const q = searchQuery.toLowerCase();
              const label = tab.label.toLowerCase();
              const keywords = tab.keywords.toLowerCase();
              const fuzzyMatch = (query: string, text: string): boolean => {
                let qi = 0;
                for (let ti = 0; ti < text.length && qi < query.length; ti++) {
                  if (text[ti] === query[qi]) qi++;
                }
                return qi === query.length;
              };
              return label.includes(q) || keywords.includes(q) || fuzzyMatch(q, label) || fuzzyMatch(q, keywords);
            });
            const isSearching = searchQuery !== "";
            return isSearching
              ? filtered.map((tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    onClick={() => handleTabSwitch(tab.id)}
                    enabledStatus={getTabEnabledStatus(tab.id, appliedConfig)}
                  />
                ))
              : TAB_GROUPS.map((group, gi) => {
                  const groupTabs = group.ids
                    .map((id) => TABS.find((t) => t.id === id))
                    .filter((t): t is typeof TABS[number] => t !== undefined);
                  if (groupTabs.length === 0) return null;
                  return (
                    <div key={gi}>
                      {gi > 0 && <div className="my-1.5 mx-3 border-t border-kovy-border/20" />}
                      <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-kovy-text-dim/60">{group.label}</div>
                      <div className="space-y-0.5">
                        {groupTabs.map((tab) => (
                          <TabButton
                            key={tab.id}
                            tab={tab}
                            active={activeTab === tab.id}
                            onClick={() => handleTabSwitch(tab.id)}
                            enabledStatus={getTabEnabledStatus(tab.id, appliedConfig)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                });
          })()}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-kovy-border/30">
          <button
            onClick={() => setExperienceMode("lite")}
            className="w-full text-[10px] text-kovy-text-dim hover:text-kovy-accent transition-colors text-center block mb-1"
            title="Switch to simplified Lite settings"
          >
            ← Lite Mode
          </button>
          <p className="text-[10px] text-kovy-text-dim text-center">Kovy v{KOVY_VERSION}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Tab header with live preview toggle */}
        <header className="px-6 py-4 border-b border-kovy-border/30 flex-shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-kovy-text">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer" title="Show changes on the overlay in real-time before applying">
              <span className="text-[11px] text-kovy-text-dim">Live Preview</span>
              <button
                role="switch"
                aria-checked={livePreview}
                aria-label="Toggle live preview"
                onClick={() => setLivePreview(!livePreview)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${
                  livePreview ? "bg-kovy-cyan" : "bg-kovy-surface-light"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full bg-white shadow-sm"
                  style={{ transform: livePreview ? "translateX(12px)" : "translateX(2px)", transition: "transform 200ms" }}
                />
              </button>
            </label>
          </div>
        </header>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5 scroll-smooth">
          <div
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className="max-w-2xl xl:max-w-3xl animate-slide-in"
            key={activeTab}
          >
            <Suspense fallback={<TabSkeleton />}>
              <TabContent tabId={activeTab} />
            </Suspense>
          </div>
        </div>

        {/* Apply / Cancel footer — fixed at bottom */}
        <footer className={`px-6 py-3.5 border-t flex items-center justify-between flex-shrink-0 transition-colors duration-200 ${
          isDirty ? "border-yellow-500/40 bg-yellow-900/10" : "border-kovy-border/30 bg-kovy-surface/20"
        }`}>
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="text-xs text-yellow-400 font-medium">Unsaved changes</span>
            ) : (
              <span className="text-xs text-kovy-text-dim">In sync</span>
            )}
            <span className="text-[10px] text-kovy-text-dim/50 hidden sm:inline">
              <kbd className="px-1 py-0.5 rounded bg-kovy-surface-light/50 font-mono">Ctrl+Enter</kbd> apply · <kbd className="px-1 py-0.5 rounded bg-kovy-surface-light/50 font-mono">Esc</kbd> cancel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { cancelDraft(); playUISound("cancel", audioConfig); }}
              disabled={!isDirty}
              title="Discard changes (Esc)"
              className="kovy-btn-ghost text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={() => { applyConfig(); playUISound("apply", audioConfig); }}
              disabled={!isDirty}
              title="Save changes (Ctrl+Enter)"
              className={`kovy-btn text-xs font-medium transition-all duration-200 ${
                isDirty
                  ? "bg-kovy-accent hover:bg-kovy-accent-light text-white shadow-glow"
                  : "bg-kovy-surface-light text-kovy-text-dim cursor-not-allowed"
              }`}
            >
              Apply
            </button>
          </div>
        </footer>
      </main>
      </div>{/* end flex row */}
    </div>
    </ToastProvider>
  );
}
