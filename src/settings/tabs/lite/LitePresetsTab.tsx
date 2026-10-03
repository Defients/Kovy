import { useConfigStore } from "@/store/configStore";
import { InfoCard } from "../../components/InfoCard";
import { LITE_PRESETS } from "@/store/litePresets";

export function LitePresetsTab() {
  const applyLitePreset = useConfigStore((s) => s.applyLitePresetToDraft);
  const applyConfig = useConfigStore((s) => s.applyConfig);
  const livePreview = useConfigStore((s) => s.livePreview);

  const handleApply = (presetId: string) => {
    applyLitePreset(presetId);
    // Auto-apply if live preview is off, otherwise the user can review and apply
    if (!livePreview) {
      setTimeout(() => applyConfig(), 100);
    }
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Presets" accent="green">
        One-click bundles that set up Kovy for a specific vibe. Pick one and Kovy adjusts instantly.
      </InfoCard>

      <div className="grid grid-cols-2 gap-3 mt-2">
        {LITE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handleApply(preset.id)}
            className="text-left p-4 rounded-lg border border-kovy-border/40 bg-kovy-surface/40 hover:border-kovy-accent/40 hover:bg-kovy-accent/5 transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{preset.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-kovy-text group-hover:text-kovy-accent-light transition-colors">
                  {preset.name}
                </div>
                <div className="text-[10px] text-kovy-text-dim mt-1 leading-relaxed">
                  {preset.description}
                </div>
                {preset.category === "new" && (
                  <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 rounded bg-kovy-accent/20 text-kovy-accent-light font-medium">
                    NEW
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
