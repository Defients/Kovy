import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { ConfirmModal } from "../components/ConfirmModal";
import type { ExperimentalInteraction } from "@/store/types";

const INTERACTION_LABELS: Record<ExperimentalInteraction, string> = {
  click: "Click",
  hover: "Hover",
  type: "Space key (unavailable)",
};

export function ExperimentalTab() {
  const config = useConfigStore((s) => s.draftConfig.experimental);
  const update = useConfigStore((s) => s.updateDraftExperimental);
  const resetSection = useConfigStore((s) => s.resetSection);
  const [showWarning, setShowWarning] = useState(false);

  const handleEnable = (v: boolean) => {
    if (v && !config.optInAcknowledged) {
      setShowWarning(true);
      return;
    }
    update({ enabled: v });
  };

  const handleAcknowledge = () => {
    setShowWarning(false);
    update({ enabled: true, optInAcknowledged: true });
  };

  const toggleInteraction = (type: ExperimentalInteraction) => {
    const current = config.allowedInteractions;
    const has = current.includes(type);
    const next = has
      ? current.filter((t) => t !== type)
      : [...current, type];
    update({ allowedInteractions: next });
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Experimental Mode" accent="amber">
        <p className="text-xs text-kovy-text-dim">
          Physical desktop input is unavailable in this build pending native target and focus validation.
          Saved opt-ins are preserved, but they cannot enable OS clicks or keystrokes.
          Only placed toy/habitat candidates are considered; app allowlists and the legacy space-key action remain unavailable.
        </p>
      </InfoCard>

      <SettingSection title="Enablement" onReset={() => resetSection("experimental")}>
        <SwitchSetting
          label="Enable experimental mode"
          description="Preserve experimental preference; physical desktop input remains unavailable"
          checked={config.enabled}
          onChange={handleEnable}
        />
        {config.optInAcknowledged && (
          <div className="px-1 py-1 text-[10px] text-green-400">
            ✓ Opt-in acknowledged
          </div>
        )}
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Interaction Settings">
            <SliderSetting
              label="Interaction radius"
              description="How far Kovy can reach to interact with elements (pixels)"
              min={50}
              max={400}
              step={10}
              value={config.interactionRadius}
              onChange={(v) => update({ interactionRadius: v })}
            />
            <SliderSetting
              label="Rate limit (seconds)"
              description="Minimum time between interactions"
              min={1}
              max={60}
              step={1}
              value={config.rateLimitSec}
              onChange={(v) => update({ rateLimitSec: v })}
            />
            <SwitchSetting
              label="Auto-interact"
              description="Kovy automatically interacts when in curious/playful states"
              checked={config.autoInteract}
              onChange={(v) => update({ autoInteract: v })}
            />
          </SettingSection>

          <SettingSection title="Allowed Interactions">
            <p className="text-xs text-kovy-text-dim px-1 pb-2">
              Select which types of interactions Kovy is allowed to perform.
            </p>
            <div className="space-y-1">
              {(Object.keys(INTERACTION_LABELS) as ExperimentalInteraction[]).map((type) => (
                <SettingRow
                  key={type}
                  label={INTERACTION_LABELS[type]}
                  description={type === "click" ? "Simulate mouse clicks" : type === "hover" ? "Move cursor over elements" : "Unavailable until focus semantics are verified"}
                >
                  <button
                    onClick={() => toggleInteraction(type)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      config.allowedInteractions.includes(type)
                        ? "bg-green-600/30 text-green-300 border border-green-500/40"
                        : "bg-kovy-surface/30 text-kovy-text-dim border border-kovy-border/30"
                    }`}
                  >
                    {config.allowedInteractions.includes(type) ? "Allowed" : "Blocked"}
                  </button>
                </SettingRow>
              ))}
            </div>
          </SettingSection>

          <InfoCard title="Safety Information" accent="amber">
            <ul className="text-xs text-kovy-text-dim space-y-1">
              <li>• Interactions are rate-limited (default: 1 per 5 seconds)</li>
              <li>• Kovy only interacts when in curious or playful behavior states</li>
              <li>• Privacy pause disables all interactions immediately</li>
              <li>• Attempt results use generic local-object labels; app/window titles are not logged</li>
              <li>• You can disable at any time via this toggle</li>
            </ul>
          </InfoCard>
        </>
      )}

      <ConfirmModal
        isOpen={showWarning}
        title="Experimental preference"
        message="Save this experimental preference? Physical desktop input remains unavailable in this build."
        confirmText="I understand — Enable"
        cancelText="Cancel"
        onConfirm={handleAcknowledge}
        onCancel={() => setShowWarning(false)}
      />
    </div>
  );
}
