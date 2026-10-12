import { useEffect, useState } from "react";
import { getCaptureVisibilityStatus, type CaptureVisibilityStatus } from "@/lib/tauriBridge";
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
  const [captureStatus, setCaptureStatus] = useState<CaptureVisibilityStatus>("not-applied");
  useEffect(() => {
    let active = true;
    const refresh = () => { void getCaptureVisibilityStatus().then(s => { if (active) setCaptureStatus(s); }); };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, []);

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
        Kovy's motion analysis runs locally. It keeps the previous downscaled grayscale
        frame in memory to compare changes; it does not save screenshots to disk.
        Local memories, journals, and optional chat history can persist on this device.
        If you enable AI, chat messages and opted-in screen context
        are sent to OpenRouter; screenshots are sent only when you enable screenshot
        sharing in AI settings and Apply. Privacy Pause blocks new AI requests, asks
        active transport to stop, and suppresses pending replies. Requests already sent cannot be recalled. Kovy's motion
        analysis does not log keystrokes or read clipboard contents.
      </InfoCard>

      <SettingSection title="Analysis Controls" onReset={() => resetSection("privacy")}>
        <SwitchSetting
          label="Disable text detection entirely"
          description="Prevent text-likeness detection from running, even if enabled in Vision tab"
          checked={config.ocrDisabled}
          onChange={(v) => update({ ocrDisabled: v })}
        />
        <SettingRow label="Screenshot persistence" description="Analysis uses a transient previous grayscale frame. Analysis and AI screenshots are not written to disk; the legacy retention preference does not change this policy.">
          <span className="text-xs text-green-400">No disk storage</span>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Screen Capture Visibility">
        <SwitchSetting
          label="Hide Kovy from screen capture"
          description="Requests Windows recording exclusion. Support varies by capture tool and Windows version; this cannot guarantee that Kovy is unrecordable. Apply to change the request."
          checked={config.hideFromCapture}
          onChange={(v) => update({ hideFromCapture: v })}
        />
        <SettingRow label="Recording exclusion status" description="Reported by the native window; a saved preference alone does not prove it applied.">
          <span className="text-xs text-kovy-text" role="status">{captureStatus === "applied-hidden" ? "Applied (best effort)" : captureStatus === "applied-visible" ? "Visible" : captureStatus === "failed" ? "Failed" : captureStatus === "unsupported" ? "Unsupported" : captureStatus === "unavailable" ? "Native status unavailable" : "Not yet applied"}</span>
        </SettingRow>
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
            <strong>Recording exclusion requested (ON):</strong> Compatible tools may omit Kovy.
            Other recording methods can still capture the window. Motion-analysis masks remain active.
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
              description="Include selected feature flags only. App rules, locations, profiles, shadow settings, names, and other configuration are omitted. Configuration and Soul exports are separate and may contain personal data."
              checked={config.diagnosticsIncludeConfig}
              onChange={(v) => update({ diagnosticsIncludeConfig: v })}
            />
            <SwitchSetting
              label="Include error logs"
              description="Include error occurrence counts and timestamps; raw messages and provider responses are omitted"
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
        <SettingRow label="Foreground app name" description="Used locally for app context. AI can send the app name and window title to OpenRouter when foreground context is enabled and applied.">
          <span className="text-xs text-yellow-400 font-medium">Optional sharing</span>
        </SettingRow>
        <SettingRow label="Window title" description="Optionally stored truncated/sanitized (off by default, see Memory tab)">
          <span className="text-xs text-yellow-400 font-medium">Opt-in only</span>
        </SettingRow>
      </SettingSection>

      <SettingSection title="Storage and Network Choices">
        <SettingRow label="Upload screenshots" description="Sent to OpenRouter only with applied AI and screenshot consent. Text chat does not send screenshots.">
          <span className="text-xs text-yellow-400 font-medium">Opt-in only</span>
        </SettingRow>
        <SettingRow label="Log keystrokes">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Read clipboard">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Network requests" description="Optional AI sends messages and permitted context to OpenRouter. Optional weather sends your configured location to wttr.in.">
          <span className="text-xs text-yellow-400 font-medium">Opt-in only</span>
        </SettingRow>
        <SettingRow label="Store screenshots">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
        <SettingRow label="Store your AI API key" description="Stored in the Windows credential vault. JavaScript can store, delete, or check presence; it cannot retrieve the stored key.">
          <span className="text-xs text-yellow-400 font-medium">Vault only</span>
        </SettingRow>
        <SettingRow label="Record sensitive apps" description="Apps marked sensitive are never stored in memory (configure in Memory tab)">
          <span className="text-xs text-red-400 font-medium">Never</span>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
