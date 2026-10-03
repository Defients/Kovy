import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return clamp((value - a) / (b - a), 0, 1);
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function vec2Normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function vec2Length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

// --- Log-level-aware logger ---
type LogLevel = "off" | "error" | "warn" | "info" | "debug";
const LOG_PRIORITY: Record<LogLevel, number> = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
let _logLevel: LogLevel = "warn";

export function setLogLevel(level: LogLevel) { _logLevel = level; }
export function getLogLevel(): LogLevel { return _logLevel; }

function shouldLog(msgLevel: LogLevel): boolean {
  return LOG_PRIORITY[msgLevel] <= LOG_PRIORITY[_logLevel];
}

export const kovyLog = {
  error: (...args: unknown[]) => { if (shouldLog("error")) console.error("[Kovy]", ...args); },
  warn: (...args: unknown[]) => { if (shouldLog("warn")) console.warn("[Kovy]", ...args); },
  info: (...args: unknown[]) => { if (shouldLog("info")) console.info("[Kovy]", ...args); },
  debug: (...args: unknown[]) => { if (shouldLog("debug")) console.debug("[Kovy]", ...args); },
};

export function dampedSpring(
  current: number,
  target: number,
  velocity: number,
  stiffness: number,
  damping: number,
  dt: number
): { value: number; velocity: number } {
  const force = stiffness * (target - current);
  const dampForce = -damping * velocity;
  const newVelocity = velocity + (force + dampForce) * dt;
  const newValue = current + newVelocity * dt;
  return { value: newValue, velocity: newVelocity };
}
