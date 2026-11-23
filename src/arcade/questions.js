const table = [24, 36, 42, 48, 54, 56, 63, 72, 81, 96, 108, 121, 144];
const challenge = [
  26, 51, 76, 85, 91, 104, 119, 136, 143, 152, 153, 161, 187, 209, 221,
];
export function numberForWave(w) {
  if (w === 1) return 70;
  const pool = w % 3 === 0 ? challenge : table;
  return pool[Math.floor(Math.random() * pool.length)];
}

// England's programmes of study specify primary tables by year. KS3 spans
// Years 7–9; the two secondary decks here are a game progression within KS3.
// Reference: RobinL/maths-game-problem-generator, national_curriculum.md.
export const defaultYear = 3;
export const years = {
  2: "Make equal groups using the 2, 5 and 10 times tables.",
  3: "Add the 3, 4 and 8 times tables and their division facts.",
  4: "Find factor pairs across all the tables up to 12 × 12.",
  5: "Use factor pairs, primes, squares and cubes to split larger numbers.",
  6: "Combine familiar factors and use place value to split numbers in steps.",
  7: "Build prime factorisations using divisibility and powers.",
  8: "Use longer prime factorisations, powers and occasional unfamiliar pairs.",
};

function tableProducts(rows, limit) {
  const values = new Set();
  for (const a of rows) for (let b = 2; b <= limit; b++) values.add(a * b);
  return values;
}
const earlyTables = tableProducts([2, 5, 10], 10);
const nextTables = tableProducts([2, 3, 4, 5, 8, 10], 12);
const allTables = tableProducts([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12);

// Every possible composite child divides the original. Check them all so
// an unexpected but valid answer cannot strand a younger player off syllabus.
function playableTables(products) {
  return [...products].filter((n) => {
    for (let d = 2; d <= n; d++) {
      if (n % d || products.has(d)) continue;
      for (let a = 2; a * a <= d; a++) if (d % a === 0) return false;
    }
    return true;
  });
}
const year2 = playableTables(earlyTables);
const year3 = playableTables(nextTables);
const year4 = [...allTables];
const pairs = [
  36, 48, 56, 63, 72, 75, 81, 84, 96, 100, 108, 120, 121, 125, 144,
];
const scaled = [
  64, 75, 80, 96, 100, 120, 125, 128, 140, 150, 160, 180, 200, 225, 250, 300,
  350,
];
const chains = [
  84, 105, 126, 128, 135, 140, 150, 168, 180, 192, 196, 210, 216, 225, 240, 270,
  280, 315, 350, 360,
];
const powers = [
  64, 81, 108, 125, 128, 144, 162, 192, 216, 225, 243, 250, 256, 288, 324, 375,
];
const mixedPowers = [
  135, 147, 175, 189, 196, 216, 225, 243, 252, 270, 288, 324, 343, 350, 360,
  375, 392, 405, 432, 441, 450,
];
const threes = [39, 51, 57, 69, 87];
const unfamiliar = [91, 119, 133, 143, 161, 187];

// Percentages apply to whole families, so adding more unfamiliar products
// cannot make them more frequent. Start each run with an accessible split.
const decks = {
  2: { opening: 10, families: [[100, year2]] },
  3: {
    opening: 24,
    families: [
      [25, year2],
      [75, year3.filter((n) => !year2.includes(n))],
    ],
  },
  4: {
    opening: 42,
    families: [
      [25, year3],
      [75, year4.filter((n) => !nextTables.has(n))],
    ],
  },
  5: {
    opening: 75,
    families: [
      [30, year4],
      [40, pairs],
      [30, scaled],
    ],
  },
  6: {
    opening: 84,
    families: [
      [35, year4],
      [33, scaled],
      [30, chains],
      [2, threes],
    ],
  },
  7: {
    opening: 128,
    families: [
      [35, year4],
      [25, scaled],
      [20, chains],
      [16, powers],
      [3, threes],
      [1, unfamiliar],
    ],
  },
  8: {
    opening: 350,
    families: [
      [35, year4],
      [20, scaled],
      [14, chains],
      [12, powers],
      [13, mixedPowers],
      [4, threes],
      [2, unfamiliar],
    ],
  },
};

// Time the easiest first move. Reassess the remainder after each split.
export function difficultyOf(n, year = defaultYear) {
  const tables = year === 2 ? earlyTables : year === 3 ? nextTables : allTables;
  if (tables.has(n) || n % 2 === 0 || n % 5 === 0) return "easy";
  const root = Math.sqrt(n);
  if (year >= 5 && Number.isInteger(root) && root <= (year >= 8 ? 15 : 12))
    return "easy";
  if (year >= 7 && [243, 343].includes(n)) return "medium";
  if (n % 3 === 0) {
    // A digit sum reveals the divisor, but 51 ÷ 3 or 153 ÷ 9
    // still demands an unfamiliar quotient.
    for (const d of [3, 9])
      if (n % d === 0 && allTables.has(n / d)) return "medium";
    return "hard";
  }
  return "expert";
}

export function answerWindow(difficulty, lane, year = defaultYear) {
  const [base, spread] = {
    easy: [15, 5],
    medium: [30, 8],
    hard: [52, 12],
    expert: [64, 12],
  }[difficulty];
  const readingTime = year === 2 ? 8 : year === 3 ? 4 : 0;
  return base + spread * lane + readingTime;
}

export function createQuestionDeck(year = defaultYear, random = Math.random) {
  const { opening, families } = decks[year];
  const recent = [];
  return function next(active) {
    const excluded = new Set([...active, ...recent]);
    const available = families
      .map(([weight, bank]) => [weight, bank.filter((n) => !excluded.has(n))])
      .filter(([, bank]) => bank.length);
    let value = opening;
    if (recent.length || active.includes(opening)) {
      if (!available.length) return null;
      let roll = random() * available.reduce((sum, [w]) => sum + w, 0);
      for (const [weight, bank] of available) {
        roll -= weight;
        if (roll < 0) {
          value = bank[Math.floor(random() * bank.length)];
          break;
        }
      }
    }
    recent.push(value);
    if (recent.length > 5) recent.shift();
    return { value, difficulty: difficultyOf(value, year) };
  };
}
