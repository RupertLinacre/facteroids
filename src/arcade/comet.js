import { visibleRadius } from "./umbra.js";
import { disc, path, label } from "./drawing.js";

export function drawAsteroidNumber(c, rock, radius, size, color) {
  // Shift beside the rock only if its usual caption would fall off the bottom.
  const below = rock.y + radius * 1.2 + 2 + size / 2;
  const transform = c.getTransform();
  const bottom = (c.canvas.height - transform.f) / transform.d;
  const y = Math.min(below, bottom - size / 2 - 2);
  const x = below - y > size / 2 ? rock.x + radius + size : rock.x;
  c.font = "bold " + size + "px ui-monospace,monospace";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 3.7;
  c.strokeStyle = "#242231";
  c.strokeText(rock.value, x, y);
  label(c, rock.value, x, y, size, color);
}

export function drawComet(c, r, earth, time, numeral) {
  const p = r.burn ?? 0,
    altitude = Math.hypot(r.x - earth.x, r.y - earth.y) - earth.r;
  const heat = Math.min(1, Math.max(0.08, 1 - altitude / 122));
  const fade = Math.min(1, Math.max(0, (1 - p) * 5));
  const spine = r.trail.slice(-32);
  const phase = r.orbit.lane * 8 + r.orbit.angle;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = Math.min(1, r.age * 8) * fade;
  // Glowing bits break away from the stream as the head ablates.
  for (let i = 2; i < spine.length - 1; i += 4) {
    const [x, y, , , , localHeat] = spine[i],
      spread = (1 - i / spine.length) * 10 * localHeat;
    const dx = spread * Math.sin(phase + i * 29 + time * 2),
      dy = spread * Math.cos(phase + i * 7 + time * 2);
    path(
      c,
      [
        [x + dx, y + dy],
        [x + dx * 1.22 + 2, y + dy * 1.22 + 1],
      ],
      `hsl(${40 - 32 * localHeat}, 100%, 74%)`,
      1.5,
    );
  }
  const radius = (7 + 24 * heat) * fade + 0.1;
  const glow = c.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
  glow.addColorStop(0, "#fffdf4");
  glow.addColorStop(0.14, heat > 0.4 ? "#ffffff" : "#ffedb9");
  glow.addColorStop(0.36, heat > 0.5 ? "#ff96439e" : "#ff755982");
  glow.addColorStop(1, "#676cf900");
  disc(c, r.x, r.y, radius, glow);
  c.restore();
  // Briefly retain the number as the final generation fans out.
  if (p < 0.45) {
    c.save();
    c.globalAlpha = Math.min(1, (0.45 - p) * 5);
    drawAsteroidNumber(
      c,
      r,
      Math.max(radius * 0.5, visibleRadius(r, earth)),
      numeral,
      r.tint,
    );
    c.restore();
  }
}
