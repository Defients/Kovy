// ============================================================
// Accessory Renderer — mood/weather-triggered accessories
// Sleep cap, party hat, flower crown, winter hat, leaf, sparkle aura
// ============================================================

import type { SurfaceMood, BehaviorState } from "@/store/types";

type WeatherType = "clear" | "cloudy" | "rain" | "storm" | "snow" | "fog" | "aurora";

interface AccessoryState {
  type: "sleep_cap" | "party_hat" | "flower_crown" | "winter_hat" | "leaf" | "sparkle_aura" | "lotus" | "music_note";
  time: number;
}

export class AccessoryRenderer {
  private ctx: CanvasRenderingContext2D;
  private currentState: AccessoryState | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(
    cx: number,
    cy: number,
    radius: number,
    mood: SurfaceMood,
    behaviorState: BehaviorState,
    weatherType: string | undefined,
    time: number,
    opacity: number,
    reducedMotion: boolean,
  ): void {
    const accessory = this.determineAccessory(mood, behaviorState, weatherType);
    if (!accessory) return;

    const ctx = this.ctx;
    const animTime = reducedMotion ? 0 : time;
    const topY = cy - radius;

    ctx.save();
    ctx.globalAlpha = opacity;

    switch (accessory) {
      case "sleep_cap":
        this.drawSleepCap(ctx, cx, topY, radius, animTime);
        break;
      case "party_hat":
        this.drawPartyHat(ctx, cx, topY, radius, animTime);
        break;
      case "flower_crown":
        this.drawFlowerCrown(ctx, cx, topY, radius, animTime);
        break;
      case "winter_hat":
        this.drawWinterHat(ctx, cx, topY, radius, animTime);
        break;
      case "leaf":
        this.drawLeaf(ctx, cx, topY, radius, animTime);
        break;
      case "sparkle_aura":
        this.drawSparkleAura(ctx, cx, cy, radius, animTime);
        break;
      case "lotus":
        this.drawLotus(ctx, cx, topY, radius, animTime);
        break;
      case "music_note":
        this.drawMusicNote(ctx, cx, topY, radius, animTime);
        break;
    }

    ctx.restore();
  }

  private determineAccessory(
    mood: SurfaceMood,
    behaviorState: BehaviorState,
    weatherType: string | undefined,
  ): AccessoryState["type"] | null {
    // Sleep cap for nap/dream states
    if (behaviorState === "nap" || behaviorState === "dream") {
      return "sleep_cap";
    }
    // Party hat for celebrate
    if (behaviorState === "celebrate") {
      return "party_hat";
    }
    // Lotus halo for meditate
    if (behaviorState === "meditate") {
      return "lotus";
    }
    // Music note for dance
    if (behaviorState === "dance") {
      return "music_note";
    }
    // Weather-based accessories take priority over mood-based
    if (weatherType === "snow") {
      return "winter_hat";
    }
    if (weatherType === "rain" || weatherType === "storm") {
      return "leaf";
    }
    // Flower crown for playful idle
    if (mood === "playful" && (behaviorState === "idle_float" || behaviorState === "perch")) {
      return "flower_crown";
    }
    // Sparkle aura for excited
    if (mood === "excited") {
      return "sparkle_aura";
    }
    return null;
  }

  private drawSleepCap(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const capW = radius * 0.7;
    const capH = radius * 0.6;
    const tilt = Math.sin(time * 0.8) * 0.08;
    const pomBob = Math.sin(time * 1.2) * 2;

    ctx.save();
    ctx.translate(cx, topY);
    ctx.rotate(tilt);

    // Cap body (soft blue)
    ctx.beginPath();
    ctx.moveTo(-capW * 0.5, 0);
    ctx.quadraticCurveTo(-capW * 0.3, -capH, capW * 0.1, -capH * 0.9);
    ctx.quadraticCurveTo(capW * 0.3, -capH * 0.7, capW * 0.4, -capH * 0.3);
    ctx.lineTo(capW * 0.3, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(120, 140, 200, 0.85)";
    ctx.fill();

    // Cap brim
    ctx.beginPath();
    ctx.ellipse(0, 0, capW * 0.45, capW * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 120, 180, 0.9)";
    ctx.fill();

    // Pom-pom
    ctx.beginPath();
    ctx.arc(capW * 0.15, -capH * 0.95 + pomBob, capW * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 220, 240, 0.9)";
    ctx.fill();

    ctx.restore();
  }

  private drawPartyHat(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const hatW = radius * 0.6;
    const hatH = radius * 0.8;
    const bounce = Math.sin(time * 4) * 2;

    ctx.save();
    ctx.translate(cx, topY + bounce);

    // Hat cone
    ctx.beginPath();
    ctx.moveTo(-hatW * 0.5, 0);
    ctx.lineTo(0, -hatH);
    ctx.lineTo(hatW * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 100, 150, 0.9)";
    ctx.fill();

    // Stripes
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const y = -hatH * (i + 1) / 5;
      ctx.beginPath();
      ctx.moveTo(-hatW, y);
      ctx.lineTo(hatW, y - hatH * 0.08);
      ctx.strokeStyle = "rgba(255, 220, 80, 0.7)";
      ctx.lineWidth = hatH * 0.06;
      ctx.stroke();
    }
    ctx.restore();

    // Pom-pom at tip
    ctx.beginPath();
    ctx.arc(0, -hatH + bounce * 0.5, hatW * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 220, 80, 0.9)";
    ctx.fill();

    ctx.restore();
  }

