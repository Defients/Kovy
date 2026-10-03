import { useState, useEffect, useRef } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { ColorPickerSetting } from "../components/ColorPickerSetting";
import { useEntityStore, FOUNDER_ID, MAX_ENTITIES } from "@/store/entityStore";
import type { EntityId, EntityVisualConfig, ToneMode, DisplayMonitor } from "@/store/types";
import { DEFAULT_ENTITY_VISUAL } from "@/store/defaults";

interface MonitorOption {
  name: string | null;
  size: { width: number; height: number };
}

export function FamilyTab() {
  const config = useConfigStore((s) => s.draftConfig.family);
  const update = useConfigStore((s) => s.updateDraftFamily);
  const resetSection = useConfigStore((s) => s.resetSection);
  const familyScenesConfig = useConfigStore((s) => s.draftConfig.familyScenes);
  const updateFamilyScenes = useConfigStore((s) => s.updateDraftFamilyScenes);

  const entities = useEntityStore((s) => s.getAllEntities());
  const addEntity = useEntityStore((s) => s.addEntity);
  const removeEntity = useEntityStore((s) => s.removeEntity);
  const setEntityName = useEntityStore((s) => s.setEntityName);
  const entityCount = useEntityStore((s) => s.getEntityCount());

  const habitatHomes = useConfigStore((s) => s.draftConfig.habitat.homes);
  const [editingName, setEditingName] = useState<EntityId | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [monitors, setMonitors] = useState<MonitorOption[]>([]);
  const notifyChannelRef = useRef<BroadcastChannel | null>(null);
  const trimTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadMonitors() {
      try {
        const { availableMonitors } = await import("@tauri-apps/api/window");
        const mons = await availableMonitors();
        setMonitors(mons);
      } catch { /* not in Tauri */ }
    }
    loadMonitors();
  }, []);

  useEffect(() => {
    if (trimTimeoutRef.current !== null) {
      window.clearTimeout(trimTimeoutRef.current);
      trimTimeoutRef.current = null;
    }

    if (entityCount <= config.maxEntities) {
      return;
    }

    trimTimeoutRef.current = window.setTimeout(() => {
      const currentEntities = useEntityStore.getState().getAllEntities();
      const overflow = currentEntities.length - config.maxEntities;
      if (overflow <= 0) return;

      const removableIds = currentEntities
        .filter((entity) => !entity.meta.isFounder)
        .slice(-overflow)
        .map((entity) => entity.meta.id);

      if (removableIds.length === 0) return;

      const store = useEntityStore.getState();
      for (const id of removableIds) {
        store.removeEntity(id);
      }
      notifyChange();
    }, 250);

    return () => {
      if (trimTimeoutRef.current !== null) {
        window.clearTimeout(trimTimeoutRef.current);
        trimTimeoutRef.current = null;
      }
    };
  }, [config.maxEntities, entityCount]);

  // Keep settings window's entityStore fresh
  useEffect(() => {
    useEntityStore.getState().initFounder(); // which hydrates siblings
    
    // Single shared channel for sending and receiving sync messages
    const channel = new BroadcastChannel("kovy-entity-sync");
    notifyChannelRef.current = channel;
    const handleMessage = () => {
      useEntityStore.getState().syncFromLocalStorage();
    };
    channel.addEventListener("message", handleMessage);
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      notifyChannelRef.current = null;
    };
  }, []);

  const notifyChange = () => {
    notifyChannelRef.current?.postMessage("update");
  };

  const handleAddEntity = () => {
    if (entityCount >= config.maxEntities) return;
    addEntity();
    notifyChange();
  };

  const handleRemoveEntity = (id: EntityId) => {
    if (id === FOUNDER_ID) return;
    removeEntity(id);
    notifyChange();
  };

  const handleStartRename = (id: EntityId, currentName: string) => {
    setEditingName(id);
    setNameInput(currentName);
  };

  const handleFinishRename = (id: EntityId) => {
    if (nameInput.trim()) {
      setEntityName(id, nameInput.trim());
      notifyChange();
    }
    setEditingName(null);
    setNameInput("");
  };

  return (
    <div className="space-y-2">
      {/* Family Members */}
      <SettingSection title="Family Members" onReset={() => resetSection("family")}>
        <SliderSetting
          value={config.maxEntities}
          min={1}
          max={MAX_ENTITIES}
          step={1}
          onChange={(v) => update({ maxEntities: v })}
          label="Max Entities"
          description="Maximum number of Kovys allowed (1-5)"
        />

        <div className="space-y-2 mt-3">
          {entities.map((entity) => {
            const vis = entity.meta.visual ?? DEFAULT_ENTITY_VISUAL;
            return (
            <div key={entity.meta.id} className="rounded-lg bg-kovy-surface/40 border border-kovy-border/20 overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2">
                {/* Color swatch — shows custom primary or personality hue */}
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 border border-white/10"
                  style={{
                    background: vis.customColorsEnabled
                      ? vis.primaryColor
                      : `hsl(${210 + (entity.meta.personality.colorHueOffset ?? 0)}, 55%, 55%)`,
                  }}
                />

                {/* Name */}
                {editingName === entity.meta.id ? (
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => handleFinishRename(entity.meta.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinishRename(entity.meta.id);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    className="kovy-input text-xs py-1 w-24"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => handleStartRename(entity.meta.id, entity.meta.name)}
                    className="text-xs text-kovy-text hover:text-kovy-accent-light transition-colors"
                    title="Click to rename"
                  >
                    {entity.meta.name}
                  </button>
                )}

                {/* Founder badge */}
                {entity.meta.isFounder && (
                  <span className="text-[9px] text-kovy-accent bg-kovy-accent/10 px-1.5 py-0.5 rounded-full">
                    Founder
                  </span>
                )}

                {/* Individual Size Slider */}
                <div className="flex-1 ml-4 flex items-center gap-2" title="Individual Size Scale">
                  <span className="text-[10px] text-kovy-text-dim whitespace-nowrap">Size:</span>
                  <input
                    type="range"
                    min={-0.5}
                    max={0.5}
                    step={0.05}
                    value={entity.meta.personality.sizeOffset}
                    onChange={(e) => {
                      useEntityStore.getState().setEntityPersonality(entity.meta.id, {
                        ...entity.meta.personality,
                        sizeOffset: parseFloat(e.target.value)
                      });
                      notifyChange();
                    }}
                    className="w-20 h-1.5 bg-kovy-bg rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                               [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-kovy-accent [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="text-[10px] text-kovy-text-muted w-8 text-right font-mono">
                    {(1.0 + entity.meta.personality.sizeOffset).toFixed(2)}x
                  </span>
                </div>

                {/* Mood indicator */}
                <span className="text-[10px] text-kovy-text-dim ml-auto">
                  {entity.runtime.surfaceMood}
                </span>

                {/* Remove button (not for founder) */}
                {!entity.meta.isFounder && (
                  <button
                    onClick={() => handleRemoveEntity(entity.meta.id)}
                    className="text-xs text-kovy-text-dim hover:text-red-400 transition-colors px-1"
                    title="Remove entity"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Visual customization panel */}
              <div className="px-3 py-2 border-t border-kovy-border/10 space-y-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vis.customColorsEnabled}
                      onChange={(e) => {
                        useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, customColorsEnabled: e.target.checked });
                        notifyChange();
                      }}
                      className="accent-kovy-accent w-3 h-3"
                    />
                    <span className="text-[10px] text-kovy-text-dim">Custom colors</span>
                  </label>
                  {vis.customColorsEnabled && (
                    <select
                      value={vis.toneMode}
                      onChange={(e) => {
                        useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, toneMode: e.target.value as ToneMode });
                        notifyChange();
                      }}
                      className="kovy-input text-[10px] py-0.5 w-20"
                    >
                      <option value="single">Single</option>
                      <option value="dual">Dual</option>
                    </select>
                  )}
                </div>
                {vis.customColorsEnabled && (
                  <div className="space-y-1">
                    <ColorPickerSetting
                      label="Primary"
                      value={vis.primaryColor}
                      onChange={(hex) => {
                        useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, primaryColor: hex });
                        notifyChange();
                      }}
                    />
                    {vis.toneMode === "dual" && (
                      <ColorPickerSetting
                        label="Secondary"
                        value={vis.secondaryColor ?? "#88aadd"}
                        onChange={(hex) => {
                          useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, secondaryColor: hex });
                          notifyChange();
                        }}
                      />
                    )}
                  </div>
                )}
                {/* Opacity slider */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-kovy-text-dim w-12">Opacity:</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={vis.opacity}
                    onChange={(e) => {
                      useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, opacity: parseFloat(e.target.value) });
                      notifyChange();
                    }}
                    className="flex-1 h-1.5 bg-kovy-bg rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                               [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-kovy-accent [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="text-[10px] text-kovy-text-muted w-8 text-right font-mono">
                    {Math.round(vis.opacity * 100)}%
                  </span>
                </div>
                {/* Rim light slider */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-kovy-text-dim w-12">Rim:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={vis.rimLightIntensity ?? 0.3}
                    onChange={(e) => {
                      useEntityStore.getState().setEntityVisual(entity.meta.id, { ...vis, rimLightIntensity: parseFloat(e.target.value) });
                      notifyChange();
                    }}
                    className="flex-1 h-1.5 bg-kovy-bg rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                               [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-kovy-accent [&::-webkit-slider-thumb]:cursor-pointer"
                    title="Rim light intensity — edge glow strength"
                  />
                  <span className="text-[10px] text-kovy-text-muted w-8 text-right font-mono">
                    {Math.round((vis.rimLightIntensity ?? 0.3) * 100)}%
                  </span>
                </div>
                {/* Preferred home */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-kovy-text-dim w-12">Home:</span>
                  <select
                    value={entity.meta.preferredHomeId ?? ""}
                    onChange={(e) => {
                      useEntityStore.getState().setEntityPreferredHome(entity.meta.id, e.target.value || null);
                      notifyChange();
                    }}
                    className="kovy-input text-[10px] py-0.5 flex-1"
                  >
                    <option value="">None</option>
                    {habitatHomes.map((h) => (
                      <option key={h.id} value={h.id}>{h.label}</option>
                    ))}
                  </select>
                </div>
                {/* Territory bias */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-kovy-text-dim w-12">Territory:</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={entity.meta.territoryBias}
                    onChange={(e) => {
                      useEntityStore.getState().updateEntityMeta(entity.meta.id, { territoryBias: parseFloat(e.target.value) });
                      notifyChange();
                    }}
                    className="flex-1 h-1.5 bg-kovy-bg rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5
                               [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-kovy-accent [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span className="text-[10px] text-kovy-text-muted w-8 text-right font-mono">
                    {Math.round(entity.meta.territoryBias * 100)}%
                  </span>
                </div>
                {/* Display monitor */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-kovy-text-dim w-12">Monitor:</span>
                  <select
                    value={entity.meta.displayMonitor}
                    onChange={(e) => {
                      useEntityStore.getState().setEntityDisplayMonitor(entity.meta.id, e.target.value as DisplayMonitor);
                      notifyChange();
                    }}
                    className="kovy-input text-[10px] py-0.5 flex-1"
                  >
                    <option value="global">Global (all monitors)</option>
                    <option value="primary">Primary monitor</option>
                    {monitors.map((m, i) => (
                      <option key={i} value={m.name ?? `monitor_${i}`}>
                        {m.name ?? `Monitor ${i + 1} (${m.size.width}x${m.size.height})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            );
          })}

          {/* Add button */}
          {entityCount < config.maxEntities && (
            <button
              onClick={handleAddEntity}
              className="w-full py-2 rounded-lg border border-dashed border-kovy-border/40 text-xs text-kovy-text-dim hover:text-kovy-accent hover:border-kovy-accent/40 transition-colors"
            >
              + Add Kovy
            </button>
          )}

          {entityCount >= config.maxEntities && entityCount > 1 && (
            <p className="text-[10px] text-kovy-text-dim text-center">
              Family limit reached ({config.maxEntities})
            </p>
          )}
        </div>
      </SettingSection>

      {/* Family Dynamics */}
      <SettingSection title="Family Dynamics">
        <SliderSetting
          value={config.dynamics.curiosityContagion}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ dynamics: { ...config.dynamics, curiosityContagion: v } })}
          label="Curiosity Contagion"
          description="How much curiosity spreads between nearby entities"
        />

        <SliderSetting
          value={config.dynamics.comfortInfluence}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ dynamics: { ...config.dynamics, comfortInfluence: v } })}
          label="Comfort Influence"
          description="How much comfort level spreads between nearby entities"
        />

        <SliderSetting
          value={config.dynamics.playfulChaseChance}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ dynamics: { ...config.dynamics, playfulChaseChance: v } })}
          label="Playful Chase Chance"
          description="Likelihood of playful chasing between entities"
        />

        <SliderSetting
          value={config.dynamics.territoryRespect}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ dynamics: { ...config.dynamics, territoryRespect: v } })}
          label="Territory Respect"
          description="How strongly entities stay near their preferred homes"
        />

        <SwitchSetting
          checked={config.dynamics.synchronizedOrbit}
          onChange={(v) => update({ dynamics: { ...config.dynamics, synchronizedOrbit: v } })}
          label="Synchronized Orbit"
          description="Nearby entities sync their orbits around targets"
        />

        <SwitchSetting
          checked={config.dynamics.groupHyperBursts}
          onChange={(v) => update({ dynamics: { ...config.dynamics, groupHyperBursts: v } })}
          label="Group Hyper Bursts"
          description="One entity's hyper burst can trigger nearby entities"
        />
      </SettingSection>

      {/* Display */}
      <SettingSection title="Display">
        <SwitchSetting
          checked={config.showFamilyNames}
          onChange={(v) => update({ showFamilyNames: v })}
          label="Show Family Names"
          description="Display entity names above each Kovy"
        />

        <SliderSetting
          value={config.familyUpdateIntervalMs}
          min={200}
          max={2000}
          step={100}
          onChange={(v) => update({ familyUpdateIntervalMs: v })}
          label="Family Update Interval"
          description="How often family dynamics recalculate"
          displayValue={`${config.familyUpdateIntervalMs}ms`}
        />
      </SettingSection>

      <SettingSection title="Family Scenes (v6.1)">
        <SwitchSetting
          label="Family scenes enabled"
          description="Trigger coordinated group behaviors (cuddle piles, chases, synchronized orbits) when 2+ entities are near each other"
          checked={familyScenesConfig.enabled}
          onChange={(v) => updateFamilyScenes({ enabled: v })}
        />
        {familyScenesConfig.enabled && (
          <>
            <SliderSetting
              label="Cooldown multiplier"
              description="Scales the base cooldown between scenes (0.5× = frequent, 3× = rare)"
              value={familyScenesConfig.cooldownMultiplier}
              min={0.5} max={3} step={0.1}
              onChange={(v) => updateFamilyScenes({ cooldownMultiplier: v })}
              displayValue={`${familyScenesConfig.cooldownMultiplier.toFixed(1)}×`}
            />
            <SliderSetting
              label="Proximity threshold"
              description="Maximum distance between entities for a scene to trigger (pixels)"
              value={familyScenesConfig.proximityThreshold}
              min={100} max={800} step={50}
              onChange={(v) => updateFamilyScenes({ proximityThreshold: Math.round(v) })}
              displayValue={`${familyScenesConfig.proximityThreshold}px`}
            />
          </>
        )}
      </SettingSection>

    </div>
  );
}
