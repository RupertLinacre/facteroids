import { clamp, cloud, dot, glint, glow, line, rand, TAU } from "./paint.js";

const looks = {
  "twin-tail": ["#6a98ff", "#ffdea9", 1.85],
  bolide: ["#ff631e", "#ffecc5", 1.3],
  contrail: ["#9a847b", "#e5c3a3", 2.25],
  braid: ["#9865ff", "#5df9ff", 1.65],
  arc: ["#665dff", "#72ebff", 1.6],
  cinders: ["#fa5128", "#ffbc54", 1.75],
  silk: ["#46c9a9", "#da99e9", 2],
  echo: ["#509dab", "#97f3ee", 1.8],
  spectrum: ["#6d69ff", "#fff4dc", 1.9],
  grazers: ["#ff5a25", "#ffd782", 1.12],
  dust: ["#aca4ce", "#f6dec3", 1.65],
  fireflies: ["#56d68e", "#edffa4", 1.65],
  ribbons: ["#76efdc", "#ffa3dd", 1.6],
  cascade: ["#f55e4e", "#ffc088", 1.45],
  rainbow: ["#81ffc7", "#fff6da", 1.55],
  beads: ["#bba3ff", "#fff4e1", 1.65],
  needles: ["#68abff", "#ceffff", 1.4],
  veil: ["#8f60d6", "#dfa9ff", 1.7],
};
const rainbow = [
  "#fc898c",
  "#ffbc68",
  "#f2ef7a",
  "#65edbe",
  "#7bcbff",
  "#bc91ff",
];
const historySteps = 31;

