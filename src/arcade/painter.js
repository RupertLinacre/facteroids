import { muzzleFlash, drawEjecta } from "./ejecta.js";
import { surface, disc, path, W, H } from "./drawing.js";
import { impactSite, nextOrbitSample, visibleRadius } from "./umbra.js";
import { drawAsteroidNumber, drawComet } from "./comet.js";
import { drawImpact } from "./impact-effects.js";
import { planetExplosionDuration } from "./surface-strike.js";

export function createPainter(canvas, earth) {
  const { ctx: c, begin } = surface(canvas, earth);
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
  return (rocks, t, bursts, deployments, destruction) => {
    begin();
    drawImpactForecasts(rocks);
    for (const mount of deployments) muzzleFlash(c, mount, t);
    const numeral = Math.max(
      19,
      Math.min(32, Math.round((13 * W) / canvas.clientWidth)),
    );
    for (const r of rocks) {
      if (r.prime) drawComet(c, r, earth, t, numeral);
      else {
        c.save();
        drawAsteroidNumber(c, r, visibleRadius(r, earth), numeral, r.tint);
        c.restore();
      }
    }
    for (const b of bursts) {
      if (b.strike) {
        const scale = 0.65 * b.strike.strength ** 0.8;
        const age = ((t - b.time) / b.strike.duration) * 3;
        drawImpact(
          c,
          { x: earth.x, y: earth.y, r: earth.r - 8 },
          b.angle,
          age,
          scale,
        );
      } else {
        drawEjecta(c, b, t);
      }
    }
    if (destruction) {
      const elapsed = t - destruction.time;
      const directions = [0.18, 1.42, 2.71, 4.02, 5.3, 0.9, 2.48, 4.05, 5.75];
      for (let i = 0; i < directions.length; i++) {
        const age =
          ((elapsed - 0.45 - i * 0.075) * 3) / (planetExplosionDuration - 1.2);
        if (age < 0 || age >= 3) continue;
        drawImpact(
          c,
          { x: earth.x, y: earth.y, r: i < 5 ? earth.r - 8 : 2 },
          directions[i],
          age,
          i < 5 ? 1.15 : 1.35,
        );
      }
    }
  };
}
