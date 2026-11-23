import { worlds } from "./arcade/catalog.js";

async function boot() {
  const route = location.pathname.replace(/^\/+|\/+$/g, "");
  if (route === "classic") {
    await import("./main.js");
    const link = document.createElement("a");
    link.href = "/";
    link.textContent = "← All games";
    link.style.cssText =
      "color:#a6ecbb;display:inline-block;margin-bottom:1rem";
    document.querySelector(".shell").prepend(link);
  } else {
    await import("./arcade/style.css");
    const world = worlds.find((w) => w.slug === route);
    if (world) {
      const { play } = await import("./arcade/play.js");
      await play(world);
    } else {
      document.querySelector("#app").innerHTML = `<main class="collection">
      <header class="mast"><span class="wordmark"><i>✳</i> Factoroids</span><a href="/classic/">Play classic ↗</a></header>
      <section class="gallery-intro"><h1>Choose your world<span>.</span></h1><p>Break asteroids with their factors. Pick an arcade to play.</p></section>
      <div class="cards">${worlds.map((w) => `<a class="card" href="/${w.slug}/" style="--accent:${w.color};--art:url('/art/${w.slug}.webp')"><div class="art"></div><div class="card-body"><small>${w.dimension} / ${w.type}</small><h2>${w.name}<b>↗</b></h2><p>${w.intro}</p></div></a>`).join("")}</div>
    </main>`;
    }
  }
}
boot();
