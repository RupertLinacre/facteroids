import { deploy, interceptAt, stowAt, weaponFor } from "./deployment.js";
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
import { createPlanetFragments } from "./planet-fragments.js";

export async function create(canvas, audio) {
  const earth = { x: 450, y: 220, r: 65 };
  const { createModels } = await import("./models.js");
  const renderer3d = createModels(canvas, earth);
  const paint = createPainter(canvas, earth);
  let scars = [],
    bursts = [],
    deployments = [],
    destruction = null;
  return {
    reset() {
      earth.portrait = canvas.clientHeight > canvas.clientWidth;
      renderer3d.clearWakes();
      deployments = [];
      scars = [];
      bursts = [];
      destruction = null;
    },
    spawn(sequence, question, radius) {
      const initial = capture(earth, sequence, question, radius);
      return {
        ...initial,
        trail: [trailSample(initial, earth)],
        sample: 0,
        safe: false,
      };
    },
    children(r, count, prime, factorCount = 2) {
      const radius = Math.max(7, ((r.radius ?? 24) / Math.cbrt(count)) * 0.94);
      return Array.from({ length: count }, (_, i) => {
        const initial = transfer(
          r,
          i,
          count,
          earth,
          prime,
          radius,
          factorCount,
        );
        return {
          ...initial,
          age: -Math.min(0.65, i * 0.035),
          radius,
          sample: 0,
          trail: [trailSample(initial, earth)],
        };
      });
    },
    deploy(target, t, count, speed = 1, delay = 0) {
      const [x, y] = orbitPoint(
        target.orbit,
        target.age + (interceptAt + delay) * speed,
      );
      const mount = deploy({ x, y }, earth, t, weaponFor(count));
      deployments.push(mount);
      audio.effect("deploy", mount.x, count);
      return mount;
    },
    fire(r, n) {
      audio.effect("launch", r.x, n);
    },
    impact(r, kids, t, weapon) {
      bursts.push({
        x: r.x,
        y: r.y,
        time: t,
        type: kids[0].prime ? "prime" : "split",
        count: kids[0].prime ? 26 : 16,
        radius: r.radius ?? 20,
        angle: 0,
        weapon,
      });
      audio.effect("split", r.x, weapon.power);
      if (kids[0].prime) audio.effect("reentry", r.x);
    },
    hit(r, t) {
      const site = impactSite(r.orbit, earth);
      const strike = surfaceStrike(r);
      scars.push({ ...site, time: t, size: strike.crater });
      if (scars.length > 8) scars.shift();
      bursts.push({
        ...site,
        time: t,
        type: "impact",
        count: 40,
        radius: r.radius ?? 20,
        strike,
      });
      audio.effect("impact", r.x, strike.strength);
      return Math.min(55, Math.max(1, Math.round(26 * strike.strength ** 2)));
    },
    destroyPlanet(t) {
      destruction = { time: t, fragments: createPlanetFragments(earth) };
      bursts = [];
      deployments = [];
      audio.effect("planet-loss", earth.x);
    },
    move(r, dt) {
      const collided = advanceOrbit(r, dt);
      if (r.orbit.prime) {
        const heat = cometActivity(r, earth);
        r.burn = Math.min(
          1,
          (r.burn ?? 0) + (dt / r.orbit.duration) * (1 + 2.6 * heat),
        );
      }
      r.sample += dt;
      if (r.sample > (r.orbit.prime ? 0.028 : 0.1)) {
        r.trail.push(trailSample(r, earth, r.trail.at(-1)));
        if (r.trail.length > TRAIL_LIMIT) r.trail.shift();
        r.sample = 0;
      }
      if (r.prime) return collided || r.burn >= 1;
      if (!r.approachHeard && cometActivity(r, earth) > 0.5) {
        r.approachHeard = true;
        audio.effect("approach", r.x);
      }
      return collided;
    },
    draw(rocks, shots, t) {
      bursts = bursts.filter(
        (b) =>
          t - b.time < (b.strike?.duration ?? b.weapon?.blastDuration ?? 1.2),
      );
      deployments = deployments.filter((m) => t - m.time < stowAt);
      const visibleRocks = destruction
        ? destruction.fragments(t - destruction.time)
        : rocks.filter((r) => r.age >= 0);
      const visibleShots = destruction ? [] : shots;
      renderer3d.draw(
        visibleRocks,
        t,
        scars,
        deployments,
        bursts,
        visibleShots,
        destruction,
      );
      paint(
        destruction ? [] : visibleRocks,
        t,
        bursts,
        deployments,
        destruction,
      );
    },
  };
}
