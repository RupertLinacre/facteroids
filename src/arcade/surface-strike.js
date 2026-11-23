// Use the remaining rock in this branch of the factor tree. The same scale
// drives the airborne cloud, ballistic fragments, crater and bass transient.
export function surfaceStrike(rock, angle) {
  const strength = (rock.radius / 21) ** 1.15 / (1 + 0.14 * rock.depth);
  const tangentSpeed = -Math.sin(angle) * rock.vx + Math.cos(angle) * rock.vy;
  const bias = tangentSpeed / (Math.hypot(rock.vx, rock.vy) || 1);
  return {
    strength,
    bias,
    extent: 112 * strength ** 0.84,
    crater: 24 * strength ** 0.8,
    count: Math.round(18 + 58 * strength),
    duration: 1.65 + 1.02 * strength,
  };
}

// The x-axis points out of the surface. A thermal flash gives way to a
// downrange curtain and rolling dust. The base surge hugs the local limb.
export const surfaceStrikeShader = `
varying vec2 p;
uniform float age, seed, lifetime, bias;
float hash(vec2 q){vec3 b=fract(vec3(q.xyx)*.1031);b+=dot(b,b.yzx+33.33);return fract((b.x+b.y)*b.z);}
float grain(vec2 q){
  vec2 i=floor(q),u=fract(q);u=u*u*(3.-2.*u);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),u.x),u.y);
}
float clouds(vec2 q){return .52*grain(q)+.28*grain(2.1*q+3.)+.14*grain(4.3*q-6.)+.06*grain(8.7*q);}
void main(){
  float t=age/lifetime, lift=1.-exp(-5.*t);
  vec2 q=vec2(p.x,p.y+bias*.32*p.x);
  vec2 flow=q*6.8+vec2(seed-age*.65,seed*.2);
  flow+=vec2(grain(flow*.7),grain(flow*.7+3.1))*.85;
  float noise=clouds(flow);
  float detail=clouds(flow*2.7+noise*2.);
  float slope=noise-clouds(flow+vec2(.21,.17));
  float ragged=(noise-.5)*.38+(detail-.5)*.09;
  float plume=5.;
  for(int i=0;i<7;i++){
    float k=float(i), a=(k-3.)*.31+.09*sin(seed+k*3.);
    float reach=(.64+.29*hash(vec2(k,seed)))*lift;
    vec2 u=vec2(cos(a),sin(a)), v=vec2(-u.y,u.x);
    float axial=dot(q,u), lateral=dot(q,v);
    float width=.038+.12*lift+.045*hash(vec2(seed,k));
    vec2 lobe=vec2((axial-reach*.64)/(.075+reach*.56),lateral/width);
    plume=min(plume,length(lobe));
    // Billowing heads roll off the ejecta cone as its narrow fingers slow.
    vec2 head=q-u*reach*.82;
    head.y+=.025*sin(k*4.+seed+t*2.)*lift;
    float headRadius=(.105+.087*hash(vec2(k+2.,seed)))*lift;
    plume=min(plume,length(head)/(.012+headRadius));
  }
  float curtain=(1.-smoothstep(.66,1.08,plume+ragged*3.))*smoothstep(0.,.055,t);
  // Low, wide dust front spreads out along the ground beneath the rising rock.
  vec2 foot=vec2((q.x+.08*q.y*q.y-.038)/(.055+.13*lift),q.y/(.11+.84*lift));
  float surge=1.-smoothstep(.66,1.06,length(foot)+ragged);
  float density=max(curtain,surge)*smoothstep(-.18,.015,q.x+.18*q.y*q.y)
               *(1.-smoothstep(.46,1.,t));
  float heat=exp(-age*1.8)*exp(-length(q)*1.7);
  float relief=clamp(.38+2.3*(noise-.43)+2.9*slope+.64*(detail-.5),0.,1.);
  vec3 dust=mix(vec3(.12,.085,.092),vec3(.78,.55,.40),relief);
  float backlight=exp(-2.7*abs(plume-.85+ragged))*smoothstep(.27,.74,noise);
  dust+=vec3(.29,.16,.07)*backlight;
  dust=mix(dust,vec3(.99,.40,.09),min(1.,1.55*heat)*(.33+.55*relief));
  float dist=length(p);
  float core=exp(-dot(q,q*vec2(1.2,1.6))/(.006+.088*lift))*exp(-age*3.);
  float curtainFire=curtain*exp(-11.*abs(plume-.76+ragged))*exp(-age*2.8);
  float flash=exp(-dist*dist/.067)*exp(-age*9.);
  float halo=exp(-dist*4.5)*exp(-age*4.);
  vec3 emission=vec3(1.,.77,.38)*flash*2.4+vec3(1.,.33,.055)*(core*1.35+curtainFire)+vec3(1.,.59,.23)*halo;
  emission=1.-exp(-emission*2.);
  float a=max(density,max(emission.r,max(emission.g,emission.b)));
  if(a<.004)discard;
  gl_FragColor=vec4(min(vec3(a),dust*density+emission),a);
}`;
