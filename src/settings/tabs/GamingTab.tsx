import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { SelectSetting } from "../components/SelectSetting";

export function GamingTab() {
  const config = useConfigStore((s) => s.draftConfig.gaming);
  const update = useConfigStore((s) => s.updateDraftGaming);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Gaming Mode" onReset={() => resetSection("gaming")}>
        <SwitchSetting
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
          label="Enable Gaming Mode"
          description="A kinetic adaptive layer that reacts to fast screen activity with prediction, residue, and elastic deformation"
        />

        <SettingRow label="How it works" description="Gaming Mode uses local adaptive salience and short-horizon prediction based on recent motion history. It is NOT machine learning — it uses bounded heuristics, centroid velocity tracking, and linear extrapolation to produce believable reactive behavior.">
          <span className="text-[10px] text-kovy-accent font-mono">local adaptive</span>
        </SettingRow>

        <SettingRow label="Relationship to other modes" description="Gaming Mode is distinct from Muse (contextual creative overlays) and Hyper (movement grammar). Gaming Mode amplifies salience, adds residue visuals, and modulates Hyper behavior — but does not replace either system.">
          <span className="text-[10px] text-kovy-text-dim font-mono">independent layer</span>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Prediction & Excitement">
        <SliderSetting
          value={config.predictiveBias}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ predictiveBias: v })}
          label="Predictive Bias"
          description="How aggressively short-horizon predictions bias targeting"
          displayValue={`${Math.round(config.predictiveBias * 100)}%`}
        />

        <SliderSetting
          value={config.excitementGain}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ excitementGain: v })}
          label="Excitement Gain"
          description="How fast excitement grows from motion activity and confirmed predictions"
          displayValue={`${Math.round(config.excitementGain * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Hyper Blending">
        <SliderSetting
          value={config.hyperBlend}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ hyperBlend: v })}
          label="Hyper Blend"
          description="How much Gaming Mode modulates Hyper behavior (dwell time, dash cooldown, curiosity)"
          displayValue={`${Math.round(config.hyperBlend * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Residue Visuals">
        <SliderSetting
          value={config.residueAmount}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ residueAmount: v })}
          label="Residue Amount"
          description="Spawn rate of kinetic visual residue marks"
          displayValue={`${Math.round(config.residueAmount * 100)}%`}
        />

        <SliderSetting
          value={config.residueLifetime}
          min={0.08}
          max={1.2}
          step={0.04}
          onChange={(v) => update({ residueLifetime: v })}
          label="Residue Lifetime"
          description="How long each residue mark persists (much shorter than Muse overlays)"
          displayValue={`${config.residueLifetime.toFixed(2)}s`}
        />
      </SettingSection>

      <SettingSection title="Body Deformation">
        <SliderSetting
          value={config.elasticDeformation}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ elasticDeformation: v })}
          label="Elastic Deformation"
          description="Amplifies squash/stretch and velocity-aligned deformation"
          displayValue={`${Math.round(config.elasticDeformation * 100)}%`}
        />

        <SliderSetting
          value={config.freeformWobble}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update({ freeformWobble: v })}
          label="Freeform Wobble"
          description="Adds subtle body noise/wobble during high excitement"
          displayValue={`${Math.round(config.freeformWobble * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Visual Style">
        <SelectSetting
          value={config.visualStyle}
          options={[
            { value: "surge", label: "Surge" },
            { value: "feral", label: "Feral" },
            { value: "arcade", label: "Arcade" },
          ]}
          onChange={(v) => update({ visualStyle: v as "surge" | "feral" | "arcade" })}
          label="Visual Style"
          description="Surge: cool/electric tones. Feral: warm/aggressive tones. Arcade: vibrant/neon tones."
        />
      </SettingSection>

    </div>
  );
}
