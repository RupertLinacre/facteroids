import { trailSample } from "./umbra.js";
import { planetExplosionDuration } from "./surface-strike.js";

// These pieces use the same meshes and persistent plasma wakes as prime
// asteroids. Their outward paths are sampled on the destruction clock.
export function createPlanetFragments(planet) {
  const fragments = Array.from({ length: 18 }, (_, i) => ({
    value: [2, 3, 5, 7][i % 4],
    radius: 10 + (i % 4) * 2,
    prime: true,
    tint: "#ffd594",
    orbit: { prime: true, lane: i / 18 },
    burn: 0,
    age: 0,
    speed: 1,
    trail: [],
    angle: (i * Math.PI * 2) / 18 + Math.sin(i * 17) * 0.11,
    velocity: 55 + ((i * 19) % 47),
    turn: ((i % 5) - 2) * 0.035,
    distanceOffset: (i % 7) * 0.13,
    sampled: -1,
  }));

  function position(fragment, age) {
    const unit = planet.r / 65;
    const angle = fragment.angle + fragment.turn * age;
    const distance =
      planet.r * (0.34 + (fragment.value % 3) * 0.13) +
      unit *
        (fragment.velocity * (age + fragment.distanceOffset) - 1.8 * age * age);
    return {
      x: planet.x + Math.cos(angle) * distance,
      y: planet.y + Math.sin(angle) * distance,
    };
  }

  return (elapsed) => {
    const visible = [];
    for (const fragment of fragments) {
      const age = elapsed;
      if (age < 0 || elapsed >= planetExplosionDuration - 0.85) continue;
      const lifetime = planetExplosionDuration - 0.85;
      // Store emission heat and position at the time gas was released.
      const sampleCount = Math.floor(age / 0.05);
      for (let i = fragment.sampled + 1; i <= sampleCount; i++) {
        const sampleAge = i * 0.05;
        Object.assign(fragment, position(fragment, sampleAge), {
          age: sampleAge,
          burn: Math.min(1, (sampleAge / lifetime) ** 1.5),
        });
        fragment.trail.push(
          trailSample(fragment, planet, fragment.trail.at(-1)),
        );
      }
      fragment.sampled = sampleCount;
      if (fragment.trail.length > 115)
        fragment.trail.splice(0, fragment.trail.length - 115);
      Object.assign(fragment, position(fragment, age), {
        age,
        burn: Math.min(1, (age / lifetime) ** 1.5),
      });
      visible.push(fragment);
    }
    return visible;
  };
}
