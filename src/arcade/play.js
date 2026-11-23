import { numberForWave } from "./flight.js";
import { create } from "./orbital.js";
const isPrime = (n) => {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return n >= 2;
};

function instrument() {
  let ctx,
    muted = false;
  return {
    unlock() {
      if (!window.AudioContext) return;
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    toggle() {
      muted = !muted;
      return muted;
    },
    note(hz, duration = 0.17, voice = "sine", gain = 0.045) {
      if (muted || ctx?.state !== "running") return;
      const t = ctx.currentTime,
        osc = ctx.createOscillator(),
        amp = ctx.createGain();
      osc.type = voice;
      osc.frequency.value = hz;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.01);
      osc.onended = () => {
        osc.disconnect();
        amp.disconnect();
      };
    },
  };
}

export async function play(world) {
  document.title = world.name + " · Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = `<main class="console" data-edition="${world.slug}" style="--accent:${world.color}">
  <header><a class="back" href="/">← All editions</a><div class="tools"><button id="sound" aria-pressed="false">Mute</button><button id="pause">Pause</button><button id="restart">Restart</button></div></header>
  <div class="game-title"><small class="meta">Factoroids / ${world.dimension} / ${world.type}</small><h1>${world.name}</h1><p class="desc">${world.intro}</p></div>
  <section class="cabinet"><div class="hud"><span>Score <b id="score">0</b></span><span>Lives <b id="lives">3</b></span><span class="wave">Wave <b id="wave">1</b></span></div>
  <div class="stage" style="--sky:url('/skies/${world.slug}.webp')"><canvas class="flight-layer" aria-label="${world.name} playfield"></canvas><span class="targets"></span><div class="overlay" hidden><h2></h2><p></p><button class="action" id="resume">Resume</button></div></div>
  <form class="controls"><label for="factors">Your factors</label><div class="row"><input id="factors" maxlength="80" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="2 × 35 or 2 × 5 × 7"><button class="action">Fire ↗</button></div><p role="status"></p></form></section><p class="note">Follow the dotted impact path. Deflected pieces drift clear. Prime fragments burn up.</p></main>`;

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
      locked: false,
      ...pose,
    };
  }
  function spawn() {
    const v = numberForWave(wave + 1);
    wave++;
    rocks.push(rock(v, 0, scene.spawn(wave)));
    nextWave = 0;
    readout();
  }
  function reset() {
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
    input.disabled = paused;
    $("#pause").textContent = paused ? "Resume" : "Pause";
    if (paused) overlay("Paused", world.name, "Resume");
    else {
      $(".overlay").hidden = true;
      input.focus();
    }
  }
  function shoot(target, factors, chained = false) {
    target.locked = true;
    const duration =
      scene.shotTime?.(clock, chained) ?? (chained ? 0.32 : 0.65);
    shots.push({ target, factors, age: 0, duration, chained });
    if (!chained) scene.fire?.(target, factors.length);
  }
  function impact(shot) {
    const { target, factors } = shot,
      [pieces, ...rest] = factors;
    const value = target.value / pieces;
    rocks.splice(rocks.indexOf(target), 1);
    const children = Array.from({ length: pieces }, (_, i) =>
      rock(value, target.depth + 1, scene.child(target, i, pieces)),
    );
    rocks.push(...children);
    scene.impact(target, children, clock);
    score += 10;
    if (rest.length > 1) children.forEach((r) => shoot(r, rest, true));
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
    targets.forEach((r) => shoot(r, factors));
    status.textContent = product + " = " + factors.join(" × ");
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
  reset();
  function frame(time) {
    const dt = Math.min(0.045, (time - (lastTime ?? time)) / 1000);
    lastTime = time;
    if (!paused && lives && !document.hidden) {
      const step = dt;
      clock += step;
      for (const r of [...rocks]) {
        r.age += step;
        const missed = scene.move(r, step, clock);
        if (r.locked) continue;
        if (r.prime ? r.age > scene.burnTime : missed) {
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
        shot.age += step;
        if (shot.age >= shot.duration) {
          shots.splice(shots.indexOf(shot), 1);
          impact(shot);
        }
      }
      if (!lives) {
        input.disabled = true;
        overlay(
          "Game over",
          "Score " + score + " · Wave " + wave,
          "Play again",
        );
      } else {
        nextWave += step;
        const threats = rocks.filter((r) => !r.safe && !r.prime);
        if (
          (!threats.length && !shots.length && nextWave > 2.5) ||
          (threats.length < 3 && nextWave > Math.max(7.5, 15 - wave * 0.32))
        )
          spawn();
      }
    }
    scene.draw(rocks, shots, clock);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
