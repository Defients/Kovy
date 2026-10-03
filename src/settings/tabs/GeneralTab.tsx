import { useState, useEffect } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection, SettingRow } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SelectSetting } from "../components/SelectSetting";
import { useEntityStore, notifyEntitySync } from "@/store/entityStore";
import type { DisplayMonitor } from "@/store/types";

interface MonitorInfo {
  name: string | null;
  size: { width: number; height: number };
  position: { x: number; y: number };
}

export function GeneralTab() {
  const config = useConfigStore((s) => s.draftConfig.general);
  const update = useConfigStore((s) => s.updateDraftGeneral);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    async function loadMonitors() {
      try {
        const { availableMonitors } = await import("@tauri-apps/api/window");
        const mons = await availableMonitors();
        setMonitors(mons);
      } catch (e) {
        console.log("Not in Tauri, skipping monitor detection", e);
      }
    }
    loadMonitors();
  }, []);

  const handleAutostartChange = (enabled: boolean) => {
    update({ launchAtStartup: enabled });
  };

  const handleBulkMoveAll = (target: DisplayMonitor) => {
    const store = useEntityStore.getState();
    const all = store.getAllEntities();
    for (const entity of all) {
      store.setEntityDisplayMonitor(entity.meta.id, target);
    }
    notifyEntitySync();
  };

  return (
    <div className="space-y-2">
      <SettingSection title="Startup" onReset={() => resetSection("general")}>
        <SwitchSetting
          label="Launch at startup"
          description="Start Kovy automatically when you log in"
          checked={config.launchAtStartup}
          onChange={handleAutostartChange}
        />
        <SwitchSetting
          label="Start minimized to tray"
          description="Kovy starts hidden in the system tray"
          checked={config.startMinimized}
          onChange={(v) => update({ startMinimized: v })}
        />
      </SettingSection>

      <SettingSection title="Capture Monitor">
        <SelectSetting
          label="Motion analysis source"
          description="Which monitor is captured for motion analysis"
          value={config.monitorMode}
          options={[
            { value: "primary", label: "Primary monitor" },
            { value: "current", label: "Current monitor (follow cursor)" },
            { value: "all", label: "All monitors (stitched)" },
            ...monitors.map((m, i) => ({
              value: m.name ?? `monitor_${i}`,
              label: m.name ?? `Monitor ${i + 1} (${m.size.width}x${m.size.height})`,
            })),
          ]}
          onChange={(v) => update({ monitorMode: v })}
        />
        <p className="text-[10px] text-kovy-text-dim px-1 py-1">
          This controls which monitor is captured for motion analysis only. Entity display
          positions are independent — each entity can be assigned to any monitor via the
          Family tab, or left free to roam all monitors.
        </p>
      </SettingSection>

      <SettingSection title="Entity Display">
        <p className="text-[10px] text-kovy-text-dim px-1 pb-2">
          The overlay spans all monitors. Entities can roam freely ("Global") or be pinned
          to a specific monitor. Per-entity assignment is in the Family tab.
        </p>
        <SettingRow label="Send all entities to" description="Move all Kovys to the same monitor">
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => handleBulkMoveAll("global")}
              className="kovy-btn-outline text-[10px] px-2 py-1"
            >
              Global (all monitors)
            </button>
            {monitors.map((m, i) => (
              <button
                key={i}
                onClick={() => handleBulkMoveAll(m.name ?? `monitor_${i}`)}
                className="kovy-btn-outline text-[10px] px-2 py-1"
              >
                {m.name ?? `Monitor ${i + 1}`}
              </button>
            ))}
          </div>
        </SettingRow>
        {monitors.length > 1 && (
          <p className="text-[10px] text-kovy-text-dim px-1 py-1">
            {monitors.length} monitors detected. Overlay window spans {monitors.reduce((a, m) => a + m.size.width, 0)}x{Math.max(...monitors.map(m => m.size.height))} virtual desktop.
          </p>
        )}
      </SettingSection>

      <SettingSection title="Stream Safety">
        <SwitchSetting
          label="Stream-safe mode"
          description="Suppresses emotes, sounds, and particle bursts. Reduces Kovy to calm idle behavior. Use when streaming or screen sharing."
          checked={config.streamSafe}
          onChange={(v) => update({ streamSafe: v })}
        />
      </SettingSection>
    </div>
  );
}
