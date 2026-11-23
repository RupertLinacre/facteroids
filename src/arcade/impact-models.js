import * as T from "three";
import { surfaceStrikeShader } from "./surface-strike.js";
import { H } from "./drawing.js";
import { createMissile, positionMissile } from "./missile.js";
import { barrelLength, launcherScale, fireAt, stowAt } from "./deployment.js";

const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => x * x * (3 - 2 * x);

function cannon(weapon) {
  const base = new T.Group(),
    barrel = new T.Group();
  const hull = new T.MeshStandardMaterial({
    color: 0x7188a7,
    metalness: 0.58,
    roughness: 0.32,
  });
  const steel = new T.MeshStandardMaterial({
    color: 0x273951,
    metalness: 0.65,
    roughness: 0.32,
  });
  const copper = new T.MeshStandardMaterial({
    color: 0xe4a576,
    metalness: 0.5,
    roughness: 0.36,
  });
  const core = new T.MeshBasicMaterial({ color: weapon.color });
  function piece(parent, geo, mat, x, y, z) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function box(parent, mat, x, y, z, l, w, h) {
    return piece(parent, new T.BoxGeometry(l, w, h), mat, x, y, z);
  }
  piece(base, new T.SphereGeometry(10, 12, 8), hull, 0, 0, 0).scale.set(
    0.78,
    1.05,
    0.72,
  );
  for (const side of [-1, 1]) {
    const shoe = box(base, steel, -2, side * 9, -2, 12, 5, 6);
    shoe.rotation.z = side * 0.22;
    box(base, copper, 1, side * 10, 1, 5, 2, 3);
  }
  base.add(barrel);
  const length = barrelLength;
  function tube(x, radius, depth, material) {
    const part = piece(
      barrel,
      new T.CylinderGeometry(radius, radius, depth, 12),
      material,
      x,
      0,
      3,
    );
    part.rotation.z = Math.PI / 2;
  }
  tube(length / 2, 4.5, length, hull);
  tube(8, 5.5, 6, steel);
  tube(length - 3, 5.1, 3, copper);
  for (const side of [-1, 1]) {
    box(barrel, steel, 16, side * 4, 5, 22, 3, 3);
    box(barrel, core, 17, side * 4, 7, 17, 1.5, 1);
  }
  return { base, barrel, missile: createMissile(weapon) };
}

const blastShader = `
varying vec2 p;
uniform float age, seed, rank, power, lifetime;
uniform vec3 tint;
float hash(vec2 a){vec3 b=fract(vec3(a.xyx)*.1031);b+=dot(b,b.yzx+33.33);return fract((b.x+b.y)*b.z);}
float noise2(vec2 a){vec2 i=floor(a),u=fract(a);u=u*u*(3.-2.*u);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),u.x),u.y);}
float billow(vec2 a){return noise2(a)*.53+noise2(a*2.07+5.)*.28+noise2(a*4.13-7.)*.13+noise2(a*8.2)*.06;}
void main(){
  float t=age;float travel=1.-exp(-3.*t);
  vec2 q=p/(.12+.53*travel);
  float n=billow(q*3.+vec2(seed-t*1.1,t*.7));
  float lobes=length(q);
  float d=lobes+(.51-n)*1.18;
  float gas=(1.-smoothstep(.58,1.09,d))*smoothstep(0.,.07,t);
  float heat=clamp(1.23-.52*d-.48*t+(n-.52)*1.9,0.,1.);
  vec3 flame=mix(vec3(.075,.055,.085),vec3(.66,.12,.024),smoothstep(.20,.53,heat));
  flame=mix(flame,vec3(1.,.61,.09),smoothstep(.50,.74,heat));
  flame=mix(flame,vec3(1.,.98,.78),smoothstep(.72,.98,heat));
  vec3 plasma=mix(vec3(.17,.10,.47),vec3(.16,.75,1.),heat);
  plasma=mix(plasma,vec3(.94,1.,1.),smoothstep(.62,.94,heat));
  vec3 color=mix(plasma,tint,.65*(1.-heat));
  float fade=1.-smoothstep(.35,.88,t);
  float dist=length(p);
  float flash=exp(-dist*dist/(.009+.065*travel))*exp(-t*7.);
  float shock=exp(-abs(dist-(.07+travel*.92))*(64.+t*24.))*exp(-t*3.4);
  float halo=exp(-2.9*length(q))*exp(-t*2.1);
  float rays=pow(abs(cos(atan(p.y,p.x+.00001)*3.+seed)),24.);
  float flare=rays*exp(-dist*3.)*exp(-t*6.)*min(rank,2.);
  float glow=flash+1.2*shock+.58*halo+flare;
  vec3 light=tint;
  vec3 lightField=color*gas*fade+light*glow;
  float a=clamp(gas*fade+glow,0.,1.);
  if(rank>.5){
    float theta=atan(p.y,p.x+.00001);
    float front=.12+.74*travel;
    vec3 accent;
    if(rank<1.5){
      // Incandescent cells ripple around the edge of the shock front.
      float shell=exp(-32.*abs(dist-front+.045*sin(theta*9.+n*4.)));
      float cells=.5+.5*cos(theta*12.+dist*24.-t*13.);
      accent=vec3(1.,.40,.065)*shell*(.6+cells);
      lightField=mix(lightField,flame*gas*fade+light*glow,.74);
    }else{
      // A rotating ionisation front splits into cyan and violet filaments.
      float twist=theta*3.+dist*(9.+power)-t*7.+seed;
      float band=exp(-4.*abs(dist-front));
      accent=band*(vec3(.31,.86,1.)*pow(.5+.5*cos(twist),16.)
                  +vec3(.91,.22,1.)*pow(.5-.5*cos(twist),16.));
    }
    // Shock-heated dust hangs behind the first wave. The amber burst sheds
    // incandescent knots, while the nova leaves folded curtains of plasma.
    float envelope=(1.-smoothstep(lifetime*.42,lifetime,t))
                  *smoothstep(0.,.10,t)*(1.-smoothstep(1.18,1.38,dist));
    float grit=billow(p*7.+seed+vec2(-t*.8,t*.5));
    float fold=sin(theta*5.+seed+dist*7.-t*2.);
    float wake=front*.94-.20+.085*fold+.11*(grit-.5);
    float veil=exp(-11.*abs(dist-wake))*(.24+grit);
    if(rank<1.5){
      float knots=pow(.5+.5*cos(theta*9.+1.6*sin(theta*4.+seed)),5.);
      float tongues=exp(-6.*abs(dist-front*.78))*knots;
      accent+=vec3(1.,.24,.025)*veil*1.4+vec3(1.,.76,.25)*tongues;
    }else{
      float second=1.-exp(-2.8*max(0.,t-.18));
      float ridge=second*(.82+.12*fold+.09*(grit-.5));
      float ribbon=exp(-28.*abs(dist-ridge))*smoothstep(.18,.35,t);
      vec3 aurora=mix(vec3(.08,.85,1.),vec3(.90,.14,1.),.5+.5*fold);
      float axis=dot(p,vec2(.96,.28)), crossAxis=dot(p,vec2(-.28,.96));
      float streak=exp(-abs(crossAxis)*70.-abs(axis)*2.8)*exp(-t*4.);
      accent+=aurora*(veil*1.4+ribbon*1.8)+vec3(.82,.91,1.)*streak*2.;
    }
    accent*=envelope;
    lightField+=accent;
    a=max(a,min(1.,max(accent.r,max(accent.g,accent.b))));
  }
  if(a<.003)discard;
  gl_FragColor=vec4(min(vec3(a),lightField),a);
}`;

