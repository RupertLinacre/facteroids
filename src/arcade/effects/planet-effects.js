import { clamp, cloud, dot, glint, glow, line, rand, TAU } from "./paint.js";

const skies = {
  "dust-limb": ["#ffac6a", "#698cf1", 0.26],
  blue: ["#5fd4ff", "#546dff", 0.34],
  layers: ["#f6aa62", "#76dfae", 0.29],
  aurora: ["#51edc1", "#a47bff", 0.35],
  storm: ["#ffb378", "#c15730", 0.35],
  corona: ["#ffe5b1", "#ff9553", 0.36],
  noctilucent: ["#a1ceff", "#706dcc", 0.32],
  eclipse: ["#ffdc9e", "#8372e2", 0.26],
  magnetic: ["#c7a1ff", "#7074fc", 0.36],
};
function rimLine(c, r, from, to, color, width, wave) {
  const points = [];
  for (let i = 0; i <= 64; i++) {
    const a = from + ((to - from) * i) / 64,
      d = r + wave(a);
    points.push({ x: Math.cos(a) * d, y: Math.sin(a) * d });
  }
  line(c, points, color, width);
}
// The disk is painted after the halo. No atmospheric haze covers the terrain.
export function atmosphere(c, id, { x, y, r }, t) {
  const [base, high, depth] = skies[id];
  c.save();
  c.translate(x, y);
  c.globalCompositeOperation = "lighter";
  const extent = r * (1 + depth);
  const g = c.createRadialGradient(0, 0, r - 0.5, 0, 0, extent);
  g.addColorStop(0, base + (id === "eclipse" ? "9a" : "d0"));
  g.addColorStop(0.1, base + "71");
  g.addColorStop(0.37, high + "29");
  g.addColorStop(1, high + "00");
  dot(c, 0, 0, extent, g);
  const polar = (a, h) => ({
    x: Math.cos(a) * (r + h),
    y: Math.sin(a) * (r + h),
  });
  switch (id) {
    case "dust-limb":
    case "blue":
    case "eclipse": {
      const eclipse = id === "eclipse",
        blue = id === "blue";
      for (let i = 0; i < 70; i++) {
        const a = 2.4 + i * 0.044,
          sun = Math.max(0, Math.cos(a - 3.98));
        const p = polar(a, 0.6);
        glow(
          c,
          p.x,
          p.y,
          (eclipse ? 4 : blue ? 7 : 4) * (0.5 + sun),
          base,
          (eclipse ? 0.91 : 0.24) * sun ** (eclipse ? 8 : 2),
        );
      }
      if (eclipse) {
        const p = polar(3.9, 1);
        glow(c, p.x, p.y, 17, "#ffc889", 0.8);
        glint(c, p.x, p.y, 6, "#fff9d4");
      }
      if (blue) rimLine(c, r + 0.5, 1.9, 3.35, "#ffbc8fba", 1, () => 0);
      break;
    }
    case "layers":
      for (let j = 0; j < 6; j++) {
        const h = r * (0.045 + j * 0.032);
        rimLine(
          c,
          r + h,
          2.72 - j * 0.08,
          5.82 - j * 0.07,
          (j % 2 ? high : base) + "75",
          j % 3 === 0 ? 1.1 : 0.55,
          (a) => Math.sin(a * 4 + t * 0.2) * 0.7,
        );
      }
      break;
    case "aurora":
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 100; i++) {
          const a = (j ? 1.56 : 3.85) + i * 0.014,
            wave = Math.sin(a * 12 + t * 0.8);
          const h =
            r *
            (0.15 + 0.07 * wave + 0.05 * Math.sin(a * 24 - t * 0.6)) *
            Math.sin((i / 100) * Math.PI);
          const foot = polar(a, r * 0.038 + wave * 2),
            top = polar(a + 0.036, h + 4);
          const grad = c.createLinearGradient(foot.x, foot.y, top.x, top.y);
          grad.addColorStop(0, base + "80");
          grad.addColorStop(0.48, base + "41");
          grad.addColorStop(1, high + "00");
          line(c, [foot, top], grad, 1.7);
        }
      break;
    case "storm":
      for (let j = 0; j < 68; j++) {
        const a = 2.5 + rand(j + 96) * 3.3 + 0.06 * Math.sin(t * 0.45 + j),
          h = (0.055 + 0.08 * rand(j + 16) + 0.04 * Math.sin(a * 8 - t)) * r,
          p = polar(a, h);
        cloud(
          c,
          p.x,
          p.y,
          3 + r * 0.11 * (0.45 + rand(j + 6)),
          j % 4,
          j % 3 ? base : high,
          0.4,
        );
      }
      break;
    case "corona":
      for (let i = 0; i < 128; i++) {
        const a = rand(i + 9) * TAU,
          length =
            r *
            (0.07 + 0.35 * rand(i + 73) ** 2) *
            (0.57 + 0.48 * Math.cos(a - 3.8) ** 2);
        const p = polar(a, 1),
          q = polar(
            a + 0.01 * Math.sin(i + t * 0.3),
            length * (1 + 0.08 * Math.sin(t + i)),
          );
        const g = c.createLinearGradient(p.x, p.y, q.x, q.y);
        g.addColorStop(0, base + "8f");
        g.addColorStop(1, high + "00");
        line(c, [p, q], g, 0.45 + rand(i + 41) * 0.8);
      }
      break;
    case "noctilucent":
      for (let j = 0; j < 18; j++) {
        const angle = 2.95 + rand(j + 40) * 2;
        rimLine(
          c,
          r * (1.06 + 0.13 * rand(j + 6)),
          angle,
          angle + 0.25 + rand(j + 12) * 0.85,
          j % 3 ? "#afd9ff79" : "#f0f4ff94",
          0.72,
          (a) =>
            2 * Math.sin(a * 16 + t * 0.4 + j * 0.43) + Math.sin(a * 29 - j),
        );
      }
      break;
    case "magnetic":
      for (let j = 0; j < 17; j++) {
        const a = 2.1 + j * 0.217,
          points = [];
        for (let k = 0; k <= 30; k++) {
          const f = k / 30;
          points.push(
            polar(
              a + f * (0.26 + rand(j) * 0.32),
              Math.sin(f * Math.PI) *
                r *
                (0.09 + 0.24 * rand(j + 78)) *
                (0.93 + 0.07 * Math.sin(t + j)),
            ),
          );
        }
        line(c, points, j % 3 ? high + "95" : base + "c9", j % 4 ? 0.8 : 1.4);
      }
      break;
  }
  c.restore();
}

