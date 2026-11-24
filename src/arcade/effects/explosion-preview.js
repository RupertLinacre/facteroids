import "./gallery.css";
import { create } from "../orbital.js";
import { planetExplosionDuration } from "../surface-strike.js";

export async function explosionPreview() {
  document.title = "Planet explosion · Factoroids";
  const root = document.querySelector("#app");
  root.innerHTML = `<main class="lab explosion-preview">
    <header class="lab-nav"><a class="lab-brand" href="/"><span aria-hidden="true">✳</span> Factoroids</a><a href="/umbra-station/">Play Umbra Station ↗</a></header>
    <section class="lab-hero"><div><a class="gallery-back" href="/effects-gallery/#impacts">← Effects gallery</a><h1>Planet explosion<span>.</span></h1><p>Watch the game-over animation, then replay it as often as you like.</p></div></section>
    <div class="preview-stage" aria-label="Planet explosion preview"><canvas class="flight-layer" aria-label="Planet explosion animation"></canvas></div>
    <div class="lab-toolbar"><p id="preview-status" role="status"></p><div class="lab-tools">
      <button type="button" id="motion"></button><button type="button" id="replay">↻ Replay</button>
    </div></div>
  </main>`;
  const canvas = root.querySelector("canvas");
  const motion = root.querySelector("#motion");
  const status = root.querySelector("#preview-status");
  const audio = { effect() {}, note() {} };
  const world = {
    slug: "umbra-station",
    dimension: "3D",
    horizon: false,
    color: "#abc5ff",
  };
  let scene;
  try {
    scene = await create(canvas, audio, world);
  } catch (error) {
    console.error(error);
    status.textContent =
      "The preview needs a browser with hardware acceleration.";
    motion.disabled = true;
    root.querySelector("#replay").disabled = true;
    return;
  }
  let elapsed = 0;
  let running = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastTime;
  function updateControls() {
    motion.textContent = running ? "Ⅱ Pause" : "▶ Play";
    motion.setAttribute(
      "aria-label",
      running ? "Pause preview" : "Play preview",
    );
    status.textContent =
      elapsed >= planetExplosionDuration
        ? "Animation complete"
        : running
          ? "Playing"
          : "Paused";
  }
  function replay() {
    scene.reset();
    scene.destroyPlanet(0);
    elapsed = 0;
    lastTime = undefined;
    scene.draw([], [], elapsed);
  }
  motion.onclick = () => {
    if (elapsed >= planetExplosionDuration) replay();
    running = !running;
    lastTime = undefined;
    updateControls();
  };
  root.querySelector("#replay").onclick = () => {
    replay();
    running = true;
    updateControls();
  };
  document.addEventListener("visibilitychange", () => {
    lastTime = undefined;
  });
  window.addEventListener("resize", () => {
    scene.reset();
    scene.destroyPlanet(0);
    scene.draw([], [], elapsed);
  });
  replay();
  updateControls();
  function frame(time) {
    if (!document.hidden && running) {
      const dt = Math.min(0.045, (time - (lastTime ?? time)) / 1000);
      elapsed = Math.min(planetExplosionDuration, elapsed + dt);
      if (elapsed >= planetExplosionDuration) {
        running = false;
        updateControls();
      }
    }
    lastTime = time;
    scene.draw([], [], elapsed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
