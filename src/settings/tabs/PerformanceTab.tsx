import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { SliderSetting } from "../components/SliderSetting";
import type { PerformancePreset } from "@/store/types";

export function PerformanceTab() {
  const config = useConfigStore((s) => s.draftConfig.performance);
  const update = useConfigStore((s) => s.updateDraftPerformance);
  const applyPreset = useConfigStore((s) => s.applyPerformancePresetToDraft);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Preset" onReset={() => resetSection("performance")}>
        <SelectSetting
          label="Performance preset"
          description="Quick preset balancing quality and resource usage"
          value={config.preset}
          options={[
            { value: "battery", label: "Battery Saver" },
            { value: "balanced", label: "Balanced" },
            { value: "quality", label: "Quality" },
            { value: "ultra", label: "Ultra" },
          ]}
          onChange={(v) => applyPreset(v as PerformancePreset)}
        />
      </SettingSection>

      <SettingSection title="Throttling">
        <SwitchSetting
          label="Frame skipping"
          description="Skip rendering frames to maintain the target FPS cap"
          checked={config.frameSkipping}
          onChange={(v) => update({ frameSkipping: v })}
        />
        <SwitchSetting
          label="Battery-aware throttling"
          description="Reduce activity on battery power. May not take effect on all Windows systems."
          checked={config.batteryThrottling}
          onChange={(v) => update({ batteryThrottling: v })}
        />
      </SettingSection>

      <SettingSection title="Budgets">
        <SliderSetting
          label="CPU budget preference"
          description="Target maximum CPU usage. Use analysis FPS and render FPS below for direct control."
          value={config.cpuBudget}
          min={1} max={20} step={1}
          onChange={(v) => update({ cpuBudget: v })}
          displayValue={`${config.cpuBudget}%`}
        />
        <SliderSetting
          label="Max analysis FPS"
          value={config.maxAnalysisFps}
          min={1} max={15} step={1}
          onChange={(v) => update({ maxAnalysisFps: v })}
          displayValue={`${config.maxAnalysisFps} fps`}
        />
        <SliderSetting
          label="Max render FPS"
          value={config.maxRenderFps}
          min={15} max={120} step={5}
          onChange={(v) => update({ maxRenderFps: v })}
          displayValue={`${config.maxRenderFps} fps`}
        />
      </SettingSection>

      <SettingSection title="Power Saving">
        <SwitchSetting
          label="Low-power idle mode"
          description="Reduce rendering when Kovy is idle/perched"
          checked={config.lowPowerIdle}
          onChange={(v) => update({ lowPowerIdle: v })}
        />
      </SettingSection>
    </div>
  );
}
