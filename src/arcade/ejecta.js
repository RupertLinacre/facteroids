import { disc, noise, path, tau } from "./drawing.js";
import { fireAt } from "./deployment.js";

// The projectile, its muzzle flash and the 3D rails share one anchored muzzle.
export function muzzleFlash(c, mount, t) {
  const age = t - mount.time,
    shot = age - fireAt;
  if (age < 0.17 || shot > 0.24) return;
  const charge =
    shot < 0 ? (age - 0.17) / (fireAt - 0.17) : Math.exp(-shot * 15);
  const { x, y } = mount.muzzle;
  c.save();
  c.translate(x, y);
  c.rotate(mount.aim);
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = charge;
  const r = 1.5 + charge * (shot < 0 ? 3 : 8),
    g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, "#fffbe5");
  g.addColorStop(0.22, mount.weapon.color);
  g.addColorStop(0.5, mount.weapon.color + "90");
  g.addColorStop(1, "#557fff00");
  disc(c, 0, 0, r, g);
  if (shot >= 0) {
    path(
      c,
      [
        [-4, 0],
        [3 + charge * 9, 0],
      ],
      "#d3fffa",
      2.3,
    );
    path(
      c,
      [
        [0, -5 * charge],
        [0, 5 * charge],
      ],
      "#90e1ff",
      1.4,
    );
  }
  c.restore();
}

function drawImpactDebris(c, event, age) {
  const { extent, duration, bias, count } = event.strike;
  const u = age / duration;
  if (u >= 1) return;
  c.save();
  c.translate(event.x, event.y);
  c.rotate(event.angle);
  for (let i = 0; i < count; i++) {
    const seed = i * 17.31 + event.x * 0.11 + event.y;
    const t = u - noise(seed) * 0.08;
    if (t <= 0) continue;
    const angle = (noise(seed + 1) - 0.5) * 2.48;
    const speed = extent * (1.25 + 2.7 * noise(seed + 2));
    const up = Math.cos(angle) * speed;
    const across = Math.sin(angle) * speed + extent * bias * 0.32;
    const gravity = extent * 3.9;
    const x = up * t - (gravity * t * t) / 2,
      y = across * t;
    if (x < 0) continue;
    const previous = Math.max(0, t - (i % 3 === 0 ? 0.12 : 0.055));
    const tx = up * previous - (gravity * previous * previous) / 2,
      ty = across * previous;
    const size = Math.max(
      0.7,
      Math.sqrt(extent / 105) * (1 + 2.4 * noise(seed + 4)),
    );
    c.globalAlpha = Math.min(1, t * 45, (1 - u) * 3.2);
    if (i % 4 === 0) {
      c.save();
      c.translate(x, y);
      c.rotate(angle + t * (4 + noise(seed) * 8));
      c.beginPath();
      c.moveTo(-size, -size * 0.55);
      c.lineTo(size * 0.4, -size);
      c.lineTo(size, size * 0.35);
      c.lineTo(-size * 0.35, size * 0.8);
      c.closePath();
      c.fillStyle = "#58352f";
      c.fill();
      path(
        c,
        [
          [-size, -size * 0.55],
          [size * 0.4, -size],
          [size, size * 0.35],
        ],
        t < 0.36 ? "#ffce8d" : "#b7754e",
        1,
      );
      c.restore();
    } else {
      const streak = c.createLinearGradient(tx, ty, x, y);
      streak.addColorStop(0, "#b6583200");
      streak.addColorStop(0.74, t < 0.33 ? "#ff9b51b0" : "#b6674890");
      streak.addColorStop(1, t < 0.33 ? "#fff2c4" : "#dfa071");
      c.strokeStyle = streak;
      c.lineWidth = size * 0.85;
      c.beginPath();
      c.moveTo(tx, ty);
      const halfStep = (t - previous) / 2;
      c.quadraticCurveTo(
        tx + (up - gravity * previous) * halfStep,
        ty + across * halfStep,
        x,
        y,
      );
      c.stroke();
      disc(c, x, y, size * 0.55, t < 0.33 ? "#fff2cf" : "#ec9461");
    }
  }
  c.restore();
}

export function drawEjecta(c, event, t) {
  const age = t - event.time;
  if (event.strike) return drawImpactDebris(c, event, age);
  const duration = event.weapon.blastDuration,
    progress = age / duration;
  if (progress >= 1) return;
  const power = event.weapon?.power ?? 1;
  const tier = event.weapon?.chassis ?? 0;
  const scale = Math.max(0.65, Math.min(1.55, event.radius / 22));
  c.save();
  c.translate(event.x, event.y);
  for (let i = 0; i < Math.round(18 * power + 8 * tier); i++) {
    const seed = i * 7.31 + event.x * 0.13 + event.y * 0.23;
    const a = noise(seed) * tau;
    const motion =
      (100 + 17 * tier) *
      scale *
      (0.29 + 0.85 * noise(seed + 6)) *
      (1 - Math.exp(-age * 3.8));
    const x = Math.cos(a) * motion,
      y = Math.sin(a) * motion;
    const size = 4.2 * (0.4 + noise(seed + 7)) * (1 - progress);
    c.globalAlpha = Math.min(1, (1 - progress) * 2);
    if (i % 3 === 0) {
      c.save();
      c.translate(x, y);
      c.rotate(seed + age * (3 + noise(seed) * 6));
      c.fillStyle = "#658fc3";
      c.beginPath();
      c.moveTo(-size, -size * 0.3);
      c.lineTo(size * 0.3, -size * 0.7);
      c.lineTo(size, size * 0.2);
      c.lineTo(-size * 0.5, size);
      c.closePath();
      c.fill();
      path(
        c,
        [
          [-size, -size * 0.3],
          [size * 0.3, -size * 0.7],
          [size, size * 0.2],
        ],
        "#cbfaff",
        1,
      );
      c.restore();
    } else {
      const tail = 8 * (1 - progress);
      path(
        c,
        [
          [x - Math.cos(a) * tail, y - Math.sin(a) * tail],
          [x, y],
        ],
        event.weapon.color,
        1.4,
      );
      disc(c, x, y, 0.65 + size * 0.25, "#ddffff");
    }
  }
  c.restore();
}
