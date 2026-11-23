import { T, stage, mesh, matte, solidBox, rockMaterial } from "./space.js";
export function create(canvas, audio) {
  const view = stage(canvas, 38),
    { scene, camera } = view;
  scene.background = new T.Color("#111023");
  scene.fog = new T.FogExp2("#161329", 0.026);
  camera.position.set(0, 0.2, 13);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xf0e1ff, 0x44305c, 1.9));
  const key = new T.DirectionalLight(0xffeed5, 3.5);
  key.position.set(-5, 7, 6);
  scene.add(key);
  const rim = new T.DirectionalLight(0xa15aff, 4);
  rim.position.set(3, 1, -2);
  scene.add(rim);
  const stars = [];
  for (let i = 0; i < 760; i++)
    stars.push(
      (Math.random() - 0.5) * 110,
      (Math.random() - 0.5) * 63,
      -8 - Math.random() * 63,
    );
  const sg = new T.BufferGeometry();
  sg.setAttribute("position", new T.Float32BufferAttribute(stars, 3));
  scene.add(
    new T.Points(sg, new T.PointsMaterial({ color: "#ded6ff", size: 0.08 })),
  );
  const steel = matte("#423c57", { metalness: 0.6 }),
    brass = matte("#ba935c", { metalness: 0.45 });
  const lamp = new T.MeshBasicMaterial({ color: 0xefa8ff });
  for (const sign of [-1, 1]) {
    const support = solidBox(scene, sign * 7, -1.5, 1, 0.53, 9, 0.63, steel);
    support.rotation.z = -sign * 0.14;
    solidBox(scene, sign * 6.4, -3.7, 2, 3.7, 0.5, 1.3, steel);
    for (let i = 0; i < 5; i++)
      solidBox(scene, sign * (5 + i * 0.6), -3.35, 2, 0.18, 0.15, 0.45, lamp);
    const arm = solidBox(scene, sign * 3.4, -3.6, 3, 0.52, 2.45, 0.67, brass);
    arm.rotation.z = -sign * 0.57;
  }
  function body(r) {
    const group = new T.Group();
    if (r.prime) {
      const core = mesh(
        new T.OctahedronGeometry(0.85),
        matte("#ffccee", {
          emissive: "#b561b5",
          emissiveIntensity: 0.9,
          metalness: 0.2,
        }),
      );
      core.scale.y = 1.6;
      group.add(core);
      return group;
    }
    const half = r.depth > 0,
      geo = new T.SphereGeometry(1, 16, 12, 0, half ? Math.PI : Math.PI * 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const d =
        1 +
        0.1 * Math.sin(x * 6 + y * 4) * Math.cos(z * 5) +
        0.08 * Math.cos(y * 8 - z);
      pos.setXYZ(i, x * d * 1.13, y * d, z * d * 0.96);
    }
    geo.computeVertexNormals();
    group.add(mesh(geo, rockMaterial()));
    if (half) {
      const quartz = matte("#bf77ff", {
        emissive: "#61258d",
        emissiveIntensity: 0.7,
        metalness: 0.2,
        side: T.DoubleSide,
      });
      group.add(mesh(new T.CircleGeometry(0.97, 17), quartz));
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4,
          d = 0.74 * Math.sqrt(i / 10),
          gem = mesh(
            new T.OctahedronGeometry(0.25 + (i % 3) * 0.045),
            quartz,
            Math.cos(a) * d,
            Math.sin(a) * d,
            -0.12,
          );
        gem.scale.z = 1.8;
        group.add(gem);
      }
    }
    return group;
  }
  return {
    burnTime: 2.3,
    spawn(w) {
      return {
        x: -2.2,
        y: 0,
        z: 0,
        radius: 2.12,
        spin: w * 0.17,
        dx: 0,
        dy: 0,
      };
    },
    child(r, i, n) {
      const a = (i / (n - 1) - 0.5) * 2;
      return {
        x: r.x + a * 0.12,
        y: r.y,
        z: r.z + 0.04,
        radius: r.radius * Math.min(0.72, 1 / Math.cbrt(n)),
        spin: 2.66 + i * 0.42,
        dx: a * 2.7,
        dy: Math.sin(i * 2.4) * 1.3,
      };
    },
    move(r, dt) {
      r.x += (0.32 + r.dx) * dt;
      r.y += r.dy * dt;
      r.dx *= Math.exp(-dt * 1.15);
      r.dy *= Math.exp(-dt);
      r.z -= dt * 0.09;
      return r.x > 7.6;
    },
    fire() {
      audio.note(92, 0.55, "sawtooth", 0.028);
    },
    impact(r, k) {
      audio.note(k[0].prime ? 830 : 109, 0.6, "triangle");
    },
    draw(rocks, shots) {
      view.draw(
        rocks,
        shots,
        body,
        (r, b) => {
          b.rotation.set(0.19 + r.age * 0.05, r.spin + r.age * 0.2, 0.1);
          b.scale.setScalar(
            r.radius * (r.prime ? Math.max(0.08, 1 - (r.age / 2.3) ** 3) : 1),
          );
        },
        (r, p, j, s) =>
          new T.Vector3(
            (j % 2 ? 3 : -3) * (1 - p) +
              (r.x + Math.cos(p * 6) * r.radius * 0.38) * p,
            -2.9 * (1 - p) + (r.y + Math.sin(p * 6) * r.radius * 0.55) * p,
            3 * (1 - p) + (r.z + r.radius * 0.8) * p,
          ),
      );
    },
  };
}
