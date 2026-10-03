import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { InfoCard } from "../components/InfoCard";
import {
  getDiagnosticsSummary,
  exportDiagnosticsBundle,
  clearDiagnostics,
} from "@/engine/diagnosticsEngine";

export function PrivacyTab() {
  const config = useConfigStore((s) => s.draftConfig.privacy);
  const appliedConfig = useConfigStore((s) => s.appliedConfig);
  const update = useConfigStore((s) => s.updateDraftPrivacy);
  const resetSection = useConfigStore((s) => s.resetSection);

  const handleExportDiagnostics = () => {
    const json = exportDiagnosticsBundle(appliedConfig);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kovy-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = config.diagnosticsOptIn ? getDiagnosticsSummary() : null;

  return (
    <div className="space-y-2">
      <InfoCard title="Privacy-First Design">
        Kovy processes everything locally on your device. No screenshots are uploaded.
        No data leaves your computer. Screen analysis is real-time only — zero frames
        are retained after processing. Kovy does not log keystrokes, read clipboard
        contents, or inspect typed passwords.
      </InfoCard>

      <SettingSection title="Analysis Controls" onReset={() => resetSection("privacy")}>
        <SwitchSetting
          label="Disable text detection entirely"
          description="Prevent text-likeness detection from running, even if enabled in Vision tab"
          checked={config.ocrDisabled}
          onChange={(v) => update({ ocrDisabled: v })}
        />
        <SwitchSetting
          label="Zero frame retention"
          description="Frames are discarded immediately after analysis (always on)"
          checked={config.retainZeroFrames}
          onChange={(v) => update({ retainZeroFrames: v })}
        />
      </SettingSection>

      <SettingSection title="Screen Capture Visibility">
        <SwitchSetting
          label="Hide Kovy from screen capture"
          description="When ON, Kovy is invisible to OBS, screen recording, and screenshots (Windows WDA_EXCLUDEFROMCAPTURE). When OFF, Kovy is visible to OBS display capture so you can stream or record it."
          checked={config.hideFromCapture}
          onChange={(v) => update({ hideFromCapture: v })}
        />
        <SwitchSetting
          label="Auto-hide when OBS / streaming apps detected"
          description="Periodically checks for OBS, Streamlabs, vMix, ShareX, and other capture tools. When one is running, Kovy automatically hides from capture and restores your preference when it exits. Only process names are checked — no window content is read."
          checked={config.autoHideOnCaptureApp}
          onChange={(v) => update({ autoHideOnCaptureApp: v })}
        />
        <div className="kovy-glass p-3 mx-1 my-2 border-l-2 border-kovy-cyan/40">
          <p className="text-[10px] text-kovy-text-muted leading-relaxed mb-2">
            <strong>Visible to OBS (OFF):</strong> Every rendered entity (founder + family
            siblings) is masked out of Kovy's own motion analyzer so they won't react to
            themselves. Use a display or window capture in OBS to see Kovy.
          </p>
          <p className="text-[10px] text-kovy-text-muted leading-relaxed">
            <strong>Hidden from capture (ON):</strong> Kovy cannot be recorded by any tool. This
            is the most private mode and also prevents all self-detection. OBS will show a blank
            area where Kovy would be.
          </p>
        </div>
      </SettingSection>


      <SettingSection title="Diagnostics Opt-In">
        <SwitchSetting
          label="Enable local diagnostics collection"
          description="Collect performance and behavior data locally for debugging — zero data is sent anywhere"
          checked={config.diagnosticsOptIn}
          onChange={(v) => update({ diagnosticsOptIn: v })}
        />
        {config.diagnosticsOptIn && (
          <>
            <div className="kovy-glass p-3 mx-1 my-2 border-l-2 border-kovy-cyan/40">
              <p className="text-[10px] text-kovy-text-muted leading-relaxed mb-2">
                <strong>What is collected:</strong> FPS samples, behavior state transitions, mood changes,
                target count snapshots. Optionally: sanitized config snapshot and error messages.
              </p>
              <p className="text-[10px] text-kovy-text-muted leading-relaxed">
                <strong>What is NEVER collected:</strong> Screenshots, image data, OCR text, cursor history,
                window titles, app names, or any personally identifiable information.
              </p>
            </div>
            <SwitchSetting
              label="Include sanitized config snapshot"
              description="Include your settings (minus sensitive app lists) in exported diagnostics"
              checked={config.diagnosticsIncludeConfig}
              onChange={(v) => update({ diagnosticsIncludeConfig: v })}
            />
            <SwitchSetting
              label="Include error logs"
              description="Include error messages in diagnostics data"
              checked={config.diagnosticsIncludeErrors}
              onChange={(v) => update({ diagnosticsIncludeErrors: v })}
            />
            {summary && (
              <div className="px-1 py-2 text-[10px] text-kovy-text-dim font-mono space-y-0.5">
                <div>Entries: {summary.entryCount} | Avg FPS: {summary.avgFps}</div>
                <div>Recent errors: {summary.recentErrors} | Behavior changes (1m): {summary.behaviorChanges}</div>
              </div>
            )}
            <div className="flex gap-2 px-1 py-2">
              <button onClick={handleExportDiagnostics} className="kovy-btn-outline text-xs">
                Export Diagnostics
              </button>
              <button
                onClick={() => { clearDiagnostics(); }}
                className="kovy-btn-outline text-xs text-red-400 border-red-800/50"
              >
                Clear Data
              </button>
            </div>
          </>
        )}
      </SettingSection>

      <SettingSection title="What Kovy Inspects">
        <SettingRow label="Screen pixel changes" description="Analyzed locally for motion detection">
          <span className="text-xs text-green-400 font-medium">Local only</span>
        </SettingRow>
        <SettingRow label="Cursor position" description="Used for avoidance, cursor-interest, and monitor tracking">
          <span className="text-xs text-green-400 font-medium">Local only</span>
        </SettingRow>
        <SettingRow label="Foreground app name" description="Used for Memory app-session tagging and Muse Mode app-class heuristics (process name only)">
          <span className="text-xs text-green-400 font-medium">Local only</span>
        </SettingRow>
        <SettingRow label="Window title" description="Optionally stored truncated/sanitized (off by default, see Memory tab)">
          <span className="text-xs text-yellow-400 font-medium">Opt-in only</span>
        </SettingRow>
      </SettingSection>

      <SettingSection title="What Kovy Never Does">
        <SettingRow label="Upload screenshots">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Log keystrokes">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Read clipboard">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Send data to cloud">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Store screenshots">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Store passwords or secrets">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Record sensitive apps" description="Apps marked sensitive are never stored in memory (configure in Memory tab)">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
