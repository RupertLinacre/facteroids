import * as T from "three";
import { H } from "./drawing.js";
import { fireAt, stowAt } from "./deployment.js";

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
  const length = weapon.reach;
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
  if (weapon.chassis === 0) {
    tube(length / 2, 4.5, length, hull);
    tube(8, 5.5, 6, steel);
    tube(length - 3, 5.1, 3, copper);
    box(barrel, core, 15, 0, 7.5, 9, 1.3, 1);
  } else if (weapon.chassis === 1) {
    tube(length / 2, 6, length, hull);
    for (const side of [-1, 1]) {
      box(barrel, steel, 14, side * 6, 2, 24, 5, 7);
      box(barrel, copper, 13, side * 6, 6, 17, 3, 2);
      box(barrel, core, 14, side * 6, 7.2, 9, 1.2, 1);
    }
    tube(length - 5, 7.5, 6, steel);
    tube(length - 3, 7.7, 1.8, copper);
  } else {
    box(barrel, steel, 14, 0, 2, 27, 14, 8);
    for (const side of [-1, 1]) {
      box(barrel, hull, 25, side * 6, 4, length - 4, 4.4, 5);
      box(barrel, core, 26, side * 4.5, 6.7, length - 8, 1.3, 1);
    }
    for (let i = 0; i < 4; i++) {
      tube(8 + i * 6, 8.2, 3.5, copper);
      tube(9 + i * 6, 8.5, 1, core);
    }
  }
  return { base, barrel };
}

const blastShader = `
varying vec2 p;
uniform float age, seed, ground, rank;
uniform vec3 tint;
float hash(vec2 a){vec3 b=fract(vec3(a.xyx)*.1031);b+=dot(b,b.yzx+33.33);return fract((b.x+b.y)*b.z);}
float noise2(vec2 a){vec2 i=floor(a),u=fract(a);u=u*u*(3.-2.*u);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),u.x),u.y);}
float billow(vec2 a){return noise2(a)*.53+noise2(a*2.07+5.)*.28+noise2(a*4.13-7.)*.13+noise2(a*8.2)*.06;}
void main(){
  float t=age;float travel=1.-exp(-3.*t);
  vec2 center=vec2(ground*(.08+.54*t),0.);
  vec2 q=(p-center)/(.12+.53*travel);
  q.y*=1.+ground*.16;
  float n=billow(q*3.+vec2(seed-t*1.1,t*.7));
  float lobes=length(q);
  if(ground>.5){
    for(int i=0;i<6;i++){
      float k=float(i),a=(k-2.5)*.53+.14*sin(seed+k*5.);
      vec2 plume=vec2(cos(a),sin(a))*(.45+.12*sin(k*4.+seed))*travel;
      lobes=min(lobes,length(q-plume)*1.43+.04);
    }
  }
  float d=lobes+(.51-n)*1.18;
  float gas=(1.-smoothstep(.58,1.09,d))*smoothstep(0.,.07,t);
  float heat=clamp(1.23-.52*d-.48*t+(n-.52)*1.9,0.,1.);
  vec3 flame=mix(vec3(.075,.055,.085),vec3(.66,.12,.024),smoothstep(.20,.53,heat));
  flame=mix(flame,vec3(1.,.61,.09),smoothstep(.50,.74,heat));
  flame=mix(flame,vec3(1.,.98,.78),smoothstep(.72,.98,heat));
  vec3 plasma=mix(vec3(.17,.10,.47),vec3(.16,.75,1.),heat);
  plasma=mix(plasma,vec3(.94,1.,1.),smoothstep(.62,.94,heat));
  vec3 color=mix(mix(plasma,tint,.65*(1.-heat)),flame,ground);
  float fade=1.-smoothstep(ground>.5?1.:.35,ground>.5?2.35:.88,t);
  float dist=length(p);
  float flash=exp(-dist*dist/(.009+.065*travel))*exp(-t*7.);
  float shock=exp(-abs(dist-(.07+travel*.92))*(64.+t*24.))*exp(-t*3.4);
  float halo=exp(-2.9*length(q))*exp(-t*2.1);
  float rays=pow(abs(cos(atan(p.y,p.x+.00001)*3.+seed)),24.);
  float flare=rays*exp(-dist*3.)*exp(-t*6.)*min(rank,2.);
  float glow=flash+1.2*shock+.58*halo+flare;
  vec3 light=mix(tint,vec3(1.,.63,.23),ground);
  float a=clamp(gas*fade+glow,0.,1.);
  if(a<.003)discard;
  gl_FragColor=vec4(min(vec3(a),color*gas*fade+light*glow),a);
}`;

export function impactModels(scene) {
  const guns = new Map(),
    blasts = new Map(),
    gunPool = [[], [], []];
  const plane = new T.PlaneGeometry(2.8, 2.8);
  return function draw(deployments, bursts, t) {
    for (const [event, gun] of guns)
      if (!deployments.includes(event)) {
        scene.remove(gun.base);
        gunPool[event.weapon.chassis].push(gun);
        guns.delete(event);
      }
    for (const event of deployments) {
      let gun = guns.get(event);
      if (!gun) {
        gun = gunPool[event.weapon.chassis].pop() ?? cannon(event.weapon);
        guns.set(event, gun);
        scene.add(gun.base);
      }
      const age = t - event.time,
        open = ease(clamp(age / 0.26)) * ease(clamp((stowAt - age) / 0.35));
      const kick = Math.max(0, age - fireAt),
        recoil =
          age < fireAt
            ? 0
            : 6 *
              Math.sin(Math.min(1, kick / 0.19) * Math.PI) *
              Math.exp(-kick * 5);
      const rise = 8 * (1 - open);
      gun.base.position.set(
        event.x - rise * Math.cos(event.aim),
        H - event.y + rise * Math.sin(event.aim),
        45,
      );
      gun.base.rotation.z = -event.aim;
      gun.base.scale.set(
        (open * event.reach) / event.weapon.reach,
        open * event.weapon.power,
        open * event.weapon.power,
      );
      gun.barrel.position.x = -recoil;
      gun.barrel.scale.x = 0.58 + 0.42 * ease(clamp((age - 0.09) / 0.26));
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
        const ground = b.type === "impact";
        const mat = new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          premultipliedAlpha: true,
          uniforms: {
            age: { value: 0 },
            ground: { value: ground ? 1 : 0 },
            rank: { value: b.weapon?.chassis ?? 0 },
            tint: { value: new T.Color(b.weapon?.color ?? "#9adfff") },
            seed: { value: b.x * 0.17 + b.y * 0.31 },
          },
          vertexShader:
            "varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: blastShader,
        });
        m = new T.Mesh(plane, mat);
        m.frustumCulled = false;
        m.renderOrder = 4;
        m.position.set(b.x, H - b.y, 130);
        m.rotation.z = -(b.angle ?? 0);
        m.scale.setScalar(
          ground
            ? Math.max(95, b.radius * 3.8)
            : Math.max(32, b.radius * 2.65) * b.weapon.power,
        );
        scene.add(m);
        blasts.set(b, m);
      }
      m.material.uniforms.age.value = t - b.time;
    }
  };
}
