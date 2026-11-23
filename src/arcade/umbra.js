// A split follows a decaying, projected orbit. Progress is in flight seconds,
// so the visible forecast and the eventual contact use the very same curve.
import { flight } from "./flight.js";

function outerRadius(angle) {
  return 1 / Math.hypot(Math.cos(angle) / 405, Math.sin(angle) / 192);
}

// Arcade captures start at apoapsis. A longer pass sweeps through periapsis
// and climbs out again before the final descent. Use the same clock for the
// prediction, motion and impact so a difficult number always gets its window.
export function capture(earth, wave, difficulty) {
  const hard = difficulty === "hard";
  const phase = (wave * 0.61803398875) % 1;
  const longPass = wave % 3 === 0 || (hard && wave % 2 === 0);
  const angle = (wave % 2 ? Math.PI : 0) + (phase - 0.5) * 1.16;
  const direction = wave % 4 < 2 ? -1 : 1;
  const laps = longPass ? 1.22 + 0.4 * phase : 0.53 + 0.34 * phase;
  const orbit = {
    capture: true,
    angle,
    height: 0.76 + 0.14 * phase,
    eccentricity: 0.24 + 0.39 * ((wave * 0.41421356) % 1),
    sweep: direction * 2 * Math.PI * laps,
    duration: (hard ? 47 : 27) + (longPass ? 5 : 0) + 7 * phase,
  };
  const [x, y] = orbitPoint(orbit, earth, 0);
  const [nextX, nextY] = orbitPoint(orbit, earth, 0.02);
  return { x, y, vx: (nextX - x) / 0.02, vy: (nextY - y) / 0.02, orbit };
}

export function remainingFlight(body, earth) {
  if (body.orbit) return Math.max(0, body.orbit.duration - body.age);
  const future = { ...body };
  let seconds = 0;
  while (seconds < 90 && !flight(future, earth, 0.04)) seconds += 0.04;
  return seconds;
}

export function transfer(body, index, count, earth, prime, timeLeft) {
  const dx = body.x - earth.x,
    dy = body.y - earth.y;
  const angle = Math.atan2(dy, dx);
  const lane = index / (count - 1);
  const direction = Math.sign(dx * body.vy - dy * body.vx) || 1;
  const contact = earth.r + 5;
  const height = Math.max(
    0,
    (Math.hypot(dx, dy) - contact) / (outerRadius(angle) - contact),
  );
  const orbit = {
    angle,
    height,
    lane,
    prime,
    duration: prime
      ? 2.55 + 1.15 * lane
      : Math.max(10, timeLeft + 6.5) + 8 * lane,
    sweep:
      direction *
      (prime
        ? 0.85 + 3.05 * lane + 0.42 * (body.orbit?.lane ?? 0.5)
        : 2.35 + 2.8 * lane),
  };
  return { x: body.x, y: body.y, vx: body.vx, vy: body.vy, safe: false, orbit };
}

export function orbitPoint(orbit, earth, seconds) {
  const u = Math.min(1, Math.max(0, seconds / orbit.duration));
  if (orbit.capture) {
    const phase = orbit.sweep * u,
      e = orbit.eccentricity;
    const angle =
      orbit.angle +
      phase -
      2 * Math.atan2(e * Math.sin(phase), 1 + e * Math.cos(phase));
    const contact = earth.r + 5;
    const excursion =
      orbit.height * (1 - 0.65 * e * (1 - Math.cos(phase))) * (1 - u ** 1.6);
    const radius = contact + (outerRadius(angle) - contact) * excursion;
    return [
      earth.x + radius * Math.cos(angle),
      earth.y + radius * Math.sin(angle),
    ];
  }
  const { prime, lane, height } = orbit;
  // Prime lanes skim the limb. Composite lanes climb outward and then decay.
  const angle =
    orbit.angle +
    orbit.sweep *
      (prime ? u * (0.8 + 0.2 * u) : u * (1.65 - 1.4 * u + 0.75 * u * u));
  const contact = earth.r + 5;
  const envelope = outerRadius(angle) - contact;
  const altitude = prime
    ? height * (1 - u) ** 1.55 +
      0.1 * Math.sin(Math.PI * u) +
      (0.025 + 0.045 * lane) * u
    : (height +
        0.42 *
          lane *
          Math.max(0, 1 - height) *
          (1 - Math.exp(-seconds * 1.6))) *
        (1 - u) ** 2 +
      2 * (0.64 + 0.34 * lane) * u * (1 - u);
  const radius = contact + envelope * altitude;
  return [
    earth.x + radius * Math.cos(angle),
    earth.y + radius * Math.sin(angle),
  ];
}

export function advanceOrbit(body, earth, dt) {
  const [x, y] = orbitPoint(body.orbit, earth, body.age);
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
    ? 0.85 * Math.max(0, Math.min(1, (1 - body.age / body.orbit.duration) * 5))
    : cometActivity(body, earth);
}
