import { deploy, interceptAt, stowAt, weaponFor } from "./deployment.js";
import { planet, incoming, flight, fragment } from "./flight.js";
import {
  capture,
  orbitPoint,
  impactSite,
  transfer,
  advanceOrbit,
  cometActivity,
  trailSample,
} from "./umbra.js";
import { TRAIL_LIMIT } from "./drawing.js";
import { surfaceStrike } from "./surface-strike.js";
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
      if (umbra) earth.portrait = canvas.clientHeight > canvas.clientWidth;
      renderer3d?.clearWakes();
      deployments = [];
      scars = [];
      history = [];
      bursts = [];
    },
    spawn(wave, difficulty, radius, year) {
      const initial = umbra
        ? capture(earth, wave, difficulty, radius, year)
        : incoming(earth, wave);
      return {
        ...initial,
        trail: umbra ? [trailSample(initial, earth)] : [],
        sample: 0,
        safe: false,
      };
    },
    children(r, count, prime, factorCount = 2) {
      const timeLeft = umbra ? Math.max(0, r.orbit.duration - r.age) : 0;
      const radius = umbra
        ? Math.max(7, ((r.radius ?? 24) / Math.cbrt(count)) * 0.94)
        : undefined;
      return Array.from({ length: count }, (_, i) => {
        const initial = umbra
          ? transfer(r, i, count, earth, prime, timeLeft, radius, factorCount)
          : fragment(r, i, count, earth);
        return {
          ...initial,
          radius,
          sample: 0,
          trail: [umbra ? trailSample(initial, earth) : [r.x, r.y]],
        };
      });
    },
    deploy(target, t, count, speed = 1) {
      const [x, y] = orbitPoint(target.orbit, target.age + interceptAt * speed);
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
      const site = umbra
        ? impactSite(r.orbit, earth)
        : {
            x: earth.x + Math.cos(angle) * (earth.r - 5),
            y: earth.y + Math.sin(angle) * (earth.r - 5),
            angle,
          };
      const strike = umbra ? surfaceStrike(r, site.angle) : null;
      const scar = {
        ...site,
        time: t,
        size: strike?.crater ?? Math.min(28, 14 + (r.radius ?? 20) * 0.38),
      };
      scars.push(scar);
      if (umbra && scars.length > 8) scars.shift();
      bursts.push({
        ...site,
        time: t,
        type: "impact",
        count: strike?.count ?? 40,
        radius: r.radius ?? 20,
        strike,
      });
      if (umbra) {
        audio.effect("impact", r.x, strike.strength);
        return Math.min(55, Math.max(1, Math.round(26 * strike.strength ** 2)));
      }
      audio.note(54, 0.65, "sawtooth", 0.035);
    },
    move(r, dt, clock) {
      const collided = r.orbit ? advanceOrbit(r, dt) : flight(r, earth, dt);
      if (r.orbit?.prime) {
        const heat = cometActivity(r, earth);
        r.burn = Math.min(
          1,
          (r.burn ?? 0) + (dt / r.orbit.duration) * (1 + 2.6 * heat),
        );
      }
      r.sample += dt;
      if (r.sample > (r.orbit?.prime ? 0.028 : 0.1)) {
        r.trail.push(
          umbra ? trailSample(r, earth, r.trail.at(-1)) : [r.x, r.y],
        );
        if (r.trail.length > TRAIL_LIMIT) r.trail.shift();
        r.sample = 0;
      }
      if (r.prime) return r.orbit ? collided || r.burn >= 1 : r.age > 2;
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
        (b) =>
          t - b.time < (b.strike?.duration ?? b.weapon?.blastDuration ?? 1.2),
      );
      deployments = deployments.filter((m) => t - m.time < stowAt);
      renderer3d?.draw(rocks, t, scars, deployments, bursts, shots);
      paint(rocks, shots, t, scars, history, bursts, deployments);
    },
  };
}
