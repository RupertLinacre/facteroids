// Times use the simulation clock so the launcher and missile pause together.
export const fireAt = 0.38;
export const stowAt = 1.4;
export const interceptAt = fireAt + 0.62;

const weapons = [
  { name: "Interceptor", color: "#76ddff", reach: 31 },
  { name: "Heavy torpedo", color: "#ffac59", reach: 39 },
  { name: "Nova cannon", color: "#d390ff", reach: 46 },
];

export function weaponFor(count) {
  const rank = count - 2,
    chassis = Math.min(rank, weapons.length - 1);
  return { ...weapons[chassis], chassis, power: 1 + rank * 0.26 };
}

export function deploy(intercept, earth, time, weapon) {
  const angle = Math.atan2(intercept.y - earth.y, intercept.x - earth.x) + 0.18;
  const x = earth.x + (earth.r - 5) * Math.cos(angle);
  const y = earth.y + (earth.r - 5) * Math.sin(angle);
  const aim = Math.atan2(intercept.y - y, intercept.x - x);
  const reach = Math.min(
    weapon.reach * weapon.power,
    Math.hypot(intercept.x - x, intercept.y - y) * 0.64,
  );
  return {
    x,
    y,
    aim,
    reach,
    time,
    weapon,
    intercept,
    muzzle: { x: x + reach * Math.cos(aim), y: y + reach * Math.sin(aim) },
  };
}
