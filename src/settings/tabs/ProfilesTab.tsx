import { useState } from "react";
import { useConfigStore } from "@/store/configStore";
import { SettingSection } from "../components/SettingRow";
import { InfoCard } from "../components/InfoCard";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ProfilesEngine } from "@/engine/profilesEngine";
import { createAutoSwitchRule } from "@/engine/profileAutoSwitchEngine";
import type { SavedProfile, AutoSwitchRule, AutoSwitchRuleType } from "@/store/types";

export function ProfilesTab() {
  const config = useConfigStore((s) => s.draftConfig.profiles);
  const update = useConfigStore((s) => s.updateDraftProfiles);
  const resetSection = useConfigStore((s) => s.resetSection);
  const draftConfig = useConfigStore((s) => s.draftConfig);

  const [engine] = useState(() => {
    const eng = new ProfilesEngine();
    eng.seedDefaultProfiles();
    return eng;
  });
  const [profileName, setProfileName] = useState("");
  const [profileIcon, setProfileIcon] = useState("⭐");
  const [, forceUpdate] = useState(0);
  const [loadTarget, setLoadTarget] = useState<SavedProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // --- Auto-switch rule editor state ---
  const [ruleType, setRuleType] = useState<AutoSwitchRuleType>("time");
  const [ruleCondition, setRuleCondition] = useState("09:00");
  const [ruleProfileId, setRuleProfileId] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<{ id: string; reason: string } | null>(null);

  const handleSave = () => {
    if (!profileName.trim()) return;
    engine.saveProfile(profileName.trim(), profileIcon, draftConfig);
    setProfileName("");
    setProfileIcon("⭐");
    update({ savedProfiles: engine.update(config).savedProfiles });
    forceUpdate((n) => n + 1);
  };

  const handleDelete = (id: string) => {
    engine.deleteProfile(id);
    update({ savedProfiles: engine.update(config).savedProfiles });
    forceUpdate((n) => n + 1);
  };

  const handleLoad = (profile: SavedProfile) => {
    useConfigStore.setState({ draftConfig: { ...profile.config } });
    forceUpdate((n) => n + 1);
  };

  const handleSwitch = (id: string) => {
    engine.setActiveProfile(id);
    update({ activeProfileId: id });
    forceUpdate((n) => n + 1);
  };

  // --- Auto-switch rule handlers ---
  const handleSaveRule = () => {
    if (!ruleProfileId || !ruleCondition.trim()) return;
    const rules = [...config.autoSwitchRules];
    if (editingRuleId) {
      const idx = rules.findIndex((r) => r.id === editingRuleId);
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], type: ruleType, condition: ruleCondition.trim(), profileId: ruleProfileId };
      }
    } else {
      rules.push(createAutoSwitchRule(ruleType, ruleCondition.trim(), ruleProfileId));
    }
    update({ ...config, autoSwitchRules: rules });
    setEditingRuleId(null);
    setRuleCondition("09:00");
    setRuleProfileId("");
  };

  const handleEditRule = (rule: AutoSwitchRule) => {
    setEditingRuleId(rule.id);
    setRuleType(rule.type);
    setRuleCondition(rule.condition);
    setRuleProfileId(rule.profileId);
  };

  const handleDeleteRule = (id: string) => {
    const rules = config.autoSwitchRules.filter((r) => r.id !== id);
    update({ ...config, autoSwitchRules: rules });
    if (editingRuleId === id) {
      setEditingRuleId(null);
      setRuleCondition("09:00");
      setRuleProfileId("");
    }
  };

  const handleToggleRule = (id: string) => {
    const rules = config.autoSwitchRules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    update({ ...config, autoSwitchRules: rules });
  };

  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setRuleCondition("09:00");
    setRuleProfileId("");
  };

  return (
    <div className="space-y-2">
      <InfoCard title="Config Profiles" accent="violet">
        Save and switch between configuration presets. Quick-switch via hotkey or tray menu.
        Profiles store a full snapshot of your settings.
      </InfoCard>

      <SettingSection title="Save Current Config as Profile">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Profile name..."
            className="flex-1 bg-kovy-surface/50 border border-kovy-border/30 rounded px-3 py-1.5 text-sm text-kovy-text placeholder:text-kovy-text-dim/40 focus:border-kovy-accent/40 focus:outline-none"
          />
          <select
            value={profileIcon}
            onChange={(e) => setProfileIcon(e.target.value)}
            className="bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
          >
            {["⭐","🌙","🎮","💼","🎨","🎵","🔥","❄️","🌿","⚡"].map((icon) => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={!profileName.trim()}
            className="px-3 py-1.5 rounded text-sm font-medium bg-kovy-accent/20 text-kovy-accent border border-kovy-accent/40 hover:bg-kovy-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </SettingSection>

      <SettingSection title="Saved Profiles">
        {config.savedProfiles.length === 0 ? (
          <EmptyState
            icon="🗂"
            title="No saved profiles yet"
            description="Save your current config above to create a profile snapshot."
          />
        ) : (
          <div className="space-y-1.5">
            {config.savedProfiles.map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center gap-3 p-2.5 rounded border transition-colors ${
                  config.activeProfileId === profile.id
                    ? "bg-kovy-accent/10 border-kovy-accent/30"
                    : "bg-kovy-surface/40 border-kovy-border/20"
                }`}
              >
                <span className="text-lg">{profile.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-kovy-text truncate">{profile.name}</div>
                  <div className="text-xs text-kovy-text-dim/50">
                    {new Date(profile.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleSwitch(profile.id)}
                  className="text-xs px-2 py-1 rounded text-kovy-accent hover:bg-kovy-accent/10 transition-colors kovy-focus-ring"
                >
                  {config.activeProfileId === profile.id ? "✓ Active" : "Set Active"}
                </button>
                <button
                  onClick={() => setLoadTarget(profile)}
                  className="text-xs px-2 py-1 rounded text-kovy-text-dim hover:bg-kovy-surface/60 transition-colors kovy-focus-ring"
                >
                  Load
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: profile.id, name: profile.name })}
                  className="text-xs px-2 py-1 rounded text-red-400/70 hover:bg-red-400/10 transition-colors kovy-focus-ring"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingSection>

      <SettingSection title="Auto-Switch Rules">
        <p className="text-xs text-kovy-text-dim/60 mb-2">
          Automatically switch profiles based on time of day, active app, or idle duration.
          Rules are evaluated every 10 seconds when the overlay is running.
        </p>

        {/* Rule editor form */}
        <div className="bg-kovy-surface/40 border border-kovy-border/20 rounded p-3 space-y-2 mb-3">
          <div className="text-xs font-medium text-kovy-text-dim">
            {editingRuleId ? "Edit Rule" : "Add New Rule"}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={ruleType}
              onChange={(e) => {
                const t = e.target.value as AutoSwitchRuleType;
                setRuleType(t);
                if (t === "time") setRuleCondition("09:00");
                else if (t === "idle") setRuleCondition("600");
                else setRuleCondition("");
              }}
              className="bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
            >
              <option value="time">Time of day</option>
              <option value="app">Active app</option>
              <option value="idle">Idle duration</option>
            </select>

            {ruleType === "time" ? (
              <input
                type="time"
                value={ruleCondition}
                onChange={(e) => setRuleCondition(e.target.value)}
                className="bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
              />
            ) : ruleType === "idle" ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={ruleCondition}
                  onChange={(e) => setRuleCondition(e.target.value)}
                  placeholder="600"
                  className="w-20 bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
                />
                <span className="text-xs text-kovy-text-dim/50">seconds</span>
              </div>
            ) : (
              <input
                type="text"
                value={ruleCondition}
                onChange={(e) => setRuleCondition(e.target.value)}
                placeholder="e.g. chrome, code, steam"
                className="flex-1 min-w-[120px] bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text placeholder:text-kovy-text-dim/40"
              />
            )}

            <select
              value={ruleProfileId}
              onChange={(e) => setRuleProfileId(e.target.value)}
              className="bg-kovy-surface/50 border border-kovy-border/30 rounded px-2 py-1.5 text-sm text-kovy-text"
            >
              <option value="">Select profile...</option>
              {config.savedProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>

            <button
              onClick={handleSaveRule}
              disabled={!ruleProfileId || !ruleCondition.trim()}
              className="px-3 py-1.5 rounded text-sm font-medium bg-kovy-accent/20 text-kovy-accent border border-kovy-accent/40 hover:bg-kovy-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editingRuleId ? "Update" : "Add"}
            </button>
            {editingRuleId && (
              <button
                onClick={handleCancelEditRule}
                className="px-2 py-1.5 rounded text-sm text-kovy-text-dim hover:bg-kovy-surface/60 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Rule list */}
        {config.autoSwitchRules.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No auto-switch rules"
            description="Add a rule above to automatically switch profiles based on time, app, or idle."
          />
        ) : (
          <div className="space-y-1.5">
            {config.autoSwitchRules.map((rule) => {
              const targetProfile = config.savedProfiles.find((p) => p.id === rule.profileId);
              return (
                <div
                  key={rule.id}
                  className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                    rule.enabled
                      ? "bg-kovy-surface/40 border-kovy-border/20"
                      : "bg-kovy-surface/20 border-kovy-border/10 opacity-60"
                  }`}
                >
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${
                      rule.enabled ? "bg-kovy-accent/60" : "bg-kovy-border/40"
                    }`}
                    title={rule.enabled ? "Enabled" : "Disabled"}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        rule.enabled ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-kovy-text">
                      <span className="font-medium">{ruleTypeLabel(rule.type)}</span>
                      <span className="text-kovy-text-dim/60"> → </span>
                      <span>{targetProfile ? `${targetProfile.icon} ${targetProfile.name}` : "⚠ missing profile"}</span>
                    </div>
                    <div className="text-xs text-kovy-text-dim/50">
                      {ruleTypeConditionLabel(rule.type, rule.condition)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="text-xs px-2 py-1 rounded text-kovy-text-dim hover:bg-kovy-surface/60 transition-colors kovy-focus-ring"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteRuleTarget({ id: rule.id, reason: ruleTypeConditionLabel(rule.type, rule.condition) })}
                    className="text-xs px-2 py-1 rounded text-red-400/70 hover:bg-red-400/10 transition-colors kovy-focus-ring"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingSection>

      <SettingSection title="Hotkey Swap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.hotkeySwap}
            onChange={(e) => update({ hotkeySwap: e.target.checked })}
            className="accent-kovy-accent"
          />
          <span className="text-sm text-kovy-text-dim">Enable hotkey cycling through profiles</span>
        </label>
      </SettingSection>

      <button
        onClick={() => resetSection("profiles")}
        className="text-xs text-kovy-text-dim/60 hover:text-kovy-text-dim transition-colors kovy-focus-ring"
      >
        Reset to defaults
      </button>

      <ConfirmModal
        isOpen={loadTarget !== null}
        title="Load Profile"
        message={`Load profile "${loadTarget?.name}"? This will replace your current settings.`}
        confirmText="Load"
        onConfirm={() => {
          if (loadTarget) handleLoad(loadTarget);
          setLoadTarget(null);
        }}
        onCancel={() => setLoadTarget(null)}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Profile"
        message={`Delete profile "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={deleteRuleTarget !== null}
        title="Delete Rule"
        message={`Delete auto-switch rule "${deleteRuleTarget?.reason}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        onConfirm={() => {
          if (deleteRuleTarget) handleDeleteRule(deleteRuleTarget.id);
          setDeleteRuleTarget(null);
        }}
        onCancel={() => setDeleteRuleTarget(null)}
      />
    </div>
  );
}

// --- Helper labels for auto-switch rules ---

function ruleTypeLabel(type: AutoSwitchRuleType): string {
  switch (type) {
    case "time": return "⏰ Time";
    case "app": return "🖥 App";
    case "idle": return "😴 Idle";
  }
}

function ruleTypeConditionLabel(type: AutoSwitchRuleType, condition: string): string {
  switch (type) {
    case "time":
      return `At ${condition}`;
    case "app":
      return `When ${condition} is active`;
    case "idle": {
      const secs = parseInt(condition, 10);
      if (isNaN(secs)) return `Idle ${condition}s`;
      if (secs >= 60) return `Idle ${Math.floor(secs / 60)}m ${secs % 60}s`;
      return `Idle ${secs}s`;
    }
  }
}
