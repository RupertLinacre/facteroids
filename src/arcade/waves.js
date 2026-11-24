import { createWaveDeck } from "./questions.js";

// Each slot follows one incoming number and all its dangerous descendants.
// A missed branch costs health and returns that slot to the queue.
export class Waves {
  constructor(year, random = Math.random) {
    this.year = year;
    this.random = random;
    this.times = [];
    this.recent = [];
    this.begin(0);
  }

  get number() {
    return this.times.length + 1;
  }

  get cleared() {
    return this.slots.filter((s) => s.cleared).length;
  }

  begin(clock) {
    this.started = clock;
    this.answers = 0;
    this.slots = createWaveDeck(
      this.year,
      this.number,
      this.recent,
      this.random,
    ).map((question) => ({
      question,
      remaining: 0,
      missed: false,
      cleared: false,
    }));
  }

  changeYear(year) {
    this.year = year;
    const deck = createWaveDeck(year, this.number, this.recent, this.random);
    this.slots.forEach((slot, i) => {
      if (!slot.cleared) {
        // Live rocks keep their own orbit and deadline. A retry uses the new year.
        slot.question = deck[i];
      }
    });
  }

  next(active) {
    const slot = this.slots.find(
      (s) => !s.cleared && !s.remaining && !active.has(s.question.value),
    );
    if (!slot) return;
    slot.remaining = 1;
    slot.missed = false;
    this.recent.push(slot.question.value);
    if (this.recent.length > 12) this.recent.shift();
    return slot;
  }

  resolve(slot, missed = false) {
    slot.missed ||= missed;
    slot.remaining--;
    slot.cleared = slot.remaining === 0 && !slot.missed;
  }

  advance(clock) {
    if (this.cleared !== this.slots.length) return false;
    this.times.push(clock - this.started);
    this.begin(clock);
    return true;
  }
}
