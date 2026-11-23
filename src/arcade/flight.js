// Integrate in playfield units. The horizon is the limb of a much larger sphere.
export function planet(horizon) {
  return horizon
    ? { x: 450, y: 2290, r: 1915, gravity: 6 }
    : { x: 450, y: 220, r: 78, gravity: 24 };
}
export function flight(body, earth, dt) {
  const x = body.x - earth.x,
    y = body.y - earth.y,
    distance = Math.max(1, Math.hypot(x, y));
  const nx = x / distance,
    ny = y / distance;
  if (body.safe) {
    // A deflection clears the atmosphere. Keep flying the harmless debris out.
    body.vx += nx * 14 * dt;
    body.vy += ny * 14 * dt;
  } else {
    const height = Math.max(0, distance - earth.r);
    const g = earth.gravity * (earth.r / Math.max(earth.r, distance)) ** 2;
    const drag = Math.exp(-dt * (0.002 + 0.12 * Math.exp(-height / 55)));
    body.vx = body.vx * drag - nx * g * dt;
    body.vy = body.vy * drag - ny * g * dt;
  }
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  return Math.hypot(body.x - earth.x, body.y - earth.y) <= earth.r + 5;
}
export function incoming(earth, wave) {
  const side = wave % 2 ? 1 : -1,
    phase = (wave * 0.61803398875) % 1;
  if (earth.r > 1000)
    return {
      x: 450 - side * (200 + 90 * phase),
      y: 42 + phase * 32,
      vx: side * (11 + phase * 19),
      vy: -4 + phase * 18,
    };
  // Occasional high passes have enough angular momentum to circle back.
  const highPass = wave % 4 === 0;
  const dx = -side * (highPass ? 174 : 238 + phase * 52),
    dy = -(55 + phase * 35),
    r = Math.hypot(dx, dy);
  // Start near apoapsis. Shallow approaches lose energy over a longer arc.
  const peri = earth.r * (highPass ? 2.1 : 0.58 + phase * 0.92),
    mu = earth.gravity * earth.r ** 2;
  const speed = Math.sqrt((2 * mu * peri) / (r * (r + peri)));
  return {
    x: earth.x + dx,
    y: earth.y + dy,
    vx: (dy / r) * speed * side + (highPass ? 0 : side * 4),
    vy: (-dx / r) * speed * side,
  };
}
export function fragment(rock, index, count, earth) {
  if (index === 0 && !rock.safe)
    return { x: rock.x, y: rock.y, vx: rock.vx, vy: rock.vy, safe: false };
  const angle = Math.atan2(rock.y - earth.y, rock.x - earth.x);
  const offset = count === 2 ? 0.98 : ((index + 0.5) / count - 0.5) * 2.55;
  const speed = 43 + 6 * (index % 4);
  return {
    x: rock.x,
    y: rock.y,
    vx: rock.vx * 0.3 + Math.cos(angle + offset) * speed,
    vy: rock.vy * 0.3 + Math.sin(angle + offset) * speed,
    safe: true,
  };
}
