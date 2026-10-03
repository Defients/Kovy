// ============================================================
// Toy Renderer — draws toys on the overlay canvas
// ============================================================

import { TOY_DEFINITIONS } from "@/engine/toyEngine";
import type { PlacedToy } from "@/store/types";

export function drawToys(
  ctx: CanvasRenderingContext2D,
  toys: PlacedToy[],
  consumedIds: Set<string>,
  time: number,
): void {
  for (const toy of toys) {
    if (consumedIds.has(toy.id)) continue;
    const def = TOY_DEFINITIONS[toy.type];
    const { x, y } = toy.position;
    const size = def.size;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toy.rotation);

    switch (toy.type) {
      case "ball": {
        // Orange ball with bounce squish
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "balloon": {
        // Pink balloon with string
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(0, -size * 0.3, size * 0.7, size, 0, 0, Math.PI * 2);
        ctx.fill();
        // Knot
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.moveTo(-3, size * 0.5);
        ctx.lineTo(3, size * 0.5);
        ctx.lineTo(0, size * 0.7);
        ctx.fill();
        // String
        ctx.strokeStyle = "rgba(200,200,200,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, size * 0.7);
        ctx.quadraticCurveTo(
          Math.sin(time * 0.003) * 5, size * 1.5,
          0, size * 2.5,
        );
        ctx.stroke();
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.ellipse(-size * 0.25, -size * 0.5, size * 0.15, size * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "block": {
        // Purple block
        ctx.fillStyle = def.color;
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
        // Brick pattern
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, -size);
        ctx.lineTo(0, 0);
        ctx.moveTo(-size * 0.5, 0);
        ctx.lineTo(-size * 0.5, size);
        ctx.moveTo(size * 0.5, 0);
        ctx.lineTo(size * 0.5, size);
        ctx.stroke();
        break;
      }
      case "bed": {
        // Blue bed icon
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.roundRect(-size, -size * 0.5, size * 2, size, size * 0.3);
        ctx.fill();
        // Pillow
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.roundRect(-size * 0.8, -size * 0.4, size * 0.5, size * 0.3, 3);
        ctx.fill();
        // Zzz
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${size * 0.5}px sans-serif`;
        ctx.fillText("z", size * 0.3, -size * 0.5 + Math.sin(time * 0.003) * 2);
        break;
      }
      case "laser": {
        // Red dot with glow
        const pulse = 0.7 + Math.sin(time * 0.01) * 0.3;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case "treat": {
        // Cookie/biscuit
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        // Chocolate chips
        ctx.fillStyle = "rgba(60,30,10,0.6)";
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * size * 0.4, Math.sin(angle) * size * 0.4, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "mouse": {
        // Grey toy mouse
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.arc(-size * 0.6, -size * 0.5, size * 0.3, 0, Math.PI * 2);
        ctx.arc(size * 0.6, -size * 0.5, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.arc(-size * 0.2, -size * 0.1, 1.5, 0, Math.PI * 2);
        ctx.arc(size * 0.2, -size * 0.1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.strokeStyle = "rgba(150,150,150,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.quadraticCurveTo(size * 1.5, size * 0.3, size * 1.8, 0);
        ctx.stroke();
        break;
      }
      case "music_box": {
        // Golden music box with notes
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.roundRect(-size, -size * 0.6, size * 2, size * 1.2, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Music notes floating
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${size * 0.5}px sans-serif`;
        const noteOffset = Math.sin(time * 0.004) * 3;
        ctx.fillText("♪", -size * 0.3, -size * 0.8 + noteOffset);
        ctx.fillText("♫", size * 0.1, -size * 0.8 - noteOffset);
        break;
      }
      case "mirror": {
        // Mirror with reflective surface
        ctx.fillStyle = "rgba(200,200,220,0.3)";
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.7, size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Reflection shimmer
        const shimmer = Math.sin(time * 0.003) * 0.2 + 0.3;
        ctx.fillStyle = `rgba(255,255,255,${shimmer})`;
        ctx.beginPath();
        ctx.ellipse(-size * 0.2, -size * 0.3, size * 0.15, size * 0.4, 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }
}
