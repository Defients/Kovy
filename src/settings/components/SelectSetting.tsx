import { SettingRow } from "./SettingRow";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectSettingProps {
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectSetting({ label, description, value, options, onChange }: SelectSettingProps) {
  return (
    <SettingRow label={label} description={description}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="kovy-input w-36 text-xs"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}
