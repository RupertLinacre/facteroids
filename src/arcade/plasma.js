import * as T from "three";
import { H, TRAIL_LIMIT } from "./drawing.js";
import { emissionAt, trailSample } from "./umbra.js";

// Each row spans a sampled world position. The shader animates detail inside
// the strip; neither its centreline nor its frame is attached to the nucleus.
const vertexShader = `
attribute vec4 deposit;
attribute float depositedHeat;
varying vec2 p;
varying float activity, along, entryHeat;
uniform float elapsed, lifetime;
void main(){
  float age=clamp((elapsed-deposit.x)/lifetime,0.,1.);
  p=vec2(age*13.,deposit.y);
  activity=deposit.z*(1.-smoothstep(.42,1.,age));
  along=deposit.w;
  entryHeat=depositedHeat;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const fragmentShader = `
varying vec2 p;
varying float activity, along, entryHeat;
uniform float seconds, seed, burning, residual;
uniform vec3 tint;

float hash(vec2 a){
  vec3 b=fract(vec3(a.xyx)*.1031);
  b+=dot(b,b.yzx+33.33);
  return fract((b.x+b.y)*b.z);
}
float smoothNoise(vec2 a){
  vec2 i=floor(a),u=fract(a);u=u*u*(3.-2.*u);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),
             mix(hash(i+vec2(0.,1.)),hash(i+1.),u.x),u.y);
}
float mist(vec2 a){
  return .55*smoothNoise(a)+.29*smoothNoise(a*2.04+2.6)+.16*smoothNoise(a*4.11+9.);
}
float bell(float distance,float width){float z=distance/width;return exp(-z*z);}
void main(){
  float x=p.x;
  float front=smoothstep(-.55,.6,p.x);
  float taper=1.-smoothstep(6.+3.*activity,13.,x);
  float spread=.22+.13*x;
  float bow=.12*sin(along*.68+seed)*x;
  // A broad, curved veil of sublimating dust and a narrower magnetic ion stream.
  float dustY=p.y-bow;
  float ionY=p.y+bow*.34;
  if(activity<.003 || min(abs(dustY),abs(ionY))>3.*spread+.3)discard;
  vec2 flow=vec2(along*1.15-seconds*1.05+seed,p.y*2.6);
  float warp=mist(flow*.73)-.5;
  float density=mist(flow*vec2(1.1,1.6)+vec2(warp*1.7,warp*2.7));
  float dust=bell(dustY+warp*spread,spread*1.12)*(.12+.88*density*density);
  vec3 light=vec3(.27,.18,.72)*dust*1.35;
  // Individual striae twist and shear as gas streams away from the nucleus.
  for(int i=0;i<6;i++){
    float k=float(i),across=(k-2.5)*.31;
    float ripple=sin(along*(1.34+k*.07)-seconds*1.65+seed+k*.77);
    float axis=across*spread + spread*(.25*ripple+.55*warp);
    float strand=bell(dustY-axis,.045+spread*(.055+.024*k));
    light+=mix(vec3(.15,.27,1.),vec3(.23,1.,.83),k*.2)*strand*(.22+.63*density);
  }
  float knots=.58+.42*sin(along*3.5-seconds*3.5+seed+3.*warp);
  float ionAxis=.06*x*sin(.92*along-seconds*.8+seed);
  light+=vec3(.14,.47,1.)*bell(ionY-ionAxis,.18+.041*x)*(.7+.4*knots);
  light+=vec3(.60,.88,1.)*bell(ionY-ionAxis,.038+.010*x)*(.8+.7*knots);
  light*=front*taper*exp(-.14*x);

  // Sparse grains in the dust fan, elongated along their motion.
  vec2 cells=vec2(along*2.6-seconds*1.8,p.y*12.+seed);
  vec2 grain=fract(cells)-.5;
  float mote=step(.91,hash(floor(cells)))*exp(-dot(grain*vec2(2.6,7.),grain*vec2(2.6,7.)));
  light+=vec3(.42,.78,1.)*mote*bell(dustY,spread)*front*taper;
  // Palette weights come only from this piece of the wake. Age and flow
  // modulate its brightness; a turn or climb never recolours old gas.
  float intensity=max(light.r,max(light.g,light.b));
  vec3 cold=mix(light,tint*intensity,.58);
  if(burning>.5){
    cold=vec3(1.5,.69,.13)*intensity;
  }
  vec3 amber=intensity*vec3(1.5,.46,.095);
  vec3 ember=intensity*vec3(1.65,.035,.055);
  vec3 thermal=mix(amber,ember,smoothstep(.25,.80,entryHeat));
  light=mix(cold,thermal,smoothstep(.04,.69,entryHeat));
  // Molten golden spine inside the red ablation sheath of a prime fragment.
  if(burning>.5)
    light+=vec3(1.,.70,.26)*bell(ionY-ionAxis,.095+.02*x)*front*taper;
  // Explicit premultiplied output: the canvas also composites over the starfield.
  vec3 emission=1.-exp(-light*activity*residual*2.3);
  float alpha=max(max(emission.r,emission.g),emission.b);
  if(alpha<.004)discard;
  gl_FragColor=vec4(emission,alpha);
}`;

function createStrip(rock) {
  const rows = TRAIL_LIMIT + 1,
    geometry = new T.BufferGeometry();
  for (const [name, width] of [
    ["position", 3],
    ["deposit", 4],
    ["depositedHeat", 1],
  ]) {
    geometry.setAttribute(
      name,
      new T.BufferAttribute(new Float32Array(rows * 2 * width), width).setUsage(
        T.DynamicDrawUsage,
      ),
    );
  }
  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  geometry.setIndex(indices);
  const burning = !!rock.orbit?.prime;
  const material = new T.ShaderMaterial({
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: {
      elapsed: { value: 0 },
      tint: {
        value: new T.Color().setStyle(rock.tint, T.LinearSRGBColorSpace),
      },
      seconds: { value: 0 },
      residual: { value: 1 },
      lifetime: { value: burning ? 1.25 : 8 },
      burning: { value: burning ? 1 : 0 },
      seed: { value: rock.value * 0.61 + (rock.orbit?.lane ?? 0) * 5 },
    },
    vertexShader,
    fragmentShader,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

function writeStrip(mesh, rock, earth, elapsed) {
  const { geometry, material } = mesh,
    points = rock.trail;
  const last = points.at(-1);
  const liveHead =
    !last || Math.hypot(rock.x - last[0], rock.y - last[1]) > 0.001;
  const head = liveHead ? trailSample(rock, earth, last) : last;
  let start = 0;
  while (
    start < points.length &&
    elapsed - points[start][2] > material.uniforms.lifetime.value
  )
    start++;
  const end = points.length + (liveHead ? 1 : 0),
    rows = end - start;
  geometry.setDrawRange(0, Math.max(0, rows - 1) * 6);
  if (rows < 2) return;
  const { position, deposit, depositedHeat } = geometry.attributes;
  const scale = (rock.radius ?? 22) * (rock.orbit?.prime ? 0.46 : 1);
  const at = (i) => (i === points.length ? head : points[i]);
  for (let i = start; i < end; i++) {
    const [x, y, age, level, distance, heat] = at(i);
    const prev = at(Math.max(0, i - 1)),
      next = at(Math.min(end - 1, i + 1));
    const dx = next[0] - prev[0],
      dy = next[1] - prev[1],
      length = Math.hypot(dx, dy) || 1;
    for (let j = 0; j < 2; j++) {
      const side = j ? 4 : -4,
        offset = side * scale,
        vertex = (i - start) * 2 + j;
      position.setXYZ(
        vertex,
        x - (offset * dy) / length,
        H - y - (offset * dx) / length,
        104,
      );
      deposit.setXYZW(vertex, age, side, level, distance / scale);
      depositedHeat.setX(vertex, heat);
    }
  }
  position.needsUpdate = deposit.needsUpdate = depositedHeat.needsUpdate = true;
}

export function createPlumes(scene, earth) {
  const wakes = new Map();
  function remove(rock, mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    wakes.delete(rock);
  }
  return {
    clear() {
      for (const [rock, mesh] of wakes) remove(rock, mesh);
    },
    draw(rocks, time) {
      const live = new Set(rocks);
      for (const r of live) {
        if (!wakes.has(r) && emissionAt(r, earth) > 0.01) {
          const mesh = createStrip(r);
          wakes.set(r, mesh);
          scene.add(mesh);
        }
      }
      for (const [rock, mesh] of wakes) {
        const u = mesh.material.uniforms;
        if (!live.has(rock)) mesh.userData.released ??= time;
        const released = mesh.userData.released;
        // A cut or atmospheric burnout stops emission. Existing gas stays where
        // it was deposited and dissipates, including the last point at impact.
        const since = released === undefined ? 0 : time - released;
        const residual = Math.max(0, 1 - since / (rock.prime ? 0.8 : 1.8));
        if (residual === 0) {
          remove(rock, mesh);
          continue;
        }
        u.elapsed.value = rock.age + since * (rock.speed ?? 1);
        u.seconds.value = time;
        u.residual.value = residual * residual;
        writeStrip(mesh, rock, earth, u.elapsed.value);
      }
    },
  };
}
