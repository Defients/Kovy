// ============================================================
// Profile Auto-Switch Engine — evaluates rules to automatically
// switch between saved profiles based on time, active app, or
// idle duration. All checks are local.
// ============================================================

import type { AutoSwitchRule, AutoSwitchRuleType } from "@/store/types";

export interface AutoSwitchContext {
  currentTime: Date;
  activeAppName: string | null;
  idleSeconds: number;
}

export interface AutoSwitchResult {
  matchedRule: AutoSwitchRule | null;
  profileId: string | null;
  reason: string | null;
}

export function evaluateAutoSwitchRules(
  rules: AutoSwitchRule[],
  context: AutoSwitchContext,
): AutoSwitchResult {
  const enabledRules = rules.filter(r => r.enabled);
  
  for (const rule of enabledRules) {
    if (matchesRule(rule, context)) {
      return {
        matchedRule: rule,
        profileId: rule.profileId,
        reason: formatReason(rule),
      };
    }
  }

  return { matchedRule: null, profileId: null, reason: null };
}

function matchesRule(rule: AutoSwitchRule, context: AutoSwitchContext): boolean {
  switch (rule.type) {
    case "time":
      return matchesTimeRule(rule.condition, context.currentTime);
    case "app":
      return matchesAppRule(rule.condition, context.activeAppName);
    case "idle":
      return matchesIdleRule(rule.condition, context.idleSeconds);
    default:
      return false;
  }
}

function matchesTimeRule(condition: string, currentTime: Date): boolean {
  const parts = condition.split(":");
  if (parts.length !== 2) return false;
  const targetHour = parseInt(parts[0], 10);
  const targetMinute = parseInt(parts[1], 10);
  if (isNaN(targetHour) || isNaN(targetMinute)) return false;

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 30;
}

function matchesAppRule(condition: string, activeAppName: string | null): boolean {
  if (!activeAppName) return false;
  const lower = activeAppName.toLowerCase();
  const cond = condition.toLowerCase();
  return lower.includes(cond) || lower === cond;
}

function matchesIdleRule(condition: string, idleSeconds: number): boolean {
  const threshold = parseInt(condition, 10);
  if (isNaN(threshold)) return false;
  return idleSeconds >= threshold;
}

function formatReason(rule: AutoSwitchRule): string {
  switch (rule.type) {
    case "time":
      return `Time rule: ${rule.condition}`;
    case "app":
      return `App rule: ${rule.condition}`;
    case "idle":
      return `Idle rule: ${rule.condition}s`;
    default:
      return "Unknown rule";
  }
}

export function createAutoSwitchRule(
  type: AutoSwitchRuleType,
  condition: string,
  profileId: string,
): AutoSwitchRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    condition,
    profileId,
    enabled: true,
  };
}
