import { SettingRow } from "./SettingRow";

interface SliderSettingProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  displayValue?: string;
}

export function SliderSetting({
  label, description, value, min, max, step = 0.01, onChange, displayValue,
}: SliderSettingProps) {
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={label}
          aria-valuetext={displayValue ?? value.toFixed(step >= 1 ? 0 : 2)}
          className="w-36 h-1.5 bg-kovy-bg rounded-full appearance-none cursor-pointer kovy-focus-ring
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-kovy-accent [&::-webkit-slider-thumb]:shadow-glow
                     [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                     [&::-webkit-slider-thumb]:focus-visible:ring-2 [&::-webkit-slider-thumb]:focus-visible:ring-kovy-accent/50
                     hover:[&::-webkit-slider-thumb]:bg-kovy-accent-light
                     hover:[&::-webkit-slider-thumb]:scale-110"
        />
        <span className="text-xs text-kovy-text-muted w-12 text-right font-mono">
          {displayValue ?? value.toFixed(step >= 1 ? 0 : 2)}
        </span>
      </div>
    </SettingRow>
  );
}
