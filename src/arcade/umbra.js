// Integrate once per orbit. The ship's sights, dotted forecast and asteroid
// all sample this same ephemeris, regardless of display frame rate.
import { answerWindow, difficultyOf } from "./questions.js";

const gravity = 285000;
const sampleStep = 0.1;

export function traceOrbit(
  planet,
  initial,
  contact,
  duration,
  prime = false,
  horizon = 300,
) {
  const path = [initial.x, initial.y];
  let { x, y, vx, vy } = initial;
  let elapsed = 0;
  // Semi-implicit integration in short substeps resolves fast grazing passes.
  // Drag rises exponentially down the atmosphere, lowering the next apoapsis.
  while (elapsed < horizon) {
    let hit = false;
    for (let i = 0; i < 4; i++) {
      const dt = sampleStep / 4;
      const dx = x - planet.x,
        dy = y - planet.y,
        r = Math.hypot(dx, dy);
      const pull = gravity / (r * r * r);
      const drag = prime
        ? 1
        : Math.exp(-dt * 0.16 * Math.exp(-(r - planet.r) / 24));
      vx = (vx - dx * pull * dt) * drag;
      vy = (vy - dy * pull * dt) * drag;
      const nx = x + vx * dt,
        ny = y + vy * dt;
      const nr = Math.hypot(nx - planet.x, ny - planet.y);
      if (nr <= contact) {
        const fraction = Math.max(0, (r - contact) / (r - nr));
        elapsed += fraction * dt;
        x += (nx - x) * fraction;
        y += (ny - y) * fraction;
        hit = true;
        break;
      }
      x = nx;
      y = ny;
      elapsed += dt;
    }
    path.push(x, y);
    if (hit) break;
  }
  return {
    initial,
    contact,
    horizon,
    path: new Float32Array(path),
    flightTime: elapsed,
    duration,
    prime,
  };
}

// The two apsides set orbital energy and angular momentum. A fragment can
// start anywhere between them, with its radial kick directed in or out.
function inject(planet, x, y, near, far, direction, outward) {
  const dx = x - planet.x,
    dy = y - planet.y,
    radius = Math.hypot(dx, dy);
  const angularMomentum = Math.sqrt((2 * gravity * near * far) / (near + far));
  const tangent = (direction * angularMomentum) / radius;
  const radial =
    outward *
    Math.sqrt(
      Math.max(
        0,
        gravity * (2 / radius - 2 / (near + far)) - tangent * tangent,
      ),
    );
  return {
    x,
    y,
    vx: (radial * dx - tangent * dy) / radius,
    vy: (radial * dy + tangent * dx) / radius,
  };
}

function pose(initial, orbit) {
  const rate = orbit.flightTime / orbit.duration;
  return {
    ...initial,
    vx: initial.vx * rate,
    vy: initial.vy * rate,
    orbit,
    safe: false,
  };
}

const asteroidScale = 0.68;
const nearPlanetScale = 0.77;

export function visibleRadius(body, planet) {
  const approach = cometActivity(body, planet);
  const radius =
    body.radius * asteroidScale * (1 - (1 - nearPlanetScale) * approach);
  return body.orbit.prime
    ? radius * 0.45 * Math.max(0, 1 - (body.burn ?? 0)) ** 1.3
    : radius;
}

function contactRadius(planet, size) {
  return planet.r + size * asteroidScale * nearPlanetScale * 0.85;
}

export function capture(planet, wave, question, size) {
  const phase = (wave * 0.61803398875) % 1;
  const angle =
    (wave % 2 ? Math.PI : 0) +
    (phase - 0.5) * 0.28 +
    (planet.portrait ? Math.PI / 2 : 0);
  const far = 242 + phase * 44,
    contact = contactRadius(planet, size);
  const near = planet.r + 32 + (wave % 3) * 4 + phase * 6;
  const initial = inject(
    planet,
    planet.x + far * Math.cos(angle),
    planet.y + far * Math.sin(angle),
    near,
    far,
    wave % 4 < 2 ? -1 : 1,
    -1,
  );
  const duration = answerWindow(question.grade, question.ceiling);
  const orbit = traceOrbit(planet, initial, contact, duration);
  orbit.ceiling = question.ceiling;
  orbit.direction = wave % 4 < 2 ? -1 : 1;
  return pose(initial, orbit);
}

