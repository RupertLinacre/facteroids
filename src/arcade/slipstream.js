import { T, stage, mesh, matte, solidBox } from "./space.js";
export function create(canvas, audio) {
  const view = stage(canvas, 55),
    { camera, scene } = view;
  camera.position.set(0, 3.6, 9);
  camera.lookAt(0, 2, -30);
  scene.background = new T.Color("#ffc8ad");
  scene.fog = new T.Fog("#ffc8ad", 27, 112);
  scene.add(new T.HemisphereLight(0xffead3, 0x818adb, 2.4));
  const sun = new T.DirectionalLight(0xffddad, 2.8);
  sun.position.set(-30, 25, 8);
  scene.add(sun);
  scene.add(
    mesh(
      new T.SphereGeometry(7, 32, 20),
      new T.MeshBasicMaterial({ color: 0xfff5b8, fog: false }),
      -13,
      11,
      -98,
    ),
  );
  const water = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 wp;void main(){vec4 p=modelMatrix*vec4(position,1.);wp=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `varying vec3 wp;uniform float time;void main(){
      float z=wp.z-time*4.;float ripple=sin(z*2.+sin(wp.x*1.2+z*.3)*.8+sin(wp.x*3.+z)*.2);
      vec3 col=mix(vec3(.025,.31,.59),vec3(.12,.69,.79),smoothstep(.84,1.,ripple)*.64);
      float path=exp(-abs(wp.x+3.+sin(z*.38)*1.6)*.29);
      col+=vec3(.5,.26,.09)*path*smoothstep(.86,1.,ripple);
      gl_FragColor=vec4(mix(col,vec3(.94,.65,.61),smoothstep(25.,108.,-wp.z)),1.);
    }`,
  });
  const sea = mesh(new T.PlaneGeometry(220, 205), water, 0, -1, -75);
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);
  const cliffs = [];
  for (let i = 0; i < 36; i++) {
    const side = i % 2 ? 1 : -1,
      k = Math.floor(i / 2),
      g = new T.CylinderGeometry(1.1, 1.72, 1, 5, 2);
    const colors = ["#ce6b83", "#ff997c", "#cc779e", "#ed855f"];
    const cliff = mesh(g, matte(colors[i % 4]));
    cliff.rotation.y = i * 1.83;
    cliff.scale.set(2.8 + Math.sin(i) * 0.7, 4 + 2.8 * Math.sin(i * 1.6), 4.2);
    cliff.position.x = side * (9 + Math.cos(i * 1.41) * 2.6);
    cliff.position.y = cliff.scale.y / 2 - 1.2;
    scene.add(cliff);
    cliffs.push({ cliff, offset: k * 6.4 + (i % 2) * 2 });
  }
  const ship = new T.Group(),
    hull = matte("#ffedde", { metalness: 0.28 }),
    wing = matte("#168ba6", { metalness: 0.5 });
  const fuselage = mesh(new T.ConeGeometry(0.36, 1.9, 5), hull);
  fuselage.rotation.x = -Math.PI / 2;
  ship.add(fuselage);
  for (const side of [-1, 1]) {
    const foil = solidBox(
      ship,
      side * 0.67,
      -0.08,
      0.2,
      1.12,
      0.09,
      0.58,
      wing,
    );
    foil.rotation.y = -side * 0.27;
    solidBox(ship, side * 0.96, -0.07, 0.38, 0.11, 0.12, 0.53, hull);
  }
  const jet = mesh(
    new T.ConeGeometry(0.18, 0.95, 8),
    new T.MeshBasicMaterial({ color: "#a3fff3" }),
    0,
    -0.03,
    1.05,
  );
  jet.rotation.x = Math.PI / 2;
  ship.add(jet);
  scene.add(ship);
  const beat = 0.43;
  let lastBeat = -1,
    lastTime = 0,
    rush = 0,
    distance = 0;
  const notes = [];
  const arch = mesh(
    new T.TorusGeometry(3.6, 0.09, 6, 42),
    new T.MeshBasicMaterial({ color: 0xffd386 }),
  );
  arch.visible = false;
  scene.add(arch);
  function stone(r) {
    return mesh(
      r.prime ? new T.OctahedronGeometry(1) : new T.IcosahedronGeometry(1, 0),
      matte(
        r.prime ? "#ffde79" : "#975f77",
        r.prime ? { emissive: "#ff9d24", emissiveIntensity: 0.75 } : {},
      ),
    );
  }
  return {
    burnTime: 2,
    typingSpeed: 0.43,
    reset() {
      lastBeat = -1;
      lastTime = 0;
      rush = 0;
      distance = 0;
      notes.length = 0;
      arch.visible = false;
    },
    spawn(w) {
      return {
        x: Math.sin(w * 2) * 1.4,
        y: 2.3,
        z: -26,
        radius: 2.5,
        spin: w,
        dx: 0,
        dy: 0,
      };
    },
    child(r, i, n) {
      const fan = (2 * i) / (n - 1) - 1;
      return {
        x: r.x + fan * 0.25,
        y: r.y,
        z: r.z,
        radius: Math.max(0.3, (r.radius / Math.cbrt(n)) * 0.89),
        spin: i + 0.35,
        dx: fan * 4.6,
        dy: n > 2 ? Math.sin((i * Math.PI) / (n - 1)) * 2.3 : 0.12,
      };
    },
    move(r, dt) {
      r.z += dt * (r.prime ? 5 : 1.75);
      r.x += r.dx * dt;
      r.dx *= Math.exp(-1.3 * dt);
      r.y += r.dy * dt;
      r.dy *= Math.exp(-dt);
      return r.z > 4.8;
    },
    shotTime(t, chained) {
      return (chained ? 0.5 : 1) * beat + beat - (t % beat);
    },
    fire() {
      audio.note(328, 0.22, "triangle");
    },
    impact(r, k) {
      audio.note(k[0].prime ? 392 : 164, 0.35, "triangle");
      if (k[0].prime) {
        rush = Math.max(rush, 1.9);
        arch.visible = true;
        arch.position.set(0, 2, r.z);
        k.forEach((child, i) =>
          notes.push({
            at: lastTime + i * 0.085,
            hz: 392 * 2 ** (((i % 5) * 2) / 12),
          }),
        );
      }
    },
    draw(rocks, shots, t) {
      const dt = Math.max(0, t - lastTime);
      lastTime = t;
      const speed = rush > 0 ? 22 : 4.1;
      distance += dt * speed;
      rush = Math.max(0, rush - dt);
      if (arch.visible) {
        arch.position.z += dt * speed;
        if (arch.position.z > 8) arch.visible = false;
      }
      for (let i = notes.length - 1; i >= 0; i--) {
        if (notes[i].at <= t) {
          audio.note(notes[i].hz, 0.17, "sine", 0.032);
          notes.splice(i, 1);
        }
      }
      water.uniforms.time.value = distance / 4.1;
      const b = Math.floor(t / beat);
      if (t > 0 && b !== lastBeat) {
        const bass = [82, 0, 123, 0, 98, 0, 147, 110][b % 8];
        if (bass) audio.note(bass, 0.14, "triangle", 0.024);
        lastBeat = b;
      }
      ship.position.set(
        Math.sin(t * 0.76) * 0.4,
        0.57 + Math.cos(t * 2) * 0.04,
        4,
      );
      ship.rotation.z = Math.sin(t * 0.76) * 0.12;
      jet.scale.y = 1 + Math.sin(t * 22) * 0.2;
      for (const { cliff, offset } of cliffs)
        cliff.position.z =
          10 - ((((offset - distance) % 115.2) + 115.2) % 115.2);
      view.draw(
        rocks,
        shots,
        stone,
        (r, obj) => {
          obj.rotation.set(t * 0.23, r.spin + t * 0.4, t * 0.09);
          obj.scale.setScalar(
            r.radius * (r.prime ? Math.max(0.12, 1 - (r.age / 2) ** 3) : 1),
          );
        },
        (r, p, j) => {
          const side = j % 2 ? 1 : -1;
          return new T.Vector3(
            (ship.position.x + side * 0.8) * (1 - p) +
              r.x * p +
              side * Math.sin(Math.PI * p) * (1.3 + j * 0.6),
            ship.position.y * (1 - p) +
              r.y * p +
              Math.sin(Math.PI * p) * (0.6 + j * 0.35),
            ship.position.z * (1 - p) + r.z * p,
          );
        },
      );
    },
  };
}
