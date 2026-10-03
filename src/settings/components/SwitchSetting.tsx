import { SettingRow } from "./SettingRow";

interface SwitchSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SwitchSetting({ label, description, checked, onChange }: SwitchSettingProps) {
  return (
    <SettingRow label={label} description={description}>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-fast kovy-focus-ring ${
          checked ? "bg-kovy-accent shadow-glow" : "bg-kovy-surface-light"
        }`}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm"
          style={{ transform: checked ? "translateX(18px)" : "translateX(2px)", transition: "transform 200ms" }}
        />
      </button>
    </SettingRow>
  );
}
