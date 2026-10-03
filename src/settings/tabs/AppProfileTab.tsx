import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { SwitchSetting } from "../components/SwitchSetting";
import { SliderSetting } from "../components/SliderSetting";
import { InfoCard } from "../components/InfoCard";
import { BUILTIN_APP_PROFILES } from "@/engine/appProfileEngine";

export function AppProfileTab() {
  const config = useConfigStore((s) => s.draftConfig.appProfile);
  const update = useConfigStore((s) => s.updateDraftAppProfile);
  const resetSection = useConfigStore((s) => s.resetSection);

  const [editingId, setEditingId] = useState<string | null>(null);

  const allProfiles = [...BUILTIN_APP_PROFILES, ...config.profiles];

  const addProfile = () => {
    const newProfile = {
      id: `custom-${Date.now()}`,
      name: "New Profile",
      icon: "📦",
      matchType: "exe" as const,
      matchPattern: "",
      overrides: {},
      enabled: true,
    };
    update({ profiles: [...config.profiles, newProfile] });
    setEditingId(newProfile.id);
  };

  const updateProfile = (id: string, patch: Partial<typeof config.profiles[0]>) => {
    update({
      profiles: config.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const removeProfile = (id: string) => {
    update({ profiles: config.profiles.filter((p) => p.id !== id) });
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="space-y-2">
      <InfoCard title="App Profiles" accent="blue">
        App profiles let Kovy adapt its behavior when specific applications are in the
        foreground. Match by process name, window title, or window class. Override
        behavior preset, visual style, opacity, audio, and more. All detection is local.
      </InfoCard>

      <SettingSection title="Enable" onReset={() => resetSection("appProfile")}>
        <SwitchSetting
          label="App profiles enabled"
          description="Detect foreground app and apply matching profile overrides"
          checked={config.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <SwitchSetting
          label="Auto-detect foreground app"
          description="Automatically poll the foreground window every few seconds"
          checked={config.autoDetect}
          onChange={(v) => update({ autoDetect: v })}
        />
      </SettingSection>

      {config.enabled && (
        <>
          <SettingSection title="Profiles">
            <div className="px-3 py-2 space-y-1.5">
              {allProfiles.map((profile) => {
                const isBuiltin = BUILTIN_APP_PROFILES.some((b) => b.id === profile.id);
                const isEditing = editingId === profile.id;
                return (
                  <div key={profile.id} className="rounded-lg border border-kovy-border/30 bg-kovy-surface-light/20">
                    <div
                      className="flex items-center gap-3 p-2 cursor-pointer"
                      onClick={() => setEditingId(isEditing ? null : profile.id)}
                    >
                      <span className="text-base flex-shrink-0">{profile.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-kovy-text">{profile.name}</div>
                        <div className="text-[10px] text-kovy-text-dim truncate">
                          {profile.matchType}: {profile.matchPattern || "(not set)"}
                        </div>
                      </div>
                      {!isBuiltin && (
                        <SwitchSetting
                          label=""
                          checked={profile.enabled}
                          onChange={(v) => updateProfile(profile.id, { enabled: v })}
                        />
                      )}
                      <span className="text-[10px] text-kovy-text-dim flex-shrink-0">
                        {isBuiltin ? "Built-in" : ""}
                      </span>
                    </div>

                    {isEditing && !isBuiltin && (
                      <div className="px-3 pb-3 pt-1 border-t border-kovy-border/20 space-y-2">
                        <div>
                          <label className="text-[10px] text-kovy-text-dim block mb-1">Name</label>
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
                            className="kovy-input w-full text-xs py-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-kovy-text-dim block mb-1">Icon</label>
                          <input
                            type="text"
                            value={profile.icon}
                            onChange={(e) => updateProfile(profile.id, { icon: e.target.value })}
                            className="kovy-input w-full text-xs py-1"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-kovy-text-dim block mb-1">Match Type</label>
                          <select
                            value={profile.matchType}
                            onChange={(e) => updateProfile(profile.id, { matchType: e.target.value as "exe" | "title" | "class" })}
                            className="kovy-input w-full text-xs py-1"
                          >
                            <option value="exe">Process Name (exe)</option>
                            <option value="title">Window Title</option>
                            <option value="class">Window Class</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-kovy-text-dim block mb-1">Match Pattern</label>
                          <input
                            type="text"
                            value={profile.matchPattern}
                            onChange={(e) => updateProfile(profile.id, { matchPattern: e.target.value })}
                            className="kovy-input w-full text-xs py-1"
                            placeholder="e.g. chrome.exe, *game*, etc."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-kovy-text-dim block mb-1">Overrides</label>
                          <div className="space-y-1">
                            <SwitchSetting
                              label="Hide Kovy"
                              checked={profile.overrides.hideKovy ?? false}
                              onChange={(v) => updateProfile(profile.id, { overrides: { ...profile.overrides, hideKovy: v } })}
                            />
                            <SwitchSetting
                              label="Gaming mode"
                              checked={profile.overrides.gamingMode ?? false}
                              onChange={(v) => updateProfile(profile.id, { overrides: { ...profile.overrides, gamingMode: v } })}
                            />
                            <SwitchSetting
                              label="Reduced motion"
                              checked={profile.overrides.reducedMotion ?? false}
                              onChange={(v) => updateProfile(profile.id, { overrides: { ...profile.overrides, reducedMotion: v } })}
                            />
                            <SwitchSetting
                              label="Disable audio"
                              checked={profile.overrides.audioEnabled === false}
                              onChange={(v) => updateProfile(profile.id, { overrides: { ...profile.overrides, audioEnabled: !v } })}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeProfile(profile.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Delete profile
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={addProfile}
                className="w-full text-xs text-kovy-accent hover:text-kovy-accent-light py-2 border border-dashed border-kovy-border/40 rounded-lg"
              >
                + Add Profile
              </button>
            </div>
          </SettingSection>
        </>
      )}
    </div>
  );
}
