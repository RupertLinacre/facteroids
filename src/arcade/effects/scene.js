import { clamp, dot, rand } from "./paint.js";
import { atmosphere, impact } from "./planet-effects.js";
import { trail } from "./trails.js";

// The previews share a render of Umbra's terrain.
export const globe = new Image();
globe.src = "/art/umbra-globe.webp";

const scenes = {
  meteors: { x: 356, y: 186, r: 46 },
  primes: { x: 298, y: 177, r: 54 },
  air: { x: 279, y: 145, r: 72 },
  impacts: { x: 296, y: 286, r: 143 },
  combined: { x: 302, y: 172, r: 56 },
};
const entrance = [
  {
    x: -43,
    y: 13,
    cx: 0.3,
    cy: -0.44,
    angle: 3.77,
    value: 70,
    flight: 6.7,
    offset: 2.1,
    size: 6.5,
  },
  {
    x: 501,
    y: -36,
    cx: 0.97,
    cy: -0.58,
    angle: 5.1,
    value: 32,
    flight: 5.8,
    offset: 4.2,
    size: 4.8,
  },
  {
    x: -54,
    y: 188,
    cx: 0.25,
    cy: 0.3,
    angle: 3.25,
    value: 45,
    flight: 7.2,
    offset: 0.1,
    size: 5.6,
  },
];
function incoming(p, flight) {
  const end = {
    x: p.x + (p.r - 2) * Math.cos(flight.angle),
    y: p.y + (p.r - 2) * Math.sin(flight.angle),
  };
  const control = { x: flight.cx * 480, y: p.y + flight.cy * 125 };
  return (age) => {
    const f = clamp(age / flight.flight),
      u = 0.71 * f + 0.29 * f * f,
      v = 1 - u;
    return {
      x: v * v * flight.x + 2 * v * u * control.x + u * u * end.x,
      y: v * v * flight.y + 2 * v * u * control.y + u * u * end.y,
    };
  };
}

// Integrate sibling fragments from one breakup site under the same inverse-square
// gravity. Positions are in planet radii so every camera uses the same flybys.
const step = 1 / 90;
function integrate(vx, vy) {
  let x = -3.75,
    y = -1.49;
  const points = [{ x, y }];
  const acceleration = () => -0.58 / (x * x + y * y) ** 1.5;
  let closest = 0,
    min = Infinity;
  for (let i = 1; i <= 900; i++) {
    let a = acceleration();
    vx += (x * a * step) / 2;
    vy += (y * a * step) / 2;
    x += vx * step;
    y += vy * step;
    a = acceleration();
    vx += (x * a * step) / 2;
    vy += (y * a * step) / 2;
    points.push({ x, y });
    if (Math.hypot(x, y) < min) {
      min = Math.hypot(x, y);
      closest = i * step;
    }
  }
  return { points, closest };
}
const flybys = [
  [0.75, -0.047],
  [1.33, -0.018],
  [0.93, -0.061],
].map(([vx, vy]) => integrate(vx, vy));
function flybyPath(track, p, rotation, zoom) {
  const co = Math.cos(rotation),
    si = Math.sin(rotation);
  return (age) => {
    const k = clamp(age / step, 0, track.points.length - 1.001),
      i = Math.floor(k),
      f = k - i;
    const a = track.points[i],
      b = track.points[i + 1];
    const x = a.x + (b.x - a.x) * f,
      y = a.y + (b.y - a.y) * f;
    return {
      x: p.x + (x * co - y * si) * p.r * zoom,
      y: p.y + (x * si + y * co) * p.r * zoom,
    };
  };
}
function airHeat(p, point) {
  const altitude = Math.hypot(point.x - p.x, point.y - p.y) / p.r - 1;
  return clamp(1 - altitude / 0.82);
}
function fragments(c, id, p, t, focus) {
  const life = 7.2;
  for (let group = 0; group < 2; group++) {
    const age = (t + (group * life) / 2 + 1.85) % life;
    const rotation = group ? 0.79 : -0.12;
    for (let i = 0; i < 3; i++) {
      const track = flybys[i],
        path = flybyPath(track, p, rotation, group ? 1.04 : 1);
      const finish = track.closest + 1.05 + 0.25 * i;
      if (age >= finish) continue;
      const pt = path(age);
      const fade = clamp((finish - age) / 0.67);
      trail(c, {
        id,
        path,
        age,
        seed: 22 + group * 7 + i * 4,
        size: (focus ? 3.4 : 2.55) * (0.74 + 0.26 * fade),
        value: focus && (i === 1 || age > 0.9) ? [2, 5, 7][i] : null,
        prime: true,
        heat: airHeat(p, pt),
        heatAt: (point) => airHeat(p, point),
        opacity: fade * (focus ? 0.98 : 0.59) * clamp(age / 0.19),
      });
    }
  }
}
const strikeFlight = {
  x: -36,
  y: 6,
  cx: 0.37,
  cy: -1.39,
  angle: 4.32,
  value: 84,
  flight: 2.35,
  size: 6.3,
};
export function drawScene(c, category, choices, t) {
  const { canvas } = c,
    p = scenes[category];
  c.setTransform(canvas.width / 480, 0, 0, canvas.height / 256, 0, 0);
  c.clearRect(0, 0, 480, 256);
  for (let i = 0; i < 45; i++) {
    const b = 0.25 + 0.15 * Math.sin(t * 1.2 + i);
    dot(
      c,
      rand(i + 18) * 480,
      rand(93 + i * 17) * 256,
      0.23 + rand(i) * 0.5,
      "rgba(211,229,255," + b + ")",
    );
  }
  atmosphere(c, choices.air, p, t);
  if (globe.complete && globe.naturalWidth)
    c.drawImage(globe, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  else dot(c, p.x, p.y, p.r, "#813e31");

  const strikeView = category === "impacts" || category === "combined";
  // All nine candidates see exactly the same launch times, camera and impact mass.
  for (const [i, flight] of entrance.entries()) {
    if (strikeView && i === 0) continue;
    const age = (t + flight.offset) % (flight.flight + 1.15);
    const path = incoming(p, flight);
    if (age >= flight.flight) {
      if (!strikeView)
        impact(c, choices.impacts, p, flight.angle, age - flight.flight, 0.27);
      continue;
    }
    const focus = category === "meteors" || category === "combined";
    trail(c, {
      id: choices.meteors,
      path,
      age,
      seed: 5 + i * 17,
      size: flight.size * (focus ? 1 : 0.75),
      value: flight.value,
      opacity: focus ? 1 : 0.46,
      heat: airHeat(p, path(age)),
      heatAt: (point) => airHeat(p, point),
    });
  }
  if (category !== "meteors")
    fragments(
      c,
      choices.primes,
      p,
      t,
      category === "primes" || category === "combined",
    );
  if (strikeView) {
    const age = (t + 1.9) % 5.6,
      hit = age - strikeFlight.flight;
    if (hit < 0)
      trail(c, {
        id: choices.meteors,
        path: incoming(p, strikeFlight),
        age,
        seed: 83,
        value: strikeFlight.value,
        size: 6.3,
        heat: clamp(age / strikeFlight.flight),
      });
    else
      impact(
        c,
        choices.impacts,
        p,
        strikeFlight.angle,
        hit,
        category === "impacts" ? 1.15 : 0.74,
      );
  }
}
