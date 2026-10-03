import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { SliderSetting } from "../components/SliderSetting";
import type { BehaviorPreset } from "@/store/types";

export function BehaviorTab() {
  const config = useConfigStore((s) => s.draftConfig.behavior);
  const update = useConfigStore((s) => s.updateDraftBehavior);
  const focusTarget = useConfigStore((s) => s.draftConfig.focusTarget);
  const updateFocusTarget = useConfigStore((s) => s.updateDraftFocusTarget);
  const applyPreset = useConfigStore((s) => s.applyBehaviorPresetToDraft);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Preset" onReset={() => resetSection("behavior")}>
        <SelectSetting
          label="Behavior preset"
          description="Quick personality preset for Kovy"
          value={config.preset}
          options={[
            { value: "chill", label: "Chill" },
            { value: "curious", label: "Curious" },
            { value: "goblin", label: "Goblin" },
            { value: "hyper", label: "Hyper" },
            { value: "focus", label: "Focus Buddy" },
          ]}
          onChange={(v) => applyPreset(v as BehaviorPreset)}
        />
      </SettingSection>

      <SettingSection title="Personality">
        <SliderSetting
          label="Curiosity strength"
          description="How eager Kovy is to investigate new motion"
          value={config.curiosityStrength}
          min={0} max={1}
          onChange={(v) => update({ curiosityStrength: v })}
        />
        <SliderSetting
          label="Attraction strength"
          description="How strongly Kovy moves toward targets"
          value={config.attractionStrength}
          min={0} max={1}
          onChange={(v) => update({ attractionStrength: v })}
        />
        <SliderSetting
          label="Boredom rate"
          description="How quickly Kovy gets bored without stimulation"
          value={config.boredomRate}
          min={0} max={1}
          onChange={(v) => update({ boredomRate: v })}
        />
        <SliderSetting
          label="Dwell time"
          description="How long Kovy stays near an interesting target (seconds)"
          value={config.dwellTime}
          min={1} max={30} step={1}
          onChange={(v) => update({ dwellTime: v })}
          displayValue={`${config.dwellTime}s`}
        />
      </SettingSection>

      <SettingSection title="Movement">
        <SliderSetting
          label="Wander amount"
          description="How much Kovy moves around when idle"
          value={config.wanderAmount}
          min={0} max={1}
          onChange={(v) => update({ wanderAmount: v })}
        />
        <SliderSetting
          label="Perch preference"
          description="How often Kovy settles at edges/corners"
          value={config.perchPreference}
          min={0} max={1}
          onChange={(v) => update({ perchPreference: v })}
        />
        <SliderSetting
          label="Return-to-perch tendency"
          value={config.returnToPerchTendency}
          min={0} max={1}
          onChange={(v) => update({ returnToPerchTendency: v })}
        />
      </SettingSection>

      <SettingSection title="Cursor & Interaction">
        <SliderSetting
          label="Cursor avoidance radius"
          description="How far Kovy stays from your cursor (pixels)"
          value={config.cursorAvoidRadius}
          min={0} max={400} step={10}
          onChange={(v) => update({ cursorAvoidRadius: v })}
          displayValue={`${config.cursorAvoidRadius}px`}
        />
        <SwitchSetting
          label="Cursor curiosity"
          description="Kovy is attracted to your cursor instead of avoiding it"
          checked={config.cursorCuriosity}
          onChange={(v) => update({ cursorCuriosity: v })}
        />
        <SwitchSetting
          label="Interaction mode"
          description="Click/hover Kovy to influence its mood"
          checked={config.interactionMode}
          onChange={(v) => update({ interactionMode: v })}
        />
      </SettingSection>

      {config.preset === "hyper" && (
        <SettingSection title="Hyper Mode">
          <SliderSetting
            label="Dash strength"
            description="Burst acceleration intensity when dashing to a target"
            value={config.hyper.dashStrength}
            min={0} max={1}
            onChange={(v) => update({ hyper: { ...config.hyper, dashStrength: v } })}
          />
          <SliderSetting
            label="Chain delay"
            description="Seconds between chaining to the next target"
            value={config.hyper.chainDelay}
            min={0.1} max={2} step={0.1}
            onChange={(v) => update({ hyper: { ...config.hyper, chainDelay: v } })}
            displayValue={`${config.hyper.chainDelay.toFixed(1)}s`}
          />
          <SliderSetting
            label="Orbit burst duration"
            description="How long Kovy orbits a target before moving on"
            value={config.hyper.orbitBurstDuration}
            min={0.3} max={3} step={0.1}
            onChange={(v) => update({ hyper: { ...config.hyper, orbitBurstDuration: v } })}
            displayValue={`${config.hyper.orbitBurstDuration.toFixed(1)}s`}
          />
          <SliderSetting
            label="Target chain threshold"
            description="Minimum target score required to chain to next target"
            value={config.hyper.targetChainThreshold}
            min={0} max={1}
            onChange={(v) => update({ hyper: { ...config.hyper, targetChainThreshold: v } })}
          />
          <SliderSetting
            label="Max chain rate"
            description="Maximum target chains per 10 seconds"
            value={config.hyper.maxChainRate}
            min={1} max={10} step={1}
            onChange={(v) => update({ hyper: { ...config.hyper, maxChainRate: v } })}
            displayValue={`${config.hyper.maxChainRate}/10s`}
          />
          <SliderSetting
            label="Dash cooldown"
            description="Minimum seconds between dashes"
            value={config.hyper.dashCooldown}
            min={0.2} max={3} step={0.1}
            onChange={(v) => update({ hyper: { ...config.hyper, dashCooldown: v } })}
            displayValue={`${config.hyper.dashCooldown.toFixed(1)}s`}
          />
        </SettingSection>
      )}

      <SettingSection title="Focus Target Attraction">
        <SwitchSetting
          label="Enable focus target"
          description="Allow Kovy to be drawn toward the active window and cursor"
          checked={focusTarget.enabled}
          onChange={(v) => updateFocusTarget({ enabled: v })}
        />
        {focusTarget.enabled && (
          <>
            <SliderSetting
              label="Window attraction"
              description="How strongly Kovy is drawn to the active window center"
              value={focusTarget.windowAttraction}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ windowAttraction: v })}
              displayValue={`${Math.round(focusTarget.windowAttraction * 100)}%`}
            />
            <SliderSetting
              label="Cursor attraction"
              description="How strongly Kovy is drawn to your cursor"
              value={focusTarget.cursorAttraction}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ cursorAttraction: v })}
              displayValue={`${Math.round(focusTarget.cursorAttraction * 100)}%`}
            />
            <SliderSetting
              label="Gaming window boost"
              description="Extra attraction to windows during gaming mode"
              value={focusTarget.gamingWindowBoost}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ gamingWindowBoost: v })}
              displayValue={`${Math.round(focusTarget.gamingWindowBoost * 100)}%`}
            />
            <SliderSetting
              label="Gaming cursor boost"
              description="Extra attraction to cursor during gaming mode"
              value={focusTarget.gamingCursorBoost}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ gamingCursorBoost: v })}
              displayValue={`${Math.round(focusTarget.gamingCursorBoost * 100)}%`}
            />
            <SliderSetting
              label="Blend factor"
              description="How much focus attraction blends with normal targeting"
              value={focusTarget.blendFactor}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ blendFactor: v })}
              displayValue={`${Math.round(focusTarget.blendFactor * 100)}%`}
            />
            <SliderSetting
              label="Habitat softening"
              description="Reduces habitat constraint when focus target is active"
              value={focusTarget.habitatSoftening}
              min={0} max={1} step={0.05}
              onChange={(v) => updateFocusTarget({ habitatSoftening: v })}
              displayValue={`${Math.round(focusTarget.habitatSoftening * 100)}%`}
            />
          </>
        )}
      </SettingSection>

    </div>
  );
}
