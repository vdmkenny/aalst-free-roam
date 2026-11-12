import aerialVegetation from './aerial-vegetation.js';
import {stationForecourtPatches,paintStationFrontage,restoreStationGroundAccess,restoreStationUpperAccess,paintStationPortals,paintStationTunnelShells,paintStationStairwells,paintStationAccessFloors} from './station-access.js';
import {buildStationTicketBuilding} from './station-ticket-building.js';
import {buildHistoricStation,stationGalleryOpen} from './station-main.js';
import {buildStationPavilion} from './station-pavilions.js';
import buildingShelterData from './building-shelter-data.js';
import {platformProfiles,paintPlatforms} from './rail-platforms.js';
import {paintTrafficLight} from './traffic-light.js';
import roadReferenceWidths from './road-reference-widths.js';
import {vehicleFleet} from './vehicle-access.js';
import {junctionApproaches} from './intersection-controls.js';
import roadsideControlData from './roadside-control-data.js';
import {placeRoadside,approachYaw} from './roadside-placement.js';
import bicycleParkingSites from './bicycle-parking-data.js';
import {bicycleParkingLayout,paintBicycleParking} from './bicycle-parking.js';
import {bridgeCycleLinks} from './bridge-cycle-links.js';
import {parkingLayout} from './parking-layout.js';
import {SolidCollisions} from './solid-collisions.js';
import {prepareDistanceDetail} from './distance-detail.js';
import {openTerrainCache} from './terrain-cache.js';
import {finishRailway} from './railway-finish.js';
import {buildTreinstraatMasonry} from './treinstraat-masonry.js';
import {buildMergedRailUnderpasses} from './rail-underpasses.js';
import {buildCivicLandmark} from './civic-models.js';
import {addAsset,addParkedInstances} from './cc0-assets.js';
import * as T from './three.module.min.js';
import city from './city.js';

// This riverside underpass profile contained railway-deck returns (up to
// 10 m). Keep its mapped XY alignment and use the unobstructed 8.03 m
// approach level for the covered section, with a gradual northern ramp.
{const path=city.road.find(f=>f.id===60071589);
 if(path?.y)path.y=path.p.map((p,i)=>{
   const z=p[1];if(z< -405||z> -341.12)return path.y[i];
   if(z< -379){const t=(z+405)/26;return 6.55+(8.03-6.55)*t*t*(3-2*t);}
   return 8.03;
 });}
export {T,city};
export const box = city.box;
export const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
const lerp = (a,b,t) => a+(b-a)*t;
export const pick = (n, salt=0) => {
  const value = Math.sin(n*78.233+salt*91.37)*43758.5453;
  return value-Math.floor(value);
};
export function height(x,z){
  const a=clamp((x-box[0])/city.step,0,city.grid[0].length-1.001);
  const b=clamp((z-box[1])/city.step,0,city.grid.length-1.001);
  const i=Math.floor(a),j=Math.floor(b), row=city.grid[j], next=city.grid[j+1];
  return lerp(lerp(row[i],row[i+1],a-i),lerp(next[i],next[i+1],a-i),b-j);
}
export const stationGroundAccess=restoreStationGroundAccess(city,height);
export const inside = (x,z,pad=0) => x>=box[0]+pad&&x<=box[2]-pad&&z>=box[1]+pad&&z<=box[3]-pad;
export function contains(x,z,points){
  let hit=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,az]=points[i], [bx,bz]=points[j];
    if((az>z)!=(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax) hit=!hit;
  }
  return hit;
}
export class Hash {
  constructor(){this.cells=new Map();}
  insert(item,x1,z1,x2,z2){
    for(let i=Math.floor(x1/24);i<=Math.floor(x2/24);i++){
      for(let j=Math.floor(z1/24);j<=Math.floor(z2/24);j++){
        const key=i+','+j;
        if(!this.cells.has(key)) this.cells.set(key,[]);
        this.cells.get(key).push(item);
      }
    }
  }
  get(x,z){return this.cells.get(Math.floor(x/24)+','+Math.floor(z/24))||[];}
}
export const medians=new Hash();
const railCuts=new Hash();
const platformIndex=new Hash();
export const stationPlatforms=[];
export let stationStairCuts=[];
export const roads=new Hash(), buildings=new Hash(), waterways=new Hash(), rails=new Hash();
const mergedCycleSurfaces=city.roadSurface?.some(p=>p.style==='cycle');
const colors=new Map();
const waterEdges=new Hash();
function color(value){
  if(!colors.has(value)) colors.set(value,new T.Color(value));
  return colors.get(value);
}
class Batch {
  constructor(){this.tiles=new Map();}
  tri(a,b,c,tint){
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nx+ny*ny+nz*nz<1e-14)return;
    if(this.solids&&!this.boxCollision)this.solids.addTriangle(a,b,c);
    const col=typeof tint==='object'?tint:color(tint);
    const x=Math.floor((a[0]+b[0]+c[0])/720),z=Math.floor((a[2]+b[2]+c[2])/720);
    const key=x+','+z;
    if(!this.tiles.has(key))this.tiles.set(key,{position:[],rgb:[],normal:[]});
    const tile=this.tiles.get(key);
    tile.position.push(...a,...b,...c);
    const length=Math.hypot(nx,ny,nz),r=Math.round(clamp(col.r,0,1)*255),g=Math.round(clamp(col.g,0,1)*255),blue=Math.round(clamp(col.b,0,1)*255);
    for(let i=0;i<3;i++){tile.rgb.push(r,g,blue);tile.normal.push(nx/length,ny/length,nz/length);}
  }
  quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
  mesh(scene,options={},sharedMaterial=null){
    const steps=this.meshSteps(scene,options,sharedMaterial);
    let step;do{step=steps.next();}while(!step.done);return step.value;
  }
  *meshSteps(scene,options={},sharedMaterial=null){
    const material=sharedMaterial||new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,...options});
    const meshes=[];
    for(const {position,rgb,normal} of this.tiles.values()){
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(position,3));
      yield null;
      const colors=new Uint8Array(rgb);
      geo.setAttribute('color',new T.BufferAttribute(colors,3,true));
      yield null;
      geo.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
      yield null;
      geo.computeBoundingSphere();
      const mesh=new T.Mesh(geo,material);
      mesh.updateMatrix();mesh.matrixAutoUpdate=false;
      mesh.userData.staticCityBatch=true;
      mesh.receiveShadow=true;
      scene.add(mesh);
      meshes.push(mesh);
      yield null;
    }
    this.tiles.clear();
    return {
      material,meshes,userData:{},
      set receiveShadow(value){for(const mesh of meshes)mesh.receiveShadow=value;},
      set castShadow(value){for(const mesh of meshes)mesh.castShadow=value;}
    };
  }
}
const pathKinds=new Set(['path','footway','cycleway','steps','bridleway','corridor','track','pedestrian']);
export const isPath = f => pathKinds.has(f.c);
const widths={motorway:10,trunk:9,primary:9,secondary:8,tertiary:7,residential:5.9,unclassified:5.7,living_street:5.5,service:3.8,pedestrian:4.5,cycleway:2.45,track:3.2,path:1.6,footway:1.85,steps:1.9};
export const roadWidth = f => (parseFloat(f.w)>0?parseFloat(f.w):roadReferenceWidths[f.id]) || (f.c==='cycleway'&&f.one?1.65:f.n==='Brusselse steenweg'&&f.c==='primary'?7.2:['primary','secondary','trunk'].includes(f.c)&&Number(f.lanes)?Math.max(4.1,Number(f.lanes)*2.9+(f.cy==='lane'?2:0)):widths[f.c]||5.3);
function projection(s,x,z){
  const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/s.length2,0,1);
  return {t,d:Math.hypot(x-s.a[0]-s.dx*t,z-s.a[1]-s.dz*t)};
}
export function nearest(index,x,z,filter=()=>true){
  let best=null,distance2=Infinity,bestT=0;
  for(const s of index.get(x,z)){
    if(!filter(s.f))continue;
    const t=clamp(((x-s.a[0])*s.dx+(z-s.a[1])*s.dz)/s.length2,0,1);
    const dx=x-s.a[0]-s.dx*t,dz=z-s.a[1]-s.dz*t,d2=dx*dx+dz*dz;
    if(d2<distance2){distance2=d2;best=s;bestT=t;}
  }
  return best?{...best,d:Math.sqrt(distance2),t:bestT}:null;
}

