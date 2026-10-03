// ============================================================
// Bond Legibility — bond level utility functions
//
// Provides bond level labels, ordering, and level-up detection.
// (The canvas-rendered bond meter widget was removed as dead code
//  — it was never composed into the render loop. The utility
//  functions below are still used by stateCard.ts and tests.)
// ============================================================

import type { BondLevel } from "@/store/types";

const LEVEL_ORDER: BondLevel[] = ["stranger", "acquaintance", "companion", "friend", "best_friend"];

const LEVEL_LABELS: Record<BondLevel, string> = {
  stranger: "Stranger",
  acquaintance: "Acquaintance",
  companion: "Companion",
  friend: "Friend",
  best_friend: "Best Friend",
};

// --- Bond level-up detection helper ---

export function detectBondLevelUp(
  prevLevel: BondLevel,
  newLevel: BondLevel,
): { fromLevel: BondLevel; toLevel: BondLevel } | null {
  const prevIdx = LEVEL_ORDER.indexOf(prevLevel);
  const newIdx = LEVEL_ORDER.indexOf(newLevel);
  if (newIdx > prevIdx) {
    return { fromLevel: prevLevel, toLevel: newLevel };
  }
  return null;
}

export function getBondLevelLabel(level: BondLevel): string {
  return LEVEL_LABELS[level] ?? level;
}

export function getBondLevelIndex(level: BondLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export function getBondLevelCount(): number {
  return LEVEL_ORDER.length;
}
