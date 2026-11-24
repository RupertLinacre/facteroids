import {
  stationLayout,
  bindKeypad,
  selectedYear,
  bindYearMenu,
  bindPaceMenu,
} from "./station-ui.js";
import "./station.css";
import { parseFactorisation } from "../factors.js";
import { fireAt, interceptAt } from "./deployment.js";
import { createQuestionDeck } from "./questions.js";
import { instrument } from "./audio.js";
import { create } from "./orbital.js";
import { planetExplosionDuration } from "./surface-strike.js";
const isPrime = (n) => {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return n >= 2;
};

export async function play() {
  document.title = "Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = stationLayout();

  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas"),
    input = $("#factors"),
    status = $("[role=status]"),
    audio = instrument();
  function disableAnswer(disabled) {
    input.disabled = disabled;
    $(".station-keys").disabled = disabled;
    $(".desktop-send").disabled = disabled;
  }
  let scene;
  try {
    scene = await create(canvas, audio);
  } catch (error) {
    console.error(error);
    $(".overlay").hidden = false;
    $(".overlay h2").textContent = "Graphics unavailable";
    $(".overlay p").textContent =
      "Try a browser with hardware acceleration enabled.";
    $("#resume").hidden = true;
    disableAnswer(true);
    $("#pause").disabled = true;
    $(".menu-stats").hidden = true;
    root.querySelectorAll(".year-setting").forEach((el) => (el.hidden = true));
    $("#restart").hidden = true;
    $("#sound").hidden = true;
    return;
  }

  let year = selectedYear();
  const pace = bindPaceMenu(root);
  bindKeypad($("form"), input);
  bindYearMenu(root, year, (next) => {
    year = next;
    nextQuestion = createQuestionDeck(year);
  });
  let nextQuestion, aftermath, feedbackUntil;
  let rocks, shots, score, health, wave, clock, nextWave, paused, lastTime;
  function feedback(message) {
    status.textContent = message;
    feedbackUntil = clock + 4;
  }
  const readout = () => {
    $("#score").textContent = score;
    $("#health").textContent = health + "%";
    const meter = $(".planet-health");
    meter.setAttribute("aria-valuenow", String(health));
    meter.dataset.critical = String(health <= 25);
    $("#wave").textContent = wave;
    const counts = new Map();
    rocks
      .filter((r) => !r.prime && !r.locked && !r.safe)
      .forEach((r) => counts.set(r.value, (counts.get(r.value) || 0) + 1));
    $(".targets").textContent = [...counts]
      .map(([v, n]) => (n > 1 ? n + " incoming " + v : "Target " + v))
      .join(" · ");
  };
  function rock(value, depth, pose) {
    return {
      value,
      depth,
      prime: isPrime(value),
      tint: `hsl(${(302 + value * 137.508) % 360}, 68%, 77%)`,
      age: 0,
      born: clock,
      locked: false,
      ...pose,
    };
  }
  function spawn() {
    const active = rocks.filter((r) => !r.safe && !r.prime).map((r) => r.value);
    const question = nextQuestion(active);
    if (!question) return;
    const v = question.value;
    wave++;
    const radius =
      { easy: 19, medium: 25, hard: 31, expert: 33 }[question.difficulty] +
      (v % 7);
    const position = scene.spawn(wave, question.difficulty, radius, year);
    position.radius = radius;
    rocks.push(rock(v, 0, position));
    nextWave = 0;
    readout();
  }
  function reset() {
    aftermath = 0;
    nextQuestion = createQuestionDeck(year);
    audio.reset();
    scene.reset();
    rocks = [];
    shots = [];
    score = 0;
    health = 100;
    wave = 0;
    clock = 0;
    paused = false;
    $(".overlay").hidden = true;
    $("#pause").disabled = false;
    $("#pause").setAttribute("aria-expanded", "false");
    $(".planet-health").hidden = false;
    disableAnswer(false);
    feedbackUntil = 0;
    input.value = "";
    status.textContent = "";
    spawn();
    input.focus({ preventScroll: true });
  }
  function overlay(title, message, button) {
    $(".overlay h2").textContent = title;
    $(".overlay p").textContent = message;
    $("#resume").textContent = button;
    $(".overlay").hidden = false;
    $("#resume").focus({ preventScroll: true });
  }
  function pause() {
    if (!health) return;
    paused = !paused;
    $("#pause").setAttribute("aria-expanded", String(paused));
    audio.pause(paused);
    disableAnswer(paused);
    if (paused) overlay("Paused", "", "Resume");
    else {
      $(".overlay").hidden = true;
      input.focus();
    }
  }
  function shoot(target, factors, delay = 0) {
    target.locked = true;
    delay = Math.max(delay, -target.age / pace.speed);
    const mount = scene.deploy(
      target,
      clock + delay,
      factors.length,
      pace.speed,
      delay,
    );
    shots.push({ target, factors, age: -delay, duration: interceptAt, mount });
    return mount;
  }
  function impact(shot) {
    const { target, factors, mount } = shot;
    // A single warhead resolves every submitted split at contact.
    // Count the intermediate nodes for scoring without spawning extra shots.
    const levels = factors.length - 1;
    let pieces = 1,
      points = 0;
    for (const factor of factors.slice(0, levels)) {
      points += pieces * 10;
      pieces *= factor;
    }
    const value = target.value / pieces;
    rocks.splice(rocks.indexOf(target), 1);
    const children = scene
      .children(target, pieces, isPrime(value), factors.length)
      .map((pose) => rock(value, target.depth + levels, pose));
    rocks.push(...children);
    scene.impact(target, children, clock, mount.weapon);
    score += points;
    nextWave = 0;
    feedback(
      children[0].prime
        ? value + " is prime. Atmosphere burn-up!"
        : pieces +
            " × " +
            value +
            " · New orbits. First return in " +
            Math.round(children[0].orbit.duration / pace.speed) +
            "s.",
    );
    readout();
  }
  $("form").onsubmit = (event) => {
    event.preventDefault();
    if (paused || !health) return;
    audio.unlock();
    const { product, factors, error } = parseFactorisation(input.value);
    if (error) {
      feedback(error);
      return;
    }
    const targets = rocks.filter(
      (r) => !r.prime && !r.locked && r.value === product,
    );
    if (!targets.length) {
      feedback("No available asteroid labelled " + product + ".");
      return;
    }
    // Wait for any still-emerging fragments before starting the volley, so
    // every missile in the group keeps the same spacing.
    const startDelay = Math.max(
      0,
      ...targets.map((target, i) => -target.age / pace.speed - i * 0.1),
    );
    const mount = shoot(targets[0], factors, startDelay);
    targets
      .slice(1)
      .forEach((target, i) =>
        shoot(target, factors, startDelay + (i + 1) * 0.1),
      );
    feedback(mount.weapon.name + " · " + product + " = " + factors.join(" × "));
    input.value = "";
    input.focus();
    readout();
  };
  input.addEventListener("input", () => {
    if (paused || !health) return;
    const { product, error } = parseFactorisation(input.value);
    if (
      !error &&
      rocks.some((r) => !r.prime && !r.locked && r.value === product)
    ) {
      $("form").requestSubmit();
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && health) {
      event.preventDefault();
      pause();
    }
  });
  $("#restart").onclick = reset;
  $("#pause").onclick = pause;
  $("#resume").onclick = () => (health ? pause() : reset());
  $("#sound").onclick = () => {
    audio.unlock();
    const off = audio.toggle();
    $("#sound").textContent = off ? "Unmute" : "Mute";
    $("#sound").setAttribute("aria-pressed", String(off));
  };
  for (const event of ["keydown", "pointerdown"])
    root.addEventListener(event, audio.unlock, { once: true });
  reset();
  function frame(time) {
    const dt = Math.min(0.045, (time - (lastTime ?? time)) / 1000);
    lastTime = time;
    if (!paused && health && !document.hidden) {
      const step = dt;
      clock += step;
      if (feedbackUntil && clock >= feedbackUntil) {
        status.textContent = "";
        feedbackUntil = 0;
      }
      for (const r of [...rocks]) {
        r.speed = pace.speed;
        const rockStep = step * pace.speed;
        r.age += rockStep;
        if (r.age < 0) continue;
        const missed = scene.move(r, Math.min(r.age, rockStep), clock);
        if (r.locked) continue;
        if (missed) {
          rocks.splice(rocks.indexOf(r), 1);
          if (!r.prime && !r.safe) {
            const damage = scene.hit(r, clock);
            health = Math.max(0, health - damage);
            feedback(`${r.value} hit · −${damage}% health`);
          }
          readout();
          if (!health) break;
        }
      }
      for (const shot of health ? [...shots] : []) {
        const previous = shot.age;
        shot.age += step;
        if (shot.mount && previous < fireAt && shot.age >= fireAt)
          scene.fire(shot.mount, shot.factors.length);
        if (shot.age >= shot.duration) {
          shots.splice(shots.indexOf(shot), 1);
          impact(shot);
        }
      }
      if (!health) {
        disableAnswer(true);
        $("#pause").disabled = true;
        $(".planet-health").hidden = true;
        scene.destroyPlanet(clock);
      } else {
        nextWave +=
          step * pace["spawn-rate"] * (1 + Math.max(0, year - 3) * 0.12);
        const threats = rocks.filter((r) => !r.safe && !r.prime);
        if (
          (!threats.length &&
            !shots.length &&
            !rocks.some((r) => r.orbit?.prime) &&
            nextWave > 2.5) ||
          (new Set(threats.map((r) => r.value)).size < (year >= 6 ? 4 : 3) &&
            nextWave > (wave === 1 ? 7 : 11))
        )
          spawn();
      }
    }
    if (!health && !document.hidden && aftermath < planetExplosionDuration) {
      aftermath = Math.min(planetExplosionDuration, aftermath + dt);
      if (aftermath >= planetExplosionDuration && $(".overlay").hidden)
        overlay("Planet lost", "", "Play again");
    }
    scene.draw(rocks, shots, clock + aftermath);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