export function railHeight(x,z){
  const s=nearest(rails,x,z);
  return s?lerp(s.ya,s.yb,s.t):height(x,z)+.15;
}
function segment(a,b,f,width,extra=0){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  return {a,b,dx,dz,length,length2:length*length,f,width,extra};
}
function register(hash,s,pad){
  hash.insert(s,Math.min(s.a[0],s.b[0])-pad,Math.min(s.a[1],s.b[1])-pad,Math.max(s.a[0],s.b[0])+pad,Math.max(s.a[1],s.b[1])+pad);
}
function roadLevel(x,z,previousY){
  let best=null,score=Infinity;
  for(const s of roads.get(x,z)){
    const {t,d}=projection(s,x,z);
    if(d>s.width/2+.33)continue;
    const y=lerp(s.ya,s.yb,t);
    if(Number.isFinite(previousY)&&Math.abs(y-previousY)>1.05)continue;
    const rank=d/s.width+(Number.isFinite(previousY)?Math.abs(y-previousY)*.48:0);
    if(rank<score){score=rank;best={y,s};}
  }
  return best;
}
export function surface(x,z,previousY=Infinity){
  let y=roadLevel(x,z,previousY)?.y??groundHeight(x,z);
  for(const f of platformIndex.get(x,z))if(contains(x,z,f.p)&&!stationStairCuts.some(c=>contains(x,z,c))){const py=f.y(x,z);if(!Number.isFinite(previousY)||Math.abs(py-previousY)<1.05){y=py;break;}}
  const island=nearest(medians,x,z);
  return y+.035+(island&&island.d<island.width/2&&Math.abs(y-lerp(island.ya,island.yb,island.t))<.4?.18:0);
}
export function waterCrossing(x,z,previousY){
  const road=roadLevel(x,z,previousY);
  if(!road)return false;
  return waterways.get(x,z).every(feature=>!waterContains(feature,x,z)||
    (feature.n==='Dender'||feature.f?.n==='Dender'
      ?road.s.f.b&&road.y>riverLevel(z)+.12
      :road.y>localWaterLevel(x,z,feature)+.12));
}
function waterWidth(f){return f.c==='river'||f.c==='canal'?24:f.c==='stream'?3.8:1.6;}
function waterContains(feature,x,z){
  return feature.p?contains(x,z,feature.p):projection(feature,x,z).d<feature.width*.5;
}
export function wet(x,z){
  return waterways.get(x,z).some(feature=>waterContains(feature,x,z));
}
function localWaterLevel(x,z,feature=null){
  // A pond owns one horizontal water plane. A stream owns one longitudinal
  // channel profile, projected onto its centreline, including across its width.
  if(feature?.p&&Number.isFinite(feature.level))return feature.level;
  if(feature?.a&&Number.isFinite(feature.ya)){
    const {t}=projection(feature,x,z);return lerp(feature.ya,feature.yb,t);
  }
  let best=null,distance=Infinity;
  for(const candidate of waterways.get(x,z)){
    if(feature&&candidate.f!==feature&&candidate!==feature)continue;
    if(candidate.p){if(waterContains(candidate,x,z)&&Number.isFinite(candidate.level))return candidate.level;continue;}
    const {d,t}=projection(candidate,x,z);
    if(d<distance&&Number.isFinite(candidate.ya)){distance=d;best=lerp(candidate.ya,candidate.yb,t);}
  }
  return best??height(x,z)-.22;
}
function channelProfile(f){
  const levels=f.p.map((p,i)=>Number.isFinite(f.y?.[i])?f.y[i]:height(...p)-.22);
  const caps=levels.slice(),distance=[0];
  for(let i=1;i<f.p.length;i++){
    const a=f.p[i-1],b=f.p[i];distance.push(distance.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));
    for(const t of [0,.25,.5,.75,1]){
      const x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);
      for(const road of roads.get(x,z)){
        const q=projection(road,x,z);
        if(q.d>road.width/2+waterWidth(f)/2+.5)continue;
        const cap=lerp(road.ya,road.yb,q.t)-.32;
        caps[i-1]=Math.min(caps[i-1],cap);caps[i]=Math.min(caps[i],cap);
      }
    }
  }
  // Carry lower culvert levels into measured approaches, without a water
  // hump at the far portal. This never varies across a stream section.
  for(let i=0;i<levels.length;i++){
    if(caps[i]>=levels[i]-.001)continue;
    for(let j=i;j>=0&&distance[i]-distance[j]<80;j--)levels[j]=Math.min(levels[j],caps[i]+(distance[i]-distance[j])*.025);
    for(let j=i;j<levels.length&&distance[j]-distance[i]<80;j++)levels[j]=Math.min(levels[j],caps[i]+(distance[j]-distance[i])*.025);
  }
  for(let i=1;i<levels.length;i++)levels[i]=Math.min(levels[i],levels[i-1]);
  return levels;
}
function pondLevel(f){
  let level=Number.isFinite(f.level)?f.level:Math.min(...f.p.map(p=>height(...p)))-.15;
  const [a,b,c,d]=extents(f.p),candidates=new Set();
  for(let x=Math.floor(a/24);x<=Math.floor(c/24);x++)for(let z=Math.floor(b/24);z<=Math.floor(d/24);z++){
    for(const road of roads.cells.get(x+','+z)||[])candidates.add(road);
  }
  for(const road of candidates){
    // Keep the complete pond flat even when a mapped low road crosses it.
    for(const t of [0,.25,.5,.75,1]){
      const x=lerp(road.a[0],road.b[0],t),z=lerp(road.a[1],road.b[1],t);
      if(contains(x,z,f.p))level=Math.min(level,lerp(road.ya,road.yb,t)-.32);
    }
  }
  return level;
}
const point = (x,y,z) => [x,y,z];
function ribbon(batch,a,b,half,ya,yb,tint,offset=0){
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(d<.02) return;
  const nx=(b[1]-a[1])/d,nz=(a[0]-b[0])/d;
  const at=(p,y,w)=>point(p[0]+nx*(w+offset),y,p[1]+nz*(w+offset));
  batch.quad(at(a,ya,-half),at(b,yb,-half),at(b,yb,half),at(a,ya,half),tint);
}
function strip(batch,p,width,tint,y){
  for(let j=1;j<p.length;j++){
    const a=p[j-1],b=p[j],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.02)continue;
    const rows=Math.ceil(length),columns=Math.ceil(width);
    for(let i=0;i<rows;i++){
      const q=[lerp(a[0],b[0],i/rows),lerp(a[1],b[1],i/rows)];
      const r=[lerp(a[0],b[0],(i+1)/rows),lerp(a[1],b[1],(i+1)/rows)];
      if(!inside(...q,-45)&&!inside(...r,-45))continue;
      const pointAt=(p,t)=>{
        const across=(t-.5)*width;
        const x=p[0]+dz/length*across,z=p[1]-dx/length*across;
        return [x,y(x,z),z];
      };
      for(let k=0;k<columns;k++){
        const left=k/columns,right=(k+1)/columns;
        batch.quad(pointAt(q,left),pointAt(r,left),pointAt(r,right),pointAt(q,right),tint);
      }
    }
  }
}
function polygon(batch,p,getY,tint,spacing=Infinity,holes=[]){
  // A subdivided surface shares vertices across many triangles. Evaluate its
  // deterministic height once per exact coordinate, scoped to this surface.
  const samples=new Map();
  const vertex=q=>{const key=q[0]+","+q[1];let v=samples.get(key);if(!v){v=point(q[0],getY(q),q[1]);samples.set(key,v);}return v;};
  const toContour=ring=>ring.slice(0,-1).map(q=>new T.Vector2(...q));
  const contour=toContour(p);
  const inner=holes.map(toContour);
  const points=[...contour,...inner.flat()];
  for(const ids of T.ShapeUtils.triangulateShape(contour,inner)){
    const subdivide=points=>{
      let longest=spacing,index=-1;
      for(let i=0;i<3;i++){
        const a=points[i],b=points[(i+1)%3],d=Math.hypot(a[0]-b[0],a[1]-b[1]);
        if(d>longest){index=i;longest=d;}
      }
      if(index<0){
        batch.tri(...points.map(vertex),tint);
        return;
      }
      const a=points[index],b=points[(index+1)%3],c=points[(index+2)%3];
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      subdivide([a,mid,c]);subdivide([mid,b,c]);
    };
    subdivide(ids.map(i=>[points[i].x,points[i].y]));
  }
}
export function center(p){
  const q=p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]?p.slice(0,-1):p;
  return q.reduce((a,b)=>[a[0]+b[0]/q.length,a[1]+b[1]/q.length],[0,0]);
}
function extents(p){return [Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];}
const stationWalls=new Hash(),retainingAprons=new Hash();
const stationForecourt=stationForecourtPatches(stationGroundAccess).find(f=>f.forecourt);
function retainingApronLevel(x,z){
  if(contains(x,z,stationForecourt.p)){
    const a=stationForecourt.p[0],b=stationForecourt.p[1],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    return lerp(stationForecourt.y[0],stationForecourt.y[1],t)-.1;
  }

  // Paved station thresholds sit at concourse level, not the rail embankment.
  for(const id of [1198396111,844221451]){
    const f=stationGroundAccess.find(f=>f.id===id),a=f.p[0],b=f.p[1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
    const along=(x-a[0])*ux+(z-a[1])*uz,across=-(x-a[0])*uz+(z-a[1])*ux;
    if(along>=-8&&along<=.6&&Math.abs(across)<=Number(f.w)/2+1.8)return f.y[0]-.1;
  }

  for(const apron of retainingAprons.get(x,z)){
    if(!contains(x,z,[...apron.cutPoly,apron.cutPoly[0]]))continue;
    for(const [a,b,c] of [[apron.points[0],apron.points[1],apron.points[2]],[apron.points[0],apron.points[2],apron.points[3]]]){
      const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(d)<1e-8)continue;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
      const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
      if(u>=-.001&&v>=-.001&&u+v<=1.001)return u*a[1]+v*b[1]+(1-u-v)*c[1];
    }
  }
  return null;
}
function stationWallAt(x,z){
  const wall=nearest(stationWalls,x,z);
  if(!wall||wall.d>(wall.radius||12))return null;
  if((x-wall.a[0])*wall.dx+(z-wall.a[1])*wall.dz<-.1||(x-wall.b[0])*wall.dx+(z-wall.b[1])*wall.dz>.1)return null;
  const px=lerp(wall.a[0],wall.b[0],wall.t),pz=lerp(wall.a[1],wall.b[1],wall.t);
  const side=(x-px)*wall.nx+(z-pz)*wall.nz;
  return {...wall,side};
}
function stationTerrace(x,z,base){
  const wall=stationWallAt(x,z);
  if(!wall||wall.f.referenceArches)return base;
  const {t,side}=wall;
  const target=side>=0?lerp(wall.topA,wall.topB,t):lerp(wall.bottomA,wall.bottomB,t);
  const width=side<0&&wall.f.n==='Brusselse steenweg'?12:2;
  const fade=clamp(Math.abs(side)/width,0,1);
  return lerp(target,base,fade*fade*(3-2*fade));
}
function buildStationRetainingWall(scene,afterRoads=false){
  const masonry=new Batch(),stationConcrete=new Batch();
  for(const f of city.retainingWall||[]){
    if(!!f.referenceArches!==afterRoads||f.referenceArches)continue;
    for(let i=1;i<f.p.length;i++){
      let a=f.p[i-1],b=f.p[i];
      // Trim the raster-derived wall at the actual mapped tunnel opening.
      if(f.id===343995315){
        const gate=stationGroundAccess.find(g=>g.id===844221451),o=gate.p[0],q=gate.p[1],L=Math.hypot(q[0]-o[0],q[1]-o[1]),nx=-(q[1]-o[1])/L,nz=(q[0]-o[0])/L;
        const da=(a[0]-o[0])*nx+(a[1]-o[1])*nz,db=(b[0]-o[0])*nx+(b[1]-o[1])*nz,edge=Number(gate.w)/2+.15;
        if(da<edge&&db<edge)continue;
        if(db<edge){const t=(edge-da)/(db-da);b=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
      }
      const normal=f.normals[i-1],topA=f.top[i-1],topB=f.top[i],bottomA=f.bottom[i-1],bottomB=f.bottom[i];
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<.05)continue;
      if(f.referenceArches&&(a[0]>238.3||b[0]>238.3||a[1]<-289||b[1]<-289))continue;
      const wall=segment(a,b,f,.5);
      Object.assign(wall,{nx:normal[0],nz:normal[1],nxB:f.normals[i][0],nzB:f.normals[i][1],topA,topB,bottomA,bottomB,radius:4});register(stationWalls,wall,6);
      const source=city.road.find(r=>r.id===f.id),curb=roadWidth(source)/2+1.15;
      const N=f.normals[i],offsetA=f.offsets[i-1],offsetB=f.offsets[i];
      const busSide=[199776514,199776515,226919708].includes(f.id);
      const A=[a[0]-normal[0]*Math.max(0,offsetA-curb),a[1]-normal[1]*Math.max(0,offsetA-curb)];
      const B=[b[0]-N[0]*Math.max(0,offsetB-curb),b[1]-N[1]*Math.max(0,offsetB-curb)];
      if(Math.min(offsetA,offsetB)>curb+.3){
        const apron={cutPoly:[A,B,b,a],wallCut:true,points:[[A[0],f.referenceArches||busSide?bottomA:height(...A)+.02,A[1]],[B[0],f.referenceArches||busSide?bottomB:height(...B)+.02,B[1]],[b[0],bottomB,b[1]],[a[0],bottomA,a[1]]]};
        const xs=apron.cutPoly.map(p=>p[0]),zs=apron.cutPoly.map(p=>p[1]);
        retainingAprons.insert(apron,Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs));
      }
      if(f.referenceArches){ /* Rendered by the continuous closed railway shell. */ }
      else (busSide?stationConcrete:masonry).quad([a[0],bottomA-.15,a[1]],[b[0],bottomB-.15,b[1]],[b[0],topB,b[1]],[a[0],topA,a[1]],busSide?'#b5b1a2':'#826e5c');
      if(!f.referenceArches)ribbon(masonry,a,b,.22,topA+.08,topB+.08,'#9c9e96');
    }
  }
  if(!afterRoads){
    // Join the mapped station wall to the river bridge abutment. The brick
    // bearing support remains separate; this backing wall is smooth concrete.
    const source=city.retainingWall.find(f=>f.id===199776514);
    const a=source.p[0],b=[-5.99,-354.11],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);
    const bottom=source.bottom[0],top=source.top[0],nx=dz/L,nz=-dx/L;
    const join=segment(a,b,{n:'Station concrete return',concreteReturn:true},.6);
    Object.assign(join,{nx,nz,topA:top,topB:top,bottomA:bottom,bottomB:bottom,radius:16});register(stationWalls,join,18);
    const concrete=new Batch();
    addBox(concrete,(a[0]+b[0])/2,(top+bottom)/2,(a[1]+b[1])/2,L+.2,top-bottom,.65,'#b5b1a2',-Math.atan2(dz,dx));
    addBox(concrete,(a[0]+b[0])/2,top+.06,(a[1]+b[1])/2,L+.25,.12,.8,'#a7a89f',-Math.atan2(dz,dx));
    concrete.mesh(scene).castShadow=true;
  }
  // Bus-platform canopies referenced by the supplied street photograph.
  // Freestanding furnishings, anchored to mapped stop locations.
  if(afterRoads){buildTreinstraatMasonry({T,city,height,railHeight,scene,dressMasonry,onDress:data=>dressTreinstraatBridge(scene,data),onNodes:nodes=>{
    const f=city.retainingWall.find(f=>f.referenceArches);
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i],normal=n=>{const dx=n.back[0]-n.p[0],dz=n.back[1]-n.p[1],l=Math.hypot(dx,dz);return [dx/l,dz/l];},A=normal(a),B=normal(b);
      const wall=segment(a.p,b.p,f,.5);Object.assign(wall,{nx:A[0],nz:A[1],nxB:B[0],nzB:B[1],topA:a.top,topB:b.top,bottomA:a.base,bottomB:b.base,radius:12});register(stationWalls,wall,16);
    }
  }});const wall=masonry.mesh(scene);wall.castShadow=true;dressMasonry(wall.material);return;}
  const canopies=new Batch(),ux=.8223,uz=.5691,yaw=-Math.atan2(uz,ux);
  for(const f of city.streetObject||[]){
    if(f.c!=='bus_stop'||f.n!=='Aalst Station')continue;
    let [x,z]=f.p;
    if(x< -120||x> -95||z< -412||z> -385)continue;
    // A stop node can lie behind the corrected wall line. Anchor shelters to
    // the bus-platform side and its surveyed wall foot, never the rail deck.
    const wall=nearest(stationWalls,x,z,v=>[199776514,199776515,226919708].includes(v.id));
    let y=surface(x,z);
    if(wall){
      const X=lerp(wall.a[0],wall.b[0],wall.t),Z=lerp(wall.a[1],wall.b[1],wall.t);
      const side=(x-X)*wall.nx+(z-Z)*wall.nz;
      if(side> -1.75){x=X-wall.nx*1.75;z=Z-wall.nz*1.75;}
      y=lerp(wall.bottomA,wall.bottomB,wall.t)+.035;
    }
    addBox(canopies,x,y+3.8,z,20,.22,2.8,'#aaa99a',yaw);
    for(const side of [-1,1])addBox(canopies,x-uz*side*1.37,y+4.02,z+ux*side*1.37,20,.55,.12,'#666454',yaw);
    for(const along of [-7,7])addBox(canopies,x+ux*along,y+1.85,z+uz*along,.3,3.7,.35,'#b9b9ac',yaw);
  }
  canopies.mesh(scene).castShadow=true;
  stationConcrete.mesh(scene).castShadow=true;
  const wall=masonry.mesh(scene);wall.castShadow=true;dressMasonry(wall.material);
}
function dressTreinstraatBridge(scene,data){const start=scene.children.length;finishRailway({T,scene,Batch,addBox,dressMasonry,data});for(const m of scene.children.slice(start))m.userData.closedRailwayTrim=true;}
function buildRetainingArches(scene){
  const stone=new Batch(),recess=new Batch(),rail=new Batch();
  for(const f of city.retainingWall||[]){
    if(!f.referenceArches)continue;
    const nodes=nodesForLine(f.p,f.bottom),top=nodesForLine(f.p,f.top),length=nodes.at(-1).d;
    const sample=d=>{let i=1;while(i<nodes.length-1&&nodes[i].d<d)i++;const a=nodes[i-1],b=nodes[i],t=clamp((d-a.d)/(b.d-a.d||1),0,1);return {x:lerp(a.p[0],b.p[0],t),z:lerp(a.p[1],b.p[1],t),y:lerp(a.y,b.y,t),top:lerp(top[i-1].y,top[i].y,t),ux:(b.p[0]-a.p[0])/(b.d-a.d),uz:(b.p[1]-a.p[1])/(b.d-a.d)};};
    for(let d=5;d<length-4;d+=7.2){
      const c=sample(d),n=f.normals[Math.min(f.normals.length-1,Math.round(d/length*(f.normals.length-1)))];
      if(c.x>237||c.z<-289)continue;
      if(retainingOpening(c.x,c.z,c.top)||retainingOpening(c.x+c.ux*3,c.z+c.uz*3,c.top)||retainingOpening(c.x-c.ux*3,c.z-c.uz*3,c.top))continue;
      const at=(u,y,depth=0)=>[c.x+c.ux*u-n[0]*depth,c.y+y,c.z+c.uz*u-n[1]*depth];
      const spring=.95,rise=Math.min(2.1,c.top-c.y-spring-.55),radius=2.95;
      const outline=[[-radius,.25],[-radius,spring]];
      for(let i=0;i<=16;i++){const t=Math.PI-i*Math.PI/16;outline.push([Math.cos(t)*radius,spring+Math.sin(t)*rise]);}
      outline.push([radius,.25]);
      const pts=outline.map(p=>new T.Vector2(...p));
      for(const tri of T.ShapeUtils.triangulateShape(pts,[]))recess.tri(...tri.map(i=>at(...outline[i],.025)),'#514d42');
      for(let i=0;i<16;i++){
        const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
        const inner=t=>at(Math.cos(t)*radius,spring+Math.sin(t)*rise,.28);
        const outer=t=>at(Math.cos(t)*(radius+.30),spring+Math.sin(t)*(rise+.30),.28);
        stone.quad(inner(a),inner(b),outer(b),outer(a),'#a09b85');
        const back=t=>at(Math.cos(t)*radius,spring+Math.sin(t)*rise,.025);
        stone.quad(back(a),back(b),inner(b),inner(a),'#817c68');
      }
      for(const sign of [-1,1]){
        const a=sign*radius,b=sign*(radius+.3);
        stone.quad(at(a,.25,.28),at(b,.25,.28),at(b,spring,.28),at(a,spring,.28),'#96917b');
      }
      const yaw=-Math.atan2(c.uz,c.ux),sill=at(0,.18,.15);
      addBox(stone,...sill,6.5,.36,.6,'#9c9781',yaw);
    }
    for(let i=1;i<top.length;i++){
      const a=top[i-1],b=top[i];
      for(const up of [.42,.88])band(rail,a,b,-.025,.025,up,'#626c64');
      if(Math.floor(a.d/2.5)!==Math.floor(b.d/2.5))addBox(rail,a.p[0],a.y+.46,a.p[1],.055,.92,.055,'#626c64');
    }
  }
  recess.mesh(scene);stone.mesh(scene).castShadow=true;rail.mesh(scene).castShadow=true;
}
function retainingOpening(x,z,top){
  let opening=null;
  const add=(floor,ceiling,kind)=>{
    if(ceiling<=floor+1.9)return;
    if(!opening)opening={floor,ceiling,kind};
    else{opening.floor=Math.min(opening.floor,floor);opening.ceiling=Math.max(opening.ceiling,ceiling);}
  };
  for(const cut of railCuts.get(x,z)){
    const q=projection(cut,x,z);
    if(q.d>cut.width/2+.25)continue;
    const floor=lerp(cut.ya,cut.yb,q.t);
    if(floor<top-3)add(floor-.25,Math.min(top-.50,floor+6.35),'rail');
  }
  for(const road of roads.get(x,z)){
    if(!road.f.u&&!road.f.t)continue;
    const q=projection(road,x,z);
    if(q.d>road.width/2+.35)continue;
    const floor=lerp(road.ya,road.yb,q.t);
    if(floor<top-2)add(floor-.15,Math.min(top-.50,floor+(isPath(road.f)?3.9:4.8)),'road');
  }
  return opening;
}
function retainingFace(batch,A,B,bottomA,bottomB,topA,topB,tint){
  const length=Math.hypot(B[0]-A[0],B[1]-A[1]),count=Math.max(1,Math.ceil(length/.42));
  for(let i=0;i<count;i++){
    const a=i/count,b=(i+1)/count;
    const p=[lerp(A[0],B[0],a),lerp(A[1],B[1],a)],q=[lerp(A[0],B[0],b),lerp(A[1],B[1],b)];
    const lowA=lerp(bottomA,bottomB,a),lowB=lerp(bottomA,bottomB,b),highA=lerp(topA,topB,a),highB=lerp(topA,topB,b);
    const opening=retainingOpening((p[0]+q[0])/2,(p[1]+q[1])/2,(highA+highB)/2);
    if(!opening){batch.quad([p[0],lowA,p[1]],[q[0],lowB,q[1]],[q[0],highB,q[1]],[p[0],highA,p[1]],tint);continue;}
    if(opening.floor>Math.max(lowA,lowB)+.05)batch.quad([p[0],lowA,p[1]],[q[0],lowB,q[1]],[q[0],opening.floor,q[1]],[p[0],opening.floor,p[1]],tint);
    batch.quad([p[0],opening.ceiling,p[1]],[q[0],opening.ceiling,q[1]],[q[0],highB,q[1]],[p[0],highA,p[1]],tint);
  }
}
function buildRetainingShoulders(scene){
  const ground=new Batch(),emit=ground.tri.bind(ground);
  ground.tri=(a,b,c,tint)=>{
    let pieces=[[a,b,c]];const candidates=new Set();
    const xs=[a[0],b[0],c[0]],zs=[a[2],b[2],c[2]];
    for(let x=Math.floor(Math.min(...xs)/24);x<=Math.floor(Math.max(...xs)/24);x++)for(let z=Math.floor(Math.min(...zs)/24);z<=Math.floor(Math.max(...zs)/24);z++)for(const road of roads.cells.get(x+','+z)||[])if(road.f.u)candidates.add(road);
    for(const road of candidates){
      if([a,b,c].every(p=>p[1]<lerp(road.ya,road.yb,projection(road,p[0],p[2]).t)+.08))continue;
      const nx=road.dz/road.length,nz=-road.dx/road.length,w=road.width/2+.4;
      const footprint=[[road.a[0]+nx*w,road.a[1]+nz*w],[road.b[0]+nx*w,road.b[1]+nz*w],[road.b[0]-nx*w,road.b[1]-nz*w],[road.a[0]-nx*w,road.a[1]-nz*w]];
      pieces=pieces.flatMap(p=>subtractConvexFootprint(p,footprint));
    }
    for(const p of pieces)for(let i=2;i<p.length;i++)emit(p[0],p[i-1],p[i],tint);
  };
  // Every carved footprint has a bottom; shoulders alone leave gaps where
  // multiple cut corridors overlap or an opening interrupts the wall.
  for(const cut of new Set([...railCuts.cells.values()].flat()))
    ribbon(ground,cut.a,cut.b,cut.width/2+.08,cut.ya-.28,cut.yb-.28,'#77786e');
  const walls=[...new Set([...stationWalls.cells.values()].flat())];
  for(const wall of walls){
    const low=(wall.f.n==='Brusselse steenweg'||wall.f.concreteReturn)?12:2.1,high=2.1;
    const p=[[wall.a[0]-wall.nx*low,wall.a[1]-wall.nz*low],[wall.b[0]-(wall.nxB??wall.nx)*low,wall.b[1]-(wall.nzB??wall.nz)*low],[wall.b[0]+(wall.nxB??wall.nx)*high,wall.b[1]+(wall.nzB??wall.nz)*high],[wall.a[0]+wall.nx*high,wall.a[1]+wall.nz*high]];
    polygon(ground,[...p,p[0]],q=>{
      const t=projection(wall,...q).t,base=lerp(wall.bottomA,wall.bottomB,t);
      const opening=retainingOpening(...q,lerp(wall.topA,wall.topB,t));
      return Math.min(groundHeight(...q),base,opening?opening.floor:Infinity)-.30;
    },'#939897',1.5);
  }
  for(const wall of walls){
    const {a,b,nx,nz}=wall;
    const opening=retainingOpening((a[0]+b[0])/2,(a[1]+b[1])/2,(wall.topA+wall.topB)/2);
    for(const sign of [-1,1]){
      if((wall.f.n==='Brusselse steenweg'||wall.f.referenceArches)&&sign>0)continue;
      const shoulder=(wall.f.n==='Brusselse steenweg'||wall.f.concreteReturn)&&sign<0?12:2.1;
      const A=[a[0]+nx*shoulder*sign,a[1]+nz*shoulder*sign],B=[b[0]+(wall.nxB??nx)*shoulder*sign,b[1]+(wall.nzB??nz)*shoulder*sign];
      const ya=opening?opening.floor-.04:(sign>0?wall.topA:wall.bottomA),yb=opening?opening.floor-.04:(sign>0?wall.topB:wall.bottomB);
      const outerLevel=p=>{
        const t=projection(wall,...p).t,limit=lerp(sign>0?wall.topA:wall.bottomA,sign>0?wall.topB:wall.bottomB,t)+.12;
        if(sign>0&&(wall.f.concreteReturn||[199776514,199776515,226919708].includes(wall.f.id)))return lerp(wall.topA,wall.topB,t);

        return Math.min(groundHeight(...p),opening?opening.floor-.04:limit);
      };
      const tint=sign>0?'#827e70':'#939897';
      ground.quad([a[0],ya,a[1]],[b[0],yb,b[1]],[B[0],outerLevel(B),B[1]],[A[0],outerLevel(A),A[1]],tint);
    }
  }
  for(const apron of new Set([...retainingAprons.cells.values()].flat()))ground.quad(...apron.points,'#939897');
  ground.mesh(scene);
}
function buildCycleUnderpass(scene){
  const f=city.road.find(f=>f.id===303373542);
  if(!f)return;
  const concrete=new Batch(),nodes=nodesForLine(f.p,lineProfile(f,.135));
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],half=1.65;
    const upper=p=>nearest(roads,...p,f=>!isPath(f)&&f.n==='Brusselse steenweg');
    const roadA=upper(a.p),roadB=upper(b.p);
    const topA=Math.max(a.y+2.8,roadA?lerp(roadA.ya,roadA.yb,roadA.t)-.12:height(...a.p));
    const topB=Math.max(b.y+2.8,roadB?lerp(roadB.ya,roadB.yb,roadB.t)-.12:height(...b.p));
    for(const side of [-1,1]){
      const A=[a.p[0]+a.n[0]*half*side,a.p[1]+a.n[1]*half*side];
      const B=[b.p[0]+b.n[0]*half*side,b.p[1]+b.n[1]*half*side];
      const wall=segment(A,B,f,.3);
      Object.assign(wall,{nx:a.n[0]*side,nz:a.n[1]*side,topA,topB,bottomA:a.y-.1,bottomB:b.y-.1,cut:true,radius:4});
      // The tunnel floor is cut explicitly; the station wall index handles only the long railway terrace.
      concrete.quad([A[0],a.y-.1,A[1]],[B[0],b.y-.1,B[1]],[B[0],topB,B[1]],[A[0],topA,A[1]],'#805c48');
      ribbon(concrete,A,B,.18,topA+.08,topB+.08,'#b0b4af');
    }
    if(roadA&&roadB&&roadA.d<roadA.width/2+1&&roadB.d<roadB.width/2+1){
      prism(concrete,a.p,b.p,half*2,topA,topB,.42,'#7f8785');
    }
  }
  const first=nodes[0],last=nodes.at(-1);
  const dx=last.p[0]-first.p[0],dz=last.p[1]-first.p[1],len=Math.hypot(dx,dz);
  ribbon(concrete,[first.p[0]-dx/len*4.1,first.p[1]-dz/len*4.1],[last.p[0]+dx/len*4.1,last.p[1]+dz/len*4.1],1.72,first.y-.045,last.y-.045,'#717b78');
  const tunnel=concrete.mesh(scene);tunnel.castShadow=true;dressMasonry(tunnel.material);
}
function gradesTerrain(road){
  return !road.b&&(road.u||['path','track','footway','cycleway','steps'].includes(road.c));
}
export function groundHeight(x,z){
  let base=height(x,z);
  const riverside=z> -405&&z< -335?nearest(roads,x,z,f=>f.id===60071589):null;
  if(riverside&&z> -405&&z< -335&&riverside.d<7){
    const t=clamp((riverside.d-2)/5,0,1),floor=lerp(riverside.ya,riverside.yb,riverside.t)-.11;
    base=lerp(floor,base,t*t*(3-2*t));
  }
  let graded=base;
  const railCut=nearest(railCuts,x,z);
  if(railCut&&railCut.d<railCut.width/2+1.8){
    const floor=lerp(railCut.ya,railCut.yb,railCut.t)-.12;
    graded=Math.min(graded,lerp(floor,base,clamp((railCut.d-railCut.width/2)/1.8,0,1)));
  }
  // LiDAR returns can include a bridge deck. Keep the ground beneath a
  // mapped railway span at the lower road/path level, independently of rail.
  const track=nearest(rails,x,z,f=>f.b||f.l>0);
  if(track&&track.d<9){
    const lower=nearest(roads,x,z,f=>!f.b&&f.l<=0);
    if(lower&&lower.d<lower.width/2+8){
      const deck=lerp(track.ya,track.yb,track.t),floor=lerp(lower.ya,lower.yb,lower.t);
      if(deck-floor>2.8)graded=Math.min(graded,floor-.1+Math.max(0,lower.d-lower.width/2)*.08);
    }
  }
  const grade=nearest(roads,x,z,gradesTerrain);
  if(grade&&grade.d<=grade.width/2+12){
    const target=lerp(grade.ya,grade.yb,grade.t)-.11;
    if(!grade.f.u||target<=base){
      const shoulder=clamp(2.5+Math.abs(base-target)*2.1,3.5,12);
      const edge=Math.max(0,grade.d-grade.width/2);
      const t=clamp(edge/shoulder,0,1);
      graded=Math.min(graded,lerp(target,base,t*t*(3-2*t)));
    }
  }
  for(const road of roads.get(x,z)){
    if(road.f.b)continue;
    const {d,t}=projection(road,x,z);
    const paved=road.width/2+(isPath(road.f)?.12:1.3);
    if(d>paved+3.5)continue;
    const deck=lerp(road.ya,road.yb,t);
    const blend=clamp((d-paved)/3.5,0,1);
    const limit=lerp(deck-.09,base,blend*blend*(3-2*blend));
    graded=Math.min(graded,limit);
  }
  const tunnel=nearest(roads,x,z,f=>f.id===303373542);
  if(tunnel&&tunnel.d<3.7){
    const along=((x-tunnel.a[0])*tunnel.dx+(z-tunnel.a[1])*tunnel.dz)/tunnel.length2;
    if(along>=-.15&&along<=1.15){
      const floor=lerp(tunnel.ya,tunnel.yb,tunnel.t)-.11;
      const blend=clamp((tunnel.d-1.65)/2,0,1);
      graded=Math.min(graded,lerp(floor,base,blend));
    }
  }
  const lower=nearest(roads,x,z,f=>f.u);
  if(lower&&lower.d<lower.width/2+.4)return Math.min(graded,lerp(lower.ya,lower.yb,lower.t)-.1);
  let terrace=retainingApronLevel(x,z)??stationTerrace(x,z,graded);
  if(railCut&&railCut.d<railCut.width/2)terrace=Math.min(terrace,lerp(railCut.ya,railCut.yb,railCut.t)-.12);
  const water=waterways.get(x,z).find(f=>f.n!=='Dender'&&f.f?.n!=='Dender'&&waterContains(f,x,z));
  const road=water?roadLevel(x,z,Infinity):null;
  return water&&(!road||road.s.f.b)?Math.min(terrace,localWaterLevel(x,z,water)-.58):terrace;
}
function cutCycleTunnel(triangle){
  const a=[534.16,446.65],b=[541.39,433.09],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len;
  const uv=p=>[(p[0]-a[0])*ux+(p[2]-a[1])*uz,(p[0]-a[0])*(-uz)+(p[2]-a[1])*ux];
  const bounds=triangle.map(uv);
  if(bounds.every(p=>p[0]<-4)||bounds.every(p=>p[0]>len+4)||bounds.every(p=>p[1]<-1.7)||bounds.every(p=>p[1]>1.7))return null;
  let remaining=triangle;const outside=[];
  for(const [axis,sign,limit] of [[0,1,-4],[0,-1,-len-4],[1,1,-1.7],[1,-1,-1.7]]){
    const inside=[],out=[];
    for(let i=0;i<remaining.length;i++){
      const p=remaining[i],q=remaining[(i+1)%remaining.length],d=uv(p)[axis]*sign-limit,e=uv(q)[axis]*sign-limit;
      (d>=0?inside:out).push(p);
      if((d>=0)!=(e>=0)){
        const t=d/(d-e),r=p.map((v,j)=>lerp(v,q[j],t));inside.push(r);out.push(r);
      }
    }
    for(let i=2;i<out.length;i++)outside.push([out[0],out[i-1],out[i]]);
    remaining=inside;if(!remaining.length)break;
  }
  return outside;
}
// Subtract finite road footprints from terrain polygons. This resolves
// coarse DTM triangles covering a road between their sampled vertices.
function subtractConvexFootprint(polygon,clip){
  let remaining=polygon;const outside=[];
  const signedArea=clip.reduce((n,p,i)=>{const q=clip[(i+1)%clip.length];return n+p[0]*q[1]-q[0]*p[1];},0),sign=signedArea>=0?1:-1;
  for(let j=0;j<clip.length;j++){
    const A=clip[j],B=clip[(j+1)%clip.length];
    const signed=p=>((B[0]-A[0])*(p[2]-A[1])-(B[1]-A[1])*(p[0]-A[0]))*sign;
    const inside=[],out=[];
    for(let i=0;i<remaining.length;i++){
      const p=remaining[i],q=remaining[(i+1)%remaining.length],d=signed(p),e=signed(q);
      (d>=0?inside:out).push(p);
      if((d>=0)!=(e>=0)){const t=d/(d-e),r=p.map((v,k)=>lerp(v,q[k],t));inside.push(r);out.push(r);}
    }
    if(out.length>=3)outside.push(out);
    remaining=inside;if(remaining.length<3)break;
  }
  return outside;
}
const parkingTerrainCuts=new Hash();
let stationTerrainCutsRegistered=false;
for(const f of city.parking||[]){
  if(!/colruyt/i.test(f.n||''))continue;
  const p=f.p.slice(0,-1),contour=p.map(q=>new T.Vector2(...q));
  for(const ids of T.ShapeUtils.triangulateShape(contour,[])){
    const ring=ids.map(i=>p[i]),xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    parkingTerrainCuts.insert({cutPoly:ring},Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs));
  }
}
const terrainCutBounds=new WeakMap();
function terrainCutBoundsFor(s){
  let bounds=terrainCutBounds.get(s);
  if(!bounds){
    if(s.cutPoly)bounds=extents(s.cutPoly);
    else{
      const half=s.width/2-.015,nx=Math.abs(s.dz/s.length*half),nz=Math.abs(s.dx/s.length*half);
      bounds=[Math.min(s.a[0],s.b[0])-nx,Math.min(s.a[1],s.b[1])-nz,Math.max(s.a[0],s.b[0])+nx,Math.max(s.a[1],s.b[1])+nz];
    }
    terrainCutBounds.set(s,bounds);
  }
  return bounds;
}
function subtractRoadFootprints(triangle){
  const xs=triangle.map(p=>p[0]),zs=triangle.map(p=>p[2]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const candidates=new Set();
  for(let x=Math.floor(Math.min(...xs)/24);x<=Math.floor(Math.max(...xs)/24);x++){
    for(let z=Math.floor(Math.min(...zs)/24);z<=Math.floor(Math.max(...zs)/24);z++){
      for(const s of roads.cells.get(x+','+z)||[])if(!s.f.b)candidates.add(s);
      for(const s of railCuts.cells.get(x+','+z)||[])candidates.add(s);
      // Narrow open ditches can fall entirely between terrain-grid vertices.
      // Cut their mapped bank footprint so coarse ground cannot cover the water.
      for(const s of waterways.cells.get(x+','+z)||[])if(s.a&&s.f?.c==='ditch'){
        const nx=s.dz/s.length*(s.width/2+1.3),nz=-s.dx/s.length*(s.width/2+1.3);
        s.terrainCut??={cutPoly:[[s.a[0]+nx,s.a[1]+nz],[s.b[0]+nx,s.b[1]+nz],[s.b[0]-nx,s.b[1]-nz],[s.a[0]-nx,s.a[1]-nz]]};
        candidates.add(s.terrainCut);
      }
      for(const s of parkingTerrainCuts.cells.get(x+','+z)||[])candidates.add(s);
      for(const s of stationWalls.cells.get(x+','+z)||[]){s.cutSurface??=(s.f.n==='Brusselse steenweg'||s.f.concreteReturn)?{wallCut:true,cutPoly:[[s.a[0]-s.nx*12,s.a[1]-s.nz*12],[s.b[0]-s.nx*12,s.b[1]-s.nz*12],[s.b[0]+s.nx*2.1,s.b[1]+s.nz*2.1],[s.a[0]+s.nx*2.1,s.a[1]+s.nz*2.1]]}:{wallCut:true,cutPoly:[[s.a[0]-s.nx*2.1,s.a[1]-s.nz*2.1],[s.b[0]-(s.nxB??s.nx)*2.1,s.b[1]-(s.nzB??s.nz)*2.1],[s.b[0]+(s.nxB??s.nx)*2.1,s.b[1]+(s.nzB??s.nz)*2.1],[s.a[0]+s.nx*2.1,s.a[1]+s.nz*2.1]]};candidates.add(s.cutSurface);}
      for(const s of retainingAprons.cells.get(x+','+z)||[])candidates.add(s);
    }
  }
  let pieces=[triangle];
  for(const s of candidates){
    // Hash cells are conservative; reject disjoint cuts before polygon clipping.
    const bounds=terrainCutBoundsFor(s);
    if(maxX<bounds[0]-1e-8||minX>bounds[2]+1e-8||maxZ<bounds[1]-1e-8||minZ>bounds[3]+1e-8)continue;
    if(s.cutPoly){pieces=pieces.flatMap(p=>subtractConvexFootprint(p,s.cutPoly));if(!pieces.length)break;continue;}
    if(!s.wallCut&&triangle.every(p=>p[1]<lerp(s.ya,s.yb,projection(s,p[0],p[2]).t)+.01))continue;
    const half=s.width/2-.015,ux=s.dx/s.length,uz=s.dz/s.length;
    const uv=p=>[(p[0]-s.a[0])*ux+(p[2]-s.a[1])*uz,(p[0]-s.a[0])*(-uz)+(p[2]-s.a[1])*ux];
    const next=[];
    for(const polygon of pieces){
      const values=polygon.map(uv);
      if(values.every(p=>p[0]<0)||values.every(p=>p[0]>s.length)||values.every(p=>p[1]<-half)||values.every(p=>p[1]>half)){next.push(polygon);continue;}
      let remaining=polygon;
      for(const [axis,sign,limit] of [[0,1,0],[0,-1,-s.length],[1,1,-half],[1,-1,-half]]){
        const inside=[],outside=[];
        for(let i=0;i<remaining.length;i++){
          const p=remaining[i],q=remaining[(i+1)%remaining.length],d=uv(p)[axis]*sign-limit,e=uv(q)[axis]*sign-limit;
          (d>=0?inside:outside).push(p);
          if((d>=0)!=(e>=0)){
            const t=d/(d-e),r=p.map((v,j)=>lerp(v,q[j],t));inside.push(r);outside.push(r);
          }
        }
        if(outside.length>=3)next.push(outside);
        remaining=inside;if(remaining.length<3)break;
      }
    }
    pieces=next;if(!pieces.length)break;
  }
  const triangles=[];
  for(const piece of pieces)for(let i=2;i<piece.length;i++)triangles.push([piece[0],piece[i-1],piece[i]]);
  return triangles;
}
function createTerrainChunks(scene,cache=null,fade=false){
  let terrainBatch=new Batch();const urban=new Hash();
  const terrain={tri(a,b,c,tint){
    for(const tri of subtractRoadFootprints([a,b,c])){
      const leveled=tri.map(p=>{
        const wall=stationWallAt(p[0],p[2]);
        if(!(wall?.f.referenceArches||wall?.f.concreteReturn)||wall.side>=0)return p;
        let y=Math.min(p[1],lerp(wall.bottomA,wall.bottomB,wall.t)-.04);
        // Paved escargot forecourt: interpolate a gentle street-level plane,
        // rather than retaining coarse elevation triangles beside the viaduct.
        const x=p[0],z=p[2];
        const fade=clamp(Math.min((x-64)/5,(116-x)/5,(z+319)/5,(-274-z)/5),0,1);
        const paved=7.454+.019*(x-72)+.0217*(z+305);
        y=lerp(y,paved,fade*fade*(3-2*fade));
        return [x,y,z];
      });
      terrainBatch.tri(...leveled,tint);
    }
  },mesh(scene){return terrainBatch.mesh(scene);}};
  const ground={
    tri(a,b,c,tint){
      const cut=cutCycleTunnel([a,b,c]);
      if(cut){for(const triangle of cut)terrain.tri(...triangle,tint);return;}
      terrain.tri(a,b,c,tint);
    },
    quad(a,b,c,d,tint){this.tri(a,b,c,tint);this.tri(a,c,d,tint);},
    mesh(scene){return terrain.mesh(scene);}
  };
  for(const f of city.urban||[]){
    const [a,b,c,d]=extents(f.p);
    urban.insert(f,Math.max(a,box[0]),Math.max(b,box[1]),Math.min(c,box[2]),Math.min(d,box[3]));
  }
  const river=(x,z)=>waterways.get(x,z).some(f=>f.n==='Dender'&&f.p&&contains(x,z,f.p));
  const terrainPoints=new Map();
  const pointAt=(x,z)=>{
    const key=x+","+z,cached=terrainPoints.get(key);if(cached)return cached;
    let y=groundHeight(x,z);
    const water=waterways.get(x,z).find(f=>f.n!=='Dender'&&waterContains(f,x,z));
    if(water&&(!roadLevel(x,z,Infinity)||roadLevel(x,z,Infinity).s.f.b))y=Math.min(y,localWaterLevel(x,z,water)-.58);
    const point=[x,y,z];terrainPoints.set(key,point);return point;
  };
  const trimRiver=(triangle,tint)=>{
    const dry=triangle.map(q=>!river(q[0],q[2]));
    if(dry.every(Boolean)){ground.tri(...triangle,tint);return;}
    if(!dry.some(Boolean))return;
    const shape=[];
    for(let i=0;i<3;i++){
      const j=(i+1)%3,a=triangle[i],b=triangle[j];
      if(dry[i])shape.push(a);
      if(dry[i]===dry[j])continue;
      let l=0,r=1;
      for(let k=0;k<9;k++){
        const m=(l+r)/2;
        if(river(lerp(a[0],b[0],m),lerp(a[2],b[2],m))===dry[i])r=m;
        else l=m;
      }
      const t=(l+r)/2;
      shape.push(pointAt(lerp(a[0],b[0],t),lerp(a[2],b[2],t)));
    }
    for(let i=2;i<shape.length;i++)ground.tri(shape[0],shape[i-1],shape[i],tint);
  };
  const step=city.step,size=240,regions=[];
  for(let z=Math.floor((box[1]-80)/size)*size;z<box[3]+80;z+=size)
    for(let x=Math.floor((box[0]-80)/size)*size;x<box[2]+80;x+=size)
      regions.push({x,z,meshes:null});
  const restore=(region,data)=>{
    scene.userData.terrainCacheHits=(scene.userData.terrainCacheHits||0)+1;
    const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
    region.meshes=data.map(d=>{
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(d.position,3));geometry.setAttribute('normal',new T.BufferAttribute(d.normal,3));geometry.setAttribute('color',new T.BufferAttribute(d.color,3,true));geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.userData.streamedTerrain=true;if(fade)prepareDistanceDetail(T,mesh,2);scene.add(mesh);return mesh;
    });
  };
  const buildSteps=function*(region){
  const key=region.x+','+region.z,cached=cache?.loaded.get(key);
  if(cached){restore(region,cached);cache.loaded.delete(key);return;}
  terrainBatch=new Batch();terrainPoints.clear();
  let cellDeadline=performance.now()+.6;
  for(let z=Math.max(box[1]-80,region.z);z<Math.min(box[3]+80,region.z+size);z+=step){
    for(let x=Math.max(box[0]-80,region.x);x<Math.min(box[2]+80,region.x+size);x+=step){
      if(performance.now()>=cellDeadline){yield;cellDeadline=performance.now()+.6;}
      const u=x+step/2,v=z+step/2;
      const builtUp=Math.hypot((u+227)*.87,(v-5)*1.07)<540||urban.get(u,v).some(f=>contains(u,v,f.p));
      const tint=color(builtUp?'#8d8f8e':'#929e72').clone().multiplyScalar(.94+pick(x+z*91)*.08);
      const cut=nearest(roads,u,v,gradesTerrain);
      const nearShore=nearest(waterEdges,u,v);
      if(nearShore&&nearShore.d<12){
        for(let dz=0;dz<step;dz+=2){
          for(let dx=0;dx<step;dx+=2){
            const a=pointAt(x+dx,z+dz),b=pointAt(x+dx,z+dz+2),c=pointAt(x+dx+2,z+dz+2),d=pointAt(x+dx+2,z+dz);
            trimRiver([a,b,c],tint);trimRiver([a,c,d],tint);
          }
        }
        continue;
      }
      if(river(u,v))continue;
      const a=pointAt(x,z),b=pointAt(x,z+step),c=pointAt(x+step,z+step),d=pointAt(x+step,z);
      if(cut&&cut.d<cut.width/2+10&&(cut.f.u||Math.max(a[1],b[1],c[1],d[1])-Math.min(a[1],b[1],c[1],d[1])>.60)){
        // Keep the coarse cell edges identical to their neighbors while sampling
        // the graded shoulder more closely in the interior.
        const sample=(i,j)=>{
          if(i===0)return [x,lerp(a[1],b[1],j/4),z+j*step/4];
          if(i===4)return [x+step,lerp(d[1],c[1],j/4),z+j*step/4];
          if(j===0)return [x+i*step/4,lerp(a[1],d[1],i/4),z];
          if(j===4)return [x+i*step/4,lerp(b[1],c[1],i/4),z+step];
          return pointAt(x+i*step/4,z+j*step/4);
        };
        const samples=Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>sample(i,j)));
        for(let i=0;i<4;i++)for(let j=0;j<4;j++){
          ground.quad(samples[i][j],samples[i][j+1],samples[i+1][j+1],samples[i+1][j],tint);
        }
      }else ground.quad(a,b,c,d,tint);
    }
    yield;
  }
  // Other streamers can add objects while this generator yields. Own only
  // the meshes emitted by this terrain batch, never a slice of the scene.
  region.meshes=(yield* terrainBatch.meshSteps(scene)).meshes;for(const m of region.meshes){m.userData.staticCityBatch=false;m.userData.streamedTerrain=true;if(fade)prepareDistanceDetail(T,m,2);}terrainPoints.clear();cache?.put(region.x,region.z,region.meshes);
  };
  const build=region=>{for(const step of buildSteps(region)){};};
  const distance=(r,x,z)=>Math.hypot(Math.max(r.x-x,0,x-r.x-size),Math.max(r.z-z,0,z-r.z-size));
  let pending=false,idleX=Infinity,idleZ=Infinity;
  return {regions,build,
    ready(x,z,radius=1000){return regions.every(r=>r.meshes||distance(r,x,z)>=radius);},
    *warmSteps(x,z,radius){
      let deadline=performance.now()+6;
      for(const r of regions)if(distance(r,x,z)<radius){
        for(const row of buildSteps(r)){
          if(performance.now()>=deadline){yield null;deadline=performance.now()+6;}
        }
        if(performance.now()>=deadline){yield null;deadline=performance.now()+6;}
      }
    },
    warm(x,z,radius){for(const r of regions)if(distance(r,x,z)<radius)build(r);},
    update(x,z){
      if(pending||Math.hypot(x-idleX,z-idleZ)<8)return;
      idleX=idleZ=Infinity;
      for(const r of regions)if(r.meshes&&distance(r,x,z)>1450){
        for(const m of r.meshes){scene.remove(m);m.geometry.dispose();m.material.dispose();}r.meshes=null;
      }
      const next=regions.filter(r=>!r.meshes&&distance(r,x,z)<1150).sort((a,b)=>distance(a,x,z)-distance(b,x,z))[0];
      if(!next){idleX=x;idleZ=z;return;}pending=true;
      const generate=()=>{
      const steps=buildSteps(next);
      const slice=()=>{
        const deadline=performance.now()+1;
        try{while(performance.now()<deadline){if(steps.next().done){pending=false;return;}}}
        catch(error){pending=false;throw error;}
        setTimeout(slice,16);
      };
      setTimeout(slice,0);
      };
      if(cache)cache.get(next.x,next.z).then(data=>{if(data){restore(next,data);pending=false;}else generate();}).catch(generate);
      else generate();
    }
  };
}
function buildTerrain(scene){const chunks=createTerrainChunks(scene);for(const r of chunks.regions)chunks.build(r);}
function buildDistantTerrain(scene){
  const b=new Batch(),step=80,levels=new Map();
  const at=(x,z)=>{const k=x+','+z;if(!levels.has(k))levels.set(k,Math.min(...[-80,0,80].flatMap(dx=>[-80,0,80].map(dz=>height(x+dx,z+dz))))-3);return [x,levels.get(k),z];};
  // Shared vertices avoid cracks in the coarse, below-ground backdrop.
  for(let z=box[1]-80;z<box[3]+80;z+=step)for(let x=box[0]-80;x<box[2]+80;x+=step)
    b.quad(at(x,z),at(x,z+step),at(x+step,z+step),at(x+step,z),'#929e72');
  const before=scene.children.length;b.mesh(scene);
  for(const m of scene.children.slice(before))m.userData.staticCityBatch=false;
}

