import assert from "node:assert/strict";
import test from "node:test";
import {
  answerWindow,
  createWaveDeck,
  difficultyOf,
  isPrime,
  spawnInterval,
  waveCeiling,
  waveSize,
} from "../src/arcade/questions.js";
import { Waves } from "../src/arcade/waves.js";
import { capture } from "../src/arcade/umbra.js";

test("recognition and the easiest mental route determine difficulty", () => {
  const grades = [4, 25, 56, 108, 112, 294, 119, 323].map(difficultyOf);
  assert.ok(grades.every((n, i) => !i || n > grades[i - 1]));
  assert.ok(difficultyOf(128) < difficultyOf(51));
  assert.ok(difficultyOf(350) < difficultyOf(51));
  assert.equal(answerWindow(difficultyOf(4), 100), 15);
});

function seeded(seed) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
test("waves vary, mix grades and respect the ceiling through every possible split", () => {
  const rows = {
    2: [2, 5, 10],
    3: [2, 3, 4, 5, 8, 10],
    4: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };
  for (let year = 2; year <= 8; year++) {
    const random = seeded(year);
    const openers = new Set();
    for (const wave of [1, 2, 10, 100, 1000000]) {
      for (let draw = 0; draw < 30; draw++) {
        const deck = createWaveDeck(year, wave, [], random);
        openers.add(deck[0].value);
        assert.equal(new Set(deck.map((q) => q.value)).size, waveSize);
        const ceiling = Math.max(...deck.map((q) => q.grade));
        assert.ok(deck[0].grade < ceiling);
        for (const q of deck) {
          assert.equal(q.ceiling, ceiling);
          assert.ok(answerWindow(q.grade, ceiling) >= 15);
          assert.ok(answerWindow(q.grade, ceiling) <= 60);
          for (let d = 4; d <= q.value; d++) {
            if (q.value % d || isPrime(d)) continue;
            assert.ok(difficultyOf(d) <= waveCeiling(year, wave));
            if (rows[year])
              assert.ok(
                rows[year].some(
                  (r) =>
                    d % r === 0 &&
                    d / r >= 2 &&
                    d / r <= (year === 2 ? 10 : 12),
                ),
              );
          }
        }
        const hardest = deck.find((q) => q.grade === ceiling);
        assert.equal(answerWindow(hardest.grade, ceiling), 60);
      }
    }
    assert.ok(openers.size > 2);
    assert.ok(spawnInterval(year, 1) > spawnInterval(year, 2));
    assert.ok(spawnInterval(year, 1000000) > 4);
  }
});

test("the predicted incoming orbit uses the question's answer budget", () => {
  const deck = createWaveDeck(5, 1, [], seeded(4));
  for (const [i, q] of deck.entries()) {
    const { orbit } = capture({ x: 450, y: 220, r: 65 }, i + 1, q, 20);
    assert.equal(orbit.duration, answerWindow(q.grade, q.ceiling));
  }
});

test("a failed branch needs a retry, siblings count once, and wave times are per wave", () => {
  const waves = new Waves(2, seeded(7));
  const slot = waves.next(new Set());
  slot.remaining += 2; // A partial answer made three composite children.
  waves.resolve(slot);
  waves.resolve(slot, true);
  assert.equal(waves.cleared, 0);
  waves.resolve(slot);
  assert.equal(waves.cleared, 0);
  assert.equal(waves.next(new Set()), slot);
  waves.resolve(slot);
  assert.equal(waves.cleared, 1);
  for (let i = 1; i < waveSize; i++) waves.resolve(waves.next(new Set()));
  assert.ok(waves.advance(43));
  assert.equal(waves.number, 2);
  assert.equal(waves.cleared, 0);
  waves.changeYear(3);
  for (let i = 0; i < waveSize; i++) {
    const next = waves.next(new Set());
    assert.equal(next.question.year, 3);
    waves.resolve(next);
  }
  assert.ok(waves.advance(100));
  assert.deepEqual(waves.times, [43, 57]);
});

test("team wave sizes follow the player count at wave boundaries", () => {
  const waves = new Waves(2, seeded(19), 3);
  assert.equal(waves.slots.length, 18);
  for (let i = 0; i < 18; i++) waves.resolve(waves.next(new Set()));
  assert.ok(waves.advance(60, 2));
  assert.equal(waves.slots.length, 12);
  waves.changeYear(3);
  assert.ok(waves.slots.every((slot) => slot.question.year === 3));
  for (let i = 0; i < 12; i++) waves.resolve(waves.next(new Set()));
  assert.ok(waves.advance(120, 1));
  assert.equal(waves.slots.length, 6);
});

test("large teams get complete curriculum-limited waves even when the bank is exhausted", () => {
  const deck = createWaveDeck(2, 1, [], seeded(3), 120);
  assert.equal(deck.length, 120);
  for (const q of deck) {
    for (let d = 4; d <= q.value; d++)
      if (q.value % d === 0 && !isPrime(d))
        assert.ok(difficultyOf(d) <= waveCeiling(2, 1));
  }
  for (let i = 1; i < deck.length; i++) assert.notEqual(deck[i].value, deck[i - 1].value);
});
