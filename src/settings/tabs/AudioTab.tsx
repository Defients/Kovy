import { useState, useMemo } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { playSound, isAudioAvailable, getSoundCatalog, playCatalogSound } from "@/engine/audioEngine";
import { SoundPackEngine } from "@/engine/soundPackEngine";
import type { SoundEnableEntry } from "@/store/types";

const CATEGORY_COLORS: Record<string, string> = {
  ambient: "text-blue-400",
  reaction: "text-yellow-400",
  mood: "text-purple-400",
  social: "text-green-400",
  ui: "text-kovy-text-dim",
};

export function AudioTab() {
  const fullConfig = useConfigStore((s) => s.draftConfig);
  const config = fullConfig.audio;
  const update = useConfigStore((s) => s.updateDraftAudio);
  const resetSection = useConfigStore((s) => s.resetSection);
  const audioAvailable = isAudioAvailable();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const catalog = getSoundCatalog();
  const soundPackEngine = useMemo(() => {
    const engine = new SoundPackEngine();
    engine.setActivePack(fullConfig.soundPack.activePackId);
    return engine;
  }, [fullConfig.soundPack.activePackId]);
  const activeSoundPack = soundPackEngine.getActivePack();

  const isSoundEnabled = (id: string): boolean => {
    if (config.soundEnables.length === 0) return true;
    const entry = config.soundEnables.find(e => e.id === id);
    return entry ? entry.enabled : true;
  };

  const toggleSound = (id: string, enabled: boolean) => {
    const existing = config.soundEnables.filter(e => e.id !== id);
    const updated: SoundEnableEntry[] = [...existing, { id, enabled }];
    update({ soundEnables: updated });
  };

  const testSound = (id: string) => {
    const snd = catalog.find(s => s.id === id);
    if (snd) playCatalogSound(snd, config, 1, activeSoundPack);
  };

  const categories = ["reaction", "mood", "ambient", "social"] as const;

  return (
    <div className="space-y-2">
      <InfoCard title="Audio">
        Kovy uses lightweight synthesized tones via the Web Audio API — no external audio files.
        All sounds are local-only and optional. {catalog.length} sound types across 4 categories.
      </InfoCard>

      {!audioAvailable && (
        <div className="kovy-glass p-3 mb-3 border-l-2 border-red-500/60">
          <p className="text-xs text-red-400">Web Audio API is not available in this environment. Audio features are disabled.</p>
        </div>
      )}

      <SettingSection title="Master Controls" onReset={() => resetSection("audio")}>
        <SwitchSetting
          label="UI sounds"
          description="Play subtle pops and pings when interacting with settings"
          checked={config.uiSounds}
          onChange={(v) => update({ uiSounds: v })}
        />
        <SwitchSetting
          label="Kovy chirps & pings"
          description="Kovy makes sounds when inspecting targets, settling, waking up, and during moods"
          checked={config.kovySounds}
          onChange={(v) => update({ kovySounds: v })}
        />
        <SliderSetting
          label="Volume"
          description="Master volume for all Kovy sounds"
          value={config.volume}
          min={0} max={1} step={0.05}
          onChange={(v) => update({ volume: v })}
          displayValue={`${Math.round(config.volume * 100)}%`}
        />
        <SliderSetting
          label="Global cooldown"
          description="Minimum time between any two sounds to prevent spam"
          value={config.globalCooldownMs}
          min={500} max={5000} step={100}
          onChange={(v) => update({ globalCooldownMs: v })}
          displayValue={`${config.globalCooldownMs}ms`}
        />
      </SettingSection>

      <SettingSection title="Category Frequencies">
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          Control how often each category of sound plays. 0% = never, 100% = always when triggered.
        </p>
        <SliderSetting
          label="Reaction sounds"
          description="Chirps, pings, pops on behavior changes (inspect, perch, celebrate)"
          value={config.reactionFrequency}
          min={0} max={1} step={0.05}
          onChange={(v) => update({ reactionFrequency: v })}
          displayValue={`${Math.round(config.reactionFrequency * 100)}%`}
        />
        <SliderSetting
          label="Mood sounds"
          description="Purrs, trills, yawns based on current emotional state"
          value={config.moodFrequency}
          min={0} max={1} step={0.05}
          onChange={(v) => update({ moodFrequency: v })}
          displayValue={`${Math.round(config.moodFrequency * 100)}%`}
        />
        <SliderSetting
          label="Ambient sounds"
          description="Subtle wander notes, orbit tones, dream chimes"
          value={config.ambientFrequency}
          min={0} max={1} step={0.05}
          onChange={(v) => update({ ambientFrequency: v })}
          displayValue={`${Math.round(config.ambientFrequency * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Per-Category Toggles">
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          Quickly enable or disable sounds for specific v7 feature categories.
        </p>
        <SwitchSetting
          label="Emote sounds"
          description="Chirps when emote particles spawn"
          checked={config.emoteSounds}
          onChange={(v) => update({ emoteSounds: v })}
        />
        <SwitchSetting
          label="Whisper sounds"
          description="Subtle notification when whispers appear"
          checked={config.whisperSounds}
          onChange={(v) => update({ whisperSounds: v })}
        />
        <SwitchSetting
          label="Celebration sounds"
          description="Festive sounds for focus milestones, returns, weekends"
          checked={config.celebrationSounds}
          onChange={(v) => update({ celebrationSounds: v })}
        />
        <SwitchSetting
          label="Focus state sounds"
          description="Calm tones when entering/leaving focus mode"
          checked={config.focusSounds}
          onChange={(v) => update({ focusSounds: v })}
        />
        <SwitchSetting
          label="Family sounds"
          description="Sounds for family interactions and relations"
          checked={config.familySounds}
          onChange={(v) => update({ familySounds: v })}
        />
      </SettingSection>

      <SettingSection title="Sound Library">
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          Enable or disable individual sounds. Click a sound name to test it.
        </p>
        {categories.map(cat => {
          const sounds = catalog.filter(s => s.category === cat);
          const isExpanded = expandedCategory === cat;
          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-kovy-surface-light transition-colors"
              >
                <span className={`text-xs font-semibold capitalize ${CATEGORY_COLORS[cat]}`}>
                  {cat} ({sounds.length})
                </span>
                <span className="text-[10px] text-kovy-text-dim">{isExpanded ? "▾" : "▸"}</span>
              </button>
              {isExpanded && (
                <div className="ml-2 space-y-0.5 mt-1">
                  {sounds.map(snd => (
                    <div key={snd.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-kovy-surface/30">
                      <input
                        type="checkbox"
                        checked={isSoundEnabled(snd.id)}
                        onChange={(e) => toggleSound(snd.id, e.target.checked)}
                        className="accent-kovy-accent w-3 h-3 flex-shrink-0"
                      />
                      <button
                        onClick={() => testSound(snd.id)}
                        className="text-xs text-kovy-text hover:text-kovy-accent-light transition-colors text-left flex-1 min-w-0"
                        title={snd.description}
                        disabled={!audioAvailable}
                      >
                        {snd.name}
                      </button>
                      <span className="text-[9px] text-kovy-text-dim flex-shrink-0 hidden sm:inline">
                        {snd.description}
                      </span>
                      <button
                        onClick={() => testSound(snd.id)}
                        className="kovy-btn-ghost text-[10px] px-1.5 py-0.5 flex-shrink-0"
                        disabled={!audioAvailable}
                        title="Test"
                      >
                        ▶
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </SettingSection>
    </div>
  );
}
