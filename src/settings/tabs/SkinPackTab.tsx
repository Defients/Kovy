import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { InfoCard } from "../components/InfoCard";
import { SkinPackEngine, BUILTIN_SKIN_PACKS } from "@/engine/skinPackEngine";

export function SkinPackTab() {
  const config = useConfigStore((s) => s.draftConfig.skinPack);
  const update = useConfigStore((s) => s.updateDraftSkinPack);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [engine] = useState(() => new SkinPackEngine());
  const allPacks = engine.getAllPacks();

  return (
    <div className="space-y-2">
      <InfoCard title="Skin Packs" accent="pink">
        Skin packs are visual themes that change Kovy's colors, eye style, body style,
        glow, and particle colors. Built-in packs are ready to use. Custom packs can
        be created with your own color choices.
      </InfoCard>

      <SettingSection title="Active Skin Pack" onReset={() => resetSection("skinPack")}>
        <div className="px-3 py-2 grid grid-cols-2 gap-2">
          {allPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => update({ activePackId: pack.id })}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                config.activePackId === pack.id
                  ? "border-pink-400/40 bg-pink-500/10"
                  : "border-kovy-border/30 hover:border-kovy-border/60 bg-kovy-surface-light/20"
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${pack.primaryColor}, ${pack.secondaryColor ?? pack.primaryColor})`,
                }}
              />
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium text-kovy-text">
                  {pack.icon} {pack.name}
                </div>
                <div className="text-[10px] text-kovy-text-dim truncate">
                  {pack.description}
                </div>
              </div>
              {config.activePackId === pack.id && (
                <span className="text-[10px] text-pink-400 flex-shrink-0">Active</span>
              )}
            </button>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Preview">
        <div className="px-3 py-3 flex items-center justify-center gap-4">
          {(() => {
            const active = allPacks.find((p) => p.id === config.activePackId) ?? BUILTIN_SKIN_PACKS[0];
            return (
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full shadow-lg"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${active.primaryColor}, ${active.secondaryColor ?? active.primaryColor})`,
                    boxShadow: `0 0 20px ${active.glowColor ?? active.primaryColor}40`,
                  }}
                />
                <div className="space-y-1">
                  <div className="text-xs text-kovy-text-muted">
                    <span className="text-kovy-text-dim">Primary:</span>{" "}
                    <span style={{ color: active.primaryColor }}>{active.primaryColor}</span>
                  </div>
                  {active.secondaryColor && (
                    <div className="text-xs text-kovy-text-muted">
                      <span className="text-kovy-text-dim">Secondary:</span>{" "}
                      <span style={{ color: active.secondaryColor }}>{active.secondaryColor}</span>
                    </div>
                  )}
                  <div className="text-xs text-kovy-text-muted">
                    <span className="text-kovy-text-dim">Eyes:</span> {active.eyeStyle}
                  </div>
                  <div className="text-xs text-kovy-text-muted">
                    <span className="text-kovy-text-dim">Body:</span> {active.bodyStyle}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </SettingSection>
    </div>
  );
}
