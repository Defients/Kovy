import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { InfoCard } from "../components/InfoCard";
import { SoundPackEngine, BUILTIN_SOUND_PACKS } from "@/engine/soundPackEngine";

export function SoundPackTab() {
  const config = useConfigStore((s) => s.draftConfig.soundPack);
  const update = useConfigStore((s) => s.updateDraftSoundPack);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [engine] = useState(() => new SoundPackEngine());
  const allPacks = engine.getAllPacks();

  return (
    <div className="space-y-2">
      <InfoCard title="Sound Packs" accent="green">
        Sound packs define the synthesis parameters for Kovy's chirps, sounds, and
        audio cues. All sounds are procedurally synthesized via the Web Audio API —
        no audio files, no network. Choose a pack that fits your aesthetic.
      </InfoCard>

      <SettingSection title="Active Sound Pack" onReset={() => resetSection("soundPack")}>
        <div className="px-3 py-2 grid grid-cols-1 gap-2">
          {allPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => update({ activePackId: pack.id })}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                config.activePackId === pack.id
                  ? "border-green-400/40 bg-green-500/10"
                  : "border-kovy-border/30 hover:border-kovy-border/60 bg-kovy-surface-light/20"
              }`}
            >
              <span className="text-xl flex-shrink-0">{pack.icon}</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium text-kovy-text">
                  {pack.name}
                </div>
                <div className="text-[10px] text-kovy-text-dim truncate">
                  {pack.description}
                </div>
              </div>
              {config.activePackId === pack.id && (
                <span className="text-[10px] text-green-400 flex-shrink-0">Active</span>
              )}
            </button>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Pack Info">
        <div className="px-3 py-2">
          {(() => {
            const active = allPacks.find((p) => p.id === config.activePackId) ?? BUILTIN_SOUND_PACKS[0];
            return (
              <div className="text-xs text-kovy-text-muted space-y-1">
                <div><span className="text-kovy-text-dim">Active pack:</span> {active.icon} {active.name}</div>
                <div><span className="text-kovy-text-dim">Description:</span> {active.description}</div>
                <div className="text-[10px] text-kovy-text-dim pt-1">
                  Sound parameters are applied to the Web Audio synthesizer when Kovy
                  makes sounds. Changes take effect on the next sound played.
                </div>
              </div>
            );
          })()}
        </div>
      </SettingSection>
    </div>
  );
}
