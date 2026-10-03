import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { InfoCard } from "../components/InfoCard";
import { TOY_DEFINITIONS } from "@/engine/toyEngine";
import type { ToyType, PlacedToy } from "@/store/types";

export function ToysTab() {
  const config = useConfigStore((s) => s.draftConfig.toys);
  const update = useConfigStore((s) => s.updateDraftToys);
  const resetSection = useConfigStore((s) => s.resetSection);
  const [selectedType, setSelectedType] = useState<ToyType>("ball");

  const handleAddToy = (type: ToyType) => {
    const newToy: PlacedToy = {
      id: `toy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      position: { x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 },
      rotation: 0,
      spawnedAt: Date.now(),
    };
    update({ placedToys: [...config.placedToys, newToy] });
  };

  const handleRemoveToy = (id: string) => {
    update({ placedToys: config.placedToys.filter((t) => t.id !== id) });
  };

  const handleClearAll = () => {
    update({ placedToys: [] });
  };

  const toyEntries = Object.values(TOY_DEFINITIONS);
  const physicsToys = toyEntries.filter((t) => t.category === "physics");
  const behaviorToys = toyEntries.filter((t) => t.category === "behavior");

  return (
    <div className="space-y-2">
      <InfoCard title="Toys" accent="amber">
        <p className="text-xs text-kovy-text-dim">
          Place toys on the overlay for Kovy to interact with. Physics toys bounce and float;
          behavior toys trigger specific behaviors like sleeping, hunting, or dancing.
          Toys are placed at random positions — drag them in the overlay to reposition.
        </p>
      </InfoCard>

      <SettingSection title="Toy Enablement" onReset={() => resetSection("toys")}>
        <SwitchSetting
          label="Enable toys"
          description="Allow Kovy to see and interact with placed toys"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Toy Palette">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Click a toy to add it to the overlay. Max 30 toys.
            </p>

            <div className="px-1 pb-2">
              <p className="text-[10px] font-semibold text-kovy-text-dim uppercase tracking-wide mb-1.5">
                Physics Toys
              </p>
              <div className="grid grid-cols-3 gap-2">
                {physicsToys.map((toy) => (
                  <button
                    key={toy.type}
                    onClick={() => handleAddToy(toy.type)}
                    disabled={config.placedToys.length >= 30}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-kovy-border/30 bg-kovy-surface/30 hover:border-kovy-accent/40 hover:bg-kovy-surface/50 transition-all disabled:opacity-40"
                  >
                    <span className="text-2xl">{toy.icon}</span>
                    <span className="text-xs font-medium text-kovy-text">{toy.label}</span>
                    <span className="text-[9px] text-kovy-text-dim text-center leading-tight">{toy.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-1">
              <p className="text-[10px] font-semibold text-kovy-text-dim uppercase tracking-wide mb-1.5">
                Behavior Toys
              </p>
              <div className="grid grid-cols-3 gap-2">
                {behaviorToys.map((toy) => (
                  <button
                    key={toy.type}
                    onClick={() => handleAddToy(toy.type)}
                    disabled={config.placedToys.length >= 30}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-kovy-border/30 bg-kovy-surface/30 hover:border-kovy-accent/40 hover:bg-kovy-surface/50 transition-all disabled:opacity-40"
                  >
                    <span className="text-2xl">{toy.icon}</span>
                    <span className="text-xs font-medium text-kovy-text">{toy.label}</span>
                    <span className="text-[9px] text-kovy-text-dim text-center leading-tight">{toy.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </SettingSection>

          <SettingSection title="Placed Toys">
            <div className="px-1 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-kovy-text-dim">
                  {config.placedToys.length} toy{config.placedToys.length !== 1 ? "s" : ""} placed
                </span>
                {config.placedToys.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {config.placedToys.length === 0 ? (
                <p className="text-xs text-kovy-text-dim italic px-1 py-3">
                  No toys placed yet. Use the palette above to add some.
                </p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {config.placedToys.map((toy) => {
                    const def = TOY_DEFINITIONS[toy.type];
                    return (
                      <div
                        key={toy.id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-kovy-surface-light/30 hover:bg-kovy-surface-light/50 transition-colors"
                      >
                        <span className="text-lg flex-shrink-0">{def.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-kovy-text">{def.label}</span>
                          <span className="text-[10px] text-kovy-text-dim ml-2">
                            ({Math.round(toy.position.x)}, {Math.round(toy.position.y)})
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveToy(toy.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SettingSection>
        </>
      )}
    </div>
  );
}