export function impactModels(scene) {
  const guns = new Map(),
    blasts = new Map(),
    gunPool = [[], [], []];
  const plane = new T.PlaneGeometry(2.8, 2.8);
  return function draw(deployments, bursts, shots, t) {
    for (const [event, gun] of guns)
      if (!deployments.includes(event)) {
        scene.remove(gun.base, gun.missile);
        gunPool[event.weapon.chassis].push(gun);
        guns.delete(event);
      }
    for (const event of deployments) {
      let gun = guns.get(event);
      if (!gun) {
        gun = gunPool[event.weapon.chassis].pop() ?? cannon(event.weapon);
        guns.set(event, gun);
        scene.add(gun.base, gun.missile);
      }
      gun.missile.visible = false;
      const age = t - event.time,
        open = ease(clamp(age / 0.26)) * ease(clamp((stowAt - age) / 0.35));
      const kick = Math.max(0, age - fireAt),
        recoil =
          age < fireAt
            ? 0
            : 6 *
              Math.sin(Math.min(1, kick / 0.19) * Math.PI) *
              Math.exp(-kick * 5);
      const rise = 4 * (1 - open);
      gun.base.position.set(
        event.x - rise * Math.cos(event.aim),
        H - event.y + rise * Math.sin(event.aim),
        45,
      );
      gun.base.rotation.z = -event.aim;
      gun.base.scale.set(
        (open * event.reach) / barrelLength,
        open * launcherScale,
        open * launcherScale,
      );
      gun.barrel.position.x = -recoil;
      gun.barrel.scale.x = 0.58 + 0.42 * ease(clamp((age - 0.09) / 0.26));
    }
    for (const shot of shots) {
      const gun = guns.get(shot.mount);
      if (gun) positionMissile(gun.missile, shot);
    }
    for (const [b, m] of blasts)
      if (!bursts.includes(b)) {
        scene.remove(m);
        m.material.dispose();
        blasts.delete(b);
      }
    for (const b of bursts) {
      let m = blasts.get(b);
      if (!m) {
        const strike = b.strike;
        const mat = new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          premultipliedAlpha: true,
          uniforms: {
            age: { value: 0 },
            lifetime: { value: strike?.duration ?? b.weapon.blastDuration },
            bias: { value: strike?.bias ?? 0 },

            rank: { value: b.weapon?.chassis ?? 0 },
            power: { value: b.weapon?.power ?? 1 },
            tint: { value: new T.Color(b.weapon?.color ?? "#9adfff") },
            seed: { value: b.x * 0.17 + b.y * 0.31 },
          },
          vertexShader:
            "varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: strike ? surfaceStrikeShader : blastShader,
        });
        m = new T.Mesh(plane, mat);
        m.frustumCulled = false;
        m.renderOrder = 4;
        m.position.set(b.x, H - b.y, 130);
        m.rotation.z = -(b.angle ?? 0);
        m.scale.setScalar(
          strike?.extent ??
            Math.max(36, b.radius * 2.65) * (1 + b.weapon.chassis * 0.42),
        );
        scene.add(m);
        blasts.set(b, m);
      }
      m.material.uniforms.age.value = t - b.time;
    }
  };
}
