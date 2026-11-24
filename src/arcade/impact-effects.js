import { clamp, cloud, dot, glint, glow, line, rand } from "./effect-paint.js";

function debris(c, t) {
  for (let i = 0; i < 90; i++) {
    const age = t - rand(i + 42) * 0.28;
    if (age <= 0) continue;
    const life = 1.05 + rand(i + 73) * 1.3;
    if (age > life) continue;
    const vx = (rand(i + 8) - 0.41) * 121,
      vy = -(21 + rand(i + 17) * 89);
    const x = vx * age,
      y = vy * age + 30 * age * age;
    if (y > 2) continue;
    c.save();
    c.globalAlpha *= clamp((life - age) * 2);
    const color = i % 4 ? "#ffb56e" : "#fff4c3";
    line(
      c,
      [
        { x: x - vx * 0.1, y: y - (vy + 60 * age) * 0.1 },
        { x, y },
      ],
      color,
      0.55 + rand(i) * 1.2,
    );
    if (i % 4 === 0) dot(c, x, y, 1.15, "#ffebc0");
    c.restore();
  }
}
function ballisticEjecta(c, age) {
  debris(c, age);
  for (let i = 0; i < 18; i++) {
    const u = rand(i + 29),
      dir = u - 0.5;
    const px = dir * age * 63,
      py = -Math.sin(u * Math.PI) * Math.min(age, 1) * 9;
    cloud(
      c,
      px,
      py,
      5 + age * (6 + u * 5),
      i % 4,
      "#de995f",
      0.37 * Math.exp(-age * 0.8),
    );
  }
}
function rollingDust(c, age, radius) {
  for (let i = 0; i < 90; i++) {
    const u = rand(i + 32),
      d =
        (i % 2 ? 1 : -1) *
        u *
        (1 - Math.exp(-age * 1.1)) *
        Math.min(76, radius * 0.95);
    const ground = radius - Math.sqrt(Math.max(0, radius * radius - d * d));
    const h =
      (3 + rand(i + 50) * 19) *
      Math.sin(Math.min(1, age * 0.9) * Math.PI * 0.66);
    cloud(
      c,
      d,
      ground - h * (0.3 + 0.7 * u),
      3 + (5 + rand(i + 66) * 15) * Math.min(age, 1.5),
      i % 4,
      i % 4 ? "#bb744b" : "#ffca89",
      0.45 * Math.exp(-age * 0.46),
    );
  }
}
// Local x follows the surface tangent, with negative y above the surface.
export function drawImpact(c, planet, angle, age, scale = 1) {
  if (age < 0) return;
  const { x, y, r } = planet;
  c.save();
  c.translate(x + Math.cos(angle) * (r - 2), y + Math.sin(angle) * (r - 2));
  c.rotate(angle + Math.PI / 2);
  c.scale(scale, scale);
  c.globalCompositeOperation = "lighter";
  glow(c, 0, 0, 14, "#ff662a", Math.exp(-age * 0.95), 0.43);
  const fade = clamp((3 - age) / 0.95);
  c.globalAlpha = fade;
  // Incandescent vapour briefly lights the ground beneath the changing plume.
  glow(c, 0, 3, 25 + 19 * age, "#ff993c", 0.85 * Math.exp(-age * 2.75), 0.38);
  rollingDust(c, age, r / scale);
  ballisticEjecta(c, age);
  const flash = Math.exp(-age * 6.3);
  glow(c, 0, -1, 29 + age * 9, "#ffe5ac", flash);
  glint(c, 0, -1, flash * 17, "#fff8e1");
  c.restore();
}
