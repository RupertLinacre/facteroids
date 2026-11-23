import { deploy, interceptAt, stowAt, weaponFor } from "./deployment.js";
import { planet, incoming, flight, fragment } from "./flight.js";
import {
  capture,
  orbitPoint,
  transfer,
  remainingFlight,
  advanceOrbit,
  cometActivity,
  emissionAt,
} from "./umbra.js";
import { TRAIL_LIMIT } from "./drawing.js";
import { createPainter } from "./painter.js";

export async function create(canvas, audio, world) {
  const umbra = world.slug === "umbra-station";
  const earth = planet(world.horizon);
  if (umbra) earth.r = 65;
  let renderer3d;
  if (world.dimension === "3D") {
    const { createModels } = await import("./models.js");
    renderer3d = createModels(canvas, earth, world);
  }
  const paint = createPainter(canvas, world, earth, !!renderer3d);
  let scars = [],
    history = [],
    bursts = [],
    deployments = [];
  function burst(x, y, time, type, count, radius = 18, angle = 0, weapon) {
    bursts.push({ x, y, time, type, count, radius, angle, weapon });
  }
  return {
    reset() {
      renderer3d?.clearWakes();
      deployments = [];
      scars = [];
      history = [];
      bursts = [];
    },
    spawn(wave, difficulty) {
      const initial = umbra
        ? capture(earth, wave, difficulty)
        : incoming(earth, wave);
      return {
        ...initial,
        trail: umbra
          ? [[initial.x, initial.y, 0, cometActivity(initial, earth), 0]]
          : [],
        sample: 0,
        safe: false,
      };
    },
    children(r, count, prime) {
      const timeLeft = umbra && !prime ? remainingFlight(r, earth) : 0;
      return Array.from({ length: count }, (_, i) => ({
        ...(umbra
          ? transfer(r, i, count, earth, prime, timeLeft)
          : fragment(r, i, count, earth)),
        radius: umbra
          ? Math.max(7, ((r.radius ?? 24) / Math.cbrt(count)) * 0.94)
          : undefined,
        trail: [
          umbra
            ? [r.x, r.y, 0, prime ? 0.85 : cometActivity(r, earth), 0]
            : [r.x, r.y],
        ],
        sample: 0,
      }));
    },
    deploy(target, t, count) {
      const [x, y] = orbitPoint(target.orbit, earth, target.age + interceptAt);
      const mount = deploy({ x, y }, earth, t, weaponFor(count));
      deployments.push(mount);
      audio.effect("deploy", mount.x, count);
      return mount;
    },
    fire(r, n) {
      if (umbra) return audio.effect("launch", r.x, n);
      audio.note(165 + n * 55, 0.18, "triangle");
    },
    impact(r, kids, t, weapon) {
      if (!umbra) history.push({ points: r.trail, time: t });
      burst(
        r.x,
        r.y,
        t,
        kids[0].prime ? "prime" : "split",
        kids[0].prime ? 26 : 16,
        r.radius ?? 20,
        0,
        weapon,
      );
      if (umbra) {
        audio.effect("split", r.x, weapon.power);
        if (kids[0].prime) audio.effect("reentry", r.x);
        return;
      }
      audio.note(kids[0].prime ? 784 : 180, 0.29, "triangle");
    },
    hit(r, t) {
      const angle = Math.atan2(r.y - earth.y, r.x - earth.x);
      const scar = {
        x: earth.x + Math.cos(angle) * (earth.r - (umbra ? 10 : 5)),
        y: earth.y + Math.sin(angle) * (earth.r - (umbra ? 10 : 5)),
        angle,
        time: t,
        size: Math.min(28, 14 + (r.radius ?? 20) * 0.38),
      };
      scars.push(scar);
      burst(
        scar.x,
        scar.y,
        t,
        "impact",
        40,
        Math.max(20, r.radius ?? 20),
        angle,
      );
      if (umbra) return audio.effect("impact", r.x);
      audio.note(54, 0.65, "sawtooth", 0.035);
    },
    move(r, dt) {
      const collided = r.orbit
        ? advanceOrbit(r, earth, dt)
        : flight(r, earth, dt);
      if (umbra && collided && r.locked) {
        const angle = Math.atan2(r.y - earth.y, r.x - earth.x);
        r.x = earth.x + Math.cos(angle) * (earth.r + 5);
        r.y = earth.y + Math.sin(angle) * (earth.r + 5);
      }
      r.sample += dt;
      if (r.sample > (r.orbit?.prime ? 0.028 : 0.1)) {
        const point = [r.x, r.y];
        if (umbra) {
          const prev = r.trail.at(-1);
          point.push(
            r.age,
            emissionAt(r, earth),
            prev[4] + Math.hypot(r.x - prev[0], r.y - prev[1]),
          );
        }
        r.trail.push(point);
        if (r.trail.length > TRAIL_LIMIT) r.trail.shift();
        r.sample = 0;
      }
      if (r.prime) return r.orbit ? collided : r.age > 2;
      if (umbra && !r.approachHeard && cometActivity(r, earth) > 0.5) {
        r.approachHeard = true;
        audio.effect("approach", r.x);
      }
      if (r.safe)
        return r.age > 3.2 || r.x < -30 || r.x > 930 || r.y < -40 || r.y > 480;
      return collided;
    },
    draw(rocks, shots, t) {
      history = history.filter((h) => t - h.time < 4);
      bursts = bursts.filter(
        (b) => t - b.time < (umbra && b.type === "impact" ? 2.45 : 1.2),
      );
      deployments = deployments.filter((m) => t - m.time < stowAt);
      renderer3d?.draw(rocks, t, scars, deployments, bursts);
      paint(rocks, shots, t, scars, history, bursts, deployments);
    },
  };
}
