import * as T from "three";
import { W, H, noise, tau } from "./drawing.js";

const hashGL = `float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.41,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float grain(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float fb(vec3 p){return .58*grain(p)+.28*grain(p*2.1)+.14*grain(p*4.2);}`;
function nightEarth(scene, earth) {
  const map = new T.TextureLoader().load("/art/land.svg");
  const globe = new T.Mesh(
    new T.SphereGeometry(earth.r, 96, 64),
    new T.ShaderMaterial({
      uniforms: { land: { value: map }, clock: { value: 0 } },
      vertexShader: `varying vec2 uvv;varying vec3 n;void main(){uvv=uv;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D land;uniform float clock;varying vec2 uvv;varying vec3 n;${hashGL}
    void main(){vec3 norm=normalize(n);vec2 uv=vec2(fract(uvv.x+.15+clock*.0008),uvv.y);float continent=texture2D(land,uv).r;
    float sun=dot(norm,normalize(vec3(-.92,.46,.20)));float day=smoothstep(-.18,.38,sun);
    vec3 terrain=mix(vec3(.055,.22,.46),mix(vec3(.16,.36,.28),vec3(.45,.48,.31),fb(vec3(uv*32.,.4))),continent);
    vec3 col=mix(vec3(.019,.034,.095)+continent*.022,terrain*(.65+.47*max(sun,0.)),day);
    float lights=step(.84,hash(vec3(floor(uv*vec2(1320,640)),.7)))*smoothstep(.46,.66,fb(vec3(uv*96.,1.)));
    col+=vec3(1.,.62,.23)*lights*continent*(1.-day);
    float cloud=smoothstep(.52,.69,fb(vec3(uv.x*54.+sin(uv.y*45.)*1.3,uv.y*104.,.5)));
    col=mix(col,mix(vec3(.12,.15,.24),vec3(.84,.91,.97),day),cloud*.82);
    col+=vec3(.18,.57,1.)*pow(1.-max(norm.z,0.),3.2)*(.36+.75*day);
    gl_FragColor=vec4(col,1.);}`,
    }),
  );
  globe.position.set(earth.x, H - earth.y, 0);
  globe.rotation.z = 0.14;
  scene.add(globe);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const c = cv.getContext("2d"),
    g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "transparent");
  g.addColorStop(0.77, "transparent");
  g.addColorStop(0.825, "#9edcffbd");
  g.addColorStop(0.855, "#3e93ff71");
  g.addColorStop(1, "transparent");
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const glow = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(cv),
      transparent: true,
      depthWrite: false,
    }),
  );
  glow.position.copy(globe.position);
  glow.position.z = -1;
  glow.scale.setScalar(earth.r * 2.4);
  scene.add(glow);
  return (t) => (globe.material.uniforms.clock.value = t);
}
function iceShelf(scene, e) {
  const points = [],
    colors = [],
    palette = [
      "#4b7497",
      "#527ca2",
      "#366186",
      "#7898ad",
      "#a6cad5",
      "#354e75",
    ];
  const rows = Array.from({ length: 6 }, (_, j) =>
    Array.from({ length: 32 }, (_, i) => {
      const x = -25 + i * 31 + (j % 2) * 13;
      const y =
        e.y -
        Math.sqrt(e.r ** 2 - (x - e.x) ** 2) +
        j * 17 +
        noise(i + j * 53) * (j ? 11 : 2);
      return [x, H - y, noise(i * 11 + j) * 12 - 14];
    }),
  );
  function tri(a, b, c, seed) {
    points.push(...a, ...b, ...c);
    const color = new T.Color(
      palette[Math.floor(noise(seed) * palette.length)],
    );
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 31; i++) {
      const a = rows[j][i],
        b = rows[j][i + 1],
        c = rows[j + 1][i],
        d = rows[j + 1][i + 1];
      tri(a, b, c, i + j * 77);
      tri(c, b, d, 90 + i * 2 + j * 47);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  scene.add(
    new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }),
    ),
  );
  const steel = new T.MeshStandardMaterial({
    color: "#add6da",
    metalness: 0.42,
    roughness: 0.45,
    flatShading: true,
  });
  const trim = new T.MeshStandardMaterial({
    color: "#294961",
    metalness: 0.35,
    roughness: 0.51,
  });
  const bulb = new T.MeshBasicMaterial({ color: "#a1ffed" });
  function add(geo, mat, x, y, z) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, H - y, z);
    scene.add(m);
    return m;
  }
  for (const x of [344, 450, 539]) {
    const y = e.y - Math.sqrt(e.r ** 2 - (x - e.x) ** 2) + 2,
      main = x === 450;
    add(
      new T.CylinderGeometry(main ? 19 : 7, main ? 25 : 10, main ? 9 : 5, 8),
      trim,
      x,
      y,
      10,
    );
    add(
      new T.SphereGeometry(main ? 13 : 7, 12, 7, 0, tau, 0, Math.PI / 2),
      steel,
      x,
      y - 4,
      14,
    );
    if (main) {
      for (const side of [-1, 1]) {
        const tube = add(
          new T.CylinderGeometry(2.0, 3, 17, 8),
          steel,
          x + side * 4,
          y - 14,
          17,
        );
        tube.rotation.z = side * 0.23;
        add(new T.SphereGeometry(2, 8, 6), bulb, x + side * 6, y - 22, 17);
      }
    } else {
      const dish = add(
        new T.SphereGeometry(
          8.5,
          12,
          5,
          0,
          tau,
          Math.PI * 0.34,
          Math.PI * 0.35,
        ),
        steel,
        x,
        y - 12,
        13,
      );
      dish.scale.y = 0.52;
      dish.rotation.z = x < 450 ? 0.49 : -0.49;
    }
  }
  return () => {};
}
function asteroidMaterial(ice) {
  const mat = new T.MeshStandardMaterial({
    color: ice ? "#9fc8dd" : "#776d80",
    roughness: ice ? 0.3 : 0.84,
    metalness: ice ? 0.36 : 0.17,
    flatShading: true,
  });
  mat.onBeforeCompile = (s) => {
    s.vertexShader =
      "varying vec3 localPoint;\n" +
      s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nlocalPoint=position;",
      );
    s.fragmentShader =
      "varying vec3 localPoint;\n" +
      hashGL +
      "\n" +
      s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float vein=abs(sin(localPoint.y*8.+fb(localPoint*4.)*9.));
      diffuseColor.rgb *= .58+.64*fb(localPoint*9.);
      diffuseColor.rgb += (1.-smoothstep(.015,.10,vein))*${ice ? "vec3(.23,.9,.95)" : "vec3(1.,.27,.045)"};`,
      );
  };
  return mat;
}
export function createModels(overlay, earth, world) {
  const canvas = document.createElement("canvas");
  canvas.className = "model-layer";
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  overlay.before(canvas);
  renderer.setPixelRatio(Math.min(1.8, devicePixelRatio));
  renderer.setClearColor(0, 0);
  const scene = new T.Scene(),
    cam = new T.OrthographicCamera(0, W, H, 0, 0.1, 1600);
  cam.position.z = 800;
  scene.add(new T.HemisphereLight(0xe4efff, 0x554d66, 1.65));
  const light = new T.DirectionalLight(0xffeddb, 3.1);
  light.position.set(-120, 230, 190);
  scene.add(light);
  const rim = new T.DirectionalLight(0x76dbff, 2.5);
  rim.position.set(170, 12, -75);
  scene.add(rim);
  const ice = world.horizon,
    update = ice ? iceShelf(scene, earth) : nightEarth(scene, earth);
  const mineral = asteroidMaterial(ice),
    prime = new T.MeshStandardMaterial({
      color: "#d1ffee",
      emissive: "#64c995",
      emissiveIntensity: 0.6,
      flatShading: true,
    });
  const stones = Array.from({ length: 4 }, (_, j) => {
    const geom = new T.IcosahedronGeometry(1, ice ? 0 : 2),
      pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const rough =
        1 +
        0.12 * Math.sin(x * 7 + j) * Math.cos(y * 8 + z * 5) +
        0.08 * Math.sin(y * 10 - x * 3);
      pos.setXYZ(
        i,
        x * rough * (ice ? 0.85 : 1.1),
        y * rough * (ice ? 1.25 : 1),
        z * rough,
      );
    }
    geom.computeVertexNormals();
    return geom;
  });
  const objects = new Map();
  let width, height;
  return {
    draw(rocks, t) {
      if (width !== overlay.clientWidth || height !== overlay.clientHeight) {
        width = overlay.clientWidth;
        height = overlay.clientHeight;
        renderer.setSize(width, height, false);
      }
      update(t);
      for (const [r, m] of objects)
        if (!rocks.includes(r)) {
          scene.remove(m);
          objects.delete(r);
        }
      for (const r of rocks) {
        let m = objects.get(r);
        if (!m) {
          m = new T.Mesh(stones[r.value % 4], r.prime ? prime : mineral);
          scene.add(m);
          objects.set(r, m);
        }
        m.position.set(r.x, H - r.y, 105);
        m.rotation.set(
          r.value * 0.72 + t * 0.21,
          t * 0.4 + r.vx * 0.02,
          t * 0.14,
        );
        m.scale.setScalar(
          Math.max(12, 26 - r.depth * 4) *
            (r.prime ? Math.min(1, Math.max(0.02, 2 - r.age)) : 1),
        );
      }
      renderer.render(scene, cam);
    },
  };
}
