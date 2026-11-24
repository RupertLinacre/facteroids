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
import { createQuestionDeck, numberForWave } from "./questions.js";
import { instrument } from "./audio.js";
import { create } from "./orbital.js";
import { planetExplosionDuration } from "./surface-strike.js";
const isPrime = (n) => {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return n >= 2;
};

export async function play(world) {
  document.title = world.name + " · Factoroids";
  const root = document.querySelector("#app");
  const umbra = world.slug === "umbra-station";
  root.innerHTML = umbra
    ? stationLayout(world)
    : `<main class="console" data-edition="${world.slug}" style="--accent:${world.color}">
  <header><a class="back" href="/">← All editions</a><div class="tools"><button id="sound" aria-pressed="false">Mute</button><button id="pause">Pause</button><button id="restart">Restart</button></div></header>
  <div class="game-title"><small class="meta">Factoroids / ${world.dimension} / ${world.type}</small><h1>${world.name}</h1><p class="desc">${world.intro}</p></div>
  <section class="cabinet"><div class="hud"><span>Score <b id="score">0</b></span><span>Lives <b id="lives">3</b></span><span class="wave">Wave <b id="wave">1</b></span></div>
  <div class="stage" style="--sky:url('/skies/${world.slug}.webp')"><canvas class="flight-layer" aria-label="${world.name} playfield"></canvas><span class="targets"></span><div class="overlay" hidden><h2></h2><p></p><button class="action" id="resume">Resume</button></div></div>
  <form class="controls"><label for="factors">Your factors</label><div class="row"><input id="factors" maxlength="80" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="e.g. 2 × 35 or 2^5"><button class="action">Fire ↗</button></div><p role="status"></p></form></section><p class="note">${world.note ?? "Follow the dotted impact path. Deflected pieces drift clear. Prime fragments burn up."}</p></main>`;

  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas"),
    input = $("#factors"),
    status = $("[role=status]"),
    audio = instrument();
  function disableAnswer(disabled) {
    input.disabled = disabled;
    if (umbra) {
      $(".station-keys").disabled = disabled;
      $(".desktop-send").disabled = disabled;
    }
  }
  let scene;
  try {
    scene = await create(canvas, audio, world);
  } catch (error) {
    console.error(error);
    $(".overlay").hidden = false;
    $(".overlay h2").textContent = "Graphics unavailable";
    $(".overlay p").textContent =
      "Try a browser with hardware acceleration enabled.";
    $("#resume").hidden = true;
    disableAnswer(true);
    if (umbra) {
      $("#pause").disabled = true;
      $(".menu-stats").hidden = true;
      root
        .querySelectorAll(".year-setting")
        .forEach((el) => (el.hidden = true));
      $("#restart").hidden = true;
      $("#sound").hidden = true;
    }
    return;
  }

  let year, pace;
  if (umbra) {
    year = selectedYear();
    pace = bindPaceMenu(root);
    bindKeypad($("form"), input);
    bindYearMenu(root, year, (next) => {
      year = next;
      nextQuestion = createQuestionDeck(year);
    });
  }
  let nextQuestion, aftermath, feedbackUntil;
  let rocks, shots, score, health, wave, clock, nextWave, paused, lastTime;
  function feedback(message) {
    status.textContent = message;
    if (umbra) feedbackUntil = clock + 4;
  }
  const readout = () => {
    $("#score").textContent = score;
    if (umbra) {
      $("#health").textContent = health + "%";
      const meter = $(".planet-health");
      meter.setAttribute("aria-valuenow", String(health));
      meter.dataset.critical = String(health <= 25);
    } else $("#lives").textContent = health;
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
      tint: umbra
        ? `hsl(${(302 + value * 137.508) % 360}, 68%, 77%)`
        : undefined,
      age: 0,
      born: clock,
      locked: false,
      ...pose,
    };
  }
  function spawn() {
    const active = rocks.filter((r) => !r.safe && !r.prime).map((r) => r.value);
    const question = umbra
      ? nextQuestion(active)
      : { value: numberForWave(wave + 1) };
    if (!question) return;
    const v = question.value;
    wave++;
    const radius = umbra
      ? { easy: 19, medium: 25, hard: 31, expert: 33 }[question.difficulty] +
        (v % 7)
      : undefined;
    const position = scene.spawn(wave, question.difficulty, radius, year);
    position.radius = radius;
    rocks.push(rock(v, 0, position));
    nextWave = 0;
    readout();
  }
  function reset() {
    aftermath = 0;
    if (umbra) nextQuestion = createQuestionDeck(year);
    audio.reset();
    scene.reset?.();
    rocks = [];
    shots = [];
    score = 0;
    health = umbra ? 100 : 3;
    wave = 0;
    clock = 0;
    paused = false;
    $(".overlay").hidden = true;
    if (!umbra) $("#pause").textContent = "Pause";
    if (umbra) {
      $("#pause").disabled = false;
      $("#pause").setAttribute("aria-expanded", "false");
      $(".planet-health").hidden = false;
    }
    disableAnswer(false);
    feedbackUntil = 0;
    input.value = "";
    status.textContent = umbra
      ? ""
      : "Opening target 70. Try 2 x 35 or 7 x 5 x 2.";
    spawn();
    input.focus({ preventScroll: true });
  }
  function overlay(title, message, button) {
    $(".overlay h2").textContent = title;
    $(".overlay p").textContent = message;
    $("#resume").textContent = button;
    $(".overlay").hidden = false;
    if (umbra) $("#resume").focus({ preventScroll: true });
  }
  function pause() {
    if (!health) return;
    paused = !paused;
    if (umbra) $("#pause").setAttribute("aria-expanded", String(paused));
    audio.pause(paused);
    disableAnswer(paused);
    if (!umbra) $("#pause").textContent = paused ? "Resume" : "Pause";
    if (paused) overlay("Paused", umbra ? "" : world.name, "Resume");
    else {
      $(".overlay").hidden = true;
      input.focus();
    }
  }
  function shoot(target, factors, chained = false, delay = 0) {
    target.locked = true;
    if (umbra) delay = Math.max(delay, -target.age / pace.speed);
    const mount = umbra
      ? scene.deploy(target, clock + delay, factors.length, pace.speed, delay)
      : null;
    const duration = mount ? interceptAt : chained ? 0.32 : 0.65;
    shots.push({ target, factors, age: -delay, duration, mount });
    if (!chained && !mount) scene.fire(target, factors.length);
    return mount;
  }
  function impact(shot) {
    const { target, factors, mount } = shot;
    // A single Umbra warhead resolves every submitted split at contact.
    // Count the intermediate nodes for scoring without spawning extra shots.
    const levels = mount ? factors.length - 1 : 1;
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
    scene.impact(target, children, clock, mount?.weapon);
    score += points;
    if (mount) {
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
    } else if (factors.length > 2) {
      for (const child of children) shoot(child, factors.slice(1), true);
    }
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
    const startDelay = umbra
      ? Math.max(
          0,
          ...targets.map((target, i) => -target.age / pace.speed - i * 0.1),
        )
      : 0;
    const mount = shoot(targets[0], factors, false, startDelay);
    targets
      .slice(1)
      .forEach((target, i) =>
        shoot(target, factors, false, umbra ? startDelay + (i + 1) * 0.1 : 0),
      );
    feedback(
      (mount ? mount.weapon.name + " · " : "") +
        product +
        " = " +
        factors.join(" × "),
    );
    input.value = "";
    input.focus();
    readout();
  };
  if (umbra) {
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
  }
  if (umbra) {
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && health) {
        event.preventDefault();
        pause();
      }
    });
  }
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
        if (umbra) r.speed = pace.speed;
        const rockStep = umbra ? step * pace.speed : step;
        r.age += rockStep;
        if (r.age < 0) continue;
        const missed = scene.move(r, Math.min(r.age, rockStep), clock);
        if (r.locked) continue;
        if (missed) {
          rocks.splice(rocks.indexOf(r), 1);
          if (!r.prime && !r.safe) {
            const damage = scene.hit(r, clock);
            health = Math.max(0, health - (umbra ? damage : 1));
            feedback(
              umbra
                ? `${r.value} hit · −${damage}% health`
                : "Earth hit by " + r.value + ".",
            );
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
        if (umbra) {
          $("#pause").disabled = true;
          $(".planet-health").hidden = true;
          scene.destroyPlanet(clock);
        }
        if (!umbra)
          overlay(
            "Game over",
            "Score " + score + " · Wave " + wave,
            "Play again",
          );
      } else {
        nextWave += umbra
          ? step * pace["spawn-rate"] * (1 + Math.max(0, year - 3) * 0.12)
          : step;
        const threats = rocks.filter((r) => !r.safe && !r.prime);
        if (
          (!threats.length &&
            !shots.length &&
            !rocks.some((r) => r.orbit?.prime) &&
            nextWave > 2.5) ||
          ((umbra
            ? new Set(threats.map((r) => r.value)).size < (year >= 6 ? 4 : 3)
            : threats.length < 3) &&
            nextWave >
              (umbra ? (wave === 1 ? 7 : 11) : Math.max(7.5, 15 - wave * 0.32)))
        )
          spawn();
      }
    }
    if (
      umbra &&
      !health &&
      !document.hidden &&
      aftermath < planetExplosionDuration
    ) {
      aftermath = Math.min(planetExplosionDuration, aftermath + dt);
      if (aftermath >= planetExplosionDuration && $(".overlay").hidden)
        overlay("Planet lost", "", "Play again");
    }
    scene.draw(rocks, shots, clock + aftermath);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
