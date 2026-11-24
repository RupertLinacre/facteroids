// Everything is drawn in a 480 × 256 orbital window, including the enlarged preview.
export const TAU = 2 * Math.PI;
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export function rand(n) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}
export function line(c, points, color, width = 1) {
  if (points.length < 2) return;
  c.beginPath();
  c.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
export function dot(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
const sprites = new Map();
export function glow(c, x, y, r, color, opacity = 1, stretch = 1) {
  let sprite = sprites.get(color);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = 96;
    const ctx = sprite.getContext("2d");
    const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, color + "ff");
    g.addColorStop(0.17, color + "bf");
    g.addColorStop(0.5, color + "35");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    sprites.set(color, sprite);
  }
  const alpha = c.globalAlpha;
  c.globalAlpha *= clamp(opacity);
  c.drawImage(sprite, x - r, y - r * stretch, r * 2, r * 2 * stretch);
  c.globalAlpha = alpha;
}
export function glint(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + r * 0.17, y - r * 0.18);
  c.lineTo(x + r * 0.8, y);
  c.lineTo(x + r * 0.15, y + r * 0.18);
  c.lineTo(x, y + r);
  c.lineTo(x - r * 0.14, y + r * 0.15);
  c.lineTo(x - r * 0.8, y);
  c.lineTo(x - r * 0.14, y - r * 0.18);
  c.closePath();
  c.fill();
}
function noise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const smooth = (n) => n * n * (3 - 2 * n);
  const u = smooth(x - ix),
    v = smooth(y - iy),
    w = smooth(z - iz);
  const hash = (i, j, k) => rand(i * 43 + j * 71 + k * 139);
  const mix = (a, b, f) => a + (b - a) * f;
  const slice = (k) =>
    mix(
      mix(hash(ix, iy, k), hash(ix + 1, iy, k), u),
      mix(hash(ix, iy + 1, k), hash(ix + 1, iy + 1, k), u),
      v,
    );
  return mix(slice(iz), slice(iz + 1), w);
}
// A small atlas of optically thin dust clouds. Density, light-facing edges
// and the irregular boundary come from the same three-octave noise field.
const clouds = new Map();
export function cloud(c, x, y, radius, variant, tint, opacity, stretch = 1) {
  const key = tint + variant;
  let image = clouds.get(key);
  if (!image) {
    const size = 72;
    image = document.createElement("canvas");
    image.width = image.height = size;
    const ctx = image.getContext("2d"),
      pixels = ctx.createImageData(size, size);
    const rgb = [1, 3, 5].map((start) =>
      parseInt(tint.slice(start, start + 2), 16),
    );
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const dx = ((i + 0.5) * 2) / size - 1,
          dy = ((j + 0.5) * 2) / size - 1;
        const coarse = noise(dx * 2.7, dy * 2.7, variant * 2.7);
        const fine = noise(dx * 7 + coarse, dy * 7, variant + 4.5);
        const density = clamp(
          (1 - Math.hypot(dx, dy)) * 1.9 - 0.78 + coarse * 0.83 + fine * 0.23,
        );
        const shade = 0.58 + 0.47 * fine + 0.18 * coarse - 0.1 * dy;
        const offset = (j * size + i) * 4;
        for (let k = 0; k < 3; k++) pixels.data[offset + k] = rgb[k] * shade;
        pixels.data[offset + 3] = density * density * 255;
      }
    ctx.putImageData(pixels, 0, 0);
    clouds.set(key, image);
  }
  const alpha = c.globalAlpha;
  c.globalAlpha *= clamp(opacity);
  c.drawImage(
    image,
    x - radius,
    y - radius * stretch,
    2 * radius,
    2 * radius * stretch,
  );
  c.globalAlpha = alpha;
}
