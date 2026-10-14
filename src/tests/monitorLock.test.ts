// Regression tests: "Kovy does not stay locked to the selected monitor".
// Mocked display configs only, no Tauri. Coordinates are physical px unless noted.
import { describe, it, expect } from "vitest";
import * as MU from "@/lib/monitorUtils";

type Raw = {
  name: string | null; scaleFactor: number;
  position: { x: number; y: number }; size: { width: number; height: number };
  workArea?: { position: { x: number; y: number }; size: { width: number; height: number } };
};
const raw = (name: string, x: number, y: number, w: number, h: number, sf = 1, taskbar = 0): Raw => ({
  name, scaleFactor: sf, position: { x, y }, size: { width: w, height: h },
  workArea: { position: { x, y }, size: { width: w, height: h - taskbar } },
});

// Layouts
const LEFT_OF_PRIMARY = [raw("\\\\.\\DISPLAY1", 0, 0, 1920, 1080), raw("\\\\.\\DISPLAY2", -2560, 0, 2560, 1440)];
const ABOVE_PRIMARY = [raw("\\\\.\\DISPLAY1", 0, 0, 1920, 1080), raw("\\\\.\\DISPLAY2", 0, -1080, 1920, 1080)];
const MIXED_DPI = [raw("\\\\.\\DISPLAY1", 0, 0, 3840, 2160, 1.5), raw("\\\\.\\DISPLAY2", 3840, 0, 1920, 1080, 1)];

// The mapping KovyRenderer.tsx:253-262 uses today (per-monitor scale division).
const currentInlineMapping = (mons: Raw[]): MU.MonitorInfo[] => mons.map((m, i) => {
  const sf = m.scaleFactor ?? 1;
  return { name: m.name ?? `monitor_${i}`, x: m.position.x / sf, y: m.position.y / sf,
    width: m.size.width / sf, height: m.size.height / sf, scaleFactor: sf };
});
// Use the shared helper when it exists (fix), else the current inline mapping.
const toOverlay = (mons: Raw[], windowScale = 1): MU.MonitorInfo[] =>
  typeof (MU as any).monitorsFromTauri === "function"
    ? (MU as any).monitorsFromTauri(mons, windowScale)
    : currentInlineMapping(mons);

describe("coordinate calc / negative origins", () => {
  it("virtual desktop includes monitor left of primary (negative x)", () => {
    const vd = MU.computeVirtualDesktop(toOverlay(LEFT_OF_PRIMARY));
    expect(vd).toEqual({ x: -2560, y: 0, width: 4480, height: 1440 });
  });
  it("virtual desktop includes monitor above primary (negative y)", () => {
    const vd = MU.computeVirtualDesktop(toOverlay(ABOVE_PRIMARY));
    expect(vd).toEqual({ x: 0, y: -1080, width: 1920, height: 2160 });
  });
  it("entity bounds for a negative-origin monitor map to overlay-local [0..w]", () => {
    const mons = toOverlay(LEFT_OF_PRIMARY);
    const vd = MU.computeVirtualDesktop(mons);
    const b = MU.getEntityBounds("\\\\.\\DISPLAY2", mons, vd, 0);
    expect(b.x - vd.x).toBe(0);
    expect(b.width).toBe(2560);
  });
});

describe("mixed DPI", () => {
  it("monitors stay adjacent (no gap/overlap) in overlay space", () => {
    // Overlay window lives on the 150% primary, so CSS px = physical / 1.5 everywhere.
    const [a, b] = toOverlay(MIXED_DPI, 1.5);
    expect(a.x + a.width).toBeCloseTo(b.x, 5);
  });
  it("secondary 100% monitor keeps correct CSS size relative to overlay scale", () => {
    const [, b] = toOverlay(MIXED_DPI, 1.5);
    expect(b.width).toBeCloseTo(1920 / 1.5, 5);
  });
});

describe("work area vs full bounds", () => {
  it("entity bounds exclude the taskbar", () => {
    const mons = toOverlay([raw("\\\\.\\DISPLAY1", 0, 0, 1920, 1080, 1, 48)]);
    const b = MU.getEntityBounds("primary", mons, MU.computeVirtualDesktop(mons), 0);
    expect(b.height).toBe(1032);
  });
});

describe("boundary clamping", () => {
  it("clampToMonitor keeps point inside even when monitor < 2*padding", () => {
    const m: MU.MonitorInfo = { name: "tiny", x: 100, y: 100, width: 50, height: 50, scaleFactor: 1 };
    const p = MU.clampToMonitor({ x: 0, y: 0 }, m, 40);
    expect(p.x).toBeGreaterThanOrEqual(100); expect(p.x).toBeLessThanOrEqual(150);
    expect(p.y).toBeGreaterThanOrEqual(100); expect(p.y).toBeLessThanOrEqual(150);
  });
  it("a target on another monitor is clamped into the locked monitor (overlay-local)", () => {
    const clampTarget = (MU as any).clampToBounds;
    expect(typeof clampTarget).toBe("function");
    const bounds = { x: 1920, y: 0, width: 1920, height: 1080 };
    expect(clampTarget({ x: 20, y: 20 }, bounds, 20)).toEqual({ x: 1940, y: 20 });
  });
});

describe("persisted-selection resolution", () => {
  it("resolves by name regardless of enumeration order", () => {
    const mons = toOverlay([LEFT_OF_PRIMARY[1], LEFT_OF_PRIMARY[0]]);
    expect(MU.resolveDisplayMonitor("\\\\.\\DISPLAY2", mons, 1)?.x).toBe(-2560);
  });
  it("resolves stable id after the OS renumbers the device name (same geometry)", () => {
    const before = toOverlay(LEFT_OF_PRIMARY);
    const id = (MU as any).stableMonitorId?.(before[1]) ?? before[1].name;
    const after = toOverlay([raw("\\\\.\\DISPLAY1", 0, 0, 1920, 1080), raw("\\\\.\\DISPLAY3", -2560, 0, 2560, 1440)]);
    expect(MU.resolveDisplayMonitor(id, after, 0)?.x).toBe(-2560);
  });
});

describe("fallback when the monitor disappears", () => {
  it("an unplugged pinned monitor falls back to primary, not to free roam", () => {
    const mons = toOverlay([raw("\\\\.\\DISPLAY1", 0, 0, 1920, 1080)]);
    const b = MU.getEntityBounds("\\\\.\\DISPLAY2", mons, MU.computeVirtualDesktop(mons), 0);
    expect(b.index).toBe(0); // current: -1 (global)
  });
  it("global stays global", () => {
    const mons = toOverlay(LEFT_OF_PRIMARY);
    expect(MU.getEntityBounds("global", mons, MU.computeVirtualDesktop(mons), 0).index).toBe(-1);
  });
});
