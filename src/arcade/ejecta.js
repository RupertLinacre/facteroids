import { disc, noise, path, tau } from "./drawing.js";
import { fireAt } from "./deployment.js";

// The nose follows a single predicted intercept. Motor, fins and vapour all
// use the same launch axis, even while the target moves across the sightline.
export function drawMissile(c, shot) {
  if (shot.age < fireAt) return;
  const { muzzle, intercept, aim, weapon } = shot.mount;
  const u = (shot.age - fireAt) / (shot.duration - fireAt);
  const travel =
    Math.hypot(intercept.x - muzzle.x, intercept.y - muzzle.y) *
    (0.32 * u + 0.68 * u * u);
  const { color, chassis, power } = weapon;
  c.save();
  c.translate(muzzle.x, muzzle.y);
  c.rotate(aim);
  // Reveal the projectile as it clears the barrel, even at point-blank range.
  c.beginPath();
  c.rect(0, -32, travel + 2, 64);
  c.clip();
  c.translate(travel, 0);
  c.scale(power, power);
  const length = 22,
    aft = -length;
  function shape(points, fill) {
    c.beginPath();
    for (const [i, [x, y]] of points.entries())
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  const exhaust = 18 + 26 * u;
  const plume = c.createLinearGradient(aft - exhaust, 0, aft, 0);
  plume.addColorStop(0, color + "00");
  plume.addColorStop(0.58, color + "92");
  plume.addColorStop(1, "#f6ffff");
  c.shadowColor = color;
  c.shadowBlur = 7;
  shape(
    [
      [aft, -2.4],
      [aft - 6, -3.1],
      [aft - exhaust, 0],
      [aft - 6, 3.1],
      [aft, 2.4],
    ],
    plume,
  );
  c.shadowBlur = 0;
  const casing = c.createLinearGradient(0, -3.5, 0, 3.5);
  casing.addColorStop(0, "#8397af");
  casing.addColorStop(0.3, "#ffffff");
  casing.addColorStop(0.53, "#ccdaed");
  casing.addColorStop(1, "#45546d");
  for (const side of [-1, 1]) {
    const span = 5.7 + chassis;
    shape(
      [
        [-12, side * 1.8],
        [-21, side * span],
        [-24, side * span],
        [-21, side * 1.6],
      ],
      color,
    );
    if (chassis === 1)
      shape(
        [
          [-6, side * 2],
          [-11, side * 4.8],
          [-21, side * 4.8],
          [-21, side * 2],
        ],
        casing,
      );
  }
  shape(
    [
      [0, 0],
      [-5.5, -2.3],
      [-10, -3],
      [-21, -2.8],
      [aft, -1.7],
      [aft, 1.7],
      [-21, 2.8],
      [-10, 3],
      [-5.5, 2.3],
    ],
    casing,
  );
  c.fillStyle = color;
  c.fillRect(-9, -2.5, 2.2, 5);
  if (chassis === 2) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = "#473365";
      c.fillRect(-19 + i * 3, -3.6, 2.2, 7.2);
      c.fillStyle = color;
      c.fillRect(-19 + i * 3, -2.8, 1, 5.6);
    }
  }
  c.restore();
}

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
  const r = (3 + charge * (shot < 0 ? 6 : 19)) * mount.weapon.power,
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
        [7 + charge * 22, 0],
      ],
      "#d3fffa",
      2.3,
    );
    path(
      c,
      [
        [0, -11 * charge],
        [0, 11 * charge],
      ],
      "#90e1ff",
      1.4,
    );
  }
  c.restore();
}

export function drawEjecta(c, event, t) {
  const age = t - event.time,
    ground = event.type === "impact";
  const duration = ground ? 2.25 : 0.88,
    progress = age / duration;
  if (progress >= 1) return;
  const power = event.weapon?.power ?? 1;
  const scale = Math.max(0.65, Math.min(1.55, event.radius / 22)) * power;
  c.save();
  c.translate(event.x, event.y);
  c.rotate(ground ? event.angle : 0);
  for (let i = 0; i < (ground ? 42 : Math.round(18 * power)); i++) {
    const seed = i * 7.31 + event.x * 0.13 + event.y * 0.23;
    const a = ground ? (noise(seed) - 0.5) * Math.PI * 1.28 : noise(seed) * tau;
    const motion =
      (ground ? 145 : 100) *
      scale *
      (0.29 + 0.85 * noise(seed + 6)) *
      (1 - Math.exp(-age * (ground ? 1.7 : 3.8)));
    const x = Math.cos(a) * motion - (ground ? age * age * 13 : 0),
      y = Math.sin(a) * motion;
    const size =
      (ground ? 3.5 : 4.2) * (0.4 + noise(seed + 7)) * (1 - progress);
    c.globalAlpha = Math.min(1, (1 - progress) * 2);
    if (i % 3 === 0) {
      c.save();
      c.translate(x, y);
      c.rotate(seed + age * (3 + noise(seed) * 6));
      c.fillStyle = ground ? "#492f3c" : "#658fc3";
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
        ground ? "#ffad60" : "#cbfaff",
        1,
      );
      c.restore();
    } else {
      const tail = (ground ? 14 : 8) * (1 - progress);
      path(
        c,
        [
          [x - Math.cos(a) * tail, y - Math.sin(a) * tail],
          [x, y],
        ],
        ground ? "#ed813b" : event.weapon.color,
        1.4,
      );
      disc(c, x, y, 0.65 + size * 0.25, ground ? "#ffe0a3" : "#ddffff");
    }
  }
  c.restore();
}
