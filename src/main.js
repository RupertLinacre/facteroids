import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="shell">
    <header><div><p class="eyebrow">A LITTLE MATHS GAME</p><h1>Factoroids<span>.</span></h1></div><button id="restart" class="secondary">Restart game</button></header>
    <div class="intro"><p>Break down the numbers before they reach the ground.</p><button id="help-toggle" class="text-button" aria-expanded="false">How to play <span>↓</span></button></div>
    <div id="help" class="help" hidden>Type two or more factors separated by spaces or ×, then press Enter. For example, <strong>2 35</strong> turns every 70 into two 35s, while <strong>7 5 2</strong> turns it straight into ten 7s. Factors can be in any order. Prime numbers burn up automatically. Your answer hits every matching asteroid on screen.</div>
    <section class="game" aria-label="Factoroids game">
      <div class="hud"><div><span>SCORE</span><strong id="score">0</strong></div><div class="hud-right"><span>GROUND HITS</span><strong id="lives">0 / 3</strong></div></div>
      <div id="field" class="field" aria-label="Asteroid field"><svg id="trails" class="trails" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true"></svg><div class="stars" aria-hidden="true"></div><div class="atmosphere"></div><div class="ground"></div><div class="gun"><div class="barrel"></div><div class="base"></div></div><div id="overlay" class="overlay" hidden><div><p class="eyebrow">GAME OVER</p><h2>The ground took three hits.</h2><p id="final-score"></p><button id="play-again">Play again</button></div></div></div>
      <form id="answer-form" autocomplete="off"><label for="answer">YOUR FACTORS</label><div class="answer-row"><input id="answer" type="text" inputmode="numeric" placeholder="e.g. 2 35" aria-describedby="feedback" autofocus><button type="submit">Fire <span>↗</span></button></div><p id="feedback" role="status">Enter factors separated by spaces or x.</p></form>
    </section>
    <footer><span>BREAK IT DOWN. STAY IN THE GAME.</span><span>MADE FOR CURIOUS MINDS ✳</span></footer>
  </main>`;

const field = document.querySelector('#field');
const input = document.querySelector('#answer');
const feedback = document.querySelector('#feedback');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const overlay = document.querySelector('#overlay');
const trails = document.querySelector('#trails');
let asteroids = [], missiles = [], score = 0, hits = 0, elapsed = 0, spawnTimer = 0, previous = 0, running = true, nextId = 0;
const numbers = [12, 18, 20, 24, 28, 30, 35, 42, 45, 50, 56, 60, 70, 72, 84, 90];
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

function addAsteroid(value, x, y, options = {}) {
  const el = document.createElement('div');
  const prime = isPrime(value);
  el.className = `asteroid${prime ? ' prime' : ''}`;
  el.textContent = value;
  const size = Math.max(28, 54 - (options.depth ?? 0) * 8);
  el.style.width = `${size}px`; el.style.height = `${size}px`;
  el.style.fontSize = `${Math.max(11, 16 - (options.depth ?? 0) * 2)}px`;
  field.appendChild(el);
  const startX = Math.max(4, Math.min(96, x));
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const points = [[options.originX ?? startX, options.originY ?? y], [startX, y]];
  line.setAttribute('points', points.map(point => point.join(',')).join(' '));
  line.classList.add(prime ? 'prime-trail' : 'rock-trail'); trails.appendChild(line);
  asteroids.push({ id: nextId++, value, x: startX, y, el, line, prime, points, trailTimer: 0, age: 0, vx: options.vx ?? 0, vy: options.vy ?? 2.2, spread: options.spread ?? 0, depth: options.depth ?? 0, targeted: false });
}
function spawn() {
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? 5 + Math.random() * 18 : 77 + Math.random() * 18;
  // Give each rock sideways momentum and let gravity bend its path downwards.
  const vx = (fromLeft ? 1 : -1) * (2.5 + Math.random() * 2);
  addAsteroid(numbers[Math.floor(Math.random() * numbers.length)], x, 0, { vx, vy: 1.3 + Math.random() });
}
function launch(rock, count, value, volley) {
  rock.targeted = true;
  for (let i = 0; i < volley; i++) {
    const el = document.createElement('div'); el.className = 'missile'; field.appendChild(el);
    missiles.push({ x: 50 + (i - (volley - 1) / 2) * 2, y: 93, rock, count, value, el, delay: i * 0.08 });
  }
}
function split(rock, count, value) {
  rock.el.remove(); asteroids = asteroids.filter(item => item !== rock);
  for (let i = 0; i < count; i++) {
    const direction = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2;
    addAsteroid(value, rock.x + direction * 2, rock.y + 1, {
      originX: rock.x, originY: rock.y, vx: rock.vx, vy: rock.vy,
      spread: direction * Math.min(12, 4 + count), depth: rock.depth + 1
    });
  }
}
function reset() {
  asteroids.forEach(a => a.el.remove()); asteroids = []; missiles.forEach(m => m.el.remove()); missiles = []; trails.replaceChildren();
  score = 0; hits = 0; elapsed = 0; spawnTimer = 0; previous = 0; running = true;
  scoreEl.textContent = '0'; livesEl.textContent = '0 / 3'; overlay.hidden = true;
  feedback.textContent = 'Enter factors separated by spaces or x.'; feedback.className = '';
  input.value = ''; input.disabled = false; spawn(); input.focus();
}
function endGame() {
  running = false; input.disabled = true; overlay.hidden = false;
  document.querySelector('#final-score').textContent = `You scored ${score} points. Ready for another go?`;
}
function frame(time) {
  if (!previous) previous = time;
  const dt = Math.min((time - previous) / 1000, 0.05); previous = time;
  if (running) {
    elapsed += dt; spawnTimer += dt;
    if (spawnTimer > Math.max(4.2, 9 - elapsed / 50)) { spawn(); spawnTimer = 0; }
    const height = field.clientHeight;
    asteroids = asteroids.filter(a => {
      a.age += dt;
      if (a.prime) {
        a.vy += 0.55 * dt;
        a.x = Math.max(4, Math.min(96, a.x + (a.vx + a.spread) * dt));
        a.y += a.vy * dt;
        a.el.style.opacity = Math.max(0, 1 - Math.max(0, a.age) / 1.5);
        a.el.style.transform = `translate(-50%, -50%) scale(${Math.max(.25, 1 - Math.max(0, a.age) / 2)})`;
        if (a.age > 1.5) { a.el.remove(); return false; }
      } else {
        // A gentle downward pull bends the initial sideways velocity into an arc.
        a.vy += 0.32 * dt;
        a.y += a.vy * dt;
        a.x += (a.vx + a.spread) * dt;
        if (a.x < 4 || a.x > 96) { a.x = Math.max(4, Math.min(96, a.x)); a.vx *= -0.7; a.spread *= -0.5; }
        a.spread *= Math.exp(-0.35 * dt);
        if (a.y >= 94) { a.el.remove(); hits++; livesEl.textContent = `${hits} / 3`; if (hits >= 3) endGame(); return false; }
      }
      a.el.style.left = `${a.x}%`; a.el.style.top = `${a.y}%`;
      a.trailTimer += dt;
      if (a.trailTimer >= 0.25) { a.points.push([a.x, a.y]); a.trailTimer = 0; }
      a.line.setAttribute('points', [...a.points, [a.x, a.y]].map(point => point.join(',')).join(' '));
      return true;
    });
    missiles = missiles.filter(m => {
      if (!asteroids.includes(m.rock)) { m.el.remove(); return false; }
      if (m.delay > 0) { m.delay -= dt; m.el.style.visibility = 'hidden'; return true; }
      m.el.style.visibility = 'visible';
      const dx = (m.rock.x - m.x) * field.clientWidth / 100;
      const dy = (m.rock.y - m.y) * height / 100;
      const distance = Math.hypot(dx, dy), step = 420 * dt;
      if (distance <= step + 8) {
        m.el.remove(); split(m.rock, m.count, m.value);
        score += 10; scoreEl.textContent = score;
        return false;
      }
      m.x += dx / distance * step / field.clientWidth * 100;
      m.y += dy / distance * step / height * 100;
      m.el.style.left = `${m.x}%`; m.el.style.top = `${m.y}%`;
      m.el.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`;
      return true;
    });
  }
  requestAnimationFrame(frame);
}
document.querySelector('#answer-form').addEventListener('submit', e => {
  e.preventDefault(); if (!running) return;
  const raw = input.value.trim();
  if (!/^\d+(?:(?:\s*[xX×]\s*|\s+)\d+)+$/.test(raw)) { feedback.textContent = 'Type two or more whole numbers separated by spaces or x.'; feedback.className = 'error'; return; }
  const factors = raw.split(/\s*[xX×]\s*|\s+/).map(Number);
  if (factors.some(n => !Number.isSafeInteger(n) || n < 2)) { feedback.textContent = 'Every factor needs to be a whole number greater than 1.'; feedback.className = 'error'; return; }
  const product = factors.reduce((total, factor) => total * factor, 1);
  if (!Number.isSafeInteger(product)) { feedback.textContent = 'Those factors make a number that is too large.'; feedback.className = 'error'; return; }
  const targets = asteroids.filter(rock => !rock.prime && !rock.targeted && rock.value === product);
  if (!targets.length) { feedback.textContent = `No asteroid with ${product} is available. Try another set of factors.`; feedback.className = 'error'; return; }
  // The largest factor labels each piece; all other factors determine how many pieces.
  const value = Math.max(...factors), count = product / value;
  targets.forEach(rock => launch(rock, count, value, Math.min(factors.length, 5)));
  field.classList.remove('firing'); void field.offsetWidth; field.classList.add('firing');
  feedback.textContent = `${targets.length > 1 ? `${targets.length} missiles launched` : 'Missile launched'}!${isPrime(value) ? ' Prime pieces will burn up.' : ''}`;
  feedback.className = 'success'; input.value = ''; input.focus();
});
document.querySelector('#restart').addEventListener('click', reset);
document.querySelector('#play-again').addEventListener('click', reset);
document.querySelector('#help-toggle').addEventListener('click', e => { const help = document.querySelector('#help'); help.hidden = !help.hidden; e.currentTarget.setAttribute('aria-expanded', String(!help.hidden)); });
reset(); requestAnimationFrame(frame);
