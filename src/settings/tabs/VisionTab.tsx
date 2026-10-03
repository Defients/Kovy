import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";

export function VisionTab() {
  const config = useConfigStore((s) => s.draftConfig.vision);
  const update = useConfigStore((s) => s.updateDraftVision);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Screen Analysis" onReset={() => resetSection("vision")}>
        <SwitchSetting
          label="Screen analysis enabled"
          description="Kovy observes your screen for interesting motion"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <SliderSetting
          label="Analysis FPS"
          description="How many times per second the screen is analyzed"
          value={config.analysisFps}
          min={1} max={15} step={1}
          onChange={(v) => update({ analysisFps: v })}
          displayValue={`${config.analysisFps} fps`}
        />
        <SliderSetting
          label="Analysis scale"
          description="Downscale factor for analysis (lower = faster, less precise)"
          value={config.analysisScale}
          min={0.05} max={0.5} step={0.05}
          onChange={(v) => update({ analysisScale: v })}
          displayValue={`${Math.round(config.analysisScale * 100)}%`}
        />
      </SettingSection>

      <SettingSection title="Motion Detection">
        <SliderSetting
          label="Motion threshold"
          description="Pixel difference required to count as motion"
          value={config.motionThreshold}
          min={5} max={80} step={1}
          onChange={(v) => update({ motionThreshold: v })}
          displayValue={`${config.motionThreshold}`}
        />
        <SliderSetting
          label="Persistence threshold"
          description="Frames a region must persist to be considered interesting"
          value={config.persistenceThreshold}
          min={1} max={10} step={1}
          onChange={(v) => update({ persistenceThreshold: v })}
          displayValue={`${config.persistenceThreshold}`}
        />
        <SliderSetting
          label="Target smoothing"
          description="How smoothly targets transition"
          value={config.targetSmoothing}
          min={0} max={1}
          onChange={(v) => update({ targetSmoothing: v })}
        />
      </SettingSection>

      <SettingSection title="Scoring Weights">
        <SliderSetting
          label="Novelty weighting"
          description="How much new/unseen regions are preferred"
          value={config.noveltyWeight}
          min={0} max={1}
          onChange={(v) => update({ noveltyWeight: v })}
        />
        <SliderSetting
          label="Cursor-adjacent weighting"
          description="Boost interest near your cursor"
          value={config.cursorAdjacentWeight}
          min={0} max={1}
          onChange={(v) => update({ cursorAdjacentWeight: v })}
        />
      </SettingSection>

      <SettingSection title="Text Detection">
        <SwitchSetting
          label="Enable text-likeness detection"
          description="Flag motion regions that look like text (dialog boxes, toasts) for a small scoring boost. This is a lightweight heuristic — not OCR."
          checked={config.ocrEnabled}
          onChange={(v) => update({ ocrEnabled: v })}
        />
        {config.ocrEnabled && (
          <>
            <div className="kovy-glass p-3 mx-1 my-2 border-l-2 border-kovy-cyan/40">
              <p className="text-[10px] text-kovy-text-muted leading-relaxed">
                Text detection runs on the top 1–2 highest-salience regions only — not the full screen.
                It uses aspect ratio, size, and energy heuristics to estimate text-likeness.
                It does NOT read or extract text content. Results are transient.
                Can be fully disabled from the Privacy tab regardless of this toggle.
              </p>
            </div>
            <SliderSetting
              label="Detection cooldown"
              description="Minimum time between detection runs (higher = less CPU)"
              value={config.ocrCooldownMs}
              min={2000} max={30000} step={1000}
              onChange={(v) => update({ ocrCooldownMs: v })}
              displayValue={`${(config.ocrCooldownMs / 1000).toFixed(0)}s`}
            />
            <SliderSetting
              label="Max regions to check"
              description="How many top-scoring regions to check per cycle"
              value={config.ocrMaxRegions}
              min={1} max={3} step={1}
              onChange={(v) => update({ ocrMaxRegions: v })}
              displayValue={`${config.ocrMaxRegions}`}
            />
          </>
        )}
      </SettingSection>
    </div>
  );
}
