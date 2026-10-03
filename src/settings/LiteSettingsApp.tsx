import { useState, useEffect, useCallback, useRef } from "react";
import { useConfigStore } from "@/store/configStore";
import { KOVY_VERSION } from "@/lib/version";
import { LitePersonalityTab } from "./tabs/lite/LitePersonalityTab";
import { LiteLookTab } from "./tabs/lite/LiteLookTab";
import { LiteSoundTab } from "./tabs/lite/LiteSoundTab";
import { LitePresetsTab } from "./tabs/lite/LitePresetsTab";
import { LiteCompanionTab } from "./tabs/lite/LiteCompanionTab";
import { WindowChrome } from "./components/WindowChrome";
import { ToastProvider } from "./components/Toast";
import { playUISound } from "@/engine/audioEngine";
import { kovyLog, cn } from "@/lib/utils";
import { OnboardingFlow } from "./Onboarding";

const LITE_TABS = [
  { id: "personality", label: "Personality", icon: "🐾" },
  { id: "look", label: "Look", icon: "🎨" },
  { id: "sound", label: "Sound", icon: "🔊" },
  { id: "presets", label: "Presets", icon: "⭐" },
  { id: "companion", label: "Companion", icon: "🤝" },
] as const;

type LiteTabId = (typeof LITE_TABS)[number]["id"];

function LiteTabContent({ tabId }: { tabId: LiteTabId }) {
  switch (tabId) {
    case "personality": return <LitePersonalityTab />;
    case "look": return <LiteLookTab />;
    case "sound": return <LiteSoundTab />;
    case "presets": return <LitePresetsTab />;
    case "companion": return <LiteCompanionTab />;
  }
}

export function LiteSettingsApp() {
  const [activeTab, setActiveTab] = useState<LiteTabId>("personality");
  const audioConfig = useConfigStore((s) => s.draftConfig.audio);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTabSwitch = useCallback(
    (tabId: LiteTabId) => {
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
      const cfg = useConfigStore.getState().appliedConfig;
      if (!cfg.general.startMinimized) {
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
          getCurrentWindow().show().catch(() => { kovyLog.warn("Failed to show window (not in Tauri?)"); });
        }).catch(() => { kovyLog.warn("Tauri window API not available"); });
      }
    });
  }, [loadConfig]);

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
      <WindowChrome title="Kovy Settings — Lite" />
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
                <p className="text-[10px] text-kovy-text-dim">Lite Settings</p>
              </div>
              {isDirty && (
                <div className="ml-auto w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Unsaved changes" />
              )}
            </div>
          </div>

          {/* Tab list */}
          <nav role="tablist" aria-label="Lite settings sections" className="flex-1 px-2 py-1 overflow-y-auto">
            <div className="space-y-0.5">
              {LITE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`lite-tabpanel-${tab.id}`}
                  id={`lite-tab-${tab.id}`}
                  onClick={() => handleTabSwitch(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-fast kovy-focus-ring",
                    activeTab === tab.id ? "kovy-tab-active" : "kovy-tab-inactive"
                  )}
                >
                  <span className="text-sm w-5 text-center opacity-70">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Footer with Pro Mode toggle */}
          <div className="px-4 py-3.5 border-t border-kovy-border/30">
            <button
              onClick={() => setExperienceMode("full")}
              className="w-full text-[10px] text-kovy-text-dim hover:text-kovy-accent transition-colors text-center block"
              title="Switch to full settings with all features"
            >
              Pro Mode →
            </button>
            <p className="text-[10px] text-kovy-text-dim/60 text-center mt-1">Kovy v{KOVY_VERSION}</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Tab header with live preview toggle */}
          <header className="px-6 py-4 border-b border-kovy-border/30 flex-shrink-0 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-kovy-text">
              {LITE_TABS.find((t) => t.id === activeTab)?.label}
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
              id={`lite-tabpanel-${activeTab}`}
              aria-labelledby={`lite-tab-${activeTab}`}
              className="max-w-2xl xl:max-w-3xl animate-slide-in"
              key={activeTab}
            >
              <LiteTabContent tabId={activeTab} />
            </div>
          </div>

          {/* Apply / Cancel footer */}
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
      </div>
    </div>
    </ToastProvider>
  );
}
