import * as T from "three";
import { H } from "./drawing.js";
import { fireAt } from "./deployment.js";

// Local units are playfield pixels. The origin is the nose, so all three
// rounds have the same casing and meet their own predicted intercept exactly.
const geometry = new T.PlaneGeometry(44, 14).translate(-20, 0, 0);
const fragmentShader = `
varying vec2 p;
uniform float tier, elapsed, travel, power;
uniform vec3 tint;
void main() {
  if (p.x < -travel) discard; // still inside the barrel
  float aft = -p.x;
  float aa = max(.35, fwidth(p.y)*.6);
  float shell = smoothstep(-.4,3.2,aft)*1.65;
  float fins = 2.7*smoothstep(5.5,9.5,aft);
  float hull = (1.-smoothstep(max(shell,fins)-aa,max(shell,fins)+aa,abs(p.y)))
             *smoothstep(-.45,.45,aft)*(1.-smoothstep(9.6,10.4,aft));
  float metal = .42+.58*exp(-pow((p.y-.55)/.8,2.));
  vec3 casing = mix(vec3(.66,.81,.91)*metal,tint,.75*step(6.,aft)*step(aft,7.3));
  float x=max(0.,aft-10.);
  float fade=exp(-x*.078)*smoothstep(9.0,10.4,aft)*(1.-smoothstep(26.,32.,x));
  float core=exp(-abs(p.y)*1.65);
  vec3 jet;
  if (tier < .5) {
    jet=tint*exp(-p.y*p.y*.30)+vec3(.76,.94,1.)*core;
  } else if (tier < 1.5) {
    // A hot compressed jet forms a train of amber shock diamonds.
    float diamond=abs(abs(fract(x*.16-elapsed*2.)-.5)*3.8-abs(p.y));
    jet=tint*(.3*exp(-p.y*p.y*.28)+1.75*exp(-diamond*2.5))
      +vec3(1.,.81,.36)*core;
  } else {
    // Two coloured plasma filaments braid around the straight exhaust axis.
    float helix=2.2*sin(x*.44-elapsed*(12.+power));
    jet=vec3(.39,.80,1.)*exp(-abs(p.y-helix)*1.65)
      +vec3(.96,.28,1.)*exp(-abs(p.y+helix)*1.65)+tint*core*.78;
  }
  vec3 glow=1.-exp(-jet*fade*1.9);
  vec3 light=casing*hull+glow*(1.-hull);
  float opacity=max(hull,max(glow.r,max(glow.g,glow.b)));
  if(opacity<.008) discard;
  gl_FragColor=vec4(light,opacity);
}`;

export function createMissile(weapon) {
  const missile = new T.Mesh(
    geometry,
    new T.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tier: { value: weapon.chassis },
        tint: { value: new T.Color(weapon.color) },
        elapsed: { value: 0 },
        travel: { value: 0 },
        power: { value: 1 },
      },
      vertexShader: `varying vec2 p;
      void main(){ p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader,
    }),
  );
  missile.renderOrder = 3;
  return missile;
}

export function positionMissile(missile, shot) {
  if (shot.age < fireAt) return;
  const { muzzle, intercept, aim, weapon } = shot.mount;
  const u = (shot.age - fireAt) / (shot.duration - fireAt);
  const progress = 0.32 * u + 0.68 * u * u;
  const dx = (intercept.x - muzzle.x) * progress;
  const dy = (intercept.y - muzzle.y) * progress;
  missile.visible = true;
  missile.position.set(muzzle.x + dx, H - muzzle.y - dy, 120);
  missile.rotation.z = -aim;
  const uniforms = missile.material.uniforms;
  uniforms.travel.value = Math.hypot(dx, dy);
  uniforms.elapsed.value = shot.age;
  uniforms.power.value = weapon.power;
}