  private drawFlowerCrown(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const crownR = radius * 0.75;
    const flowerCount = 6;
    const flowerR = radius * 0.1;

    ctx.save();
    ctx.translate(cx, topY + radius * 0.1);

    for (let i = 0; i < flowerCount; i++) {
      const angle = -Math.PI + (i / (flowerCount - 1)) * Math.PI;
      const sway = Math.sin(time * 1.5 + i * 0.7) * 0.03;
      const fx = Math.cos(angle + sway) * crownR;
      const fy = Math.sin(angle + sway) * crownR * 0.5;

      // Petals
      const petalCount = 5;
      ctx.fillStyle = `rgba(255, ${180 + Math.sin(i) * 30}, ${200 + Math.cos(i) * 20}, 0.85)`;
      for (let p = 0; p < petalCount; p++) {
        const pa = (p / petalCount) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(pa) * flowerR * 0.5, fy + Math.sin(pa) * flowerR * 0.5, flowerR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.beginPath();
      ctx.arc(fx, fy, flowerR * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 230, 100, 0.9)";
      ctx.fill();
    }

    ctx.restore();
  }

  private drawWinterHat(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const hatW = radius * 0.8;
    const hatH = radius * 0.45;
    const pomBob = Math.sin(time * 1.5) * 1.5;

    ctx.save();
    ctx.translate(cx, topY);

    // Hat body (beanie)
    ctx.beginPath();
    ctx.moveTo(-hatW * 0.5, 0);
    ctx.quadraticCurveTo(-hatW * 0.5, -hatH, 0, -hatH);
    ctx.quadraticCurveTo(hatW * 0.5, -hatH, hatW * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(180, 100, 120, 0.9)";
    ctx.fill();

    // Hat brim (folded)
    ctx.beginPath();
    ctx.ellipse(0, 0, hatW * 0.55, hatW * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(150, 80, 100, 0.95)";
    ctx.fill();

    // Pom-pom
    ctx.beginPath();
    ctx.arc(0, -hatH + pomBob, hatW * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(240, 240, 250, 0.9)";
    ctx.fill();

    ctx.restore();
  }

  private drawLeaf(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const leafW = radius * 1.1;
    const leafH = radius * 0.4;
    const sway = Math.sin(time * 1.5) * 0.06;

    ctx.save();
    ctx.translate(cx, topY - radius * 0.15);
    ctx.rotate(sway);

    // Leaf shape
    ctx.beginPath();
    ctx.moveTo(-leafW * 0.5, 0);
    ctx.quadraticCurveTo(0, -leafH, leafW * 0.5, 0);
    ctx.quadraticCurveTo(0, leafH * 0.3, -leafW * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(100, 180, 80, 0.85)";
    ctx.fill();

    // Leaf vein
    ctx.beginPath();
    ctx.moveTo(-leafW * 0.4, 0);
    ctx.lineTo(leafW * 0.4, 0);
    ctx.strokeStyle = "rgba(70, 140, 60, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawSparkleAura(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, time: number): void {
    const count = 6;
    const orbitR = radius * 1.15;

    for (let i = 0; i < count; i++) {
      const angle = time * 1.5 + (i / count) * Math.PI * 2;
      const x = cx + Math.cos(angle) * orbitR;
      const y = cy + Math.sin(angle) * orbitR * 0.8 - radius * 0.3;
      const size = radius * 0.06;
      const twinkle = 0.5 + Math.sin(time * 4 + i) * 0.3;

      ctx.save();
      ctx.globalAlpha = twinkle;
      ctx.translate(x, y);
      ctx.rotate(time * 2 + i);

      // 4-point sparkle
      ctx.strokeStyle = "rgba(255, 230, 120, 0.8)";
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 240, 150, 0.9)";
      ctx.fill();

      ctx.restore();
    }
  }

  private drawLotus(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const haloR = radius * 0.35;
    const pulse = 0.7 + Math.sin(time * 0.8) * 0.15;
    const yOff = -radius * 0.15;

    ctx.save();
    ctx.translate(cx, topY + yOff);

    // Outer glowing ring
    const grad = ctx.createRadialGradient(0, 0, haloR * 0.3, 0, 0, haloR);
    grad.addColorStop(0, `rgba(200, 220, 255, ${0.3 * pulse})`);
    grad.addColorStop(0.6, `rgba(180, 200, 240, ${0.15 * pulse})`);
    grad.addColorStop(1, "rgba(180, 200, 240, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Lotus petals
    const petals = 8;
    ctx.fillStyle = `rgba(220, 230, 250, ${0.6 * pulse})`;
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, -haloR * 0.5, haloR * 0.12, haloR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Center glow
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, haloR * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawMusicNote(ctx: CanvasRenderingContext2D, cx: number, topY: number, radius: number, time: number): void {
    const noteSize = radius * 0.25;
    const bob = Math.sin(time * 3) * 3;
    const xOff = radius * 0.3;

    ctx.save();
    ctx.translate(cx + xOff, topY - radius * 0.2 + bob);

    // Note head
    ctx.fillStyle = "rgba(180, 200, 240, 0.85)";
    ctx.beginPath();
    ctx.ellipse(0, noteSize * 0.3, noteSize * 0.3, noteSize * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = "rgba(180, 200, 240, 0.85)";
    ctx.lineWidth = Math.max(1, noteSize * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(noteSize * 0.22, noteSize * 0.25);
    ctx.lineTo(noteSize * 0.22, -noteSize * 0.7);
    ctx.stroke();

    // Flag
    ctx.beginPath();
    ctx.moveTo(noteSize * 0.22, -noteSize * 0.7);
    ctx.quadraticCurveTo(noteSize * 0.6, -noteSize * 0.5, noteSize * 0.45, -noteSize * 0.1);
    ctx.stroke();

    ctx.restore();
  }
}
