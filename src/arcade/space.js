import * as T from "three";
export { T };
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
export const matte = (color, options = {}) =>
  new T.MeshStandardMaterial({ color, flatShading: true, ...options });
export function solidBox(parent, x, y, z, w, h, d, mat) {
  const obj = mesh(new T.BoxGeometry(w, h, d), mat, x, y, z);
  parent.add(obj);
  return obj;
}
function tag(value, prime) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 80;
  const c = cv.getContext("2d");
  c.fillStyle = "#132034db";
  c.beginPath();
  c.roundRect(6, 6, 116, 68, 18);
  c.fill();
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = prime ? "#fff3b7" : "#ffffff";
  c.font = "bold 58px monospace";
  c.fillText(value, 64, 44);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  const obj = new T.Sprite(
    new T.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  obj.renderOrder = 9;
  return obj;
}
function release(group) {
  const mats = new Set(),
    geos = new Set();
  group.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) mats.add(o.material);
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
}
export function stage(canvas, fov) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(fov, 2, 0.1, 220);
  const bodies = new Map(),
    beams = new Map();
  function draw(rocks, shots, makeBody, orient, beamPoint) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (
      w !== renderer.domElement.width / renderer.getPixelRatio() ||
      h !== renderer.domElement.height / renderer.getPixelRatio()
    ) {
      if (camera.userData.w !== w || camera.userData.h !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        camera.userData = { w, h };
      }
    }
    for (const [r, node] of bodies)
      if (!rocks.includes(r)) {
        scene.remove(node);
        release(node);
        bodies.delete(r);
      }
    for (const r of rocks) {
      let node = bodies.get(r);
      if (!node) {
        node = new T.Group();
        const body = makeBody(r),
          badge = tag(r.value, r.prime);
        node.add(body, badge);
        scene.add(node);
        bodies.set(r, node);
      }
      node.position.set(r.x, r.y, r.z);
      const [body, badge] = node.children;
      orient(r, body);
      const dist = camera.position.distanceTo(node.position);
      const scale = Math.max(dist * 0.04, r.radius * 0.8);
      badge.scale.set(scale * 1.48, scale * 0.93, 1);
      badge.position.y = 0.12 * r.radius;
    }
    for (const [s, g] of beams)
      if (!shots.includes(s)) {
        scene.remove(g);
        release(g);
        beams.delete(s);
      }
    for (const s of shots) {
      let g = beams.get(s);
      if (!g) {
        g = new T.Group();
        for (let j = 0; j < s.factors.length; j++) {
          const geo = new T.BufferGeometry();
          geo.setAttribute(
            "position",
            new T.BufferAttribute(new Float32Array(22 * 3), 3),
          );
          const line = new T.Line(
            geo,
            new T.LineBasicMaterial({ color: j % 2 ? 0xff93db : 0x94fff0 }),
          );
          line.frustumCulled = false;
          const tip = mesh(
            new T.SphereGeometry(0.1, 6, 5),
            new T.MeshBasicMaterial({ color: 0xfff5c4 }),
          );
          g.add(line, tip);
        }
        beams.set(s, g);
        scene.add(g);
      }
      const p = Math.min(1, s.age / s.duration);
      for (let j = 0; j < g.children.length / 2; j++) {
        const line = g.children[j * 2],
          tip = g.children[j * 2 + 1],
          pos = line.geometry.attributes.position;
        for (let i = 0; i < 22; i++) {
          const u = (p * i) / 21,
            v = beamPoint(s.target, u, j, s);
          pos.setXYZ(i, v.x, v.y, v.z);
          if (i === 21) tip.position.copy(v);
        }
        pos.needsUpdate = true;
      }
    }
    renderer.render(scene, camera);
  }
  return { scene, camera, draw };
}
export function rockMaterial() {
  const mat = matte("#535164", { roughness: 0.93 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 vStone;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvStone = position;",
      );
    shader.fragmentShader =
      "varying vec3 vStone;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float vein=sin(vStone.y*13.0+2.4*sin(vStone.x*5.0)+sin(vStone.z*9.0));
      float grit=fract(sin(dot(floor(vStone*138.0),vec3(12.9,7.3,19.4)))*4375.0);
      diffuseColor.rgb *= 0.74+grit*0.28+vein*0.11;
      diffuseColor.rgb += vec3(0.24,0.10,0.33)*smoothstep(0.989,1.0,vein);`,
      );
  };
  return mat;
}
