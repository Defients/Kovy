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
  return {
    x: Math.max(monitor.x + padding, Math.min(monitor.x + monitor.width - padding, pos.x)),
    y: Math.max(monitor.y + padding, Math.min(monitor.y + monitor.height - padding, pos.y)),
  };
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
  // Specific monitor by name
  const byName = getMonitorByName(displayMonitor, monitors);
  if (byName) return byName;
  // Fallback: index-based ID like "monitor_0", "monitor_1"
  const match = /^monitor_(\d+)$/.exec(displayMonitor);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (idx >= 0 && idx < monitors.length) return monitors[idx];
  }
  return null;
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
    return {
      x: targetMonitor.x,
      y: targetMonitor.y,
      width: targetMonitor.width,
      height: targetMonitor.height,
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
