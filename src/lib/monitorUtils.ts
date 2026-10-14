// ============================================================
// Monitor Utilities — bounds math for multi-monitor placement
// Pure functions, no Tauri dependency
// ============================================================

import type { Vec2, MonitorBounds, DisplayMonitor } from "@/store/types";

export interface MonitorInfo {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  /** Stable identity used for persistence; see stableMonitorId(). */
  id?: string;
  /** Usable area excluding taskbar/docks, same coordinate space as x/y. */
  workArea?: { x: number; y: number; width: number; height: number };
}

/** Shape of @tauri-apps/api/window Monitor (all values PHYSICAL px). */
export interface RawTauriMonitor {
  name: string | null;
  scaleFactor: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  workArea?: { position: { x: number; y: number }; size: { width: number; height: number } };
}

/**
 * Convert Tauri monitors (physical px) into overlay CSS px.
 * The overlay is ONE webview with ONE devicePixelRatio (the scale of the monitor
 * the window is on), so every monitor must be divided by that same factor.
 * Dividing each monitor by its own scaleFactor breaks adjacency on mixed-DPI.
 */
export function monitorsFromTauri(mons: RawTauriMonitor[], windowScale: number): MonitorInfo[] {
  const s = windowScale > 0 && Number.isFinite(windowScale) ? windowScale : 1;
  return mons.map((m, i) => {
    const info: MonitorInfo = {
      name: m.name ?? `monitor_${i}`,
      x: m.position.x / s,
      y: m.position.y / s,
      width: m.size.width / s,
      height: m.size.height / s,
      scaleFactor: m.scaleFactor ?? 1,
    };
    if (m.workArea) {
      info.workArea = {
        x: m.workArea.position.x / s, y: m.workArea.position.y / s,
        width: m.workArea.size.width / s, height: m.workArea.size.height / s,
      };
    }
    info.id = stableMonitorId(info);
    return info;
  });
}

/**
 * Stable-ish identity: device name plus resolution (in units of the monitor's own scale).
 * Device names (\\.\DISPLAYn) can renumber after reconnect/driver updates,
 * so resolveDisplayMonitor() also matches the "@WxH" part as a fallback.
 */
export function stableMonitorId(m: MonitorInfo): string {
  return `${m.name}@${Math.round(m.width * 1000) / 1000}x${Math.round(m.height * 1000) / 1000}`;
}

/** Clamp a point into a rect with margin; collapses to center if rect is too small. */
export function clampToBounds(pos: Vec2, b: { x: number; y: number; width: number; height: number }, margin = 20): Vec2 {
  const ax = (lo: number, size: number, v: number) =>
    size <= margin * 2 ? lo + size / 2 : Math.max(lo + margin, Math.min(lo + size - margin, v));
  return { x: ax(b.x, b.width, pos.x), y: ax(b.y, b.height, pos.y) };
}

export interface VirtualDesktopBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compute virtual desktop rect that spans all monitors */
export function computeVirtualDesktop(monitors: MonitorInfo[]): VirtualDesktopBounds {
  if (monitors.length === 0) {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of monitors) {
    minX = Math.min(minX, m.x);
    minY = Math.min(minY, m.y);
    maxX = Math.max(maxX, m.x + m.width);
    maxY = Math.max(maxY, m.y + m.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Find which monitor a position falls on (or null if off-screen) */
export function getMonitorForPosition(pos: Vec2, monitors: MonitorInfo[]): MonitorInfo | null {
  for (const m of monitors) {
    if (pos.x >= m.x && pos.x < m.x + m.width && pos.y >= m.y && pos.y < m.y + m.height) {
      return m;
    }
  }
  return null;
}

/** Find a monitor by name */
export function getMonitorByName(name: string, monitors: MonitorInfo[]): MonitorInfo | null {
  return monitors.find(m => m.name === name) ?? null;
}

/** Clamp a position to be within a specific monitor's bounds, with padding */
export function clampToMonitor(pos: Vec2, monitor: MonitorInfo, padding: number = 40): Vec2 {
  return clampToBounds(pos, monitor.workArea ?? monitor, padding);
}

/** Clamp a position to be within the virtual desktop */
export function clampToVirtualDesktop(pos: Vec2, vd: VirtualDesktopBounds, padding: number = 40): Vec2 {
  return {
    x: Math.max(vd.x + padding, Math.min(vd.x + vd.width - padding, pos.x)),
    y: Math.max(vd.y + padding, Math.min(vd.y + vd.height - padding, pos.y)),
  };
}

/** Get the center of a monitor */
export function getMonitorCenter(monitor: MonitorInfo): Vec2 {
  return {
    x: monitor.x + monitor.width / 2,
    y: monitor.y + monitor.height / 2,
  };
}

/** Move an entity position to the center of a target monitor */
export function moveToMonitor(monitor: MonitorInfo): Vec2 {
  return getMonitorCenter(monitor);
}

/** Resolve a DisplayMonitor value to a concrete MonitorInfo */
export function resolveDisplayMonitor(
  displayMonitor: DisplayMonitor,
  monitors: MonitorInfo[],
  primaryIndex: number = 0
): MonitorInfo | null {
  if (displayMonitor === "global") return null; // free to roam
  if (displayMonitor === "primary") return monitors[primaryIndex] ?? monitors[0] ?? null;
  const primary = monitors[primaryIndex] ?? monitors[0] ?? null;
  // 1. exact stable id  2. device name (legacy persisted value)
  const byId = monitors.find(m => (m.id ?? stableMonitorId(m)) === displayMonitor);
  if (byId) return byId;
  const at = displayMonitor.lastIndexOf("@");
  const namePart = at > 0 ? displayMonitor.slice(0, at) : displayMonitor;
  const byName = getMonitorByName(namePart, monitors);
  if (byName) return byName;
  // 3. same resolution, unique match (device renumbered after reconnect)
  if (at > 0) {
    const sizePart = displayMonitor.slice(at + 1);
    const sameSize = monitors.filter(m => (m.id ?? stableMonitorId(m)).endsWith("@" + sizePart));
    if (sameSize.length === 1) return sameSize[0];
  }
  // 4. legacy index-based ID like "monitor_0"
  const match = /^monitor_(\d+)$/.exec(namePart);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (idx >= 0 && idx < monitors.length) return monitors[idx];
  }
  // 5. pinned monitor is gone: stay pinned, to primary (never silently free-roam)
  return primary;
}

/** Get movement bounds for an entity based on its monitor assignment */
export function getEntityBounds(
  displayMonitor: DisplayMonitor,
  monitors: MonitorInfo[],
  virtualDesktop: VirtualDesktopBounds,
  primaryIndex: number = 0
): MonitorBounds {
  const targetMonitor = resolveDisplayMonitor(displayMonitor, monitors, primaryIndex);
  if (targetMonitor) {
    const idx = monitors.indexOf(targetMonitor);
    const r = targetMonitor.workArea ?? targetMonitor;
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      index: idx >= 0 ? idx : 0,
    };
  }
  // Global: use virtual desktop
  return {
    x: virtualDesktop.x,
    y: virtualDesktop.y,
    width: virtualDesktop.width,
    height: virtualDesktop.height,
    index: -1,
  };
}
