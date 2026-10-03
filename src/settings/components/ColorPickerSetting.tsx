import { useState, useCallback, useRef, useEffect } from "react";
import { normalizeHex, isValidHex } from "@/lib/colorUtils";

interface ColorPickerSettingProps {
  label: string;
  description?: string;
  value: string; // hex "#rrggbb"
  onChange: (hex: string) => void;
  disabled?: boolean;
}

export function ColorPickerSetting({ label, description, value, onChange, disabled }: ColorPickerSettingProps) {
  const [hexInput, setHexInput] = useState(value);
  const [eyeDropperSupported] = useState(() => typeof window !== "undefined" && "EyeDropper" in window);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexSubmit = useCallback(() => {
    const normalized = normalizeHex(hexInput);
    if (normalized) {
      onChange(normalized);
    } else {
      setHexInput(value);
    }
  }, [hexInput, value, onChange]);

  const handleNativeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeHex(e.target.value);
    if (normalized) {
      onChange(normalized);
      setHexInput(normalized);
    }
  }, [onChange]);

  const handleEyeDropper = useCallback(async () => {
    try {
      const dropper = new (window.EyeDropper!)();
      const result = await dropper.open();
      const normalized = normalizeHex(result.sRGBHex);
      if (normalized) {
        onChange(normalized);
        setHexInput(normalized);
      }
    } catch {
      // User cancelled or API unavailable
    }
  }, [onChange]);

  const isValid = isValidHex(hexInput);

  return (
    <div className={`flex items-center justify-between gap-4 py-3 px-1 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-kovy-text">{label}</div>
        {description && (
          <div className="text-xs text-kovy-text-dim mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Color swatch — opens native picker on click */}
        <button
          onClick={() => nativePickerRef.current?.click()}
          className="w-7 h-7 rounded-md border border-kovy-border/40 cursor-pointer transition-shadow hover:shadow-glow flex-shrink-0"
          style={{ backgroundColor: value }}
          title="Click to open color picker"
        />
        <input
          ref={nativePickerRef}
          type="color"
          value={value}
          onChange={handleNativeChange}
          className="sr-only"
          tabIndex={-1}
        />

        {/* Hex input */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => { if (e.key === "Enter") handleHexSubmit(); }}
          className={`kovy-input text-xs w-[5.5rem] font-mono ${!isValid && hexInput !== value ? "border-red-500/60" : ""}`}
          placeholder="#5577cc"
          maxLength={7}
        />

        {/* Eyedropper button */}
        {eyeDropperSupported && (
          <button
            onClick={handleEyeDropper}
            className="kovy-btn-ghost text-xs px-1.5 py-1 text-kovy-text-dim hover:text-kovy-accent"
            title="Pick color from screen"
          >
            💧
          </button>
        )}
      </div>
    </div>
  );
}
