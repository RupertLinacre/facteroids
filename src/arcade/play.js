import { fireAt, interceptAt } from "./deployment.js";
import { createQuestionDeck, numberForWave } from "./questions.js";
import { instrument } from "./audio.js";
import { create } from "./orbital.js";
const isPrime = (n) => {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return n >= 2;
};

export async function play(world) {
  document.title = world.name + " · Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = `<main class="console" data-edition="${world.slug}" style="--accent:${world.color}">
  <header><a class="back" href="/">← All editions</a><div class="tools"><button id="sound" aria-pressed="false">Mute</button><button id="pause">Pause</button><button id="restart">Restart</button></div></header>
  <div class="game-title"><small class="meta">Factoroids / ${world.dimension} / ${world.type}</small><h1>${world.name}</h1><p class="desc">${world.intro}</p></div>
  <section class="cabinet"><div class="hud"><span>Score <b id="score">0</b></span><span>Lives <b id="lives">3</b></span><span class="wave">Wave <b id="wave">1</b></span></div>
  <div class="stage" style="--sky:url('/skies/${world.slug}.webp')"><canvas class="flight-layer" aria-label="${world.name} playfield"></canvas><span class="targets"></span><div class="overlay" hidden><h2></h2><p></p><button class="action" id="resume">Resume</button></div></div>
  <form class="controls"><label for="factors">Your factors</label><div class="row"><input id="factors" maxlength="80" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="2 × 35 or 2 × 5 × 7"><button class="action">Fire ↗</button></div><p role="status"></p></form></section><p class="note">${world.note ?? "Follow the dotted impact path. Deflected pieces drift clear. Prime fragments burn up."}</p></main>`;

  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas"),
    input = $("#factors"),
    status = $("[role=status]"),
    audio = instrument();
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
    input.disabled = true;
    return;
  }

  const umbra = world.slug === "umbra-station";
  let nextQuestion, aftermath;
  let rocks, shots, score, lives, wave, clock, nextWave, paused, lastTime;
  const readout = () => {
    $("#score").textContent = score;
    $("#lives").textContent = lives;
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
    const v = question.value;
    wave++;
    const position = scene.spawn(wave, question.difficulty);
    if (umbra)
      position.radius = (question.difficulty === "hard" ? 31 : 19) + (v % 7);
    rocks.push(rock(v, 0, position));
    nextWave = 0;
    readout();
  }
  function reset() {
    aftermath = 0;
    nextQuestion = createQuestionDeck();
    audio.reset();
    scene.reset?.();
    rocks = [];
    shots = [];
    score = 0;
    lives = 3;
    wave = 0;
    clock = 0;
    paused = false;
    $(".overlay").hidden = true;
    $("#pause").textContent = "Pause";
    input.disabled = false;
    input.value = "";
    status.textContent = "Opening target 70. Try 2 x 35 or 7 x 5 x 2.";
    spawn();
    input.focus({ preventScroll: true });
  }
  function overlay(title, message, button) {
    $(".overlay h2").textContent = title;
    $(".overlay p").textContent = message;
    $("#resume").textContent = button;
    $(".overlay").hidden = false;
  }
  function pause() {
    if (!lives) return;
    paused = !paused;
    audio.pause(paused);
    input.disabled = paused;
    $("#pause").textContent = paused ? "Resume" : "Pause";
    if (paused) overlay("Paused", world.name, "Resume");
    else {
      $(".overlay").hidden = true;
      input.focus();
    }
  }
  function shoot(targets, factors, chained = false) {
    for (const target of targets) target.locked = true;
    const target = targets[0];
    const mount = umbra ? scene.deploy(target, clock, factors.length) : null;
    const duration = mount ? interceptAt : chained ? 0.32 : 0.65;
    shots.push({ target, targets, factors, age: 0, duration, mount });
    if (!chained && !mount) scene.fire(target, factors.length);
    return mount;
  }
  function impact(shot) {
    const { factors, mount } = shot;
    // A single Umbra warhead resolves every submitted split at contact.
    // Count the intermediate nodes for scoring without spawning extra shots.
    const levels = mount ? factors.length - 1 : 1;
    let pieces = 1,
      points = 0;
    for (const factor of factors.slice(0, levels)) {
      points += pieces * 10;
      pieces *= factor;
    }
    for (const target of shot.targets) {
      const value = target.value / pieces;
      rocks.splice(rocks.indexOf(target), 1);
      const children = scene
        .children(target, pieces, isPrime(value))
        .map((pose) => rock(value, target.depth + levels, pose));
      rocks.push(...children);
      scene.impact(target, children, clock, mount?.weapon);
      score += points;
      if (mount) {
        nextWave = 0;
        status.textContent = children[0].prime
          ? value + " is prime. Atmosphere burn-up!"
          : pieces +
            " × " +
            value +
            " · New orbits. First return in " +
            Math.round(children[0].orbit.duration) +
            "s.";
      } else if (factors.length > 2) {
        for (const child of children) shoot([child], factors.slice(1), true);
      }
    }
    readout();
  }
  $("form").onsubmit = (event) => {
    event.preventDefault();
    if (paused || !lives) return;
    audio.unlock();
    const raw = input.value.trim();
    if (!/^\d+(?:(?:\s*[x×]\s*|\s+)\d+)+$/i.test(raw)) {
      status.textContent = "Enter at least two factors, e.g. 2 x 35.";
      return;
    }
    const factors = raw
      .split(/\s*[x×]\s*|\s+/i)
      .map(Number)
      .sort((a, b) => a - b);
    const product = factors.reduce((a, b) => a * b, 1);
    if (factors[0] < 2 || !Number.isSafeInteger(product)) {
      status.textContent = "Use whole-number factors greater than one.";
      return;
    }
    const targets = rocks.filter(
      (r) => !r.prime && !r.locked && r.value === product,
    );
    if (!targets.length) {
      status.textContent = "No available asteroid labelled " + product + ".";
      return;
    }
    const mount = umbra ? shoot(targets, factors) : null;
    if (!umbra) targets.forEach((target) => shoot([target], factors));
    status.textContent =
      (mount ? mount.weapon.name + " · " : "") +
      product +
      " = " +
      factors.join(" × ");
    input.value = "";
    input.focus();
    readout();
  };
  $("#restart").onclick = reset;
  $("#pause").onclick = pause;
  $("#resume").onclick = () => (lives ? pause() : reset());
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
    if (!paused && lives && !document.hidden) {
      const step = dt;
      clock += step;
      for (const r of [...rocks]) {
        r.age += step;
        const missed = scene.move(r, step);
        if (r.locked) continue;
        if (missed) {
          rocks.splice(rocks.indexOf(r), 1);
          if (!r.prime && !r.safe) {
            scene.hit(r, clock);
            lives = Math.max(0, lives - 1);
            status.textContent = "Earth hit by " + r.value + ".";
          }
          readout();
        }
      }
      for (const shot of [...shots]) {
        const previous = shot.age;
        shot.age += step;
        if (shot.mount && previous < fireAt && shot.age >= fireAt)
          scene.fire(shot.mount, shot.factors.length);
        if (shot.age >= shot.duration) {
          shots.splice(shots.indexOf(shot), 1);
          impact(shot);
        }
      }
      if (!lives) {
        input.disabled = true;
        if (!umbra)
          overlay(
            "Game over",
            "Score " + score + " · Wave " + wave,
            "Play again",
          );
      } else {
        nextWave += step;
        const threats = rocks.filter((r) => !r.safe && !r.prime);
        if (
          (!threats.length &&
            !shots.length &&
            !rocks.some((r) => r.orbit?.prime) &&
            nextWave > 2.5) ||
          (threats.length < 3 &&
            nextWave >
              (umbra ? (wave === 1 ? 7 : 11) : Math.max(7.5, 15 - wave * 0.32)))
        )
          spawn();
      }
    }
    if (umbra && !lives && !document.hidden && aftermath < 2.5) {
      aftermath += dt;
      if (aftermath >= 1.35 && $(".overlay").hidden)
        overlay(
          "Game over",
          "Score " + score + " · Wave " + wave,
          "Play again",
        );
    }
    scene.draw(rocks, shots, clock + aftermath);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
