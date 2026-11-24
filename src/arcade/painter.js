import { muzzleFlash, drawEjecta } from "./ejecta.js";
import { surface, disc, path, label, noise, W, H, tau } from "./drawing.js";
import { impactSite, nextOrbitSample, visibleRadius } from "./umbra.js";
import { drawAsteroidNumber, drawComet } from "./comet.js";
import { flight } from "./flight.js";
import { impact as galleryImpact } from "./effects/planet-effects.js";
import { planetExplosionDuration } from "./surface-strike.js";

// Coastline mask from the public-domain Natural Earth 1:110m land polygons.
function engravedGlobe() {
  const img = new Image(),
    globe = document.createElement("canvas");
  const n = 320;
  globe.width = globe.height = n;
  img.onload = () => {
    const map = document.createElement("canvas");
    map.width = 1024;
    map.height = 512;
    const m = map.getContext("2d");
    m.drawImage(img, 0, 0);
    const land = m.getImageData(0, 0, 1024, 512).data;
    const g = globe.getContext("2d"),
      pixels = g.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const nx = (2 * x + 1) / n - 1,
          ny = (2 * y + 1) / n - 1,
          zz = 1 - nx * nx - ny * ny;
        if (zz < 0) continue;
        const nz = Math.sqrt(zz),
          lon = Math.atan2(nx, nz) - 0.18,
          lat = Math.asin(-ny);
        const u = Math.floor((lon / tau + 0.5) * 1024),
          v = Math.floor((0.5 - lat / Math.PI) * 512);
        const shore = land[(v * 1024 + u) * 4] / 255;
        const light = 0.58 + 0.36 * nz - 0.26 * nx - 0.17 * ny;
        const hatch = Math.sin((x + y) * 1.23) > 0.5 ? -0.08 : 0;
        const grid =
          Math.min(Math.abs(Math.sin(lon * 6)), Math.abs(Math.sin(lat * 6))) <
          0.035
            ? 0.2
            : 0;
        const i = (y * n + x) * 4;
        [37 + shore * 113, 100 + shore * 85, 108 + shore * 47].forEach(
          (k, j) => (pixels.data[i + j] = k * (light + hatch + grid)),
        );
        pixels.data[i + 3] = 255;
      }
    g.putImageData(pixels, 0, 0);
  };
  img.src = "/art/land.svg";
  return globe;
}
function polygon(c, points, color, stroke) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function weapon(c, x, y, target, ink, light, ground) {
  const a = target ? Math.atan2(target.y - y, target.x - x) : -Math.PI / 2;
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = ink;
  c.fillRect(0, -3, ground ? 27 : 16, 6);
  c.fillStyle = light;
  c.fillRect(ground ? 20 : 11, -3, 5, 3);
  c.restore();
  polygon(
    c,
    [
      [x - 17, y + 5],
      [x - 10, y - 3],
      [x + 7, y - 6],
      [x + 16, y + 6],
    ],
    ink,
    light,
  );
  disc(c, x, y, 3, light);
}
export function createPainter(canvas, world, earth, models) {
  const { ctx: c, begin } = surface(
      canvas,
      world.slug === "umbra-station" ? earth : null,
    ),
    ground = world.horizon,
    chart = world.slug === "orbital-defence",
    coast = world.slug === "ember-coast";
  const umbra = world.slug === "umbra-station";
  const globe = chart ? engravedGlobe() : null;
  function launcher(target) {
    const a =
      ground || !target
        ? -Math.PI / 2
        : Math.atan2(target.y - earth.y, target.x - earth.x);
    return {
      x: earth.x + Math.cos(a) * (earth.r + 4),
      y: earth.y + Math.sin(a) * (earth.r + 4),
    };
  }
  const dark = coast ? "#4a2430" : "#192f3a",
    bright = coast ? "#ffedb3" : world.color;
  function drawImpactForecasts(rocks) {
    const earliest = new Map();
    const fontSize = Math.min(22, Math.max(11, (10 * W) / canvas.clientWidth));
    c.save();
    c.font = "600 " + fontSize + "px ui-monospace, monospace";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    for (const rock of rocks) {
      if (rock.prime || rock.safe || rock.locked) continue;
      const site = impactSite(rock.orbit, earth);
      const color = rock.tint;
      const points = rock.orbit.path;
      c.beginPath();
      c.moveTo(rock.x, rock.y);
      for (
        let i = nextOrbitSample(rock.orbit, rock.age) * 2;
        i < points.length;
        i += 2
      )
        c.lineTo(points[i], points[i + 1]);
      c.lineTo(site.x, site.y);
      c.strokeStyle = color;
      c.globalAlpha = 0.67;
      c.setLineDash([2, 5]);
      c.stroke();
      c.globalAlpha = 1;
      c.setLineDash([]);
      const remaining = (rock.orbit.duration - rock.age) / (rock.speed ?? 1);
      if (
        !earliest.has(rock.value) ||
        remaining < earliest.get(rock.value).remaining
      ) {
        earliest.set(rock.value, { site, color, remaining });
      }
    }
    const markers = [...earliest.values()];
    // Offset neighbouring timers while keeping their leaders at the impact sites.
    for (const side of [-1, 1]) {
      const group = markers.filter(
        ({ site }) => (site.x < earth.x ? -1 : 1) === side,
      );
      group.sort((a, b) => a.site.y - b.site.y);
      let previousY = -Infinity,
        column = 0;
      for (const { site, color, remaining } of group) {
        const seconds = Math.ceil(remaining);
        if (previousY + fontSize * 1.5 + 3 > H) {
          column++;
          previousY = -Infinity;
        }
        const x = site.x + side * (fontSize + 2 + column * fontSize * 4);
        const y = Math.max(site.y, previousY + fontSize + 3);
        previousY = y;
        path(
          c,
          [
            [site.x, site.y],
            [x - side * 2, y],
          ],
          color,
          1,
        );
        disc(c, site.x, site.y, 2.2, color, "#292335");
        c.textAlign = side < 0 ? "right" : "left";
        c.strokeStyle = "#171321";
        c.lineWidth = 3;
        c.strokeText(seconds + "s", x, y);
        c.fillStyle = color;
        c.fillText(seconds + "s", x, y);
        c.lineWidth = 1;
      }
    }
    c.restore();
  }
  function drawMap(t) {
    if (!ground && !umbra) {
      c.save();
      c.translate(earth.x, earth.y);
      for (const scale of [1.52, 2.17]) {
        c.beginPath();
        c.ellipse(0, 0, earth.r * scale * 1.43, earth.r * scale, -0.12, 0, tau);
        c.strokeStyle = chart ? "#d8bd8345" : "#afc9ff23";
        c.stroke();
      }
      if (chart) {
        for (let j = 0; j < 96; j++) {
          const a = (j * tau) / 96,
            d = j % 4 ? 3 : 8;
          path(
            c,
            [
              [Math.cos(a) * 192, Math.sin(a) * 192],
              [Math.cos(a) * (192 + d), Math.sin(a) * (192 + d)],
            ],
            "#dbc99a60",
          );
        }
        disc(c, 0, 0, earth.r + 5, "#8fdab916", "#b1d7bd");
        disc(c, 0, 0, earth.r, "#447e80");
        c.drawImage(globe, -earth.r, -earth.r, earth.r * 2, earth.r * 2);
        for (const [a, txt] of [
          [0, "E"],
          [Math.PI, "W"],
        ])
          label(c, txt, Math.cos(a) * 211, Math.sin(a) * 211, 10, "#d7c79e");
        const a = t * 0.054 - 0.7,
          mx = Math.cos(a) * 157,
          my = Math.sin(a) * 100;
        disc(c, mx, my, 8, "#dacba9", "#9d957d");
        disc(c, mx - 2, my + 1, 2, "#a3977a");
      }
      c.restore();
    }
    if (ground && !models) {
      const ridge = [];
      for (let x = -10; x < 920; x += 6) {
        const y = earth.y - Math.sqrt(earth.r ** 2 - (x - earth.x) ** 2);
        ridge.push([x, y + 2 * (noise(x) - 0.5)]);
      }
      polygon(c, [...ridge, [920, H], [-10, H]], "#582e39", "#ffd794");
      for (let j = 0; j < 14; j++)
        path(
          c,
          ridge.map(([x, y]) => [
            x,
            y + 5 * j + Math.sin(x * 0.022 + j * 0.6) * 2,
          ]),
          j % 4 === 0 ? "#ce77496e" : "#9e534752",
        );
      for (let j = 0; j < 9; j++) {
        const x = 55 + noise(j + 12) * 790;
        if (Math.abs(x - 450) < 45) continue;
        const y = earth.y - Math.sqrt(earth.r ** 2 - (x - earth.x) ** 2) + 5,
          h = 5 + noise(j + 30) * 12;
        polygon(
          c,
          [
            [x - 6, y],
            [x, y - h],
            [x + 4, y - 4],
            [x + 2, y - 4],
            [x + 6, y],
          ],
          "#542a32",
        );
      }
    }
  }
  return (
    rocks,
    shots,
    t,
    scars,
    history,
    bursts,
    deployments,
    destruction,
  ) => {
    begin();
    drawMap(t);
    if (umbra) drawImpactForecasts(rocks);
    if (!umbra)
      for (const scar of scars) {
        c.save();
        c.translate(scar.x, scar.y);
        c.rotate(scar.angle + Math.PI / 2);
        c.scale(1, 0.55);
        disc(c, 0, 0, 15, "#e5b383", "#ffd39e");
        disc(c, 0, 0, 12, "#573839");
        disc(c, -2, 2, 8, "#261f2b");
        for (let j = 0; j < 6; j++) {
          const a = (j * tau) / 6;
          path(
            c,
            [
              [Math.cos(a) * 13, Math.sin(a) * 13],
              [Math.cos(a + 0.12) * 22, Math.sin(a + 0.12) * 20],
            ],
            "#b7826e",
            1.4,
          );
        }
        c.restore();
      }
    const aim = shots[0]?.target ?? rocks.find((r) => !r.safe && !r.prime);
    const mount = launcher(aim);
    if (!umbra && (!models || !ground))
      weapon(c, mount.x, mount.y, aim, dark, bright, ground);
    for (const mount of deployments) muzzleFlash(c, mount, t);
    const numeral = Math.max(
      19,
      Math.min(32, Math.round((13 * W) / canvas.clientWidth)),
    );
    for (const h of history) {
      c.globalAlpha = Math.max(0, 1 - (t - h.time) / 4) * 0.5;
      path(c, h.points, bright, 1.5);
    }
    c.globalAlpha = 1;
    for (const r of rocks) {
      if (r.orbit?.prime) {
        drawComet(c, r, earth, t, numeral);
        continue;
      }
      const rad = r.radius ?? Math.max(12, 24 - r.depth * 4);
      const hot = r.prime
        ? "#afffcc"
        : r.safe
          ? "#9cdfe0"
          : coast
            ? "#712a30"
            : "#ffc681";
      c.save();
      if (r.prime || r.safe)
        c.globalAlpha = Math.max(
          0,
          Math.min(1, ((r.prime ? 2 : 3.2) - r.age) * 2),
        );
      if (!umbra) path(c, r.trail, hot, r.prime ? 2.4 : 1.6);
      if (!umbra && !r.prime && !r.safe) {
        const future = { ...r },
          pts = [[r.x, r.y]];
        for (let j = 0; j < 65; j++) {
          const hit = flight(future, earth, 0.25);
          pts.push([future.x, future.y]);
          if (hit) break;
        }
        c.setLineDash([2, 5]);
        path(c, pts, coast ? "#633038a9" : "#f8d8969c");
        c.setLineDash([]);
      }
      const altitude = Math.hypot(r.x - earth.x, r.y - earth.y) - earth.r;
      if (
        world.slug !== "umbra-station" &&
        !r.prime &&
        !r.safe &&
        altitude < 75
      ) {
        const heat = 1 - altitude / 75,
          a = Math.atan2(r.vy, r.vx);
        c.save();
        c.translate(r.x, r.y);
        c.rotate(a);
        const plume = c.createLinearGradient(-rad - 45 * heat, 0, 0, 0);
        plume.addColorStop(0, "#ff924400");
        plume.addColorStop(0.72, "#ff9e5988");
        plume.addColorStop(1, "#ffe3a5");
        polygon(
          c,
          [
            [-rad - 45 * heat, 0],
            [-8, -rad * 0.75],
            [4, 0],
            [-8, rad * 0.78],
          ],
          plume,
        );
        c.restore();
      }
      if (r.prime) {
        const a = Math.atan2(r.vy, r.vx);
        c.save();
        c.translate(r.x, r.y);
        c.rotate(a);
        const len = 22 + 11 * Math.sin(t * 23 + r.vx);
        polygon(
          c,
          [
            [-len * 1.7, -2],
            [-8, -9],
            [6, 0],
            [-8, 8],
          ],
          "#ff884aa0",
        );
        polygon(
          c,
          [
            [-len, 0],
            [-5, -5],
            [6, 0],
            [-5, 4],
          ],
          "#fff5ae",
        );
        c.restore();
      }
      if (!models) {
        const verts = Array.from({ length: 11 }, (_, j) => {
          const a = (j * tau) / 11 + t * 0.17,
            d = rad * (0.8 + noise(j + r.value) * 0.25);
          return [r.x + Math.cos(a) * d, r.y + Math.sin(a) * d];
        });
        polygon(
          c,
          verts,
          r.prime ? "#e1ffc1" : coast ? "#472731" : "#b48b56",
          r.prime ? "#f4ffd9" : coast ? "#ffbc77" : "#ffdd9e",
        );
        for (let j = 0; j < 4; j++)
          polygon(
            c,
            [verts[j], verts[j + 1], [r.x - 3, r.y - 2]],
            coast ? "#a65542" : "#d3ac70",
          );
      }
      if (!models && !r.prime) {
        c.save();
        c.beginPath();
        c.arc(r.x, r.y, rad * 0.7, 0, tau);
        c.clip();
        const rockInk = coast ? "#b670486a" : "#6c563c8a";
        for (let j = 0; j < 8; j++) {
          const angle = noise(j + 7) * tau + t * 0.15,
            offset = rad * (0.35 + noise(j + 33) * 0.42);
          const x = r.x + Math.cos(angle) * offset,
            y = r.y + Math.sin(angle) * offset;
          if (chart) disc(c, x, y, 1 + noise(j + 16) * 2.6, rockInk);
          else
            path(
              c,
              [
                [x - 2, y + 2],
                [x + 5, y - 1],
              ],
              rockInk,
              1.2,
            );
        }
        c.restore();
      }
      if (umbra) {
        drawAsteroidNumber(c, r, visibleRadius(r, earth), numeral, r.tint);
      } else {
        c.font = "bold " + numeral + "px ui-monospace,monospace";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.lineWidth = 3.7;
        c.strokeStyle = "#242231";
        c.strokeText(r.value, r.x, r.y);
        label(c, r.value, r.x, r.y, numeral, r.prime ? "#efffc8" : "#fff9e9");
      }
      c.restore();
    }
    for (const s of shots) {
      if (s.mount) continue;
      const p = s.age / s.duration,
        r = s.target,
        n = s.factors.length,
        gun = launcher(r);
      for (let j = 0; j < n; j++) {
        const bend = (j - (n - 1) / 2) * (coast ? 56 : 82);
        const sample = (u) => {
          const curve = Math.sin(Math.PI * u);
          return [
            gun.x + (r.x - gun.x) * u + curve * bend,
            gun.y + (r.y - gun.y) * u - curve * 30,
          ];
        };
        const pts = Array.from({ length: 19 }, (_, i) =>
          sample(Math.max(0, p - (18 - i) * 0.013)),
        );
        c.save();
        c.shadowColor = bright;
        c.shadowBlur = 8;
        path(c, pts, coast ? "#c53a2d" : bright, 3.2);
        path(c, pts, "#fff8d7", 1.2);
        const [hx, hy] = sample(p);
        if (coast) {
          for (let k = 0; k < 5; k++) {
            const [x, y] = sample(Math.max(0, p - k * 0.04));
            disc(
              c,
              x + Math.sin(k * 3) * 3,
              y + Math.cos(k * 5) * 3,
              1.5,
              "#ac392e",
            );
          }
        } else if (world.slug === "aurora-array") {
          polygon(
            c,
            [
              [hx, hy - 8],
              [hx + 3, hy],
              [hx, hy + 8],
              [hx - 3, hy],
            ],
            "#e3fff8",
          );
          path(
            c,
            [
              [hx - 9, hy],
              [hx + 9, hy],
            ],
            "#a4e6ff",
            1,
          );
        } else disc(c, hx, hy, 3.3, "#fff8d7");
        c.restore();
      }
    }
    for (const b of bursts) {
      if (umbra) {
        if (b.strike) {
          const scale = 0.65 * b.strike.strength ** 0.8;
          const age = ((t - b.time) / b.strike.duration) * 3;
          galleryImpact(
            c,
            "combined",
            { x: earth.x, y: earth.y, r: earth.r - 8 },
            b.angle,
            age,
            scale,
            false,
          );
        } else {
          drawEjecta(c, b, t);
        }
        continue;
      }
      const age = t - b.time,
        l = 1 - age / 1.2,
        ink =
          b.type === "impact"
            ? "#ff8d61"
            : b.type === "prime"
              ? "#cbffb5"
              : bright;
      c.save();
      c.globalAlpha = l;
      c.strokeStyle = ink;
      c.lineWidth = 2;
      disc(c, b.x, b.y, 4 + age * (b.type === "impact" ? 48 : 25), null, ink);
      for (let i = 0; i < b.count; i++) {
        const a = noise(i + 11) * tau,
          v = 20 + noise(i + 71) * 60;
        const x = b.x + Math.cos(a) * v * age,
          y = b.y + Math.sin(a) * v * age + age * age * 10;
        path(
          c,
          [
            [x, y],
            [x + Math.cos(a) * 5 * l, y + Math.sin(a) * 5 * l],
          ],
          ink,
          2.5 * l + 0.4,
        );
      }
      c.restore();
    }
    if (destruction) {
      const elapsed = t - destruction.time;
      const directions = [0.18, 1.42, 2.71, 4.02, 5.3, 0.9, 2.48, 4.05, 5.75];
      for (let i = 0; i < directions.length; i++) {
        const age =
          ((elapsed - 0.45 - i * 0.075) * 3) / (planetExplosionDuration - 1.2);
        if (age < 0 || age >= 3) continue;
        galleryImpact(
          c,
          "combined",
          { x: earth.x, y: earth.y, r: i < 5 ? earth.r - 8 : 2 },
          directions[i],
          age,
          i < 5 ? 1.15 : 1.35,
          false,
        );
      }
    }
  };
}
