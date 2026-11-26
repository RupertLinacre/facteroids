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

// This is a game-tuning scale, not a statutory attainment score.
// Score the least demanding way to recognise a factor pair.
const cues = { 10: 14, 5: 25, 2: 29, 3: 37, 4: 41, 9: 43, 11: 48 };

export function difficultyOf(n) {
  let best = Infinity;
  for (let a = 2; a * a <= n; a++) {
    if (n % a) continue;
    const b = n / a;
    if (b <= 12) {
      let recall = a + 1.7 * b - 4;
      if ([2, 5, 10].some((k) => k === a || k === b)) recall *= 0.58;
      if (a === b) recall *= 0.8;
      best = Math.min(best, recall);
    }
    // Either side may reveal the pair, e.g. the final zero in 350.
    for (const [d, q] of [
      [a, b],
      [b, a],
    ]) {
      const recognition = cues[d] ?? (d <= 12 ? 59 + d : 82 + d / 2);
      const quotient = 2.5 * Math.log2(q);
      const familiar = q % 10 === 0 || (q & (q - 1)) === 0;
      const awkward = q > 12 && isPrime(q);
      best = Math.min(
        best,
        recognition + quotient - (familiar ? 6 : 0) + (awkward ? 9 : 0),
      );
    }
  }
  return Number.isFinite(best)
    ? Math.max(1, Math.min(100, Math.round(best)))
    : 0;
}

// Prefer familiar divisibility cues and smaller quotients when suggesting a split.
export function factorHints(n) {
  const pairs = [];
  for (let a = 2; a * a <= n; a++) {
    if (n % a) continue;
    const b = n / a;
    const rank = (d, q) => {
      const cue = { 10: 0, 2: 1, 5: 2, 3: 3, 9: 3, 4: 4, 8: 5 };
      return (cue[d] ?? (d <= 12 ? 6 : 10)) * 100 + q;
    };
    pairs.push({ a, b, score: Math.min(rank(a, b), rank(b, a)) });
  }
  return pairs.sort((a, b) => a.score - b.score).slice(0, 2)
    .map(({ a, b }) => a + " × " + b);
}

export function isPrime(n) {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return n >= 2;
}

const rowsByYear = {
  2: [2, 5, 10],
  3: [2, 3, 4, 5, 8, 10],
  4: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

// Years 5–6 extend recall through mental strategies: squares, cubes,
// friendly multiples and factor chains. Larger prime factors enter in KS3.
const limits = {
  2: { max: 100, cap: 12 },
  3: { max: 120, cap: 25 },
  4: { max: 144, cap: 29 },
  5: { max: 350, cap: 49, largestPrime: 11 },
  6: { max: 400, cap: 60, largestPrime: 19 },
  7: { max: 450, cap: 85, largestPrime: 23 },
  8: { max: 500, cap: 100, largestPrime: 29 },
};

function makeBank(year) {
  const { max, cap, largestPrime } = limits[year];
  const rows = rowsByYear[year];
  const bank = [];
  for (let n = 4; n <= max; n++) {
    if (isPrime(n)) continue;
    let peak = 0;
    let allowed = true;
    // Every possible child divides the root. Check them all, including n.
    for (let d = 2; d <= n && allowed; d++) {
      if (n % d) continue;
      if (isPrime(d)) {
        if (largestPrime && d > largestPrime) allowed = false;
      } else {
        peak = Math.max(peak, difficultyOf(d));
        if (
          rows &&
          !rows.some(
            (r) => d % r === 0 && d / r >= 2 && d / r <= (year === 2 ? 10 : 12),
          )
        )
          allowed = false;
      }
    }
    if (allowed && peak <= cap)
      bank.push({ value: n, grade: difficultyOf(n), peak });
  }
  return bank;
}
const banks = Object.fromEntries(
  Object.keys(limits).map((y) => [y, makeBank(Number(y))]),
);

export function waveCeiling(year, wave) {
  const cap = limits[year].cap;
  return Math.min(cap, Math.ceil(cap * 0.7) + wave - 1);
}

export function spawnInterval(year, wave) {
  // Approaches a floor, so later waves stay playable however long the run.
  return (7 + 6 / (1 + (wave - 1) * 0.06)) / (1 + Math.max(0, year - 3) * 0.09);
}

export function answerWindow(grade, ceiling) {
  return (
    15 + 45 * Math.max(0, Math.min(1, (grade - 1) / Math.max(1, ceiling - 1)))
  );
}

export const waveSize = 6;

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function createWaveDeck(year, wave, recent = [], random = Math.random, size = waveSize) {
  const pool = banks[year].filter((q) => q.peak <= waveCeiling(year, wave));
  const top = Math.max(...pool.map((q) => q.grade));
  const bands = [[], [], []];
  for (const q of pool) {
    // Preserve familiar tables even in late secondary waves.
    const band =
      q.grade <= Math.min(16, top * 0.38)
        ? 0
        : q.grade <= Math.min(60, top * 0.72)
          ? 1
          : 2;
    bands[band].push(q);
  }
  const order = [];
  while (order.length < size) {
    order.push(0, ...shuffle([0, 1, 1, 2, 2], random));
  }
  order.length = size;
  const selected = [];
  const used = new Set();
  for (const band of order) {
    let unused = pool.filter((q) => !used.has(q));
    if (!unused.length) {
      // Large teams can exhaust a small year group's bank. Reuse questions
      // only after every value has appeared, avoiding the most recent ones.
      used.clear();
      for (const q of selected.slice(-Math.min(5, pool.length - 1))) used.add(q);
      unused = pool.filter((q) => !used.has(q));
    }
    let options = bands[band].filter((q) => unused.includes(q));
    if (!options.length) options = unused;
    const fresh = options.filter((q) => !recent.includes(q.value));
    if (fresh.length) options = fresh;
    // Reserve very unfamiliar pairs for occasional stretch questions.
    const familiar = options.filter((q) => q.grade < 72);
    if (familiar.length && random() < 0.85) options = familiar;
    const question = options[Math.floor(random() * options.length)];
    selected.push(question);
    used.add(question);
  }
  const ceiling = Math.max(...selected.map((q) => q.grade));
  return selected.map((q) => ({
    value: q.value,
    grade: q.grade,
    ceiling,
    year,
  }));
}
