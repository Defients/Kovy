// ============================================================
// Background renderers — extracted from KovyRenderer
// Renders background-layer visuals: aurora, atmosphere, weather
// particles, habitat objects, and dream particles.
// All rendering happens BEHIND entities.
// ============================================================

import type { EngineContainer } from "../engineManager";
import type { KovyConfig, SurfaceMood, Vec2 } from "@/store/types";
import { HABITAT_OBJECT_DEFS } from "@/engine/habitatObjectsEngine";
import { AuroraBackgroundRenderer } from "@/overlay/AuroraBackground";
import { AtmosphereRenderer } from "@/overlay/AtmosphereRenderer";
import type { DreamOutput } from "@/engine/dreamEngine";

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface WeatherParticlesRef {
  particles: WeatherParticle[];
  type: string;
  screenW: number;
  screenH: number;
}

export interface BackgroundRenderInputs {
  engines: EngineContainer;
  config: KovyConfig;
  ctx: CanvasRenderingContext2D | null;
  dt: number;
  timestamp: number;
  effectiveScreenW: number;
  effectiveScreenH: number;
  surfaceMood: SurfaceMood;
  movementPosition: Vec2;
  moodHue: number;
  weatherParticlesRef: { current: WeatherParticlesRef };
  dreamOutput: DreamOutput;
}

/**
 * Render all background layers (aurora, atmosphere, weather, habitat, dream).
 * Called after clearCanvas but before entity rendering.
 */
