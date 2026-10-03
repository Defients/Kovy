import type { SurfaceMood } from "@/store/types";
import { getMoodColor, getMoodModifiers } from "@/engine/moodEngine";
import { hexToHsl } from "@/lib/colorUtils";
import type { KovyRenderState } from "../KovyCharacter";

export function lightenHSL(hsl: string, amount: number): string {
  const match = hsl.match(/hsl[a]?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
  if (!match) return hsl;
  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]);
  const l = Math.min(95, parseFloat(match[3]) + amount);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function darkenHSL(hsl: string, amount: number): string {
  const match = hsl.match(/hsl[a]?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
  if (!match) return hsl;
  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]);
  const l = Math.max(5, parseFloat(match[3]) - amount);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function shiftHSLHue(hsl: string, offset: number): string {
  const match = hsl.match(/hsl[a]?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
  if (!match) return hsl;
  const h = (parseFloat(match[1]) + offset + 360) % 360;
  const s = parseFloat(match[2]);
  const l = parseFloat(match[3]);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function lerpHSL(from: string, to: string, t: number): string {
  const parseHSL = (hsl: string): [number, number, number] | null => {
    const m = hsl.match(/hsl[a]?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
    return m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])] : null;
  };
  const f = parseHSL(from);
  const o = parseHSL(to);
  if (!f || !o) return t < 0.5 ? from : to;
  const dh = ((o[0] - f[0] + 540) % 360) - 180;
  const h = ((f[0] + dh * t) + 360) % 360;
  const s = f[1] + (o[1] - f[1]) * t;
  const l = f[2] + (o[2] - f[2]) * t;
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

export class ColorTransitionManager {
  private prevMoodColor: string = "hsl(210, 50%, 55%)";
  private currentMoodColor: string = "hsl(210, 50%, 55%)";
  private colorTransition: number = 1;

  update(state: KovyRenderState, dt: number, moodColorShift: boolean): void {
    let targetColor: string;

    if (state.customColorsEnabled && state.primaryColor) {
      const [h, s, l] = hexToHsl(state.primaryColor);
      if (state.moodToColor && moodColorShift) {
        const mods = getMoodModifiers(state.surfaceMood);
        const moodHueShift = (mods.colorHue - 210) * 0.15;
        targetColor = `hsl(${Math.round((h + moodHueShift + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
      } else {
        targetColor = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
      }
    } else if (state.moodToColor && moodColorShift) {
      targetColor = getMoodColor(state.surfaceMood, state.glowPulse);
    } else {
      targetColor = "hsl(220, 55%, 58%)";
    }

    if (targetColor !== this.currentMoodColor) {
      this.prevMoodColor = this.currentMoodColor;
      this.currentMoodColor = targetColor;
      this.colorTransition = 0;
    }

    this.colorTransition = Math.min(1, this.colorTransition + dt * 0.8);
  }

  getBlendedMoodColor(hueOff: number = 0): string {
    const blended = this.colorTransition < 1
      ? lerpHSL(this.prevMoodColor, this.currentMoodColor, this.colorTransition)
      : this.currentMoodColor;
    return hueOff !== 0 ? shiftHSLHue(blended, hueOff) : blended;
  }

  get currentColor(): string {
    return this.currentMoodColor;
  }

  get prevColor(): string {
    return this.prevMoodColor;
  }

  get transitionProgress(): number {
    return this.colorTransition;
  }
}
