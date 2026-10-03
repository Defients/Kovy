import { useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle, XCircle, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/store/configStore";
import {
  getDiagnosticsSummary,
  isDiagnosticsEnabled,
  setDiagnosticsEnabled,
  exportDiagnosticsBundle,
  clearDiagnostics,
} from "@/engine/diagnosticsEngine";
import {
  getEngineHealthSummary,
  reenableAllEngines,
  type EngineHealth,
} from "@/engine/engineErrorBoundary";
import { CONFIG_VERSION } from "@/store/types";
import { KOVY_VERSION } from "@/lib/version";

export function DiagnosticsTab() {
  const config = useConfigStore((s) => s.appliedConfig);
  const [enabled, setEnabled] = useState(isDiagnosticsEnabled());
  const [summary, setSummary] = useState(getDiagnosticsSummary());
  const [engineHealth, setEngineHealth] = useState<EngineHealth[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSummary(getDiagnosticsSummary());
      setEngineHealth(getEngineHealthSummary().engines);
      setTick(t => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    setDiagnosticsEnabled(next);
  };

  const handleExport = () => {
    const bundle = exportDiagnosticsBundle(config);
    const blob = new Blob([bundle], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kovy-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearDiagnostics();
    setSummary(getDiagnosticsSummary());
  };

  const handleReenableAll = () => {
    reenableAllEngines();
    setEngineHealth(getEngineHealthSummary().engines);
  };

  const healthSummary = getEngineHealthSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-kovy-text">Diagnostics</h2>
          <p className="text-sm text-kovy-text/50">Local-only performance and health monitoring</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-kovy-text/70">Enable</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="accent-kovy-accent"
          />
        </label>
      </div>

      {/* System Info */}
      <div className="kovy-glass rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium text-kovy-text/80 flex items-center gap-2">
          <Activity size={16} /> System Info
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-kovy-text/50">Kovy Version</div>
          <div className="text-kovy-text">{KOVY_VERSION}</div>
          <div className="text-kovy-text/50">Config Version</div>
          <div className="text-kovy-text">{CONFIG_VERSION}</div>
          <div className="text-kovy-text/50">Diagnostics</div>
          <div className="text-kovy-text">{enabled ? "Active" : "Inactive"}</div>
        </div>
      </div>

      {/* Performance */}
      <div className="kovy-glass rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium text-kovy-text/80">Performance</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-kovy-accent">{summary.avgFps}</div>
            <div className="text-xs text-kovy-text/50">Avg FPS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-kovy-text">{summary.entryCount}</div>
            <div className="text-xs text-kovy-text/50">Entries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-kovy-text">{summary.behaviorChanges}</div>
            <div className="text-xs text-kovy-text/50">Behavior Changes/min</div>
          </div>
        </div>
      </div>

      {/* Engine Health */}
      <div className="kovy-glass rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-kovy-text/80">Engine Health</h3>
          <button
            onClick={handleReenableAll}
            className="text-xs text-kovy-accent hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} /> Re-enable All
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm mb-2">
          <div className="flex items-center gap-1.5 text-kovy-text/60">
            <CheckCircle size={14} className="text-green-400" /> {healthSummary.healthy} Healthy
          </div>
          <div className="flex items-center gap-1.5 text-kovy-text/60">
            <AlertTriangle size={14} className="text-yellow-400" /> {healthSummary.degraded} Degraded
          </div>
          <div className="flex items-center gap-1.5 text-kovy-text/60">
            <XCircle size={14} className="text-red-400" /> {healthSummary.disabled} Disabled
          </div>
        </div>
        {engineHealth.length === 0 ? (
          <div className="text-sm text-kovy-text/40 py-2">No engines tracked yet.</div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {engineHealth.map((h) => (
              <div key={h.name} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-kovy-border/20">
                <span className="text-kovy-text/70">{h.name}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    h.status === "healthy" && "bg-green-400/20 text-green-400",
                    h.status === "degraded" && "bg-yellow-400/20 text-yellow-400",
                    h.status === "disabled" && "bg-red-400/20 text-red-400",
                  )}>
                    {h.status}
                  </span>
                  {h.consecutiveFailures > 0 && (
                    <span className="text-xs text-kovy-text/40">{h.consecutiveFailures} fails</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleExport}
          disabled={!enabled}
          className="flex items-center gap-2 px-4 py-2 kovy-glass rounded-lg text-sm text-kovy-text hover:bg-kovy-border/30 disabled:opacity-40 transition-colors"
        >
          <Download size={16} /> Export Diagnostics
        </button>
        <button
          onClick={handleClear}
          disabled={!enabled}
          className="flex items-center gap-2 px-4 py-2 kovy-glass rounded-lg text-sm text-kovy-text hover:bg-kovy-border/30 disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={16} /> Clear Data
        </button>
      </div>

      <p className="text-xs text-kovy-text/40">
        All diagnostics data is stored locally. No screenshots, OCR text, cursor positions,
        window titles, or personally identifiable information are collected.
      </p>
    </div>
  );
}