// Samples are evaluated on the original trajectory at the time of emission.
// A profile can widen, drift or flicker after emission without rotating the wake.
function history(path, age, length) {
  const points = [];
  for (let i = 0; i <= historySteps; i++) {
    const u = i / historySteps,
      past = age - u * length;
    const p = path(Math.max(0, past));
    const before = path(Math.max(0, past - 0.015)),
      after = path(Math.max(0, past) + 0.015);
    const dx = after.x - before.x,
      dy = after.y - before.y,
      d = Math.hypot(dx, dy) || 1;
    points.push({ x: p.x, y: p.y, nx: -dy / d, ny: dx / d, u });
    if (past <= 0) break;
  }
  return points;
}
function offset(p, d) {
  return d ? { x: p.x + p.nx * d, y: p.y + p.ny * d } : p;
}
function strand(c, points, color, width, shift = () => 0, opacity = 1) {
  // Blend to transparent along the entire line, including wide, curved wakes.
  const a = points[0],
    b = points.at(-1);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.2) return;
  const g = c.createLinearGradient(a.x, a.y, b.x, b.y);
  g.addColorStop(0, color + "ff");
  g.addColorStop(0.54, color + "a6");
  g.addColorStop(1, color + "00");
  const alpha = c.globalAlpha;
  c.globalAlpha *= opacity;
  line(
    c,
    points.map((p) => offset(p, shift(p.u))),
    g,
    width,
  );
  c.globalAlpha = alpha;
}
function filaments(c, pts, shade, count, spread, time, seed, opacity = 0.55) {
  for (let i = 0; i < count; i++) {
    const s = 2 * rand(seed + i * 3) - 1;
    strand(
      c,
      pts,
      shade,
      0.65 + rand(i + 51) * 1.45,
      (u) =>
        spread * u * (s + Math.sin(u * 9 + s * 5 + time * 0.8) * 0.24) +
        Math.sin(u * 5 + s) * u * 3,
      opacity,
    );
  }
}
function specks(c, pts, seed, time, color, count, spread, kind) {
  for (let i = 0; i < count; i++) {
    const u = (rand(seed + i * 4) + time * 0.21) % 1;
    const p = pts[Math.floor(u * (pts.length - 1))];
    const d = (rand(seed + i * 8 + 6) - 0.5) * spread * (0.2 + u);
    const q = offset(p, d),
      s = (0.45 + rand(i + 97) * 1.3) * (1 - 0.45 * u);
    c.save();
    c.globalAlpha *= (1 - u * 0.78) * (0.65 + 0.35 * Math.sin(time * 5 + i));
    if (kind === "spark") glint(c, q.x, q.y, s * 2.45, color);
    else if (kind === "chip")
      line(
        c,
        [q, { x: q.x + p.ny * (2 + u * 6), y: q.y - p.nx * (2 + u * 6) }],
        color,
        s,
      );
    else dot(c, q.x, q.y, s, color);
    c.restore();
  }
}
function nucleus(c, p, size, seed, age, hot) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(seed * 0.7 + age * 0.36);
  const rim = Array.from({ length: 8 }, (_, i) => {
    const a = (i * TAU) / 8,
      r = size * (0.77 + 0.3 * rand(i + seed));
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i],
      b = rim[(i + 1) % rim.length];
    c.fillStyle = (
      hot
        ? ["#fffde0", "#ffbf77", "#ee815b", "#fff3ce"]
        : ["#e4f8ff", "#a8cee3", "#7294ab", "#41566e"]
    )[Math.floor(rand(i + seed + 7) * 4)];
    c.beginPath();
    c.moveTo(-size * 0.14, -size * 0.24);
    c.lineTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.fill();
  }
  c.restore();
}
export function trail(
  c,
  {
    id,
    path,
    age,
    seed,
    value,
    size = 5,
    prime = false,
    opacity = 1,
    heat = 0.5,
    heatAt,
  },
) {
  if (age <= 0 || opacity <= 0) return;
  const [outer, core, length] = looks[id],
    pts = history(path, age, length),
    p = pts[0];
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = opacity;
  const coreLine = (w = 1.25) => strand(c, pts, core, w);
  switch (id) {
    case "twin-tail": {
      // Ion gas follows the projected solar wind. Dust retains some of its
      // earlier orbital motion as radiation pressure pushes it anti-sunward.
      const dust = pts.map((q) => ({
        ...q,
        x: p.x + (q.x - p.x) * 0.37 + q.u * (70 + 15 * q.u),
        y: p.y + (q.y - p.y) * 0.41 + q.u * (19 + 27 * q.u),
      }));
      for (let i = 0; i < 10; i++) {
        const span = 57 + rand(i + 11) * 62,
          dy = span * (0.19 + rand(i + 51) * 0.07);
        const g = c.createLinearGradient(p.x, p.y, p.x + span, p.y + dy);
        g.addColorStop(0, "#9acbffb3");
        g.addColorStop(1, "#4575ff00");
        line(
          c,
          [
            p,
            { x: p.x + span * 0.4, y: p.y + dy * 0.37 + Math.sin(i) * 2 },
            {
              x: p.x + span * 0.74,
              y: p.y + dy * 0.76 + Math.sin(i + age) * 2,
            },
            { x: p.x + span, y: p.y + dy },
          ],
          g,
          0.7 + rand(i) * 2,
        );
      }
      for (let i = 1; i < dust.length; i += 2) {
        const q = dust[i],
          u = q.u,
          o = offset(q, Math.sin(seed + u * 5) * u * 6);
        cloud(c, o.x, o.y, 3 + u * 13, i % 3, core, 0.24 * (1 - u));
      }
      filaments(c, dust, core, 18, 16, age, seed, 0.38);
      strand(c, dust, core, 5, (u) => 6 * u * u, 0.38);
      glow(c, p.x, p.y, 18, "#83e1d3", 0.6);
      break;
    }
    case "bolide":
    case "grazers": {
      for (const q of pts) {
        const t = q.u;
        const emissionHeat = heatAt ? heatAt(q) : heat;
        const ice = prime ? "#e7ad79" : "#7fbfff";
        const intensity = (1 - t) * (0.18 + emissionHeat * 0.28);
        glow(
          c,
          q.x,
          q.y,
          (prime ? 4 : 6) + (1 - t) * (prime ? 6 : 10),
          outer,
          intensity * emissionHeat,
        );
        glow(
          c,
          q.x,
          q.y,
          (prime ? 5 : 9) * (1 - t) + 2,
          ice,
          intensity * (1 - emissionHeat),
        );
      }
      strand(c, pts, outer, prime ? 3 : 5, () => 0, 0.26 + 0.38 * heat);
      coreLine(prime ? 1.5 : 2.1);
      specks(c, pts, seed, age, core, prime ? 13 : 23, 14, "chip");
      break;
    }
    case "contrail":
    case "dust": {
      for (let i = pts.length - 1; i >= 0; i--) {
        const q = pts[i],
          u = q.u;
        for (let j = 0; j < 2; j++) {
          const drift = (Math.sin(u * 12 + seed + j * 3) + j - 0.5) * u * 10;
          const o = offset(q, drift);
          cloud(
            c,
            o.x,
            o.y - u * u * 6,
            4 + u * (prime ? 13 : 20),
            (i + j) % 4,
            j ? core : outer,
            (1 - u) * 0.34,
          );
        }
      }
      filaments(c, pts, core, 8, prime ? 10 : 6, age, seed, 0.22);
      break;
    }
    case "braid":
    case "ribbons":
    case "silk":
    case "veil": {
      const strands = id === "silk" ? 13 : id === "veil" ? 10 : 6;
      const turns = id === "braid" ? 22 : id === "ribbons" ? 13 : 7;
      for (let i = 0; i < strands; i++) {
        const phase =
          id === "silk"
            ? i * 0.16
            : id === "veil"
              ? (i / strands) * TAU
              : (i % 2) * Math.PI + i * 0.1;
        strand(
          c,
          pts,
          i < strands / 2 ? outer : core,
          id === "braid" ? 1.5 : 2.6,
          (u) =>
            Math.sin(u * turns - age * 2.3 + phase) *
              Math.sin(u * Math.PI * 0.86) *
              (id === "veil" ? 16 : id === "silk" ? 14 : 7) +
            u * (i / strands - 0.5) * 7,
          id === "silk" || id === "veil" ? 0.43 : 0.8,
        );
      }
      if (id === "braid") coreLine(0.9);
      break;
    }
    case "arc": {
      for (let j = 0; j < 3; j++) {
        const points = pts
          .filter((_, i) => i % 2 === 0)
          .map((q, i) =>
            offset(
              q,
              (rand(i * 5 + j * 31 + Math.floor(age * 9)) - 0.5) *
                13 *
                Math.sin(q.u * Math.PI),
            ),
          );
        strand(
          c,
          points,
          j ? outer : core,
          j ? 1.5 : 1.15,
          () => 0,
          j ? 0.48 : 1,
        );
        for (let i = 3; i < points.length; i += 5) {
          const q = points[i];
          line(
            c,
            [q, { x: q.x - 4, y: q.y - 6 }, { x: q.x - 10, y: q.y - 7 }],
            outer,
            0.7,
          );
        }
      }
      break;
    }
    case "cinders":
    case "cascade":
      strand(c, pts, outer, 3.3);
      specks(
        c,
        pts,
        seed,
        age,
        core,
        id === "cascade" ? 35 : 62,
        id === "cascade" ? 38 : 35,
        "chip",
      );
      if (id === "cascade")
        for (let i = 4; i < pts.length; i += 7) {
          const q = pts[i],
            o = offset(q, Math.sin(i + seed) * q.u * 20);
          glow(c, o.x, o.y, 6, outer, 0.65);
          glint(c, o.x, o.y, 2.6, core);
        }
      break;
    case "echo":
      for (let i = 3; i < pts.length; i += 4) {
        const q = pts[i];
        c.save();
        c.translate(q.x, q.y);
        c.rotate(q.u + seed);
        c.strokeStyle = core;
        c.globalAlpha *= 0.7 * (1 - q.u);
        c.lineWidth = 1.4;
        c.strokeRect(-size * 0.6, -size * 0.6, size * 1.2, size * 1.2);
        c.restore();
      }
      strand(c, pts, outer, 0.7);
      break;
    case "spectrum":
    case "rainbow":
      for (let i = 0; i < 6; i++) {
        const color = rainbow[id === "spectrum" ? i : (i + seed) % 6];
        strand(
          c,
          pts,
          color,
          id === "rainbow" ? 1.8 : 1.4,
          (u) =>
            (i - 2.5) * u * (id === "spectrum" ? 5 : 2) +
            Math.sin(u * 4 + seed) * u * 7,
          0.85,
        );
      }
      if (id === "rainbow") {
        const hue = rainbow[seed % 6];
        for (const q of pts)
          glow(c, q.x, q.y, 6 * (1 - 0.4 * q.u), hue, 0.23 * (1 - q.u));
        specks(c, pts, seed, age, hue, 21, 17, "spark");
      }
      break;
    case "fireflies":
      strand(c, pts, outer, 1.2, () => 0, 0.7);
      specks(c, pts, seed, age, core, 38, 22, "spark");
      for (let i = 1; i < pts.length; i += 4)
        glow(c, pts[i].x, pts[i].y, 5, outer, 1 - pts[i].u);
      break;
    case "beads":
      for (let i = 2; i < pts.length; i += 3) {
        const q = pts[i],
          s = 3.5 * (1 - q.u) + 0.4;
        glow(c, q.x, q.y, s * 2.8, outer, 0.9);
        dot(c, q.x, q.y, s * 0.65, core);
      }
      coreLine(0.5);
      break;
    case "needles":
      for (let i = 0; i + 4 < pts.length; i += 3) {
        const a = offset(pts[i], Math.sin(seed + i) * 4),
          b = offset(pts[i + 4], Math.sin(seed + i) * 4);
        line(c, [a, b], i % 2 ? core : outer, 1.15);
      }
      filaments(c, pts, outer, 3, 3, age, seed, 0.7);
      break;
  }
  const warm =
    id === "grazers" || id === "bolide" || id === "cascade" || id === "cinders";
  glow(
    c,
    p.x,
    p.y,
    size * (prime ? 2.8 : 3.1) * (warm ? 0.85 + heat * 0.4 : 1),
    outer,
    prime ? 0.78 : 0.62,
  );
  c.globalCompositeOperation = "source-over";
  nucleus(c, p, size, seed, age, warm && heat > 0.32);
  if (prime && heat > 0.25) glow(c, p.x, p.y, size * 1.8, core, heat * 0.75);
  if (value != null) {
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "center";
    c.lineWidth = 2.5;
    c.strokeStyle = "#09101ada";
    c.strokeText(value, p.x, p.y + size + 13);
    c.fillStyle = prime ? "#f5e6d9" : "#e7edf2";
    c.fillText(value, p.x, p.y + size + 13);
  }
  c.restore();
}
