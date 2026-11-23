import { surface, disc, label, path, W, H, tau } from "./drawing.js";
export function create(canvas, audio) {
  const { ctx: c, begin } = surface(canvas);
  const pegs = [];
  for (let row = 0; row < 6; row++)
    for (let x = 56 + (row % 2) * 43; x < W - 25; x += 87)
      pegs.push({
        x,
        y: 111 + row * 46,
        r: row === 4 && x % 3 === 0 ? 15 : 7,
        flash: 0,
      });
  const bells = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    x: 60 + i * 130,
    y: 415,
    r: 23,
    flash: 0,
    bell: true,
  }));
  const pins = [...pegs, ...bells];
  const rad = (r) => Math.max(8, 21 - r.depth * 4);
  return {
    burnTime: 3,
    reset() {
      pins.forEach((p) => (p.flash = 0));
    },
    spawn(w) {
      return {
        x: 410 + Math.sin(w * 2) * 130,
        y: 43,
        vx: 18 * Math.cos(w),
        vy: 5,
      };
    },
    child(r, i, n) {
      const f = (2 * i) / (n - 1) - 1;
      return {
        x: r.x + f * 8,
        y: r.y - 3,
        vx: r.vx * 0.55 + f * (r.prime ? 85 : 101),
        vy: -33 - Math.sin((i * Math.PI) / (n - 1)) * 40,
      };
    },
    fire() {
      audio.note(178, 0.12, "triangle");
    },
    impact(r, children) {
      audio.note(children[0].prime ? 520 : 195, 0.29, "triangle");
    },
    move(r, dt, t) {
      // Substeps keep small fast fragments from passing through pins.
      for (let k = 0; k < 3; k++) {
        const h = dt / 3,
          size = rad(r);
        r.vy += (r.prime ? 180 : 33) * h;
        r.x += r.vx * h;
        r.y += r.vy * h;
        if (r.x < size + 14 || r.x > W - size - 14) {
          r.x = Math.max(size + 14, Math.min(W - size - 14, r.x));
          r.vx *= -0.82;
        }
        for (const p of pins) {
          const dx = r.x - p.x,
            dy = r.y - p.y,
            d = Math.hypot(dx, dy),
            limit = size + p.r;
          if (d >= limit || d < 0.001) continue;
          const nx = dx / d,
            ny = dy / d,
            dot = r.vx * nx + r.vy * ny;
          r.x = p.x + nx * limit;
          r.y = p.y + ny * limit;
          if (dot >= 0) continue;
          r.vx -= 1.65 * dot * nx;
          r.vy -= 1.65 * dot * ny;
          if (Math.abs(r.vx) < 9) r.vx += nx >= 0 ? 12 : -12;
          if (t > p.flash && (r.prime || p.bell))
            audio.note(
              180 * 2 ** (((r.value % 12) + Math.round(p.x / 130)) / 12),
              0.2,
              "sine",
              0.026,
            );
          p.flash = t + 0.16;
        }
      }
      return r.y > H + 12 || r.age > 38;
    },
    draw(rocks, shots, t) {
      begin();
      const bg = c.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#ffb29c");
      bg.addColorStop(0.6, "#ec8091");
      bg.addColorStop(1, "#c85d86");
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);
      c.save();
      c.globalAlpha = 0.14;
      for (let i = -3; i < 15; i++)
        path(
          c,
          [
            [i * 100, 0],
            [i * 100 - 260, H],
          ],
          "#ffedb7",
          25,
        );
      c.restore();
      for (const x of [8, W - 8])
        path(
          c,
          [
            [x, 0],
            [x, H],
          ],
          "#97612e",
          9,
        );
      for (const p of pins) {
        const lit = t < p.flash;
        disc(c, p.x + 2, p.y + 4, p.r + 1, "#8d4a64");
        const g = c.createRadialGradient(p.x - 2, p.y - 3, 0, p.x, p.y, p.r);
        g.addColorStop(0, lit ? "#fffce5" : p.bell ? "#ffe29a" : "#eee0ff");
        g.addColorStop(1, p.bell ? "#e4a333" : "#9c83d5");
        disc(c, p.x, p.y, p.r, g, p.bell ? "#8b663f" : "#a16790");
        if (p.bell) label(c, "✦", p.x, p.y, 20, "#ad7340");
        if (lit) disc(c, p.x, p.y, p.r + 4, null, "#ffeda7");
      }
      for (const r of rocks) {
        const size = rad(r);
        c.save();
        if (r.prime) {
          c.shadowBlur = 14;
          c.shadowColor = "#ffed79";
          c.globalAlpha = Math.min(1, (3 - r.age) * 2);
        }
        const g = c.createRadialGradient(
          r.x - size * 0.4,
          r.y - size * 0.5,
          1,
          r.x,
          r.y,
          size,
        );
        g.addColorStop(0, "#fff9d6");
        g.addColorStop(0.7, r.prime ? "#ffdc72" : "#ffc686");
        g.addColorStop(1, "#b57747");
        disc(c, r.x, r.y, size, g, "#875036");
        label(c, r.value, r.x, r.y, Math.max(13, size), "#462f36");
        c.restore();
      }
      for (const s of shots) {
        const p = s.age / s.duration,
          r = s.target;
        disc(c, r.x, r.y, rad(r) + 4 + (1 - p) * 22, null, "#fffada");
      }
    },
  };
}
