// ============================================================
// Debug Overlays — extracted from KovyRenderer
// Canvas rendering for motion regions, target reticle,
// salience graph, habitat overlay, and debug info
// ============================================================

import type { KovyConfig } from "@/store/types";
import { clamp } from "@/lib/utils";
import type { FocusTargetInfo } from "@/engine/behaviorEngine";

// --- Salience graph rolling history ---
const salienceHistory = {
  topScore: [] as number[],
  motionActivity: [] as number[],
  targetCount: [] as number[],
  maxLength: 120,
  push(topScore: number, activity: number, count: number) {
    this.topScore.push(topScore);
    this.motionActivity.push(activity);
    this.targetCount.push(count);
    if (this.topScore.length > this.maxLength) {
      this.topScore.shift();
      this.motionActivity.shift();
      this.targetCount.shift();
    }
  },
  reset() {
    this.topScore.length = 0;
    this.motionActivity.length = 0;
    this.targetCount.length = 0;
  },
};

export function resetSalienceHistory() {
  salienceHistory.reset();
}

// --- Custom reticle image cache ---
const reticleImageCache = new Map<string, HTMLImageElement>();

function getCustomReticleImage(dataUrl: string): HTMLImageElement | null {
  const cached = reticleImageCache.get(dataUrl);
  if (cached) return cached;
  const img = new Image();
  img.src = dataUrl;
  reticleImageCache.set(dataUrl, img);
  return img;
}

function drawCrosshairReticle(ctx: CanvasRenderingContext2D, t: { x: number; y: number }, radius: number) {
  ctx.beginPath();
  ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  const ch = radius + 6;
  ctx.beginPath();
  ctx.moveTo(t.x - ch, t.y);
  ctx.lineTo(t.x + ch, t.y);
  ctx.moveTo(t.x, t.y - ch);
  ctx.lineTo(t.x, t.y + ch);
  ctx.stroke();
}

interface DebugState {
  behaviorState: string;
  surfaceMood: string;
  currentFps: number;
  candidateTargets: Array<{ score: number }>;
  rawRegions: Array<{ id: number; energy: number; persistence: number; boundingBox: { x: number; y: number; w: number; h: number } }>;
  activeTarget: { position: { x: number; y: number }; score: number; regionId: number } | null;
  habitatEditMode: boolean;
  focusTarget?: FocusTargetInfo | null;
}