export function transfer(
  body,
  index,
  count,
  planet,
  prime,
  size,
  factorCount = 2,
) {
  const lane = count > 1 ? index / (count - 1) : 0,
    angle = Math.atan2(body.y - planet.y, body.x - planet.x);
  const r = Math.hypot(body.x - planet.x, body.y - planet.y);
  const parentDirection =
    Math.sign(Math.cos(angle) * body.vy - Math.sin(angle) * body.vx) ||
    body.orbit.direction;
  const contact = prime
    ? Math.min(planet.r + 4, r - 0.5)
    : contactRadius(planet, size);
  // Eject across the parent's silhouette with a constant velocity increment
  // between neighbours. A shared orbit clock preserves that ramp in play.
  const power = Math.min(3, Math.max(0, factorCount - 2));
  const near = Math.min(r - 1, prime ? planet.r + 12 : contact + 7);
  const far = Math.max(r + 30, planet.r + 100);
  const radialVelocity = Math.cos(angle) * body.vx + Math.sin(angle) * body.vy;
  const outward = prime
    ? r < planet.r + 20 || radialVelocity > 0
    : r < 175 || radialVelocity > 0;
  const baseline = inject(
    planet,
    body.x,
    body.y,
    near,
    far,
    parentDirection,
    outward ? 1 : -1,
  );
  const fan = 2 * lane - 1;
  const offset =
    fan *
    Math.min(
      0.24,
      (visibleRadius(body, planet) * (1.9 + power * 0.5)) / r + 0.035,
    );
  const bearing = angle + parentDirection * offset;
  const kick = lane * Math.sqrt(gravity / r) * (0.06 + power * 0.012);
  const initial = {
    ...baseline,
    x: planet.x + r * Math.cos(bearing),
    y: planet.y + r * Math.sin(bearing),
    vx:
      baseline.vx +
      kick * (-parentDirection * Math.sin(angle) + 0.45 * Math.cos(angle)),
    vy:
      baseline.vy +
      kick * (parentDirection * Math.cos(angle) + 0.45 * Math.sin(angle)),
  };
  const difficulty = difficultyOf(body.value / count);
  const baselineDuration = prime
    ? 6.5
    : answerWindow(difficulty, body.orbit.ceiling);

  // Follow the same gravity and drag as incoming rocks. A bounded lifetime
  // lets a wide flyby dissolve while it is still travelling along its ellipse.
  const horizon = prime ? 21 : 300;
  const reference = traceOrbit(
    planet,
    baseline,
    contact,
    baselineDuration,
    prime,
    horizon,
  );
  const orbit = traceOrbit(
    planet,
    initial,
    contact,
    baselineDuration,
    prime,
    horizon,
  );
  orbit.duration = (baselineDuration * orbit.flightTime) / reference.flightTime;
  Object.assign(orbit, {
    lane,
    angle,
    direction: parentDirection,
    ceiling: body.orbit.ceiling,
  });
  return pose(initial, orbit);
}

export function orbitPoint(orbit, seconds) {
  const t =
    Math.max(0, Math.min(1, seconds / orbit.duration)) * orbit.flightTime;
  const last = orbit.path.length / 2 - 1;
  const i = Math.min(Math.floor(t / sampleStep), last - 1);
  const interval =
    i === last - 1 ? orbit.flightTime - i * sampleStep : sampleStep;
  const f = interval > 0 ? Math.min(1, (t - i * sampleStep) / interval) : 1;
  const k = 2 * i,
    p = orbit.path;
  return [p[k] + (p[k + 2] - p[k]) * f, p[k + 1] + (p[k + 3] - p[k + 1]) * f];
}

// The integrated path tracks the rock's centre. Project its last sample onto
// the visible surface, where the impact flash and crater are drawn.
export function impactSite(orbit, planet) {
  const angle = Math.atan2(
    orbit.path.at(-1) - planet.y,
    orbit.path.at(-2) - planet.x,
  );
  return {
    x: planet.x + Math.cos(angle) * (planet.r - 10),
    y: planet.y + Math.sin(angle) * (planet.r - 10),
    angle,
  };
}

export function nextOrbitSample(orbit, seconds) {
  const elapsed = Math.min(seconds / orbit.duration, 1) * orbit.flightTime;
  return Math.floor(elapsed / sampleStep) + 1;
}

export function advanceOrbit(body, dt) {
  const [x, y] = orbitPoint(body.orbit, body.age);
  if (dt > 0) {
    body.vx = (x - body.x) / dt;
    body.vy = (y - body.y) / dt;
  }
  body.x = x;
  body.y = y;
  return body.age >= body.orbit.duration;
}

export function cometActivity(body, earth) {
  const altitude = Math.hypot(body.x - earth.x, body.y - earth.y) - earth.r;
  const u = Math.max(0, Math.min(1, (145 - altitude) / 120));
  return u * u * (3 - 2 * u);
}

export function emissionAt(body, earth) {
  return body.orbit?.prime
    ? (0.48 + 1.4 * cometActivity(body, earth)) *
        Math.min(1, Math.max(0, (1 - (body.burn ?? 0)) * 5))
    : cometActivity(body, earth);
}

// Each sample keeps the heat of the air at emission, including through a
// subsequent climb out of the atmosphere. Distance is measured along the orbit.
export const atmosphereHeight = 108;

export function trailSample(body, planet, previous) {
  const altitude = Math.hypot(body.x - planet.x, body.y - planet.y) - planet.r;
  const depth = Math.max(0, Math.min(1, 1 - altitude / atmosphereHeight));
  const heat = depth * depth * (3 - 2 * depth);
  const distance = previous
    ? previous[4] + Math.hypot(body.x - previous[0], body.y - previous[1])
    : 0;
  return [
    body.x,
    body.y,
    body.age ?? 0,
    emissionAt(body, planet),
    distance,
    heat,
  ];
}
