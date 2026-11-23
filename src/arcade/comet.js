import { disc, path } from "./drawing.js";

// Both edges follow the fragment's sampled orbit, so even a very tight turn
// leaves a curved wake. Width and turbulence taper to zero at the tail.
function ribbon(c, spine, width, color, time, phase) {
  const left = [],
    right = [];
  for (let i = 0; i < spine.length; i++) {
    const [x, y] = spine[i],
      prev = spine[Math.max(0, i - 1)],
      next = spine[Math.min(spine.length - 1, i + 1)];
    const dx = next[0] - prev[0],
      dy = next[1] - prev[1],
      length = Math.hypot(dx, dy) || 1;
    const u = i / (spine.length - 1),
      swirl = Math.sin(i * 0.63 - time * 9 + phase) * Math.sin(Math.PI * u);
    const w =
      width *
      Math.pow(u, 0.83) *
      (0.45 + 0.55 * Math.sin(Math.PI * u)) *
      (1 + 0.16 * swirl);
    const off = width * 0.32 * swirl;
    left.push([x - (dy / length) * (off + w), y + (dx / length) * (off + w)]);
    right.push([x - (dy / length) * (off - w), y + (dx / length) * (off - w)]);
  }
  c.beginPath();
  for (const [i, p] of [...left, ...right.reverse()].entries())
    i ? c.lineTo(...p) : c.moveTo(...p);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

export function drawComet(c, r, earth, time, numeral) {
  const p = r.age / r.orbit.duration,
    altitude = Math.hypot(r.x - earth.x, r.y - earth.y) - earth.r;
  const heat = Math.min(1, Math.max(0.08, 1 - altitude / 122));
  const fade = Math.min(1, Math.max(0, (1 - p) * 5));
  const spine = [...r.trail.slice(-32), [r.x, r.y]];
  const phase = r.orbit.lane * 8 + r.orbit.angle,
    width = (2.5 + 5.5 * heat) * fade;
  c.save();
  c.globalCompositeOperation = "lighter";
  const visible = Math.min(1, r.age * 8) * fade;
  c.globalAlpha = 0.45 * visible;
  ribbon(c, spine, width * 1.85, "#9e3a37", time, phase);
  c.globalAlpha = 0.8 * visible;
  ribbon(c, spine, width, heat > 0.5 ? "#ff7226" : "#ed4b2c", time, phase);
  ribbon(
    c,
    spine,
    width * 0.39,
    heat > 0.5 ? "#ffda8c" : "#ffc08a",
    time,
    phase,
  );
  // Glowing bits break away from the stream as the head ablates.
  for (let i = 2; i < spine.length - 1; i += 4) {
    const [x, y] = spine[i],
      spread = (1 - i / spine.length) * 10 * heat;
    const dx = spread * Math.sin(phase + i * 29 + time * 2),
      dy = spread * Math.cos(phase + i * 7 + time * 2);
    path(
      c,
      [
        [x + dx, y + dy],
        [x + dx * 1.22 + 2, y + dy * 1.22 + 1],
      ],
      "#ffb378",
      1.5,
    );
  }
  const radius = (10 + 13 * heat) * fade + 0.1;
  const glow = c.createRadialGradient(r.x, r.y, 0, r.x, r.y, radius);
  glow.addColorStop(0, "#fffdf4");
  glow.addColorStop(0.14, "#ffedb9");
  glow.addColorStop(0.36, heat > 0.5 ? "#ff96439e" : "#ff755982");
  glow.addColorStop(1, "#676cf900");
  disc(c, r.x, r.y, radius, glow);
  c.restore();
  // Briefly retain the number as the final generation fans out.
  if (p < 0.45) {
    c.save();
    c.globalAlpha = Math.min(1, (0.45 - p) * 5);
    c.font = "bold " + numeral + "px ui-monospace,monospace";
    c.textBaseline = "bottom";
    c.textAlign = "center";
    c.strokeStyle = "#141d32";
    c.lineWidth = 3;
    c.strokeText(r.value, r.x, r.y - 7);
    c.fillStyle = "#fff1cd";
    c.fillText(r.value, r.x, r.y - 7);
    c.restore();
  }
}
