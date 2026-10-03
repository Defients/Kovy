import { useCallback, useEffect, useRef, useState } from "react";
import { useKovyStore } from "@/store/kovyStore";
import { useConfigStore } from "@/store/configStore";
import { setOverlayClickThrough } from "@/lib/tauriBridge";
import type { Vec2, HabitatConfig, HabitatZoneType } from "@/store/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

type DragItem =
  | { kind: "home"; id: string }
  | { kind: "node"; id: string }
  | { kind: "railPoint"; railId: string; pointIndex: number }
  | { kind: "zoneMove"; id: string; offsetX: number; offsetY: number }
  | { kind: "zoneResize"; id: string; handle: ResizeHandle; startRect: { x: number; y: number; w: number; h: number }; startMouse: Vec2 }
  | null;

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type SelectedItem =
  | { kind: "home"; id: string }
  | { kind: "node"; id: string }
  | { kind: "rail"; id: string }
  | { kind: "zone"; id: string }
  | null;

const HANDLE_SIZE = 8;
const HIT_RADIUS = 14;

export function HabitatEditor() {
  const editMode = useKovyStore((s) => s.habitatEditMode);
  const config = useConfigStore((s) => s.appliedConfig);
  const [dragging, setDragging] = useState<DragItem>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // When edit mode turns on, disable click-through so we can receive mouse events
  useEffect(() => {
    if (editMode) {
      setOverlayClickThrough(false);
      useKovyStore.getState().setClickThrough(false);
    }
    return () => {
      if (editMode) {
        setOverlayClickThrough(true);
        useKovyStore.getState().setClickThrough(true);
      }
    };
  }, [editMode]);

  // Setup canvas for selection/hover visuals
  useEffect(() => {
    if (!editMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [editMode]);

  const getHabitat = useCallback((): HabitatConfig => {
    // If we're dragging, read from the draft config (which holds the preview state)
    // Otherwise read from applied config
    const store = useConfigStore.getState();
    return dragging ? store.draftConfig.habitat : store.appliedConfig.habitat;
  }, [dragging]);

  const commitHabitat = useCallback((newHab: HabitatConfig, isFinal: boolean = false) => {
    const store = useConfigStore.getState();
    if (isFinal) {
      store.applyHabitat(newHab);
    } else {
      store.previewHabitat(newHab);
    }
  }, []);

  // --- Hit testing ---
  const findResizeHandle = useCallback((x: number, y: number, zoneId: string): ResizeHandle | null => {
    const hab = getHabitat();
    const zone = hab.zones.find(z => z.id === zoneId);
    if (!zone) return null;
    const r = zone.rect;
    const hs = HANDLE_SIZE + 2;
    const handles: Array<{ handle: ResizeHandle; hx: number; hy: number }> = [
      { handle: "nw", hx: r.x, hy: r.y },
      { handle: "n", hx: r.x + r.w / 2, hy: r.y },
      { handle: "ne", hx: r.x + r.w, hy: r.y },
      { handle: "e", hx: r.x + r.w, hy: r.y + r.h / 2 },
      { handle: "se", hx: r.x + r.w, hy: r.y + r.h },
      { handle: "s", hx: r.x + r.w / 2, hy: r.y + r.h },
      { handle: "sw", hx: r.x, hy: r.y + r.h },
      { handle: "w", hx: r.x, hy: r.y + r.h / 2 },
    ];
    for (const h of handles) {
      if (Math.abs(x - h.hx) < hs && Math.abs(y - h.hy) < hs) {
        return h.handle;
      }
    }
    return null;
  }, [getHabitat]);

  const findItemAt = useCallback((x: number, y: number): DragItem => {
    const hab = getHabitat();

    // Check resize handles on selected zone first
    if (selected?.kind === "zone") {
      const handle = findResizeHandle(x, y, selected.id);
      if (handle) {
        const zone = hab.zones.find(z => z.id === selected.id);
        if (zone) {
          return { kind: "zoneResize", id: selected.id, handle, startRect: { ...zone.rect }, startMouse: { x, y } };
        }
      }
    }

    // Check homes
    for (const home of hab.homes) {
      const dx = x - home.position.x;
      const dy = y - home.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
        return { kind: "home", id: home.id };
      }
    }

    // Check nodes
    for (const node of hab.nodes) {
      const dx = x - node.position.x;
      const dy = y - node.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
        return { kind: "node", id: node.id };
      }
    }

    // Check rail points
    for (const rail of hab.rails) {
      for (let pi = 0; pi < rail.points.length; pi++) {
        const pt = rail.points[pi];
        const dx = x - pt.x;
        const dy = y - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
          return { kind: "railPoint", railId: rail.id, pointIndex: pi };
        }
      }
    }

    // Check zones (body drag)
    for (const zone of hab.zones) {
      const r = zone.rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { kind: "zoneMove", id: zone.id, offsetX: x - r.x, offsetY: y - r.y };
      }
    }

    return null;
  }, [getHabitat, selected, findResizeHandle]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;
    const item = findItemAt(e.clientX, e.clientY);
    if (item) {
      setDragging(item);
      // Update selection
      if (item.kind === "home") setSelected({ kind: "home", id: item.id });
      else if (item.kind === "node") setSelected({ kind: "node", id: item.id });
      else if (item.kind === "railPoint") setSelected({ kind: "rail", id: item.railId });
      else if (item.kind === "zoneMove") setSelected({ kind: "zone", id: item.id });
      else if (item.kind === "zoneResize") setSelected({ kind: "zone", id: item.id });
      e.preventDefault();
    } else {
      setSelected(null);
    }
  }, [editMode, findItemAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;
    const pos: Vec2 = { x: e.clientX, y: e.clientY };

    if (!dragging) {
      const item = findItemAt(pos.x, pos.y);
      setHovered(item ? JSON.stringify(item) : null);
      return;
    }

    const hab = getHabitat();
    let newHab = { ...hab };

    switch (dragging.kind) {
      case "home":
        newHab = { ...hab, homes: hab.homes.map((h) => h.id === dragging.id ? { ...h, position: pos } : h) };
        break;
      case "node":
        newHab = { ...hab, nodes: hab.nodes.map((n) => n.id === dragging.id ? { ...n, position: pos } : n) };
        break;
      case "railPoint":
        newHab = { ...hab, rails: hab.rails.map((r) => r.id === dragging.railId ? { ...r, points: r.points.map((p, i) => i === dragging.pointIndex ? pos : p) } : r) };
        break;
      case "zoneMove":
        newHab = { ...hab, zones: hab.zones.map((z) => z.id === dragging.id ? { ...z, rect: { ...z.rect, x: Math.round(pos.x - dragging.offsetX), y: Math.round(pos.y - dragging.offsetY) } } : z) };
        break;
      case "zoneResize": {
        const dx = pos.x - dragging.startMouse.x;
        const dy = pos.y - dragging.startMouse.y;
        const sr = dragging.startRect;
        let { x, y, w, h } = sr;
        const handle = dragging.handle;
        if (handle.includes("w")) { x = sr.x + dx; w = sr.w - dx; }
        if (handle.includes("e")) { w = sr.w + dx; }
        if (handle.includes("n")) { y = sr.y + dy; h = sr.h - dy; }
        if (handle.includes("s")) { h = sr.h + dy; }
        // Enforce minimum size
        if (w < 40) { if (handle.includes("w")) x = sr.x + sr.w - 40; w = 40; }
        if (h < 40) { if (handle.includes("n")) y = sr.y + sr.h - 40; h = 40; }
        newHab = { ...hab, zones: hab.zones.map((z) => z.id === dragging.id ? { ...z, rect: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } } : z) };
        break;
      }
    }

    commitHabitat(newHab, false);
  }, [editMode, dragging, getHabitat, commitHabitat, findItemAt]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      // Commit final state when drop finishes
      commitHabitat(getHabitat(), true);
    }
    setDragging(null);
  }, [dragging, getHabitat, commitHabitat]);

  // --- Creation helpers ---
  const addHome = useCallback(() => {
    const hab = getHabitat();
    const newHome = { id: generateId(), position: { x: window.innerWidth / 2, y: window.innerHeight / 2 }, label: `Home ${hab.homes.length + 1}` };
    commitHabitat({ ...hab, homes: [...hab.homes, newHome] }, true);
    setSelected({ kind: "home", id: newHome.id });
  }, [getHabitat, commitHabitat]);

  const addNode = useCallback(() => {
    const hab = getHabitat();
    const newNode = { id: generateId(), position: { x: window.innerWidth / 2 + 100, y: window.innerHeight / 2 }, label: `Node ${hab.nodes.length + 1}` };
    commitHabitat({ ...hab, nodes: [...hab.nodes, newNode] }, true);
    setSelected({ kind: "node", id: newNode.id });
  }, [getHabitat, commitHabitat]);

  const addZone = useCallback((type: HabitatZoneType) => {
    const hab = getHabitat();
    const cx = window.innerWidth / 2 - 150;
    const cy = window.innerHeight / 2 - 100;
    const newZone = { id: generateId(), type, rect: { x: cx, y: cy, w: 300, h: 200 }, strength: 0.6, label: `${type.charAt(0).toUpperCase() + type.slice(1)} Zone` };
    commitHabitat({ ...hab, zones: [...hab.zones, newZone] }, true);
    setSelected({ kind: "zone", id: newZone.id });
  }, [getHabitat, commitHabitat]);

  const addRail = useCallback(() => {
    const hab = getHabitat();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newRail = { id: generateId(), points: [{ x: cx - 150, y: cy }, { x: cx + 150, y: cy }], label: `Rail ${hab.rails.length + 1}` };
    commitHabitat({ ...hab, rails: [...hab.rails, newRail] }, true);
    setSelected({ kind: "rail", id: newRail.id });
  }, [getHabitat, commitHabitat]);

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    const hab = getHabitat();
    let newHab = { ...hab };
    if (selected.kind === "home") newHab.homes = hab.homes.filter(h => h.id !== selected.id);
    else if (selected.kind === "node") newHab.nodes = hab.nodes.filter(n => n.id !== selected.id);
    else if (selected.kind === "zone") newHab.zones = hab.zones.filter(z => z.id !== selected.id);
    else if (selected.kind === "rail") newHab.rails = hab.rails.filter(r => r.id !== selected.id);
    commitHabitat(newHab, true);
    setSelected(null);
  }, [selected, getHabitat, commitHabitat]);

  // Delete key handler
  useEffect(() => {
    if (!editMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editMode, deleteSelected]);

  // --- Canvas rendering for selection/hover visuals ---
  useEffect(() => {
    if (!editMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hab = getHabitat();

      // Draw selection visuals
      if (selected) {
        ctx.save();
        if (selected.kind === "zone") {
          const zone = hab.zones.find(z => z.id === selected.id);
          if (zone) {
            const r = zone.rect;
            // Selection border
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
            ctx.setLineDash([]);
            // Resize handles
            const handles = [
              { x: r.x, y: r.y }, { x: r.x + r.w / 2, y: r.y }, { x: r.x + r.w, y: r.y },
              { x: r.x + r.w, y: r.y + r.h / 2 }, { x: r.x + r.w, y: r.y + r.h },
              { x: r.x + r.w / 2, y: r.y + r.h }, { x: r.x, y: r.y + r.h }, { x: r.x, y: r.y + r.h / 2 },
            ];
            for (const h of handles) {
              ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
              ctx.fillRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
              ctx.strokeStyle = "rgba(100, 100, 100, 0.8)";
              ctx.lineWidth = 1;
              ctx.strokeRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            }
          }
        } else if (selected.kind === "home") {
          const home = hab.homes.find(h => h.id === selected.id);
          if (home) {
            ctx.strokeStyle = "rgba(251, 191, 36, 1)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(home.position.x, home.position.y, 16, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (selected.kind === "node") {
          const node = hab.nodes.find(n => n.id === selected.id);
          if (node) {
            ctx.strokeStyle = "rgba(56, 189, 248, 1)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.position.x, node.position.y, 12, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (selected.kind === "rail") {
          const rail = hab.rails.find(r => r.id === selected.id);
          if (rail) {
            // Highlight rail with thicker line
            ctx.strokeStyle = "rgba(168, 85, 247, 1)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rail.points[0].x, rail.points[0].y);
            for (let i = 1; i < rail.points.length; i++) {
              ctx.lineTo(rail.points[i].x, rail.points[i].y);
            }
            ctx.stroke();
            // Numbered points
            for (let i = 0; i < rail.points.length; i++) {
              const pt = rail.points[i];
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(168, 85, 247, 0.9)";
              ctx.fill();
              ctx.strokeStyle = "white";
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = "white";
              ctx.font = "bold 8px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(i + 1), pt.x, pt.y);
            }
          }
        }
        ctx.restore();
      }

      // Draw hover glow (only if not currently selected)
      if (hovered && !dragging) {
        ctx.save();
        try {
          const item = JSON.parse(hovered);
          if (item.kind === "home") {
            const home = hab.homes.find((h: any) => h.id === item.id);
            if (home && !(selected?.kind === "home" && selected.id === item.id)) {
              ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(home.position.x, home.position.y, 14, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (item.kind === "node") {
            const node = hab.nodes.find((n: any) => n.id === item.id);
            if (node && !(selected?.kind === "node" && selected.id === item.id)) {
              ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(node.position.x, node.position.y, 10, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        } catch { /* ignore parse errors */ }
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [editMode, selected, hovered, dragging, getHabitat]);

  // Compute cursor style
  const getCursor = (): string => {
    if (dragging) {
      if (dragging.kind === "zoneResize") {
        const h = dragging.handle;
        if (h === "n" || h === "s") return "ns-resize";
        if (h === "e" || h === "w") return "ew-resize";
        if (h === "nw" || h === "se") return "nwse-resize";
        if (h === "ne" || h === "sw") return "nesw-resize";
      }
      return "grabbing";
    }
    if (hovered) {
      try {
        const item = JSON.parse(hovered);
        if (item.kind === "zoneResize") {
          const h = item.handle;
          if (h === "n" || h === "s") return "ns-resize";
          if (h === "e" || h === "w") return "ew-resize";
          if (h === "nw" || h === "se") return "nwse-resize";
          if (h === "ne" || h === "sw") return "nesw-resize";
        }
      } catch { /* ignore */ }
      return "grab";
    }
    return "default";
  };

  if (!editMode) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        cursor: getCursor(),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Editor canvas for selection/hover visuals */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      {/* Top bar with mode indicator */}
      <div
        className="kovy-glass absolute text-white px-4 py-1.5 rounded-lg text-xs font-semibold pointer-events-none select-none"
        style={{
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(168, 85, 247, 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        Habitat Edit Mode — drag to move, resize zones via handles, Delete to remove. Escape to exit.
      </div>

      {/* Creation toolbar */}
      <div
        className="kovy-glass absolute flex gap-1.5 px-2 py-1.5 rounded-lg select-none"
        style={{
          top: 40,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <button onClick={addHome} style={toolbarBtnStyle("#fbbf24")} title="Add Home">⬡ Home</button>
        <button onClick={addNode} style={toolbarBtnStyle("#38bdf8")} title="Add Node">● Node</button>
        <button onClick={() => addZone("attract")} style={toolbarBtnStyle("#4ade80")} title="Add Attract Zone">▢ Attract</button>
        <button onClick={() => addZone("avoid")} style={toolbarBtnStyle("#f87171")} title="Add Avoid Zone">▢ Avoid</button>
        <button onClick={() => addZone("chill")} style={toolbarBtnStyle("#60a5fa")} title="Add Chill Zone">▢ Chill</button>
        <button onClick={() => addZone("hyper")} style={toolbarBtnStyle("#facc15")} title="Add Hyper Zone">▢ Hyper</button>
        <button onClick={addRail} style={toolbarBtnStyle("#a855f7")} title="Add Rail">⟋ Rail</button>
        {selected && (
          <button onClick={deleteSelected} style={toolbarBtnStyle("#ef4444")} title="Delete selected">✕ Delete</button>
        )}
      </div>
    </div>
  );
}

function toolbarBtnStyle(color: string): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.08)",
    color,
    border: `1px solid ${color}44`,
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
    lineHeight: "18px",
    transition: "background 150ms, transform 150ms",
  };
}
