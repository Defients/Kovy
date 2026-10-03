// ============================================================
// Kovy Seasonal Events Engine — detects holidays and seasonal
// events to trigger special visuals, moods, and behaviors.
//
// Supports built-in holidays and user-defined custom events.
// Hemisphere-aware for seasonal particle types.
// ============================================================

import type { SeasonalConfig, SeasonalEventId } from "@/store/types";

export interface SeasonalEvent {
  id: string;
  name: string;
  icon: string;
  date: string; // MM-DD
  isCustom: boolean;
}

export interface SeasonalOutput {
  enabled: boolean;
  activeEvents: SeasonalEvent[];
  currentSeason: "spring" | "summer" | "autumn" | "winter";
  hemisphere: "northern" | "southern";
}

export const NULL_SEASONAL_OUTPUT: SeasonalOutput = {
  enabled: false,
  activeEvents: [],
  currentSeason: "spring",
  hemisphere: "northern",
};

const BUILTIN_EVENTS: Record<SeasonalEventId, SeasonalEvent> = {
  halloween: { id: "halloween", name: "Halloween", icon: "🎃", date: "10-31", isCustom: false },
  christmas: { id: "christmas", name: "Christmas", icon: "🎄", date: "12-25", isCustom: false },
  newyear: { id: "newyear", name: "New Year", icon: "🎉", date: "01-01", isCustom: false },
  valentines: { id: "valentines", name: "Valentine's Day", icon: "💝", date: "02-14", isCustom: false },
  stpatricks: { id: "stpatricks", name: "St. Patrick's Day", icon: "🍀", date: "03-17", isCustom: false },
  summerSolstice: { id: "summerSolstice", name: "Summer Solstice", icon: "☀️", date: "06-21", isCustom: false },
  autumnEquinox: { id: "autumnEquinox", name: "Autumn Equinox", icon: "🍂", date: "09-22", isCustom: false },
};

function getCurrentSeason(hemisphere: "northern" | "southern"): "spring" | "summer" | "autumn" | "winter" {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const monthDay = month * 100 + day;

  if (hemisphere === "northern") {
    if (monthDay >= 321 && monthDay < 621) return "spring";
    if (monthDay >= 621 && monthDay < 921) return "summer";
    if (monthDay >= 921 && monthDay < 1221) return "autumn";
    return "winter";
  } else {
    if (monthDay >= 321 && monthDay < 621) return "autumn";
    if (monthDay >= 621 && monthDay < 921) return "winter";
    if (monthDay >= 921 && monthDay < 1221) return "spring";
    return "summer";
  }
}

export class SeasonalEngine {
  update(config: SeasonalConfig): SeasonalOutput {
    if (!config.enabled) return NULL_SEASONAL_OUTPUT;

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const todayStr = `${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    const activeEvents: SeasonalEvent[] = [];

    // Check built-in events (active for 1 day before and after)
    for (const eventId of config.events) {
      const event = BUILTIN_EVENTS[eventId];
      if (!event) continue;
      if (this.isNearDate(todayStr, event.date, 1)) {
        activeEvents.push(event);
      }
    }

    // Check custom events
    for (const custom of config.customEvents) {
      if (this.isNearDate(todayStr, custom.date, 1)) {
        activeEvents.push({
          id: custom.id,
          name: custom.name,
          icon: custom.icon,
          date: custom.date,
          isCustom: true,
        });
      }
    }

    return {
      enabled: true,
      activeEvents,
      currentSeason: getCurrentSeason(config.hemisphere),
      hemisphere: config.hemisphere,
    };
  }

  private isNearDate(today: string, target: string, daysTolerance: number): boolean {
    const [tMonth, tDay] = today.split("-").map(Number);
    const [eMonth, eDay] = target.split("-").map(Number);
    const todayDOY = tMonth * 31 + tDay;
    const eventDOY = eMonth * 31 + eDay;
    const diff = Math.abs(todayDOY - eventDOY);
    return diff <= daysTolerance;
  }
}
