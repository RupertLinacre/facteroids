import { defaultYear, years } from "./questions.js";

const yearKey = "factoroids:base-difficulty";
const yearParam = "base-difficulty";

function parseYear(value) {
  const n = Number(/^year([2-8])$/.exec(value)?.[1]);
  return Object.hasOwn(years, n) ? n : undefined;
}

export function selectedYear() {
  const linked = parseYear(new URL(location.href).searchParams.get(yearParam));
  if (linked) return linked;
  try {
    return parseYear(localStorage.getItem(yearKey)) ?? defaultYear;
  } catch {
    return defaultYear;
  }
}

export function bindYearMenu(root, year, onChange) {
  const select = root.querySelector("#base-difficulty");
  const hint = root.querySelector("#year-hint");
  select.value = "year" + year;
  hint.textContent = years[year];
  select.addEventListener("change", () => {
    const next = parseYear(select.value);
    if (!next) return;
    hint.textContent = years[next];
    onChange(next);
    const url = new URL(location.href);
    url.searchParams.set(yearParam, select.value);
    history.replaceState(history.state, "", url);
    try {
      localStorage.setItem(yearKey, select.value);
    } catch {
      /* The URL still carries the selection when storage is unavailable. */
    }
  });
}
const paceOptions = {
  speed: { slow: 0.7, normal: 1, fast: 1.4 },
  "spawn-rate": { low: 0.65, normal: 1, high: 1.5 },
};

export function bindPaceMenu(root) {
  const settings = {};
  const url = new URL(location.href);
  for (const [name, options] of Object.entries(paceOptions)) {
    const select = root.querySelector("#" + name);
    let saved;
    try {
      saved = localStorage.getItem("factoroids:" + name);
    } catch {}
    const linked = url.searchParams.get(name);
    const value = Object.hasOwn(options, linked)
      ? linked
      : Object.hasOwn(options, saved)
        ? saved
        : "normal";
    select.value = value;
    settings[name] = options[value];
    select.addEventListener("change", () => {
      settings[name] = options[select.value];
      const current = new URL(location.href);
      current.searchParams.set(name, select.value);
      history.replaceState(history.state, "", current);
      try {
        localStorage.setItem("factoroids:" + name, select.value);
      } catch {}
    });
  }
  return settings;
}
const keys = [
  "1",
  "2",
  "3",
  "×",
  "4",
  "5",
  "6",
  "^",
  "7",
  "8",
  "9",
  "⌫",
  "0",
  "Fire",
];
const keyNames = { "×": "Multiply", "^": "Power", "⌫": "Backspace" };

export function stationLayout() {
  const keypad = keys
    .map((key) =>
      key === "Fire"
        ? '<button type="submit" class="send">Fire ↗</button>'
        : `<button type="button" data-key="${key}" aria-label="${keyNames[key] ?? key}">${key}</button>`,
    )
    .join("");
  return `<main class="station" aria-label="Factoroids">
    <div class="stage">
      <canvas class="flight-layer" aria-label="Factoroids orbital playfield"></canvas>
      <div class="planet-health" role="meter" aria-label="Planet health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><b id="health">100%</b><span aria-hidden="true">Health</span></div>
      <img id="team-view" alt="Shared orbital playfield" hidden><span class="targets sr-only"></span>
      <div class="wave-hud" aria-label="Wave progress">
        <div><strong>Wave <b id="wave">1</b></strong><span id="wave-progress"></span></div>
        <small>Answers <b id="wave-answers">0</b> this wave · <b id="session-answers">0</b> this session</small><small id="team-score" hidden></small>
      </div>
      <div class="wave-banner" role="status" hidden></div>
      <div class="impact-hint" role="status" aria-live="polite" hidden></div>
      <button type="button" id="pause" aria-label="Pause and open settings" aria-controls="station-menu" aria-expanded="false" title="Pause and open settings">⚙</button>
      <div class="overlay" hidden><section class="station-menu" id="station-menu"><h2></h2><p></p>
        <div class="menu-stats">Score <b id="score">0</b></div>
        <details id="wave-report" hidden><summary>Wave times</summary><ol id="wave-history"></ol></details>
        <div class="year-setting"><label for="base-difficulty">Maths level</label>
          <select id="base-difficulty" aria-describedby="year-hint year-applies">${Object.keys(
            years,
          )
            .map((y) => `<option value="year${y}">Year ${y}</option>`)
            .join("")}</select>
          <small id="year-hint"></small><small id="year-applies">Applies to new asteroids.</small></div>
        <div class="year-setting pace-settings">
          <label for="speed">Asteroid speed</label><select id="speed"><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select>
          <label for="spawn-rate">Spawn rate</label><select id="spawn-rate"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select>
        </div>
        <button type="button" class="action" id="resume">Resume</button>
        <div class="menu-tools"><button id="restart">Restart</button><button id="sound" aria-pressed="false">Mute</button></div>
      </section></div>
    </div>
    <form class="station-controls">
      <div class="answer-line"><input id="factors" aria-label="Your factors" aria-describedby="answer-feedback" inputmode="none" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Enter factors, e.g. 2 × 5"><button class="send desktop-send" type="submit">Fire ↗</button></div>
      <p role="status" id="answer-feedback"></p>
      <fieldset class="station-keys" aria-label="Answer keypad">${keypad}</fieldset>
      <a href="#team" id="team-link">multipler</a>
    </form>
    <dialog id="team-menu"><h2>Team waves</h2><p>Room code <strong id="team-code"></strong></p>
      <p id="team-notice" role="status"></p><p>You are <b id="team-self"></b></p><p id="team-roster"></p>
      <label>Join another room <input id="team-input" maxlength="4" placeholder="Code" autocomplete="off"></label>
      <button id="team-join">Join</button><p><button id="team-start" hidden>Start team game</button>
      <button id="team-back">Back</button><button id="team-leave">Leave room</button></p></dialog>
  </main>`;
}

export function bindKeypad(form, input) {
  const pad = form.querySelector(".station-keys");
  pad.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  pad.addEventListener("click", (event) => {
    const key = event.target.closest("[data-key]")?.dataset.key;
    if (!key || input.disabled) return;
    const end = input.selectionEnd;
    let start = input.selectionStart;
    const insert = key === "⌫" ? "" : key;
    if (!insert && start === end) start = Math.max(0, start - 1);
    if (input.value.length - (end - start) + insert.length > input.maxLength)
      return;
    input.setRangeText(insert, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus({ preventScroll: true });
  });
}
