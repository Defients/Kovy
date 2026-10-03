import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import type { HotkeyConfig } from "@/store/types";

const HOTKEY_LABELS: Record<keyof HotkeyConfig, { label: string; description: string }> = {
  toggleVisibility: {
    label: "Toggle visibility",
    description: "Show or hide Kovy on screen",
  },
  openSettings: {
    label: "Open settings",
    description: "Open the Kovy settings window",
  },
  pauseAnalysis: {
    label: "Pause / resume analysis",
    description: "Pause or resume screen motion analysis",
  },
  sleepWake: {
    label: "Sleep / wake",
    description: "Put Kovy to sleep or wake it up",
  },
  privacyPause: {
    label: "Privacy pause",
    description: "Temporarily pause all screen observation",
  },
  resetPosition: {
    label: "Reset position",
    description: "Move Kovy back to center of screen",
  },
  toggleMuse: {
    label: "Toggle Muse Mode",
    description: "Enable or disable Muse creative overlays",
  },
  toggleGaming: {
    label: "Toggle Gaming Mode",
    description: "Enable or disable Gaming Mode kinetic adaptive layer",
  },
  toggleDrag: {
    label: "Toggle Drag Mode",
    description: "Toggle click-through to allow dragging Kovy",
  },
  toggleFocus: {
    label: "Toggle Focus Mode",
    description: "Enable or disable focus mode for distraction-free work",
  },
  switchProfile: {
    label: "Switch Profile",
    description: "Cycle through saved configuration profiles",
  },
  toggleExperienceMode: {
    label: "Toggle Lite / Pro Mode",
    description: "Switch between simplified Lite settings and full Pro settings",
  },
  askKovy: {
    label: "Ask Kovy",
    description: "Immediately ask Kovy to observe the current screen context and respond",
  },
  commandPalette: {
    label: "Command Palette",
    description: "Open the searchable command palette",
  },
  showDigest: {
    label: "Show Companion Digest",
    description: "Display an overlay card summarizing your bond, stats, mood, and recent highlights",
  },
  showChronicle: {
    label: "Show Companion Chronicle",
    description: "Display a trends card with your 7-day bond sparkline, streak, and insights",
  },
  showStory: {
    label: "Show Companion Story",
    description: "Display the weekly story chapter card with narrative highlights",
  },
  openChat: {
    label: "Talk to Kovy",
    description: "Open the conversational chat panel to talk directly with Kovy",
  },
};

export function HotkeysTab() {
  const config = useConfigStore((s) => s.draftConfig.hotkeys);
  const update = useConfigStore((s) => s.updateDraftHotkeys);
  const resetSection = useConfigStore((s) => s.resetSection);

  return (
    <div className="space-y-2">
      <SettingSection title="Global Shortcuts" onReset={() => resetSection("hotkeys")}>
        <p className="text-xs text-kovy-text-dim px-1 pb-2">
          These shortcuts work system-wide, even when Kovy's window is not focused.
          Hold <span className="font-mono text-kovy-cyan">Alt</span> over the overlay to temporarily enable interaction mode.
        </p>
        {(Object.keys(HOTKEY_LABELS) as Array<keyof HotkeyConfig>).map((key) => (
          <HotkeyEditor
            key={key}
            hotkeyKey={key}
            label={HOTKEY_LABELS[key].label}
            description={HOTKEY_LABELS[key].description}
            value={config[key]}
            onChange={(value) => update({ [key]: value })}
          />
        ))}
      </SettingSection>

      <SettingSection title="Tips">
        <SettingRow label="Modifier keys" description="Use Alt, Ctrl, Shift, or combinations like Alt+Shift+K">
          <span className="text-xs text-kovy-text-dim font-mono">Alt+Shift+K</span>
        </SettingRow>
        <SettingRow label="Clear a shortcut" description="Press Escape or clear the field to disable a shortcut">
          <span className="text-xs text-kovy-text-dim">Esc to clear</span>
        </SettingRow>
      </SettingSection>
    </div>
  );
}

function HotkeyEditor({
  hotkeyKey: _hotkeyKey,
  label,
  description,
  value,
  onChange,
}: {
  hotkeyKey: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      onChange("");
      setRecording(false);
      setError(null);
      return;
    }

    // Ignore standalone modifier key presses
    if (["Alt", "Control", "Shift", "Meta"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Super");

    if (parts.length === 0) {
      setError("Must include at least one modifier (Ctrl, Alt, Shift)");
      return;
    }

    // Normalize key name
    let keyName = e.key;
    if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    const shortcut = parts.join("+");

    onChange(shortcut);
    setRecording(false);
    setError(null);
  };

  return (
    <SettingRow label={label} description={description}>
      <div className="flex flex-col items-end gap-1">
        <input
          type="text"
          readOnly
          value={recording ? "Press keys..." : value || "(none)"}
          onFocus={() => { setRecording(true); setError(null); }}
          onBlur={() => setRecording(false)}
          onKeyDown={handleKeyDown}
          className={`kovy-input w-40 text-xs text-center cursor-pointer ${
            recording ? "ring-2 ring-kovy-accent/60 border-kovy-accent/60" : ""
          } ${!value ? "text-kovy-text-dim italic" : ""}`}
        />
        {error && (
          <span className="text-[10px] text-red-400">{error}</span>
        )}
      </div>
    </SettingRow>
  );
}
