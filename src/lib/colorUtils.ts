// ============================================================
// Color utilities — hex validation, HSL conversion, blending
// No external dependencies, pure functions
// ============================================================

const HEX6_RE = /^#?([0-9a-fA-F]{6})$/;
const HEX3_RE = /^#?([0-9a-fA-F]{3})$/;

/** Validate and normalize a hex color string to "#rrggbb" format */
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const match6 = trimmed.match(HEX6_RE);
  if (match6) return `#${match6[1].toLowerCase()}`;
  const match3 = trimmed.match(HEX3_RE);
  if (match3) {
    const [r, g, b] = match3[1].toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Check if a string is a valid hex color (3 or 6 digit) */
export function isValidHex(input: string): boolean {
  const trimmed = input.trim();
  return HEX6_RE.test(trimmed) || HEX3_RE.test(trimmed);
}

/** Parse hex "#rrggbb" to [r, g, b] (0-255) */
export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex);
  if (!n) return [85, 119, 204]; // fallback
  const v = parseInt(n.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** Convert [r, g, b] (0-255) to "#rrggbb" */
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Convert hex to HSL [h (0-360), s (0-1), l (0-1)] */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h * 360, s, l];
}

/** Convert HSL [h (0-360), s (0-1), l (0-1)] to hex */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Shift a hex color's hue by degrees */
export function shiftHexHue(hex: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + degrees, s, l);
}

/** Modulate a hex color toward a mood-derived HSL shift */
export function modulateColor(
  baseHex: string,
  hueShift: number,
  saturationMult: number,
  lightnessMult: number
): string {
  const [h, s, l] = hexToHsl(baseHex);
  return hslToHex(
    h + hueShift,
    Math.max(0, Math.min(1, s * saturationMult)),
    Math.max(0.05, Math.min(0.95, l * lightnessMult))
  );
}

/** Blend two hex colors by t (0 = a, 1 = b) */
export function blendHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (v1: number, v2: number) => v1 + (v2 - v1) * t;
  return rgbToHex(mix(r1, r2), mix(g1, g2), mix(b1, b2));
}

/** Convert hex to CSS rgba string with alpha */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Convert hex to CSS HSL string for use in canvas rendering */
export function hexToHslString(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
