export const TRAIL_LIMIT = 115;
export const W = 900,
  H = 440,
  tau = Math.PI * 2;
export function surface(canvas) {
  const ctx = canvas.getContext("2d");
  return {
    ctx,
    begin() {
      const dpr = Math.min(devicePixelRatio, 2);
      const w = Math.round(canvas.clientWidth * dpr),
        h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
    },
  };
}
export function disc(c, x, y, r, fill, stroke) {
  c.beginPath();
  c.arc(x, y, r, 0, tau);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
export function path(c, points, color, width = 1) {
  if (!points.length) return;
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) c.lineTo(x, y);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
  c.lineWidth = 1;
}
export function label(c, text, x, y, size = 18, ink = "#fff7d6") {
  c.fillStyle = ink;
  c.font = "bold " + size + "px ui-monospace,monospace";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x, y);
}
export function noise(i) {
  const v = Math.sin(i * 12.9898 + 7.33) * 43758.5453;
  return v - Math.floor(v);
}
