import { surface, disc, path, label, noise, W, H, tau } from "./drawing.js";
const cx = 450,
  cy = 220,
  radius = 62;
function advance(r, dt) {
  const dx = cx - r.x,
    dy = cy - r.y,
    distance = Math.max(60, Math.hypot(dx, dy));
  const pull = 112000 / distance ** 3;
  r.vx += dx * pull * dt;
  r.vy += dy * pull * dt;
  r.x += r.vx * dt;
  r.y += r.vy * dt;
}
export function create(canvas, audio) {
  const { ctx: c, begin } = surface(canvas);
  let history = [];
  const stars = Array.from({ length: 120 }, (_, i) => [
    noise(i) * W,
    noise(i + 201) * H,
    noise(i + 81) * 1.15 + 0.3,
  ]);
  const swirls = Array.from({ length: 19 }, (_, i) =>
    Array.from({ length: 30 }, (_, j) => [
      cx - 70 + j * 5,
      cy -
        65 +
        i * 7 +
        Math.sin(j * 0.28 + i * 0.42) * 5 +
        Math.sin(j * 0.88 + i) * 2,
    ]),
  );
  return {
    burnTime: 2.7,
    reset() {
      history = [];
    },
    spawn(wave) {
      history = [];
      const side = wave % 2 ? 1 : -1;
      return {
        x: cx - side * 253,
        y: 95,
        vx: side * 9,
        vy: 14,
        trail: [],
        sample: 0,
      };
    },
    child(r, i, n) {
      const fan = (i / (n - 1) - 0.5) * 2;
      return {
        x: r.x,
        y: r.y,
        vx: r.vx + fan * 9,
        vy: r.vy + fan * 16,
        trail: [[r.x, r.y]],
        sample: 0,
      };
    },
    fire() {
      audio.note(240, 0.22, "triangle");
    },
    impact(r, kids) {
      history.push(r.trail);
      audio.note(kids[0].prime ? 740 : 158, 0.38, "sine");
    },
    move(r, dt) {
      advance(r, dt);
      r.sample += dt;
      if (r.sample > 0.12) {
        r.trail.push([r.x, r.y]);
        r.sample = 0;
      }
      return (
        Math.hypot(r.x - cx, r.y - cy) < radius + 4 ||
        r.age > 38 ||
        r.x < 0 ||
        r.x > W ||
        r.y < 0 ||
        r.y > H
      );
    },
    draw(rocks, shots, t) {
      begin();
      c.fillStyle = "#101f32";
      c.fillRect(0, 0, W, H);
      for (const [x, y, r] of stars) disc(c, x, y, r, "#839698");
      c.strokeStyle = "#28404c";
      for (const r of [112, 164, 212]) {
        c.beginPath();
        c.ellipse(cx, cy, r * 1.55, r, 0.1, 0, tau);
        c.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const a = (i * tau) / 120,
          length = i % 5 ? 3 : 9;
        path(
          c,
          [
            [cx + Math.cos(a) * 198, cy + Math.sin(a) * 198],
            [
              cx + Math.cos(a) * (198 + length),
              cy + Math.sin(a) * (198 + length),
            ],
          ],
          "#57676b",
        );
      }
      disc(c, cx, cy, radius + 6, "#71c7ac22", "#82bbaa");
      disc(c, cx, cy, radius, "#5db29c");
      c.save();
      c.clip();
      for (const pts of swirls) path(c, pts, "#357f77", 3);
      disc(c, cx + 44, cy + 11, 61, "#163e517d");
      c.restore();
      const moonX = cx + Math.cos(t * 0.08 - 0.6) * 143,
        moonY = cy + Math.sin(t * 0.08 - 0.6) * 95;
      disc(c, moonX, moonY, 10, "#c6c1ab");
      disc(c, moonX + 3, moonY - 3, 2, "#989986");
      const gun = [cx, cy - radius - 2];
      path(
        c,
        [
          [cx - 8, gun[1]],
          [cx, gun[1] - 10],
          [cx + 8, gun[1]],
        ],
        "#f8ebc9",
        3,
      );
      for (const pts of history) path(c, pts, "#ad9360", 1.5);
      for (const r of rocks) {
        path(c, r.trail, r.prime ? "#86f4ba" : "#dfba71", 2);
        if (!r.prime) {
          const future = { ...r },
            points = [[r.x, r.y]];
          for (let i = 0; i < 34; i++) {
            advance(future, 0.29);
            points.push([future.x, future.y]);
            if (Math.hypot(future.x - cx, future.y - cy) < radius) break;
          }
          c.setLineDash([2, 5]);
          path(c, points, "#c6c7a2");
          c.setLineDash([]);
        }
        const rad = Math.max(11, 23 - r.depth * 4);
        c.save();
        if (r.prime) {
          c.globalAlpha = Math.min(1, (2.7 - r.age) * 2);
          c.shadowBlur = 16;
          c.shadowColor = "#8effbf";
        }
        c.beginPath();
        for (let j = 0; j < 12; j++) {
          const a = (j * tau) / 12 + t * 0.1,
            d = rad * (0.82 + noise(j + r.value) * 0.24);
          c.lineTo(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d);
        }
        c.closePath();
        c.fillStyle = r.prime ? "#8ae3ad" : "#bb8950";
        c.fill();
        c.strokeStyle = "#f4d49b";
        c.stroke();
        label(c, r.value, r.x, r.y, Math.max(15, rad - 1), "#152433");
        c.restore();
      }
      for (const s of shots) {
        const p = s.age / s.duration,
          r = s.target;
        const x = gun[0] + (r.x - gun[0]) * p + Math.sin(p * Math.PI) * 34,
          y = gun[1] + (r.y - gun[1]) * p;
        path(
          c,
          [
            [x + 5, y + 5],
            [x, y],
          ],
          "#ffb663",
          4,
        );
        disc(c, x, y, 3, "#fff5d1");
      }
    },
  };
}
