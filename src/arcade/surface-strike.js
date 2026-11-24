// Use the remaining rock in this branch of the factor tree. The same scale
// drives the airborne cloud, ballistic fragments, crater and bass transient.
export const planetExplosionDuration = 7;

export function planetVisibility(elapsed) {
  return Math.max(0, Math.min(1, (3.8 - elapsed) / 1.3));
}

export function surfaceStrike(rock) {
  const strength = (rock.radius / 21) ** 1.15 / (1 + 0.14 * rock.depth);
  return {
    strength,
    crater: 24 * strength ** 0.8,
    duration: 2.1 + 1.05 * strength,
  };
}