export function renderBackgroundLayers(inputs: BackgroundRenderInputs): void {
  const { engines, config, ctx, dt, timestamp, effectiveScreenW, effectiveScreenH, surfaceMood, movementPosition, moodHue, weatherParticlesRef, dreamOutput } = inputs;

  // --- Aurora background ---
  if (config.appearance.auroraBackground && !config.appearance.reducedMotion) {
    if (ctx) {
      if (!engines.auroraBackground) engines.auroraBackground = new AuroraBackgroundRenderer(ctx);
      const phase = engines.cachedCircadianOutput.phase ?? "afternoon";
      engines.auroraBackground.render(
        effectiveScreenW, effectiveScreenH,
        phase, surfaceMood, timestamp / 1000,
        0.8,
      );
    }
  }

  // --- Atmosphere ---
  if (engines.atmosphere && config.atmosphere.enabled) {
    const phase = engines.cachedCircadianOutput.phase ?? "morning";
    engines.atmosphere.update(
      dt, config.atmosphere, phase, surfaceMood,
      movementPosition, effectiveScreenW, effectiveScreenH,
    );
    const atmosParticles = engines.atmosphere.getParticles();
    if (atmosParticles.length > 0) {
      if (ctx) {
        if (!engines.atmosphereRenderer) engines.atmosphereRenderer = new AtmosphereRenderer(ctx);
        engines.atmosphereRenderer.renderAll(atmosParticles);
      }
    }
  }

  // --- Weather particles ---
  if (engines.weather && config.weather.enabled) {
    const weatherParticles = engines.weather.getParticleConfig();
    if (weatherParticles && weatherParticles.type !== "clear") {
      if (ctx) {
        const intensity = engines.weather.getState().intensity;
        const count = Math.floor(weatherParticles.density * intensity * 50);
        const wpState = weatherParticlesRef.current;

        if (wpState.type !== weatherParticles.type ||
            Math.abs(wpState.screenW - effectiveScreenW) > 50 ||
            Math.abs(wpState.screenH - effectiveScreenH) > 50 ||
            Math.abs(wpState.particles.length - count) > 10) {
          wpState.type = weatherParticles.type;
          wpState.screenW = effectiveScreenW;
          wpState.screenH = effectiveScreenH;
          wpState.particles = [];
          for (let i = 0; i < count; i++) {
            const isRain = weatherParticles.type === "rain";
            wpState.particles.push({
              x: Math.random() * effectiveScreenW,
              y: Math.random() * effectiveScreenH,
              vx: isRain ? -0.5 : (Math.random() - 0.5) * 0.3,
              vy: isRain ? 8 + Math.random() * 4 : 0.5 + Math.random() * 0.8,
              size: isRain ? 1 : (weatherParticles.type === "snow" ? 2 : 1.5),
            });
          }
        }

        ctx.save();
        ctx.globalAlpha = 0.3 * intensity;
        ctx.fillStyle = weatherParticles.color;
        for (const p of wpState.particles) {
          p.x += p.vx * dt * 60;
          p.y += p.vy * dt * 60;
          if (p.y > effectiveScreenH + 10) {
            p.y = -10;
            p.x = Math.random() * effectiveScreenW;
          }
          if (p.x < -10) p.x = effectiveScreenW + 10;
          if (p.x > effectiveScreenW + 10) p.x = -10;

          if (weatherParticles.type === "rain") {
            ctx.fillRect(p.x, p.y, 1, 8);
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  // --- Habitat objects ---
  if (engines.habitatObjects && config.habitatObjects.enabled) {
    const objects = engines.habitatObjects.getState().objects;
    if (objects.length > 0) {
      if (ctx) {
        ctx.save();
        for (const obj of objects) {
          const def = HABITAT_OBJECT_DEFS[obj.type];
          if (!def) continue;
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#666";
          ctx.beginPath();
          ctx.arc(obj.position.x, obj.position.y, def.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "16px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.globalAlpha = 0.8;
          ctx.fillText(def.icon, obj.position.x, obj.position.y);
        }
        ctx.restore();
      }
    }
  }

  // --- Dream particles ---
  if (ctx && dreamOutput.enabled && dreamOutput.particles.length > 0) {
    for (const p of dreamOutput.particles) {
      ctx.save();
      ctx.translate(p.position.x, p.position.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      const hue = (moodHue + p.hueShift + 360) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 70%, 0.8)`;
      ctx.strokeStyle = `hsla(${hue}, 70%, 80%, 0.5)`;
      ctx.lineWidth = 1;
      const s = p.size;
      switch (p.type) {
        case "star":
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.lineTo(Math.cos(a1) * s, Math.sin(a1) * s);
            ctx.lineTo(Math.cos(a2) * s * 0.4, Math.sin(a2) * s * 0.4);
          }
          ctx.closePath();
          ctx.fill();
          break;
        case "moon":
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath();
          ctx.arc(s * 0.4, -s * 0.2, s * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          break;
        case "cloud":
          ctx.beginPath();
          ctx.arc(-s * 0.5, 0, s * 0.6, 0, Math.PI * 2);
          ctx.arc(0, -s * 0.3, s * 0.7, 0, Math.PI * 2);
          ctx.arc(s * 0.5, 0, s * 0.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "fish":
          ctx.beginPath();
          ctx.ellipse(0, 0, s, s * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.lineTo(-s * 1.5, -s * 0.4);
          ctx.lineTo(-s * 1.5, s * 0.4);
          ctx.closePath();
          ctx.fill();
          break;
        case "butterfly":
          ctx.beginPath();
          ctx.ellipse(-s * 0.4, 0, s * 0.5, s * 0.7, -0.3, 0, Math.PI * 2);
          ctx.ellipse(s * 0.4, 0, s * 0.5, s * 0.7, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${hue}, 60%, 50%, 0.6)`;
          ctx.fillRect(-s * 0.1, -s * 0.5, s * 0.2, s);
          break;
        case "balloon":
          ctx.beginPath();
          ctx.ellipse(0, -s * 0.2, s * 0.6, s * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, s * 0.6);
          ctx.lineTo(-s * 0.15, s * 0.8);
          ctx.lineTo(s * 0.15, s * 0.8);
          ctx.closePath();
          ctx.fill();
          break;
        case "heart":
          ctx.beginPath();
          ctx.moveTo(0, s * 0.3);
          ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.3);
          ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.3);
          ctx.fill();
          break;
        case "music":
          ctx.beginPath();
          ctx.arc(-s * 0.4, s * 0.3, s * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-s * 0.15, -s * 0.5, s * 0.1, s * 0.8);
          ctx.fillRect(s * 0.1, -s * 0.6, s * 0.1, s * 0.9);
          ctx.beginPath();
          ctx.moveTo(-s * 0.15, -s * 0.5);
          ctx.lineTo(s * 0.2, -s * 0.6);
          ctx.lineTo(s * 0.2, -s * 0.3);
          ctx.lineTo(-s * 0.15, -s * 0.2);
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.beginPath();
          ctx.arc(0, 0, s, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
    }
  }
}
