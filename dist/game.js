import {installTouchControls} from './touch-controls.js';
import {createStationScreens} from './station-screens.js';
import {solarPosition,brusselsMinutes} from './solar-time.js';
import {disposeScene} from './dispose-scene.js';
import {ActorGrid} from './actor-grid.js';
import {createNightLighting} from './night-lighting.js';
import {npcPopulation} from './npc-population.js';
import {JunctionReservations} from './junction-reservations.js';
import {vehicleFleet,safeVehicleExit} from './vehicle-access.js';
import {streamingBenchmark} from './streaming-benchmark.js';
import {angleDelta} from './npc-steering.js';
import {buildRoadControls,signFactor,legalSpeed} from './npc-road-rules.js';
import {buildNavigation,NpcNavigation} from './npc-navigation.js';
import {hullBlocked,sweepMove,vehicleMoveBlocked,vehicleOverlap,shouldYieldSpace} from './movement-collision.js';
import {prepareDistanceDetail} from './distance-detail.js';
import {vehicleModel,carPaints} from './cc0-assets.js';
import {T,city,stationPlatforms,box,Hash,clamp,pick,inside,height,groundHeight,surface,waterCrossing,railHeight,signalPhase,trafficSignalControls,wet,buildingAt,roads,nearest,isPath,roadWidth,makeWorldAsync,landmarks} from './world.js';

const $=id=>document.getElementById(id);
const root=$('world'), intro=$('intro'), start=$('start');
document.body.classList.add('menu');
let renderer;
try{
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
}catch(error){
  start.textContent='WebGL is unavailable';
  throw error;
}
root.append(renderer.domElement);
renderer.setPixelRatio(Math.min(1.65,devicePixelRatio));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.03;
renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();
scene.background=new T.Color('#b9cdd9');
scene.fog=new T.FogExp2('#b9cdd9',.00175);
const camera=new T.PerspectiveCamera(55,1,.14,2200);
const hemi=new T.HemisphereLight('#e1edf5','#727b78',1.6);
const sun=new T.DirectionalLight('#fff3e2',2.65);
sun.castShadow=true;
const shadowRadius=220;
const shadowResolution=Math.min(4096,renderer.capabilities.maxTextureSize);
sun.shadow.mapSize.set(shadowResolution,shadowResolution);
sun.shadow.camera.left=-shadowRadius;sun.shadow.camera.right=shadowRadius;
sun.shadow.camera.top=shadowRadius;sun.shadow.camera.bottom=-shadowRadius;
sun.shadow.camera.near=20;sun.shadow.camera.far=1000;
sun.shadow.normalBias=.08;sun.shadow.bias=-.00008;sun.shadow.radius=2;
sun.shadow.camera.updateProjectionMatrix();
scene.add(hemi,sun,sun.target);
const skyMaterial=new T.ShaderMaterial({
  uniforms:{zenith:{value:new T.Color('#719bbd')},horizon:{value:new T.Color('#b9cdd9')},skyTime:{value:0},daylight:{value:1},solar:{value:new T.Vector3(0,1,0)}},
  vertexShader:`varying vec3 ray;void main(){ray=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 zenith,horizon,solar;uniform float skyTime,daylight;varying vec3 ray;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec3 d=normalize(ray);vec3 col=mix(horizon,zenith,pow(max(0.,d.y),.6));
vec2 p=d.xz/max(.15,d.y)*2.+vec2(skyTime*.004,skyTime*.001);
float n=noise(p)*.57+noise(p*2.03)*.28+noise(p*4.11)*.15;
float cloud=smoothstep(.49,.72,n)*smoothstep(.02,.18,d.y);
col=mix(col,mix(vec3(.20,.24,.31),vec3(.91,.92,.91),daylight),cloud*.72);
float sun=dot(d,solar);col+=vec3(1.,.78,.45)*smoothstep(.9997,.99997,sun)*daylight*(1.-cloud);
col+=vec3(.24,.13,.05)*pow(max(0.,sun),90.)*daylight*(1.-cloud);
vec2 starUV=vec2(atan(d.z,d.x),asin(d.y))*450.;vec2 cell=floor(starUV);float star=step(.997,hash(cell))*pow(max(0.,1.-length(fract(starUV)-.5)*2.),8.);
col+=vec3(star)*(1.-daylight)*(1.-cloud)*smoothstep(0.,.2,d.y);
gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>
}`,
  side:T.BackSide,depthWrite:false,toneMapped:false,fog:false
});
const skyDome=new T.Mesh(new T.SphereGeometry(850,24,12),skyMaterial);skyDome.renderOrder=-100;scene.add(skyDome);
const view=new T.Vector3(), look=new T.Vector3();
const loading=document.createElement('div');
loading.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;background:#182b29;color:#f0ead8;padding:14px 22px;border-radius:8px;font:14px system-ui;min-width:260px';
const loadingLabel=document.createElement('div'),loadingBar=document.createElement('progress');loadingBar.max=1;loadingBar.style.cssText='width:100%;margin-top:8px;accent-color:#e7c850';loading.append(loadingLabel,loadingBar);document.body.append(loading);
const loadingNames={buildRail:'Spoorwegen',buildStationRetainingWall:'Keermuren',buildRoads:'Straten en fietspaden','buildStationRetainingWall final':'Spoorbogen',buildCycleUnderpass:'Fietstunnels',buildSintAnnaGear:'Sint-Annabrug',buildRoadRetainingWalls:'Wegconstructies',buildMedians:'Middenbermen',water:'Waterlopen',buildTerrain:'Terrein',buildRetainingShoulders:'Bermen',buildGreens:'Groenzones',buildParking:'Parkeerplaatsen',buildings:'Gebouwen',storefronts:'Winkels en ingangen',props:'Bomen en straatmeubilair'};
const world=await makeWorldAsync(scene,(category,fraction)=>{loadingLabel.textContent=loadingNames[category]||category;loadingBar.value=fraction;});
loading.remove();
const stationScreens=createStationScreens({T,scene,city,height,platforms:stationPlatforms,solids:world.solids});
// GPU distance culling is independent of simulation/collision state. Tall
// landmark batches retain a much wider range than ordinary city detail.
const staticCityChunks=new Map();
const registerCityMesh=mesh=>{
  if(!mesh.isMesh||!mesh.userData.staticCityBatch)return;
  mesh.geometry.computeBoundingBox();
  if(mesh.isInstancedMesh)mesh.computeBoundingSphere();
  const bounds=mesh.geometry.boundingBox,sphere=mesh.isInstancedMesh?mesh.boundingSphere:mesh.geometry.boundingSphere;
  const tall=mesh.userData.landmarkVisual||(!mesh.userData.streamedVisual&&bounds.max.y-height(sphere.center.x,sphere.center.z)>24);
  prepareDistanceDetail(T,mesh,mesh.userData.parkedVehicles?3:tall);
  const range=mesh.userData.parkedVehicles?450:tall?1800:850;
  staticCityChunks.set(mesh,{mesh,sphere,range});
  // Prefetched geometry must not enter the renderer before the next culling tick.
  const dx=sphere.center.x-camera.position.x,dz=sphere.center.z-camera.position.z;
  mesh.visible=dx*dx+dz*dz<(range+sphere.radius)**2;
};
scene.traverse(registerCityMesh);
scene.userData.registerCityMesh=registerCityMesh;
scene.userData.unregisterCityMesh=mesh=>staticCityChunks.delete(mesh);
let lastChunkVisibility=-Infinity;
function updateChunkVisibility(t){
  if(t-lastChunkVisibility<.25)return;lastChunkVisibility=t;
  for(const {mesh,sphere,range} of staticCityChunks.values()){
    if(!mesh.parent)continue;
    const dx=sphere.center.x-camera.position.x,dz=sphere.center.z-camera.position.z;
    const limit=range+sphere.radius;mesh.visible=!mesh.userData.takenVehicle&&dx*dx+dz*dz<limit*limit;
    if(mesh.userData.parkedVehicles)mesh.castShadow=dx*dx+dz*dz<(160+sphere.radius)**2;
  }
}

