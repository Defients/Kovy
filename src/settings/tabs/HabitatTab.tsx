import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { useKovyStore } from "@/store/kovyStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";
import { ConfirmModal } from "../components/ConfirmModal";
import { InfoCard } from "../components/InfoCard";
import { HABITAT_PRESETS } from "@/engine/habitatPresets";
import type { HabitatHome, HabitatZone, HabitatZoneType, HabitatNode, HabitatRail, Vec2 } from "@/store/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function HabitatTab() {
  const config = useConfigStore((s) => s.draftConfig.habitat);
  const update = useConfigStore((s) => s.updateDraftHabitat);
  const resetSection = useConfigStore((s) => s.resetSection);
  const screenWidth = useKovyStore((s) => s.screenWidth);
  const screenHeight = useKovyStore((s) => s.screenHeight);
  const updateHabitatObjects = useConfigStore((s) => s.updateDraftHabitatObjects);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedObjectPreset, setSelectedObjectPreset] = useState("");
  const [showObjectPresetConfirm, setShowObjectPresetConfirm] = useState(false);

  const applyPreset = (preset: string) => {
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;

    switch (preset) {
      case "empty":
        update({ homes: [], zones: [], rails: [], nodes: [] });
        break;
      case "corners":
        update({
          homes: [
            { id: generateId(), position: { x: 100, y: 100 }, label: "Top Left" },
            { id: generateId(), position: { x: screenWidth - 100, y: 100 }, label: "Top Right" },
          ],
          zones: [
            { id: generateId(), type: "chill", rect: { x: 0, y: 0, w: 300, h: 300 }, strength: 0.6, label: "Top Left Chill" },
            { id: generateId(), type: "chill", rect: { x: screenWidth - 300, y: 0, w: 300, h: 300 }, strength: 0.6, label: "Top Right Chill" },
          ],
          rails: [],
          nodes: [
            { id: generateId(), position: { x: cx, y: cy }, label: "Center Orbit" },
          ],
        });
        break;
      case "playground":
        update({
          homes: [
            { id: generateId(), position: { x: cx, y: cy }, label: "Center Home" },
          ],
          zones: [
            { id: generateId(), type: "hyper", rect: { x: cx - 200, y: cy - 200, w: 400, h: 400 }, strength: 0.8, label: "Center Hyper" },
            { id: generateId(), type: "avoid", rect: { x: 0, y: screenHeight - 150, w: screenWidth, h: 150 }, strength: 0.5, label: "Bottom Avoid" },
          ],
          rails: [
            { id: generateId(), points: [{ x: 100, y: cy }, { x: screenWidth - 100, y: cy }], label: "Center Rail" },
          ],
          nodes: [
            { id: generateId(), position: { x: cx - 300, y: cy }, label: "Left Node" },
            { id: generateId(), position: { x: cx + 300, y: cy }, label: "Right Node" },
          ],
        });
        break;
      case "border_patrol":
        update({
          homes: [
            { id: generateId(), position: { x: 50, y: 50 }, label: "Base" },
          ],
          zones: [],
          rails: [
            { id: generateId(), points: [
              { x: 50, y: 50 },
              { x: screenWidth - 50, y: 50 },
              { x: screenWidth - 50, y: screenHeight - 50 },
              { x: 50, y: screenHeight - 50 },
              { x: 50, y: 50 }
            ], label: "Perimeter Rail" },
          ],
          nodes: [],
        });
        break;
    }
  };

  const addHome = () => {
    const newHome: HabitatHome = {
      id: generateId(),
      position: { x: 960, y: 540 },
      label: `Home ${config.homes.length + 1}`,
    };
    update({ homes: [...config.homes, newHome] });
  };

  const removeHome = (id: string) => {
    update({ homes: config.homes.filter((h) => h.id !== id) });
  };

  const updateHome = (id: string, patch: Partial<HabitatHome>) => {
    update({
      homes: config.homes.map((h) =>
        h.id === id ? { ...h, ...patch } : h
      ),
    });
  };

  const addZone = (type: HabitatZoneType) => {
    const newZone: HabitatZone = {
      id: generateId(),
      type,
      rect: { x: 400, y: 200, w: 400, h: 300 },
      strength: 0.6,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Zone ${config.zones.length + 1}`,
    };
    update({ zones: [...config.zones, newZone] });
  };

  const updateZone = (id: string, patch: Partial<HabitatZone>) => {
    update({
      zones: config.zones.map((z) =>
        z.id === id ? { ...z, ...patch } : z
      ),
    });
  };

  const removeZone = (id: string) => {
    update({ zones: config.zones.filter((z) => z.id !== id) });
  };

  const addNode = () => {
    const newNode: HabitatNode = {
      id: generateId(),
      position: { x: 800, y: 450 },
      label: `Node ${config.nodes.length + 1}`,
    };
    update({ nodes: [...config.nodes, newNode] });
  };

  const updateNode = (id: string, patch: Partial<HabitatNode>) => {
    update({
      nodes: config.nodes.map((n) =>
        n.id === id ? { ...n, ...patch } : n
      ),
    });
  };

  const removeNode = (id: string) => {
    update({ nodes: config.nodes.filter((n) => n.id !== id) });
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Desktop Habitat">
        Shape how Kovy behaves on your screen by placing homes, zones, and points of interest.
        Homes are rest spots. Zones affect Kovy's energy and behavior. Nodes are orbit points.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("habitat")}>
        <SwitchSetting
          label="Habitat system enabled"
          description="Enable the desktop world layer — homes, zones, and nodes influence Kovy's behavior"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Habitat Presets">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Quickly set up a habitat layout scaled to your current screen ({screenWidth}x{screenHeight}).
              Warning: This will overwrite your current habitat configuration.
            </p>
            <div className="flex gap-2 items-center px-1">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="kovy-input text-xs w-48"
              >
                <option value="" disabled>Select a preset...</option>
                <option value="empty">Empty (Clear all)</option>
                <option value="corners">Corners (Chill zones + center node)</option>
                <option value="playground">Playground (Center hyper + avoid bottom)</option>
                <option value="border_patrol">Border Patrol (Perimeter rail)</option>
              </select>
              <button
                onClick={() => {
                  if (selectedPreset) setShowConfirm(true);
                }}
                disabled={!selectedPreset}
                className="kovy-btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Preset
              </button>
            </div>
          </SettingSection>

          <ConfirmModal
            isOpen={showConfirm}
            title="Apply Habitat Preset"
            message="Are you sure? This will permanently overwrite your current habitat configuration."
            confirmText="Apply"
            isDestructive={true}
            onConfirm={() => {
              applyPreset(selectedPreset);
              setSelectedPreset("");
              setShowConfirm(false);
            }}
            onCancel={() => setShowConfirm(false)}
          />

          {/* --- Habitat Object Presets (v8.1: wire orphaned habitatPresets data) --- */}
          <SettingSection title="Habitat Object Presets">
            <p className="text-xs text-kovy-text-dim/60 mb-2">
              Apply a pre-configured set of habitat objects (beds, plants, toys, etc.) to your desktop.
              Objects are positioned as percentages of your screen size.
            </p>
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={selectedObjectPreset}
                onChange={(e) => setSelectedObjectPreset(e.target.value)}
                className="flex-1 bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
              >
                <option value="">Select object preset...</option>
                {HABITAT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name} — {p.description}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (selectedObjectPreset) setShowObjectPresetConfirm(true);
                }}
                disabled={!selectedObjectPreset}
                className="px-3 py-1.5 rounded text-sm font-medium bg-kovy-accent/20 text-kovy-accent border border-kovy-accent/40 hover:bg-kovy-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </SettingSection>

          <ConfirmModal
            isOpen={showObjectPresetConfirm}
            title="Apply Object Preset"
            message="This will replace your current habitat objects. Continue?"
            confirmText="Apply"
            isDestructive={true}
            onConfirm={() => {
              const preset = HABITAT_PRESETS.find((p) => p.id === selectedObjectPreset);
              if (preset) {
                updateHabitatObjects({
                  ...preset.habitatObjects,
                  objects: preset.habitatObjects.objects.map((o) => ({
                    ...o,
                    position: {
                      x: o.position.x * screenWidth,
                      y: o.position.y * screenHeight,
                    },
                  })),
                });
              }
              setSelectedObjectPreset("");
              setShowObjectPresetConfirm(false);
            }}
            onCancel={() => setShowObjectPresetConfirm(false)}
          />

          <SettingSection title="Rail Influence">
            <SliderSetting
              label="Rail influence on movement"
              description="How much rails guide Kovy's wander, perch return, and hyper traversal (0 = ignore rails, 1 = strongly follow rails)"
              value={config.railInfluence}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ railInfluence: v })}
              displayValue={`${Math.round(config.railInfluence * 100)}%`}
            />
          </SettingSection>

          <SettingSection title="Homes / Perches">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Place rest spots on screen. Kovy returns here when idle or recovering.
              Edit X,Y pixel coordinates to position them on your screen.
            </p>
            {config.homes.length === 0 && (
              <p className="text-[10px] text-kovy-text-dim italic px-1 py-2">No homes placed yet. Add one below.</p>
            )}
            {config.homes.map((home) => (
              <div key={home.id} className="flex items-center gap-2 py-2 px-1 flex-wrap">
                <input
                  type="text"
                  value={home.label}
                  onChange={(e) => updateHome(home.id, { label: e.target.value })}
                  className="kovy-input text-xs w-28"
                />
                <label className="text-[10px] text-kovy-text-dim">X</label>
                <input
                  type="number"
                  value={Math.round(home.position.x)}
                  onChange={(e) => updateHome(home.id, { position: { ...home.position, x: Number(e.target.value) } })}
                  className="kovy-input text-xs w-16 font-mono"
                />
                <label className="text-[10px] text-kovy-text-dim">Y</label>
                <input
                  type="number"
                  value={Math.round(home.position.y)}
                  onChange={(e) => updateHome(home.id, { position: { ...home.position, y: Number(e.target.value) } })}
                  className="kovy-input text-xs w-16 font-mono"
                />
                <button
                  onClick={() => removeHome(home.id)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <SettingRow label="Add home" description="Place a new rest spot for Kovy">
              <button onClick={addHome} className="kovy-btn-outline text-xs">
                + Add Home
              </button>
            </SettingRow>
          </SettingSection>

          <SettingSection title="Zones">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Rectangular regions that affect Kovy's behavior. Attract zones pull Kovy in,
              avoid zones push away, chill zones calm Kovy down, hyper zones energize.
            </p>
            {config.zones.length === 0 && (
              <p className="text-[10px] text-kovy-text-dim italic px-1 py-2">No zones defined yet. Add one below.</p>
            )}
            {config.zones.map((zone) => (
              <div key={zone.id} className="flex flex-col gap-1 py-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium w-12 ${
                    zone.type === "attract" ? "text-green-400" :
                    zone.type === "avoid" ? "text-red-400" :
                    zone.type === "chill" ? "text-blue-400" :
                    "text-yellow-400"
                  }`}>{zone.type}</span>
                  <input
                    type="text"
                    value={zone.label}
                    onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                    className="kovy-input text-xs flex-1 min-w-0"
                  />
                  <button
                    onClick={() => removeZone(zone.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-14">
                  <label className="text-[10px] text-kovy-text-dim">X</label>
                  <input
                    type="number"
                    value={Math.round(zone.rect.x)}
                    onChange={(e) => updateZone(zone.id, { rect: { ...zone.rect, x: Number(e.target.value) } })}
                    className="kovy-input text-xs w-14 font-mono"
                  />
                  <label className="text-[10px] text-kovy-text-dim">Y</label>
                  <input
                    type="number"
                    value={Math.round(zone.rect.y)}
                    onChange={(e) => updateZone(zone.id, { rect: { ...zone.rect, y: Number(e.target.value) } })}
                    className="kovy-input text-xs w-14 font-mono"
                  />
                  <label className="text-[10px] text-kovy-text-dim">W</label>
                  <input
                    type="number"
                    value={Math.round(zone.rect.w)}
                    min={40}
                    onChange={(e) => updateZone(zone.id, { rect: { ...zone.rect, w: Math.max(40, Number(e.target.value)) } })}
                    className="kovy-input text-xs w-14 font-mono"
                  />
                  <label className="text-[10px] text-kovy-text-dim">H</label>
                  <input
                    type="number"
                    value={Math.round(zone.rect.h)}
                    min={40}
                    onChange={(e) => updateZone(zone.id, { rect: { ...zone.rect, h: Math.max(40, Number(e.target.value)) } })}
                    className="kovy-input text-xs w-14 font-mono"
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-2 px-1">
              <button onClick={() => addZone("attract")} className="kovy-btn-outline text-xs text-green-400 border-green-800/50">
                + Attract
              </button>
              <button onClick={() => addZone("avoid")} className="kovy-btn-outline text-xs text-red-400 border-red-800/50">
                + Avoid
              </button>
              <button onClick={() => addZone("chill")} className="kovy-btn-outline text-xs text-blue-400 border-blue-800/50">
                + Chill
              </button>
              <button onClick={() => addZone("hyper")} className="kovy-btn-outline text-xs text-yellow-400 border-yellow-800/50">
                + Hyper
              </button>
            </div>
          </SettingSection>

          <SettingSection title="Orbit Nodes">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Points of interest that Kovy likes to circle around when idle or excited.
            </p>
            {config.nodes.length === 0 && (
              <p className="text-[10px] text-kovy-text-dim italic px-1 py-2">No nodes placed yet. Add one below.</p>
            )}
            {config.nodes.map((node) => (
              <div key={node.id} className="flex items-center gap-2 py-2 px-1 flex-wrap">
                <input
                  type="text"
                  value={node.label}
                  onChange={(e) => updateNode(node.id, { label: e.target.value })}
                  className="kovy-input text-xs w-28"
                />
                <label className="text-[10px] text-kovy-text-dim">X</label>
                <input
                  type="number"
                  value={Math.round(node.position.x)}
                  onChange={(e) => updateNode(node.id, { position: { ...node.position, x: Number(e.target.value) } })}
                  className="kovy-input text-xs w-16 font-mono"
                />
                <label className="text-[10px] text-kovy-text-dim">Y</label>
                <input
                  type="number"
                  value={Math.round(node.position.y)}
                  onChange={(e) => updateNode(node.id, { position: { ...node.position, y: Number(e.target.value) } })}
                  className="kovy-input text-xs w-16 font-mono"
                />
                <button
                  onClick={() => removeNode(node.id)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <SettingRow label="Add node" description="Place a point of interest for Kovy to orbit">
              <button onClick={addNode} className="kovy-btn-outline text-xs">
                + Add Node
              </button>
            </SettingRow>
          </SettingSection>

          <SettingSection title="Rails / Paths">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Movement rails are polyline paths that Kovy can follow during wander and hyper behavior.
              Each rail needs at least 2 control points. Edit X,Y coordinates or use the habitat overlay to preview.
            </p>
            {config.rails.length === 0 && (
              <p className="text-[10px] text-kovy-text-dim italic px-1 py-2">No rails created yet. Add one below.</p>
            )}
            {config.rails.map((rail) => (
              <div key={rail.id} className="kovy-glass p-2 mx-1 my-1.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rail.label}
                    onChange={(e) => {
                      update({
                        rails: config.rails.map((r) =>
                          r.id === rail.id ? { ...r, label: e.target.value } : r
                        ),
                      });
                    }}
                    className="kovy-input text-xs flex-1"
                  />
                  <span className="text-[10px] text-kovy-text-dim">{rail.points.length} pts</span>
                  <button
                    onClick={() => update({ rails: config.rails.filter((r) => r.id !== rail.id) })}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                  >
                    Delete
                  </button>
                </div>
                {rail.points.map((pt, pi) => (
                  <div key={pi} className="flex items-center gap-1.5 pl-2">
                    <span className="text-[9px] text-kovy-text-dim w-4">P{pi + 1}</span>
                    <label className="text-[10px] text-kovy-text-dim">X</label>
                    <input
                      type="number"
                      value={Math.round(pt.x)}
                      onChange={(e) => {
                        const newPts = [...rail.points];
                        newPts[pi] = { ...newPts[pi], x: Number(e.target.value) };
                        update({
                          rails: config.rails.map((r) =>
                            r.id === rail.id ? { ...r, points: newPts } : r
                          ),
                        });
                      }}
                      className="kovy-input text-xs w-16 font-mono"
                    />
                    <label className="text-[10px] text-kovy-text-dim">Y</label>
                    <input
                      type="number"
                      value={Math.round(pt.y)}
                      onChange={(e) => {
                        const newPts = [...rail.points];
                        newPts[pi] = { ...newPts[pi], y: Number(e.target.value) };
                        update({
                          rails: config.rails.map((r) =>
                            r.id === rail.id ? { ...r, points: newPts } : r
                          ),
                        });
                      }}
                      className="kovy-input text-xs w-16 font-mono"
                    />
                    {rail.points.length > 2 && (
                      <button
                        onClick={() => {
                          const newPts = rail.points.filter((_, i) => i !== pi);
                          update({
                            rails: config.rails.map((r) =>
                              r.id === rail.id ? { ...r, points: newPts } : r
                            ),
                          });
                        }}
                        className="text-red-400 hover:text-red-300 text-[10px] px-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const lastPt = rail.points[rail.points.length - 1] ?? { x: 500, y: 400 };
                    const newPts = [...rail.points, { x: lastPt.x + 100, y: lastPt.y }];
                    update({
                      rails: config.rails.map((r) =>
                        r.id === rail.id ? { ...r, points: newPts } : r
                      ),
                    });
                  }}
                  className="text-kovy-cyan text-[10px] hover:underline pl-2"
                >
                  + Add point
                </button>
              </div>
            ))}
            <SettingRow label="Add rail" description="Create a new movement path with control points">
              <button
                onClick={() => {
                  const newRail: HabitatRail = {
                    id: generateId(),
                    points: [
                      { x: 300, y: 400 },
                      { x: 700, y: 400 },
                    ],
                    label: `Rail ${config.rails.length + 1}`,
                  };
                  update({ rails: [...config.rails, newRail] });
                }}
                className="kovy-btn-outline text-xs"
              >
                + Add Rail
              </button>
            </SettingRow>
          </SettingSection>
        </>
      )}
    </div>
  );
}