const riverLevel=z=>lerp(5.83,7.61,clamp((z-965)/21,0,1));
function buildWater(scene){
  const water=new Batch(), bank=new Batch();
  const mappedDender=city.water?.some(f=>f.n==='Dender');
  for(const f of city.river||[]){
    if(mappedDender&&['Dender','Sluis Aalst'].includes(f.n)) continue;
    const w=waterWidth(f),levels=channelProfile(f);
    const segments=[];
    for(let i=1;i<f.p.length;i++){
      const s=segment(f.p[i-1],f.p[i],f,w);s.ya=levels[i-1];s.yb=levels[i];
      if(s.length<.01||(!inside(...s.a,-300)&&!inside(...s.b,-300)))continue;
      register(waterways,s,w/2+2);register(waterEdges,s,w/2+8);segments.push(s);
    }
    for(const s of segments){
      ribbon(water,s.a,s.b,w/2,s.ya,s.yb,'#3d7b77');
      // Build the submerged bed and actual inclined banks; a flat oversized
      // water ribbon must not become a floating strip on the surrounding land.
      ribbon(bank,s.a,s.b,w/2,s.ya-.60,s.yb-.60,'#686b55');
      const nx=s.dz/s.length,nz=-s.dx/s.length,steps=Math.max(1,Math.ceil(s.length/2));
      for(let i=0;i<steps;i++){
        const t=i/steps,u=(i+1)/steps;
        const a=[lerp(s.a[0],s.b[0],t),lerp(s.a[1],s.b[1],t)],b=[lerp(s.a[0],s.b[0],u),lerp(s.a[1],s.b[1],u)];
        const ya=lerp(s.ya,s.yb,t),yb=lerp(s.ya,s.yb,u);
        for(const side of [-1,1]){
          const inner=(p,y)=>[p[0]+nx*w/2*side,y-.12,p[1]+nz*w/2*side];
          const outer=p=>{const x=p[0]+nx*(w/2+1.3)*side,z=p[1]+nz*(w/2+1.3)*side;return [x,groundHeight(x,z)-.025,z];};
          // Road decks themselves supply the visible culvert covering.
          const road=roadLevel((a[0]+b[0])/2,(a[1]+b[1])/2,Infinity);
          if(!road||road.s.f.b)bank.quad(inner(a,ya),inner(b,yb),outer(b),outer(a),'#7c8268');
        }
      }
    }
  }
  for(const f of city.water||[]){
    const [a,b,c,d]=extents(f.p);
    if(c<box[0]||a>box[2]||d<box[1]||b>box[3]) continue;
    if(f.n!=='Dender')f.level=pondLevel(f);
    waterways.insert(f,a,b,c,d);
    const level=f.n==='Dender'?p=>riverLevel(p[1]):()=>f.level;
    polygon(water,f.p,level,f.n==='Dender'?'#388b88':'#44827c',f.n==='Dender'?9:Infinity);
    for(let i=1;i<f.p.length;i++){
      const [a,b]=[f.p[i-1],f.p[i]],ya=level(a),yb=level(b),side=segment(a,b,f,0);
      if(side.length>.05)register(waterEdges,side,13);
      if(f.n==='Dender'){
        if(side.length>100)continue;
        bank.quad([a[0],ya-.12,a[1]],[b[0],yb-.12,b[1]],[b[0],Math.max(yb,groundHeight(...b))+.1,b[1]],[a[0],Math.max(ya,groundHeight(...a))+.1,a[1]],'#827c68');
      }else{
        // Natural pond banks incline outwards from the flat water plane.
        const count=Math.max(1,Math.ceil(side.length/2));
        let nx=side.dz/(side.length||1),nz=-side.dx/(side.length||1);
        if(contains((a[0]+b[0])/2+nx*.2,(a[1]+b[1])/2+nz*.2,f.p)){nx=-nx;nz=-nz;}
        for(let j=0;j<count;j++){
          const t=j/count,u=(j+1)/count,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t),X=lerp(a[0],b[0],u),Z=lerp(a[1],b[1],u);
          const outer=(x,z)=>[x+nx*1.2,Math.max(f.level+.03,groundHeight(x+nx*1.2,z+nz*1.2))-.025,z+nz*1.2];
          bank.quad([x,f.level-.12,z],[X,f.level-.12,Z],outer(X,Z),outer(x,z),'#747a62');
        }
      }
    }
  }
  bank.mesh(scene);
  const mesh=water.mesh(scene,{emissive:'#10302e',emissiveIntensity:.55});
  const time={value:0};
  mesh.userData.time=time;
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.rippleTime=time;
    shader.vertexShader='varying vec2 riverPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n riverPosition=position.xz;');
    shader.fragmentShader='uniform float rippleTime; varying vec2 riverPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float flow=sin(riverPosition.y*2.35+riverPosition.x*.19-rippleTime*1.42);
      float flecks=sin(riverPosition.x*.92+riverPosition.y*.21+rippleTime*.24);
      diffuseColor.rgb+=vec3(.043,.056,.048)*smoothstep(.81,.99,flow)*smoothstep(.15,.88,flecks);`);
  };
  return mesh;
}
const n9Roads=city.road.filter(f=>f.n==='Brusselse steenweg'&&f.c==='primary');
function n9DeckHeight(x,z){
  let best=Infinity,y=height(x,z)+.135;
  for(const f of n9Roads)for(let i=1;i<f.p.length;i++){
    const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
    if(d<best){best=d;y=lerp(f.y?.[i-1]??height(...a)+.135,f.y?.[i]??height(...b)+.135,t);}
  }return y;
}
const stationAccessIds=new Set([116915816,199776521,1076691091]);
function lineProfile(f,offset){
  if(stationAccessIds.has(f.id))return f.p.map(([x,z])=>{
    const wall=nearest(stationWalls,x,z);
    return wall?lerp(wall.bottomA,wall.bottomB,wall.t)+offset:height(x,z)+offset;
  });
  return f.p.map(([x,z],i)=>f.y?.[i]??height(x,z)+offset);
}
function prism(batch,a,b,width,ya,yb,depth,tint){
  ribbon(batch,a,b,width/2,ya-depth,yb-depth,tint);
  const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
  if(d<.02)return;
  for(const sign of [-1,1]){
    const u=dz/d*width/2*sign,v=-dx/d*width/2*sign;
    batch.quad([a[0]+u,ya,a[1]+v],[b[0]+u,yb,b[1]+v],[b[0]+u,yb-depth,b[1]+v],[a[0]+u,ya-depth,a[1]+v],tint);
  }
  const nx=dz/d*width/2,nz=-dx/d*width/2;
  for(const [p,y] of [[a,ya],[b,yb]]){
    batch.quad([p[0]-nx,y,p[1]-nz],[p[0]+nx,y,p[1]+nz],[p[0]+nx,y-depth,p[1]+nz],[p[0]-nx,y-depth,p[1]-nz],tint);
  }
}
function nodesForLine(p,y){
  const nodes=[];
  let distance=0;
  for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<.02)continue;
    const count=Math.ceil(len/3.2);
    for(let j=0;j<count;j++){
      const t=j/count;
      nodes.push({p:[lerp(a[0],b[0],t),lerp(a[1],b[1],t)],y:lerp(y[i-1],y[i],t),d:distance+t*len});
    }
    distance+=len;
  }
  nodes.push({p:p.at(-1),y:y.at(-1),d:distance});
  for(const [i,node] of nodes.entries()){
    const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;return [dz/len,-dx/len];};
    const a=i?normal(nodes[i-1].p,node.p):normal(node.p,nodes[1]?.p??node.p);
    const b=i+1<nodes.length?normal(node.p,nodes[i+1].p):a;
    const d=Math.max(.8,1+a[0]*b[0]+a[1]*b[1]);
    node.n=[(a[0]+b[0])/d,(a[1]+b[1])/d];
  }
  return nodes;
}
function edge(node,offset,up=0){
  return [node.p[0]+node.n[0]*offset,node.y+up,node.p[1]+node.n[1]*offset];
}
function band(batch,a,b,from,to,up,tint){
  batch.quad(edge(a,from,up),edge(b,from,up),edge(b,to,up),edge(a,to,up),tint);
}
function competingRoad(x,z,s,y){
  for(const other of roads.get(x,z)){
    if(other.f===s.f||isPath(other.f)||Math.abs(other.ya-y)>.55)continue;
    const {t,d}=projection(other,x,z);
    if(t>.005&&t<.995&&d<other.width*.51)return true;
  }
  return false;
}
function buildTrafficIslands(scene,solids){
  const grass=new Batch(),edge=new Batch();
  for(const f of city.trafficIsland||[]){
    for(const crossing of f.crossings||[])polygon(grass,crossing.p,p=>groundHeight(...p)+.145,'#929593',2);
    for(const part of f.parts||[{p:f.p}]){
      polygon(grass,part.p,p=>groundHeight(...p)+.2,f.s==='grass'?'#7d945b':'#929593',2,part.holes||[]);
      for(const ring of [part.p,...(part.holes||[])])for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],ya=groundHeight(...a),yb=groundHeight(...b);
        edge.quad([a[0],ya-.02,a[1]],[b[0],yb-.02,b[1]],[b[0],yb+.2,b[1]],[a[0],ya+.2,a[1]],'#a4a5a0');
        ribbon(edge,a,b,.18,ya+.205,yb+.205,'#b3b3aa');
        solids.addSegment([a[0],ya,a[1]],[b[0],yb,b[1]],.18,.2,{kind:'traffic_island',id:f.id});
      }
    }
  }
  grass.mesh(scene);edge.mesh(scene);
}
const medianVegetation=[];
function buildMedians(scene){
  medianVegetation.length=0;
  const concrete=new Batch(),pavers=new Batch();
  let count=0;
  const draw=(a,b,ya,yb,width,f)=>{
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<.1)return;
    prism(concrete,a,b,width,ya+.20,yb+.20,.20,'#b5b8b4');
    const plantedMedian=/Capucienenlaan|Béthunelaan|Zwembadlaan/.test(f.n||'')&&width>1.2;
    ribbon(pavers,a,b,Math.max(.1,width/2-.13),ya+.205,yb+.205,plantedMedian?'#70804e':'#90968e');
    if(plantedMedian){
      const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
      const crossing=(city.crossing||[]).some(q=>Math.hypot(q.p[0]-x,q.p[1]-z)<9);
      if(!crossing&&!medianVegetation.some(q=>Math.hypot(q.p[0]-x,q.p[1]-z)<10))
        medianVegetation.push({p:[x,z],h:(f.n==='Zwembadlaan'?13:10)+pick(x+z,8)*3,kind:'tree',median:true});
    }
    const s=segment(a,b,f,width);s.ya=ya;s.yb=yb;register(medians,s,width+1);count++;
  };
  for(const f of city.road){
    if((!['primary','secondary','trunk'].includes(f.c)&&f.n!=='Zwembadlaan')||f.b||f.u)continue;
    const nodes=nodesForLine(f.p,lineProfile(f,.135));
    // A third lane with only one through lane in each direction is the
    // mapped separation strip; turn lanes remain available at junctions.
    const strip=!f.one&&Number(f.lanes)>=3&&f.lf==='1'&&f.lb==='1'&&!/left|right/.test(f.turn||'')&&
      (f.change==='no|no'||f.n==='Gentse steenweg'||f.divider==='kerb'||f.divider==='raised');
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i],mid=[(a.p[0]+b.p[0])/2,(a.p[1]+b.p[1])/2];
      const own=nearest(roads,...mid,g=>g===f);
      if(!own)continue;
      if(strip){
        const crossing=roads.get(...mid).some(s=>s.f!==f&&!isPath(s.f)&&s.f.n!==f.n&&projection(s,...mid).d<s.width/2+3);
        const zebra=(city.crossing||[]).some(q=>Math.hypot(q.p[0]-mid[0],q.p[1]-mid[1])<3);
        if(!crossing&&!zebra)draw(a.p,b.p,a.y,b.y,1.15,f);
      }
      if(!f.one||!f.n)continue;
      const peer=nearest(roads,...mid,g=>g.id!==f.id&&g.one&&g.n===f.n&&g.c===f.c);
      if(!peer||f.id>peer.f.id||peer.d>22||peer.d<roadWidth(f)/2+peer.width/2+.6)continue;
      const dot=(own.dx*peer.dx+own.dz*peer.dz)/(own.length*peer.length)*f.one*peer.f.one;
      if(dot>-.82)continue;
      const gap=peer.d-roadWidth(f)/2-peer.width/2;
      const sign=(lerp(peer.a[0],peer.b[0],peer.t)-mid[0])*a.n[0]+(lerp(peer.a[1],peer.b[1],peer.t)-mid[1])*a.n[1]>0?1:-1;
      const offset=sign*(roadWidth(f)/2+gap/2);
      const A=edge(a,offset),B=edge(b,offset);
      const junction=roads.get(...mid).some(s=>s.f.n!==f.n&&!isPath(s.f)&&projection(s,(A[0]+B[0])/2,(A[2]+B[2])/2).d<s.width/2+3);
      if(!junction)draw([A[0],A[2]],[B[0],B[2]],a.y,b.y,Math.min(6,gap),f);
    }
  }
  concrete.mesh(scene);paintPavers(pavers,scene,[.20,.10]);
  scene.userData.medianSegments=count;
}
function paintPavers(batch,scene,size,rotation=.08){
  const mesh=batch.mesh(scene);
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.paverSize={value:new T.Vector2(...size)};
    shader.uniforms.paverRotation={value:rotation};
    shader.vertexShader='varying vec2 pavingPosition;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\n pavingPosition=position.xz;'
    );
    shader.fragmentShader='varying vec2 pavingPosition; uniform vec2 paverSize; uniform float paverRotation;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',`#include <color_fragment>
        float c=cos(paverRotation),s=sin(paverRotation);
        vec2 cell=(mat2(c,-s,s,c)*pavingPosition)/paverSize;
        // Derivatives must precede the discontinuous alternating-row offset.
        vec2 aa=fwidth(cell);
        cell.x+=mod(floor(cell.y),2.0)*0.5;
        vec2 tile=floor(cell);
        vec2 seam=min(fract(cell),1.0-fract(cell));
        float grout=1.0-min(smoothstep(0.018,0.046+aa.x,seam.x),smoothstep(0.018,0.046+aa.y,seam.y));
        float detail=1.0-smoothstep(0.08,0.45,max(aa.x,aa.y));
        float variation=fract(sin(dot(tile,vec2(127.1,311.7)))*43758.5453)-0.5;
        diffuseColor.rgb*=1.0+(variation*0.20-grout*0.27)*detail;`
    );
  };
}
function roadJunctions(){
  const junctions=new Map();
  for(const f of city.road){
    for(const i of [0,f.p.length-1]){
      const p=f.p[i],key=p.join(',');
      if(!junctions.has(key))junctions.set(key,[]);
      const apron=retainingApronLevel(...p);
      junctions.get(key).push({f,h:apron!==null&&!f.b&&!f.stationGround?apron+.135:f.y?.[i]??height(...p)+.135});
    }
  }
  const heights=new Map();
  for(const [key,entries] of junctions){
    const bridges=entries.filter(p=>p.f.b||p.f.id===303373542);
    const values=(bridges.length?bridges:entries).map(p=>p.h).sort((a,b)=>a-b);
    const middle=Math.floor(values.length/2);
    heights.set(key,values.length%2?values[middle]:(values[middle-1]+values[middle])/2);
  }
  return heights;
}
function roadSurfaceStyle(f){
  if(/cobblestone|sett|unhewn/.test(f.s))return 'setts';
  if(/paving_stones|brick/.test(f.s))return 'blocks';
  return f.s==='concrete'?'concrete':'asphalt';
}
const roadRanks={motorway:9,trunk:8,primary:7,secondary:6,tertiary:5,residential:4,unclassified:4,living_street:3,service:2,cycleway:1};
function compatibleRoadSource(s,patch){
  const f=s.f,cycleSource=f.c==='cycleway'||[f.cy,f.cb,f.cl,f.cr].some(v=>['lane','track','opposite_lane'].includes(v));
  if(patch.style.startsWith('cycle')?!cycleSource:(isPath(f)||roadSurfaceStyle(f)!==patch.style))return false;
  if((f.l||0)!==patch.l||!!f.t!==patch.t)return false;
  return patch.rank===undefined||((roadRanks[f.c]||0)===patch.rank&&Math.abs(roadWidth(f)-patch.width)<=.01);
}
function mergedRoadLevel(p,patch,sources){
  if(patch.style==='cycle-grey'||patch.style==='n9-paving')return n9DeckHeight(...p)+.105;
  if(patch.rank===7&&patch.width===7.2)return n9DeckHeight(...p)+.028;
  const candidates=[];
  for(const s of sources.get(...p)){
    const q=projection(s,...p);
    candidates.push({s,t:q.t,d:q.d,rank:q.d/Math.max(1,s.width)});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  const best=candidates[0];
  if(!best)return height(...p)+.16;
  const y=lerp(best.s.ya,best.s.yb,best.t);
  // Blend only compatible at-grade approaches; never mix stacked crossings.
  let sum=0,weights=0;
  for(const q of candidates.slice(0,4)){
    const h=lerp(q.s.ya,q.s.yb,q.t);
    if(Math.abs(h-y)>.65||q.d>q.s.width/2+.8)continue;
    const w=1/(.4+q.d*q.d);sum+=h*w;weights+=w;
  }
  return (weights?sum/weights:y)+.028;
}
function* buildRoads(scene){
  let deadline=performance.now()+6;
  const curbs=new Batch(),lanes=new Batch(),lines=new Batch(),structures=new Batch();
  const blocks=new Batch(),setts=new Batch();
  const linesByRoad=[];
  const junctions=roadJunctions();
  // Compatibility depends on patch metadata, not each sampled vertex. Filter
  // each spatial cell once per style/layer and reuse it across all patches.
  const sourceGroups=new Map();
  const sourcesFor=patch=>{
    const key=JSON.stringify([patch.style,patch.l,patch.t,patch.rank,patch.width]);
    if(!sourceGroups.has(key)){
      const cells=new Map();sourceGroups.set(key,{get(x,z){
        const cell=Math.floor(x/24)+','+Math.floor(z/24);
        if(!cells.has(cell))cells.set(cell,(roads.cells.get(cell)||[]).filter(s=>compatibleRoadSource(s,patch)));
        return cells.get(cell);
      }});
    }
    return sourceGroups.get(key);
  };
  for(const f of city.road){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+6;}
    if(f.fw==='crossing')continue;
    const width=roadWidth(f),y=lineProfile(f,.135);

    const nodes=nodesForLine(f.p,y);
    if(!f.y&&!stationAccessIds.has(f.id)){
      for(const [i,node] of nodes.entries()){
        const elevation=height(...node.p);
        if(i===0||i===nodes.length-1||!gradesTerrain(f)){
          node.y=elevation+.135;
          continue;
        }
        const before=height(...nodes[Math.max(0,i-2)].p);
        const after=height(...nodes[Math.min(nodes.length-1,i+2)].p);
        const grade=Math.abs(after-before)/Math.max(.1,nodes[Math.min(nodes.length-1,i+2)].d-nodes[Math.max(0,i-2)].d);
        node.y=lerp(elevation,(before+after)*.5,grade>.24?.48:.22)+.135;
      }
    }
    if(!f.b&&!f.u&&!f.stationGround&&!f.stationUpper)for(const node of nodes){const apron=retainingApronLevel(...node.p);if(apron!==null)node.y=apron+.135;}
    const length=nodes.at(-1).d;
    for(const side of [0,1]){
      const end=side?nodes.length-1:0;
      const reference=nodes[end].y,target=(f.stationGround||f.stationUpper)?reference:junctions.get(f.p[side?f.p.length-1:0].join(','));
      if(!Number.isFinite(target))continue;
      const delta=target-reference,blendLength=Math.min(length*.48,Math.max(7,Math.abs(delta)*12));
      if(blendLength<=0)continue;
      for(const node of nodes){
        const d=side?length-node.d:node.d;
        if(d>=blendLength)continue;
        const t=1-d/blendLength;
        node.y+=delta*t*t*(3-2*t);
      }
    }
    const segments=[];
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i],s=segment(a.p,b.p,f,width);
      if(s.length<.02||(!inside(...a.p,-38)&&!inside(...b.p,-38)))continue;
      s.ya=a.y;s.yb=b.y;
      register(roads,s,Math.max(15,width));
      if(f.id===216471544)for(const side of [-1,1]){
        const A=edge(a,side*(width/2+1.025)),B=edge(b,side*(width/2+1.025));
        const path=segment([A[0],A[2]],[B[0],B[2]],{...f,c:'cycleway',id:'sint-anna-side-'+side},2.05);
        path.ya=a.y+.11;path.yb=b.y+.11;register(roads,path,4);
      }
      segments.push({s,a,b});
    }
    linesByRoad.push({f,segments,length:nodes.at(-1).d});
  }
  const cycleLinks=bridgeCycleLinks(linesByRoad,roadWidth),linkIndex=new Hash();
  scene.userData.bridgeCycleLinks=cycleLinks.length;
  for(const link of cycleLinks){
    const [a,b]=link.corners,points=[a.road,b.road,b.cycle,a.cycle];
    const x=points.reduce((v,p)=>v+p[0],0)/4,z=points.reduce((v,p)=>v+p[2],0)/4;
    link.x=x;link.z=z;
    linkIndex.insert(link,Math.min(...points.map(p=>p[0]))-5,Math.min(...points.map(p=>p[2]))-5,Math.max(...points.map(p=>p[0]))+5,Math.max(...points.map(p=>p[2]))+5);
    const alreadyPaved=(city.roadSurface||[]).some(p=>p.style==='n9-paving'&&contains(x,z,p.p)&&!(p.holes||[]).some(h=>contains(x,z,h)));
    if(!alreadyPaved){
      blocks.quad(...points,'#929798');
      const bottom=points.map(p=>[p[0],p[1]-.62,p[2]]);
      structures.quad(...bottom.slice().reverse(),'#676d68');
      for(let i=0;i<4;i++){const j=(i+1)%4;structures.quad(points[i],points[j],bottom[j],bottom[i],'#676d68');}
    }
    const A=[(a.road[0]+a.cycle[0])/2,(a.road[2]+a.cycle[2])/2],B=[(b.road[0]+b.cycle[0])/2,(b.road[2]+b.cycle[2])/2];
    const f={c:'cycleway',b:true,l:1,id:'bridge-link-'+link.path};
    const strip=segment(A,B,f,Math.max(Math.hypot(a.road[0]-a.cycle[0],a.road[2]-a.cycle[2]),Math.hypot(b.road[0]-b.cycle[0],b.road[2]-b.cycle[2])));
    strip.ya=(a.road[1]+a.cycle[1])/2;strip.yb=(b.road[1]+b.cycle[1])/2;register(roads,strip,5);
  }
  for(const {f,segments,length} of linesByRoad){
    const width=roadWidth(f),half=width/2,foot=isPath(f);
    const cycle=f.c==='cycleway',cobbles=/cobblestone|sett|unhewn/.test(f.s);
    const unpaved=/^(unpaved|ground|dirt|sand|grass|gravel|fine_gravel|earth|woodchips|compacted)$/.test(f.s)||
      (!f.s&&['path','track','bridleway'].includes(f.c));
    const pavedBlocks=/paving_stones|brick/.test(f.s)||(!f.s&&(f.fw==='sidewalk'||f.c==='pedestrian'||f.c==='footway'));
    const pavement=cobbles?setts:pavedBlocks?blocks:lanes;
    const shade=unpaved?(f.s.includes('gravel')?'#8c8c85':'#8e826c'):
      cycle?(pavedBlocks?'#94675f':'#875b54'):
      cobbles?'#737b81':pavedBlocks?(f.s==='brick'?'#8b726b':'#909394'):
      f.s==='concrete'?'#85898b':'#55595c';
    const priority=foot?.004:f.c==='service'?.012:.025+(width-5)*.002;
    const offset=priority+pick(f.id)*.008;
    for(const {s,a,b} of segments){
      if(f.c==='steps'){
        const spacing=length/(Number(f.steps)||Math.max(2,Math.round(length/.34)));
        if(spacing>.025){
          const n=Math.ceil(s.length/spacing);
          for(let j=0;j<n;j++){
            const u=j/n,v=(j+1)/n;
            const q=[lerp(a.p[0],b.p[0],u),lerp(a.p[1],b.p[1],u)],r=[lerp(a.p[0],b.p[0],v),lerp(a.p[1],b.p[1],v)];
            const top=Math.max(lerp(a.y,b.y,u),lerp(a.y,b.y,v))+.045;
            ribbon(blocks,q,r,half,top,top,'#8c9092');
            prism(curbs,q,r,width,top,top,Math.max(.12,Math.abs(a.y-b.y)/n+.025),'#777a7c');
          }
        }
      }else{
        const x=(a.p[0]+b.p[0])/2,z=(a.p[1]+b.p[1])/2;
        const covered=foot&&!cycle&&f.c!=='pedestrian'&&competingRoad(x,z,s,(a.y+b.y)/2);
        if(!covered&&((foot&&!(cycle&&mergedCycleSurfaces))||!city.roadSurface?.length))band(pavement,a,b,-half,half,offset,shade);
      }
      if(f.n==='Brusselse steenweg'&&f.c==='primary'){
        const patch={style:'asphalt',l:f.l||0,t:!!f.t,rank:7,width};
        band(lines,{...a,y:mergedRoadLevel(a.p,patch)},{...b,y:mergedRoadLevel(b.p,patch)},-.065,.065,.035,'#f0f0e7');
      }
      if(f.id!==216471544&&f.n!=='Brusselse steenweg'&&!foot&&width>=7&&!f.one&&Math.floor(a.d/4.8)%2===1&&length>12&&!competingRoad(...a.p,s,a.y)){
        band(lines,a,b,-.055,.055,offset+.026,'#eee1bc');
      }
      if(f.b)prism(structures,a.p,b.p,f.n==='Brusselse steenweg'?15.56:width+(f.id===216471544?4.2:foot?.25:1.4),a.y,b.y,.62,foot?'#817e73':'#676d68');
      for(const side of [-1,1]){
        if([1495628495,1498324983,1498324984,1498324985,1498324988,1498324989,1498324990,1498324991,1498324992].includes(f.id))band(lines,{...a,y:n9DeckHeight(...a.p)},{...b,y:n9DeckHeight(...b.p)},side*(half-.12)-.035,side*(half-.12)+.035,.13,'#e8e8de');
        const q=edge(a,side*(half+.55));
        const end=edge(b,side*(half+.55));
        const junction=competingRoad(q[0],q[2],s,a.y)||
          competingRoad(end[0],end[2],s,b.y)||
          competingRoad((q[0]+end[0])/2,(q[2]+end[2])/2,s,(a.y+b.y)/2);
        if(!foot&&(!junction||f.id===216471544)){
          const tag=side===1?f.cl:f.cr;
          const cycleLane=[tag,f.cb,f.cy].some(v=>v==='lane'||v==='track'||v==='opposite_lane');
          if(cycleLane&&!mergedCycleSurfaces)band(lanes,a,b,side*(half-1.13),side*half,offset+.016,'#895f58');
          const sidewalk=side===1?'left':'right';
          const sidewalkTag=f.sw==='both'||f.sw==='yes'||f.sw===sidewalk;
          const main=['primary','secondary','tertiary','residential','unclassified','living_street'].includes(f.c);
          const shoulder=side===-1?(f.shoulderParking||0):0;
          let walkEdge=half+shoulder+(shoulder?1.55:0),mappedWalk=false;
          if(shoulder){
            const mx=(a.p[0]+b.p[0])/2,mz=(a.p[1]+b.p[1])/2;
            for(const other of roads.get(mx,mz)){
              if(!['cycleway','footway'].includes(other.f.c)||(other.f.l||0)!==(f.l||0))continue;
              if(Math.abs(s.dx*other.dx+s.dz*other.dz)/(s.length*other.length)<.9)continue;
              const q=projection(other,mx,mz);if(q.d>12)continue;
              const px=lerp(other.a[0],other.b[0],q.t),pz=lerp(other.a[1],other.b[1],q.t);
              if(((px-mx)*s.dz-(pz-mz)*s.dx)*side<=0)continue;
              if(other.f.c==='cycleway')walkEdge=Math.max(half+shoulder,q.d+other.width/2+.15);
              if(other.f.c==='footway')mappedWalk=true;
            }
          }
          if(shoulder){
            const shoulderPoint=(node,off)=>{const p=edge(node,off,.028);p[1]=Math.max(p[1],groundHeight(p[0],p[2])+.18);return p;};
            lanes.quad(shoulderPoint(a,-half),shoulderPoint(b,-half),shoulderPoint(b,-half-shoulder),shoulderPoint(a,-half-shoulder),'#686d70');
            band(lines,a,b,-half-.035,-half+.035,.045,'#dfdfd2');
          }
          if(main&&!mappedWalk&&(sidewalkTag||shoulder||(!f.sw&&length>14&&!f.u&&!f.b))){
            band(blocks,a,b,side*walkEdge,side*(walkEdge+(f.id===216471544?2.05:1.15)),.11,'#999c9d');
            curbs.quad(edge(a,side*walkEdge,offset),edge(b,side*walkEdge,offset),edge(b,side*walkEdge,.11),edge(a,side*walkEdge,.11),'#777c7e');
          }
          const park=side===1?f.pl:f.pr;
          if([park,f.pb].some(v=>v&&v!=='no'&&v!=='separate')&&length>12){
            band(blocks,a,b,side*half,side*(half+1.8),offset+.009,'#777c7e');
            band(lines,a,b,side*(half+1.73),side*(half+1.8),offset+.025,'#e0d7bf');
            if(Math.floor(a.d/5.1)!==Math.floor(b.d/5.1)){
              const start=edge(b,side*half,offset+.026),end=edge(b,side*(half+1.8),offset+.026);
              ribbon(lines,[start[0],start[2]],[end[0],end[2]],.045,start[1],end[1],'#e0d7bf');
            }
          }
        }
        const mx=(a.p[0]+b.p[0])/2,mz=(a.p[1]+b.p[1])/2;
        const railPoint=edge(a,side*half);
        const joinedDeck=linkIndex.get(mx,mz).some(link=>(link.road===f.id||link.path===f.id)&&
          (railPoint[0]-a.p[0])*(link.x-mx)+(railPoint[2]-a.p[1])*(link.z-mz)>0);
        if(!joinedDeck&&f.b&&f.n!=='Brusselse steenweg'&&![1498324985,1498324992].includes(f.id)&&(!foot||cycle||f.c==='path'||f.c==='footway')){
          const off=side*(half+(f.id===216471544?2.05:foot?0:.62));
          // Parapets belong to the outside of the combined bridge deck. A
          // joining slip road must not acquire a fence across the main lane.
          const railStart=edge(a,off),railEnd=edge(b,off);
          const obstructsLane=[0,.5,1].some(t=>{
            const x=lerp(railStart[0],railEnd[0],t),z=lerp(railStart[2],railEnd[2],t),y=lerp(a.y,b.y,t);
            return roads.get(x,z).some(other=>{
              if(other.f===f||isPath(other.f))return false;
              const q=projection(other,x,z);
              return q.d<other.width/2+.15&&Math.abs(lerp(other.ya,other.yb,q.t)-y)<.75;
            });
          });
          if(obstructsLane)continue;
          if(f.id===216471544){
            for(const up of [.28,.46,.65,.84,1.08]){
              band(structures,a,b,off-.025,off+.025,up,'#b6bdbb');
              structures.quad(edge(a,off,up-.022),edge(b,off,up-.022),edge(b,off,up+.022),edge(a,off,up+.022),'#b6bdbb');
            }
            if(Math.floor(a.d/2.8)!==Math.floor(b.d/2.8)||a.d===0){const q=edge(a,off,.6);addBox(structures,...q,.065,1.2,.065,'#b6bdbb');}
            continue;
          }
          band(structures,a,b,off-.045,off+.045,.94,'#64736d');
          band(structures,a,b,off-.038,off+.038,.53,'#77847b');
          if(Math.floor(a.d/4)!==Math.floor(b.d/4)||a.d===0){
            const [x,y,z]=edge(a,off,.49);
            addBox(structures,x,y,z,.09,.98,.09,'#64736d');
          }
        }
      }
    }
  }
  for(const patch of city.roadSurface||[]){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+6;}
    const batch=patch.style==='setts'?setts:(patch.style==='blocks'||patch.style==='n9-paving')?blocks:lanes;
    const shade={setts:'#737b81',blocks:'#909394',concrete:'#85898b',asphalt:'#55595c',cycle:'#875b54','cycle-grey':'#929798','n9-paving':'#929798'}[patch.style];
    const sources=sourcesFor(patch);
    polygon(batch,patch.p,p=>mergedRoadLevel(p,patch,sources),shade,(patch.style==='cycle-grey'||patch.style==='n9-paving'||patch.rank===7&&patch.width===7.2)?2.4:10,patch.holes||[]);
  }
  for(const f of city.square||[])polygon(setts,f.p,p=>height(...p)+.10,'#81878a',5);
  for(const {p:[x,z],marked} of city.crossing||[]){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+6;}
    if(!marked||!inside(x,z))continue;
    const s=nearest(roads,x,z,f=>!isPath(f));
    if(!s||s.d>s.width*.66)continue;
    const u=s.dx/s.length,v=s.dz/s.length,c=[lerp(s.a[0],s.b[0],s.t),lerp(s.a[1],s.b[1],s.t)];
    const y=lerp(s.ya,s.yb,s.t)+.065;
    for(let side=-s.width/2+.27;side<s.width/2-.16;side+=.64){
      const a=[c[0]+v*side-u*1.35,c[1]-u*side-v*1.35];
      const b=[c[0]+v*side+u*1.35,c[1]-u*side+v*1.35];
      ribbon(lines,a,b,.19,y,y,'#f2edda');
    }
  }
  curbs.mesh(scene);lanes.mesh(scene);lines.mesh(scene);structures.mesh(scene).castShadow=true;
  paintPavers(blocks,scene,[.21,.105]);
  paintPavers(setts,scene,[.135,.14],.23);
}
function buildRail(scene){
  // Platform heights are already derived from the railway at their ends.
  // Keep adjacent station tracks at that same grade rather than following
  // individual raster bumps under the station roofs.
  const stationRailSegments=[];
  for(const f of city.rail||[]){const y=lineProfile(f,.15);for(let i=1;i<f.p.length;i++){
    const a=f.p[i-1],b=f.p[i];if(Math.max(a[0],b[0])< -550||Math.min(a[0],b[0])>0||Math.max(a[1],b[1])< -750||Math.min(a[1],b[1])> -300)continue;
    stationRailSegments.push({a,b,ya:y[i-1],yb:y[i]});
  }}
  const rawRailHeight=(x,z)=>{let best=Infinity,y=height(x,z)+.15;for(const s of stationRailSegments){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[1])*dz)/(dx*dx+dz*dz||1))),d=(x-s.a[0]-dx*t)**2+(z-s.a[1]-dz*t)**2;if(d<best){best=d;y=lerp(s.ya,s.yb,t);}}return y;};
  const stationGrades=platformProfiles(rawRailHeight);
  const stationTrackHeight=(p,y)=>{let best=Infinity,grade=y;for(const f of stationGrades){
    if(p[0]<f.bounds[0]-8||p[0]>f.bounds[2]+8||p[1]<f.bounds[1]-8||p[1]>f.bounds[3]+8)continue;
    let d=contains(...p,f.p)?0:Infinity;
    for(let i=1;i<f.p.length;i++){const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));d=Math.min(d,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t));}
    if(d<best){best=d;grade=f.y(...p)-(Math.max(0,Math.min(1,parseFloat(f.tags.height)||.76))+.16);}
  }return best<8?lerp(grade,y,Math.max(0,(best-4)/4)):y;};
  const ballast=new Batch(),steel=new Batch(),ties=new Batch(),decks=new Batch(),wires=new Batch();
  for(const f of city.rail||[]){
    const y=lineProfile(f,.15).map((y,i)=>stationTrackHeight(f.p[i],y));
    let distance=0;
    for(let i=1;i<f.p.length;i++){
      const a=f.p[i-1],b=f.p[i],s=segment(a,b,f,3.3);
      if(s.length<.025||(!inside(...a,-50)&&!inside(...b,-50)))continue;
      s.ya=y[i-1];s.yb=y[i];register(rails,s,48);
      if(f.portalSpans?.some(([a,b])=>i>a&&i<=b)){
        const cut={...s,width:4.5};register(railCuts,cut,7);
        ribbon(ballast,a,b,2.30,s.ya-.17,s.yb-.17,'#77786e');
      }
      ribbon(ballast,a,b,1.63,s.ya,s.yb,'#776f65');
      if(f.b||f.l>0)prism(decks,a,b,3.28,s.ya,s.yb,f.b?.53:Math.max(.6,s.ya-height(...a)),'#696965');
      for(const side of [-.717,.717]){
        ribbon(steel,a,b,.045,s.ya+.16,s.yb+.16,'#d4c5b4',side);
        ribbon(steel,a,b,.035,s.ya+.095,s.yb+.095,'#69655e',side);
      }
      const t0=Math.ceil(distance/.68)*.68-distance;
      for(let d=t0;d<s.length;d+=.68){
        const t=d/s.length,v=Math.min(1,(d+.23)/s.length),h=lerp(s.ya,s.yb,t)+.078;
        const q=[lerp(a[0],b[0],t),lerp(a[1],b[1],t)],r=[lerp(a[0],b[0],v),lerp(a[1],b[1],v)];
        ribbon(ties,q,r,1.25,h,h,'#514946');
      }
      if(!f.s&&!f.t)ribbon(wires,a,b,.012,s.ya+5.55,s.yb+5.55,'#596360');
      distance+=s.length;
    }
  }
  for(const f of city.structure||[]){
    if(!f.rail||[797639481,797639482,797639483].includes(f.id))continue;
    const [x,z]=center(f.p),s=nearest(rails,x,z);
    if(!s||!inside(x,z,-30))continue;
    const dx=s.dx/s.length,dz=s.dz/s.length;
    const along=q=>(q[0]-x)*dx+(q[1]-z)*dz;
    const cross=q=>(q[0]-x)*dz-(q[1]-z)*dx;
    const project=(a,c)=>[x+dx*a+dz*c,z+dz*a-dx*c];
    const u=f.p.map(along),v=f.p.map(cross);
    const a=Math.min(...u),b=Math.max(...u),left=Math.min(...v),right=Math.max(...v);
    const deck=railHeight(x,z)-.055;
    polygon(decks,f.p,()=>deck,'#767873');
    polygon(decks,f.p,()=>deck-.63,'#6c6c66');
    for(let i=1;i<f.p.length;i++){
      const [p,q]=[f.p[i-1],f.p[i]];
      decks.quad([p[0],deck,p[1]],[q[0],deck,q[1]],[q[0],deck-.63,q[1]],[p[0],deck-.63,p[1]],'#71746e');
    }
    const historic=[797639481,797639482,797639483].includes(f.id);
    const arch=f.c==='arch'||historic,color=historic?'#80594b':f.material==='brick'||arch?'#80604e':'#7b786c';
    if(f.id===797639480){
      for(const side of [left,right]){
        const A=project(a,side),B=project(b,side),L=b-a,yaw=-Math.atan2(dz,dx),cx=(A[0]+B[0])/2,cz=(A[1]+B[1])/2;
        addBox(decks,cx,deck-.56,cz,L,1.02,.32,'#777c72',yaw);
        for(const y of [deck-.09,deck-1.02])addBox(decks,cx,y,cz,L,.12,.52,'#61695f',yaw);
        for(let d=a+.5;d<b;d+=3){const p=project(d,side);addBox(decks,p[0],deck-.56,p[1],.08,.94,.37,'#626a61',yaw);}
        for(const y of [deck+.45,deck+.87])addBox(decks,cx,y,cz,L,.045,.055,'#58645b',yaw);
        for(let d=a+.2;d<b;d+=2.2){const p=project(d,side);addBox(decks,p[0],deck+.47,p[1],.065,.98,.065,'#58645b');}
      }
    }

    if(arch){
      const inset=Math.min(1.45,(b-a)*.17);
      const floor=Math.min(...[left,right].flatMap(c=>[.2,.5,.8].map(t=>height(...project(lerp(a,b,t),c)))));
      const spring=Math.min(deck-1.5,floor+2.1);
      const opening=(t,c)=>{
        const base=historic?spring:Math.min(deck-1.2,height(...project(lerp(a,b,t),c)));
        return base+(deck-.78-base)*Math.sqrt(Math.max(0,1-(2*t-1)**2));
      };
      for(let i=0;i<16;i++){
        const t=i/16,u=(i+1)/16;
        const at=(v,c,y)=>{const [px,pz]=project(lerp(a+inset,b-inset,v),c);return [px,y,pz];};
        for(const side of [left,right]){
          decks.quad(at(t,side,deck-.25),at(u,side,deck-.25),at(u,side,opening(u,side)),at(t,side,opening(t,side)),color);
          if(historic){const face=side+(side===left?-.035:.035);decks.quad(at(t,face,opening(t,side)),at(u,face,opening(u,side)),at(u,face,opening(u,side)+.28),at(t,face,opening(t,side)+.28),'#a39a86');}
        }
        decks.quad(at(t,left,opening(t,left)),at(u,left,opening(u,left)),at(u,right,opening(u,right)),at(t,right,opening(t,right)),color);
      }
    }
    if(f.id===797639480){
      // Abutments follow the two short boundary chains of the actual OSM
      // bridge polygon, rather than the enclosing projected rectangle.
      for(const edge of [f.p.slice(0,5),f.p.slice(5,10)]){
        const groundSamples=edge.flatMap(p=>[-4,4].map(d=>height(p[0]+dx*d,p[1]+dz*d)));
        const base=Math.min(...groundSamples)-.18;
        for(let i=1;i<edge.length;i++){
          const A=edge[i-1],B=edge[i],L=Math.hypot(B[0]-A[0],B[1]-A[1]),yaw=-Math.atan2(B[1]-A[1],B[0]-A[0]);
          const cx=(A[0]+B[0])/2,cz=(A[1]+B[1])/2;
          addBox(decks,cx,(base+deck-.72)/2,cz,L+.02,deck-.72-base,1.3,'#80594b',yaw);
          addBox(decks,cx,base+.22,cz,L+.04,.44,1.5,'#8d887b',yaw);
          addBox(decks,cx,deck-.85,cz,L+.08,.3,1.65,'#a39c89',yaw);
        }
        for(const p of [edge[0],edge.at(-1)])addBox(decks,p[0],(base+deck-.72)/2,p[1],.38,deck-.72-base,1.42,'#a39c89',-Math.atan2(edge.at(-1)[1]-edge[0][1],edge.at(-1)[0]-edge[0][0]));
      }
      // Photo-confirmed intermediate quay pier separating river and road
      // spans. Inferred from the mapped east bank and reference photographs;
      // OSM does not carry a separate pier footprint in this extract.
      {
        // Skew pier: short faces follow the mapped bridge fascia, long faces
        // follow the quay road. These are deliberately not perpendicular.
        const ux=65.3/Math.hypot(65.3,31.76),uz=31.76/Math.hypot(65.3,31.76),yaw=-Math.atan2(uz,ux);
        // Extend each end 1.8 m along the quay axis beyond the fascia.
        // The visible corner posts project past the girders in both views.
        const A=[29.585,-335.56],B=[17.415,-360.70],base=7.55,top=deck+.02;
        const skew=(width,low,high,tint)=>{
          const ring=[[A[0]-ux*width/2,A[1]-uz*width/2],[A[0]+ux*width/2,A[1]+uz*width/2],[B[0]+ux*width/2,B[1]+uz*width/2],[B[0]-ux*width/2,B[1]-uz*width/2]];
          polygon(decks,[...ring,ring[0]],()=>high,tint);
          polygon(decks,[...ring.slice().reverse(),ring[3]],()=>low,tint);
          for(let i=0;i<4;i++){const p=ring[i],q=ring[(i+1)%4];decks.quad([p[0],low,p[1]],[q[0],low,q[1]],[q[0],high,q[1]],[p[0],high,p[1]],tint);}
        };
        skew(2.5,base,top,'#80594b');skew(2.85,base,base+.56,'#8d887b');skew(3.05,top-.02,top+.26,'#a39c89');
        for(const p of [A,B])for(const side of [-1,1])addBox(decks,p[0]+ux*side*1.1,(base+top)/2,p[1]+uz*side*1.1,.3,top-base,.4,'#a39c89',yaw);
        for(const end of [A,B]){
        for(const side of [-1,1]){
          const px=end[0]+ux*side*1.24,pz=end[1]+uz*side*1.24;
          addBox(decks,px,(base+deck+1.05)/2,pz,.48,deck+1.05-base,.48,'#918b7b',yaw);
          addBox(decks,px,deck+1.08,pz,.56,.14,.56,'#9b9482',yaw);
        }
        addBox(decks,...[end[0],deck+.12,end[1]],2.2,.2,.3,'#80594b',yaw);
        addBox(decks,...[end[0],deck+.94,end[1]],2.2,.18,.35,'#918b7b',yaw);
        for(const q of [-.8,-.4,0,.4,.8])addBox(decks,end[0]+ux*q,deck+.53,end[1]+uz*q,.12,.68,.3,'#80594b',yaw);
        }
      }
      continue;
    }
    for(const end of [a+.52,b-.52]){
      const [px,pz]=project(end,(left+right)/2);
      // Ground samples on the bridge itself contain the raised railway level.
      // Anchor abutments to adjacent ground, not to that elevated surface.
      const base=f.id===797639480?Math.min(...[left-3,right+3].flatMap(c=>[-3,0,3].map(d=>height(...project(end+d,c)))))-.18:Math.min(deck-1,height(px,pz)-.18);
      if(deck-base>.85){
        const yaw=-Math.atan2(dz,dx),brick=f.id===797639480?'#80594b':color;
        addBox(decks,px,(deck+base)/2-.2,pz,1.3,deck-base,right-left,brick,yaw);
        if(f.id===797639480){
          addBox(decks,px,base+.24,pz,1.55,.48,right-left+.2,'#8d887b',yaw);
          addBox(decks,px,deck-.9,pz,1.65,.35,right-left+.3,'#a39c89',yaw);
          for(const c of [left+.14,right-.14]){const p=project(end,c);addBox(decks,p[0],(base+deck-.7)/2,p[1],1.38,deck-.7-base,.3,'#a39c89',yaw);}
        }
      }
    }
  }
  ballast.mesh(scene);ties.mesh(scene);steel.mesh(scene);wires.mesh(scene);
  const deckMesh=decks.mesh(scene);deckMesh.castShadow=true;dressMasonry(deckMesh.material);
  buildRailUnderpasses(scene);
}
function buildRailUnderpasses(scene){
  const groups=buildMergedRailUnderpasses({city,scene,Batch,height,dressMasonry,addBox,ribbon});
  for(const g of groups){
    if(g.clearance<5.65)continue;
    const middle=(g.left+g.right)/2;
    const A=[g.A[0]+g.nx*middle,g.A[1]+g.nz*middle],B=[g.B[0]+g.nx*middle,g.B[1]+g.nz*middle];
    const cut=segment(A,B,{b:false,u:true,id:'rail-cut'},g.right-g.left);
    cut.ya=g.floorA;cut.yb=g.floorB;register(railCuts,cut,(g.right-g.left)/2+3);
  }
}
function buildRoadRetainingWalls(scene){
  const masonry=new Batch(),paving=new Batch(),backing=new Batch(),railings=new Batch();
  for(const f of city.road){
    if(f.n!=='Brusselse steenweg'||!f.y||isPath(f))continue;
    const nodes=nodesForLine(f.p,lineProfile(f,.135));
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i];
      if(a.p[0]<420||a.p[0]>850||a.p[1]<350||a.p[1]>650)continue;
      for(const side of [-1,1]){
        const offset=7.9*side;
        const A=[a.p[0]+a.n[0]*offset,a.p[1]+a.n[1]*offset],B=[b.p[0]+b.n[0]*offset,b.p[1]+b.n[1]*offset];
        const low=(p,node)=>Math.min(...[2,5,8].map(d=>height(p[0]+node.n[0]*side*d,p[1]+node.n[1]*side*d)));
        const bottomA=low(A,a),bottomB=low(B,b),topA=a.y+.09,topB=b.y+.09;
        if(Math.min(topA-bottomA,topB-bottomB)<1.1)continue;
        const wall=segment(A,B,f,.4);Object.assign(wall,{nx:-a.n[0]*side,nz:-a.n[1]*side,topA,topB,bottomA,bottomB,radius:14});register(stationWalls,wall,16);
        retainingFace(masonry,A,B,bottomA,bottomB,topA,topB,'#8a5f49');
        ribbon(masonry,A,B,.20,topA+.12,topB+.12,'#a6aaa3');
        band(railings,a,b,offset-.04,offset+.04,1.12,'#8c989a');
        if(Math.floor(a.d/1.4)!==Math.floor(b.d/1.4)||i===1){const q=edge(a,offset,.58);addBox(railings,q[0],q[1],q[2],.045,1.16,.045,'#8c989a');}
        const midpoint=[(a.p[0]+b.p[0])/2,(a.p[1]+b.p[1])/2];
        const half=roadWidth(f)/2,outer=Math.abs(offset)-.12;
        // A continuous structural backing closes small gaps at cycleway joins.
        // Paving and cycle finishes share the carriageway height profile.
        band(backing,a,b,side*(half-.08),side*outer,-.04,'#909696');
        const centerOffset=side*(half+outer)/2,PA=edge(a,centerOffset),PB=edge(b,centerOffset);
        const support=segment([PA[0],PA[2]],[PB[0],PB[2]],{...f,c:'footway',b:true,id:'deck-pavement-'+f.id},outer-half);
        support.ya=a.y-.04;support.yb=b.y-.04;register(roads,support,8);
        // Visible paving is clipped against road/cycle surfaces in the bake.
        // This mesh supplies only the continuous structural backing.
        if(i%4===0&&!retainingOpening(...A,topA))addBox(masonry,A[0],(bottomA+topA)/2,A[1],.46,topA-bottomA,.46,'#a1765c');
      }
    }
  }
  const mesh=masonry.mesh(scene);mesh.castShadow=true;dressMasonry(mesh.material);backing.mesh(scene);railings.mesh(scene);paintPavers(paving,scene,[.21,.105]);
}
function buildSintAnnaGear(scene){
  const road=city.road.find(f=>f.id===216471544);if(!road)return;
  const a=road.p[0],b=road.p.at(-1),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,nx=uz,nz=-ux,base=road.y[0];
  const gear=new Batch(),at=(along,across,y)=>[a[0]+ux*along+nx*across,base+y,a[1]+uz*along+nz*across];
  const profile=[[0,0],[1.45,0],[-4.55,6.6],[-8.8,6.6],[-8.8,5.2],[-4.727272727,5.2]];
  for(const side of [-1,1]){
    const along=side<0?5:length-3,across=6.2;
    const faces=profile.map(p=>new T.Vector2(...p));
    const q=(i,offset)=>at(along+offset,across-profile[i][0],profile[i][1]+.2);
    for(const ids of T.ShapeUtils.triangulateShape(faces,[]))for(const edge of [-.68,.68])gear.tri(...ids.map(i=>q(i,edge)),'#dce0dc');
    for(let i=0;i<profile.length;i++){const j=(i+1)%profile.length;gear.quad(q(i,-.68),q(j,-.68),q(j,.68),q(i,.68),'#cbd1cf');}
    const coping=at(along,across+6.675,6.835);addBox(gear,...coping,1.48,.075,4.25,'#626b68',-Math.atan2(uz,ux));
    const support=at(along,across+3.4,1.7);
    const bottom=Math.min(height(support[0],support[2]),riverLevel(support[2]))-.5,top=base+3.7;
    const corners=(y,w,d)=>[[-w,-d],[w,-d],[w,d],[-w,d]].map(([u,v])=>[support[0]+ux*u+nx*v,y,support[2]+uz*u+nz*v]);
    const foot=corners(bottom,.85,.9),cap=corners(top,.55,.6);
    for(let j=0;j<4;j++){const k=(j+1)%4;gear.quad(foot[j],foot[k],cap[k],cap[j],'#969b90');}
    gear.quad(...cap,'#aaa99b');
    const pivot=at(along,across+3.4,3.9);
    const hub=new T.Mesh(new T.CylinderGeometry(.46,.46,1.7,16),new T.MeshLambertMaterial({color:'#4c5a60'}));
    hub.position.set(...pivot);hub.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(ux,0,uz));hub.castShadow=true;scene.add(hub);
  }
  for(const [along,side] of [[3.5,-1],[length-3.5,1]]){
    const p=at(along,side*5.15,.55);addBox(gear,...p,.5,1.1,.55,'#d5d9d4');
    for(let i=0;i<14;i++){const q=at(along,side*5.15,1.15+i*.31);addBox(gear,...q,.13,.31,.12,i%2?'#d34b43':'#f1eee1');}
  }
  const paint=new Batch();
  for(const across of [-4.5,4.5])for(const along of [8,length-8]){
    const mark=(u,v)=>at(along+u,across+v,.145);
    const stroke=(a,b)=>{const p=mark(...a),q=mark(...b);ribbon(paint,[p[0],p[2]],[q[0],q[2]],.027,p[1],q[1],'#eceee8');};
    for(const u of [-.46,.46])for(let i=0;i<16;i++){
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      stroke([u+Math.cos(a)*.24,Math.sin(a)*.24],[u+Math.cos(b)*.24,Math.sin(b)*.24]);
    }
    for(const [a,b] of [[[ -.46,0],[-.12,.43]],[[-.12,.43],[.13,0]],[[.13,0],[-.46,0]],[[-.12,.43],[.32,.43]],[[.32,.43],[.13,0]],[[.32,.43],[.46,0]],[[.32,.43],[.32,.65]],[[.32,.65],[.5,.65]],[[-.23,.48],[.01,.48]]])stroke(a,b);
  }
  paint.mesh(scene);
  gear.mesh(scene).castShadow=true;
}
function addBox(batch,x,y,z,w,h,d,tint,yaw=0){
  batch.solids?.addBox(x,y,z,w,h,d,yaw);
  const cs=Math.cos(yaw),sn=Math.sin(yaw);
  const p=(a,b,c)=>[x+a*cs+c*sn,y+b,z-a*sn+c*cs];
  const a=p(-w/2,-h/2,-d/2),b=p(w/2,-h/2,-d/2),c=p(w/2,-h/2,d/2),e=p(-w/2,-h/2,d/2);
  const f=p(-w/2,h/2,-d/2),g=p(w/2,h/2,-d/2),i=p(w/2,h/2,d/2),j=p(-w/2,h/2,d/2);
  const previous=batch.boxCollision;batch.boxCollision=true;
  batch.quad(a,b,g,f,tint);batch.quad(b,c,i,g,tint);batch.quad(c,e,j,i,tint);batch.quad(e,a,f,j,tint);batch.quad(f,g,i,j,tint);batch.quad(e,c,b,a,tint);
  batch.boxCollision=previous;
}
function cone(batch,x,y,z,r,h,tint,sides=6,phase=0){
  for(let j=0;j<sides;j++){
    const p=k=>[x+Math.cos(k*2*Math.PI/sides+phase)*r,y,z+Math.sin(k*2*Math.PI/sides+phase)*r];
    batch.tri(p(j),p(j+1),[x,y+h,z],tint);
  }
}
function pitched(batch,p,y,col,base,wall='#a9a397'){
  // Split a triangulated footprint at a continuous ridge. A centroid fan
  // folds across courtyards and concave wings, producing self-intersections.
  let longest=0,ux=1,uz=0;
  for(let i=1;i<p.length;i++){
    const dx=p[i][0]-p[i-1][0],dz=p[i][1]-p[i-1][1],len=Math.hypot(dx,dz);
    if(len>longest){longest=len;ux=dx/len;uz=dz/len;}
  }
  const cross=q=>q[0]*(-uz)+q[1]*ux;
  const values=p.map(cross),low=Math.min(...values),high=Math.max(...values),mid=(low+high)/2;
  if(high-low<.1){polygon(batch,p,()=>base,col);return;}
  const top=q=>base+(y-base)*Math.max(0,1-Math.abs(cross(q)-mid)/((high-low)/2));
  const contour=p.slice(0,-1).map(q=>new T.Vector2(...q));
  for(const indices of T.ShapeUtils.triangulateShape(contour,[])){
    const tri=indices.map(i=>[contour[i].x,contour[i].y]);
    for(const sign of [-1,1]){
      const shape=[];
      for(let i=0;i<3;i++){
        const a=tri[i],b=tri[(i+1)%3],d=(cross(a)-mid)*sign,e=(cross(b)-mid)*sign;
        if(d>=0)shape.push(a);
        if((d>=0)!=(e>=0)){const t=d/(d-e);shape.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)]);}
      }
      for(let i=2;i<shape.length;i++)batch.tri(...[shape[0],shape[i-1],shape[i]].map(q=>[q[0],top(q),q[1]]),col);
    }
  }
  for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i],d=cross(a)-mid,e=cross(b)-mid;
    const points=[a];
    if(d*e<0){const t=d/(d-e);points.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)]);}
    points.push(b);
    for(let j=1;j<points.length;j++){
      const q=points[j-1],r=points[j];batch.quad([q[0],base,q[1]],[r[0],base,r[1]],[r[0],top(r),r[1]],[q[0],top(q),q[1]],wall);
    }
  }
}
function label(scene,text,x,y,z,yaw,width){
  const c=document.createElement('canvas');c.width=512;c.height=96;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#242d2b';ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle='#bd9f5d';ctx.lineWidth=4;ctx.strokeRect(5,5,502,86);
  ctx.font='bold 46px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff3c9';ctx.fillText(text,256,49,466);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  const mesh=new T.Mesh(new T.PlaneGeometry(width,width*96/512),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
  mesh.position.set(x,y,z);mesh.rotation.y=yaw;scene.add(mesh);
}
const passageRoutes=new Set([27382484,1549285749,1467066498,1467066499]);
function passage(x,z){
  const s=nearest(roads,x,z,f=>passageRoutes.has(f.id)||f.passage);
  return s&&s.d<(s.f.id===1467066498||s.f.id===1467066499?2.15:Math.min(1.8,s.width/2))?s:null;
}
export function buildingAt(x,z){
  return buildings.get(x,z).find(f=>contains(x,z,f.p)&&!stationGalleryOpen(f,x,z)&&!f.holes?.some(p=>contains(x,z,p))&&!(f.passage&&passage(x,z)));
}
function transportShelter(batch,f,solids){
  const p=f.p,[cx,cz]=center(p),platform=stationPlatforms.find(v=>contains(cx,cz,v.p)),base=platform?platform.y(cx,cz):height(cx,cz),roof=base+3.6;
  batch=Object.assign(Object.create(batch),{solids});
  polygon(batch,p,()=>roof,'#797e7d');polygon(batch,[...p].reverse(),()=>roof-.22,'#b5b8b2');
  for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];batch.quad([a[0],roof,a[1]],[b[0],roof,b[1]],[b[0],roof-.22,b[1]],[a[0],roof-.22,a[1]],'#7d817b');}
  const edge=p.slice(1).map((b,i)=>({a:p[i],b,L:Math.hypot(b[0]-p[i][0],b[1]-p[i][1])})).sort((a,b)=>b.L-a.L)[0];
  const ux=(edge.b[0]-edge.a[0])/edge.L,uz=(edge.b[1]-edge.a[1])/edge.L,ts=p.map(q=>(q[0]-cx)*ux+(q[1]-cz)*uz),lo=Math.min(...ts)+2,hi=Math.max(...ts)-2;
  const accessClear=(x,z)=>!city.road.some(r=>r.stationUpper&&r.p.slice(1).some((b,i)=>{const a=r.p[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<.65;}));
  for(let t=lo;t<=hi;t+=8){let x=cx+t*ux,z=cz+t*uz;if(!contains(x,z,p))continue;
    if(!accessClear(x,z)){const shift=[.8,-.8,1.6,-1.6].find(d=>contains(x+d*ux,z+d*uz,p)&&accessClear(x+d*ux,z+d*uz));if(shift===undefined)continue;x+=shift*ux;z+=shift*uz;}const y=platform?platform.y(x,z):base;addBox(batch,x,(y+roof-.22)/2,z,.22,roof-.22-y,.22,'#b9bab4');}
}
function canopy(batch,p,brand,solids){
  batch=Object.assign(Object.create(batch),{solids});
  const [x,z]=center(p),[a,b,c,d]=extents(p),y=height(x,z);
  const trim=/esso|total/i.test(brand)?'#c45142':/q8|dats/i.test(brand)?'#447987':'#767f6e';
  polygon(batch,p,()=>y+4.64,'#d3d0be');
  polygon(batch,p,()=>y+4.28,'#a5a79a');
  for(let i=1;i<p.length;i++){
    const [u,v]=[p[i-1],p[i]];
    batch.quad([u[0],y+4.28,u[1]],[v[0],y+4.28,v[1]],[v[0],y+4.64,v[1]],[u[0],y+4.64,u[1]],trim);
  }
  const longX=c-a>d-b;
  const spread=Math.max(.7,Math.min(5,Math.max(c-a,d-b)*.27));
  for(const side of [-1,1]){
    const u=x+(longX?spread*side:0),v=z+(longX?0:spread*side);
    if(!contains(u,v,p))continue;
    addBox(batch,u,y+2.16,v,.25,4.32,.25,'#c5c2b4');
    if(brand){
      addBox(batch,u+.44,y+.13,v,.91,.26,.85,'#a39f90');
      addBox(batch,u+.44,y+.77,v,.42,1.25,.42,trim);
      addBox(batch,u+.44,y+1.08,v,.45,.26,.46,'#dddcc8');
    }
  }
}
function buildParking(scene,solids){
  const asphalt=new Batch(),marks=new Batch();
  for(const f of city.parking||[]){
    const [x,z]=center(f.p);
    if(!inside(x,z,-25))continue;
    polygon(asphalt,f.p,q=>groundHeight(...q)+.074,'#72777b',6.5);
  }
  const parked=new Batch(),layout=parkingLayout(city,roadWidth),parkedInstances=[];
  scene.userData.parkingStats={...layout.stats,bays:layout.bays.length,cars:layout.bays.filter(b=>b.filled).length};
  for(const aisle of layout.aisles){
    const [p,q]=aisle.p;ribbon(asphalt,p,q,aisle.width,groundHeight(...p)+.079,groundHeight(...q)+.079,'#72777b');
  }
  for(const bay of layout.bays){
    const y=bay.kind==='shoulder'?Math.max(bay.elevation??-Infinity,groundHeight(bay.x,bay.z)+.11):bay.elevation??groundHeight(bay.x,bay.z);
    for(let i=0;i<4;i++){
      const p=bay.corners[i],q=bay.corners[(i+1)%4];
      ribbon(marks,p,q,.035,bay.kind==='shoulder'?Math.max(y+.10,groundHeight(...p)+.21):groundHeight(...p)+.10,bay.kind==='shoulder'?Math.max(y+.10,groundHeight(...q)+.21):groundHeight(...q)+.10,'#dfdfd2');
    }
    if(!bay.filled)continue;
    parkedInstances.push({...bay,y:y+.11});
    const dx=Math.sin(bay.yaw)*1.25,dz=Math.cos(bay.yaw)*1.25;
    const vehicle=vehicleFleet.register({id:'parking/'+bay.id,kind:'car',x:bay.x,y:y+.11,z:bay.z,a:bay.yaw});
    solids?.addSegment([bay.x-dx,y,bay.z-dz],[bay.x+dx,y,bay.z+dz],1.85,1.5,{kind:'parked_car',vehicle});
  }

  // Reference-confirmed parking on the carriageway beside the Treinstraat
  // tree row; keep both arch approaches and the walking pavement clear.
  const street=city.road.find(f=>f.id===77041042);
  if(street){let walked=0,next=14,slot=0;
    for(let i=1;i<street.p.length;i++){
      const a=street.p[i-1],b=street.p[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.01)continue;
      while(next<walked+L){
        const t=(next-walked)/L,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);next+=6.1;slot++;
        if(x<112||x>224)continue;
        const wall=stationWallAt(x,z);if(!wall?.f.referenceArches)continue;
        const nx=dz/L,nz=-dx/L,side=Math.sign((wall.a[0]-x)*nx+(wall.a[1]-z)*nz)||1;
        const road=nearest(roads,x,z,f=>f.id===77041042);if(!road)continue;
        const y=lerp(road.ya,road.yb,road.t),half=roadWidth(street)/2;
        const p=(along,across)=>[x+dx/L*along+nx*side*across,z+dz/L*along+nz*side*across];
        ribbon(marks,p(-2.8,half-2.15),p(2.8,half-2.15),.035,y+.085,y+.085,'#dfdfd2');
        ribbon(marks,p(-2.8,half-2.15),p(-2.8,half-.12),.035,y+.085,y+.085,'#dfdfd2');
        if(pick(slot,714)<.70){const c=p(0,half-1.12),id=9000000+slot,vehicle=vehicleFleet.register({id:'parking/'+id,kind:'car',x:c[0],y:y+.04,z:c[1],a:Math.atan2(dx,dz)});parkedInstances.push({id,x:c[0],y:y+.04,z:c[1],yaw:Math.atan2(dx,dz)});solids?.addSegment([c[0]-dx/L*1.15,y,c[1]-dz/L*1.15],[c[0]+dx/L*1.15,y,c[1]+dz/L*1.15],1.7,1.42,{kind:'parked_car',vehicle});}
      }
      walked+=L;
    }
  }
  addParkedInstances(scene,parkedInstances);
  parked.mesh(scene).castShadow=true;
  asphalt.mesh(scene);marks.mesh(scene);
}
function paintBarriers(batch,owns=()=>true,features=null,collision=null){
  const gates=new Hash();
  for(const f of city.streetObject||[]){
    if(!['gate','swing_gate','lift_gate'].includes(f.c))continue;
    const [x,z]=f.p;gates.insert(f,x-3,z-3,x+3,z+3);
  }
  for(const f of features??[...(city.barrier||[]),...(city.siteFence||[])]){
    if(!owns(...center(f.p)))continue;
    const fence=f.c==='fence'||f.c==='handrail'||f.c==='guard_rail';
    const h=parseFloat(f.h)||({fence:1.45,handrail:.94,guard_rail:.72,hedge:1.25,retaining_wall:1.6,jersey_barrier:.7,kerb:.14}[f.c]??1.2);
    const tint=fence?(f.m==='wood'?'#826953':'#67736a'):f.c==='hedge'?'#657953':/brick/.test(f.m)?'#9b6856':'#9b9689';
    const width=fence?.11:f.c==='hedge'?.78:f.c==='kerb'?.17:.32;
    // These mapped bank rails lie inside the current water polygon. Anchor
    // them to its dry bank edge; bridge parapets are generated separately.
    const railPoints=f.id===446333494?[[29.585,-335.56],...f.p]:f.p;
    const points=[446333493,446333494].includes(f.id)?railPoints.map(p=>{
      const bank=nearest(waterEdges,...p,g=>g.n==='Dender');
      if(!bank||bank.d>12)return p;
      let nx=bank.dz/bank.length,nz=-bank.dx/bank.length;
      const x=lerp(bank.a[0],bank.b[0],bank.t),z=lerp(bank.a[1],bank.b[1],bank.t);
      if(contains(x+nx*.25,z+nz*.25,bank.f.p)){nx=-nx;nz=-nz;}
      return [x+nx*.25,z+nz*.25];
    }):f.p;
    const y=points.map(p=>surface(...p));
    const nodes=nodesForLine(points,y);
    for(let i=1;i<nodes.length;i++){
      const a=nodes[i-1],b=nodes[i];
      const x=(a.p[0]+b.p[0])/2,z=(a.p[1]+b.p[1])/2;
      if(!inside(x,z)||gates.get(x,z).some(g=>Math.hypot(g.p[0]-x,g.p[1]-z)<1.3))continue;
      if(f.c==='guard_rail'||f.c==='handrail'){
        const bridge=nearest(roads,x,z,r=>r.b&&!isPath(r));
        if(bridge&&bridge.d<bridge.width/2+2.15){
          const dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],len=Math.hypot(dx,dz);
          // Cut canal-edge rails where a crossing deck meets the bank;
          // parallel bridge parapets remain intact.
          if(Math.abs(dx*bridge.dx+dz*bridge.dz)/(len*bridge.length)<.55)continue;
        }
      }
      if(collision)collision.addSegment([a.p[0],a.y,a.p[1]],[b.p[0],b.y,b.p[1]],width,h,{id:f.id,kind:f.c});
      if(!batch)continue;
      if(fence){
        for(const up of [h,h*.51])band(batch,a,b,-width/2,width/2,up,tint);
        for(const up of [h-.044,h*.51-.038]){
          batch.quad(edge(a,-width/2,up),edge(b,-width/2,up),edge(b,-width/2,up+.06),edge(a,-width/2,up+.06),tint);
        }
        addBox(batch,a.p[0],a.y+h*.5,a.p[1],.09,h,.09,tint);
        if(f.c==='fence'){
          const n=Math.ceil(Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1])/.52);
          for(let j=1;j<n;j++){
            const t=j/n;
            addBox(batch,lerp(a.p[0],b.p[0],t),lerp(a.y,b.y,t)+h*.52,lerp(a.p[1],b.p[1],t),.035,h*.91,.035,tint);
          }
        }
      }else{
        band(batch,a,b,-width/2,width/2,h,tint);
        prism(batch,a.p,b.p,width,a.y+h,b.y+h,h+.08,tint);
      }
    }
  }
}
export function signalPhase(time,angle){
  const perpendicular=Math.abs(Math.cos(angle))<Math.SQRT1_2;
  const phase=(time+(perpendicular?0:17))%34;
  return phase<13?2:phase<15?1:0;
}
function paintGate(batch,f,x,y,z,street,collision=null){
  const route=nearest(roads,x,z),dx=route?route.dx/route.length:1,dz=route?route.dz/route.length:0;
  const mappedSpan=f.ends?Math.hypot(f.ends[1][0]-f.ends[0][0],f.ends[1][1]-f.ends[0][1]):0;
  const nx=mappedSpan?(f.ends[1][0]-f.ends[0][0])/mappedSpan:dz,nz=mappedSpan?(f.ends[1][1]-f.ends[0][1])/mappedSpan:-dx,yaw=-Math.atan2(nz,nx);
  const span=mappedSpan||clamp(parseFloat(f.w)||route?.width||3.4,2.0,6.0);
  const at=d=>[x+nx*d,z+nz*d],hinge=at(-span/2),end=at(span/2);
  if(collision){
    collision.addSegment([hinge[0],y+.90,hinge[1]],[end[0],y+.90,end[1]],.115,.23,{id:f.id,kind:f.c});
    for(const p of [hinge,end])collision.addSegment([p[0],y,p[1]],[p[0],y,p[1]],.16,1.2,{id:f.id,kind:'gate_post'});
    return;
  }
  if(f.c==='lift_gate'){
    addBox(batch,hinge[0],y+.56,hinge[1],.36,1.12,.44,'#d3d7d5',yaw);
    addBox(batch,hinge[0],y+1.13,hinge[1],.40,.12,.48,'#334b50',yaw);
    addBox(batch,hinge[0]+dx*.231,y+.66,hinge[1]+dz*.231,.14,.25,.025,'#334c52',yaw+Math.PI/2);
    // Thin horizontal arm, with complete alternating reflective sleeves.
    const arm=span+.18,steps=Math.ceil(arm/.36);
    for(let i=0;i<steps;i++){
      const p=at(-span/2+arm*(i+.5)/steps);
      addBox(batch,p[0],y+1.01,p[1],arm/steps+.002,.115,.075,i%2?'#cc3735':'#f0f1e9',yaw);
    }
    const counter=at(-span/2-.32);
    addBox(batch,counter[0],y+1.01,counter[1],.5,.18,.14,'#414b4d',yaw);
    addBox(batch,end[0],y+.49,end[1],.075,.98,.075,'#5d6668',yaw);
    addBox(batch,end[0],y+.97,end[1],.16,.06,.15,'#303b3b',yaw);
  }else{
    for(const p of [hinge,end])addBox(batch,p[0],y+.66,p[1],.11,1.32,.11,'#59655e');
    for(const h of [.29,1.14])addBox(batch,x,y+h,z,span,.075,.075,'#637269',yaw);
    const count=Math.ceil(span/.18);
    for(let i=1;i<count;i++){
      const p=at(-span/2+span*i/count);addBox(batch,p[0],y+.72,p[1],.035,.85,.035,'#637269');
    }
  }
}
const intersectionControlCache=new WeakMap();
const mappedSignalPoints=(city.streetObject||[]).filter(f=>f.c==='traffic_signals').map(f=>f.p);
function intersectionControls(f){
  if(f.c!=='traffic_signals')return [f];
  if(intersectionControlCache.has(f))return intersectionControlCache.get(f);
  const tags=roadsideControlData[f.p.map(v=>v.toFixed(2)).join(',')]?.tags||{};
  const nearby=new Map();for(const s of roads.get(...f.p))if(!isPath(s.f)&&!s.f.t)nearby.set(s.f.id,s.f);
  const approaches=junctionApproaches(f.p,[...nearby.values()]);
  const result=approaches.length>=2&&!tags.direction&&!tags['traffic_signals:direction']&&tags.traffic_signals!=='signal'
    ?approaches.filter(a=>{
      // Divided junctions have several signal nodes joined by short internal
      // ways. Do not put another stop line in the middle of the junction.
      const way=nearby.get(a.roadId);if(!way)return true;
      const length=way.p.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-way.p[i][0],p[1]-way.p[i][1]),0);
      return !(length<30&&[way.p[0],way.p.at(-1)].every(p=>mappedSignalPoints.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.12)));
    }).map(a=>({...f,p:a.p,_owner:f.p,_roadId:a.roadId,_travel:a.travel,_junction:true})):[f];
  intersectionControlCache.set(f,result);return result;
}
// Simulation and rendered heads share the same OSM approach expansion.
export function trafficSignalControls(){return (city.streetObject||[]).filter(f=>f.c==='traffic_signals').flatMap(intersectionControls).map(f=>{const r=nearest(roads,...f.p,v=>!isPath(v)&&(!f._roadId||v.id===f._roadId));if(!r)return null;const tags=roadsideControlData[(f._owner||f.p).map(v=>v.toFixed(2)).join(',')]?.tags||{};const travel=f._travel||(tags['traffic_signals:direction']==='backward'?-1:tags['traffic_signals:direction']==='forward'?1:r.f.one||0);return {p:f.p,way:r.f.id,angle:Math.atan2(r.dx*(travel||1),r.dz*(travel||1)),directed:!!travel};}).filter(Boolean);}
const roadsideCache=new WeakMap(),roadsideEntrances=new Hash();
for(const f of city.door||[]){const [x,z]=f.p;roadsideEntrances.insert(f,x-1.3,z-1.3,x+1.3,z+1.3);}
const roadsideBlocked=(x,z)=>!!buildingAt(x,z)||(wet(x,z)&&!waterCrossing(x,z,surface(x,z)))||roadsideEntrances.get(x,z).some(f=>Math.hypot(f.p[0]-x,f.p[1]-z)<1.3);
export function roadsidePlacementReport(){return (city.streetObject||[]).flatMap(intersectionControls).flatMap(f=>{const p=roadsideCache.get(f);return p?[{kind:f.c,original:f.p,...p}]:[];});}
function paintStreetObjects(batch,bulbs,signals,lampPositions,owns=()=>true,features=city.streetObject||[],collision=null){
  for(const f of features.flatMap(intersectionControls)){
    let [x,z]=f.p;
    if(!owns(...(f._owner||f.p))||!inside(x,z))continue;
    if(f.c==='street_lamp'){
      const wall=stationWallAt(x,z);
      if(wall?.f.referenceArches&&wall.d<3&&wall.side>-.65){
        const nx=lerp(wall.nx,wall.nxB??wall.nx,wall.t),nz=lerp(wall.nz,wall.nzB??wall.nz,wall.t),length=Math.hypot(nx,nz);
        x=lerp(wall.a[0],wall.b[0],wall.t)-nx/length*.65;z=lerp(wall.a[1],wall.b[1],wall.t)-nz/length*.65;
      }
    }
    const motorStreet=nearest(roads,x,z,v=>!isPath(v)&&(!f._roadId||v.id===f._roadId)),mappedRoute=nearest(roads,x,z);
    // A yield/signal node on a mapped cycle route controls that route, not a
    // neighbouring carriageway merely because it carries motor vehicles.
    const cycleControl=['traffic_signals','stop','give_way'].includes(f.c)&&mappedRoute&&isPath(mappedRoute.f)&&mappedRoute.d<.35&&(!motorStreet||motorStreet.d>.6);
    const street=cycleControl?mappedRoute:motorStreet;
    const roadside=['traffic_signals','stop','give_way','sign','bus_stop','street_lamp','waste_basket','waste_disposal'];
    let placement;
    if(street&&roadside.includes(f.c)){
      const candidates=new Set();
      for(const dx of [-12,0,12])for(const dz of [-12,0,12])for(const r of roads.get(x+dx,z+dz)){
        if(['pedestrian','living_street','steps'].includes(r.f.c)||/^(deck-pavement-|bridge-link-)/.test(String(r.f.id)))continue;
        candidates.add(r);
      }
      const control=roadsideControlData[f.p.map(v=>v.toFixed(2)).join(',')]?.tags;
      const direction=control?.direction??control?.['traffic_signals:direction'];
      const travel=f._travel??(['traffic_signals','stop','give_way'].includes(f.c)?(direction==='backward'?-1:direction==='forward'?1:street.f.one||-Math.sign((x-lerp(street.a[0],street.b[0],street.t))*street.dz-(z-lerp(street.a[1],street.b[1],street.t))*street.dx)||1):0);
      placement=roadsideCache.get(f)??placeRoadside([x,z],{segments:[...candidates].map(r=>({...r,path:isPath(r.f)})),
        travel,primaryId:street.f.id,preferPath:f.c==='street_lamp'&&(Number(control?.layer)>0||mappedRoute?.f.b),
        width:f.c==='waste_disposal'?1.6:.35,
        depth:f.c==='waste_disposal'?1:.35,
        clearance:.12,level:surface,blocked:roadsideBlocked});
      placement.travel=travel;
      roadsideCache.set(f,placement);
      [x,z]=placement.p;
    }
    const y=surface(x,z);
    const walking=nearest(roads,x,z,v=>isPath(v));
    const facing=walking&&walking.d<12?walking:street;
    let yaw=placement?.yaw??(street?-Math.atan2(street.dz,street.dx):0);
    if(['traffic_signals','stop','give_way','sign'].includes(f.c)&&placement?.u)yaw=approachYaw(placement.u,placement.side,placement.travel||street?.f.one);
    if(f.c==='street_lamp'&&facing){
      const X=lerp(facing.a[0],facing.b[0],facing.t),Z=lerp(facing.a[1],facing.b[1],facing.t);
      yaw=Math.atan2(x-X,z-Z);
    }
    if(collision){
      if(['gate','swing_gate','lift_gate'].includes(f.c))paintGate(null,f,x,y,z,street,collision);
      else if(f.c==='block'){
        const dx=Math.cos(yaw)*.455,dz=-Math.sin(yaw)*.455;
        collision.addSegment([x-dx,y,z-dz],[x+dx,y,z+dz],.68,.64,{id:f.id,kind:f.c});
      }else if(['bollard','pole','utility_pole','tower','flagpole','traffic_signals','stop','give_way','sign','bus_stop','street_lamp','waste_basket'].includes(f.c)){
        collision.addSegment([x,y,z],[x,y,z],f.c==='tower'?.36:f.c==='bollard'?.16:.12,parseFloat(f.h)||(f.c==='bollard'?.87:2.4),{id:f.id,kind:f.c});
      }
      continue;
    }
    const pole=(h,color='#606c65',w=.12)=>addBox(batch,x,y+h/2,z,w,h,w,color);
    if(f.c==='street_lamp'){
      const h=parseFloat(f.h)||5.2;
      addAsset(batch,'light-curved',x,y,z,h,yaw);
      const scale=h/.675,reach=-.175*scale;
      const head=[x+Math.sin(yaw)*reach,y+.650*scale,z+Math.cos(yaw)*reach];
      addBox(bulbs,head[0],head[1],head[2],.038*scale,.006*scale,.041*scale,'#ffdb84',yaw);
      lampPositions.push(head);
    }else if(['pole','utility_pole','tower','flagpole'].includes(f.c)){
      const h=parseFloat(f.h)||(f.c==='tower'?12:f.c==='flagpole'?7.5:6.4);
      pole(h,f.c==='pole'?'#786c58':'#68716e',f.c==='tower'?.36:.12);
      if(f.c==='pole'||f.c==='utility_pole')addBox(batch,x,y+h-.35,z,.74,.065,.08,'#71776e',yaw);
    }else if(f.c==='bus_stop'){
      pole(2.55);
      addBox(batch,x,y+2.35,z,.46,.42,.085,'#edbd4b',yaw);
      addBox(batch,x,y+2.32,z,.29,.18,.093,'#343d3a',yaw);
      if(f.shelter&&[-1.54,0,1.54].every(a=>[-.67,0,.67].every(b=>{const X=x+Math.cos(yaw)*a+Math.sin(yaw)*b,Z=z-Math.sin(yaw)*a+Math.cos(yaw)*b;return !roadsideBlocked(X,Z)&&!roads.get(X,Z).some(r=>!['pedestrian','living_street'].includes(r.f.c)&&projection(r,X,Z).d<r.width/2+.1);}))&&!(f.n==='Aalst Station'&&x>=-120&&x<=-95&&z>=-412&&z<=-385)){
        const tx=Math.cos(yaw),tz=-Math.sin(yaw);
        for(const d of [-1.4,1.4])addBox(batch,x+tx*d,y+1.13,z+tz*d,.085,2.26,1.12,'#72857d',yaw);
        addBox(batch,x,y+2.33,z,3.08,.15,1.34,'#5d7369',yaw);
        addBox(batch,x,y+.47,z,1.8,.1,.35,'#918168',yaw);
      }
    }else if(f.c==='waste_basket'||f.c==='waste_disposal'){
      if(f.c==='waste_disposal'){addAsset(batch,'dumpster',x,y,z,1.15,yaw);continue;}
      const w=.42;
      addBox(batch,x,y+.42,z,w,.73,w,'#59685a',yaw);
      addBox(batch,x,y+.81,z,w+.05,.14,w+.05,'#3e5047',yaw);
    }else if(f.c==='traffic_signals'){
      const axis=street&&Math.abs(street.dz)>Math.abs(street.dx)?1:0;
      paintTrafficLight(batch,signals[axis],x,y,z,yaw);
    }else if(f.c==='sign'||f.c==='stop'||f.c==='give_way'){
      if(f.c==='stop'){addAsset(batch,'road-sign-stop',x,y,z,2.42,yaw);continue;}
      if(f.c==='give_way'){
        pole(2.42);
        const at=(u,h,offset)=>[x+Math.cos(yaw)*u+Math.sin(yaw)*offset,y+h,z-Math.sin(yaw)*u+Math.cos(yaw)*offset];
        batch.tri(at(-.34,2.65,0),at(.34,2.65,0),at(0,2.07,0),'#c3453d');
        batch.tri(at(-.245,2.595,.012),at(.245,2.595,.012),at(0,2.175,.012),'#eeeeea');
        continue;
      }
      pole(2.42);
      const red=f.c==='stop'||f.c==='give_way'||/B5|B1|C[0-9]/.test(f.sign||'');
      addBox(batch,x,y+2.32,z,.47,.44,.065,red?'#bc4840':'#4e758b',yaw);
      addBox(batch,x,y+2.32,z,.27,.16,.071,'#e6e2ce',yaw);
    }else if(['gate','swing_gate','lift_gate'].includes(f.c)){
      paintGate(batch,f,x,y,z,street);
    }else if(f.c==='block'){
      addBox(batch,x,y+.32,z,.91,.64,.68,'#a19a89',yaw);
    }else if(f.c==='bollard'){
      pole(parseFloat(f.h)||.87,'#717a71',.16);
      addBox(batch,x,y+.72,z,.17,.085,.17,'#d3d0b9');
    }else{
      pole(1.06);
      addBox(batch,x,y+.89,z,1.36,.08,.08,'#8e8d7a',yaw);
    }
  }
}
const churches={
  104422494:{eaves:16,cap:34,wall:'#c9c1a9',tower:[-111.7,52.8,6.8,35.5,46.7,'drum']},
  258336678:{eaves:13.5,cap:29,wall:'#c8a77b',bands:'#9e6451',tower:[788.8,-358.6,8.9,39,56,'drum']},
  506216114:{eaves:17,cap:33,wall:'#a46a57',bands:'#c0a486',tower:[-491.3,-329.4,9.5,48,70,'spire']},
  586346530:{eaves:10.6,cap:17,wall:'#aa795f',bands:'#cab8a0',round:true,tower:[165.9,302.9,5.6,23,30,'cupola']},
  723849323:{eaves:10.5,cap:20,wall:'#a2705d',bands:'#c1a78d',round:true,tower:[6.5,-1230.5,6.5,25.5,35,'spire']},
  116480515:{eaves:4,cap:7.35,wall:'#b7aea2',modern:true},
  924527808:{eaves:13.7,cap:19.7,wall:'#b2a08b',round:true},
  280883466:{eaves:5.4,cap:10.4,wall:'#a87561',round:true,tower:[1969.2,902.3,2.15,10.3,14.2,'spire']}
};
function roundWall(batch,x,y,z,r,h,tint,sides=8,yaw=0){
  const p=(j,up)=>[x+Math.cos(j*2*Math.PI/sides+yaw)*r,y+up,z+Math.sin(j*2*Math.PI/sides+yaw)*r];
  for(let j=0;j<sides;j++)batch.quad(p(j,0),p(j+1,0),p(j+1,h),p(j,h),tint);
}
function churchOpening(batch,x,y,z,yaw,width,h,rounded,offset,tint){
  const p=(u,v)=>[x+Math.cos(yaw)*u+Math.sin(yaw)*offset,y+v,z-Math.sin(yaw)*u+Math.cos(yaw)*offset];
  const top=h*(rounded?.78:.68);
  batch.quad(p(-width/2,0),p(width/2,0),p(width/2,top),p(-width/2,top),tint);
  if(rounded){
    for(let i=0;i<8;i++){
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      batch.tri(p(0,top),p(Math.cos(a)*width/2,top+Math.sin(a)*(h-top)),p(Math.cos(b)*width/2,top+Math.sin(b)*(h-top)),tint);
    }
  }else batch.tri(p(-width/2,top),p(width/2,top),p(0,h),tint);
}
const churchRoofs={
  104422494:[[-133,51,-77,49,8.1,25.1,33.3],[-111,29,-111,79,8.6,25.1,33.3]],
  258336678:[[786,-386,792,-346,6.4,17.4,24.3],[777,-358.6,804,-358.6,5.4,17.4,24.3]],
  506216114:[[-538,-308,-491,-325.5,7.8,20.2,29.5],[-530,-329,-521,-301,5.7,20.2,29.5]],
  586346530:[[166.5,306,182.5,329,7.2,11.8,16.5]],
  723849323:[[13,-1239,54,-1237,6.4,12.2,18.5],[38,-1247,38,-1227,5.6,12.2,18.5]],
  924527808:[[-104,140,-86,125,5.9,13.8,19.8]],
  280883466:[[1962,880,1963,901,5.0,6.4,10.0]]
};
function buildChurchRoofs(batch,f,profile,y){
  const slate='#4b535a',stone=profile.wall;
  polygon(batch,f.p,()=>y+profile.eaves+.06,slate,Infinity,f.holes||[]);
  if(profile.modern)return;
  const sections=churchRoofs[f.id]||[];
  for(const [ax,az,bx,bz,width,eave,ridge] of sections){
    const length=Math.hypot(bx-ax,bz-az),nx=(bz-az)/length,nz=(ax-bx)/length;
    const a=[ax,y+ridge,az],b=[bx,y+ridge,bz];
    const al=[ax+nx*width,y+eave,az+nz*width],ar=[ax-nx*width,y+eave,az-nz*width];
    const bl=[bx+nx*width,y+eave,bz+nz*width],br=[bx-nx*width,y+eave,bz-nz*width];
    batch.quad(al,bl,b,a,slate);
    batch.quad(a,b,br,ar,slate);
    batch.tri(al,a,ar,stone);batch.tri(bl,br,b,stone);
    // The clerestory rises above the lower aisle roofs as a separate volume.
    for(const [l,r] of [[al,bl],[br,ar],[ar,al],[bl,br]]){
      batch.quad([l[0],y+profile.eaves,l[2]],[r[0],y+profile.eaves,r[2]],r,l,stone);
    }
  }
}
function martinusDetails(batch,windows,profile,y){
  const stone='#bfbeb0',trim='#a5a89e',glass='#3d5158',slate='#4a545c';
  for(const section of churchRoofs[104422494]){
    const [ax,az,bx,bz,width,eaves,ridge]=section;
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
    const yaw=-Math.atan2(dz,dx);
    const n=Math.max(3,Math.round(length/7.5));
    for(const side of [-1,1]){
      const out=side>0?1:-1;
      const frameYaw=yaw+(side>0?Math.PI:0);
      for(let i=0;i<n;i++){
        const t=(i+.5)/n,x=lerp(ax,bx,t)+nx*width*side,z=lerp(az,bz,t)+nz*width*side;
        if(Math.hypot(x+111,z-53)<12)continue;
        churchOpening(batch,x,y+profile.eaves+1.7,z,frameYaw,3.15,6.4,false,.13,stone);
        churchOpening(windows,x,y+profile.eaves+1.85,z,frameYaw,2.73,6.1,false,.17,glass);
        for(const u of [-.84,0,.84]){
          addBox(batch,x+Math.cos(frameYaw)*u+Math.sin(frameYaw)*.20,y+profile.eaves+4.5,z-Math.sin(frameYaw)*u+Math.cos(frameYaw)*.20,.073,5.0,.095,trim,frameYaw);
        }
        const px=lerp(ax,bx,i/n)+nx*width*side,pz=lerp(az,bz,i/n)+nz*width*side;
        addBox(batch,px+nx*.24*side,y+(eaves+profile.eaves)/2,pz+nz*.24*side,.49,eaves-profile.eaves,.85,stone,yaw);
        addBox(batch,px+nx*.25*side,y+eaves+.33,pz+nz*.25*side,.47,.61,.50,stone,yaw);
        cone(batch,px+nx*.25*side,y+eaves+.64,pz+nz*.25*side,.35,1.10,stone,4,Math.PI/4);
      }
      // Slate lean-to roofs cover the side aisles below the clerestory.
      const outside=width+5.0;
      const p=(x,z,w,h)=>[x+nx*w*side,y+h,z+nz*w*side];
      batch.quad(p(ax,az,width,profile.eaves+3),p(bx,bz,width,profile.eaves+3),p(bx,bz,outside,profile.eaves+.10),p(ax,az,outside,profile.eaves+.10),slate);
    }
    for(const [x,z,sign] of [[ax,az,-1],[bx,bz,1]]){
      const angle=yaw+(sign<0?-Math.PI/2:Math.PI/2);
      const normal=[Math.sin(angle),Math.cos(angle)];
      churchOpening(batch,x,y+10.5,z,angle,10.2,13.5,false,.21,stone);
      churchOpening(windows,x,y+10.65,z,angle,9.35,13.0,false,.25,glass);
      for(let u=-3.6;u<=3.6;u+=1.2){
        addBox(batch,x+Math.cos(angle)*u+normal[0]*.30,y+15.8,z-Math.sin(angle)*u+normal[1]*.30,.10,10.35,.13,stone,angle);
      }
      for(const side of [-1,1]){
        const u=side*(width+.27);
        const px=x+Math.cos(angle)*u,pz=z-Math.sin(angle)*u;
        addBox(batch,px,y+eaves*.52,pz,1.07,eaves*1.04,1.04,stone,angle);
        roundWall(batch,px,y+eaves,pz,.52,3.4,stone,6);
        cone(batch,px,y+eaves+3.4,pz,.64,3.05,stone,6);
      }
      const gx=x+normal[0]*.31,gz=z+normal[1]*.31;
      for(const h of [eaves+1.7,eaves+4.0]){
        churchOpening(windows,gx,y+h,gz,angle,1.0,1.2,true,.05,glass);
      }
    }
  }
}
function martinusLantern(batch,windows,profile,y){
  const x=-111.7,z=52.8,slate='#434d55',wood='#3f484d';
  roundWall(batch,x,y+32.6,z,3.4,1.15,slate,8,Math.PI/8);
  roundWall(batch,x,y+33.75,z,3.0,.32,slate,8,Math.PI/8);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+Math.PI/8;
    const px=x+Math.cos(a)*2.50,pz=z+Math.sin(a)*2.50;
    addBox(batch,px,y+35.25,pz,.25,2.75,.25,wood);
  }
  roundWall(batch,x,y+36.6,z,3.05,.35,slate,8,Math.PI/8);
  const rings=[[36.95,3.15],[38.2,1.92],[39.6,1.72],[40.1,1.98],[40.8,1.24],[41.85,1.02],[42.4,1.18],[43.1,.65]];
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i];
    const p=(j,v)=>[x+Math.cos(j*Math.PI/4+Math.PI/8)*v[1],y+v[0],z+Math.sin(j*Math.PI/4+Math.PI/8)*v[1]];
    for(let j=0;j<8;j++)batch.quad(p(j,a),p(j+1,a),p(j+1,b),p(j,b),slate);
  }
  cone(batch,x,y+43.1,z,.66,3.65,slate,8,Math.PI/8);
  addBox(batch,x,y+47.25,z,.075,.98,.075,'#7e7a60');
}
function buildChurch(batch,windows,f,profile,y){
  const eaves=y+profile.eaves,top=y+profile.cap;
  const roofTint=profile.modern?'#79766f':'#53585b';
  const [cx,cz]=center(f.p);
  const roof=()=>eaves+.06;
  buildChurchRoofs(batch,f,profile,y);
  for(let i=1;i<f.p.length;i++){
    const [a,b]=[f.p[i-1],f.p[i]],dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
    if(d<.045)continue;
    const yaw=-Math.atan2(dz,dx),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    const normal=[Math.sin(yaw),Math.cos(yaw)];
    const out=contains(mx+normal[0]*.15,mz+normal[1]*.15,f.p)?-1:1;
    const k=Math.ceil(d/2.5);
    for(let j=0;j<k;j++){
      const t=j/k,u=(j+1)/k;
      const p=[lerp(a[0],b[0],t),lerp(a[1],b[1],t)],q=[lerp(a[0],b[0],u),lerp(a[1],b[1],u)];
      batch.quad([p[0],height(...p)-.18,p[1]],[q[0],height(...q)-.18,q[1]],[q[0],roof(q),q[1]],[p[0],roof(p),p[1]],profile.wall);
    }
    if(profile.modern){
      if(d>4)addBox(windows,mx,y+3.18,mz,d*.81,.72,.14,'#637476',yaw);
      continue;
    }
    const bands=profile.bands||'#c7b9a3';
    if(d>2)addBox(batch,mx,y+.48,mz,d,.6,.31,bands,yaw);
    if(d<3.1)continue;
    const bays=Math.max(1,Math.round(d/4.3));
    for(let j=0;j<bays;j++){
      const t=(j+.5)/bays,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);
      const w=Math.min(1.7,d/bays*.47),h=Math.min(6.4,profile.eaves*.45);
      const bottom=y+Math.min(profile.eaves*.44,6.2);
      churchOpening(batch,x,bottom-.11,z,yaw,w+.25,h+.24,profile.round,.12*out,bands);
      churchOpening(windows,x,bottom,z,yaw,w,h,profile.round,.142*out,'#4b505a');
      if(!profile.round)addBox(batch,x,bottom+h*.39,z,.11,h*.76,.36,bands,yaw);
      if(profile.eaves>11&&!profile.round){
        const u=Math.min(.95,j/bays+.08),px=lerp(a[0],b[0],u),pz=lerp(a[1],b[1],u);
        addBox(batch,px+normal[0]*.28*out,y+4.5,pz+normal[1]*.28*out,.46,9,.8,bands,yaw);
      }
    }
    if(profile.bands&&d>2){
      for(const up of [3.2,8.5])if(up<profile.eaves)addBox(batch,mx,y+up,mz,d,.14,.15,bands,yaw);
    }
  }
  if(f.id===104422494){
    martinusDetails(batch,windows,profile,y);
    martinusLantern(batch,windows,profile,y);
    return;
  }
  if(!profile.tower)return;
  const [x,z,w,shoulder,peak,kind]=profile.tower;
  const base=height(x,z),m=y+shoulder,high=y+peak;
  const slate='#4e5559',trim=profile.bands||'#c4b7a0';
  const yaw=Math.abs(x-cx)>Math.abs(z-cz)?0:Math.PI/2;
  if(kind==='drum'){
    const start=y+profile.cap;
    addBox(batch,x,(start+y+profile.eaves)*.5,z,w*.95,start-y-profile.eaves,w*.95,profile.wall,yaw);
    roundWall(batch,x,start,z,w*.54,m-start,profile.wall,8,Math.PI/8);
    roundWall(batch,x,m-.35,z,w*.58,.42,trim,8,Math.PI/8);
    for(let j=0;j<8;j++){
      const angle=j*Math.PI/4,d=w*.502;
      churchOpening(windows,x+Math.sin(angle)*d,m-3.9,z+Math.cos(angle)*d,angle,w*.18,2.95,false,.018,'#474941');
    }
  }else{
    addBox(batch,x,(base+m)*.5,z,w,m-base,w,profile.wall,yaw);
    addBox(batch,x,m-.27,z,w+.48,.56,w+.48,trim,yaw);
    for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      const d=w*.505;
      const height=Math.min(5.2,w*.67);
      for(const shift of [-.19,.19]){
        const px=x+Math.sin(angle)*d+Math.cos(angle)*w*shift,pz=z+Math.cos(angle)*d-Math.sin(angle)*w*shift;
        churchOpening(windows,px,m-height-1,pz,angle,w*.25,height,profile.round,.025,'#4a4944');
      }
      if(w>6)addBox(batch,x+Math.sin(angle)*(d+.28),y+8,z+Math.cos(angle)*(d+.28),w*.48,16,.61,trim,angle);
    }
  }
  if(kind==='cupola'){
    const h=high-m, rings=[[0,.49],[.32,.42],[.56,.35],[.74,.23],[.88,.17],[1,.04]];
    for(let i=1;i<rings.length;i++){
      const a=rings[i-1],b=rings[i];
      const p=(j,s)=>[x+Math.cos(j*Math.PI/4)*w*s[1],m+h*s[0],z+Math.sin(j*Math.PI/4)*w*s[1]];
      for(let j=0;j<8;j++)batch.quad(p(j,a),p(j+1,a),p(j+1,b),p(j,b),slate);
    }
  }else{
    cone(batch,x,m,z,w*(kind==='drum'?.56:.61),high-m,slate,8,Math.PI/8);
    if(w>8.5&&kind==='spire'){
      for(const u of [-1,1])for(const v of [-1,1]){
        addBox(batch,x+u*w*.42,m-.13,z+v*w*.42,1.15,2.9,1.15,trim);
        cone(batch,x+u*w*.42,m+1.25,z+v*w*.42,.75,3.5,slate,4,Math.PI/4);
      }
    }
  }
  addBox(batch,x,high+.61,z,.10,1.24,.1,'#625946');
  addBox(batch,x,high+.79,z,.70,.09,.09,'#625946');
}
const specials={
  690232338:{kind:'cinema',height:10.8,wall:'#858786',roof:'#666b6c'},
  13665889:{kind:'townhall',height:14,wall:'#dad0b6',roof:'#66625b'},
  114415568:{kind:'belfry',height:14,wall:'#d4bea0',roof:'#4f5959'},
  1151964136:{kind:'station',height:10,wall:'#a85d45',roof:'#4b5157'}
};
function facadePanel(batch,x,y,z,w,h,depth,tint,yaw){
  const ux=Math.cos(yaw)*w/2,uz=-Math.sin(yaw)*w/2,nx=Math.sin(yaw)*depth/2,nz=Math.cos(yaw)*depth/2;
  for(const side of [-1,1]){
    const X=x+nx*side,Z=z+nz*side;
    batch.quad([X-ux,y-h/2,Z-uz],[X+ux,y-h/2,Z+uz],[X+ux,y+h/2,Z+uz],[X-ux,y+h/2,Z-uz],tint);
  }
}
function facade(batch,windows,scene,f,p,y,top,wall,kind,windowed){
  const [cx,cz]=center(p);
  for(let i=1;i<p.length;i++){
    const [ax,az]=p[i-1],[bx,bz]=p[i];
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
    if(len<.05) continue;
    const tint=color(wall).clone().multiplyScalar(.86+.19*Math.abs(dx/len));
    const base=(x,z)=>Math.min(y,height(x,z))-.4;
    if(f.passage){
      const pieces=Math.ceil(len/.27);
      for(let j=0;j<pieces;j++){
        const u=j/pieces,v=(j+1)/pieces;
        const x=lerp(ax,bx,u),z=lerp(az,bz,u),X=lerp(ax,bx,v),Z=lerp(az,bz,v);
        const opening=passage((x+X)/2,(z+Z)/2);
        const floor=opening?y+(f.id===13665889?4.6:3.35):base(x,z);
        batch.quad([x,floor,z],[X,opening?floor:base(X,Z),Z],[X,top,Z],[x,top,z],tint);
      }
    }else batch.quad([ax,base(ax,az),az],[bx,base(bx,bz),bz],[bx,top,bz],[ax,top,az],tint);
    if(!windowed||len<2.5) continue;
    const yaw=-Math.atan2(dz,dx),nx=-dz/len,nz=dx/len;
    const bays=Math.min(13,Math.max(1,Math.round(len/(kind==='church'?5:f.hospital||f.school?4.5:3.05))));
    const rows=kind==='church'?1:Math.min(12,Math.max(1,parseInt(f.l)||Math.floor((top-y-1)/3)));
    for(let j=0;j<bays;j++){
      const q=(j+.5)/bays,x=lerp(ax,bx,q),z=lerp(az,bz,q);
      for(let r=0;r<rows;r++){
        const h=kind==='church'?5.4:1.3, sy=kind==='church'?y+9:y+(f.passage?4.4:2)+r*2.8;
        if(sy+h/2>top-.3)continue;
        const w=kind==='church'?1.45:Math.min(1.3,len/bays*.56);
        const frame=kind?'#e6d8b9':'#a69f90';
        if(kind||!f.hospital&&!f.school)facadePanel(batch,x,sy,z,w+.23,h+.22,.23,frame,yaw);
        facadePanel(windows,x,sy,z,w,h,.29,kind==='church'?'#514e68':(pick(f.id+j*39+r*25)>.55?'#8c9d95':'#546762'),yaw);
        if(kind) addBox(batch,x,sy,z,.12,h,.35,frame,yaw);
      }
      if(kind==='church') addBox(batch,x+nx*.34,y+5.6,z,.53,11,.9,'#c1b49d',yaw);
      if(kind==='station') addBox(batch,x+nx*.26,y+1.5,z,.28,3.05,.56,'#e5d1aa',yaw);
    }
    if(kind==='townhall'&&len>4){
      for(let t=.13;t<.94;t+=.24){
        addBox(batch,lerp(ax,bx,t),y+4.2,lerp(az,bz,t),.48,8.4,.64,'#e8dfca',yaw);
      }
      addBox(batch,(ax+bx)/2,y+8.46,(az+bz)/2,len,.37,.67,'#d3c5a9',yaw);
    }
    if(kind) addBox(batch,(ax+bx)/2,top-.42,(az+bz)/2,len,.32,.46,'#e3d0ad',yaw);
  }
  if(kind==='belfry'){
    const side=p.reduce((best,q,i)=>i>0&&Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1])>best.len?{len:Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1]),q,a:p[i-1]}:best,{len:0});
    const x=lerp(cx,side.q[0],.45),z=lerp(cz,side.q[1],.45);
    addBox(batch,x,top+4,z,7.1,13,7.1,'#c8b495');
    addBox(batch,x,top+10.6,z,7.6,.75,7.6,'#e5d0ad');
    addBox(batch,x,top+12.8,z,5.9,4.2,5.9,'#cbb497');
    const roofRings=[[0,4.75],[1.6,3.38],[3.6,2.55],[5.15,1.15],[7.1,.27]];
    for(let i=1;i<roofRings.length;i++){
      const [a,r]=roofRings[i-1],[b,R]=roofRings[i];
      const vertex=(j,h,radius)=>[x+Math.cos(j*Math.PI/4+Math.PI/8)*radius,top+15+h,z+Math.sin(j*Math.PI/4+Math.PI/8)*radius];
      for(let j=0;j<8;j++) batch.quad(vertex(j,a,r),vertex(j+1,a,r),vertex(j+1,b,R),vertex(j,b,R),j%2?'#525c60':'#4a555b');
    }
    cone(batch,x,top+22.1,z,.42,1.2,'#8c7951',5);
    for(const [dx,dz,yaw] of [[0,1,0],[1,0,Math.PI/2],[0,-1,Math.PI],[-1,0,-Math.PI/2]]){
      const clock=new T.Mesh(new T.CircleGeometry(1.48,20),new T.MeshBasicMaterial({color:'#292725'}));
      clock.position.set(x+dx*3.57,top+5.2,z+dz*3.57);clock.rotation.y=yaw;scene.add(clock);
      const hand=new T.Group();
      const m=new T.MeshBasicMaterial({color:'#ead17f'});
      const hands=[];
      for(const [w,h] of [[.09,1.12],[.11,.76]]){
        const pivot=new T.Group(),needle=new T.Mesh(new T.PlaneGeometry(w,h),m);
        needle.position.set(0,h/2,.035);pivot.add(needle);hand.add(pivot);hands.push(pivot);
      }
      (scene.userData.analogClocks??=[]).push({minute:hands[0],hour:hands[1]});
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6;
        const hour=new T.Mesh(new T.CircleGeometry(.077,8),m);
        hour.position.set(Math.sin(a)*1.18,Math.cos(a)*1.18,.025);
        hand.add(hour);
      }
      clock.add(hand);
      for(let j=-1;j<=1;j++) addBox(batch,x+dx*3.57+(dz?j*1.2:0),top+8.3,z+dz*3.57+(dx?j*1.2:0),.48,2.4,.49,'#514943');
    }
    for(const a of [-1,1]) for(const b of [-1,1]){
      addBox(batch,x+a*3.1,top+11.6,z+b*3.1,.77,2.1,.77,'#dac6a7');
      cone(batch,x+a*3.1,top+12.7,z+b*3.1,.69,1.6,'#566062',4,Math.PI/4);
    }
  }
  if(kind==='church'){
    addBox(batch,cx,top+2.9,cz,4.1,5.8,4.1,'#aea895');
    cone(batch,cx,top+5.8,cz,3.25,6.6,'#4a5258',8);
    addBox(batch,cx,top+12.65,cz,.12,1.8,.12,'#57564c');
    addBox(batch,cx,top+13.01,cz,.9,.1,.1,'#57564c');
  }
  if(kind==='station'){
    for(const dx of [-15,15]){
      addBox(batch,cx+dx,top-.1,cz+1,4.2,6.5,4.2,'#b77559');
      addBox(batch,cx+dx,top+3.05,cz+1,4.8,.5,4.8,'#ddc199');
      for(const ux of [-1,1]) for(const uz of [-1,1]) addBox(batch,cx+dx+ux*1.75,top+3.62,cz+1+uz*1.75,.75,1.1,.75,'#cfa783');
    }
    const south=Math.max(...p.map(q=>q[1]));
    label(scene,'AALST',cx,y+4.8,south+.17,0,5.1);
  }
}
function buildBorse(batch,windows,f){
  const a=f.p[6],b=f.p[7],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const ux=dx/length,uz=dz/length,nx=-uz,nz=ux,yaw=-Math.atan2(dz,dx);
  const y=height(...center(f.p)),brick='#a06049',stone='#c0aa89',trim='#a89a81',slate='#505759';
  const at=(u,v,h)=>[a[0]+ux*u+nx*v,y+h,a[1]+uz*u+nz*v];
  const boxAt=(group,u,v,h,w,hh,depth,tint)=>{
    const [x,Y,z]=at(u,v,h);
    addBox(group,x,Y,z,w,hh,depth,tint,yaw);
  };
  const face=(group,l,r,bottom,top,depth,tint)=>{
    group.quad(at(l,depth,bottom),at(r,depth,bottom),at(r,depth,top),at(l,depth,top),tint);
  };
  const eaves=8.55;
  for(let i=1;i<f.p.length;i++){
    if(i===7)continue;
    const [p,q]=[f.p[i-1],f.p[i]];
    batch.quad([p[0],y-.35,p[1]],[q[0],y-.35,q[1]],[q[0],y+eaves,q[1]],[p[0],y+eaves,p[1]],brick);
  }
  const roof=p=>{
    const back=-(p[0]-a[0])*nx-(p[1]-a[1])*nz;
    return y+eaves+3.45*Math.max(0,1-Math.abs(back-4.25)/4.25);
  };
  polygon(batch,f.p,roof,slate,3);
  for(let i=1;i<f.p.length;i++){
    const [p,q]=[f.p[i-1],f.p[i]];
    batch.quad([p[0],y+eaves,p[1]],[q[0],y+eaves,q[1]],[q[0],roof(q),q[1]],[p[0],roof(p),p[1]],slate);
  }
  face(batch,0,length,3.85,eaves,0,brick);
  face(batch,0,length,0,4,-.89,'#744d40');
  for(const h of [.21,4.15,4.69,7.2,7.91,8.43])boxAt(batch,length/2,.09,h,length,.17,.24,stone);
  const bays=9,w=length/bays;
  for(let i=0;i<bays;i++){
    const mid=w*(i+.5),left=w*i,right=w*(i+1),radius=w*.449;
    boxAt(windows,mid,-.72,1.83,w*.78,3.11,.12,'#414f4c');
    boxAt(batch,mid,-.63,1.83,.09,3.12,.11,'#665b48');
    boxAt(batch,mid,-.62,2.27,w*.78,.075,.10,'#665b48');
    for(let j=0;j<12;j++){
      const t=j/12,u=(j+1)/12;
      const x=lerp(left,right,t),X=lerp(left,right,u);
      const arch=p=>2.63+1.24*Math.sqrt(Math.max(0,1-((p-mid)/radius)**2));
      const low=arch(x),lowNext=arch(X);
      batch.quad(at(x,.04,low),at(X,.04,lowNext),at(X,.04,4.15),at(x,.04,4.15),brick);
      batch.quad(at(x,.12,low),at(X,.12,lowNext),at(X,.12,lowNext+.21),at(x,.12,low+.21),j%2?stone:trim);
      batch.quad(at(x,-.88,low),at(X,-.88,lowNext),at(X,.08,lowNext),at(x,.08,low),'#9b8166');
    }
    for(const shift of [-.75,.72]){
      const u=mid+shift;
      boxAt(batch,u,.05,5.93,1.18,2.13,.21,stone);
      boxAt(windows,u,.18,5.96,1.0,1.91,.087,'#404a46');
      boxAt(batch,u,.245,6.27,1.03,.07,.06,'#7e6e55');
      boxAt(batch,u,.245,5.97,.063,1.91,.06,'#7e6e55');
    }
    for(const shift of [-1.23,1.23]){
      const u=mid+shift,half=.22,v=.255;
      face(batch,u-half,u+half,5.0,6.23,v,'#a13930');
      const tile=at(u,v+.006,5.615);
      for(const [l,r] of [[at(u-half,v+.006,5),at(u+half,v+.006,5)],[at(u+half,v+.006,6.23),at(u-half,v+.006,6.23)]]){
        batch.tri(l,r,tile,'#e5d7ba');
      }
    }
  }
  for(let i=0;i<=bays;i++){
    const u=clamp(w*i,.12,length-.12);
    const [x,Y,z]=at(u,.11,.21);
    roundWall(batch,x,Y,z,.16,2.44,stone,8);
    boxAt(batch,u,.11,.16,.41,.32,.42,trim);
    boxAt(batch,u,.11,2.63,.44,.23,.45,stone);
  }
  for(const fraction of [.12,.37,.63,.88]){
    const mid=length*fraction,half=length*.112;
    const silhouette=[[-1,0],[-.98,.42],[-.81,.78],[-.72,1.25],[-.61,1.72],[-.47,2.0],[-.43,2.52],[-.50,2.86],[-.43,3.25],[-.26,3.62],[0,3.87],[.26,3.62],[.43,3.25],[.50,2.86],[.43,2.52],[.47,2],[.61,1.72],[.72,1.25],[.81,.78],[.98,.42],[1,0]];
    const crest=at(mid,.03,eaves+.87);
    for(let i=1;i<silhouette.length;i++){
      const [u,h]=silhouette[i-1],[v,H]=silhouette[i];
      const p=at(mid+u*half,.05,eaves+h),q=at(mid+v*half,.05,eaves+H);
      batch.tri(crest,p,q,brick);
      batch.quad(p,q,at(mid+v*half,-.23,eaves+H),at(mid+u*half,-.23,eaves+h),trim);
      batch.quad(at(mid+u*half,.08,eaves+h-.07),at(mid+v*half,.08,eaves+H-.07),at(mid+v*half,.08,eaves+H+.07),at(mid+u*half,.08,eaves+h+.07),stone);
    }
    for(const u of [-.44,.44])boxAt(batch,mid+u*half,.11,eaves+.77,.15,1.54,.13,stone);
    const [wx,wy,wz]=at(mid,.10,eaves+.31);
    churchOpening(batch,wx,wy-.06,wz,yaw,1.19,1.42,true,-.02,stone);
    churchOpening(windows,wx,wy,wz,yaw,.92,1.26,true,-.044,'#47514a');
    const [rx,ry,rz]=at(mid,.083,eaves+2.50);
    const ring=(r,angle)=>[rx+ux*r*Math.cos(angle),ry+r*Math.sin(angle),rz+uz*r*Math.cos(angle)];
    for(let j=0;j<14;j++){
      const t=j*2*Math.PI/14,u=(j+1)*2*Math.PI/14;
      batch.quad(ring(.32,t),ring(.32,u),ring(.43,u),ring(.43,t),stone);
    }
    boxAt(batch,mid,.0,eaves+4.05,.10,.63,.10,'#727465');
  }
  const tx=-303.65,tz=-22.0;
  roundWall(batch,tx,y+9,tz,1.09,5.43,slate,8);
  cone(batch,tx,y+14.43,tz,1.28,1.02,slate,8);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    addBox(batch,tx+Math.cos(a)*.77,y+15.17,tz+Math.sin(a)*.77,.11,1.40,.11,'#855447');
  }
  roundWall(batch,tx,y+15.90,tz,.92,.27,'#855447',8);
  roundWall(batch,tx,y+16.16,tz,.74,.45,slate,8);
  cone(batch,tx,y+16.61,tz,.76,1.56,slate,8);
  roundWall(batch,tx,y+17.74,tz,.26,.72,'#855447',8);
  cone(batch,tx,y+18.46,tz,.42,.72,slate,8);
  addBox(batch,tx,y+19.51,tz,.065,.68,.065,'#787961');
}
function buildAdministrativeCentre(batch,windows,f){
  const facadeTop=31.8;
  const fins=['#c5aa75','#e6bb60','#f0a432','#cc6f22','#d8422e','#b32b27','#a4aba9','#727e82'];
  polygon(batch,f.p,()=>facadeTop,'#757d7c');
  for(let i=1;i<f.p.length;i++){
    const [a,b]=[f.p[i-1],f.p[i]],dx=b[0]-a[0],dz=b[1]-a[1];
    const length=Math.hypot(dx,dz);
    if(length<.12)continue;
    const yaw=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
    const side=contains(x+Math.sin(yaw)*.12,z+Math.cos(yaw)*.12,f.p)?-1:1;
    const nx=side*Math.sin(yaw),nz=side*Math.cos(yaw);
    const foundation=Math.min(height(...a),height(...b))-.3;
    const glassLine=foundation+3.65;
    batch.quad([a[0],foundation,a[1]],[b[0],foundation,b[1]],[b[0],facadeTop,b[1]],[a[0],facadeTop,a[1]],'#546366');
    if(length<2.4)continue;
    addBox(windows,x+nx*.12,(foundation+glassLine)*.5,z+nz*.12,length-.10,glassLine-foundation,.25,'#425c60',yaw);
    const count=Math.max(2,Math.round(length/.93)),unit=length/count;
    const featureWindows=length>36?[.24,.54,.79]:[];
    for(let column=0;column<count;column++){
      const t=(column+.5)/count,px=lerp(a[0],b[0],t),pz=lerp(a[1],b[1],t);
      const seed=i*730+column*47;
      addBox(batch,px+nx*.20,foundation+1.84,pz+nz*.20,.064,3.53,.17,'#677a7c',yaw);
      for(let row=0;row<6;row++){
        const low=glassLine+row*(facadeTop-glassLine)/6;
        const high=glassLine+(row+1)*(facadeTop-glassLine)/6;
        if(featureWindows.some((u,j)=>Math.abs(t-u)*length<2.7&&row===4-j%2))continue;
        const index=Math.floor(pick(seed,row+1)*fins.length);
        const depth=.19+pick(seed,row+9)*.31;
        const width=unit*(.41+pick(seed,row+21)*.50);
        addBox(batch,px+nx*depth*.44,(low+high)/2,pz+nz*depth*.44,width,high-low-.14,depth,fins[index],yaw);
      }
    }
    for(const [j,t] of featureWindows.entries()){
      const px=lerp(a[0],b[0],t),pz=lerp(a[1],b[1],t);
      const y=glassLine+(4.5-j%2)*(facadeTop-glassLine)/6;
      addBox(batch,px+nx*.32,y,pz+nz*.32,5.46,3.16,.62,'#293234',yaw);
      addBox(windows,px+nx*.66,y,pz+nz*.66,5.06,2.70,.10,'#526b72',yaw);
      for(const u of [-1.24,0,1.24]){
        addBox(batch,px+Math.cos(yaw)*u+nx*.72,y,pz-Math.sin(yaw)*u+nz*.72,.076,2.70,.10,'#303f41',yaw);
      }
    }
  }
  addBox(batch,-29.4,33.32,-308,5.1,3.0,14.7,'#818b89',-.18);
}
function buildBelfort(batch,windows,scene,f){
  const ox=-277.6,oz=-28.7,ux=.8660254,uz=-.5,nx=.5,nz=.8660254,y=height(ox,oz),yaw=Math.PI/6;
  const stone='#b9b9ac',trim='#d2d1c4',shadow='#747b76',slate='#414d58',glass='#34454b';
  const at=(u,v,h)=>[ox+ux*u+nx*v,y+h,oz+uz*u+nz*v];
  const box=(u,v,h,w,hh,d,tint=stone)=>{const p=at(u,v,h);addBox(batch,...p,w,hh,d,tint,yaw);};
  const opening=(u,v,h,w,hh)=>{const p=at(u,v,h);churchOpening(batch,...p,yaw,w+.25,hh+.18,false,.09,trim);churchOpening(windows,...p,yaw,w,hh,false,.12,glass);};
  const needle=(u,v,base,r,h,tint=slate,sides=8)=>{const p=at(u,v,base);cone(batch,...p,r,h,tint,sides,Math.PI/8);};
  // Schepenhuis: long stone hall with steep slate gable roof.
  box(3,-12,9.4,12,18.8,25);
  const A=at(-3,-24.5,18.8),B=at(9,-24.5,18.8),C=at(9,.5,18.8),D=at(-3,.5,18.8),R=at(3,-24.5,27),S=at(3,.5,27);
  batch.quad(A,D,S,R,slate);batch.quad(R,S,C,B,slate);
  batch.tri(D,C,S,stone);batch.tri(A,R,B,stone);
  for(const h of [1.0,6.4,11.7,18.5])box(3,.65,h,12.3,.23,.3,trim);
  for(const u of [-.8,3.1,7])for(const h of [2.2,7.5,12.8]){
    opening(u,.7,h,1.65,3.15);box(u,.91,h+1.55,.12,3.1,.17,trim);box(u,.91,h+1.45,1.8,.13,.17,trim);
  }
  for(const side of [-3.1,9.1])for(let v=-22.4;v<0;v+=3.1){
    const P=at(side,v,7.2),angle=yaw+(side<0?-Math.PI/2:Math.PI/2);
    churchOpening(windows,...P,angle,1.3,3.2,false,.14,glass);
    const Q=at(side,v,13);churchOpening(windows,...Q,angle,1.3,3.7,false,.14,glass);
  }
  for(let u=-2.8;u<=9;u+=.8){
    box(u,.82,19.8,.09,1.5,.11,trim);box(u,.82,19.15,.72,.13,.12,trim);
    const p=at(u,.85,20);roundWall(batch,...p,.22,.08,trim,6);
  }
  opening(3,.72,21.5,1.4,2.4);
  // Belfry shaft, eight horizontal stages and projecting open tracery crown.
  const tu=-6.1,tv=-1.4;
  box(tu,tv,16,6.8,32,7.1);
  for(const h of [.5,5.1,10.3,16.3,22.3,28.7,31.8])box(tu,tv,h,7.03,.22,7.34,trim);
  for(const h of [2.1,7.7,13.4,26.0])opening(tu,tv+3.62,h,.85,1.8);
  for(const u of [tu-2.35,tu+2.35]){
    opening(u,tv+3.65,16.9,1.0,4.5);
    const P=at(u,tv+3.94,17.6);roundWall(batch,...P,.24,1.8,stone,6);const H=at(u,tv+3.94,19.65);roundWall(batch,...H,.20,.33,stone,7);
    needle(u,tv+3.76,21.5,.5,1.6,trim,4);
  }
  const clockCenter=at(tu,tv+3.72,28.15);
  const clock=new T.Mesh(new T.CircleGeometry(1.46,32),new T.MeshBasicMaterial({color:'#343c3d',side:T.DoubleSide}));clock.position.set(...clockCenter);clock.rotation.y=yaw;scene.add(clock);
  const gold=new T.MeshBasicMaterial({color:'#d2ba72'});
  for(let k=0;k<12;k++){
    const a=k*Math.PI/6,p=at(tu+Math.sin(a)*1.27,tv+3.76,28.15+Math.cos(a)*1.27);
    const mark=new T.Mesh(new T.SphereGeometry(.14,6,4),gold);mark.position.set(...p);scene.add(mark);
  }
  const clockHands=[];
  for(const length of [1.04,.77]){
    const pivot=new T.Group(),hand=new T.Mesh(new T.BoxGeometry(.12,length,.07),gold);
    hand.position.set(0,length*.4,.06);pivot.add(hand);clock.add(pivot);clockHands.push(pivot);
  }
  (scene.userData.analogClocks??=[]).push({minute:clockHands[0],hour:clockHands[1]});
  for(const [h,w] of [[32.3,7.6],[32.7,7.9],[33.1,8.1],[35,8.15]])box(tu,tv,h,w,.26,w,trim);
  for(const side of [-1,1])for(let u=-3.6;u<=3.6;u+=.6){
    box(tu+u,tv+side*3.83,34.1,.10,1.65,.12,trim);
    box(tu+side*3.83,tv+u,34.1,.12,1.65,.10,trim);
  }
  // Open octagonal campanile with visible hanging bells.
  const ring=(h,r,hh,tint)=>{const p=at(tu,tv,h);roundWall(batch,...p,r,hh,tint,8,Math.PI/8);};
  ring(35.2,4.25,.36,slate);ring(35.6,3.2,.4,stone);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+Math.PI/8,u=tu+Math.cos(a)*2.85,v=tv+Math.sin(a)*2.85;
    box(u,v,38.1,.40,4.5,.40,trim);
    const a2=(i+.5)*Math.PI/4+Math.PI/8,P=at(tu+Math.cos(a2)*2.60,tv+Math.sin(a2)*2.60,39.2);
    addBox(batch,...P,.72,1.2,.72,stone,yaw+a2);
    needle(u,v,40.0,.35,1.0,trim,4);
  }
  for(const [u,v,h] of [[tu-.8,tv,37.6],[tu+.8,tv,38.1]]){needle(u,v,h,.65,1.0,'#39443e',8);const P=at(u,v,h+1);roundWall(batch,...P,.31,.35,'#39443e',8);}
  ring(40.1,3.5,.35,slate);needle(tu,tv,40.45,3.25,10.3);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;needle(tu+Math.cos(a)*1.65,tv+Math.sin(a)*1.65,44.2,.55,2.7);}
  box(tu,tv,51.5,.09,1.5,.09,'#c9b477');box(tu+.45,tv,52,.95,.38,.04,'#e3d8b2');
  // Round corner stair turret and wooden roof lantern.
  const turret=at(9.2,-.4,0);roundWall(batch,...turret,1.65,22.5,stone,12);needle(9.2,-.4,22.5,1.95,9.8);
  for(const h of [4,8,12,16,20]){const p=at(9.2,-.4,h);roundWall(batch,...p,1.73,.16,trim,12);}
  for(const u of [-1,1])for(const v of [-1,1])box(3+u*1.1,-7+v*1.1,29.5,.18,4.5,.18,'#514c43');
  needle(3,-7,31.7,1.95,6.5);
  // Projecting late-Gothic Gebiedshuisje, paired pointed windows and pinnacles.
  box(7.4,4,3.2,6.2,6.4,5.6);box(7.4,4,6.6,6.7,.35,6.0,trim);
  for(const u of [5.8,9])opening(u,6.84,7.0,2.15,4.8);
  for(const u of [4.2,7.4,10.6]){
    box(u,6.77,8.7,.34,5.2,.48,trim);needle(u,6.8,11.3,.42,3.6,trim,4);
  }
  batch.tri(at(4.2,6.8,11.3),at(10.6,6.8,11.3),at(7.4,6.8,17.2),stone);
  for(const u of [4.4,5.8,7.4,9,10.4])needle(u,6.86,11.4+Math.max(0,1-Math.abs(u-7.4)/3.2)*5.7,.23,1.4,trim,4);
  opening(7.4,6.91,12.8,.75,1.8);opening(7.4,6.85,.4,3.1,2.9);
  scene.userData.belfortHeight=52;
}
function buildMartens(batch,x,z){
  const y=height(x,z),stone='#a9ada8',trim='#c1c3b9',bronze='#456b5f',dark='#35554d';
  const rings=[[0,1.8,.20],[.20,1.66,.17],[.37,1.47,.18],[.55,1.3,2.6],[3.15,1.5,.20],[3.35,1.65,.22],[3.57,1.5,.16]];
  for(const [h,r,hh] of rings)roundWall(batch,x,y+h,z,r,hh,h>3?trim:stone,8,Math.PI/8);
  // Recessed Gothic panels around the octagonal pedestal.
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,r=1.23,xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;
    churchOpening(batch,xx,y+.93,zz,a,.79,1.75,false,.02,'#818d88');
    churchOpening(batch,xx,y+1.05,zz,a,.61,1.46,false,.04,stone);
    addBox(batch,xx,y+3.12,zz,.67,.13,.12,trim,a);
  }
  const figure=y+3.73;
  // Long printer's robes with a heavy draped cape and separate extended arm.
  roundWall(batch,x,figure,z,.64,2.05,bronze,9);
  cone(batch,x,figure+.15,z,.87,2.0,bronze,9);
  addBox(batch,x,figure+2.1,z,.93,1.0,.62,bronze);
  addBox(batch,x+.36,figure+1.34,z-.11,.35,2.25,.41,dark,.18);
  roundWall(batch,x,figure+2.57,z,.29,.49,bronze,8);
  roundWall(batch,x,figure+3.06,z,.37,.20,dark,10);
  addBox(batch,x-.63,figure+1.72,z+.08,.34,1.0,.39,bronze,-.20);
  addBox(batch,x-.76,figure+1.20,z+.28,.25,.35,.27,bronze);
  addBox(batch,x+.43,figure+2.01,z+.26,.39,.32,.54,bronze,.3);
  addBox(batch,x+.28,figure+2.28,z+.3,.50,.65,.14,dark,.25);
  for(let i=-2;i<=2;i++)addBox(batch,x+i*.22,figure+1.0,z+.56,.055,1.85,.065,i%2?dark:bronze);
}
function buildTownhallPassages(batch,f,y){
  for(const id of [1467066498,1467066499]){
    const road=city.road.find(f=>f.id===id),a=road.p[0],b=road.p.at(-1);
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length,nx=-uz,nz=ux;
    for(const side of [-1,1]){
      const A=[a[0]+nx*2.15*side,a[1]+nz*2.15*side],B=[b[0]+nx*2.15*side,b[1]+nz*2.15*side];
      batch.quad([A[0],y,A[1]],[B[0],y,B[1]],[B[0],y+4.6,B[1]],[A[0],y+4.6,A[1]],'#c6bca5');
    }
    // Open timber double doors folded back into the passage.
    const door=id===1467066498?b:a,yaw=-Math.atan2(uz,ux);
    for(const side of [-1,1]){
      addBox(batch,door[0]+nx*side*2.07-ux*.9,y+1.95,door[1]+nz*side*2.07-uz*.9,1.8,3.9,.12,'#604836',yaw);
      addBox(batch,door[0]+nx*side*2.3,y+2.3,door[1]+nz*side*2.3,.42,4.6,.5,'#e1d6bc',yaw);
    }
    addBox(batch,door[0],y+4.7,door[1],4.9,.35,.6,'#e1d6bc',yaw+Math.PI/2);
  }
}
function dressMasonry(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 facadePosition; varying vec3 facadeNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n facadePosition=position; facadeNormal=normal;');
    shader.fragmentShader='varying vec3 facadePosition; varying vec3 facadeNormal;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float brick=step(diffuseColor.g*1.17,diffuseColor.r)*step(abs(facadeNormal.y),0.18);
      vec3 tangent=normalize(vec3(facadeNormal.z,0.001,-facadeNormal.x));
      vec2 cell=vec2(dot(facadePosition,tangent)/0.235,facadePosition.y/0.078);
      // Derivatives must precede the discontinuous alternating-row offset.
        vec2 aa=fwidth(cell);
        cell.x+=mod(floor(cell.y),2.0)*0.5;
      vec2 seam=min(fract(cell),1.0-fract(cell));
      float mortar=1.0-min(smoothstep(.018,.045+aa.x,seam.x),smoothstep(.035,.08+aa.y,seam.y));
      float fade=1.0-smoothstep(.08,.45,max(aa.x,aa.y));
      float variation=fract(sin(dot(floor(cell),vec2(127.1,311.7)))*43758.5453)-.5;
      diffuseColor.rgb*=1.0+brick*fade*(variation*.10-mortar*.10);
    `);
  };
}
function metres(value){
  if(value===null||value===undefined||value==='')return NaN;
  const s=String(value).trim().replace(',','.');
  const n=parseFloat(s);return /ft|feet|'/.test(s)?n*.3048:n;
}
export function buildingDimensions(f,size,industrial=false,special=null){
  const explicit=metres(f.h),levels=parseFloat(f.l),lidar=metres(f.dh);
  const flat=f.roofShape==='flat'||industrial||!!f.holes?.length||special?.kind==='cinema'||size<30;
  let roof=flat?0:Math.min(3.9,Math.sqrt(size)*.18);
  const taggedRoof=metres(f.roofHeight),roofLevels=parseFloat(f.roofLevels);
  if(Number.isFinite(taggedRoof))roof=Math.max(0,taggedRoof);
  else if(Number.isFinite(roofLevels))roof=Math.max(0,roofLevels*2.6);
  let total,source;
  if(f.lidarReliable&&Number.isFinite(lidar)&&lidar>0){total=lidar;source='LiDAR measured';roof=Number.isFinite(f.dr)?f.dr:Math.min(roof,lidar*.28);}
  else if(Number.isFinite(explicit)&&explicit>0){total=explicit;source='OSM height';roof=Math.min(roof,Math.max(0,total-1));}
  else if(Number.isFinite(levels)&&levels>0){total=levels*2.9+roof;source='OSM floors';}
  else if(special?.height){total=special.height+roof;source='landmark reference';}
  else if(Number.isFinite(lidar)&&lidar>0){total=lidar;source='LiDAR estimate';roof=Math.min(roof,total*.28);}
  else{total=(size<44?3.5:industrial?6.8:5.4+pick(f.id)*4.7)+roof;source='procedural estimate';}
  return {walls:Math.max(.5,total-roof),roof,total,source};
}
function* buildBuildings(scene,features=city.building,options={}){
  const sliceMs=options.sliceMs??6;
  let deadline=performance.now()+sliceMs;
  const mass=new Batch(), windows=new Batch();
  const walls=['#b98d75','#cfb79e','#a97465','#d4c7aa','#ad8271','#b5ada1','#c3a891','#d6bfa2'];
  const roofs=['#645b56','#795b50','#7c5146','#655c5c','#a26b57','#54585b','#826a62'];
  const fuel=city.fuel||[], covered=new Set();
  for(const f of features){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    if(f.id===1022233933)continue; // Railway infill, included in the continuous masonry shell.
    const p=f.p,[x,z]=center(p);
    if(!inside(x,z,-25)) continue;
    const [x1,z1,x2,z2]=extents(p);
    const station=fuel.find(v=>contains(...v.p,p)||(f.c==='roof'&&Math.hypot(v.p[0]-x,v.p[1]-z)<44));
    if(f.shelter||buildingShelterData[f.id]){transportShelter(mass,f,options.solids);continue;}
    if(f.c==='roof'||f.fuel||station){
      canopy(mass,p,station?.n||(f.fuel?'Fuel':''),options.solids);
      if(station)covered.add(station);
      continue;
    }
    f.passage=f.id===13665889||f.id===950127677||(x>35&&x<77&&z>251&&z<288&&p.some(q=>passage(...q)));
    if(!options.indexed)buildings.insert(f,x1-2,z1-2,x2+2,z2+2);
    if(buildStationTicketBuilding({batch:mass,windows,f,height,polygon,addBox}))continue;
    if(buildHistoricStation({batch:mass,windows,scene,f,height,polygon,addBox,T}))continue;
    if(buildStationPavilion({batch:mass,windows,f,height,polygon,addBox}))continue;
    if(buildCivicLandmark({batch:mass,windows,scene,f,height,center,addBox,polygon,pitched,churchOpening,label,roundWall,cone,T}))continue;
    if(f.id===114415568){buildBelfort(mass,windows,scene,f);continue;}
    if(f.id===114415886){
      buildBorse(mass,windows,f);
      continue;
    }
    if(f.id===441726333){
      buildAdministrativeCentre(mass,windows,f);
      continue;
    }
    const size=(x2-x1)*(z2-z1);
    const special=specials[f.id], kind=special?.kind;
    const industrial=f.factory||f.hospital||f.school||['industrial','warehouse','retail','commercial'].includes(f.c);
    const y=height(x,z);
    const church=churches[f.id]||(f.c==='church'?{eaves:7,cap:12,wall:'#b29d87',round:true}:null);
    if(church){
      buildChurch(mass,windows,f,church,y);
      continue;
    }
    const dimensions=buildingDimensions(f,size,industrial,special);
    f.heightSource=dimensions.source;
    const h=dimensions.walls,top=y+h;
    const wall=special?.wall||(f.factory?'#96938b':f.hospital?'#cecac0':f.school?'#b99986':walls[Math.floor(pick(f.id,1)*walls.length)]);
    const roof=special?.roof||roofs[Math.floor(pick(f.id,2)*roofs.length)];
    const windowed=(!!special&&kind!=='cinema')||f.hospital||f.school||(!industrial&&size>35);
    facade(mass,windows,scene,f,p,y,top,wall,kind,windowed);
    for(const hole of f.holes||[])facade(mass,windows,scene,f,hole,y,top,wall,null,windowed);
    if(f.passage)polygon(mass,p,()=>y+(f.id===13665889?4.6:3.35),'#756d61',Infinity,f.holes||[]);
    if(f.id===13665889)buildTownhallPassages(mass,f,y);
    if(dimensions.roof<.05){
      polygon(mass,p,()=>top+.025,roof,Infinity,f.holes||[]);
    }else{
      const r=dimensions.roof;
      pitched(mass,p,top+r,roof,top,wall);
    }
  }
  for(const v of options.fuel??fuel){
    if(covered.has(v)||!inside(...v.p))continue;
    const [x,z]=v.p;
    canopy(mass,[[x-5,z-3.5],[x+5,z-3.5],[x+5,z+3.5],[x-5,z+3.5],[x-5,z-3.5]],v.n||'Fuel',options.solids);
  }
  const masonry=yield* mass.meshSteps(scene);masonry.castShadow=true;
  dressMasonry(masonry.material);
  return yield* windows.meshSteps(scene,{emissive:'#dfa84f',emissiveIntensity:0},options.windowsMaterial);
}
function facadeAt(x,z,range=8){
  let best=null;
  for(const f of buildings.get(x,z)){
    if(f.passage&&passage(x,z))continue;
    const insideFootprint=contains(x,z,f.p)&&!f.holes?.some(p=>contains(x,z,p));
    for(const p of [f.p,...(f.holes||[])]){
      for(let i=1;i<p.length;i++){
        const a=p[i-1],b=p[i],s=segment(a,b,f,0);
        if(s.length<.6)continue;
        const {d,t}=projection(s,x,z);
        if(d>range)continue;
        const X=lerp(a[0],b[0],t),Z=lerp(a[1],b[1],t);
        const yaw=-Math.atan2(s.dz,s.dx),nx=Math.sin(yaw),nz=Math.cos(yaw);
        const direction=contains(X+nx*.15,Z+nz*.15,f.p)&&!f.holes?.some(h=>contains(X+nx*.15,Z+nz*.15,h))?-1:1;
        const street=nearest(roads,X+direction*nx,Z+direction*nz);
        const score=d+(insideFootprint?0:1)+(street?.d??8)*.24;
        if(!best||score<best.score)best={x:X,z:Z,s,t,nx:nx*direction,nz:nz*direction,yaw,score};
      }
    }
  }
  return best;
}
function paintEntrancesAndShops(scene,solids){
  const wood=new Batch(),glass=new Batch();wood.solids=solids;
  const visited=new Set();
  for(const f of city.business||[]){
    const front=facadeAt(...f.p,19);
    if(!front)continue;
    const {x,z,s,nx,nz,yaw,t}=front;
    if(!inside(x,z)||s.length<2.7)continue;
    const point=[Math.round(x*2),Math.round(z*2)].join(',');
    if(visited.has(point))continue;
    visited.add(point);
    const half=Math.min(2.95,s.length*.42),a=clamp(t,half/s.length,1-half/s.length);
    const X=lerp(s.a[0],s.b[0],a),Z=lerp(s.a[1],s.b[1],a),y=height(X,Z);
    const bar=f.c==='pub'||f.c==='bar',food=f.c!=='shop'&&!bar;
    const palette=bar?'#425b4c':food?'#955d4c':'#567680';
    addBox(wood,X+nx*.12,y+1.25,Z+nz*.12,half*2,2.5,.23,palette,yaw);
    for(const k of [-.56,.53]){
      addBox(glass,X+nx*.24+Math.cos(yaw)*half*k,y+1.27,Z+nz*.24-Math.sin(yaw)*half*k,half*.73,1.65,.10,bar?'#625247':food?'#7b7870':'#697f7c',yaw);
    }
    addBox(wood,X+nx*.24,y+1.05,Z+nz*.24,.61,2.05,.07,'#404a43',yaw);
    addBox(wood,X+nx*.23,y+2.51,Z+nz*.23,half*2,.38,.18,bar?'#2d4136':food?'#76463b':'#3d5965',yaw);
    if(food||bar){
      addBox(wood,X+nx*.52,y+2.26,Z+nz*.52,half*2+.12,.11,.89,palette,yaw);
      if(food)for(let j=-3;j<=3;j+=2){
        addBox(wood,X+nx*.52+Math.cos(yaw)*half*j/4,y+2.32,Z+nz*.52-Math.sin(yaw)*half*j/4,half*.23,.027,.89,'#e4c8a6',yaw);
      }
    }
    if((bar||f.c==='restaurant'||f.c==='cafe')&&half>1.55){
      for(const k of [-.56,.58]){
        const u=X+nx*2.43+Math.cos(yaw)*half*k,v=Z+nz*2.43-Math.sin(yaw)*half*k;
        const near=nearest(roads,u,v);
        const isWalkway=near&&near.d<near.width/2+1.2&&near.f.c!=='pedestrian'&&near.f.c!=='footway';
        if(isWalkway||wet(u,v)||[[0,0],[.9,0],[-.9,0],[0,.9],[0,-.9]].some(([a,b])=>buildingAt(u+a,v+b)))continue;
        const level=surface(u,v);
        addBox(wood,u,level+.72,v,.93,.07,.73,'#956f50',yaw);
        addBox(wood,u,level+.35,v,.11,.7,.11,'#686154',yaw);
        for(const side of [-1,1]){
          const px=u+Math.cos(yaw)*.66*side,pz=v-Math.sin(yaw)*.66*side;
          addBox(wood,px,level+.4,pz,.33,.07,.34,'#85624a',yaw);
          addBox(wood,px+Math.cos(yaw)*.14*side,level+.61,pz-Math.sin(yaw)*.14*side,.045,.47,.34,'#85624a',yaw);
          addBox(wood,px,level+.18,pz,.056,.36,.065,'#696158',yaw);
        }
      }
    }
    if(f.n&&Math.hypot(X+240,Z)<215&&visited.size<170){
      label(scene,f.n.toUpperCase(),X+nx*.37,y+2.55,Z+nz*.37,Math.atan2(nx,nz),Math.min(half*1.8,3.8));
    }
  }
  for(const f of city.door||[]){
    const front=facadeAt(...f.p,1.35);
    if(!front||!inside(front.x,front.z))continue;
    const {x,z,nx,nz,yaw,s}=front,y=height(x,z);
    const wide=f.c==='main'&&(s.f.hospital||s.f.school);
    const w=wide?1.9:1.04,h=wide?2.5:2.15;
    addBox(wood,x+nx*.18,y+h*.5,z+nz*.18,w+.21,h+.13,.30,'#b2a898',yaw);
    addBox(wide?glass:wood,x+nx*.348,y+h*.5,z+nz*.348,w,h,.09,wide?'#688484':f.c==='garage'?'#7b8078':'#645546',yaw);
    addBox(wood,x+nx*.41+Math.cos(yaw)*w*.30,y+1.05,z+nz*.41-Math.sin(yaw)*w*.30,.12,.055,.035,'#d6bd8d',yaw);
  }
  const cinema=city.building.find(f=>f.id===690232338);
  if(cinema){
    const [x,z]=center(cinema.p);
    const square=city.groundPatch?.find(f=>/Hopmarkt/.test(f.n));
    const near=square?center(square.p):[-365,55];
    const candidates=cinema.p.slice(1).map((p,i)=>{
      const a=cinema.p[i],X=(a[0]+p[0])/2,Z=(a[1]+p[1])/2;
      return {x:X,z:Z,yaw:-Math.atan2(p[1]-a[1],p[0]-a[0]),width:Math.hypot(p[0]-a[0],p[1]-a[1])};
    }).filter(f=>f.width>2.2);
    const f=candidates.sort((a,b)=>Math.hypot(a.x-(near?.[0]??x),a.z-(near?.[1]??z))-Math.hypot(b.x-(near?.[0]??x),b.z-(near?.[1]??z)))[0];
    if(f){
      const nx=Math.sin(f.yaw),nz=Math.cos(f.yaw),out=contains(f.x+nx*.15,f.z+nz*.15,cinema.p)?-1:1;
      const X=f.x+nx*.16*out,Z=f.z+nz*.16*out,y=height(f.x,f.z);
      addBox(glass,X,y+1.45,Z,Math.min(f.width*.75,5.1),2.9,.27,'#3b4b4e',f.yaw);
      addBox(wood,X,y+3.01,Z,Math.min(f.width*.9,5.8),.32,.65,'#5c6261',f.yaw);
      label(scene,'CINEMA',X+nx*.27*out,y+4.15,Z+nz*.27*out,f.yaw,Math.min(f.width*.8,4.8));
    }
  }
  wood.mesh(scene);
  return glass.mesh(scene,{emissive:'#dba050',emissiveIntensity:0});
}
function buildGreens(scene,solids){
  const land=new Batch();
  const planted={tri(a,b,c,tint){
    const cut=cutCycleTunnel([a,b,c]);
    if(cut){for(const triangle of cut)land.tri(...triangle,tint);return;}
    const x=(a[0]+b[0]+c[0])/3,z=(a[2]+b[2]+c[2])/3;
    const road=nearest(roads,x,z);
    if(road&&road.d<road.width/2+.18)return;
    for(const tri of subtractRoadFootprints([a,b,c]))land.tri(...tri,tint);
  }};
  for(const group of ['factory','hospital','school']){
    for(const f of city[group]||[])polygon(land,f.p,p=>height(...p)+.049,group==='factory'?'#8a8d8b':'#939897',14);
  }
  for(const f of city.green||[]){
    if(f.p.length>600||!inside(...center(f.p),-200)) continue;
    polygon(planted,f.p,p=>groundHeight(...p)+.065,f.c==='pitch'?'#7e9257':f.c==='wood'||f.c==='forest'?'#8b9b61':'#91a16b',f.p.some(p=>Math.hypot(p[0]-538,p[1]-440)<45)?1:14,f.holes||[]);
  }
  const square=[[-315,-7],[-302,-44],[-282,-60],[-247,-44],[-213,-14],[-218,13],[-251,9],[-315,-7]];
  const marketSetts=new Batch();
  polygon(marketSetts,square,p=>height(...p)+.19,'#7e858a',5);
  paintPavers(marketSetts,scene,[.14,.145],.23);
  land.mesh(scene);
  buildMarketRosette(scene,solids);
}
function buildMarketRosette(scene,solids){
  const batch=new Batch(),x=-229.2,z=-2.4,y=height(x,z)+.26,r=7.9;
  const p=(a,d)=>{const X=x+Math.cos(a)*d,Z=z+Math.sin(a)*d;return [X,height(X,Z)+.235,Z];};
  for(let i=0;i<96;i++){
    const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
    batch.tri([x,y,z],p(a,r),p(b,r),'#73845d');
    batch.quad(p(a,r+.05),p(b,r+.05),p(b,r+.27),p(a,r+.27),'#a4aca1');
  }
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=a+Math.PI/4,m=(a+b)/2;
    const outer=[p(a,r+.3),p(m,r+3.5),p(b,r+.3)];
    const inner=[p(a+.055,r+.30),p(m,r+2.3),p(b-.055,r+.30)];
    for(let j=0;j<2;j++)batch.quad(outer[j],outer[j+1],inner[j+1],inner[j],'#d0d2c5');
  }
  batch.solids=solids;
  const rock=new T.IcosahedronGeometry(1,0).getAttribute('position');
  for(let i=0;i<33;i++){
    const angle=pick(i,73)*Math.PI*2,d=Math.sqrt(pick(i,74))*6.7,xx=x+Math.cos(angle)*d,zz=z+Math.sin(angle)*d;
    const w=.35+pick(i,75)*.38,h=.22+pick(i,76)*.28;
    const tint=['#a9a18a','#bcb49a','#8b8a78','#b2a48a'][i%4];
    for(let j=0;j<rock.count;j+=3){
      const points=[];for(let k=j;k<j+3;k++)points.push([xx+rock.getX(k)*w,height(xx,zz)+.26+h+rock.getY(k)*h,zz+rock.getZ(k)*w*.8]);
      batch.tri(...points,tint);
    }
  }
  batch.mesh(scene).castShadow=true;
}
function paintMonuments(scene,batch){
  let flame=null;
  for(const f of city.monument||[]){
    if(f.id===1296073688)continue;
    const [x,z]=f.p;
    if(!inside(x,z)||wet(x,z))continue;
    const y=height(x,z),stone='#9a9283',bronze='#59675c';
    if(f.id===1296071979){
      addBox(batch,x,y+.13,z,3.9,.26,3.25,'#7d776e');
      addBox(batch,x,y+.41,z,2.2,.40,1.75,'#a19b8c');
      addBox(batch,x,y+.76,z,1.26,.37,1.07,'#696963');
      roundWall(batch,x,y+.94,z,.72,.17,'#6b5c47',12);
      roundWall(batch,x,y+1.1,z,.83,.08,'#897351',12);
      flame=new T.Group();
      for(const [i,tint] of ['#ed6c37','#ffae49','#fff0a5'].entries()){
        const tongue=new T.Mesh(new T.ConeGeometry(.22-i*.043,.55-i*.10,5),new T.MeshBasicMaterial({color:tint}));
        tongue.position.set((i-1)*.12,.12,.035*i);
        tongue.rotation.z=.16*(i-1);
        flame.add(tongue);
      }
      flame.position.set(x,y+1.29,z);
      scene.add(flame);
      for(const side of [-1,1]){
        const u=x+side*1.15,v=z+.57;
        roundWall(batch,u,y+.24,v,.29,.11,'#56744b',9);
        for(let j=0;j<7;j++){
          const a=j*Math.PI*2/7;
          addBox(batch,u+Math.cos(a)*.24,y+.39,v+Math.sin(a)*.24,.104,.085,.10,j%2?'#e1d3ae':'#ad6d62');
        }
      }
    }else if(f.c==='statue'||f.c==='bust'||f.c==='sculpture'){
      addBox(batch,x,y+.35,z,.96,.70,.92,stone);
      const h=f.c==='bust'?.63:1.33;
      addBox(batch,x,y+.71+h*.38,z,.43,h*.76,.38,bronze);
      addBox(batch,x,y+.74+h*.79,z,.25,.27,.23,bronze);
    }else if(f.c==='wayside_cross'){
      addBox(batch,x,y+.11,z,.47,.22,.44,stone);
      addBox(batch,x,y+.93,z,.14,1.72,.14,'#726657');
      addBox(batch,x,y+1.33,z,.75,.13,.13,'#726657');
    }else if(!buildingAt(x,z)){
      addBox(batch,x,y+.14,z,1.24,.28,.91,stone);
      addBox(batch,x,y+.64,z,.88,.91,.58,'#86827a');
      addBox(batch,x,y+.72,z+.301,.65,.52,.05,bronze);
    }
  }
  return flame;
}
function* buildProps(scene,options={}){
  const owns=options.owns||(()=>true),local=options.mode!=='global',global=options.mode!=='local';
  const sliceMs=options.sliceMs??6;
  let deadline=performance.now()+sliceMs;
  const props=new Batch(), leaves=new Batch(), bulbs=new Batch(),lampPositions=[];
  props.solids=options.solids;
  const barrierBatch=new Batch();if(local)paintBarriers(barrierBatch,owns,options.barrierFeatures);
  const barriers=yield* barrierBatch.meshSteps(scene);barriers.castShadow=true;
  const flame=global?paintMonuments(scene,props):null;
  const heads=Array.from({length:2},()=>Array.from({length:3},()=>new Batch()));
  if(local)paintStreetObjects(props,bulbs,heads,lampPositions,owns,options.streetFeatures);
  const localPlanted=new Hash();
  const planted={insert:(...args)=>localPlanted.insert(...args),get:(x,z)=>options.mappedTreeIndex?[...localPlanted.get(x,z),...options.mappedTreeIndex.get(x,z)]:localPlanted.get(x,z)};
  const mark=(x,z)=>planted.insert([x,z],x-3.4,z-3.4,x+3.4,z+3.4);
  const tree=(x,z,i,mapped=false,canopyHeight=null,shrub=false,canopyRadius=null)=>{
    if(mapped){
      const road=nearest(roads,x,z,f=>!isPath(f));
      const median=nearest(medians,x,z);
      const legitimateMedian=median&&median.d<median.width/2+.15;
      if(road&&!legitimateMedian&&road.d<road.width/2+.65&&Math.abs(lerp(road.ya,road.yb,road.t)-height(x,z))<2){
        const X=lerp(road.a[0],road.b[0],road.t),Z=lerp(road.a[1],road.b[1],road.t),nx=road.dz/road.length,nz=-road.dx/road.length;
        const side=(x-X)*nx+(z-Z)*nz>=0?1:-1,offset=road.width/2+1.1;
        const choices=[side,-side].map(s=>[X+nx*offset*s,Z+nz*offset*s]);
        const target=choices.find(([a,b])=>inside(a,b)&&!wet(a,b)&&!buildingAt(a,b));
        if(!target)return;
        [x,z]=target;
      }
    }
    if(!inside(x,z)||wet(x,z)||buildingAt(x,z))return;
    mark(x,z);
    const y=height(x,z), h=canopyHeight??(3.8+pick(i,12)*5.6);
    if(!shrub)addBox(props,x,y+h*.27,z,.25+h*.027,h*.54,.25+h*.027,'#695744');
    const tones=['#536c45','#648252','#7c9353','#819158','#566f48','#6e8a5a'];
    const tone=tones[Math.floor(pick(i)*tones.length)];
    if(canopyHeight!==null){
      // Closed low-poly ellipsoids, with a broad crown and rounded shoulders.
      const envelope=shrub?Math.max(.8,h*.65):Math.min(4.5,h*.28)+h*.12;
      const canopyScale=canopyRadius===null?1:Math.min(1,canopyRadius/envelope);
      for(let k=0;k<(shrub?1:3);k++){
        const a=k*Math.PI*2/3,rx=x+(k?Math.cos(a)*h*.12*canopyScale:0),rz=z+(k?Math.sin(a)*h*.12*canopyScale:0);
        const radius=(shrub?Math.max(.8,h*.65):Math.min(4.5,h*(k?.21:.28)))*canopyScale,cy=y+h*(shrub?.48:k?.66:.73),ry=h*(shrub?.5:k?.23:.27);
        const point=(row,col)=>{const lat=-Math.PI/2+row*Math.PI/4,u=col*Math.PI*2/8;
          return [rx+Math.cos(lat)*Math.cos(u)*radius,cy+Math.sin(lat)*ry,rz+Math.cos(lat)*Math.sin(u)*radius];};
        for(let row=0;row<4;row++)for(let col=0;col<8;col++){
          const a=point(row,col),b=point(row,col+1),c=point(row+1,col+1),d=point(row+1,col);
          if(row>0)leaves.tri(a,b,d,tone);
          if(row<3)leaves.tri(b,c,d,tone);
        }
      }
      return;
    }
    const crown=h*(.19+pick(i,11)*.12);
    cone(leaves,x,y+h*.51,z,crown,h*.51,tone,7,pick(i,2));
    for(let k=0;k<7;k++){
      const u=k*Math.PI*2/7+pick(i,2),v=(k+1)*Math.PI*2/7+pick(i,2);
      leaves.tri([x+Math.cos(u)*crown,y+h*.51,z+Math.sin(u)*crown],[x,y+h*.35,z],[x+Math.cos(v)*crown,y+h*.51,z+Math.sin(v)*crown],tone);
    }
  };
  for(const [i,f] of options.treeEntries??(local?(city.tree||[]).entries():[])){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    if(local&&owns(...f.p))tree(...f.p,i,true);
  }
  for(const [i,f] of options.aerialTreeEntries??(local?[...aerialVegetation,...medianVegetation].entries():[])){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    const [x,z]=f.p;
    if(!local||!owns(x,z)||planted.get(x,z).some(p=>Math.hypot(p[0]-x,p[1]-z)<3.4))continue;
    const near=nearest(roads,x,z);
    if(near&&near.d<near.width/2+(f.median?.45:2))continue;
    tree(x,z,100000+i,false,f.h,f.kind==='shrub',f.r??null);
  }
  // Photo-referenced pollarded plane-tree row on the Treinstraat pavement.
  // Preserve individually mapped trees and keep both tunnel mouths clear.
  {const wall=city.retainingWall.find(f=>f.referenceArches);let distance=0,next=4,count=0;
    if(global&&wall)for(let i=1;i<wall.p.length;i++){
      const a=wall.p[i-1],b=wall.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);
      while(next<=distance+L){
        const t=(next-distance)/L,n=wall.normals[i-1],x=lerp(a[0],b[0],t)-n[0]*1.15,z=lerp(a[1],b[1],t)-n[1]*1.15;
        next+=7.2;
        if(x<109||x>229||planted.get(x,z).some(p=>Math.hypot(p[0]-x,p[1]-z)<3.4)||buildingAt(x,z))continue;
        const y=lerp(wall.bottom[i-1],wall.bottom[i],t),road=nearest(roads,x,z,f=>!isPath(f));
        if(road&&road.d<road.width/2+.35)continue;
        mark(x,z);count++;
        addBox(props,x,y+1.65,z,.4,3.3,.4,'#827767');
        for(let k=0;k<4;k++){
          const u=k*Math.PI/2+.35,tip=[x+Math.cos(u)*.85,z+Math.sin(u)*.85];
          prism(props,[x,z],tip,.18,y+2.7,y+3.75,.18,'#827767');
          addBox(props,tip[0],y+3.8,tip[1],.3,.3,.3,'#887c69');
          prism(props,tip,[tip[0]+Math.cos(u)*.22,tip[1]+Math.sin(u)*.22],.09,y+3.8,y+4.22,.09,'#786d5f');
        }
      }
      distance+=L;
    }
    scene.userData.treinstraatPollardedTrees=count;
  }
  for(const [i,f] of options.greenEntries??(local?(city.green||[]).entries():[])){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    if(!local||!['park','forest','wood','garden'].includes(f.c)) continue;
    const [a,b,c,d]=extents(f.p);
    const spacing=f.c==='forest'||f.c==='wood'?6.8:13;
    for(let x=Math.max(a,box[0]);x<Math.min(c,box[2]);x+=spacing){
      if(options.region&&(x+spacing<options.region.x||x>options.region.x+240))continue;
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
      for(let z=Math.max(b,box[1]);z<Math.min(d,box[3]);z+=spacing){
        if(options.region&&(z+spacing<options.region.z||z>options.region.z+240))continue;
        const seed=x*71+z*13+i,u=x+pick(seed,1)*spacing*.76,v=z+pick(seed,2)*spacing*.76;
        if(!owns(u,v)||!contains(u,v,f.p)||(f.holes||[]).some(h=>contains(u,v,h))||planted.get(u,v).some(([a,b])=>Math.hypot(a-u,b-v)<(f.c==='park'||f.c==='garden'?7.2:3.4)))continue;
        const near=nearest(roads,u,v);
        if(!near||near.d>near.width*.5+2.35)tree(u,v,seed);
      }
    }
  }
  for(const [i,bench] of options.benchEntries??(local?(city.bench||[]).entries():[])){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    let [x,z]=bench.p;
    if(!local||!owns(x,z)||!inside(x,z)) continue;
    const placement=placeRoadside([x,z],{segments:roads.get(x,z).filter(r=>!['pedestrian','living_street'].includes(r.f.c)).map(r=>({...r,path:isPath(r.f)})),width:1.8,depth:.55,level:surface,blocked:roadsideBlocked});
    [x,z]=placement.p;
    const y=surface(x,z);
    const path=nearest(roads,x,z,f=>isPath(f)),street=path&&path.d<12?path:nearest(roads,x,z);
    const yaw=street?Math.atan2(x-lerp(street.a[0],street.b[0],street.t),z-lerp(street.a[1],street.b[1],street.t)):pick(i)*6.28;
    addBox(props,x,y+.49,z,1.8,.13,.49,'#805840',yaw);
    addBox(props,x+Math.sin(yaw)*.22,y+.83,z+Math.cos(yaw)*.22,1.8,.4,.09,'#986748',yaw);
    for(const s of [-.65,.65]) addBox(props,x+Math.cos(yaw)*s,y+.23,z-Math.sin(yaw)*s,.13,.46,.39,'#4b514a',yaw);
  }
  for(const {p:[x,z]} of options.fountainFeatures??(local?city.fountain||[]:[])){
    if(!local||!owns(x,z)||!inside(x,z)) continue;
    const y=height(x,z);
    addBox(props,x,y+.28,z,2.65,.56,2.65,'#b1a895',Math.PI/4);
    addBox(props,x,y+.58,z,2.31,.09,2.31,'#559e98',Math.PI/4);
    addBox(props,x,y+.89,z,.3,.7,.3,'#9eae9d');
  }
  const mappedLights=new Hash();
  for(const f of city.streetObject||[])if(f.c==='street_lamp'){const [x,z]=f.p;mappedLights.insert(f,x-22,z-22,x+22,z+22);}
  for(const f of options.roadFeatures??(local?city.road:[])){
    if(performance.now()>=deadline){yield null;deadline=performance.now()+sliceMs;}
    if(!local||!['tertiary','secondary','residential','living_street'].includes(f.c)||f.b) continue;
    const w=roadWidth(f)*.5+1.05;
    for(let i=1;i<f.p.length;i++){
      const a=f.p[i-1],b=f.p[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(d<22) continue;
      for(let j=12+pick(f.id+i)*8;j<d-5;j+=36){
        const t=j/d,origin=[lerp(a[0],b[0],t)+(b[1]-a[1])/d*w,lerp(a[1],b[1],t)-(b[0]-a[0])/d*w];
        // Generated lamps need the same corridor clearance as mapped street
        // furniture: an offset from one way can still land in another lane.
        if(!owns(...origin)||!inside(...origin))continue;
        const candidates=new Set();
        for(const dx of [-12,0,12])for(const dz of [-12,0,12])for(const r of roads.get(origin[0]+dx,origin[1]+dz)){
          if(['pedestrian','living_street','steps'].includes(r.f.c)||/^(deck-pavement-|bridge-link-)/.test(String(r.f.id)))continue;
          candidates.add(r);
        }
        const placement=placeRoadside(origin,{segments:[...candidates].map(r=>({...r,path:isPath(r.f)})),primaryId:f.id,width:.35,depth:.35,clearance:.2,level:surface,blocked:roadsideBlocked});
        if(placement.unresolved)continue;
        const [x,z]=placement.p;
        if(!inside(x,z)||roadsideBlocked(x,z)||mappedLights.get(x,z).some(f=>Math.hypot(f.p[0]-x,f.p[1]-z)<20))continue;
        const y=surface(x,z);
        addBox(props,x,y+2.05,z,.13,4.1,.13,'#4d5950');
        addBox(props,x,y+4.09,z,.53,.12,.36,'#414e45');
        addBox(bulbs,x,y+3.99,z,.35,.09,.25,'#ffd885');
        lampPositions.push([x,y+3.95,z]);
      }
    }
  }
  if(global){
  const statue=city.poi?.find(f=>/Standbeeld Dirk Martens/i.test(f.n));
  if(statue){
    const [x,z]=statue.p,y=height(x,z);
    buildMartens(props,x,z);
  }
  for(let i=0;i<7;i++){
    const x=-253+i*4.05,z=-31+i*1.75,y=height(x,z);
    if(buildings.get(x,z).some(f=>contains(x,z,f.p))) continue;
    addBox(props,x,y+.4,z,.9,.08,.9,'#a17452');
    addBox(props,x,y+.22,z,.09,.44,.09,'#665847');
    addBox(props,x,y+1.15,z,.09,2.3,.09,'#746550');
    cone(props,x,y+2.1,z,1.42,.45,i%2?'#e1cc9b':'#a64c49',8,Math.PI/8);
    for(let side=-1;side<2;side+=2){
      addBox(props,x+side*.8,y+.26,z,.34,.11,.42,'#8d6e51');
      addBox(props,x+side*1.01,y+.45,z,.1,.53,.43,'#8d6e51');
    }
  }

  label(scene,'AALSTERSE VLAAIEN',-248,height(-248,-23)+2.4,-23,0,3.6);
  const [x1,z1,x2,z2]=[-279,-10,-225,-14];
  for(const [x,z] of [[x1,z1],[x2,z2]]) addBox(props,x,height(x,z)+3.1,z,.11,6.2,.11,'#5a5a48');
  for(let i=0;i<22;i++){
    const t=i/22,x=lerp(x1,x2,t),z=lerp(z1,z2,t),y=height(x,z)+6.15-Math.sin(t*Math.PI)*1.4;
    ribbon(props,[x,z],[lerp(x1,x2,(i+1)/22),lerp(z1,z2,(i+1)/22)],.022,y,y,'#706952');
    props.tri([x,y,z],[x+1.11,y,z-.08],[x+.53,y-.7,z-.03],['#d69554','#a95655','#e1c366','#6c9b8b'][i%4]);
  }
  }
  if(local){
    const bikes=new Batch();
    for(const site of bicycleParkingSites){
      if(!owns(...site.p))continue;
      const road=nearest(roads,...site.p);
      const cachedLayouts=options.region?(options.region.bikeLayouts??=new Map()):new Map();
      const slots=cachedLayouts.get(site.id)??bicycleParkingLayout(site,{angle:road?Math.atan2(road.dz,road.dx):0,contains,
        clear:(x,z)=>{
          if(buildingAt(x,z)||wet(x,z))return false;
          if(options.solids?.blocked(x,z,surface(x,z),.28,1.3))return false;
          // Fixed Grote Markt terrace also exists in the global prop pass.
          for(let i=0;i<7;i++)if(Math.hypot(x-(-253+i*4.05),z-(-31+i*1.75))<1.65)return false;
          for(const r of roads.get(x,z)){
            if(r.f.c==='pedestrian'||r.f.c==='living_street')continue;
            if(projection(r,x,z).d<r.width/2+.45)return false;
          }
          if((city.door||[]).some(d=>Math.hypot(d.p[0]-x,d.p[1]-z)<1.5))return false;
          return true;
        }});
      cachedLayouts.set(site.id,slots);
      for(const [i,slot] of slots.entries()){
        paintBicycleParking(bikes,[{...slot,occupied:false}],surface,options.solids);
        if(slot.occupied){const single=new Batch();paintBicycleParking(single,[slot],surface,null,true);const model=single.mesh(scene);
          const hide=hidden=>{for(const mesh of model.meshes){mesh.visible=!hidden;mesh.userData.takenVehicle=hidden;}};
          const vehicle=vehicleFleet.register({id:'bike/'+site.id+'/'+i,kind:'bike',x:slot.x,z:slot.z,y:surface(slot.x,slot.z),a:Math.atan2(slot.v[0],slot.v[1]),tint:['#325569','#a94538','#495349','#b39a54','#6c627b','#c6c9c8'][slot.color]},hide);
          for(const mesh of model.meshes)mesh.geometry.addEventListener('dispose',()=>{if(vehicle.hide===hide)delete vehicle.hide;});
          options.solids?.addSegment([slot.x-slot.v[0]*.55,vehicle.y,slot.z-slot.v[1]*.55],[slot.x+slot.v[0]*.55,vehicle.y,slot.z+slot.v[1]*.55],.3,1,{kind:'parked_bike',vehicle});
        }yield null;
      }
    }
    (yield* bikes.meshSteps(scene)).castShadow=true;
  }
  (yield* props.meshSteps(scene)).castShadow=true;
  (yield* leaves.meshSteps(scene)).castShadow=true;
  const tints=['#e75d47','#e8b04b','#61bd80'];
  const signals=heads.map((group,axis)=>group.map((part,i)=>part.mesh(scene,{color:tints[i],emissive:tints[i],emissiveIntensity:0},options.signals?.[axis][i]).material));
  return {barriers,lampPositions,lamps:bulbs.mesh(scene,{emissive:'#ffce66',emissiveIntensity:.3},options.lampsMaterial),signals,flame};
}
function createVisualStream(scene,solids){
  const size=240,regions=[],byKey=new Map(),landmarks=[];
  const landmarkIds=new Set([1151964136,956035091,956035575,114415568,114415886,441726333,281837896,951638411,457963731,1155828993,438623395]);
  const windowsMaterial=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,emissive:'#dfa84f',emissiveIntensity:0});
  const regionAt=(x,z)=>{
    const X=Math.floor(x/size)*size,Z=Math.floor(z/size)*size,key=X+','+Z;
    if(!byKey.has(key)){const r={x:X,z:Z,bounds:[X,Z,X+size,Z+size],features:[],fuel:[],group:null,lights:[],data:{treeEntries:[],aerialTreeEntries:[],greenEntries:[],benchEntries:[],streetFeatures:[],barrierFeatures:[],fountainFeatures:[],roadFeatures:[]}};regions.push(r);byKey.set(key,r);}
    return byKey.get(key);
  };
  for(let z=box[1];z<=box[3]+size;z+=size)for(let x=box[0];x<=box[2]+size;x+=size)regionAt(x,z);
  const expand=(r,p)=>{const b=extents(p);r.bounds=[Math.min(r.bounds[0],b[0]),Math.min(r.bounds[1],b[1]),Math.max(r.bounds[2],b[2]),Math.max(r.bounds[3],b[3])];};
  const fuelCovered=new Set();
  for(const f of city.building){
    if(f.id===1022233933)continue;
    const [x,z]=center(f.p);if(!inside(x,z,-25))continue;
    const bounds=extents(f.p),size=(bounds[2]-bounds[0])*(bounds[3]-bounds[1]);
    const station=(city.fuel||[]).find(v=>contains(...v.p,f.p)||(f.c==='roof'&&Math.hypot(v.p[0]-x,v.p[1]-z)<44));
    if(station)fuelCovered.add(station);
    if(f.c!=='roof'&&!f.fuel&&!station&&!f.shelter&&!buildingShelterData[f.id]){
      f.passage=f.id===13665889||f.id===950127677||(x>35&&x<77&&z>251&&z<288&&f.p.some(q=>passage(...q)));
      buildings.insert(f,bounds[0]-2,bounds[1]-2,bounds[2]+2,bounds[3]+2);
    }
    const industrial=f.factory||f.hospital||f.school||['industrial','warehouse','retail','commercial'].includes(f.c);
    if(landmarkIds.has(f.id)||churches[f.id]||f.c==='church'||specials[f.id]||buildingDimensions(f,size,industrial,specials[f.id]).total>24)landmarks.push(f);
    else{const r=regionAt(x,z);r.features.push(f);expand(r,f.p);}
  }
  for(const f of city.fuel||[])if(!fuelCovered.has(f))regionAt(...f.p).fuel.push(f);
  // A long fence must load when either end is nearby, not just its owner tile.
  for(const f of [...(city.barrier||[]),...(city.siteFence||[])])expand(regionAt(...center(f.p)),f.p);
  const mappedTreeIndex=new Hash();
  for(const [i,f] of (city.tree||[]).entries()){regionAt(...f.p).data.treeEntries.push([i,f]);const [x,z]=f.p;mappedTreeIndex.insert([x,z],x-3.4,z-3.4,x+3.4,z+3.4);}
  for(const [i,f] of [...aerialVegetation,...medianVegetation].entries())regionAt(...f.p).data.aerialTreeEntries.push([i,f]);
  for(const [i,f] of (city.bench||[]).entries())regionAt(...f.p).data.benchEntries.push([i,f]);
  for(const f of city.streetObject||[])regionAt(...f.p).data.streetFeatures.push(f);
  for(const f of city.fountain||[])regionAt(...f.p).data.fountainFeatures.push(f);
  for(const f of [...(city.barrier||[]),...(city.siteFence||[])])regionAt(...center(f.p)).data.barrierFeatures.push(f);
  const overlaps=(r,b,pad)=>b[0]-pad<r.x+240&&b[2]+pad>=r.x&&b[1]-pad<r.z+240&&b[3]+pad>=r.z;
  for(const [i,f] of (city.green||[]).entries()){const b=extents(f.p);for(const r of regions)if(overlaps(r,b,14))r.data.greenEntries.push([i,f]);}
  for(const f of city.road){const b=extents(f.p);for(const r of regions)if(overlaps(r,b,20))r.data.roadFeatures.push(f);}
  const distance=(r,x,z)=>Math.hypot(Math.max(r.bounds[0]-x,0,x-r.bounds[2]),Math.max(r.bounds[1]-z,0,z-r.bounds[3]));
  let props=null,pending=null,idleX=Infinity,idleZ=Infinity,unloadX=Infinity,unloadZ=Infinity;
  const shared=new Set([windowsMaterial]);
  let streamPhase='idle';
  const build=function*(r){
    streamPhase='buildings '+r.x+','+r.z;
    const group=new T.Group();group.name='visual-region:'+r.x+','+r.z;
    yield* buildBuildings(group,r.features,{solids:r.collisionReady?null:solids,indexed:true,fuel:r.fuel,windowsMaterial,sliceMs:.6});
    const owns=(x,z)=>Math.floor(x/size)*size===r.x&&Math.floor(z/size)*size===r.z;
    streamPhase='props '+r.x+','+r.z;
    const local=yield* buildProps(group,{solids:r.collisionReady?null:solids,mode:'local',sliceMs:.6,owns,...r.data,region:r,mappedTreeIndex,lampsMaterial:props.lamps.material,signals:props.signals});
    r.collisionReady=true;
    r.group=group;r.lights=local.lampPositions;props.lampPositions.push(...r.lights);
    const meshes=[];group.traverse(m=>{if(m.isMesh&&m.userData.staticCityBatch){meshes.push(m);if(scene.userData.registerCityMesh)m.visible=false;}});
    scene.add(group);
    streamPhase='register '+r.x+','+r.z;
    for(const m of meshes){m.userData.streamedVisual=true;scene.userData.registerCityMesh?.(m);yield null;}
  };
  const unload=function*(r){
    const materials=new Set(),textures=new Set(),meshes=[];
    const group=r.group;group.traverse(m=>{if(m.isMesh)meshes.push(m);});
    scene.remove(group);r.group=null;
    for(const m of meshes){scene.userData.unregisterCityMesh?.(m);m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])if(!shared.has(mat)){materials.add(mat);if(mat.map)textures.add(mat.map);}yield null;}
    const removed=new Set(r.lights);for(let i=props.lampPositions.length-1;i>=0;i--)if(removed.has(props.lampPositions[i]))props.lampPositions.splice(i,1);r.lights=[];
    for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();
  };
  let retiring=null;
  return {regions,landmarks,windows:{material:windowsMaterial},
    ready(x,z,radius=1000){return regions.every(r=>r.group||distance(r,x,z)>=radius);},
    attachProps(value){props=value;shared.add(props.lamps.material);for(const row of props.signals)for(const material of row)shared.add(material);},
    *warmSteps(x,z,radius){for(const r of regions)if(distance(r,x,z)<radius)yield* build(r);},
    update(x,z){
      if(!pending&&!retiring&&Math.hypot(x-idleX,z-idleZ)<8)return;
      idleX=idleZ=Infinity;
      // Evict at most one region at a time, sharing the streaming budget.
      if(!retiring&&Math.hypot(x-unloadX,z-unloadZ)>=32){
        const far=regions.find(r=>r.group&&distance(r,x,z)>1450);
        if(far)retiring=unload(far);else{unloadX=x;unloadZ=z;}
      }
      if(retiring){
        const until=performance.now()+.5;
        do{if(retiring.next().done){retiring=null;break;}}while(performance.now()<until);
      }
      if(!pending){const next=regions.filter(r=>!r.group&&distance(r,x,z)<1150).sort((a,b)=>distance(a,x,z)-distance(b,x,z))[0];if(next)pending=build(next);else{idleX=x;idleZ=z;}}
      if(!pending)return;
      const deadline=performance.now()+1;
      while(performance.now()<deadline){
        const before=performance.now(),step=pending.next(),duration=performance.now()-before;
        if(duration>10){const records=scene.userData.streamSlow??=[];records.push({phase:streamPhase,ms:duration});if(records.length>8)records.shift();}
        if(step.done){pending=null;break;}
      }
    }
  };
}

