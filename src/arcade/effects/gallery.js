import "./gallery.css";
import { groups } from "./options.js";
import { drawScene, globe } from "./scene.js";

const symbols = {
  meteors:
    '<path d="m3 16 11-11M4 10l5-5M9 17l7-7"/><circle cx="16" cy="7" r="3.3"/>',
  primes:
    '<path d="m3 16 5-4 6-7m-6 7 9-1m-9 1 5 5"/><circle cx="15" cy="4" r="1.7"/><circle cx="18.5" cy="11" r="1.7"/><circle cx="14" cy="18" r="1.7"/>',
  air: '<circle cx="11" cy="12" r="5.1"/><path d="M3 12a8 8 0 0 1 15-4M1 10a10.5 10.5 0 0 1 15-7"/>',
  impacts: '<path d="m3 16 6 1-3-7 5 4 1-8 2 7 5-4-2 7 3 1M3 20h17"/>',
  pause: '<path d="M8 5v12M14 5v12" stroke-width="3"/>',
  play: '<path d="m7 4 11 7-11 7z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4 10a7 7 0 1 1 2 6M4 4v6h6"/>',
  expand: '<path d="M13 4h5v5M18 4l-6 6M9 18H4v-5m0 5 6-6"/>',
  check: '<path d="m5 11 4 4 8-9" stroke-width="2.6"/>',
  close: '<path d="m5 5 12 12M17 5 5 17"/>',
};
const icon = (name) =>
  '<svg aria-hidden="true" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">' +
  symbols[name] +
  "</svg>";
const keys = Object.keys(groups);
const preferences = "factoroids:effects-gallery:v1";
function readSelections(url) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(preferences)) || {};
  } catch {}
  return Object.fromEntries(
    keys.map((key) => {
      const valid = (id) =>
        groups[key].options.some((option) => option[0] === id);
      const linked = url.searchParams.get(key);
      return [
        key,
        valid(linked)
          ? linked
          : valid(saved[key])
            ? saved[key]
            : groups[key].options[0][0],
      ];
    }),
  );
}
const controls = () =>
  '<button data-motion type="button"></button><button type="button" data-replay>' +
  icon("replay") +
  " Replay</button>";
const selectOptions = (options) =>
  options
    .map(([id, name]) => '<option value="' + id + '">' + name + "</option>")
    .join("");

