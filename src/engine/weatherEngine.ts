// ============================================================
// Kovy Weather Engine — ambient weather effects
//
// Generates weather patterns that affect Kovy's mood and
// the habitat atmosphere. Purely cosmetic + mood influence.
// No real weather data — all procedural.
// ============================================================

import type { WeatherType } from "@/store/types";

export type { WeatherType };

export interface WeatherState {
  current: WeatherType;
  intensity: number; // 0-1
  transitionTimer: number; // seconds until next weather change
  particlesActive: boolean;
}

export interface WeatherConfig {
  enabled: boolean;
  changeInterval: number; // seconds between weather changes (default: 600 = 10min)
  intensity: number; // 0-1, multiplier for weather effects
  allowedTypes: WeatherType[];
}

export const DEFAULT_WEATHER_CONFIG: WeatherConfig = {
  enabled: true,
  changeInterval: 600,
  intensity: 0.5,
  allowedTypes: ["clear", "cloudy", "rain", "storm", "snow", "fog", "aurora"],
};

// Weather → mood influence mapping
const WEATHER_MOOD_INFLUENCE: Record<WeatherType, { curiosity: number; comfort: number; playfulness: number; energy: number }> = {
  clear: { curiosity: 0.05, comfort: 0.1, playfulness: 0.05, energy: 0.05 },
  cloudy: { curiosity: 0, comfort: 0, playfulness: -0.05, energy: -0.05 },
  rain: { curiosity: 0.05, comfort: 0.1, playfulness: -0.1, energy: -0.1 },
  storm: { curiosity: 0.1, comfort: -0.15, playfulness: -0.1, energy: -0.05 },
  snow: { curiosity: 0.1, comfort: 0.05, playfulness: 0.1, energy: 0 },
  fog: { curiosity: 0.15, comfort: -0.05, playfulness: -0.05, energy: -0.05 },
  aurora: { curiosity: 0.2, comfort: 0.15, playfulness: 0.1, energy: 0.1 },
  hail: { curiosity: 0.1, comfort: -0.1, playfulness: -0.05, energy: -0.05 },
  sleet: { curiosity: 0.05, comfort: -0.05, playfulness: -0.1, energy: -0.1 },
  wind: { curiosity: 0.1, comfort: -0.05, playfulness: 0.05, energy: 0.05 },
};

// Weather → atmosphere particle mapping
const WEATHER_PARTICLES: Record<WeatherType, { type: string; density: number; color: string }> = {
  clear: { type: "mote", density: 0.1, color: "rgba(255, 240, 200, 0.3)" },
  cloudy: { type: "mote", density: 0.15, color: "rgba(200, 200, 220, 0.3)" },
  rain: { type: "rain", density: 0.6, color: "rgba(150, 180, 220, 0.5)" },
  storm: { type: "rain", density: 0.9, color: "rgba(130, 150, 200, 0.6)" },
  snow: { type: "snow", density: 0.5, color: "rgba(240, 245, 255, 0.6)" },
  fog: { type: "fog", density: 0.7, color: "rgba(200, 200, 210, 0.3)" },
  aurora: { type: "aurora", density: 0.3, color: "rgba(100, 200, 180, 0.4)" },
  hail: { type: "hail", density: 0.5, color: "rgba(220, 225, 235, 0.6)" },
  sleet: { type: "sleet", density: 0.5, color: "rgba(180, 200, 220, 0.5)" },
  wind: { type: "wind", density: 0.3, color: "rgba(200, 210, 200, 0.2)" },
};

export function createDefaultWeatherState(): WeatherState {
  return {
    current: "clear",
    intensity: 0.5,
    transitionTimer: 600,
    particlesActive: true,
  };
}

export class WeatherEngine {
  private state: WeatherState;

  constructor(initialState?: WeatherState) {
    this.state = initialState ?? createDefaultWeatherState();
  }

  getState(): WeatherState {
    return { ...this.state };
  }

  update(dt: number, config: WeatherConfig = DEFAULT_WEATHER_CONFIG): WeatherState {
    if (!config.enabled) {
      this.state.current = "clear";
      this.state.intensity = 0;
      return this.getState();
    }

    this.state.transitionTimer -= dt;
    if (this.state.transitionTimer <= 0) {
      this.changeWeather(config);
      this.state.transitionTimer = config.changeInterval * (0.5 + Math.random());
    }

    return this.getState();
  }

  private changeWeather(config: WeatherConfig): void {
    const types = config.allowedTypes.length > 0
      ? config.allowedTypes
      : ["clear"];
    const newType = types[Math.floor(Math.random() * types.length)] as WeatherType;
    this.state.current = newType;
    this.state.intensity = config.intensity * (0.5 + Math.random() * 0.5);
  }

  getMoodInfluence(): { curiosity: number; comfort: number; playfulness: number; energy: number } {
    const base = WEATHER_MOOD_INFLUENCE[this.state.current] ?? WEATHER_MOOD_INFLUENCE.clear;
    return {
      curiosity: base.curiosity * this.state.intensity,
      comfort: base.comfort * this.state.intensity,
      playfulness: base.playfulness * this.state.intensity,
      energy: base.energy * this.state.intensity,
    };
  }

  getParticleConfig(): { type: string; density: number; color: string } {
    return WEATHER_PARTICLES[this.state.current] ?? WEATHER_PARTICLES.clear;
  }

  forceWeather(type: WeatherType, intensity: number = 0.5): void {
    this.state.current = type;
    this.state.intensity = intensity;
  }

  reset(): void {
    this.state = createDefaultWeatherState();
  }
}

// --- Day/Night cycle helper ---
// Uses CircadianEngine output but provides a simple interface for
// habitat objects that need to know the time of day

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

export function getTimeOfDayProgress(hour: number): number {
  // 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk, 1 = midnight again
  return hour / 24;
}
