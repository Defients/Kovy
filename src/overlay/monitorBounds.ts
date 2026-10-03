// ============================================================
// Monitor Bounds Helpers — extracted from KovyRenderer
// Pure functions for multi-monitor confinement
// ============================================================

import type { Vec2 } from "@/store/types";
import {
  type MonitorInfo as MonitorInfoUtil,
  type VirtualDesktopBounds,
  getEntityBounds,
  getMonitorCenter,
  resolveDisplayMonitor,
} from "@/lib/monitorUtils";

export { getEntityBounds, getMonitorCenter, resolveDisplayMonitor };
export type { MonitorInfoUtil, VirtualDesktopBounds };

export function toOverlayLocalPosition(position: Vec2, virtualDesktop: VirtualDesktopBounds): Vec2 {
  return {
    x: position.x - virtualDesktop.x,
    y: position.y - virtualDesktop.y,
  };
}

/// Convert overlay-local (canvas) coordinates back to screen coordinates
/// by adding the virtual desktop offset. This is the inverse of
/// toOverlayLocalPosition and is needed when passing positions to native
/// APIs (e.g. SetCursorPos, WindowFromPoint) that expect screen coordinates.
export function toScreenPosition(position: Vec2, virtualDesktop: VirtualDesktopBounds): Vec2 {
  return {
    x: position.x + virtualDesktop.x,
    y: position.y + virtualDesktop.y,
  };
}

export function toOverlayLocalBounds(bounds: { x: number; y: number; width: number; height: number }, virtualDesktop: VirtualDesktopBounds) {
  return {
    x: bounds.x - virtualDesktop.x,
    y: bounds.y - virtualDesktop.y,
    width: bounds.width,
    height: bounds.height,
  };
}

export interface EntityBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeEntityBounds(
  displayMonitor: string,
  monitors: MonitorInfoUtil[],
  vd: VirtualDesktopBounds,
  primaryIndex: number,
): EntityBounds {
  return toOverlayLocalBounds(
    getEntityBounds(displayMonitor, monitors, vd, primaryIndex),
    vd,
  );
}

export function getMonitorCenterLocal(
  displayMonitor: string,
  monitors: MonitorInfoUtil[],
  primaryIndex: number,
  vd: VirtualDesktopBounds,
): Vec2 {
  const targetMon = resolveDisplayMonitor(displayMonitor, monitors, primaryIndex);
  const center = targetMon
    ? getMonitorCenter(targetMon)
    : { x: vd.x + vd.width / 2, y: vd.y + vd.height / 2 };
  return toOverlayLocalPosition(center, vd);
}