function mesh(group,geometry,color,x,y,z,options={}){
  const material=new T.MeshLambertMaterial({color,...options});
  const m=new T.Mesh(geometry,material);
  m.position.set(x,y,z);
  group.add(m);
  return m;
}
function cube(group,color,x,y,z,w,h,d,options){
  return mesh(group,new T.BoxGeometry(w,h,d),color,x,y,z,options);
}
let carVariant=0;
function carModel(color,player=false){
  const names=['sedan','suv','hatchback-sports','van'];
  const model=vehicleModel(player?'sedan':names[carVariant++%names.length],color);
  model.g.traverse(o=>{if(o.isMesh){o.castShadow=player;o.receiveShadow=true;}});
  scene.add(model.g);return model;
}
function personModel(shirt,player=false){
  const g=new T.Group(),legs=[],arms=[];
  cube(g,shirt,0,1.27,0,.47,.53,.31);
  cube(g,'#cca785',0,1.68,0,.28,.31,.29);
  cube(g,'#574b42',0,1.83,-.025,.28,.115,.28);
  for(const x of [-.14,.14]){
    const leg=new T.Group();
    leg.position.set(x,1.03,0);
    cube(leg,'#3c474a',0,-.34,0,.17,.7,.18);
    cube(leg,'#282d2b',0,-.71,.047,.19,.17,.25);
    g.add(leg);legs.push(leg);
    const arm=new T.Group();
    arm.position.set(x*2.05,1.45,0);
    cube(arm,shirt,0,-.14,0,.13,.31,.17);
    cube(arm,'#cca785',0,-.33,0,.115,.14,.125);
    g.add(arm);arms.push(arm);
  }
  if(player) g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  const restHeights=g.children.map(child=>child.position.y);
  const person={g,legs,arms,restHeights};
  stepPerson(person,0,0);
  scene.add(g);
  return person;
}
function stepPerson(person,phase,amount){
  const s=Math.sin(phase)*amount;
  person.legs[0].rotation.x=s;person.legs[1].rotation.x=-s;
  person.arms[0].rotation.x=-s*.72;person.arms[1].rotation.x=s*.72;
  // Anchor the lowest shoe sole to the sampled walking surface, including
  // the toe/heel movement around each hip during the stride.
  const sole=Math.min(...person.legs.map(leg=>{
    const a=leg.rotation.x;
    return 1.03-.795*Math.cos(a)-Math.max(-.078*Math.sin(a),.172*Math.sin(a));
  }));
  person.g.children.forEach((child,i)=>{child.position.y=person.restHeights[i]-sole;});
}
let car=carModel('#d9a94b',true);
const playerShirt='#6d8b72';
const player=personModel(playerShirt,true);
player.g.visible=true;
const spawn=new URLSearchParams(location.search).has('leopoldqa')?{x:759,z:-510,a:.3}:new URLSearchParams(location.search).has('haringqa')?{x:-546,z:1130,a:-.4}:new URLSearchParams(location.search).has('junctionqa')?{x:877,z:538,a:.12}:{x:-239,z:3,a:-1.93};
const state={...spawn,v:0,y:surface(spawn.x,spawn.z),driving:false,cycling:false,camera:0,lookYaw:0,lookPitch:0};
const parked={...spawn};
const starterVisual=car.g;
vehicleFleet.register({id:'starter',kind:'car',model:'sedan',tint:'#d9a94b',...spawn,y:state.y},hidden=>{starterVisual.visible=!hidden;});
state.x-=Math.cos(spawn.a)*1.8;state.z+=Math.sin(spawn.a)*1.8;
let occupiedVehicle=null;
function setCar(model,x,y,z,angle){
  model.g.position.set(x,y,z);
  model.g.rotation.y=angle;
}
function path(points){
  const lengths=[];
  let total=0;
  for(let i=1;i<points.length;i++){
    total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    lengths.push(total);
  }
  return {points,lengths,total};
}
function pathAt(route,distance){
  const d=clamp(distance,0,route.total-.00001);
  let i=route.lengths.findIndex(v=>v>d);
  if(i<0)i=route.lengths.length-1;
  const start=route.lengths[i-1]||0;
  const [ax,az]=route.points[i],[bx,bz]=route.points[i+1],t=(d-start)/(route.lengths[i]-start);
  return [ax+(bx-ax)*t,az+(bz-az)*t,Math.atan2(bx-ax,bz-az)];
}
function linkRoutes(features){
  const byEnd=new Map(), used=new Set(), results=[];
  const key=p=>p.join(',');
  for(const f of features) for(const p of [f.p[0],f.p.at(-1)]){
    const k=key(p);
    if(!byEnd.has(k)) byEnd.set(k,[]);
    byEnd.get(k).push(f);
  }
  for(const f of features){
    if(used.has(f)) continue;
    used.add(f);
    let p=f.p.slice();
    for(const side of [0,1]){
      if(side)p.reverse();
      for(;;){
        const k=key(p.at(-1));
        const other=byEnd.get(k)?.find(x=>!used.has(x));
        if(!other) break;
        used.add(other);
        const next=key(other.p[0])===k?other.p:other.p.slice().reverse();
        p.push(...next.slice(1));
      }
    }
    if(p.length>1) results.push(path(p));
  }
  return results;
}
const vehicles=carPaints;
const navigation=new NpcNavigation(buildNavigation(city,{height,roadWidth}),4301);
const traffic=navigation.spawn('car',npcPopulation.car).map((nav,i)=>{
  const a={...carModel(vehicles[i%vehicles.length]),nav,rate:nav.rate,placed:true};
  setCar(a,nav.x,nav.y,nav.z,nav.a);return a;
});
const walkers=navigation.spawn('walk',npcPopulation.walk).map((nav,i)=>({
  ...personModel(['#ae6255','#627987','#c09253','#627a58','#8b6781','#aeb496','#4e5b67','#ccbf9d'][i%8]),nav,seed:i
}));
function bicycleModel(tint,shirt=tint){
  const g=new T.Group(),wheels=[];
  const wheel=new T.TorusGeometry(.32,.036,4,12);
  for(const z of [-.6,.6]){
    const w=mesh(g,wheel,'#343b3c',0,.34,z);w.rotation.y=Math.PI/2;
    const hub=mesh(g,new T.CylinderGeometry(.06,.06,.13,7),'#929d9a',0,.34,z);
    hub.rotation.z=Math.PI/2;
    wheels.push(w);
  }
  const beam=(color,a,b,width)=>{
    const delta=new T.Vector3(...b).sub(new T.Vector3(...a)),mid=new T.Vector3(...a).lerp(new T.Vector3(...b),.5);
    const part=mesh(g,new T.CylinderGeometry(width,width,delta.length(),5),color,mid.x,mid.y,mid.z);
    part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  };
  const seat=[0,.88,-.26], crank=[0,.33,-.14],front=[0,.77,.41];
  for(const [a,b] of [[[0,.34,-.6],seat],[seat,front],[front,crank],[crank,[0,.34,-.6]],[seat,crank],[front,[0,.34,.6]],[front,[0,.99,.43]]])beam(tint,a,b,.031);
  cube(g,'#333d3c',0,.9,-.27,.24,.075,.25);
  cube(g,'#495351',0,.99,.45,.48,.07,.06);
  const bikeParts=new Set(g.children);
  const rider=cube(g,shirt,0,1.18,-.115,.4,.53,.28);
  rider.rotation.x=.49;
  cube(g,'#c39f7f',0,1.52,.04,.22,.25,.225);
  cube(g,'#e0ddc4',0,1.645,.04,.28,.12,.27);
  for(const side of [-1,1]){
    beam(shirt,[side*.17,1.32,-.04],[side*.20,1.01,.45],.049);
    beam('#475357',[side*.15,1.01,-.21],[side*.13,.68,-.015],.063);
    beam('#475357',[side*.13,.68,-.015],[side*.12,.43,-.17],.056);
  }
  scene.add(g);
  return {g,wheels,riderParts:g.children.filter(o=>!bikeParts.has(o))};
}
const cyclists=navigation.spawn('bike',npcPopulation.bike).map((nav,i)=>{
  const model=bicycleModel(['#c5654d','#7b9380','#7290a2','#c5a658'][i%4]);
  if(i<24&&navigation.graph.deliveryGoals.pickup.some(g=>navigation.graph.nodes[g.node].component===navigation.graph.nodes[nav.node].component)&&navigation.graph.deliveryGoals.dropoff.some(g=>navigation.graph.nodes[g.node].component===navigation.graph.nodes[nav.node].component)){nav.delivery=true;nav.deliveryPhase='pickup';
    const color=i%2?'#30a35b':'#f18025';
    cube(model.g,'#343b3c',0,.87,-.64,.48,.055,.48);
    cube(model.g,color,0,1.12,-.64,.48,.46,.46);
    cube(model.g,color,0,1.36,-.64,.51,.045,.49);
    cube(model.g,'#e2e6d7',0,1.1,-.877,.34,.06,.012);
  }
  return {...model,nav};
});
// Interleave initial route requests: no mode waits behind every car in the city.
const initialQueues=['car','walk','bike'].map(mode=>navigation.queue.filter(a=>a.mode===mode));
navigation.queue=[];
for(let i=0;i<Math.max(...initialQueues.map(q=>q.length));i++)for(const q of initialQueues)if(q[i])navigation.queue.push(q[i]);
const junctionReservations=new JunctionReservations();
const roadControls=new Hash();
for(const control of buildRoadControls(city)){const [x,z]=control.p;roadControls.insert(control,x-35,z-35,x+35,z+35);}
const lightsOnRoad=new Hash(),crossings=new Hash();
for(const f of trafficSignalControls()){
  const [x,z]=f.p;lightsOnRoad.insert(f,x-19,z-19,x+19,z+19);
}
for(const f of city.crossing||[]){
  if(!f.marked)continue;
  const [x,z]=f.p;crossings.insert(f,x-12,z-12,x+12,z+12);
}
function trafficYield(x,z,angle,y,t){
  const fx=Math.sin(angle),fz=Math.cos(angle);
  let factor=1;
  for(const {p,angle:controlAngle,directed} of lightsOnRoad.get(x,z)){
    const alignment=Math.cos(angle-controlAngle);
    if(directed?alignment<.7:Math.abs(alignment)<.7)continue;
    const dx=p[0]-x,dz=p[1]-z;
    const ahead=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx);
    if(ahead<1.8||ahead>18||lateral>4.1||Math.abs(surface(...p)-y)>2.2)continue;
    if(signalPhase(t,controlAngle)!==2)factor=Math.min(factor,clamp((ahead-4.3)/11,0,1));
  }
  for(const {p} of crossings.get(x,z)){
    const dx=p[0]-x,dz=p[1]-z;
    const ahead=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx);
    if(ahead<1.5||ahead>11||lateral>3.3)continue;
    if(walkers.some(a=>Math.hypot(a.nav.x-p[0],a.nav.z-p[1])<2.4)){
      factor=Math.min(factor,clamp((ahead-3.2)/7,0,1));
    }
  }
  return factor;
}
const trainRoutes=linkRoutes(city.rail.filter(r=>!r.s)).sort((a,b)=>{
  const rank=r=>r.points.some(p=>Math.hypot(p[0]+239,p[1]+500)<70)?r.total:0;
  return rank(b)-rank(a);
});
const trainRoute=trainRoutes[0];
const train=[];
for(let i=0;i<4&&trainRoute;i++){
  const g=new T.Group();
  cube(g,'#dfded0',0,1.74,0,2.9,2.5,14.5);
  cube(g,'#4a5354',0,3,0,2.78,.18,14.32);
  cube(g,'#284b5c',0,2.14,0,2.94,.73,13.88);
  cube(g,'#b44c4c',0,.71,0,2.94,.29,14.66);
  cube(g,'#e7bf65',0,1.28,7.28,2.68,1.18,.14);
  for(const z of [-4.8,-2.5,0,2.5,4.8]) cube(g,'#d2d5c7',0,2.15,z,2.97,.76,.14);
  scene.add(g);train.push(g);
}
const markerGeometry=new T.OctahedronGeometry(.48,0);
const markers=landmarks.map(p=>{
  const m=new T.Mesh(markerGeometry,new T.MeshBasicMaterial({color:'#ffd45c'}));
  m.position.set(p.x,height(p.x,p.z)+3,p.z);
  scene.add(m);return m;
});
const progress=$('progress');
const ticks=landmarks.map(()=>progress.appendChild(document.createElement('i')));
const visited=new Set();
function visit(){
  let near=null,d=Infinity;
  for(const [i,p] of landmarks.entries()){
    const r=Math.hypot(p.x-state.x,p.z-state.z);
    if(r<d){d=r;near=p;}
    if(r<13&&!visited.has(i)){
      visited.add(i);ticks[i].classList.add('found');markers[i].material.color.set('#8cb894');
      notify(p.name+' · '+p.info,6300);
    }
  }
  $('landmark').textContent=d<100?near.name:'Dendervallei';
  $('hint').textContent=visited.size===landmarks.length?'Alle herkenningspunten bezocht':visited.size+' / '+landmarks.length+' herkenningspunten bezocht';
}
const keys=new Set(), aliases={ArrowUp:'KeyW',ArrowDown:'KeyS',ArrowLeft:'KeyA',ArrowRight:'KeyD'};
const solarDate=new Date();solarDate.setUTCHours(12,0,0,0);
let simulatedTime=solarDate.getTime(),solarTick=-1;
const sunDirection=new T.Vector3(-248,368,220).normalize();
let started=false,paused=true,mapOpen=false,night=false,mute=true,elapsed=0,toastTimer=0;
let audio,osc,volume;
function notify(message,ms=2400){
  $('toast').textContent=message;$('toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),ms);
}
function toggleSound(){
  mute=!mute;
  $('sound').textContent=mute?'♫':'♪';
  $('sound').setAttribute('aria-pressed',String(!mute));
  if(!mute&&!audio&&window.AudioContext){
    audio=new AudioContext();
    osc=audio.createOscillator();osc.type='triangle';osc.frequency.value=40;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=132;
    volume=audio.createGain();volume.gain.value=0;osc.connect(filter);filter.connect(volume);volume.connect(audio.destination);osc.start();
  }
  if(!mute)audio?.resume();
}
function toggleDay(){
  const d=new Date(simulatedTime);d.setUTCHours(night?12:22,0,0,0);simulatedTime=d.getTime();solarTick=-1;
}
const daylightColor=new T.Color(),nightSky=new T.Color('#101b31'),daySky=new T.Color('#719bbd');
function updateSolar(time){
  solarTick=time;
  const p=solarPosition(simulatedTime),alt=p.altitude*180/Math.PI;
  const daylight=T.MathUtils.smoothstep(alt,-8,12);
  night=alt<-3;
  skyMaterial.uniforms.daylight.value=daylight;
  skyMaterial.uniforms.skyTime.value=time;
  skyMaterial.uniforms.solar.value.set(p.x,p.y,p.z);
  sunDirection.set(p.x,p.y,p.z);
  // Below the horizon use a dim, fixed fill direction, not an inverted sun.
  if(alt<0)sunDirection.set(-.45,.65,.35).normalize();
  daylightColor.copy(nightSky).lerp(daySky,daylight);
  skyMaterial.uniforms.zenith.value.copy(daylightColor);
  skyMaterial.uniforms.horizon.value.set('#293c50').lerp(new T.Color('#b9cdd9'),daylight);
  const dusk=Math.max(0,1-Math.abs(alt-1)/10);
  skyMaterial.uniforms.horizon.value.lerp(new T.Color('#d99a79'),dusk*.55);
  scene.background.copy(skyMaterial.uniforms.horizon.value);scene.fog.color.copy(scene.background);
  hemi.intensity=.7+.9*daylight;sun.intensity=alt>0?2.65*T.MathUtils.smoothstep(alt,0,18):.15;
  hemi.color.set('#8ca9de').lerp(new T.Color('#e1edf5'),daylight);
  sun.color.set('#ffd0a1').lerp(new T.Color('#fff3e2'),T.MathUtils.smoothstep(alt,4,25));
  for(const object of scene.userData.nightObjects||[])object.visible=night;
  world.windows.material.emissiveIntensity=.54*(1-daylight);
  world.storefronts.material.emissiveIntensity=.67*(1-daylight);
  world.lamps.material.emissiveIntensity=.3+2.05*(1-daylight);
  $('day').textContent=night?'☾':'☀';$('day').setAttribute('aria-pressed',String(night));
  const minutes=brusselsMinutes(simulatedTime);
  for(const clock of scene.userData.analogClocks||[]){clock.minute.rotation.z=-minutes%60*Math.PI/30;clock.hour.rotation.z=-minutes*Math.PI/360;}
}
function toggleMap(){
  if(!started||paused)return;
  mapOpen=!mapOpen;
  $('map-search').hidden=!mapOpen;
  if(!mapOpen)$('place-query').blur();
  $('map').parentElement.classList.toggle('expanded',mapOpen);
  $('maptoggle').textContent=mapOpen?'↙':'↗';
  $('maptoggle').setAttribute('aria-expanded',String(mapOpen));
  keys.clear();touchInput.clear();
  drawMap();
}
function togglePause(){
  if(mapOpen){toggleMap();return;}
  paused=!paused;
  if(!paused)started=true;
  start.textContent=started?'Verder  →':'Op stap  →';
  intro.hidden=!paused;
  document.body.classList.toggle('menu',paused);
  $('help').setAttribute('aria-label',paused?'Verder spelen':'Pauze en bediening');
  keys.clear();touchInput.clear();
}
function blocked(x,z,previousY,radius=.55){
  if(!inside(x,z,5)) return true;
  const y=surface(x,z,previousY);
  if(wet(x,z)&&!waterCrossing(x,z,previousY))return true;
  if(buildingAt(x,z))return true;
  if(world.solids?.blocked(x,z,y,radius,1.7))return true;
  if(!vehicleFleet.records.get('starter').claimed&&Math.abs(y-surface(spawn.x,spawn.z))<1.7){
    const dx=x-spawn.x,dz=z-spawn.z,cs=Math.cos(spawn.a),sn=Math.sin(spawn.a);
    if(Math.abs(dx*cs-dz*sn)<.87+radius&&Math.abs(dx*sn+dz*cs)<1.94+radius)return true;
  }
  for(const v of vehicleFleet.claimed){
    if(v===occupiedVehicle||Math.abs(y-v.y)>1.7)continue;
    const dx=x-v.x,dz=z-v.z,cs=Math.cos(v.a),sn=Math.sin(v.a),half=v.kind==='bike'?.24:.9,length=v.kind==='bike'?.85:2.05;
    if(Math.abs(dx*cs-dz*sn)<half+radius&&Math.abs(dx*sn+dz*cs)<length+radius)return true;
  }
  for(const {g} of traffic){
    if(state.driving)continue;
    if(!g.visible||Math.abs(y-g.position.y)>1.7) continue;
    const dx=x-g.position.x,dz=z-g.position.z;
    if(Math.hypot(dx,dz)>3.2) continue;
    const cs=Math.cos(g.rotation.y),sn=Math.sin(g.rotation.y);
    if(Math.abs(dx*cs-dz*sn)<.87+radius&&Math.abs(dx*sn+dz*cs)<1.94+radius)return true;
  }
  for(const [dx,dz] of [[radius,0],[-radius,0],[0,radius],[0,-radius]]){
    if(buildingAt(x+dx,z+dz))return true;
  }
  return false;
}
let resetting=false;
async function reset(){
  if(resetting)return;resetting=true;
  const cover=document.createElement('div');cover.style.cssText='position:fixed;inset:0;z-index:3000;background:#182b29;color:#f0ead8;display:grid;place-items:center;font:16px system-ui;transition:opacity .25s';cover.textContent='Terug naar de markt…';document.body.append(cover);
  if(occupiedVehicle){vehicleFleet.leave({x:state.x,y:state.y,z:state.z,a:state.a});occupiedVehicle.visual?.riderParts?.forEach(o=>o.visible=false);occupiedVehicle=null;}
  Object.assign(state,spawn,{x:spawn.x-Math.cos(spawn.a)*1.8,z:spawn.z+Math.sin(spawn.a)*1.8,y:surface(spawn.x,spawn.z),v:0,driving:false,cycling:false});player.g.visible=true;
  view.set(spawn.x,state.y+8,spawn.z+8);look.set(spawn.x,state.y+1,spawn.z);
  while(!(world.visualStream?.ready(spawn.x,spawn.z)??true)||!(world.terrainStream?.ready(spawn.x,spawn.z)??true))await new Promise(resolve=>setTimeout(resolve,16));
  cover.style.opacity='0';setTimeout(()=>cover.remove(),260);resetting=false;
  notify('Terug op de Grote Markt');
}
function switchMode(){
  if(occupiedVehicle){
    if(Math.abs(state.v)>1.25){notify('Stop eerst om uit te stappen');return;}
    const exit=safeVehicleExit({...state,kind:occupiedVehicle.kind},(x,z,y,r)=>!blocked(x,z,y,r)&&!traffic.some(({g})=>{if(Math.abs(g.position.y-y)>1.7)return false;const dx=x-g.position.x,dz=z-g.position.z,cs=Math.cos(g.rotation.y),sn=Math.sin(g.rotation.y);return Math.abs(dx*cs-dz*sn)<.9+r&&Math.abs(dx*sn+dz*cs)<2.05+r;}),surface);
    if(!exit){notify('Geen veilige plek om uit te stappen');return;}
    vehicleFleet.leave({x:state.x,y:state.y,z:state.z,a:state.a});
    occupiedVehicle.visual?.riderParts?.forEach(o=>o.visible=false);
    occupiedVehicle=null;Object.assign(state,exit,{v:0,driving:false,cycling:false});player.g.visible=true;
    notify('Te voet · E om in te stappen');
  }else{
    const v=vehicleFleet.nearest(state,3.2,v=>{
      // A nearby vehicle behind a wall or on another deck is not reachable.
      const distance=Math.hypot(v.x-state.x,v.z-state.z),reach=Math.max(0,distance-(v.kind==='bike'?.65:1.2));
      for(let i=1;i<=Math.ceil(reach/.2);i++){const t=Math.min(reach,i*.2)/Math.max(.001,distance),x=state.x+(v.x-state.x)*t,z=state.z+(v.z-state.z)*t;if(buildingAt(x,z)||(wet(x,z)&&!waterCrossing(x,z,state.y))||world.solids?.blocked(x,z,surface(x,z,state.y),.12,1.7,v))return false;}return true;
    });
    if(!v||!vehicleFleet.enter(v)){notify('Ga dichter bij een vrije auto of fiets staan');return;}
    if(!v.visual){v.visual=v.kind==='bike'?bicycleModel(v.tint,playerShirt):vehicleModel(v.model||'sedan',v.tint);scene.add(v.visual.g);v.visual.g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
    v.visual.riderParts?.forEach(o=>o.visible=true);car=v.visual;occupiedVehicle=v;
    Object.assign(state,{x:v.x,y:v.y,z:v.z,a:v.a,v:0,driving:true,cycling:v.kind==='bike'});
    Object.assign(parked,state);setCar(car,state.x,state.y,state.z,state.a);player.g.visible=false;notify(state.cycling?'Op de fiets':'Achter het stuur');
  }
}
start.addEventListener('click',togglePause);
$('help').addEventListener('click',togglePause);
$('day').addEventListener('click',toggleDay);
$('sound').addEventListener('click',toggleSound);
$('maptoggle').addEventListener('click',toggleMap);
function cycleCamera(){state.lookYaw=0;state.lookPitch=0;state.camera=(state.camera+1)%4;notify(['Volgcamera','Brede camera','Hoge camera','Eerste persoon'][state.camera]);}
const touchInput=installTouchControls({keys,active:()=>started&&!paused&&!mapOpen,look:(dx,dy)=>{state.lookYaw-=dx*.006;state.lookPitch=clamp(state.lookPitch+dy*.006,-.7,.7);},action:name=>({vehicle:switchMode,camera:cycleCamera,map:toggleMap,reset})[name]?.()});
window.addEventListener('keydown',e=>{
  if(e.target===$('place-query')&&e.code!=='Escape')return;
  const k=aliases[e.code]||e.code;
  if(['Space','KeyW','KeyS','KeyA','KeyD'].includes(k)&&!paused)e.preventDefault();
  if(e.repeat)return;
  if(k==='Escape'&&started){togglePause();return;}
  if(!started||paused)return;
  if(k==='KeyM'){toggleMap();return;}
  if(mapOpen)return;
  keys.add(k);
  if(k==='KeyE')switchMode();
  if(k==='KeyR')reset();
  if(k==='KeyC')cycleCamera();
  if(k==='KeyT')toggleDay();
});
window.addEventListener('keyup',e=>keys.delete(aliases[e.code]||e.code));
window.addEventListener('blur',()=>keys.clear());
function move(dt){
  const previousAngle=state.a;
  const turn=Number(keys.has('KeyA'))-Number(keys.has('KeyD'));
  const accel=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const street=nearest(roads,state.x,state.z);
  const paved=street&&street.d<street.width*.5+1.4;
  if(state.driving){
    const max=state.cycling?(paved?8:4.5):(paved?24:12);
    if(accel)state.v+=accel*(accel*state.v<0?16:accel>0?(state.cycling?3:7.8):4.4)*dt;
    else state.v*=Math.pow(.47,dt);
    if(keys.has('Space'))state.v*=Math.pow(.003,dt);
    state.v=clamp(state.v,state.cycling?-2:-6,max);
    if(Math.abs(state.v)<.035)state.v=0;
    state.a+=turn*dt*(state.v<0?-1:1)*Math.min(Math.abs(state.v)*.36,1.5)*clamp(1.3-Math.abs(state.v)/28,.5,1.3);
  }else{
    state.a+=turn*dt*2.55;
    state.v=accel*(keys.has('ShiftLeft')?6.2:3.75);
  }
  const otherCars=traffic.filter(a=>a.placed).map(({g})=>({x:g.position.x,z:g.position.z,y:g.position.y,a:g.rotation.y}));
  const carBlocked=(x,z,angle,from)=>(state.cycling?[-.6,0,.6].some(d=>blocked(x+Math.sin(angle)*d,z+Math.cos(angle)*d,state.y,.19)):hullBlocked(blocked,x,z,state.y,angle,true))||vehicleMoveBlocked(from,{x,z,y:state.y,a:angle},otherCars);
  if(state.driving&&carBlocked(state.x,state.z,state.a,{...state,a:previousAngle}))state.a=previousAngle;
  const dx=Math.sin(state.a)*state.v*dt,dz=Math.cos(state.a)*state.v*dt;
  const hit=sweepMove(state,dx,dz,(x,z)=>state.driving?carBlocked(x,z,state.a,state):hullBlocked(blocked,x,z,state.y,state.a,false));
  if(hit&&state.driving)state.v*=.18;
  state.y=surface(state.x,state.z,state.y);
  if(state.driving){
    Object.assign(parked,{x:state.x,z:state.z,a:state.a});
    setCar(car,state.x,state.y,state.z,state.a);
    if(occupiedVehicle)Object.assign(occupiedVehicle,{x:state.x,y:state.y,z:state.z,a:state.a});
    for(const wheel of car.wheels)wheel.rotation[state.cycling?'z':'x']+=state.v*dt/.345;
  }else{
    player.g.position.set(state.x,state.y,state.z);
    player.g.rotation.y=state.a;
    stepPerson(player,elapsed*10,Math.min(1,Math.abs(state.v)*.24));
  }
}
function actorGround(actor,x,z,y){
  const p=actor.groundSample;
  if(p&&Math.abs(x-p.x)<.2&&Math.abs(z-p.z)<.2&&Math.abs(y-p.y)<.05)return p.h;
  const h=surface(x,z,y);actor.groundSample={x,z,y,h};return h;
}
function actorShadows(actor,x,z){
  const near=Math.hypot(x-camera.position.x,z-camera.position.z)<100;
  if(actor.shadowNear===near)return;
  actor.shadowNear=near;
  actor.g.traverse(o=>{if(o.isMesh){o.castShadow=near;o.receiveShadow=true;}});
}
const nearbyCars=new ActorGrid();
function actors(t,dt){
  if(world.flame){
    world.flame.rotation.y=t*.95;
    world.flame.scale.y=.95+Math.sin(t*7.9)*.15+Math.sin(t*15.3)*.07;
  }
  for(const [axis,group] of world.signals.entries()){
    const phase=signalPhase(t,axis===0?Math.PI/2:0);
    for(let i=0;i<3;i++){group[i].emissiveIntensity=i===phase?1.65:0;group[i].color.setHex([0xff4433,0xffbb33,0x43dd83][i]).multiplyScalar(i===phase?1:.12);}
  }
  navigation.graph.congestion??=new Map();navigation.graph.congestion.clear();
  for(const car of traffic)if((car.nav.stalled||0)>6){
    const edge=car.nav.route[car.nav.edgeIndex];if(edge)navigation.graph.congestion.set(edge.way,9);
  }
  measureStage('routing',()=>navigation.updatePlans(dt));
  let npcStageStart=perfPanel?performance.now():0;
  const npcStage=name=>{if(perfPanel){const now=performance.now();recordStage('npc:'+name,now-npcStageStart);npcStageStart=now;}};
  const parkedY=surface(parked.x,parked.z);
  nearbyCars.clear();
  for(const a of traffic){const p=a.nav;nearbyCars.insert(a,p.x-25,p.z-25,p.x+25,p.z+25);}
  junctionReservations.update(traffic.map(a=>a.nav));
  const claimedObstacles=started?[...vehicleFleet.claimed].map(v=>({x:v.x,z:v.z,y:v.y,a:v.a})):[];
  const starterObstacle=started&&!vehicleFleet.records.get('starter').claimed?{...spawn,y:surface(spawn.x,spawn.z)}:null;
  npcStage('neighbors');
  for(const a of traffic){
    const n=a.nav,{x:u,z:v,y,a:angle}=n;
    const px=parked.x-u,pz=parked.z-v,ahead=px*Math.sin(angle)+pz*Math.cos(angle);
    const lateral=Math.abs(px*Math.cos(angle)-pz*Math.sin(angle));
    const playerFactor=started&&Math.abs(y-parkedY)<1.7&&ahead>0&&lateral<1.65?clamp((ahead-4.5)/9,0,1):1;
    let following=1;
    const neighbors=nearbyCars.get(u,v).filter(b=>b!==a);
    for(const other of neighbors){
      const p=other.nav,dx=p.x-u,dz=p.z-v,ahead=dx*Math.sin(angle)+dz*Math.cos(angle),lateral=Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle));
      if(ahead>0&&ahead<22&&lateral<1.55&&Math.abs(p.y-y)<1.3&&Math.cos(p.a-angle)>.5)following=Math.min(following,clamp((ahead-5.2)/13,0,1));
    }
    const neighborAgents=neighbors.map(b=>b.nav);
    const obstacles=neighborAgents.slice();
    if(started){obstacles.push(...claimedObstacles);if(starterObstacle)obstacles.push(starterObstacle);}
    let lawFactor=Math.min(trafficYield(u,v,angle,y,t),signFactor(n,roadControls.get(n.x,n.z),neighborAgents,dt));
    const reservation=junctionReservations.gate(n,navigation,neighborAgents,lawFactor>.95&&!n.pendingStop);
    // Once admitted, clear the junction even if the light changes during a turn.
    if(reservation.committed)lawFactor=1;
    const factor=Math.min(following,playerFactor,lawFactor,reservation.factor);
    n.stopReason=factor<.05?(following<.05?'following':playerFactor<.05?'player':lawFactor<.05?'signal':'reservation'):'collision';
    const bend=Math.abs(angleDelta(n.a,navigation.pose(n,5).a));
    const speed=Math.min(n.rate,legalSpeed(navigation.graph.nodes[n.node]?.f,'car'),Math.max(2.2,8.5/(1+bend*3)));
    let moved=0;
    n.recoveryCooldown=Math.max(0,(n.recoveryCooldown||0)-dt);
    n.giveSpace=Math.max(0,(n.giveSpace||0)-dt);
    if((n.retreatLeft||0)>0){
      const reverse=navigation.retreat(n,Math.min(dt*.8,n.retreatLeft),(p,from)=>
        !vehicleMoveBlocked(from,p,obstacles)&&!hullBlocked((x,z,y,r)=>world.solids?.blocked(x,z,y,r,1.5),p.x,p.z,p.y,p.a,true));
      moved=-reverse;n.retreatLeft-=reverse;
      if(reverse===0||n.retreatLeft<.02){n.retreatLeft=0;n.giveSpace=2;n.stalled=0;}
    }else if(!n.giveSpace){moved=navigation.advance(n,dt*speed*factor,(p,from)=>!vehicleMoveBlocked(from,p,obstacles));}
    n.stationary=n.route.length&&Math.abs(moved)<dt*.1?(n.stationary||0)+dt:0;
    n.stalled=lawFactor>.95?n.stationary:0;
    n.detourClock=(n.detourClock||0)+dt;
    if(n.detourClock>15&&!reservation.committed){if(n.route.slice(n.edgeIndex+1).some(e=>navigation.graph.congestion.has(e.way)))navigation.requestDetour(n);n.detourClock=0;}
    if(n.stationary>8&&!n.recoveryCooldown){
      n.recoveryCooldown=15; // Rate-limit all recovery attempts, even when reversing is impossible.
      const trapped=neighbors.some(b=>{const other=b.nav,otherOwns=junctionReservations.locks.some(l=>l.id===other.id);
        return shouldYieldSpace(n,other,reservation.committed,otherOwns,navigation.pose(other,.4));
      });
      if(trapped&&n.along>.5){n.retreatLeft=Math.min(3,n.along-.02);n.recoveryCooldown=25;}
      if(n.stalled>8&&!reservation.committed)navigation.requestDetour(n);n.detourClock=0;
    }
    n.speed=dt>0?moved/dt:0;
    a.g.visible=Math.hypot(n.x-camera.position.x,n.z-camera.position.z)<430;
    setCar(a,n.x,a.g.visible?actorGround(a,n.x,n.z,n.y):n.y,n.z,n.a);
    if(a.g.visible){actorShadows(a,n.x,n.z);for(const wheel of a.wheels)wheel.rotation.x+=moved/.345;}
  }
  npcStage('cars');
  const crossingClear=p=>!lightsOnRoad.get(p.x,p.z).some(light=>Math.hypot(light.p[0]-p.x,light.p[1]-p.z)<10&&signalPhase(t,p.a)!==2)&&!nearbyCars.get(p.x,p.z).some(car=>{
    const n=car.nav;if(Math.abs(n.y-p.y)>1.7)return false;
    const dx=p.x-n.x,dz=p.z-n.z,ahead=dx*Math.sin(n.a)+dz*Math.cos(n.a),side=Math.abs(dx*Math.cos(n.a)-dz*Math.sin(n.a));
    return Math.hypot(dx,dz)<2.8||((n.speed||0)>1&&ahead>0&&ahead<10&&side<2);
  });
  for(const a of walkers){
    const n=a.nav,moved=navigation.advance(n,dt*n.rate,p=>p.kind!=='crossing'||crossingClear(p));
    // Pedestrian streets allow people to spread across the surface; inferred
    // sidewalks and marked crossings retain their navigation alignment.
    const pose=navigation.pose(n),spread=pose.kind==='plaza'?Math.sin(n.id*2.4)*1.25:pose.kind==='path'?Math.sin(n.id)*.25:0;
    a.spread=(a.spread||0)+clamp(spread-(a.spread||0),-dt*.8,dt*.8);
    const x=n.x+Math.cos(n.a)*a.spread,z=n.z-Math.sin(n.a)*a.spread;
    a.g.visible=Math.hypot(x-camera.position.x,z-camera.position.z)<300;
    a.g.position.set(x,a.g.visible?actorGround(a,x,z,n.y):n.y,z);a.g.rotation.y=n.a;
    if(a.g.visible){actorShadows(a,x,z);stepPerson(a,t*8+a.seed*9,moved>0?.52:0);}
  }
  npcStage('walkers');
  for(const bike of cyclists){
    const n=bike.nav,kind=navigation.pose(n).kind,rate=kind==='shared'?Math.min(2.8,n.rate):n.rate;
    const factor=kind==='road'||kind==='turn'?Math.min(trafficYield(n.x,n.z,n.a,n.y,t),signFactor(n,roadControls.get(n.x,n.z),nearbyCars.get(n.x,n.z).map(c=>c.nav),dt)):1;
    const moved=navigation.advance(n,dt*rate*factor,p=>p.kind!=='crossing'||crossingClear(p));
    n.speed=dt>0?moved/dt:0;
    bike.g.visible=Math.hypot(n.x-camera.position.x,n.z-camera.position.z)<420;
    bike.g.position.set(n.x,bike.g.visible?actorGround(bike,n.x,n.z,n.y):n.y,n.z);bike.g.rotation.y=n.a;
    if(bike.g.visible){actorShadows(bike,n.x,n.z);for(const wheel of bike.wheels)wheel.rotation.z+=moved/.32;}
  }
  npcStage('bikes');
  for(const [i,g] of train.entries()){
    const d=(t*14+trainRoute.total*.52)%(trainRoute.total+155)-15.2*i;
    if(d<0||d>trainRoute.total){g.visible=false;continue;}
    const [x,z,a]=pathAt(trainRoute,d);
    g.visible=inside(x,z,7);
    g.position.set(x,railHeight(x,z)+.16,z);
    const [frontX,frontZ]=pathAt(trainRoute,d+6),[backX,backZ]=pathAt(trainRoute,d-6);
    g.rotation.order='YXZ';
    g.rotation.set(-Math.atan2(railHeight(frontX,frontZ)-railHeight(backX,backZ),12),a,0);
  }
  for(const [i,m] of markers.entries()){
    m.visible=started&&!paused&&Math.hypot(m.position.x-state.x,m.position.z-state.z)<140;
    m.position.y=height(m.position.x,m.position.z)+2.85+Math.sin(t*2.1+i)*.35;
    m.rotation.y=t*1.2;
  }
}
const map=$('map'),ctx=map.getContext('2d');
const atlas=document.createElement('canvas');
const atlasScale=.56;
atlas.width=Math.ceil((box[2]-box[0])*atlasScale);
atlas.height=Math.ceil((box[3]-box[1])*atlasScale);
const cart=atlas.getContext('2d');
const atlasX=x=>(x-box[0])*atlasScale,atlasZ=z=>(z-box[1])*atlasScale;
function mapPath(p){
  cart.beginPath();
  for(const [i,q] of p.entries()) cart[i?'lineTo':'moveTo'](atlasX(q[0]),atlasZ(q[1]));
}
cart.fillStyle='#344840';cart.fillRect(0,0,atlas.width,atlas.height);
for(const f of city.green||[]){mapPath(f.p);cart.fillStyle='#465d45';cart.fill();}
for(const group of ['factory','hospital','school']){
  for(const f of city[group]||[]){mapPath(f.p);cart.fillStyle=group==='factory'?'#665d4b':'#52664f';cart.fill();}
}
for(const f of city.building){mapPath(f.p);cart.fillStyle='#526057';cart.fill();}
for(const f of city.river||[]){
  mapPath(f.p);cart.strokeStyle='#3a8385';cart.lineWidth=(['river','canal'].includes(f.c)?24:3)*atlasScale;cart.stroke();
}
for(const f of city.water||[]){mapPath(f.p);cart.fillStyle='#3a8385';cart.fill();}
for(const f of city.rail||[]){
  mapPath(f.p);cart.strokeStyle='#ab9b81';cart.lineWidth=1.0;cart.stroke();
}
cart.lineCap='round';cart.lineJoin='round';
for(const f of city.road){
  mapPath(f.p);cart.strokeStyle=f.c==='cycleway'?'#89b6a0':f.c==='pedestrian'?'#a69c80':isPath(f)?'#748277':'#b7b6a0';
  cart.lineWidth=Math.max(.75,roadWidth(f)*atlasScale*.72);cart.stroke();
}
const findPlace=$('place-query'),matches=$('place-results');
const places=(city.place||[]).filter((f,i,a)=>!a.slice(Math.max(0,i-30),i).some(p=>p.n===f.n&&Math.hypot(p.p[0]-f.p[0],p.p[1]-f.p[1])<22));
let highlightedPlace=null;
function fold(value){
  return value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
const placeSearch=places.map(f=>({f,name:fold(f.n),terms:fold(f.n+' '+f.c)}));
findPlace.addEventListener('input',()=>{
  const query=fold(findPlace.value);
  matches.replaceChildren();
  if(!query){
    highlightedPlace=null;
    drawMap();
    return;
  }
  const hits=placeSearch.filter(p=>query.split(' ').every(word=>p.terms.includes(word))).sort((a,b)=>Number(b.name.startsWith(query))-Number(a.name.startsWith(query))||a.name.localeCompare(b.name)).slice(0,7);
  for(const {f} of hits){
    const button=document.createElement('button'),item=document.createElement('li'),type=document.createElement('small');
    button.type='button';button.textContent=f.n;
    type.textContent=f.c.replaceAll('_',' ');
    button.append(type);item.append(button);matches.append(item);
    button.addEventListener('click',()=>{
      highlightedPlace=f;findPlace.value=f.n;
      matches.replaceChildren();drawMap();
    });
  }
});
findPlace.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    e.preventDefault();
    matches.querySelector('button')?.click();
  }
});
function drawMap(){
  const ratio=mapOpen?Math.min(1.85,devicePixelRatio||1):1;
  const width=mapOpen?Math.min(620,window.innerWidth*.73):250;
  const h=mapOpen?Math.min(window.innerHeight*.65,540):186;
  if(map.width!==Math.round(width*ratio)||map.height!==Math.round(h*ratio)){
    map.width=Math.round(width*ratio);map.height=Math.round(h*ratio);
  }
  const w=map.width,mh=map.height;
  ctx.clearRect(0,0,w,mh);
  ctx.fillStyle='#293d36';ctx.fillRect(0,0,w,mh);
  const focus=mapOpen?highlightedPlace:null;
  const zoom=focus?1.85*ratio:mapOpen?Math.min((w-12)/atlas.width,(mh-12)/atlas.height):1.67;
  const ox=focus?w/2-atlasX(focus.p[0])*zoom:mapOpen?(w-atlas.width*zoom)/2:w/2-atlasX(state.x)*zoom;
  const oz=focus?mh/2-atlasZ(focus.p[1])*zoom:mapOpen?(mh-atlas.height*zoom)/2:mh/2-atlasZ(state.z)*zoom;
  ctx.drawImage(atlas,ox,oz,atlas.width*zoom,atlas.height*zoom);
  if(mapOpen){
    ctx.fillStyle='#d2ab71';
    for(const m of city.monument||[]){
      ctx.beginPath();ctx.arc(ox+atlasX(m.p[0])*zoom,oz+atlasZ(m.p[1])*zoom,1.8*ratio,0,Math.PI*2);ctx.fill();
    }
  }
  for(const [i,p] of landmarks.entries()){
    const x=ox+atlasX(p.x)*zoom,z=oz+atlasZ(p.z)*zoom;
    ctx.fillStyle=visited.has(i)?'#a7c498':'#f2cf63';
    ctx.beginPath();ctx.arc(x,z,(mapOpen?4:3)*ratio,0,Math.PI*2);ctx.fill();
    if(mapOpen){
      ctx.font='bold '+Math.round(11*ratio)+'px system-ui';
      const right=x>w*.78,labelX=x+(right?-8:8)*ratio,labelY=z+(i===1?11:-4)*ratio;
      ctx.textAlign=right?'right':'left';ctx.lineWidth=3*ratio;ctx.strokeStyle='#293a33';
      ctx.strokeText(p.name,labelX,labelY);ctx.fillText(p.name,labelX,labelY);
    }
  }
  if(mapOpen&&!focus){
    const areas=[['Mijlbeek',1190,-380],['Zwembadpark',1030,-144],['AZORG Moorselbaan',780,-650],['AZORG Merestraat',-1660,335],['Tereos',216,104],['Kunstacademie',-970,175],['Gentse steenweg',-1480,38]];
    ctx.font='bold '+Math.round(10*ratio)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#c7d5ba';ctx.lineWidth=3*ratio;ctx.strokeStyle='#293a33';
    for(const [label,x,z] of areas){
      const a=ox+atlasX(x)*zoom,b=oz+atlasZ(z)*zoom;
      ctx.strokeText(label,a,b);ctx.fillText(label,a,b);
    }
  }
  if(focus){
    ctx.strokeStyle='#f2cf63';ctx.lineWidth=2.5*ratio;
    ctx.beginPath();ctx.arc(w/2,mh/2,8*ratio,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff2cd';ctx.font='bold '+Math.round(13*ratio)+'px system-ui';ctx.textAlign='center';
    ctx.strokeStyle='#293a33';ctx.lineWidth=4*ratio;
    ctx.strokeText(focus.n,w/2,mh/2-16*ratio);ctx.fillText(focus.n,w/2,mh/2-16*ratio);
  }
  const x=ox+atlasX(state.x)*zoom,z=oz+atlasZ(state.z)*zoom;
  ctx.save();ctx.translate(x,z);ctx.rotate(-state.a+Math.PI);
  ctx.fillStyle='#fff5cf';ctx.strokeStyle='#2b3830';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,-8*ratio);ctx.lineTo(5*ratio,5*ratio);ctx.lineTo(0,2*ratio);ctx.lineTo(-5*ratio,5*ratio);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
  ctx.font='bold 11px monospace';ctx.textAlign='left';ctx.fillStyle='#e7e9d7';ctx.fillText('N ↑',9,16);
}
function updateHUD(){
  const near=nearest(roads,state.x,state.z);
  $('street').textContent=(near?.d<28&&near.f.n)||(state.x>690&&state.z<450?'Mijlbeek':'Aalst');
  $('mode').textContent=state.cycling?'FIETS':state.driving?'AUTO':'TE VOET';
  const aboard=state.driving||state.cycling;
  $('touch-mode').setAttribute('aria-label',aboard?'Uitstappen':'Auto of fiets instappen');
  $('touch-mode').classList.toggle('aboard',aboard);
  $('zone').textContent=near?.d<near.width*.6?({pedestrian:'Pedestrian zone',cycleway:'Cycle path'}[near.f.c]||''):'';
  $('zone').hidden=!$('zone').textContent;
  $('speed').textContent=String(Math.round(Math.abs(state.v)*3.6)).padStart(2,'0');
  const minutes=brusselsMinutes(simulatedTime);
  $('clock').textContent=Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0');
  visit();
  drawMap();
}
function resize(){
  const w=root.clientWidth,h=root.clientHeight;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  drawMap();
}
window.addEventListener('resize',resize);
resize();
function updateCamera(dt,t){
  const firstPerson=started&&state.camera===3;
  for(const v of vehicleFleet.claimed)if(v.visual)v.visual.g.visible=Math.hypot(v.x-camera.position.x,v.z-camera.position.z)<450&&!(v===occupiedVehicle&&firstPerson);
  player.g.visible=!state.driving&&!firstPerson;
  if(!started){
    const x=-224+Math.sin(t*.145)*6,z=36+Math.cos(t*.145)*6;
    camera.position.set(x,height(x,z)+23,z);
    camera.lookAt(-274, height(-274,-27)+11,-26);
    view.copy(camera.position);look.set(-274,height(-274,-27)+11,-26);
  }else if(firstPerson){
    const {x,z,a,y}=state,fx=Math.sin(a+state.lookYaw),fz=Math.cos(a+state.lookYaw);
    const eye=state.driving?1.32:1.68;
    camera.position.set(x,y+eye,z);
    camera.lookAt(x+fx*20,y+eye-.15-state.lookPitch*20,z+fz*20);
    view.copy(camera.position);look.set(x+fx*20,y+eye-.15-state.lookPitch*20,z+fz*20);
  }else{
    const {x,z,a,y}=state;
    const dist=state.camera===2?7.6:state.camera===1?12.5:state.driving?8.3:4.5;
    const lift=state.camera===2?13.5:state.camera===1?6:state.driving?4.1:2.85;
    const fx=Math.sin(a+state.lookYaw),fz=Math.cos(a+state.lookYaw);
    let cx=x-fx*dist,cz=z-fz*dist;
    for(let k=1;k<6;k++){
      const t=k/5,px=x+(cx-x)*t,pz=z+(cz-z)*t;
      if(y+1.7+lift*t<groundHeight(px,pz)+.4||buildingAt(px,pz)){
        cx=x+(px-x)*.7;cz=z+(pz-z)*.7;
        break;
      }
    }
    const desired=new T.Vector3(cx,Math.max(y+lift+state.lookPitch*6,groundHeight(cx,cz)+2.3),cz);
    if(view.distanceTo(desired)>45)view.copy(desired);
    else view.lerp(desired,1-Math.exp(-dt*9.4));
    look.lerp(new T.Vector3(x+fx*(state.driving?4.7:1.7),y+(state.driving?1.16:1.42),z+fz*(state.driving?4.7:1.7)),1-Math.exp(-dt*11));
    camera.position.copy(view);camera.lookAt(look);
  }
  skyDome.position.copy(camera.position);
  const anchor=started?state:{x:-267,z:-13};
  // Lead the view so the full street ahead stays inside the shadow volume.
  const forward=new T.Vector3();camera.getWorldDirection(forward);
  const x=anchor.x+forward.x*48,z=anchor.z+forward.z*48,y=groundHeight(anchor.x,anchor.z);
  // The sun basis rotates continuously during the accelerated day. Rounding
  // its coordinates to texels made the entire projection jump periodically.
  // Keep its origin continuous; soft PCF interpolates sub-texel coverage.
  const target=new T.Vector3(x,y,z);
  sun.target.position.copy(target);
  sun.position.copy(target).addScaledVector(sunDirection,500);

}
// Reuse a small nearby pool: mapped lamp heads cast warm downward cones
// without adding hundreds of dynamic lights to every shader.
const streetLights=Array.from({length:6},()=>{
  const light=new T.SpotLight('#ffe1a1',0,19,Math.PI*.32,.65,2);
  light.castShadow=false;scene.add(light,light.target);return light;
});
const nightLighting=createNightLighting(T,scene,surface);
const movingLightActors=[...traffic.map(a=>({g:a.g,bike:false})),...cyclists.map(a=>({g:a.g,bike:true}))];
const playerLightActor={g:car.g,bike:false};
const occupiedLightActors=[...movingLightActors,playerLightActor];
let lastLampUpdate=-1,lastLightFrame=0,selectedLamps=[];
function updateStreetLights(t){
  const dt=Math.min(.05,Math.max(0,t-lastLightFrame));lastLightFrame=t;
  if(!night){for(const light of streetLights)light.intensity=0;return;}
  if(t-lastLampUpdate>=.35){
    lastLampUpdate=t;
    selectedLamps=world.lampPositions.map(p=>({p,d:(p[0]-state.x)**2+(p[2]-state.z)**2}))
      .filter(v=>v.d<230**2).sort((a,b)=>a.d-b.d).slice(0,streetLights.length).map(v=>v.p);
  }
  for(const light of streetLights){
    const p=light.userData.source,retained=p&&selectedLamps.includes(p);
    const distance=p?Math.hypot(p[0]-state.x,p[2]-state.z):230;
    const target=retained?40*Math.min(1,Math.max(0,(230-distance)/90)):0;
    light.intensity+=(target-light.intensity)*Math.min(1,dt*2);
    // Fade before reassigning: never teleport a fully lit cone to a new lamp.
    if(!retained&&light.intensity<.1){
      const next=selectedLamps.find(p=>!streetLights.some(l=>l.userData.source===p));
      light.userData.source=next;
      if(next){const [x,y,z]=next;light.position.set(x,y-.035,z);light.target.position.set(x,groundHeight(x,z),z);}
    }
  }
}
const perfPanel=new URLSearchParams(location.search).has('perf')?document.createElement('output'):null;
if(perfPanel){perfPanel.id='performance';perfPanel.style.cssText='position:fixed;bottom:8px;left:50%;z-index:2000;background:#122c;color:white;padding:8px;font:12px monospace;white-space:pre';document.body.append(perfPanel);}
let benchmark=null;
if(perfPanel){
 const controls=document.createElement('div');controls.style.cssText='position:fixed;top:100px;left:220px;z-index:2000;background:#142823;color:white;padding:8px;font:12px monospace';
 const button=document.createElement('button'),output=document.createElement('div');button.textContent='Run full-speed streaming replay';controls.append(button,output);document.body.append(controls);
 benchmark=streamingBenchmark({graph:navigation.graph,state,button,output,start:()=>{if(!started)start.click();},place:()=>setCar(car,state.x,state.y,state.z,state.a)});
 const inspect=document.createElement('button'),trafficReport=document.createElement('pre');inspect.textContent='Inspect nearby traffic';trafficReport.style.cssText='max-height:300px;max-width:750px;overflow:auto;white-space:pre-wrap';controls.append(inspect,trafficReport);
 inspect.onclick=()=>{
  const compact=n=>({id:n.id,x:+n.x.toFixed(1),z:+n.z.toFixed(1),a:+n.a.toFixed(2),speed:+(n.speed||0).toFixed(2),stalled:+(n.stalled||0).toFixed(1),reason:n.stopReason,planning:!!n.planning,queued:n.queued,edge:n.edgeIndex,along:+n.along.toFixed(1),route:n.route.length,lock:junctionReservations.locks.find(l=>l.id===n.id)});
  const agents=traffic.map(a=>a.nav),waiting=agents.filter(n=>n.stalled>8&&Math.hypot(n.x-state.x,n.z-state.z)<150).slice(0,8);
  trafficReport.textContent=JSON.stringify(waiting.map(n=>({agent:{...compact(n),lock:undefined},lock:(()=>{const l=junctionReservations.locks.find(l=>l.id===n.id);return l?{entry:l.entry,end:l.end,exit:l.exitAlong}:null;})(),near:agents.filter(b=>b!==n&&Math.hypot(n.x-b.x,n.z-b.z)<12).map(b=>({...compact(b),lock:undefined,overlap:vehicleOverlap(n,b)}))})),null,1);
 };

}
if(new URLSearchParams(location.search).has('vehicleqa')){
 const panel=document.createElement('div');panel.style.cssText='position:fixed;bottom:100px;left:16px;z-index:2000;background:#fff;padding:8px;color:#111';
 const report=document.createElement('span');report.id='vehicle-qa-report';
 for(const kind of ['car','bike']){const b=document.createElement('button');b.textContent='Test parked '+kind;b.onclick=()=>{
  if(occupiedVehicle){notify('Stap eerst uit');return;}
  const candidates=[...vehicleFleet.records.values()].filter(v=>v.kind===kind&&!v.occupied&&v.id!=='starter').sort((a,b)=>Math.hypot(a.x-spawn.x,a.z-spawn.z)-Math.hypot(b.x-spawn.x,b.z-spawn.z));
  for(const v of candidates){const p=safeVehicleExit(v,(x,z,y,r)=>!blocked(x,z,y,r),surface);if(!p)continue;Object.assign(state,p,{driving:false,cycling:false,v:0});view.set(p.x,p.y+5,p.z+5);look.set(p.x,p.y,p.z);report.textContent=kind+' · '+v.id;return;}
  report.textContent='Geen veilige testpositie';
 };panel.append(b);}
 panel.append(report);document.body.append(panel);
}
let perfStart=0,perfFrames=0;
const perfDurations=[];
const perfStages={};
const frameStages={};
function recordStage(name,duration){frameStages[name]=duration;perfStages[name]=Math.max(perfStages[name]||0,duration);}
function measureStage(name,fn){if(!perfPanel)return fn();const t=performance.now();const value=fn();const duration=performance.now()-t;frameStages[name]=duration;perfStages[name]=Math.max(perfStages[name]||0,duration);return value;}
let frameHandle=0;
let last=0,clock=0,lastHUD=-1,first=true;
function frame(ms){
  if(perfPanel&&last){perfDurations.push(ms-last);if(perfDurations.length>300)perfDurations.shift();}
  if(perfPanel&&last)benchmark?.recordFrame(ms-last,frameStages);
  for(const key in frameStages)delete frameStages[key];
  const dt=last?Math.min((ms-last)/1000,.05):.016;
  last=ms;clock+=dt;
  if(!started||(!paused&&!mapOpen))simulatedTime+=dt*60000; // 60x: one day in 24 minutes
  updateSolar(clock);
  stationScreens.update(camera.position);
  if(!paused&&!mapOpen&&!resetting){elapsed+=dt;if(benchmark?.active)benchmark.tick(ms,dt);else measureStage('move',()=>move(dt));}
  world.water.userData.time.value=started?elapsed:clock;
  measureStage('NPC',()=>actors(started?elapsed:clock,started&&(paused||mapOpen)?0:dt));
  updateCamera(dt,clock);
  measureStage('visibility',()=>updateChunkVisibility(clock));
  measureStage('terrain',()=>world.terrainStream?.update(camera.position.x,camera.position.z));
  measureStage('stream',()=>world.visualStream?.update(camera.position.x,camera.position.z));
  measureStage('streetlights',()=>updateStreetLights(clock));
  playerLightActor.g=car.g;playerLightActor.bike=state.cycling;
  measureStage('vehiclelights',()=>nightLighting.update(night,dt,clock,camera.position,(state.driving||state.cycling)?occupiedLightActors:movingLightActors,world.lampPositions));
  if(volume){
    volume.gain.setTargetAtTime(!mute&&!paused&&state.driving?.014+Math.abs(state.v)*.00115:0,audio.currentTime,.1);
    osc.frequency.setTargetAtTime(39+Math.abs(state.v)*4.1,audio.currentTime,.08);
  }
  if((!started||!paused)&&clock-lastHUD>.12){lastHUD=clock;measureStage('HUD',()=>updateHUD());}
  measureStage('render',()=>renderer.render(scene,camera));
  if(perfPanel){perfFrames++;if(ms-perfStart>1000){const durations=[...perfDurations].sort((a,b)=>a-b),p95=durations[Math.floor(durations.length*.95)]||0;perfPanel.textContent=`${Math.round(perfFrames*1000/(ms-perfStart))} FPS | p95 ${p95.toFixed(1)} ms | ${renderer.info.render.calls} draws | ${renderer.info.render.triangles.toLocaleString()} triangles\n${[...staticCityChunks.values()].filter(c=>c.mesh.visible).length}/${staticCityChunks.size} city batches | WebGL GPU\nNPC ${navigation.plans} routes / ${navigation.arrivals} arrivals / ${navigation.queue.length} planning\nBuild ${scene.userData.buildTimings.total} ms | terrain cache ${scene.userData.terrainCacheHits||0}`;perfPanel.textContent+='\nNearby stalled: '+traffic.filter(a=>a.nav.stalled>8&&Math.hypot(a.nav.x-state.x,a.nav.z-state.z)<80).map(a=>a.nav.id+':'+a.nav.stopReason+' '+a.nav.route[a.nav.edgeIndex]?.kind+' @'+a.nav.x.toFixed(1)+','+a.nav.z.toFixed(1)+' lock:'+junctionReservations.locks.find(l=>l.id===a.nav.id)?.entry).slice(0,6).join(', ');perfPanel.textContent+='\nCPU peak '+Object.entries(perfStages).map(([k,v])=>k+' '+v.toFixed(1)+'ms').join(' | ');perfPanel.textContent+='\nRouting buffers '+(navigation.graph.routingScratchAllocations||0)+' | slow stream '+(scene.userData.streamSlow||[]).map(v=>v.phase+':'+v.ms.toFixed(1)+'ms').join('; ');for(const k in perfStages)perfStages[k]=0;perfFrames=0;perfStart=ms;}}
  if(first){first=false;start.disabled=false;start.textContent='Start  →';}
  frameHandle=requestAnimationFrame(frame);
}
setCar(car,spawn.x,surface(spawn.x,spawn.z),spawn.z,spawn.a);
player.g.position.set(state.x,state.y,state.z);
await renderer.compileAsync(scene,camera);
frameHandle=requestAnimationFrame(frame);

// A reload discards the scene: release GPU buffers before creating the next one.
window.addEventListener('pagehide',event=>{
  if(event.persisted)return; // Preserve a page kept in the browser back/forward cache.
  cancelAnimationFrame(frameHandle);
  stationScreens.dispose();
  audio?.close().catch(()=>{});
  disposeScene(scene,renderer);
},{once:true});
