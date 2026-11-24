import * as T from "three";
import { visibleRadius } from "./umbra.js";
import { createAtmosphere } from "./atmosphere.js";
import { impactModels } from "./impact-models.js";
import { planetVisibility } from "./surface-strike.js";
import { createPlumes } from "./plasma.js";
import { W, H, noise, tau, viewScale } from "./drawing.js";

const hashGL = `float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.41,.73));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float grain(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
float fb(vec3 p){return .58*grain(p)+.28*grain(p*2.1)+.14*grain(p*4.2);}`;
function redPlanet(scene, planet) {
  const sites = Array.from({ length: 8 }, () => new T.Vector4());
  const ages = new Float32Array(8);
  const spinAxis = new T.Vector3(0, 1, 0),
    viewAxis = new T.Vector3(0, 0, 1),
    normal = new T.Vector3();
  const globe = new T.Mesh(
    new T.SphereGeometry(planet.r, 96, 64),
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        clock: { value: 0 },
        planetAlpha: { value: 1 },
        sites: { value: sites },
        scarAges: { value: ages },
        scarCount: { value: 0 },
      },
      vertexShader: `varying vec3 localDir;varying vec3 n;uniform vec4 sites[8];uniform int scarCount;
      void main(){
        localDir=normal;n=normalize(normalMatrix*normal);float relief=0.;
        for(int i=0;i<8;i++){
          if(i>=scarCount)break;
          float d=length(n-sites[i].xyz)/sites[i].w;
          relief+=sites[i].w*(8.*exp(-pow((d-.94)*9.,2.))-17.*(1.-smoothstep(.16,.9,d)));
        }
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*relief,1.);
      }`,
      fragmentShader: `uniform float clock,planetAlpha;uniform vec4 sites[8];uniform float scarAges[8];uniform int scarCount;varying vec3 localDir;varying vec3 n;${hashGL}
    float basin(vec3 p, vec3 site, float radius, float rough){
      vec3 offset=p-normalize(site);
      float d=length(offset)/radius + (rough-.5)*.14;
      float rim=exp(-pow((d-.96)*12.,2.));
      float wall=dot(offset,vec3(-.75,.6,.15))/radius;
      return rim*(.09-.13*wall) - (1.-smoothstep(.53,.96,d))*(.11-.11*wall);
    }
    void main(){
      vec3 norm=normalize(n),p=normalize(localDir);
      float spin=clock*.00502655;
      p.xz=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*p.xz;
      float rough=fb(p*19.);
      vec3 warped=p+vec3(fb(p*3.),fb(p*3.+12.),fb(p*4.+7.))*.19;
      float relief=fb(warped*5.5);
      float dust=smoothstep(.28,.69,relief);
      vec3 terrain=mix(vec3(.34,.116,.086),vec3(.84,.39,.20),dust);
      float strata=fb(vec3(warped.x*9.,warped.y*34.,warped.z*12.));
      terrain+=vec3(.19,.12,.064)*(strata-.42)+vec3(.11,.07,.04)*(rough-.45);
      // A branching equatorial rift cuts through the ochre plateaus.
      float fault=p.y+.12+.09*sin(p.x*6.+p.z*3.)+.065*(rough-.5);
      float extent=smoothstep(.06,.48,p.z)*(1.-smoothstep(.44,.78,abs(p.x)));
      float branch=fault-.12*(p.x+.21);
      float cut=min(abs(fault),abs(branch)+.012);
      terrain*=1.-.43*extent*(1.-smoothstep(.004,.039,cut));
      terrain+=extent*exp(-pow((fault-.036)*95.,2.))*vec3(.13,.07,.035);
      terrain+=basin(p,vec3(-.51,.33,.81),.148,rough)
        +basin(p,vec3(.28,.47,.83),.087,rough)
        +basin(p,vec3(-.29,-.56,.75),.22,rough)
        +basin(p,vec3(.53,-.18,.82),.10,rough);
      float cap=smoothstep(.942,.973,abs(p.y)+.032*(rough-.5));
      terrain=mix(terrain,vec3(.88,.76,.65),cap*.86);
      float sun=dot(norm,normalize(vec3(-.78,.50,.52)));
      float day=smoothstep(-.15,.48,sun);
      vec3 col=terrain*(.14+.90*max(0.,sun)) + vec3(.036,.016,.032)*(1.-day);
      col+=vec3(.90,.43,.23)*pow(1.-max(norm.z,0.),4.)*(.14+.7*day);
    for(int i=0;i<8;i++){
      if(i>=scarCount)break;
      vec3 site=sites[i].xyz;float size=sites[i].w,age=scarAges[i];
      float arc=length(norm-site);
      if(arc>size*1.7 && age>2.3)continue;
      float rough=fb(norm*36.+site*3.);
      float d=arc/size+(rough-.5)*.19;
      float bowl=1.-smoothstep(.66,.92,d);
      float rim=exp(-pow((d-.94)*10.,2.));
      float charred=1.-smoothstep(.94,1.48,d);
      vec3 radial=normalize(norm-site+vec3(.0001));
      float wall=dot(radial,normalize(vec3(-.75,.52,.3)));
      col=mix(col,vec3(.075,.05,.07)+rough*.09,charred*.93);
      col=mix(col,vec3(.037,.022,.037)+max(0.,wall)*smoothstep(.3,.84,d)*.26,bowl);
      col+=rim*(.19+.47*max(0.,-wall))*vec3(.94,.69,.51);
      float lava=(1.-smoothstep(.035,.15,abs(sin(rough*25.+d*9.))))*bowl;
      float bearing=atan(radial.y,radial.x);
      float ray=abs(sin(bearing*11.+rough*3.6));
      float fissures=(1.-smoothstep(.018,.10,ray))*smoothstep(.76,.96,d)*(1.-smoothstep(1.,1.52,d));
      col+=vec3(1.,.31,.05)*(lava*1.5+rim*.85+bowl*.27+fissures)*exp(-age*.17);
    }
    gl_FragColor=vec4(col,planetAlpha);}`,
    }),
  );
  globe.position.set(planet.x, H - planet.y, 0);
  globe.rotation.z = 0.14;
  scene.add(globe);
  const atmosphere = createAtmosphere(planet.r);
  atmosphere.position.copy(globe.position);
  atmosphere.position.z -= planet.r;
  scene.add(atmosphere);
  return (t, scars, visibility = 1) => {
    globe.visible = visibility > 0;
    atmosphere.visible = visibility > 0;
    globe.material.uniforms.planetAlpha.value = visibility;
    atmosphere.material.uniforms.fade.value = visibility;
    atmosphere.material.uniforms.seconds.value = t;
    const uniforms = globe.material.uniforms;
    uniforms.clock.value = t;
    uniforms.scarCount.value = Math.min(scars.length, sites.length);
    for (let i = 0; i < uniforms.scarCount.value; i++) {
      const scar = scars[i],
        age = t - scar.time;
      const nx = (scar.x - planet.x) / planet.r,
        ny = (planet.y - scar.y) / planet.r;
      normal.set(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)));
      // Rotate the scar with the terrain.
      normal
        .applyAxisAngle(viewAxis, -globe.rotation.z)
        .applyAxisAngle(spinAxis, -age * 0.0008 * Math.PI * 2)
        .applyAxisAngle(viewAxis, globe.rotation.z);
      sites[i].set(normal.x, normal.y, normal.z, scar.size / planet.r);
      ages[i] = age;
    }
  };
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
// Translucent-looking glacial layers, a frosted rind and lit fracture planes.
function glacierMaterial(tint) {
  return new T.ShaderMaterial({
    uniforms: {
      tint: { value: new T.Color().setStyle(tint, T.LinearSRGBColorSpace) },
    },
    vertexShader: `varying vec3 localP;varying vec3 eyeP;
      void main(){localP=position;vec4 view=modelViewMatrix*vec4(position,1.);
      eyeP=view.xyz;gl_Position=projectionMatrix*view;}`,
    fragmentShader: `uniform vec3 tint;varying vec3 localP;varying vec3 eyeP;
    ${hashGL}
    void main(){
      vec3 normal=normalize(cross(dFdx(eyeP),dFdy(eyeP)));
      vec3 p=localP+0.09*vec3(fb(localP*6.),fb(localP*6.+3.),fb(localP*6.+7.));
      float cracks=min(abs(sin(dot(p,vec3(4.4,2.,-1.)))),abs(sin(dot(p,vec3(-2.,5.,3.))+1.)));
      float frost=smoothstep(.46,.70,fb(p*9.));
      float sun=max(0.,dot(normal,normalize(vec3(-.56,.72,.67))));
      float rim=pow(1.-abs(normal.z),2.);
      vec3 ice=tint*mix(.34,.98,fb(p*3.));
      vec3 color=mix(ice,mix(tint,vec3(.93,.97,1.),.48),frost*.68)*(.51+.70*sun);
      color+=mix(tint,vec3(.88,.97,1.),.30)*.75*(1.-smoothstep(.018,.075,cracks)) + rim*tint*.52;
      color+=vec3(.8,.9,1.)*pow(max(0.,dot(normal,normalize(vec3(-.32,.35,.88)))),32.);
      gl_FragColor=vec4(color,1.);
    }`,
  });
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
    update = ice ? iceShelf(scene, earth) : redPlanet(scene, earth);
  const iceMaterials = new Map();
  const mineral = ice ? asteroidMaterial(true) : null,
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
  const plumes =
    world.slug === "umbra-station" ? createPlumes(scene, earth) : null;
  const impacts = plumes ? impactModels(scene) : null;
  const objects = new Map();
  let width, height, portrait;
  return {
    clearWakes() {
      plumes?.clear();
    },
    draw(rocks, t, scars, deployments, bursts, shots, destruction) {
      if (
        width !== overlay.clientWidth ||
        height !== overlay.clientHeight ||
        portrait !== earth.portrait
      ) {
        width = overlay.clientWidth;
        height = overlay.clientHeight;
        renderer.setSize(width, height, false);
        portrait = earth.portrait;
        if (world.slug === "umbra-station") {
          const scale = viewScale(width, height, portrait);
          cam.left = (W - width / scale) / 2;
          cam.right = W - cam.left;
          cam.bottom = (H - height / scale) / 2;
          cam.top = H - cam.bottom;
          cam.updateProjectionMatrix();
        }
      }
      update(
        t,
        scars,
        destruction ? planetVisibility(t - destruction.time) : 1,
      );
      for (const [r, m] of objects)
        if (!rocks.includes(r)) {
          scene.remove(m);
          objects.delete(r);
        }
      for (const r of rocks) {
        let m = objects.get(r);
        if (!m) {
          let material = r.prime ? prime : mineral;
          if (r.orbit) {
            if (!iceMaterials.has(r.value))
              iceMaterials.set(r.value, glacierMaterial(r.tint));
            material = iceMaterials.get(r.value);
          }
          m = new T.Mesh(stones[r.value % 4], material);
          scene.add(m);
          objects.set(r, m);
        }
        m.position.set(r.x, H - r.y, 105);
        m.rotation.set(
          r.value * 0.72 + t * 0.21,
          t * 0.4 + r.vx * 0.02,
          t * 0.14,
        );
        const radius = r.orbit
          ? visibleRadius(r, earth)
          : (r.radius ?? Math.max(12, 26 - r.depth * 4)) *
            (r.prime ? Math.min(1, Math.max(0.02, 2 - r.age)) : 1);
        m.scale.setScalar(radius);
      }
      plumes?.draw(rocks, t);
      impacts?.(deployments, bursts, shots, t);
      renderer.render(scene, cam);
    },
  };
}