export function gallery() {
  const url = new URL(location.href),
    choices = readSelections(url);
  let category = keys.includes(url.hash.slice(1))
    ? url.hash.slice(1)
    : "meteors";
  let running = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let time = category === "impacts" ? 1.2 : 2.65,
    dirty = true;
  globe.addEventListener(
    "load",
    () => {
      dirty = true;
    },
    { once: true },
  );
  document.title = "Effects gallery · Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = `<main class="lab">
    <header class="lab-nav"><a class="lab-brand" href="/"><span aria-hidden="true">✳</span> Factoroids</a><a href="/umbra-station/">Play Umbra Station <span aria-hidden="true">↗</span></a></header>
    <section class="lab-hero"><div><h1>Effects gallery<span>.</span></h1><p>Choose a look for each effect, then watch all four together.</p></div>
    <button class="lab-primary" id="combine">${icon("expand")} Preview combination</button></section>
    <nav class="lab-tabs" aria-label="Effect categories">${keys.map((key) => `<a data-group="${key}" href="#${key}">${icon(key)} ${groups[key].title}</a>`).join("")}<a href="/effects-gallery/planet-explosion/">${icon("impacts")} Planet explosion ↗</a></nav>
    <section aria-labelledby="group-title"><div class="lab-toolbar"><h2 id="group-title"></h2><div class="lab-tools">${controls()}</div></div>
    <div class="lab-grid"></div></section>
    <dialog class="lab-dialog" aria-labelledby="preview-title"><div class="dialog-heading"><h2 id="preview-title">Combination preview</h2>
    <button id="close-preview" aria-label="Close preview">${icon("close")}</button></div>
    <div class="lab-window large"><canvas aria-label="Combined orbital effects scene"></canvas></div>
    <div class="preview-tools"><label>Camera <select id="camera"><option value="combined">Full orbit</option><option value="meteors">Meteor approach</option><option value="primes">Prime flyby</option><option value="air">Atmospheric limb</option><option value="impacts">Surface strike</option></select></label>
    <div class="lab-tools">${controls()}</div></div>
    <div class="preview-choices">${keys.map((key) => `<label>${groups[key].title}<select data-choice="${key}">${selectOptions(groups[key].options)}</select></label>`).join("")}</div>
    <div class="dialog-footer"><button id="share">Copy combination link</button><span id="share-status" role="status"></span><input aria-label="Combination link" id="share-url" readonly hidden></div></dialog>
    </main>`;
  const grid = root.querySelector(".lab-grid"),
    dialog = root.querySelector("dialog");
  const camera = root.querySelector("#camera"),
    mainCanvas = dialog.querySelector("canvas");
  const ctx = mainCanvas.getContext("2d");
  let observer;
  let cards = [];
  function view() {
    return dialog.open ? camera.value : category;
  }
  function setClock(replay = false) {
    const focus = view();
    time =
      focus === "impacts" || focus === "combined"
        ? replay
          ? 0
          : 1.18
        : focus === "primes"
          ? replay
            ? 5.28
            : 1.3
          : replay
            ? 0
            : 2.65;
    dirty = true;
  }
  function updateMotion() {
    for (const b of root.querySelectorAll("[data-motion]")) {
      b.innerHTML =
        icon(running ? "pause" : "play") + (running ? " Pause" : " Play");
      b.setAttribute(
        "aria-label",
        running ? "Pause previews" : "Play previews",
      );
    }
  }
  function highlight() {
    for (const card of cards)
      card.button.setAttribute(
        "aria-pressed",
        String(card.id === choices[category]),
      );
    for (const select of root.querySelectorAll("[data-choice]"))
      select.value = choices[select.dataset.choice];
    dirty = true;
  }
  function writeUrl() {
    const link = new URL(location.href);
    keys.forEach((k) => link.searchParams.set(k, choices[k]));
    link.hash = category;
    history.replaceState(null, "", link);
    return link.href;
  }
  function choose(key, id) {
    choices[key] = id;
    try {
      localStorage.setItem(preferences, JSON.stringify(choices));
    } catch {}
    writeUrl();
    highlight();
    root.querySelector("#share-status").textContent = "";
    root.querySelector("#share-url").hidden = true;
  }
  function mountGroup() {
    observer?.disconnect();
    root.querySelector("#group-title").textContent = groups[category].title;
    for (const tab of root.querySelectorAll("[data-group]")) {
      if (tab.dataset.group === category)
        tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    }
    grid.innerHTML = groups[category].options
      .map(
        ([
          id,
          title,
          description,
        ]) => `<button type="button" class="lab-card" data-id="${id}" aria-label="Select ${title}" aria-describedby="about-${id}">
      <span class="lab-window"><canvas aria-hidden="true"></canvas></span><span class="card-caption"><span class="caption-title">${title}</span>
      <span class="choice-dot" aria-hidden="true">${icon("check")}</span><span class="caption-note" id="about-${id}">${description}</span></span></button>`,
      )
      .join("");
    cards = [...grid.children].map((button) => ({
      button,
      id: button.dataset.id,
      visible: true,
      ctx: button.querySelector("canvas").getContext("2d"),
    }));
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const card = cards.find((c) => c.button === entry.target);
            if (card) card.visible = entry.isIntersecting;
          }
          dirty = true;
        },
        { rootMargin: "30px" },
      );
      cards.forEach(({ button }) => observer.observe(button));
    }
    highlight();
  }
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (keys.includes(next) && next !== category) {
      category = next;
      mountGroup();
      setClock();
    }
  });
  grid.addEventListener("click", (e) => {
    const button = e.target.closest("[data-id]");
    if (button) choose(category, button.dataset.id);
  });
  function openPreview(mode) {
    camera.value = mode;
    dialog.showModal();
    setClock();
  }
  root.querySelector("#combine").onclick = () => openPreview("combined");
  root.querySelector("#close-preview").onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    const link = new URL(location.href);
    if (link.searchParams.has("preview")) {
      link.searchParams.delete("preview");
      history.replaceState(null, "", link);
    }
    dirty = true;
  });
  camera.onchange = () => setClock();
  for (const select of root.querySelectorAll("[data-choice]"))
    select.onchange = () => choose(select.dataset.choice, select.value);
  for (const button of root.querySelectorAll("[data-motion]"))
    button.onclick = () => {
      running = !running;
      updateMotion();
      dirty = true;
    };
  for (const button of root.querySelectorAll("[data-replay]"))
    button.onclick = () => {
      setClock(true);
      running = true;
      updateMotion();
    };
  root.querySelector("#share").onclick = async () => {
    const link = new URL(writeUrl());
    link.searchParams.set("preview", camera.value);
    const href = link.href;
    try {
      await navigator.clipboard.writeText(href);
      root.querySelector("#share-status").textContent = "Link copied.";
    } catch {
      const field = root.querySelector("#share-url");
      field.value = href;
      field.hidden = false;
      field.select();
      root.querySelector("#share-status").textContent =
        "Copy the selected link.";
    }
  };
  function draw(context, mode, selection) {
    const canvas = context.canvas,
      rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const density = Math.min(window.devicePixelRatio || 1, 1.65);
    const w = Math.max(1, Math.round(rect.width * density)),
      h = Math.max(1, Math.round(rect.height * density));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    drawScene(context, mode, selection, time);
  }
  mountGroup();
  updateMotion();
  const linkedCamera = url.searchParams.get("preview");
  if (linkedCamera === "combined" || keys.includes(linkedCamera))
    openPreview(linkedCamera);
  window.addEventListener("resize", () => {
    dirty = true;
  });
  let frame = 0,
    last = 0;
  function tick(now) {
    frame = 0;
    if (document.hidden) return;
    if (dirty || (running && now - last >= 1000 / 28)) {
      if (running && last) time += Math.min(0.12, (now - last) / 1000);
      last = now;
      dirty = false;
      if (dialog.open) draw(ctx, camera.value, choices);
      else
        for (const card of cards)
          if (card.visible)
            draw(card.ctx, category, { ...choices, [category]: card.id });
    } else if (!running) last = now;
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    last = 0;
    dirty = true;
    if (!document.hidden) frame = requestAnimationFrame(tick);
  });
  frame = requestAnimationFrame(tick);
}
