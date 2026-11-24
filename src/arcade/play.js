import { teamRoom } from "./team.js";
import {
  stationLayout,
  bindKeypad,
  selectedYear,
  bindYearMenu,
  bindPaceMenu,
} from "./station-ui.js";
import "./station.css";
import { formatFactors, parseFactorisation } from "../factors.js";
import { fireAt, interceptAt } from "./deployment.js";
import { factorHints, isPrime, spawnInterval, waveSize } from "./questions.js";
import { Waves } from "./waves.js";
import { instrument } from "./audio.js";
import { create } from "./orbital.js";
import { planetExplosionDuration } from "./surface-strike.js";
function elapsed(seconds) {
  const whole = Math.round(seconds);
  return Math.floor(whole / 60) + "m " + (whole % 60) + "s";
}

export async function play() {
  document.title = "Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = stationLayout();

  const $ = (s) => root.querySelector(s);
  const canvas = $("canvas"),
    input = $("#factors"),
    status = $("#answer-feedback"),
    audio = instrument();
  function disableAnswer(disabled) {
    input.disabled = disabled;
    $(".station-keys").disabled = disabled;
    root
      .querySelectorAll(".clear-answer")
      .forEach((button) => (button.disabled = disabled));
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
    waves.changeYear(year);
  });
  let waves,
    aftermath,
    feedbackUntil,
    impactHintUntil,
    sessionAnswers = 0;
  const sessionKey = "factoroids:wave-answers";
  try {
    sessionAnswers = Number(sessionStorage.getItem(sessionKey)) || 0;
  } catch {}
  let rocks,
    shots,
    score,
    health,
    sequence,
    clock,
    spawnClock,
    paused,
    lastTime;
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
    $("#wave").textContent = waves.number;
    $("#wave-progress").textContent =
      waves.cleared + "/" + waveSize + " cleared";
    $("#wave-answers").textContent = waves.answers;
    $("#session-answers").textContent = sessionAnswers;
    const counts = new Map();
    rocks
      .filter((r) => !r.prime && !r.locked && !r.safe)
      .forEach((r) => counts.set(r.value, (counts.get(r.value) || 0) + 1));
    $(".targets").textContent = [...counts]
      .map(([v, n]) => (n > 1 ? n + " incoming " + v : "Target " + v))
      .join(" · ");
  };
  let nextRockId = 0;
  function rock(value, depth, pose) {
    return {
      value,
      id: ++nextRockId,
      depth,
      prime: isPrime(value),
      tint: `hsl(${(302 + value * 137.508) % 360}, 68%, 77%)`,
      age: 0,
      born: clock,
      locked: false,
      ...pose,
    };
  }
  let remoteSpeed = 1;
  function spawn(active) {
    const slot = waves.next(active);
    if (!slot) return;
    const { value, grade } = slot.question;
    const radius = 19 + Math.round(grade * 0.14) + (value % 7);
    const position = scene.spawn(++sequence, slot.question, radius);
    rocks.push(rock(value, 0, { ...position, radius, slot }));
    team.event({
      kind: "spawn",
      sequence,
      question: slot.question,
      radius,
      id: nextRockId,
    });
    spawnClock = 0;
    readout();
  }
  function reset() {
    aftermath = 0;
    waves = new Waves(year);
    audio.reset();
    scene.reset();
    rocks = [];
    shots = [];
    score = 0;
    health = 100;
    sequence = 0;
    clock = 0;
    lastTime = undefined;
    paused = false;
    $(".overlay").hidden = true;
    $("#pause").disabled = false;
    $("#pause").setAttribute("aria-expanded", "false");
    $(".planet-health").hidden = false;
    disableAnswer(false);
    feedbackUntil = 0;
    impactHintUntil = 0;
    $(".impact-hint").hidden = true;
    input.value = "";
    status.textContent = "";
    $(".wave-banner").hidden = true;
    team.event({ kind: "reset" });
    spawn(new Set());
    feedback("Split a number into factors. Try a space or × between them.");
    input.focus({ preventScroll: true });
  }
  function overlay(title, message, button) {
    const history = $("#wave-history");
    history.replaceChildren(
      ...waves.times.map((time, i) => {
        const row = document.createElement("li");
        row.textContent = "Wave " + (i + 1);
        const duration = document.createElement("b");
        duration.textContent = elapsed(time);
        row.append(duration);
        return row;
      }),
    );
    $("#wave-report").hidden = !waves.times.length;
    $("#wave-report summary").textContent =
      waves.times.length +
      (waves.times.length === 1 ? " wave cleared" : " waves cleared");
    $("#wave-report").open = !health;
    $(".overlay h2").textContent = title;
    $(".overlay p").textContent = message;
    $("#resume").textContent = button;
    $(".overlay").hidden = false;
    $("#resume").focus({ preventScroll: true });
  }
  function pause() {
    if (!health) return;
    paused = !paused;
    lastTime = undefined;
    $("#pause").setAttribute("aria-expanded", String(paused));
    audio.pause(paused);
    team.sync(performance.now(), true);
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
    team.event({
      kind: "shot",
      id: target.id,
      factors,
      delay,
      age: target.age,
    });
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
      .map((pose) =>
        rock(value, target.depth + levels, { ...pose, slot: target.slot }),
      );
    if (!isPrime(value)) target.slot.remaining += pieces - 1;
    rocks.push(...children);
    scene.impact(target, children, clock, mount.weapon);
    team.event({
      kind: "split",
      id: target.id,
      first: children[0].id,
      value,
      pieces,
      levels,
      pose: { x: target.x, y: target.y, vx: target.vx, vy: target.vy },
      weapon: mount.weapon,
    });
    score += points;
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
  function countPersonalAnswer() {
    sessionAnswers++;
    $("#session-answers").textContent = sessionAnswers;
    try {
      sessionStorage.setItem(sessionKey, String(sessionAnswers));
    } catch {}
  }
  function answer(text, player, targetId) {
    if (paused || !health) return;
    audio.unlock();
    const { product, factors, error } = parseFactorisation(text);
    if (error) {
      feedback(error);
      return;
    }
    const targets = rocks.filter(
      (r) => !r.prime && !r.locked && r.value === product,
    );
    if (
      !targets.length ||
      (targetId !== undefined && !targets.some((r) => r.id === targetId))
    ) {
      feedback("No available asteroid labelled " + product + ".");
      return;
    }
    // Wait for any still-emerging fragments before starting the volley, so
    // every missile in the group keeps the same spacing.
    const startDelay = Math.max(
      0,
      ...targets.map((target, i) => -target.age / pace.speed - i * 0.1),
    );
    team.credit(player);
    waves.answers++;
    if (player === "host") countPersonalAnswer();
    if (isPrime(factors.at(-1))) {
      for (const target of targets) waves.resolve(target.slot);
    }
    const mount = shoot(targets[0], factors, startDelay);
    targets
      .slice(1)
      .forEach((target, i) =>
        shoot(target, factors, startDelay + (i + 1) * 0.1),
      );
    feedback(mount.weapon.name + " · " + product + " = " + factors.join(" × "));
    if (player === "host") {
      input.value = "";
      input.focus();
    }
    readout();
  }
  const team = teamRoom(root, {
    reset,
    answer,
    accepted() {
      countPersonalAnswer();
      audio.effect("split", 450, 1);
    },
    hold() {
      if (health && !paused) pause();
    },
    resume() {
      if (health && paused) pause();
    },
    checkpoint() {
      return {
        scars: scene.scars,
        rocks: rocks.map(({ orbit, trail, slot, ...body }) => {
          const { path, ...parameters } = orbit;
          return { ...body, orbit: parameters };
        }),
        shots: shots.map(({ target, ...shot }) => ({ ...shot, id: target.id })),
      };
    },
    receive(s) {
      clock = s.clock;
      aftermath = s.aftermath;
      remoteSpeed = s.speed;
      paused = s.paused;
      const wasAlive = health > 0;
      health = s.health;
      if (s.checkpoint) {
        scene.reset(s.portrait, s.checkpoint.scars);
        rocks = s.checkpoint.rocks.map((r) => ({
          ...r,
          orbit: scene.restoreOrbit(r.orbit),
          trail: [],
        }));
        shots = s.checkpoint.shots.map((sh) => ({
          ...sh,
          target: rocks.find((r) => r.id === sh.id),
        }));
      }
      for (const e of s.events ?? []) {
        const target = rocks.find((r) => r.id === e.id);
        if (e.kind === "reset") {
          scene.reset(s.portrait);
          rocks = [];
          shots = [];
        }
        if (e.kind === "spawn")
          rocks.push(
            rock(e.question.value, 0, {
              ...scene.spawn(e.sequence, e.question, e.radius, s.portrait),
              id: e.id,
              radius: e.radius,
            }),
          );
        if (!target) continue;
        if (e.kind === "shot") {
          target.locked = true;
          target.age = e.age;
          const mount = scene.deploy(
            target,
            clock + e.delay,
            e.factors.length,
            s.speed,
            e.delay,
          );
          shots.push({
            target,
            mount,
            factors: e.factors,
            age: -e.delay,
            duration: interceptAt,
          });
        }
        if (e.kind === "split") {
          Object.assign(target, e.pose);
          const kids = scene
            .children(target, e.pieces, isPrime(e.value), e.levels + 1)
            .map((pose, i) =>
              rock(e.value, target.depth + e.levels, {
                ...pose,
                id: e.first + i,
              }),
            );
          rocks = rocks.filter((r) => r !== target).concat(kids);
          shots = shots.filter((sh) => sh.target !== target);
          scene.impact(target, kids, clock, e.weapon);
        }
        if (e.kind === "hit") {
          scene.hit(target, clock);
          rocks = rocks.filter((r) => r !== target);
        }
      }
      if (!health && (wasAlive || s.checkpoint)) scene.destroyPlanet(clock);
      // A small clock correction keeps long-running or backgrounded tabs in step.
      for (const [id, age] of s.ages ?? []) {
        const body = rocks.find((r) => r.id === id);
        if (body) body.age = age;
      }
      lastTime = undefined;
    },
    snapshot() {
      return {
        clock,
        aftermath,
        paused: paused || document.hidden,
        speed: pace.speed,
        portrait: scene.portrait,
        ages: rocks.filter((r) => !r.prime).map((r) => [r.id, r.age]),
        targets: rocks
          .filter((r) => !r.prime && !r.locked)
          .map((r) => ({ id: r.id, value: r.value })),
        health,
        wave: waves.number,
        cleared: waves.cleared,
        answers: waves.answers,
        hint: $(".impact-hint").hidden ? "" : $(".impact-hint").textContent,
        message: !health
          ? "Planet lost · waiting for host"
          : paused || document.hidden
            ? "Host paused"
            : "",
      };
    },
    display(s) {
      $("#health").textContent = s.health + "%";
      $("#wave").textContent = s.wave;
      $("#wave-progress").textContent = s.cleared + "/" + waveSize + " cleared";
      $("#wave-answers").textContent = s.answers;
      $(".targets").textContent = s.targets
        .map((t) => "Target " + t.value)
        .join(" · ");
      $(".impact-hint").hidden = !s.hint;
      $(".impact-hint").textContent = s.hint;
      status.textContent = s.message;
      disableAnswer(Boolean(s.message));
      $("#pause").disabled = true;
    },
  });
  $("form").onsubmit = (event) => {
    event.preventDefault();
    if (!team.guest) return answer(input.value, "host");
    const target = team.target(parseFactorisation(input.value).product);
    if (target) {
      audio.unlock();
      team.submit(input.value, target);
      input.value = "";
    }
  };
  input.addEventListener("keydown", (event) => {
    const position = input.selectionStart;
    if (
      event.key === "Backspace" &&
      position === input.selectionEnd &&
      input.value.slice(position - 3, position) === " × "
    ) {
      event.preventDefault();
      input.setRangeText("", position - 3, position, "end");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  function clearAnswer() {
    input.value = "";
    input.focus({ preventScroll: true });
  }
  root
    .querySelectorAll(".clear-answer")
    .forEach((button) => button.addEventListener("click", clearAnswer));
  input.addEventListener("input", () => {
    const start = input.selectionStart,
      end = input.selectionEnd;
    const value = input.value;
    const formatted = formatFactors(value);
    if (formatted !== value) {
      input.value = formatted;
      input.setSelectionRange(
        formatFactors(value.slice(0, start)).length,
        formatFactors(value.slice(0, end)).length,
      );
    }
    if (paused || !health) return;
    const { product, error } = parseFactorisation(input.value);
    if (
      !error &&
      (team.guest
        ? team.target(product)
        : rocks.some((r) => !r.prime && !r.locked && r.value === product))
    ) {
      $("form").requestSubmit();
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#team-menu").open && !input.disabled) {
      event.preventDefault();
      clearAnswer();
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
  document.addEventListener("visibilitychange", () => {
    lastTime = undefined;
    team.sync(performance.now(), true);
  });
  function frame(time) {
    const dt = (time - (lastTime ?? time)) / 1000;
    lastTime = time;
    if (team.guest && team.active) {
      if (!paused && !document.hidden) {
        if (health) {
          clock += dt;
          rocks = rocks.filter((r) => {
            r.speed = remoteSpeed;
            r.age += dt * remoteSpeed;
            if (r.age < 0) return true;
            const done = scene.move(r, dt * remoteSpeed, clock);
            return !r.prime || !done;
          });
          for (const shot of shots) {
            const previous = shot.age;
            shot.age += dt;
            if (previous < fireAt && shot.age >= fireAt)
              scene.fire(shot.mount, shot.factors.length);
          }
        } else aftermath = Math.min(planetExplosionDuration, aftermath + dt);
      }
      scene.draw(rocks, shots, clock + aftermath);
      requestAnimationFrame(frame);
      return;
    }
    if (!paused && health && !document.hidden) {
      const step = dt;
      clock += step;
      if (feedbackUntil && clock >= feedbackUntil) {
        status.textContent = "";
        feedbackUntil = 0;
      }
      if (impactHintUntil && clock >= impactHintUntil) {
        $(".impact-hint").hidden = true;
        impactHintUntil = 0;
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
            waves.resolve(r.slot, true);
            team.event({ kind: "hit", id: r.id });
            const damage = scene.hit(r, clock);
            health = Math.max(0, health - damage);
            const hint = $(".impact-hint");
            hint.textContent =
              r.value +
              " hit · " +
              r.value +
              " = " +
              factorHints(r.value).join(" or ");
            hint.hidden = false;
            impactHintUntil = clock + 8;
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
        if (waves.advance(clock)) {
          const banner = $(".wave-banner");
          banner.textContent =
            "Wave " +
            waves.times.length +
            " cleared · " +
            elapsed(waves.times.at(-1));
          banner.hidden = false;
          readout();
        }
        if (clock - waves.started > 3) $(".wave-banner").hidden = true;
        spawnClock += step * pace["spawn-rate"];
        const active = new Set(
          rocks
            .filter((r) => !r.safe && !r.prime && !r.locked)
            .map((r) => r.value),
        );
        if (
          !active.size ||
          (active.size < (year >= 6 ? 4 : 3) &&
            spawnClock >= spawnInterval(year, waves.number))
        ) {
          spawn(active);
        }
      }
    }
    if (!health && !document.hidden && aftermath < planetExplosionDuration) {
      aftermath = Math.min(planetExplosionDuration, aftermath + dt);
      if (aftermath >= planetExplosionDuration && $(".overlay").hidden)
        overlay(
          "Planet lost",
          "Wave " +
            waves.number +
            " · " +
            waves.cleared +
            "/" +
            waveSize +
            " cleared",
          "Play again",
        );
    }
    scene.draw(rocks, shots, clock + aftermath);
    team.sync(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
