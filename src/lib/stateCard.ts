// ============================================================
// State Card Export — generates a shareable image-like card
// showing Kovy's current state as a text summary
// ============================================================

import type { KovyConfig, SurfaceMood, BehaviorState, BondLevel } from "@/store/types";
import { getBondLevelLabel, getBondLevelIndex, getBondLevelCount } from "@/overlay/bondMeter";

export interface StateCardData {
  kovyName: string;
  bondLevel: BondLevel | null;
  totalInteractions: number;
  streakDays: number;
  milestonesUnlocked: number;
  totalMilestones: number;
  surfaceMood: SurfaceMood;
  behaviorState: BehaviorState;
  activeTimeHours: number;
  familyMembers: number;
  ritualsPerformed: number;
  journalEntries: number;
  kovyVersion: string;
  exportDate: string;
}

export function generateStateCardText(data: StateCardData): string {
  const lines: string[] = [];
  const date = new Date(data.exportDate).toLocaleDateString("en", {
    year: "numeric", month: "short", day: "numeric",
  });

  lines.push("╔══════════════════════════════╗");
  lines.push(`║  ${data.kovyName.padEnd(28)}║`);
  lines.push("╠══════════════════════════════╣");

  // Bond
  if (data.bondLevel) {
    const bondLabel = getBondLevelLabel(data.bondLevel);
    const bondIdx = getBondLevelIndex(data.bondLevel);
    const bondBar = "█".repeat(bondIdx + 1) + "░".repeat(getBondLevelCount() - bondIdx - 1);
    lines.push(`║  Bond: ${bondBar} ${bondLabel.padEnd(14)}║`);
  }

  // Mood
  lines.push(`║  Mood: ${(data.surfaceMood).padEnd(24)}║`);
  lines.push(`║  State: ${(data.behaviorState).padEnd(23)}║`);

  lines.push("╟──────────────────────────────╢");

  // Stats
  lines.push(`║  Active: ${(`${data.activeTimeHours.toFixed(1)}h`).padEnd(23)}║`);
  lines.push(`║  Interactions: ${String(data.totalInteractions).padEnd(17)}║`);
  lines.push(`║  Streak: ${`${data.streakDays}d`.padEnd(24)}║`);
  lines.push(`║  Milestones: ${`${data.milestonesUnlocked}/${data.totalMilestones}`.padEnd(18)}║`);
  lines.push(`║  Family: ${String(data.familyMembers).padEnd(23)}║`);
  lines.push(`║  Rituals: ${String(data.ritualsPerformed).padEnd(23)}║`);
  lines.push(`║  Journal: ${String(data.journalEntries).padEnd(22)}║`);

  lines.push("╟──────────────────────────────╢");
  lines.push(`║  Kovy v${data.kovyVersion.padEnd(22)}║`);
  lines.push(`║  ${date.padEnd(28)}║`);
  lines.push("╚══════════════════════════════╝");

  return lines.join("\n");
}

export function generateStateCardMarkdown(data: StateCardData): string {
  const bondLabel = data.bondLevel ? getBondLevelLabel(data.bondLevel) : "—";
  const date = new Date(data.exportDate).toLocaleDateString("en", {
    year: "numeric", month: "short", day: "numeric",
  });

  return `## ${data.kovyName}

| Stat | Value |
|------|-------|
| Bond | ${bondLabel} |
| Mood | ${data.surfaceMood} |
| State | ${data.behaviorState} |
| Active Time | ${data.activeTimeHours.toFixed(1)}h |
| Interactions | ${data.totalInteractions} |
| Streak | ${data.streakDays} days |
| Milestones | ${data.milestonesUnlocked}/${data.totalMilestones} |
| Family | ${data.familyMembers} |
| Rituals | ${data.ritualsPerformed} |
| Journal | ${data.journalEntries} entries |

*Kovy v${data.kovyVersion} · ${date}*`;
}

export function generateStateCardJSON(data: StateCardData): string {
  return JSON.stringify(data, null, 2);
}