function* worldBuildStages(scene,streamTerrain=false,terrainCache=null){
  const timings={},started=performance.now(),solids=new SolidCollisions();
  const structureStages=new Set(['buildRail','buildStationRetainingWall','buildStationRetainingWall final','buildCycleUnderpass','buildSintAnnaGear','buildRoadRetainingWalls']);
  const timed=(name,fn)=>{
    const t=performance.now(),before=structureStages.has(name)?new Set(scene.children):null;
    const result=fn();
    if(before)for(const child of scene.children)if(!before.has(child))child.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.geometry?.attributes.position)return;
      mesh.updateWorldMatrix(true,false);
      const p=mesh.geometry.attributes.position,index=mesh.geometry.index,n=index?index.count:p.count;
      for(let i=0;i<n;i+=3){const tri=[];for(let k=0;k<3;k++){const v=new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);tri.push([v.x,v.y,v.z]);}solids.addTriangle(...tri);}
    });
    timings[name]=Math.round(performance.now()-t);return result;
  };
  yield 'buildRail';
  timed("buildRail",()=>buildRail(scene));
  timed("buildPlatforms",()=>{stationPlatforms.length=0;stationPlatforms.push(...platformProfiles(railHeight));stationStairCuts=restoreStationUpperAccess(city,stationPlatforms,contains).cuts;const batch=new Batch();batch.solids=solids;paintPlatforms({profiles:stationPlatforms,batch,polygon,cutTriangles:triangle=>{let pieces=[triangle];for(const cut of stationStairCuts)pieces=pieces.flatMap(p=>subtractConvexFootprint(p,cut));return pieces.flatMap(p=>p.slice(2).map((v,i)=>[p[0],p[i+1],v]));}});for(const f of stationPlatforms)platformIndex.insert(f,...f.bounds);batch.mesh(scene);});
  // Remove terrain inside the mapped station walking corridors, including
  // their joined ends; the explicit access floors/stairs close these cuts.
  if(!stationTerrainCutsRegistered)for(const f of city.road.filter(f=>f.stationGround||f.stationUpper&&f.level!=='1')){
    const half=(Number(f.w)||2.5)/2;
    const cuts=[];
    for(let i=1;i<f.p.length;i++){
      const a=f.p[i-1],b=f.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.01)continue;
      const nx=-(b[1]-a[1])/L*half,nz=(b[0]-a[0])/L*half;
      cuts.push([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]);
    }
    if(f.c!=='steps')for(const [x,z] of f.p)cuts.push(Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*half,z+Math.sin(i*Math.PI/8)*half]));
    for(const cutPoly of cuts)parkingTerrainCuts.insert({cutPoly},...extents(cutPoly));
  }
  if(!stationTerrainCutsRegistered)for(const f of stationForecourtPatches(stationGroundAccess))parkingTerrainCuts.insert({cutPoly:f.p},...extents(f.p));
  stationTerrainCutsRegistered=true;
  yield 'buildStationRetainingWall';
  timed("buildStationRetainingWall",()=>buildStationRetainingWall(scene));
  yield 'buildRoads';
  const roadStarted=performance.now();
  yield* buildRoads(scene);
  timings.buildRoads=Math.round(performance.now()-roadStarted);
  yield 'buildStationRetainingWall final';
  timed("buildStationRetainingWall final",()=>buildStationRetainingWall(scene,true));
  timed('buildStationPortals',()=>{
 const stairFloorCuts=city.road.filter(f=>f.stationUpper&&f.c==='steps').flatMap(f=>f.p.slice(1).map((b,j)=>{
  const a=f.p[j],L=Math.hypot(b[0]-a[0],b[1]-a[1]),half=Number(f.w)/2;
  if(L<.01)return null;
  const nx=-(b[1]-a[1])/L*half,nz=(b[0]-a[0])/L*half;
  return {lo:Math.min(f.y[j],f.y[j+1])-.1,hi:Math.max(f.y[j],f.y[j+1])+.1,p:[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]};
 }).filter(Boolean));
 const batch=new Batch();batch.solids=solids;paintStationFrontage({paths:stationGroundAccess,batch,platforms:stationPlatforms});paintStationPortals({paths:stationGroundAccess,batch,addBox,platforms:stationPlatforms});paintStationTunnelShells({paths:stationGroundAccess,batch,addBox,stairs:city.road.filter(f=>f.stationUpper),platforms:stationPlatforms});paintStationStairwells({paths:city.road,batch});paintStationAccessFloors({paths:city.road,batch,cutTriangles:triangle=>{
 let pieces=[triangle];
 const lo=Math.min(...triangle.map(p=>p[1])),hi=Math.max(...triangle.map(p=>p[1]));
 for(const cut of stairFloorCuts){
  if(lo>cut.hi||hi<cut.lo)continue;
  pieces=pieces.flatMap(p=>subtractConvexFootprint(p,cut.p));
 }
 return pieces.flatMap(p=>p.slice(2).map((v,i)=>[p[0],p[i+1],v]));
 }});batch.mesh(scene);});
  yield 'buildCycleUnderpass';
  timed("buildCycleUnderpass",()=>buildCycleUnderpass(scene));
  yield 'buildSintAnnaGear';
  timed("buildSintAnnaGear",()=>buildSintAnnaGear(scene));
  yield 'buildRoadRetainingWalls';
  timed("buildRoadRetainingWalls",()=>buildRoadRetainingWalls(scene));
  yield 'buildMedians';
  timed("buildMedians",()=>buildMedians(scene));
  timed("buildTrafficIslands",()=>buildTrafficIslands(scene,solids));
  yield 'water';
  const water=timed("water",()=>buildWater(scene));
  water.receiveShadow=false;
  yield 'buildTerrain';
  let terrainStream=null;
  if(streamTerrain){
    const terrainStarted=performance.now();
    buildDistantTerrain(scene);terrainStream=createTerrainChunks(scene,terrainCache,true);
    yield* terrainStream.warmSteps(-239,3,1000);
    timings.buildTerrain=Math.round(performance.now()-terrainStarted);
  }else timed("buildTerrain",()=>buildTerrain(scene));
  yield 'buildRetainingShoulders';
  timed("buildRetainingShoulders",()=>buildRetainingShoulders(scene));
  yield 'buildGreens';
  timed("buildGreens",()=>buildGreens(scene,solids));
  yield 'buildParking';
  timed("buildParking",()=>buildParking(scene,solids));
  yield 'buildings';
  const buildingStarted=performance.now();
  let visualStream=null,windows;
  if(streamTerrain){
    visualStream=createVisualStream(scene,solids);
    windows=visualStream.windows;
    const before=new Set(scene.children);
    yield* buildBuildings(scene,visualStream.landmarks,{solids,indexed:true,fuel:[],windowsMaterial:windows.material});
    for(const mesh of scene.children)if(!before.has(mesh))mesh.userData.landmarkVisual=true;
  }else windows=yield* buildBuildings(scene,city.building,{solids});
  timings.buildings=Math.round(performance.now()-buildingStarted);
  yield 'storefronts';
  const storefronts=timed("storefronts",()=>paintEntrancesAndShops(scene,solids));
  paintBarriers(null,()=>true,null,solids);
  paintStreetObjects(null,null,null,null,()=>true,city.streetObject||[],solids);
  yield 'props';
  const propsStarted=performance.now();
  const props=yield* buildProps(scene,visualStream?{mode:'global',solids}:{solids});
  const {lamps,signals,flame,lampPositions,barriers}=props;
  if(visualStream){visualStream.attachProps(props);yield* visualStream.warmSteps(-239,3,1000);}
  timings.props=Math.round(performance.now()-propsStarted);
  scene.userData.buildTimings={...timings,total:Math.round(performance.now()-started)};
  return {water,windows,storefronts,lamps,signals,flame,lampPositions,barriers,terrainStream,visualStream,solids};
}
export function makeWorld(scene){
  const stages=worldBuildStages(scene);let step;
  do{step=stages.next();}while(!step.done);
  return step.value;
}
export async function makeWorldAsync(scene,onProgress=()=>{}){
  onProgress('Kaart voorbereiden',0);
  const terrainCache=await openTerrainCache(box);
  const stages=worldBuildStages(scene,true,terrainCache);let completed=0;
  // Message tasks yield to input/paint without nested setTimeout's timer clamp.
  // Keep the timer fallback for headless geometry tests and older browsers.
  const channel=typeof window!=='undefined'&&typeof MessageChannel!=='undefined'?new MessageChannel():null;
  let resume=null;
  if(channel)channel.port1.onmessage=()=>{const next=resume;resume=null;next?.();};
  const pause=()=>channel?new Promise(resolve=>{resume=resolve;channel.port2.postMessage(0);}):new Promise(resolve=>setTimeout(resolve,0));
  try{
    await pause();
    while(true){
      // Fine-grained runtime yields share a startup slice; do not pay a browser
      // task/paint round trip for every buffer attribute during initial loading.
      const deadline=performance.now()+6;
      do{
        const step=stages.next();if(step.done){onProgress('Klaar',1);return step.value;}
        if(typeof step.value==='string'){onProgress(step.value,Math.min(.99,completed++/16));break;}
      }while(performance.now()<deadline);
      await pause();
    }
  }finally{channel?.port1.close();channel?.port2.close();}

}

export const landmarks=[
  {name:'Het Belfort',x:-268,z:-10,info:'The belfry and aldermen’s house watch over Grote Markt. The clock earned it a local nickname, “ten tettentoeren”.'},
  {name:'Borse van Amsterdam',x:-306,z:-6,info:'This historic building has housed cafés and restaurants on Grote Markt since 1820.'},
  {name:'Sint-Martinuskerk',x:-126,z:78,info:'The Brabantine Gothic church never received its planned monumental west tower.'},
  {name:'Station Aalst',x:-244,z:-454,info:'Cluysenaer’s 1852 station is often likened to a castle.'},
  {name:'Sint-Annabrug',x:36,z:-292,info:'Cross the Dender here between the historic centre and the east bank.'},
  {name:'Stadspark',x:307,z:840,info:'Aalst’s city park opened to the public in 1916.'}
].filter(p=>inside(p.x,p.z));
