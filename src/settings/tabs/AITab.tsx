import { useState, useEffect, useCallback, useMemo } from "react";
import { Key, Trash2, Eye, EyeOff, Shield, AlertTriangle, CheckCircle, Monitor } from "lucide-react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { EmptyState } from "../components/EmptyState";
import { aiStoreApiKey, aiDeleteApiKey, aiHasApiKey, getMonitors, type MonitorInfo } from "@/lib/tauriBridge";
import { JournalEngine } from "@/engine/journalEngine";

export function AITab() {
  const config = useConfigStore((s) => s.draftConfig.ai);
  const updateDraft = useConfigStore((s) => s.updateDraftAi);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [journalEngine] = useState(() => new JournalEngine());
  const [journalTick, forceJournalUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      journalEngine.reload();
      forceJournalUpdate((n) => n + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [journalEngine]);

  const aiEntries = useMemo(() => {
    return journalEngine.getEntries()
      .filter((e) => e.type === "ai_insight")
      .slice(-20)
      .reverse();
  }, [journalEngine, journalTick]);

  const checkKey = useCallback(async () => {
    const exists = await aiHasApiKey();
    setHasKey(exists);
  }, []);

  useEffect(() => {
    checkKey();
    getMonitors().then(setMonitors).catch(() => {});
  }, [checkKey]);

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setKeyStatus("saving");
    try {
      await aiStoreApiKey(apiKeyInput.trim());
      setApiKeyInput("");
      setKeyStatus("saved");
      await checkKey();
      setTimeout(() => setKeyStatus("idle"), 2000);
    } catch {
      setKeyStatus("error");
      setTimeout(() => setKeyStatus("idle"), 3000);
    }
  };

  const handleDeleteKey = async () => {
    try {
      await aiDeleteApiKey();
      await checkKey();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Ask Kovy — AI-Powered Insights" accent="cyan">
        <p className="text-xs text-kovy-text-dim">
          Kovy can use AI to observe your screen context and generate contextual thoughts and whispers.
          Your API key is stored securely in the OS credential vault — never in config files or localStorage.
          Screenshots are only sent when you explicitly enable it below.
        </p>
      </InfoCard>

      <SettingSection title="AI Enablement" onReset={() => resetSection("ai")}>
        <SwitchSetting
          label="Enable AI insights"
          description="Allow Kovy to generate AI-powered thoughts and whispers"
          checked={config.enabled}
          onChange={(v) => updateDraft({ enabled: v })}
        />
      </SettingSection>

      <SettingSection title="API Key — OpenRouter">
        <div className="px-1 pb-3">
          <p className="text-xs text-kovy-text-dim mb-3">
            Your OpenRouter API key is stored in the Windows Credential Vault.
            Get a key at{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-kovy-cyan underline"
            >
              openrouter.ai/keys
            </a>
          </p>

          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-kovy-surface-light text-kovy-text text-sm rounded-lg px-3 py-2 pr-10 border border-kovy-border focus:border-kovy-cyan focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-kovy-text-dim hover:text-kovy-text"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim() || keyStatus === "saving"}
              className="flex items-center gap-1.5 px-3 py-2 bg-kovy-cyan text-kovy-bg rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              <Key size={14} />
              {keyStatus === "saving" ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {hasKey ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle size={14} />
                  API key stored securely
                </span>
                <button
                  onClick={handleDeleteKey}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 size={12} />
                  Remove key
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-kovy-text-dim">
                <AlertTriangle size={14} />
                No API key stored
              </span>
            )}
            {keyStatus === "error" && (
              <span className="text-xs text-red-400">Failed to save key</span>
            )}
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Model & Provider">
        <SettingRow label="Provider" description="AI provider for screen analysis">
          <span className="text-sm text-kovy-text-dim">OpenRouter</span>
        </SettingRow>
        <SettingRow label="Model" description="OpenRouter model identifier">
          <input
            type="text"
            value={config.model}
            onChange={(e) => updateDraft({ model: e.target.value })}
            className="bg-kovy-surface-light text-kovy-text text-sm rounded-lg px-3 py-1.5 border border-kovy-border focus:border-kovy-cyan focus:outline-none w-64"
            placeholder="openrouter/auto"
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Privacy & Screenshot Consent">
        <InfoCard title="Screenshot Privacy" accent="amber">
          <p className="text-xs text-kovy-text-dim">
            When enabled, Kovy will capture screenshots of your selected monitors and send them to the AI provider
            as part of the request. The screenshots are stitched, resized, JPEG-compressed, and sent directly to OpenRouter.
            They are never stored locally or logged. A toast notification will appear on the overlay when a screenshot is captured.
          </p>
        </InfoCard>
        <SwitchSetting
          label="Send screenshot with AI requests"
          description="Capture and send screenshots for visual context"
          checked={config.sendScreenshot}
          onChange={(v) => updateDraft({ sendScreenshot: v })}
        />
        {config.sendScreenshot && (
          <>
            <SliderSetting
              label="Max width (final stitched image)"
              description="Resize the combined screenshot to this width before sending (pixels)"
              value={config.screenshotMaxWidth}
              min={320}
              max={1920}
              step={80}
              onChange={(v) => updateDraft({ screenshotMaxWidth: Math.round(v) })}
              displayValue={`${config.screenshotMaxWidth}px`}
            />
            <SliderSetting
              label="Global JPEG quality"
              description="Default compression quality for all monitors (lower = smaller, less detail)"
              value={config.screenshotJpegQuality}
              min={40}
              max={90}
              step={5}
              onChange={(v) => updateDraft({ screenshotJpegQuality: Math.round(v) })}
              displayValue={`${config.screenshotJpegQuality}%`}
            />

            {/* Monitor selection */}
            <SettingRow
              label="Monitor selection"
              description="Choose which screens to capture (empty = primary only)"
            >
              <div className="flex flex-col gap-2 w-full mt-2">
                {monitors.length === 0 && (
                  <span className="text-xs text-kovy-text-dim">
                    No monitors detected (not running in Tauri)
                  </span>
                )}
                {monitors.map((m) => {
                  const isSelected = config.screenshotMonitorIndices.includes(m.index);
                  return (
                    <div key={m.index} className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-kovy-text">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const current = [...config.screenshotMonitorIndices];
                            if (checked && !current.includes(m.index)) {
                              current.push(m.index);
                            } else if (!checked) {
                              const idx = current.indexOf(m.index);
                              if (idx >= 0) current.splice(idx, 1);
                            }
                            updateDraft({ screenshotMonitorIndices: current });
                          }}
                          className="accent-kovy-cyan"
                        />
                        <Monitor size={14} className="text-kovy-text-dim" />
                        <span>
                          {m.name || `Monitor ${m.index + 1}`}
                          {m.is_primary && (
                            <span className="text-kovy-text-dim text-xs ml-1">(primary)</span>
                          )}
                          <span className="text-kovy-text-dim text-xs ml-2">
                            {m.width}×{m.height}
                          </span>
                        </span>
                      </label>
                      {/* Per-monitor quality override */}
                      {isSelected && (
                        <div className="ml-6 flex items-center gap-3">
                          <label className="text-xs text-kovy-text-dim whitespace-nowrap">
                            Quality override:
                          </label>
                          <input
                            type="range"
                            min={40}
                            max={90}
                            step={5}
                            value={config.screenshotMonitorQualities[m.index] ?? config.screenshotJpegQuality}
                            onChange={(e) => {
                              const val = Math.round(Number(e.target.value));
                              const newQualities = { ...config.screenshotMonitorQualities, [m.index]: val };
                              updateDraft({ screenshotMonitorQualities: newQualities });
                            }}
                            className="flex-1 accent-kovy-cyan"
                          />
                          <span className="text-xs text-kovy-text-dim w-10 text-right">
                            {config.screenshotMonitorQualities[m.index] ?? config.screenshotJpegQuality}%
                          </span>
                          {config.screenshotMonitorQualities[m.index] !== undefined && (
                            <button
                              onClick={() => {
                                const newQualities = { ...config.screenshotMonitorQualities };
                                delete newQualities[m.index];
                                updateDraft({ screenshotMonitorQualities: newQualities });
                              }}
                              className="text-xs text-kovy-text-dim hover:text-kovy-text"
                            >
                              reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SettingRow>
          </>
        )}
        <SwitchSetting
          label="Include foreground app info"
          description="Send the active window's process name and title (truncated) for context"
          checked={config.includeForegroundApp}
          onChange={(v) => updateDraft({ includeForegroundApp: v })}
        />
      </SettingSection>

      <SettingSection title="Request Behavior">
        <SliderSetting
          label="Insta-send cooldown"
          description="Minimum seconds between Ask Kovy triggers"
          value={config.instaSendCooldownSec}
          min={1}
          max={60}
          step={1}
          onChange={(v) => updateDraft({ instaSendCooldownSec: Math.round(v) })}
          displayValue={`${config.instaSendCooldownSec}s`}
        />
        <SliderSetting
          label="Request timeout"
          description="Seconds before an AI request times out"
          value={config.requestTimeoutSec}
          min={5}
          max={120}
          step={5}
          onChange={(v) => updateDraft({ requestTimeoutSec: Math.round(v) })}
          displayValue={`${config.requestTimeoutSec}s`}
        />
        <SliderSetting
          label="Max thought length"
          description="Maximum characters for AI-generated thoughts"
          value={config.maxThoughtChars}
          min={40}
          max={240}
          step={10}
          onChange={(v) => updateDraft({ maxThoughtChars: Math.round(v) })}
          displayValue={`${config.maxThoughtChars}`}
        />
        <SliderSetting
          label="Max whisper length"
          description="Maximum characters for AI-generated whispers"
          value={config.maxWhisperChars}
          min={40}
          max={320}
          step={10}
          onChange={(v) => updateDraft({ maxWhisperChars: Math.round(v) })}
          displayValue={`${config.maxWhisperChars}`}
        />
      </SettingSection>

      <SettingSection title="Periodic Insights">
        <SwitchSetting
          label="Enable periodic AI insights"
          description="Automatically request AI insights at regular intervals"
          checked={config.periodicEnabled}
          onChange={(v) => updateDraft({ periodicEnabled: v })}
        />
        {config.periodicEnabled && (
          <>
            <SliderSetting
              label="Interval"
              description="Seconds between periodic AI requests"
              value={config.periodicIntervalSec}
              min={30}
              max={3600}
              step={30}
              onChange={(v) => updateDraft({ periodicIntervalSec: Math.round(v) })}
              displayValue={`${Math.round(config.periodicIntervalSec / 60)}m`}
            />
            <SliderSetting
              label="Insight priority"
              description="How much priority periodic insights get over procedural thoughts (0-1)"
              value={config.periodicInsightPriority}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateDraft({ periodicInsightPriority: v })}
              displayValue={config.periodicInsightPriority.toFixed(2)}
            />
          </>
        )}
      </SettingSection>

      <SettingSection title="AI Activity Log">
        <div className="px-3 py-2 max-h-72 overflow-y-auto space-y-1.5">
          {aiEntries.length === 0 ? (
            <EmptyState
              icon="🤖"
              title="No AI insights yet"
              description="Use Ask Kovy or enable periodic insights to see AI-generated thoughts here."
            />
          ) : (
            aiEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-2 py-1.5 rounded-lg bg-kovy-surface-light/30 hover:bg-kovy-surface-light/50 transition-colors"
              >
                <span className="text-sm flex-shrink-0 mt-0.5">🤖</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-kovy-text">
                    {entry.metadata?.thoughtText as string ?? entry.title}
                  </div>
                  <div className="text-[10px] text-kovy-text-dim">
                    {entry.metadata?.source as string ?? "ask-kovy"} ·{" "}
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {Boolean(entry.metadata?.whisperText) && (
                    <div className="text-[10px] text-kovy-text-dim/80 mt-0.5 leading-relaxed">
                      {"💬 " + String(entry.metadata?.whisperText)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SettingSection>

      <InfoCard title="Privacy Guarantees" accent="green">
        <ul className="text-xs text-kovy-text-dim space-y-1">
          <li className="flex items-center gap-2">
            <Shield size={12} className="text-green-400" />
            API key stored in OS credential vault, never in config
          </li>
          <li className="flex items-center gap-2">
            <Shield size={12} className="text-green-400" />
            Screenshots only sent with explicit consent
          </li>
          <li className="flex items-center gap-2">
            <Shield size={12} className="text-green-400" />
            No data logged or persisted beyond the insight response
          </li>
          <li className="flex items-center gap-2">
            <Shield size={12} className="text-green-400" />
            All requests go through Rust backend, never from renderer
          </li>
          <li className="flex items-center gap-2">
            <Shield size={12} className="text-green-400" />
            AI is disabled by default — opt-in only
          </li>
        </ul>
      </InfoCard>
    </div>
  );
}
