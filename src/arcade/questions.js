const table = [24, 36, 42, 48, 54, 56, 63, 72, 81, 96, 108, 121, 144];
const challenge = [
  26, 51, 76, 85, 91, 104, 119, 136, 143, 152, 153, 161, 187, 209, 221,
];
export function numberForWave(w) {
  if (w === 1) return 70;
  const pool = w % 3 === 0 ? challenge : table;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Rate the easiest recognisable route into a number, rather than its magnitude.
// Halving powers of two and spotting quarters of a hundred are useful shortcuts.
export function difficultyOf(n) {
  if ((n & (n - 1)) === 0 || n % 25 === 0 || n % 10 === 0) return "easy";
  for (let a = 2; a <= 12; a++) {
    if (n % a === 0 && n / a >= 2 && n / a <= 12) return "easy";
  }
  return "hard";
}

const banks = { easy: new Set([64, 75, 100, 125, 128, 150]), hard: new Set() };
for (let a = 2; a <= 12; a++) {
  for (const b of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 19]) {
    const n = a * b;
    if (n >= 12 && n <= 221) banks[difficultyOf(n)].add(n);
  }
}

// Balance the numbers actually on screen. Siblings share a label and can all
// be hit with one answer, so count distinct challenges when choosing a tier.
export function createQuestionDeck(random = Math.random) {
  const recent = [];
  return function next(active) {
    const values = new Set(active);
    const hard = [...values].filter((n) => difficultyOf(n) === "hard").length;
    const easy = values.size - hard;
    const lastTwoEasy =
      recent.length >= 2 &&
      recent.slice(-2).every((n) => difficultyOf(n) === "easy");
    const tier = hard === 0 && (easy > 0 || lastTwoEasy) ? "hard" : "easy";
    const available = [...banks[tier]].filter(
      (n) => !values.has(n) && !recent.includes(n),
    );
    const value = recent.length
      ? available[Math.floor(random() * available.length)]
      : 70;
    recent.push(value);
    if (recent.length > 8) recent.shift();
    return { value, difficulty: difficultyOf(value) };
  };
}
