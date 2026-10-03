import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";

export function MuseTab() {
  const config = useConfigStore((s) => s.draftConfig.muse);
  const update = useConfigStore((s) => s.updateDraftMuse);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Muse Mode" onReset={() => resetSection("muse")}>
        <SwitchSetting
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
          label="Enable Muse Mode"
          description="When active, Kovy generates procedural overlays based on app-class heuristics"
        />

        <SettingRow label="How it works" description="Muse detects the foreground app process name and classifies it as code, writing, design, or generic. It does NOT read screen content, use OCR, or employ any AI reasoning.">
          <span className="text-[10px] text-kovy-text-dim font-mono">heuristic only</span>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Overlay Limits">
        <SliderSetting
          value={config.maxOverlays}
          min={1}
          max={12}
          step={1}
          onChange={(v) => update({ maxOverlays: v })}
          label="Max Overlays"
          description="Maximum number of muse marks on screen at once"
        />

        <SliderSetting
          value={config.overlayLifetime}
          min={2}
          max={8}
          step={0.5}
          onChange={(v) => update({ overlayLifetime: v })}
          label="Overlay Lifetime"
          description="How long each mark persists before fading"
          displayValue={`${config.overlayLifetime}s`}
        />

        <SliderSetting
          value={config.contextUpdateIntervalMs}
          min={1000}
          max={10000}
          step={500}
          onChange={(v) => update({ contextUpdateIntervalMs: v })}
          label="Context Update Interval"
          description="How often the foreground app is re-checked"
          displayValue={`${config.contextUpdateIntervalMs}ms`}
        />
      </SettingSection>

      <SettingSection title="Style">
        <SelectSetting
          value={config.style}
          options={[
            { value: "subtle", label: "Subtle" },
            { value: "expressive", label: "Expressive" },
          ]}
          onChange={(v) => update({ style: v as "subtle" | "expressive" })}
          label="Visual Style"
          description="Subtle: smaller, more transparent marks. Expressive: larger, bolder marks."
        />
      </SettingSection>

      <SettingSection title="App-Class Detection">
        <SettingRow label="Classification" description="Muse uses heuristic process-name matching to classify the active app. No screen reading, no OCR, no AI.">
          <span className="text-[10px] text-kovy-accent font-mono">honest heuristics</span>
        </SettingRow>

        <SwitchSetting
          checked={config.codeMode}
          onChange={(v) => update({ codeMode: v })}
          label="Code Mode"
          description="Generate code-themed marks (brackets, guide lines) when a code editor is detected"
        />

        <SwitchSetting
          checked={config.writingMode}
          onChange={(v) => update({ writingMode: v })}
          label="Writing Mode"
          description="Generate writing-themed marks (strokes, note anchors) when a writing app is detected"
        />

        <SwitchSetting
          checked={config.designMode}
          onChange={(v) => update({ designMode: v })}
          label="Design Mode"
          description="Generate design-themed marks (arcs, dots) when a design tool is detected"
        />
      </SettingSection>

      <SettingSection title="Adaptive Marks">
        <SwitchSetting
          checked={config.adaptiveSelection}
          onChange={(v) => update({ adaptiveSelection: v })}
          label="Adaptive Mark Selection"
          description="Muse avoids repeating recent marks and biases them toward the current mood and app-class confidence"
        />
      </SettingSection>

    </div>
  );
}
