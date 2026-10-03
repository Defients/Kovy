// ============================================================
// Skin Packs — visual theme presets
//
// Replaces the single primary/secondary color system with
// themed skin packs that include colors, eye styles, body
// modifications, and particle effects.
// ============================================================

import type { EyeStyle, BodyStyle, ToneMode } from "@/store/types";

export type SkinPackId = string;

export interface SkinPack {
  id: SkinPackId;
  name: string;
  icon: string;
  description: string;
  primaryColor: string;
  secondaryColor: string | null;
  toneMode: ToneMode;
  eyeStyle: EyeStyle;
  bodyStyle: BodyStyle;
  glowColor: string;
  particleColor: string;
  rimLightColor: string;
  rimLightIntensity: number;
  builtin: boolean;
}

export const BUILTIN_SKIN_PACKS: SkinPack[] = [
  {
    id: "default",
    name: "Default",
    icon: "🔵",
    description: "Classic Kovy look",
    primaryColor: "#3b82f6",
    secondaryColor: "#60a5fa",
    toneMode: "dual",
    eyeStyle: "round",
    bodyStyle: "classic",
    glowColor: "rgba(59, 130, 246, 0.3)",
    particleColor: "rgba(96, 165, 250, 0.5)",
    rimLightColor: "rgba(147, 197, 253, 0.4)",
    rimLightIntensity: 0.3,
    builtin: true,
  },
  {
    id: "ember",
    name: "Ember",
    icon: "🔥",
    description: "Warm fire tones with golden glow",
    primaryColor: "#f97316",
    secondaryColor: "#fbbf24",
    toneMode: "dual",
    eyeStyle: "soft",
    bodyStyle: "blob",
    glowColor: "rgba(249, 115, 22, 0.4)",
    particleColor: "rgba(251, 191, 36, 0.5)",
    rimLightColor: "rgba(254, 215, 170, 0.5)",
    rimLightIntensity: 0.5,
    builtin: true,
  },
  {
    id: "forest",
    name: "Forest",
    icon: "🌿",
    description: "Natural green tones with earthy glow",
    primaryColor: "#22c55e",
    secondaryColor: "#16a34a",
    toneMode: "dual",
    eyeStyle: "round",
    bodyStyle: "blob",
    glowColor: "rgba(34, 197, 94, 0.3)",
    particleColor: "rgba(134, 239, 172, 0.4)",
    rimLightColor: "rgba(187, 247, 208, 0.4)",
    rimLightIntensity: 0.3,
    builtin: true,
  },
  {
    id: "lavender",
    name: "Lavender",
    icon: "💜",
    description: "Soft purple with dreamy glow",
    primaryColor: "#a855f7",
    secondaryColor: "#c084fc",
    toneMode: "dual",
    eyeStyle: "soft",
    bodyStyle: "blob",
    glowColor: "rgba(168, 85, 247, 0.35)",
    particleColor: "rgba(192, 132, 252, 0.4)",
    rimLightColor: "rgba(216, 180, 254, 0.5)",
    rimLightIntensity: 0.4,
    builtin: true,
  },
  {
    id: "rose",
    name: "Rose",
    icon: "🌹",
    description: "Romantic pink with warm undertones",
    primaryColor: "#ec4899",
    secondaryColor: "#f9a8d4",
    toneMode: "dual",
    eyeStyle: "soft",
    bodyStyle: "blob",
    glowColor: "rgba(236, 72, 153, 0.35)",
    particleColor: "rgba(249, 168, 212, 0.4)",
    rimLightColor: "rgba(251, 207, 232, 0.5)",
    rimLightIntensity: 0.4,
    builtin: true,
  },
  {
    id: "shadow",
    name: "Shadow",
    icon: "🌑",
    description: "Dark monochrome with subtle glow",
    primaryColor: "#475569",
    secondaryColor: null,
    toneMode: "single",
    eyeStyle: "narrow",
    bodyStyle: "blob",
    glowColor: "rgba(71, 85, 105, 0.3)",
    particleColor: "rgba(148, 163, 184, 0.3)",
    rimLightColor: "rgba(203, 213, 225, 0.3)",
    rimLightIntensity: 0.2,
    builtin: true,
  },
  {
    id: "aurora",
    name: "Aurora",
    icon: "🌌",
    description: "Shifting teal-cyan with vibrant glow",
    primaryColor: "#14b8a6",
    secondaryColor: "#06b6d4",
    toneMode: "dual",
    eyeStyle: "round",
    bodyStyle: "blob",
    glowColor: "rgba(20, 184, 166, 0.4)",
    particleColor: "rgba(45, 212, 191, 0.5)",
    rimLightColor: "rgba(153, 246, 228, 0.5)",
    rimLightIntensity: 0.5,
    builtin: true,
  },
  {
    id: "monochrome",
    name: "Monochrome",
    icon: "⚪",
    description: "Pure white with soft gray glow",
    primaryColor: "#f1f5f9",
    secondaryColor: "#cbd5e1",
    toneMode: "dual",
    eyeStyle: "dot",
    bodyStyle: "blob",
    glowColor: "rgba(241, 245, 249, 0.3)",
    particleColor: "rgba(203, 213, 225, 0.3)",
    rimLightColor: "rgba(255, 255, 255, 0.3)",
    rimLightIntensity: 0.3,
    builtin: true,
  },
];

export interface SkinPackState {
  activePackId: SkinPackId;
  customPacks: SkinPack[];
}

export function createDefaultSkinPackState(): SkinPackState {
  return {
    activePackId: "default",
    customPacks: [],
  };
}

export class SkinPackEngine {
  private state: SkinPackState;

  constructor(initialState?: SkinPackState) {
    this.state = initialState ?? createDefaultSkinPackState();
  }

  getState(): SkinPackState {
    return { ...this.state, customPacks: [...this.state.customPacks] };
  }

  getAllPacks(): SkinPack[] {
    return [...BUILTIN_SKIN_PACKS, ...this.state.customPacks];
  }

  getActivePack(): SkinPack {
    const all = this.getAllPacks();
    return all.find(p => p.id === this.state.activePackId) ?? BUILTIN_SKIN_PACKS[0];
  }

  setActivePack(id: SkinPackId): boolean {
    const all = this.getAllPacks();
    if (!all.some(p => p.id === id)) return false;
    this.state.activePackId = id;
    return true;
  }

  addCustomPack(pack: SkinPack): void {
    this.state.customPacks.push({ ...pack, builtin: false });
  }

  removeCustomPack(id: SkinPackId): boolean {
    const idx = this.state.customPacks.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.state.customPacks.splice(idx, 1);
    if (this.state.activePackId === id) {
      this.state.activePackId = "default";
    }
    return true;
  }

  getBuiltinPacks(): SkinPack[] {
    return [...BUILTIN_SKIN_PACKS];
  }

  getCustomPacks(): SkinPack[] {
    return [...this.state.customPacks];
  }

  loadCustomPacks(packs: SkinPack[]): void {
    this.state.customPacks = packs.map(p => ({ ...p, builtin: false }));
  }

  reset(): void {
    this.state = createDefaultSkinPackState();
  }
}
