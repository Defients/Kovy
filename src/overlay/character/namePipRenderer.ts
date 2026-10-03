export function drawNamePip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  name: string,
  moodColor: string,
): void {
  ctx.save();

  const pipY = cy - radius - 15;

  ctx.font = "600 10px sans-serif";
  const textWidth = ctx.measureText(name).width;
  const paddingX = 8;
  const paddingY = 4;
  const bgWidth = textWidth + paddingX * 2;
  const bgHeight = 10 + paddingY * 2;

  ctx.beginPath();
  ctx.roundRect(cx - bgWidth / 2, pipY - bgHeight / 2, bgWidth, bgHeight, bgHeight / 2);
  ctx.fillStyle = "rgba(15, 20, 30, 0.6)";
  ctx.fill();

  ctx.lineWidth = 1;
  ctx.strokeStyle = moodColor.replace(/[\d.]+\)$/, "0.4)");
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, cx, pipY);

  ctx.restore();
}
