import { planet, incoming, flight, fragment } from "./flight.js";
import { createPainter } from "./painter.js";

export async function create(canvas, audio, world) {
  const earth = planet(world.horizon);
  let renderer3d;
  if (world.dimension === "3D") {
    const { createModels } = await import("./models.js");
    renderer3d = createModels(canvas, earth, world);
  }
  const paint = createPainter(canvas, world, earth, !!renderer3d);
  let scars = [],
    history = [],
    bursts = [];
  function burst(x, y, time, type, count) {
    bursts.push({ x, y, time, type, count });
  }
  return {
    burnTime: 2.0,
    reset() {
      scars = [];
      history = [];
      bursts = [];
    },
    spawn(wave) {
      return { ...incoming(earth, wave), trail: [], sample: 0, safe: false };
    },
    child(r, i, n) {
      return { ...fragment(r, i, n, earth), trail: [[r.x, r.y]], sample: 0 };
    },
    fire(r, n) {
      audio.note(165 + n * 55, 0.18, "triangle");
    },
    impact(r, kids, t) {
      history.push({ points: r.trail, time: t });
      burst(
        r.x,
        r.y,
        t,
        kids[0].prime ? "prime" : "split",
        kids[0].prime ? 26 : 16,
      );
      audio.note(kids[0].prime ? 784 : 180, 0.29, "triangle");
    },
    hit(r, t) {
      const angle = Math.atan2(r.y - earth.y, r.x - earth.x);
      const scar = {
        x: earth.x + Math.cos(angle) * (earth.r - 5),
        y: earth.y + Math.sin(angle) * (earth.r - 5),
        angle,
      };
      scars.push(scar);
      burst(scar.x, scar.y, t, "impact", 40);
      audio.note(54, 0.65, "sawtooth", 0.035);
    },
    move(r, dt) {
      const collided = flight(r, earth, dt);
      r.sample += dt;
      if (r.sample > 0.1) {
        r.trail.push([r.x, r.y]);
        if (r.trail.length > 115) r.trail.shift();
        r.sample = 0;
      }
      if (r.safe)
        return r.age > 3.2 || r.x < -30 || r.x > 930 || r.y < -40 || r.y > 480;
      return collided;
    },
    draw(rocks, shots, t) {
      history = history.filter((h) => t - h.time < 4);
      bursts = bursts.filter((b) => t - b.time < 1.2);
      renderer3d?.draw(rocks, t);
      paint(rocks, shots, t, scars, history, bursts);
    },
  };
}
