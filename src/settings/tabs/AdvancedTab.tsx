import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { ConfirmModal } from "../components/ConfirmModal";
import { useRef, useState } from "react";
import { SCENARIO_PRESETS } from "@/store/scenarioPresets";
import type { AdvancedConfig } from "@/store/types";

export function AdvancedTab() {
  const config = useConfigStore((s) => s.draftConfig.advanced);
  const update = useConfigStore((s) => s.updateDraftAdvanced);
  const resetConfig = useConfigStore((s) => s.resetAllConfig);
  const exportConfig = useConfigStore((s) => s.exportConfig);
  const importConfig = useConfigStore((s) => s.importConfig);
  const resetSection = useConfigStore((s) => s.resetSection);
  const applyScenario = useConfigStore((s) => s.applyScenarioPresetToDraft);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reticleFileRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; errors: string[]; migrated: boolean } | null>(null);
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReticleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        update({ customReticleDataUrl: dataUrl, reticleStyle: "custom" });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kovy-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const result = await importConfig(text);
      setImportStatus(result);
      if (result.success) {
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <SettingSection title="Scenario Presets">
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          Apply a multi-section preset to adjust many settings at once. Changes are applied
          to the draft — click Apply to save. You can tweak individual settings afterwards.
        </p>
        <div className="grid grid-cols-2 gap-2 px-1">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                applyScenario(preset.id);
                setAppliedPreset(preset.id);
                setTimeout(() => setAppliedPreset(null), 2000);
              }}
              className={`text-left p-2.5 rounded-lg border transition-all ${
                appliedPreset === preset.id
                  ? "border-kovy-accent/60 bg-kovy-accent/10"
                  : "border-kovy-border/30 bg-kovy-surface/30 hover:border-kovy-accent/30 hover:bg-kovy-surface/50"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{preset.icon}</span>
                <span className="text-xs font-semibold text-kovy-text">
                  {preset.name}
                  {appliedPreset === preset.id && <span className="text-kovy-accent ml-1">Applied</span>}
                </span>
              </div>
              <p className="text-[10px] text-kovy-text-dim leading-snug">{preset.description}</p>
            </button>
          ))}
        </div>
      </SettingSection>

      <SettingSection title="Debug / Developer" onReset={() => resetSection("advanced")}>
        <SwitchSetting
          label="Developer / debug mode"
          description="Show FPS, behavior state, mood, and target count on the overlay"
          checked={config.debugMode}
          onChange={(v) => update({ debugMode: v })}
        />
        <SwitchSetting
          label="Motion region overlay"
          description="Show detected motion regions on screen as rectangles"
          checked={config.motionOverlay}
          onChange={(v) => update({ motionOverlay: v })}
        />
        <SwitchSetting
          label="Target reticle overlay"
          description="Show Kovy's current target with a reticle"
          checked={config.targetReticle}
          onChange={(v) => update({ targetReticle: v })}
        />
        {config.targetReticle && (
          <>
            <SelectSetting
              label="Reticle style"
              description="Visual style of the target reticle"
              value={config.reticleStyle}
              options={[
                { value: "crosshair", label: "Crosshair" },
                { value: "dot", label: "Dot" },
                { value: "circle", label: "Circle" },
                { value: "square", label: "Square" },
                { value: "custom", label: "Custom" },
              ]}
              onChange={(v) => update({ reticleStyle: v as AdvancedConfig["reticleStyle"] })}
            />
            {config.reticleStyle === "custom" && (
              <SettingRow label="Custom reticle image" description="Upload a PNG/SVG (max 512KB). Stored locally in config.">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reticleFileRef.current?.click()}
                    className="kovy-btn-outline text-xs"
                  >
                    Upload
                  </button>
                  {config.customReticleDataUrl && (
                    <button
                      onClick={() => update({ customReticleDataUrl: null, reticleStyle: "crosshair" })}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={reticleFileRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleReticleUpload}
                  />
                </div>
              </SettingRow>
            )}
          </>
        )}
        <SwitchSetting
          label="Salience graph"
          description="Show a live graph of target score and motion activity over time on the overlay"
          checked={config.salienceGraph}
          onChange={(v) => update({ salienceGraph: v })}
        />
        <SwitchSetting
          label="Habitat overlay"
          description="Show homes, zones, nodes, and rails on the overlay when habitat is enabled"
          checked={config.habitatOverlay}
          onChange={(v) => update({ habitatOverlay: v })}
        />
        <SelectSetting
          label="Log level"
          description="Controls console logging verbosity"
          value={config.logLevel}
          options={[
            { value: "off", label: "Off" },
            { value: "error", label: "Error" },
            { value: "warn", label: "Warn" },
            { value: "info", label: "Info" },
            { value: "debug", label: "Debug" },
          ]}
          onChange={(v) => update({ logLevel: v as "off" | "error" | "warn" | "info" | "debug" })}
        />
      </SettingSection>

      <SettingSection title="Config Management">
        <SettingRow label="Export config" description="Save your current settings as a JSON file">
          <button onClick={handleExport} className="kovy-btn-outline text-xs">
            Export
          </button>
        </SettingRow>
        <SettingRow label="Import config" description="Load settings from a JSON file (validated and merged with defaults)">
          <button onClick={handleImport} className="kovy-btn-outline text-xs">
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </SettingRow>

        {/* Import status feedback */}
        {importStatus && (
          <div className={`p-3 rounded-lg text-xs ${
            importStatus.success
              ? "bg-green-900/30 border border-green-700/40 text-green-300"
              : "bg-red-900/30 border border-red-700/40 text-red-300"
          }`}>
            {importStatus.success ? (
              <p>Config imported successfully.{importStatus.migrated ? " (migrated from older version)" : ""}</p>
            ) : (
              <div>
                <p className="font-medium mb-1">Import failed:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {importStatus.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </SettingSection>

      <SettingSection title="Danger Zone">
        <SettingRow label="Reset to factory defaults" description="Restore all settings to their original values">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="kovy-btn-outline text-xs text-red-400 border-red-900/50 hover:bg-red-500/10"
          >
            Reset All
          </button>
        </SettingRow>
      </SettingSection>

      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset All Settings"
        message="Are you sure you want to reset all settings to their factory defaults? This cannot be undone."
        confirmText="Reset All"
        isDestructive={true}
        onConfirm={() => {
          resetConfig();
          setShowResetConfirm(false);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