export function drawDebugOverlays(
  ctx: CanvasRenderingContext2D,
  state: DebugState,
  config: KovyConfig,
  position: { x: number; y: number },
) {
  // Motion region overlay
  if (config.advanced.motionOverlay && state.rawRegions.length > 0) {
    ctx.save();
    for (const region of state.rawRegions) {
      const bb = region.boundingBox;
      const alpha = clamp(region.energy / 80, 0.15, 0.7);
      ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.15})`;
      ctx.fillRect(bb.x, bb.y, bb.w, bb.h);

      if (config.advanced.debugMode) {
        ctx.font = "9px monospace";
        ctx.fillStyle = `rgba(34, 211, 238, ${clamp(alpha + 0.3, 0.4, 0.9)})`;
        ctx.fillText(
          `#${region.id} e:${region.energy.toFixed(0)} p:${region.persistence}`,
          bb.x + 2, bb.y - 3,
        );
      }
    }
    ctx.restore();
  }

  // Target reticle
  if (config.advanced.targetReticle && state.activeTarget) {
    ctx.save();
    const t = state.activeTarget.position;
    const matchedRegion = state.rawRegions.find(r => r.id === state.activeTarget!.regionId);
    const reticleRadius = matchedRegion
      ? Math.max(matchedRegion.boundingBox.w, matchedRegion.boundingBox.h) / 2 + 8
      : 24;

    const style = config.advanced.reticleStyle ?? "crosshair";
    const color = "rgba(99, 102, 241, 0.8)";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    if (style === "custom" && config.advanced.customReticleDataUrl) {
      const img = getCustomReticleImage(config.advanced.customReticleDataUrl);
      if (img) {
        const size = reticleRadius * 2 + 12;
        ctx.drawImage(img, t.x - size / 2, t.y - size / 2, size, size);
      } else {
        drawCrosshairReticle(ctx, t, reticleRadius);
      }
    } else if (style === "dot") {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t.x, t.y, reticleRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (style === "circle") {
      ctx.beginPath();
      ctx.arc(t.x, t.y, reticleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(t.x, t.y, reticleRadius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (style === "square") {
      const s = reticleRadius;
      ctx.strokeRect(t.x - s, t.y - s, s * 2, s * 2);
      ctx.strokeRect(t.x - s * 0.5, t.y - s * 0.5, s, s);
    } else {
      drawCrosshairReticle(ctx, t, reticleRadius);
    }

    if (config.advanced.debugMode) {
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
      const ch = reticleRadius + 6;
      ctx.fillText(`score: ${state.activeTarget.score.toFixed(2)}`, t.x + ch + 4, t.y - 2);
    }
    ctx.restore();
  }

  // Salience graph
  const topScore = state.activeTarget?.score ?? 0;
  const motionAct = state.candidateTargets.length > 0
    ? clamp(state.candidateTargets.reduce((s, t) => s + t.score, 0) / 3, 0, 1)
    : 0;
  salienceHistory.push(topScore, motionAct, state.candidateTargets.length);

  if (config.advanced.salienceGraph && salienceHistory.topScore.length > 2) {
    const gw = 200, gh = 80;
    const gx = ctx.canvas.width - gw - 12;
    const gy = 12;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 4);
    ctx.fill();
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Salience", gx + 4, gy + 10);

    const drawLine = (data: number[], color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const len = data.length;
      for (let i = 0; i < len; i++) {
        const x = gx + (i / Math.max(len - 1, 1)) * (gw - 8) + 4;
        const y = gy + gh - 8 - data[i] * (gh - 18);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawLine(salienceHistory.topScore, "rgba(99, 102, 241, 0.9)");
    drawLine(salienceHistory.motionActivity, "rgba(34, 211, 238, 0.7)");
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(99, 102, 241, 0.9)";
    ctx.fillText("target", gx + gw - 62, gy + 10);
    ctx.fillStyle = "rgba(34, 211, 238, 0.7)";
    ctx.fillText("motion", gx + gw - 62, gy + 19);
    ctx.restore();
  }

  // Habitat overlay
  if ((config.advanced.habitatOverlay && config.habitat.enabled) || state.habitatEditMode) {
    drawHabitatOverlay(ctx, config, state.habitatEditMode);
  }

  // Focus target indicator (debug only)
  if (config.advanced.debugMode && state.focusTarget?.windowCenter) {
    ctx.save();
    ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(state.focusTarget.windowCenter.x, state.focusTarget.windowCenter.y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
    ctx.fillText("focus", state.focusTarget.windowCenter.x + 34, state.focusTarget.windowCenter.y - 2);
    ctx.restore();
  }

  // Debug info text
  if (config.advanced.debugMode) {
    ctx.save();
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    const lines = [
      `FPS: ${state.currentFps}`,
      `State: ${state.behaviorState}`,
      `Mood: ${state.surfaceMood}`,
      `Targets: ${state.candidateTargets.length}`,
      `Regions: ${state.rawRegions.length}`,
      `Pos: ${Math.round(position.x)},${Math.round(position.y)}`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 20 + i * 14);
    });
    ctx.restore();
  }
}

// --- Habitat overlay rendering ---
function drawHabitatOverlay(ctx: CanvasRenderingContext2D, config: KovyConfig, editMode: boolean = false) {
  const hab = config.habitat;
  const em = editMode;
  ctx.save();

  const zoneColors: Record<string, { stroke: string; fill: string; fillEdit: string }> = {
    attract: { stroke: "rgba(74, 222, 128, 0.6)", fill: "rgba(74, 222, 128, 0.08)", fillEdit: "rgba(74, 222, 128, 0.18)" },
    avoid: { stroke: "rgba(248, 113, 113, 0.6)", fill: "rgba(248, 113, 113, 0.08)", fillEdit: "rgba(248, 113, 113, 0.18)" },
    chill: { stroke: "rgba(96, 165, 250, 0.6)", fill: "rgba(96, 165, 250, 0.08)", fillEdit: "rgba(96, 165, 250, 0.18)" },
    hyper: { stroke: "rgba(250, 204, 21, 0.6)", fill: "rgba(250, 204, 21, 0.08)", fillEdit: "rgba(250, 204, 21, 0.18)" },
  };
  for (const zone of hab.zones) {
    const colors = zoneColors[zone.type] ?? zoneColors.attract;
    ctx.strokeStyle = colors.stroke;
    ctx.fillStyle = em ? colors.fillEdit : colors.fill;
    ctx.lineWidth = em ? 2.5 : 1.5;
    ctx.setLineDash(em ? [8, 4] : [6, 3]);
    ctx.strokeRect(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h);
    ctx.fillRect(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h);
    ctx.setLineDash([]);
    ctx.font = em ? "bold 12px monospace" : "10px monospace";
    ctx.fillStyle = colors.stroke;
    ctx.fillText(`${zone.type}: ${zone.label}`, zone.rect.x + 4, zone.rect.y - (em ? 6 : 4));
  }

  for (const rail of hab.rails) {
    if (rail.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = em ? "rgba(168, 85, 247, 0.7)" : "rgba(168, 85, 247, 0.5)";
    ctx.lineWidth = em ? 3 : 2;
    ctx.setLineDash(em ? [6, 4] : [4, 4]);
    ctx.moveTo(rail.points[0].x, rail.points[0].y);
    for (let i = 1; i < rail.points.length; i++) {
      ctx.lineTo(rail.points[i].x, rail.points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (em && rail.points.length >= 2) {
      for (let i = 0; i < rail.points.length - 1; i++) {
        const p1 = rail.points[i], p2 = rail.points[i + 1];
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-3, -3);
        ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
        ctx.fill();
        ctx.restore();
      }
    }
    for (const pt of rail.points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, em ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
      ctx.fill();
    }
    ctx.font = em ? "bold 11px monospace" : "9px monospace";
    ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
    ctx.fillText(rail.label, rail.points[0].x + 8, rail.points[0].y - 8);
  }

  const homeSize = em ? 11 : 8;
  for (const home of hab.homes) {
    const hx = home.position.x, hy = home.position.y;
    ctx.beginPath();
    ctx.moveTo(hx, hy - homeSize);
    ctx.lineTo(hx + homeSize, hy);
    ctx.lineTo(hx, hy + homeSize);
    ctx.lineTo(hx - homeSize, hy);
    ctx.closePath();
    ctx.fillStyle = em ? "rgba(251, 191, 36, 0.75)" : "rgba(251, 191, 36, 0.6)";
    ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
    ctx.lineWidth = em ? 2 : 1.5;
    ctx.stroke();
    ctx.font = em ? "bold 11px monospace" : "9px monospace";
    ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
    ctx.fillText(home.label, hx + homeSize + 4, hy - 2);
  }

  const nodeRadius = em ? 7 : 5;
  for (const node of hab.nodes) {
    ctx.beginPath();
    ctx.arc(node.position.x, node.position.y, nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = em ? "rgba(56, 189, 248, 0.65)" : "rgba(56, 189, 248, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
    ctx.lineWidth = em ? 1.5 : 1;
    ctx.stroke();
    ctx.font = em ? "bold 11px monospace" : "9px monospace";
    ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
    ctx.fillText(node.label, node.position.x + nodeRadius + 4, node.position.y - 4);
  }

  if (em) {
    const cw = ctx.canvas.width;
    const barY = ctx.canvas.height - 36;
    ctx.fillStyle = "rgba(10, 14, 24, 0.75)";
    ctx.fillRect(0, barY, cw, 36);
    ctx.font = "bold 11px monospace";
    const legend = [
      { color: "rgba(251, 191, 36, 0.9)", label: `Homes: ${hab.homes.length}` },
      { color: "rgba(74, 222, 128, 0.9)", label: `Zones: ${hab.zones.length}` },
      { color: "rgba(168, 85, 247, 0.9)", label: `Rails: ${hab.rails.length}` },
      { color: "rgba(56, 189, 248, 0.9)", label: `Nodes: ${hab.nodes.length}` },
    ];
    let lx = 16;
    for (const item of legend) {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, barY + 10, 10, 10);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(item.label, lx + 14, barY + 20);
      lx += ctx.measureText(item.label).width + 30;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px monospace";
    ctx.fillText("ESC to exit edit mode", cw - 180, barY + 22);
  }

  ctx.restore();
}
