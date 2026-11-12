import tags from './parking-tags.js';
const random=(id)=>{const n=Math.sin(id*127.1+71.4)*43758.5453;return n-Math.floor(n);};
const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const projection=(p,s)=>{const t=Math.max(0,Math.min(1,((p[0]-s.a[0])*s.dx+(p[1]-s.a[1])*s.dz)/(s.len*s.len)));return {d:Math.hypot(p[0]-s.a[0]-s.dx*t,p[1]-s.a[1]-s.dz*t),t};};
export function parkingLayout(city,roadWidth=()=>6){
 const cells=new Map(),segments=[],bays=[],aisles=[],occupied=new Map(),stats={lots:0,driveways:0};
 const cell=(x,z)=>Math.floor(x/32)+','+Math.floor(z/32);
 for(const f of city.road)for(let i=1;i<f.p.length;i++){
  const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;
  const s={a,b,dx,dz,len,f,w:roadWidth(f)};segments.push(s);
  for(let x=Math.floor((Math.min(a[0],b[0])-12)/32);x<=Math.floor((Math.max(a[0],b[0])+12)/32);x++)for(let z=Math.floor((Math.min(a[1],b[1])-12)/32);z<=Math.floor((Math.max(a[1],b[1])+12)/32);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(s);}
 }
 const nearby=p=>cells.get(cell(...p))||[];
 const obstructions=new Map();
 for(const f of [...(city.building||[]),...(city.water||[])]){
  const ring=f.p;if(!ring?.length||!Array.isArray(ring[0]))continue;
  const xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)/32);x<=Math.floor(Math.max(...xs)/32);x++)for(let z=Math.floor(Math.min(...zs)/32);z<=Math.floor(Math.max(...zs)/32);z++){const k=x+','+z;if(!obstructions.has(k))obstructions.set(k,[]);obstructions.get(k).push(ring);}
 }

 const barrierCells=new Map();
 for(const f of [...(city.barrier||[]),...(city.siteFence||[])])for(let i=1;i<(f.p?.length||0);i++){
  const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;
  const s={a,b,dx,dz,len};for(let x=Math.floor((Math.min(a[0],b[0])-4)/32);x<=Math.floor((Math.max(a[0],b[0])+4)/32);x++)for(let z=Math.floor((Math.min(a[1],b[1])-4)/32);z<=Math.floor((Math.max(a[1],b[1])+4)/32);z++){const k=x+','+z;if(!barrierCells.has(k))barrierCells.set(k,[]);barrierCells.get(k).push(s);}
 }
 const treeCells=new Map();for(const tree of city.tree||[]){const k=cell(...tree.p);if(!treeCells.has(k))treeCells.set(k,[]);treeCells.get(k).push(tree.p);}
 const hazards=[...(city.crossing||[]).map(f=>({p:f.p,r:6})),...(city.streetObject||[]).filter(f=>['bus_stop','gate','lift_gate','cycle_barrier'].includes(f.c)).map(f=>({p:f.p,r:f.c==='bus_stop'?12:4}))];
 const hazardCells=new Map();for(const h of hazards)for(let x=Math.floor((h.p[0]-h.r)/32);x<=Math.floor((h.p[0]+h.r)/32);x++)for(let z=Math.floor((h.p[1]-h.r)/32);z<=Math.floor((h.p[1]+h.r)/32);z++){const k=x+','+z;if(!hazardCells.has(k))hazardCells.set(k,[]);hazardCells.get(k).push(h);}
 function add(x,z,yaw,width,length,id,kind,ring=null,ownRoad=null){
  const ux=Math.sin(yaw),uz=Math.cos(yaw),vx=uz,vz=-ux;
  const corners=[[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b])=>[x+ux*a*length/2+vx*b*width/2,z+uz*a*length/2+vz*b*width/2]);
  for(const p of [[x,z],...corners])for(let X=Math.floor((p[0]-1)/32);X<=Math.floor((p[0]+1)/32);X++)for(let Z=Math.floor((p[1]-1)/32);Z<=Math.floor((p[1]+1)/32);Z++)for(const t of treeCells.get(X+','+Z)||[]){const dx=t[0]-x,dz=t[1]-z;if(Math.abs(dx*ux+dz*uz)<length/2+.55&&Math.abs(dx*vx+dz*vz)<width/2+.55)return;}
  if(ring&&corners.some(p=>!inside(p,ring)))return;
  if((hazardCells.get(cell(x,z))||[]).some(h=>Math.hypot(h.p[0]-x,h.p[1]-z)<h.r))return;
  for(const p of [[x,z],...corners,...corners.map((p,i)=>[(p[0]+corners[(i+1)%4][0])/2,(p[1]+corners[(i+1)%4][1])/2])]){
   if((obstructions.get(cell(...p))||[]).some(r=>inside(p,r)))return;
   if((barrierCells.get(cell(...p))||[]).some(s=>projection(p,s).d<.6))return;
   if(nearby(p).some(s=>s.f!==ownRoad&&projection(p,s).d<s.w/2+.3))return;
  }
  for(let X=Math.floor((x-7)/8);X<=Math.floor((x+7)/8);X++)for(let Z=Math.floor((z-7)/8);Z<=Math.floor((z+7)/8);Z++)for(const b of occupied.get(X+','+Z)||[]){
   const dx=b.x-x,dz=b.z-z;if(Math.abs(dx*ux+dz*uz)<(length+b.length)/2+.15&&Math.abs(dx*vx+dz*vz)<(width+b.width)/2+.15)return;
  }
  const bay={x,z,yaw,width,length,corners,id,kind,filled:random(id)<(kind==='driveway'?.5:.7)};bays.push(bay);const k=Math.floor(x/8)+','+Math.floor(z/8);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(bay);
 }
 const rank={primary:5,secondary:4,tertiary:3,residential:2,unclassified:2,service:1};
 // Explicit individual bays take priority over generated parent-lot grids.
 for(const f of [...city.parking].sort((a,b)=>(b.c==='parking_space')-(a.c==='parking_space'))){
  const metadata=tags[f.id]||{};if(['underground','multi-storey','rooftop'].includes(metadata.parking))continue;
  const ring=f.p;if(ring.length<3)continue;
  const centre=ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);
  let road=null,score=-Infinity;
  for(const s of segments){if(!rank[s.f.c])continue;const d=projection(centre,s).d;if(d>100)continue;const v=rank[s.f.c]*7-d;if(v>score){score=v;road=s;}}
  let longest=0,axis=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>longest){longest=l;axis=Math.atan2(b[0]-a[0],b[1]-a[1]);}}
  if(f.c==='parking_space'){add(...centre,axis,2.15,4.6,f.id,'mapped',ring);continue;}
  if(metadata.parking==='street_side'){
   // Follow the mapped strip itself: small bearing differences from a road
   // centreline otherwise accumulate over long, narrow quayside polygons.
   const ux=Math.sin(axis),uz=Math.cos(axis),vx=uz,vz=-ux;
   const local=ring.map(p=>[(p[0]-centre[0])*ux+(p[1]-centre[1])*uz,(p[0]-centre[0])*vx+(p[1]-centre[1])*vz]);
   const lo=Math.min(...local.map(p=>p[0])),hi=Math.max(...local.map(p=>p[0]));
   const parallel=metadata.orientation==='parallel',span=parallel?5.7:2.35,spacing=parallel?6:2.55;
   const section=u=>{const hits=[];for(let i=0,j=local.length-1;i<local.length;j=i++){
    const a=local[j],b=local[i];if((a[0]<=u&&b[0]>u)||(b[0]<=u&&a[0]>u))hits.push(a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]));
   }hits.sort((a,b)=>a-b);return hits;};
   const adjoining=segments.filter(s=>rank[s.f.c]).sort((a,b)=>projection(centre,a).d-projection(centre,b).d)[0];
   let slot=0;
   for(let u=lo+span/2+.12;u<hi-span/2-.12;u+=spacing){
    const sections=[section(u-span/2),section(u),section(u+span/2)];
    if(sections.some(v=>v.length!==2))continue;
    const low=Math.max(...sections.map(v=>v[0])),high=Math.min(...sections.map(v=>v[1]));
    const depth=Math.min(parallel?2.15:4.9,high-low-.12);if(depth<(parallel?1.8:4.4))continue;
    const v=(low+high)/2,x=centre[0]+u*ux+v*vx,z=centre[1]+u*uz+v*vz;
    // The mapped parking polygon outranks an estimated road-width buffer.
    // Keep the centre travel corridor free even when the default width is too wide.
    if(adjoining&&projection([x,z],adjoining).d-depth/2<1.65)continue;
    let facing=axis+(parallel?0:Math.PI/2);
    if(parallel&&adjoining){
     const roadBearing=Math.atan2(adjoining.dx,adjoining.dz);
     const side=(x-adjoining.a[0])*adjoining.dz-(z-adjoining.a[1])*adjoining.dx;
     const travel=roadBearing+(adjoining.f.one===-1||(!adjoining.f.one&&side>0)?Math.PI:0);
     if(Math.cos(facing-travel)<0)facing+=Math.PI;
    }
    add(x,z,facing,parallel?depth:span,parallel?span:depth,f.id*1000+slot++,'lot',ring,adjoining?.f);
   }
   stats.lots++;continue;
  }
  const internal=segments.filter(s=>s.f.c==='service'&&inside([(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2],ring));
  // Extend mapped circulation into unused space with connected cross aisles.
  // Reserve their full width before placing bays, so cars cannot block them.
  if(internal.length){let slot=0;
   const bayStart=bays.length,aisleStart=aisles.length;
   const placeAlong=lanes=>{for(const lane of lanes){
    const yaw=Math.atan2(lane.dx,lane.dz),nx=lane.dz/lane.len,nz=-lane.dx/lane.len;
    for(let d=1.4;d<lane.len-1.3;d+=2.65)for(const side of [-1,1]){
     const offset=lane.w/2+2.8,x=lane.a[0]+lane.dx*d/lane.len+nx*side*offset,z=lane.a[1]+lane.dz*d/lane.len+nz*side*offset;
     add(x,z,yaw+side*Math.PI/2,2.4,4.9,f.id*1000+slot++,'lot',ring);
    }
   }};
   const removeBays=()=>{for(const b of bays.splice(bayStart)){const k=Math.floor(b.x/8)+','+Math.floor(b.z/8);occupied.set(k,occupied.get(k).filter(o=>o!==b));}};
   placeAlong(internal);const baseline=bays.slice(bayStart);removeBays();slot=0;
   const inferred=[];
   for(const source of internal){
    for(let d=Math.min(8,source.len/2);d<source.len;d+=16.2){
     const origin=[source.a[0]+source.dx*d/source.len,source.a[1]+source.dz*d/source.len];
     if(inferred.some(l=>projection(origin,l).d<12))continue;
     for(const side of [-1,1]){
      const dx=source.dz/source.len*side,dz=-source.dx/source.len*side;
      let length=0;
      for(let t=1;t<200;t+=1){
       const probes=[-3,0,3].map(w=>[origin[0]+dx*t-dz*w,origin[1]+dz*t+dx*w]);
       if(probes.some(p=>!inside(p,ring)||(obstructions.get(cell(...p))||[]).some(r=>inside(p,r))||(barrierCells.get(cell(...p))||[]).some(l=>projection(p,l).d<.6)||nearby(p).some(l=>rank[l.f.c]>1&&projection(p,l).d<l.w/2+.3)))break;
       length=t;
      }
      if(length<14)continue;
      const b=[origin[0]+dx*length,origin[1]+dz*length];
      const lane={a:origin,b,dx:dx*length,dz:dz*length,len:length,w:5.8,f:{c:'service'}};
      inferred.push(lane);aisles.push({p:[origin,b],width:5.8,ring});
     }
    }
   }
   for(const lane of inferred){
    for(let x=Math.floor((Math.min(lane.a[0],lane.b[0])-7)/32);x<=Math.floor((Math.max(lane.a[0],lane.b[0])+7)/32);x++)for(let z=Math.floor((Math.min(lane.a[1],lane.b[1])-7)/32);z<=Math.floor((Math.max(lane.a[1],lane.b[1])+7)/32);z++){
     const k=x+','+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(lane);
    }
   }
   placeAlong([...internal,...inferred]);
   // Keep the existing layout when added circulation costs more spaces than it gains.
   if(bays.length-bayStart<baseline.length){
    removeBays();aisles.splice(aisleStart);
    const rejected=new Set(inferred);for(const [key,list] of cells)if(list.some(l=>rejected.has(l)))cells.set(key,list.filter(l=>!rejected.has(l)));
    for(const b of baseline){bays.push(b);const k=Math.floor(b.x/8)+','+Math.floor(b.z/8);if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(b);}
   }
   stats.lots++;continue;
  }
  const yaw=road?Math.atan2(road.dx,road.dz):axis,ux=Math.sin(yaw),uz=Math.cos(yaw),vx=uz,vz=-ux;
  const local=ring.map(p=>[(p[0]-centre[0])*ux+(p[1]-centre[1])*uz,(p[0]-centre[0])*vx+(p[1]-centre[1])*vz]);
  const lo=[Math.min(...local.map(p=>p[0])),Math.min(...local.map(p=>p[1]))],hi=[Math.max(...local.map(p=>p[0])),Math.max(...local.map(p=>p[1]))];
  const pierre=/pierre.*cornelis/i.test(road?.f.n||''),parallel=!pierre&&(metadata.orientation==='parallel'||(hi[1]-lo[1]<5&&hi[0]-lo[0]>8));
  const spacing=parallel?6:2.65,rowDepth=parallel?2.35:5.1,rowStep=parallel?3:16.2;let slot=0;
  const rows=[];for(let v=lo[1]+rowDepth/2+.25;v<=hi[1]-rowDepth/2-.25;v+=rowStep){rows.push(v);if(!parallel&&v+11.1<=hi[1]-rowDepth/2-.25)rows.push(v+11.1);}
  const spine=lo[0]+3.1,gridStart=parallel?lo[0]:lo[0]+6.2;
  const world=(u,v)=>[centre[0]+u*ux+v*vx,centre[1]+u*uz+v*vz];
  if(!parallel&&rows.length){
   const spineStart=world(spine,lo[1]+.4),spineEnd=world(spine,hi[1]-.4);
   if(inside(spineStart,ring)&&inside(spineEnd,ring))aisles.push({p:[spineStart,spineEnd],width:5.8,ring});
   for(let i=0;i<rows.length;i+=2){const v=rows[i]+5.55,a=world(spine,v),b=world(hi[0]-.4,v);if(inside(a,ring)&&inside(b,ring))aisles.push({p:[a,b],width:5.8,ring});}
  }
  for(const v of rows)for(let u=gridStart+spacing/2+.25;u<hi[0]-spacing/2;u+=spacing){
   const x=centre[0]+u*ux+v*vx,z=centre[1]+u*uz+v*vz;
   const side=road?((x-road.a[0])*road.dz-(z-road.a[1])*road.dx):1;
   const facing=parallel?(road?.f.one===-1?Math.PI:road?.f.one===1?0:side<0?0:Math.PI):Math.PI/2;
   add(x,z,yaw+facing,parallel?2.15:2.4,parallel?5.7:4.9,f.id*1000+slot++,'lot',ring);
  }stats.lots++;
 }
 // Reference-confirmed parking between the carriageway and bicycle lane.
 for(const f of city.road)if(f.shoulderParking){
  const lanes=segments.filter(s=>s.f===f);let distanceAlong=0,next=8,slot=0;
  const total=lanes.reduce((sum,s)=>sum+s.len,0);
  for(const lane of lanes){
   while(next<distanceAlong+lane.len&&next<total-8){
    const t=(next-distanceAlong)/lane.len,off=lane.w/2+f.shoulderParking/2;
    const x=lane.a[0]+lane.dx*t-lane.dz/lane.len*off,z=lane.a[1]+lane.dz*t+lane.dx/lane.len*off;
    const before=bays.length;
    add(x,z,Math.atan2(lane.dx,lane.dz)+(f.one===-1?Math.PI:0),1.95,5.7,f.id*1000+slot++,'shoulder',null,f);
    if(bays.length>before&&f.y){const i=f.p.indexOf(lane.a);if(Number.isFinite(f.y[i])&&Number.isFinite(f.y[i+1]))bays.at(-1).elevation=f.y[i]+(f.y[i+1]-f.y[i])*t+.075;}
    next+=6.1;
   }
   distanceAlong+=lane.len;
  }
 }
 // Keep a parked car in the deeper part of a mapped driveway, not its mouth.
 for(const f of city.road)if(tags[f.id]?.service==='driveway'){
  const ss=segments.filter(s=>s.f===f),length=ss.reduce((n,s)=>n+s.len,0);if(length<12)continue;
  let at=length*.65;
  for(const s of ss){if(at>s.len){at-=s.len;continue;}const t=at/s.len;add(s.a[0]+s.dx*t,s.a[1]+s.dz*t,Math.atan2(s.dx,s.dz),2.1,4.8,f.id,'driveway',null,f);stats.driveways++;break;}
 }
 return {bays,aisles,stats};
}