function ellipse(c, x, y, rx, ry, color, fill = false, width = 1) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) {
    c.fillStyle = color;
    c.fill();
  } else {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  }
}
function debris(c, t, count, mode) {
  const speed = mode === "shrapnel" ? 1.48 : 1;
  for (let i = 0; i < count; i++) {
    const age = t - rand(i + 42) * 0.28;
    if (age <= 0) continue;
    const life = 1.05 + rand(i + 73) * 1.3;
    if (age > life) continue;
    let vx = (rand(i + 8) - 0.41) * 121,
      vy = -(21 + rand(i + 17) * 89);
    if (mode === "shrapnel") {
      vx = 9 + rand(i + 10) * 83;
      vy *= 0.71;
    }
    if (mode === "melt") {
      vx *= 0.66;
      vy *= 0.73;
    }
    const x = vx * age * speed,
      y = vy * age + 30 * age * age;
    if (y > 2) continue;
    c.save();
    c.globalAlpha *= clamp((life - age) * 2);
    const color = i % 4 ? "#ffb56e" : "#fff4c3";
    if (mode === "melt") {
      glow(c, x, y, 3 + rand(i) * 5, "#ff5123", 0.85);
      dot(c, x, y, 1 + rand(i) * 1.8, color);
    } else {
      const lag = mode === "shrapnel" ? 0.14 : 0.1;
      line(
        c,
        [
          { x: x - vx * lag, y: y - (vy + 60 * age) * lag },
          { x, y },
        ],
        color,
        0.55 + rand(i) * 1.2,
      );
      if (i % 4 === 0) dot(c, x, y, 1.15, "#ffebc0");
    }
    c.restore();
  }
}
function ballisticEjecta(c, age, mode) {
  debris(c, age, mode === "shrapnel" ? 108 : mode === "melt" ? 48 : 90, mode);
  for (let i = 0; i < 18; i++) {
    const u = rand(i + 29),
      dir = mode === "shrapnel" ? u : u - 0.5;
    const px = dir * age * (mode === "shrapnel" ? 48 : 63),
      py = -Math.sin(u * Math.PI) * Math.min(age, 1) * 9;
    cloud(
      c,
      px,
      py,
      5 + age * (6 + u * 5),
      i % 4,
      mode === "melt" ? "#ff6b27" : "#de995f",
      0.37 * Math.exp(-age * 0.8),
    );
  }
  if (mode === "melt")
    glow(c, 0, -1, 16, "#ff842e", Math.exp(-age * 0.48), 0.24);
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
// Local x follows the surface tangent; negative y rises from the point of contact.
export function impact(c, id, planet, angle, age, scale = 1, showScar = true) {
  if (age < 0) return;
  const { x, y, r } = planet;
  c.save();
  c.translate(x + Math.cos(angle) * (r - 2), y + Math.sin(angle) * (r - 2));
  c.rotate(angle + Math.PI / 2);
  c.scale(scale, scale);
  if (showScar) {
    const scar = clamp(age * 7);
    ellipse(c, 0, 1, scar * 9 + 0.01, scar * 3 + 0.01, "#381c22", true);
    ellipse(c, 0, 1, scar * 7 + 0.01, scar * 2 + 0.01, "#c2724c", false, 0.85);
  }
  c.globalCompositeOperation = "lighter";
  glow(c, 0, 0, 14, "#ff662a", Math.exp(-age * 0.95), 0.43);
  const fade = clamp((3 - age) / 0.95);
  c.globalAlpha = fade;
  // Incandescent vapour briefly lights the ground beneath the changing plume.
  glow(c, 0, 3, 25 + 19 * age, "#ff993c", 0.85 * Math.exp(-age * 2.75), 0.38);
  switch (id) {
    case "ejecta":
    case "shrapnel":
    case "melt":
      ballisticEjecta(c, age, id);
      break;
    case "dust-wall":
      rollingDust(c, age, r / scale);
      break;
    case "combined":
      rollingDust(c, age, r / scale);
      ballisticEjecta(c, age, "ejecta");
      break;
    case "pillar":
      for (let i = 0; i < 61; i++) {
        const u = rand(i + 38),
          h = (1 - Math.exp(-age * 1.23)) * 84 * u;
        const cap = clamp((u - 0.66) * 3.8),
          w = (3 + cap * 28) * Math.min(age + 0.1, 1.3);
        const xx = (rand(i + 88) - 0.5) * w * 2 + Math.sin(u * 5) * age * 3;
        cloud(
          c,
          xx,
          -h,
          4 + cap * 13 + age * 2,
          i % 4,
          u > 0.7 ? "#b598ae" : i % 3 ? "#ff9a54" : "#fff3c5",
          (0.61 - u * 0.15) * Math.exp(-age * 0.55),
        );
      }
      break;
    case "rings":
      for (let i = 0; i < 4; i++) {
        const phase = age - i * 0.19;
        if (phase <= 0) continue;
        const radius = phase * 38;
        c.save();
        c.globalAlpha *= Math.exp(-phase * 1.95);
        ellipse(
          c,
          0,
          2 + radius * 0.21,
          radius,
          radius * 0.36 + 0.1,
          i % 2 ? "#ffcb67" : "#ff8977",
          false,
          2.4 / (1 + phase),
        );
        c.restore();
      }
      debris(c, age, 20, "ejecta");
      break;
    case "fracture":
      for (let i = 0; i < 19; i++) {
        const a = rand(i + 1) * Math.PI,
          distance = (17 + rand(i + 7) * 38) * clamp(age * 2.1);
        const points = [{ x: 0, y: 0 }];
        for (let j = 1; j <= 7; j++) {
          const u = j / 7,
            xx = Math.cos(a) * distance * u;
          points.push({
            x: xx + Math.sin(j * 2 + i) * 2 * u,
            y:
              (xx * xx) / (2 * r) +
              Math.sin(a) * distance * u * 0.52 +
              Math.sin(j * 4 + i) * 2 * u,
          });
        }
        c.save();
        c.globalAlpha *= Math.exp(-age * 0.62);
        line(c, points, "#e35428", 2.6);
        line(c, points, "#ffd789", 0.65);
        c.restore();
      }
      break;
    case "plasma": {
      const rad = 2 + 42 * (1 - Math.exp(-age * 1.65));
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, "#bd89ff28");
      g.addColorStop(0.76, "#bd64ff29");
      g.addColorStop(0.93, "#e0a8ffbd");
      g.addColorStop(1, "#8b65ef00");
      c.save();
      c.globalAlpha *= Math.exp(-age * 0.97);
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, rad, Math.PI, TAU);
      c.fill();
      for (let j = 0; j < 5; j++)
        rimLine(
          c,
          rad * (0.65 + j * 0.075),
          Math.PI,
          TAU,
          "#c388ff85",
          0.7,
          (a) => Math.sin(a * 19 + age * 7 + j) * 1.4,
        );
      c.restore();
      break;
    }
    case "nova":
      for (let i = 0; i < 72; i++) {
        const a = Math.PI + rand(i + 67) * Math.PI,
          v = (15 + rand(i + 4) * 65) * age;
        const px = Math.cos(a) * v,
          py = Math.sin(a) * v + age * age * 6;
        if (py > 2) continue;
        const color = ["#ff978e", "#ffdf8d", "#8efff3", "#c7a8ff"][i % 4];
        c.save();
        c.globalAlpha *= Math.exp(-age * 1.08);
        if (age < 0.55)
          line(
            c,
            [
              { x: px * 0.12, y: py * 0.12 },
              { x: px, y: py },
            ],
            color,
            1.3,
          );
        glint(c, px, py, (1.5 + rand(i) * 3.3) / (1 + 0.4 * age), color);
        c.restore();
      }
      break;
  }
  const flash = Math.exp(-age * 6.3);
  glow(c, 0, -1, 29 + age * 9, id === "plasma" ? "#d5a4ff" : "#ffe5ac", flash);
  glint(c, 0, -1, flash * 17, "#fff8e1");
  c.restore();
}
