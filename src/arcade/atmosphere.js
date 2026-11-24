import * as T from "three";
import { atmosphereHeight } from "./umbra.js";

export function createAtmosphere(radius) {
  const outerRadius = radius + atmosphereHeight * 1.5;
  return new T.Mesh(
    new T.PlaneGeometry(2 * outerRadius, 2 * outerRadius),
    new T.ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      uniforms: {
        outer: { value: outerRadius / radius },
        seconds: { value: 0 },
        fade: { value: 1 },
      },
      vertexShader: `varying vec2 rayXY; uniform float outer;
        void main(){
          rayXY=(uv*2.-1.)*outer;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: `varying vec2 rayXY; uniform float outer, seconds, fade;
        void main(){
          float r2=dot(rayXY,rayXY);
          if(r2<1. || r2>=outer*outer) discard;
          // Outside the limb the ray crosses both sides of the shell.
          float front=sqrt(outer*outer-r2);
          float stride=2.*front/14.;
          vec3 sun=normalize(vec3(-.78,.50,.52));
          vec3 light=vec3(0.);
          float transmission=1.;
          for(int i=0;i<14;i++){
            vec3 point=vec3(rayXY,front-(float(i)+.5)*stride);
            float h=max(0.,length(point)-1.);
            vec3 normal=normalize(point);
            float day=smoothstep(-.24,.55,dot(normal,sun));
            float wind=dot(normal,vec3(2.7,4.1,1.6))+seconds*.043;
            float wave=sin(wind*3.+sin(wind*2.1-normal.z*5.));
            float altitude=h/(outer-1.);
            float edge=1.-smoothstep(.69,1.,altitude);
            float haze=exp(-altitude*2.45)*(.95+.05*wave);
            float opacity=1.-exp(-stride*haze*.95*edge);
            vec3 sky=mix(vec3(.12,.19,.57),vec3(.24,.52,1.),day);
            vec3 low=mix(vec3(.20,.29,.68),vec3(.34,.69,1.),day);
            vec3 scatter=mix(sky,low,exp(-altitude*5.));
            float crown=exp(-pow((altitude-.18-.022*wave)*14.,2.));
            scatter+=vec3(.08,.12,.23)*crown;
            light+=transmission*opacity*scatter*(.44+.98*day);
            transmission*=1.-opacity;
          }
          float alpha=1.-transmission;
          // Concentrate the brightest scattering at the visible limb, with a
          // softer shoulder that blends into the wide, transparent outer haze.
          float altitude=(sqrt(r2)-1.)/(outer-1.);
          float rim=.65*exp(-altitude*32.)+.16*exp(-altitude*7.);
          float day=smoothstep(-.45,.55,dot(normalize(rayXY),sun.xy));
          vec3 rimColor=mix(vec3(.16,.31,.87),vec3(.42,.78,1.),day);
          float outAlpha=1.-(1.-.38*alpha)*(1.-.70*rim);
          vec3 color=.38*light+rim*rimColor*.66;
          if(outAlpha<.003) discard;
          gl_FragColor=fade*vec4(min(color,vec3(outAlpha)),outAlpha);
        }`,
    }),
  );
}
