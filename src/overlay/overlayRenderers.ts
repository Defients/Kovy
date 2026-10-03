// ============================================================
// Overlay Canvas Renderers — extracted from KovyRenderer
// Handles drawing thought bubbles, whispers, and audio
// visualizer bars onto the canvas context.
// ============================================================

import { clamp } from "@/lib/utils";
import type { ThoughtOutput } from "@/engine/thoughtEngine";
import type { WhisperOutput } from "@/engine/whisperEngine";
import type { AudioReactivityOutput } from "@/engine/audioReactivityEngine";
import type { KovyConfig } from "@/store/types";

/** Render thought bubbles above entities */
export function renderThoughtBubbles(
  ctx: CanvasRenderingContext2D,
  thoughtOutput: ThoughtOutput,
): void {
  if (!thoughtOutput.enabled || thoughtOutput.bubbles.length === 0) return;

  for (const bubble of thoughtOutput.bubbles) {
    const alpha = Math.min(1, bubble.lifetime / 0.5, (bubble.maxLifetime - bubble.lifetime) / 0.5 + 0.3);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    const bx = bubble.position.x;
    const by = bubble.position.y;
    ctx.fillStyle = "rgba(30, 30, 40, 0.85)";
    ctx.strokeStyle = "rgba(100, 120, 140, 0.4)";
    ctx.lineWidth = 1;
    const textWidth = ctx.measureText(bubble.text).width;
    const bw = Math.max(textWidth + 16, 40);
    const bh = 24;
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 4, by + bh / 2);
    ctx.lineTo(bx, by + bh / 2 + 6);
    ctx.lineTo(bx + 4, by + bh / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220, 225, 235, 0.95)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bubble.text, bx, by);
    ctx.restore();
  }
}

/** Render whisper messages (softer, more intimate than thoughts) */
export function renderWhispers(
  ctx: CanvasRenderingContext2D,
  whisperOutput: WhisperOutput,
): void {
  if (!whisperOutput.enabled || whisperOutput.messages.length === 0) return;

  for (const msg of whisperOutput.messages) {
    const alpha = Math.min(1, msg.lifetime / 0.8, (msg.maxLifetime - msg.lifetime) / 0.8 + 0.2) * 0.8;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    const mx = msg.position.x;
    const my = msg.position.y;
    ctx.fillStyle = "rgba(20, 20, 30, 0.7)";
    const textWidth = ctx.measureText(msg.text).width;
    const mw = Math.max(textWidth + 20, 60);
    const mh = 28;
    ctx.beginPath();
    ctx.roundRect(mx - mw / 2, my - mh / 2, mw, mh, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 210, 230, 0.9)";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg.text, mx, my);
    ctx.restore();
  }
}

/** Render audio visualizer bars below entity */
export function renderAudioVisualizer(
  ctx: CanvasRenderingContext2D,
  audioOutput: AudioReactivityOutput,
  config: KovyConfig,
  position: { x: number; y: number },
  moodHue: number,
): void {
  if (!audioOutput.enabled || !config.audioReactivity.feedVisualizer) return;
  if (config.audioReactivity.visualizerStyle === "none") return;
  if (audioOutput.visualizerBars.length === 0) return;
  if (config.appearance.reducedMotion) return;

  const bars = audioOutput.visualizerBars;
  const barWidth = 2;
  const gap = 1;
  const totalWidth = bars.length * (barWidth + gap);
  const startX = position.x - totalWidth / 2;
  const baseY = position.y + 35 * config.appearance.size;
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < bars.length; i++) {
    const h = bars[i] * 20;
    ctx.fillStyle = `hsla(${moodHue}, 70%, 60%, 0.6)`;
    ctx.fillRect(startX + i * (barWidth + gap), baseY - h, barWidth, h);
  }
  ctx.restore();
}
