import access from './station-access-data.js';
// Preserve OSM plan geometry. Ground-level concourses must not inherit the
// elevated railway/platform returns in the surface height raster.
export function restoreStationGroundAccess(city,height){
 const anchorIds=[206846964,844221451],anchors=anchorIds.map(id=>{
  const f=access.find(f=>f.id===id),old=city.road.find(f=>f.id===id);
  return {p:f.p[0],y:old?.y?.[0]??height(...f.p[0])+.135};
 });
 const A=anchors[0],B=anchors[1],dx=B.p[0]-A.p[0],dz=B.p[1]-A.p[1],len2=dx*dx+dz*dz;
 const floor=p=>{const t=Math.max(0,Math.min(1,((p[0]-A.p[0])*dx+(p[1]-A.p[1])*dz)/len2));return A.y+(B.y-A.y)*t;};
 const restored=[];
 for(const source of access){
  if(source.tags.level!=='0'||source.tags.highway!=='footway')continue;
  let f=city.road.find(f=>f.id===source.id);
  if(!f){f={id:source.id,c:'footway',n:'',b:false,l:0,s:source.tags.surface||'paving_stones',w:source.tags.width||'2.5',one:0};city.road.push(f);}
  f.p=source.p.map(p=>p.slice());f.y=f.p.map(floor);f.stationGround=true;
  f.level='0';f.osmNodes=source.nodes.slice();f.t=!!source.tags.tunnel;f.u=!!source.tags.tunnel;f.b=false;f.l=f.t?-1:0;
  if(source.id===844221451)f.w='5';
  if(source.id===206846965||source.id===1198396111)f.w='5'; // User confirms equal-width entrances.
  restored.push(f);
 }
 return restored;
}

// Large tan/brown cladding panels with narrow joints and red-brown bands,
// following the user's station frontage photograph (not brickwork).
function stationPanelFace(batch,poly,at){
 const clip=(p,axis,bound,keep)=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],A=keep*(a[axis]-bound)>=0,B=keep*(b[axis]-bound)>=0;if(A)out.push(a);if(A!==B){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
 const min=Math.min(...poly.map(p=>p[0])),max=Math.max(...poly.map(p=>p[0])),top=Math.max(...poly.map(p=>p[1]));
 let y=0,row=0;
 while(y<top){const band=row%4===2,h=band?.26:.72;
  for(let c=Math.floor(min/.74);c<Math.ceil(max/.74);c++){
   let p=poly;for(const [axis,bound,keep] of [[0,c*.74+.009,1],[0,(c+1)*.74-.009,-1],[1,y+.009,1],[1,y+h-.009,-1]])p=clip(p,axis,bound,keep);
   const colors=band?['#8d6758','#976e5d','#876052']:['#b5a28b','#aa9984','#bbaa92','#a99780'];
   for(let j=2;j<p.length;j++)batch.tri(at(...p[0]),at(...p[j-1]),at(...p[j]),colors[((c+row*3)%4+4)%4%colors.length]);
  }y+=h;row++;
 }
}
export function stationForecourtPatches(paths){
 const entries=[1198396111,844221451].map(id=>paths.find(f=>f.id===id));
 const patches=entries.map(f=>{const a=f.p[0],b=f.p[1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,w=Number(f.w)/2+1.8;
 const at=(u,v)=>[a[0]-uz*u+ux*v,a[1]+ux*u+uz*v];return {p:[at(-w,-8),at(w,-8),at(w,3),at(-w,3)],y:[f.y[0],f.y[0],f.y[0],f.y[0]]};});
 const a=patches[0],b=patches[1];patches.push({p:[a.p[1],b.p[0],b.p[3],a.p[2]],y:[a.y[1],b.y[0],b.y[3],a.y[2]],wall:true});
 // One paved forecourt, extending around the historic pavilions to the
 // street-side approach. The rear edge remains at the retaining wall.
 const A=entries[0].p[0],B=entries[1].p[0],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;
 const at=(u,v)=>[A[0]+ux*u-uz*v,A[1]+uz*u+ux*v],floor=u=>entries[0].y[0]+(entries[1].y[0]-entries[0].y[0])*Math.max(0,Math.min(1,u/L));
 patches.push({p:[at(-12,25),at(L+8,25),at(L+8,-12),at(-12,-12)],y:[floor(-12),floor(L+8),floor(L+8),floor(-12)],forecourt:true});
 return patches;
}
export function paintStationFrontage({paths,batch,platforms=[]}){
 for(const f of stationForecourtPatches(paths)){
  if(!f.wall&&!f.forecourt)continue;
  const p=f.p.map((p,i)=>[p[0],f.y[i]+.055,p[1]]);
  if(f.forecourt){batch.quad(...p,'#969b96');const down=p=>[p[0],p[1]-.45,p[2]];for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4];batch.quad(a,down(a),down(b),b,'#969b96');}batch.quad(...p.map(down).reverse(),'#969b96');continue;}
  const A=p[3],B=p[2],L=Math.hypot(B[0]-A[0],B[2]-A[2]),ux=(B[0]-A[0])/L,uz=(B[2]-A[2])/L;
  const at=(u,h,depth=0)=>[A[0]+ux*u-uz*depth,A[1]+(B[1]-A[1])*u/L+h,A[2]+uz*u+ux*depth];
  const top=frontageTop(platforms,[A[0],A[2]],A[1]);
  const P=at(0,0),Q=at(L,0),R=at(L,top),S=at(0,top),rear=p=>[p[0]+uz*.4,p[1],p[2]-ux*.4];
  for(const q of [[P,Q,R,S],[rear(Q),rear(P),rear(S),rear(R)],[P,rear(P),rear(Q),Q],[S,R,rear(R),rear(S)],[P,S,rear(S),rear(P)],[Q,rear(Q),rear(R),R]])batch.quad(...q,'#82796c');
  stationPanelFace(batch,[[0,0],[L,0],[L,top],[0,top]],(u,h)=>at(u,h,.006));
 }
}

function frontageTop(platforms,p,y){
 let nearest=null,d=Infinity;for(const f of platforms)for(const q of f.p){const n=Math.hypot(q[0]-p[0],q[1]-p[1]);if(n<d){d=n;nearest=f;}}
 return nearest?Math.max(3.5,nearest.y(...p)-y):4.2;
}

// Entrance portal: a shallow segmental arch, closed across its thickness.
// The centreline comes from OSM; dimensions above ground are reference estimates.
export function paintStationPortals({paths,batch,addBox,platforms=[]}){
 for(const [id,index,width] of [[1198396111,0,5],[844221451,0,5]]){
  const f=paths.find(f=>f.id===id);if(!f||f.p.length<=index+1)continue;
  const a=f.p[index],b=f.p[index+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,nx=-uz,nz=ux,y=f.y[index];
  const at=(u,v,h)=>[a[0]+nx*u+ux*(v+3),y+h,a[1]+nz*u+uz*(v+3)];
  const half=width/2,spring=2.55,rise=.6,top=frontageTop(platforms,a,y),outer=half+1.8,depth=.6;
  const slab=(u0,u1,h0,h1)=>{
   const A=at(u0,0,h0),B=at(u1,0,h0),C=at(u1,0,h1),D=at(u0,0,h1),E=at(u0,depth,h0),F=at(u1,depth,h0),G=at(u1,depth,h1),H=at(u0,depth,h1);
   for(const q of [[A,B,C,D],[F,E,H,G],[E,A,D,H],[B,F,G,C],[D,C,G,H],[E,F,B,A]])batch.quad(...q,'#b5b5ad');
  };
  // Solid paved threshold joins the portal floor to its exterior approach.
  // It also closes the exposed terrain-cut edges beside the landing.
  slab(-outer,-half,0,top);slab(half,outer,0,top);
  if(id===1198396111)for(const [a,b] of [[-outer,-half],[half,outer]])stationPanelFace(batch,[[a,0],[b,0],[b,top],[a,top]],(u,h)=>at(u,-.006,h));
  for(let i=0;i<24;i++){
   const t=Math.PI-i*Math.PI/24,T=Math.PI-(i+1)*Math.PI/24,u=half*Math.cos(t),U=half*Math.cos(T),h=spring+rise*Math.sin(t),H=spring+rise*Math.sin(T);
   batch.quad(at(u,0,h),at(U,0,H),at(U,0,top),at(u,0,top),'#b5b5ad');
   if(id===1198396111)stationPanelFace(batch,[[u,h],[U,H],[U,top],[u,top]],(u,h)=>at(u,-.006,h));
   batch.quad(at(U,depth,H),at(u,depth,h),at(u,depth,top),at(U,depth,top),'#969c97');
   batch.quad(at(u,depth,h),at(U,depth,H),at(U,0,H),at(u,0,h),'#90968f');
   batch.quad(at(u,0,top),at(U,0,top),at(U,depth,top),at(u,depth,top),'#969c97');
  }
 }
}

// Shells follow the mapped underground corridors, including stair branches.
// Their widths without OSM width tags and vertical clearances remain provisional.
export function paintStationTunnelShells({paths,batch,addBox,stairs=[],platforms=[]}){
 const outside=new Set([206846964,972505843]);
 const corridors=paths.filter(f=>!outside.has(f.id));
 const segments=[];
 for(const f of [...corridors,...stairs.filter(f=>f.c==='steps'||f.level==='0.5')])for(let i=1;i<f.p.length;i++){
  let a=f.p[i-1];const b=f.p[i];
  if(i===1&&[1198396111,844221451].includes(f.id)){const l=Math.hypot(b[0]-a[0],b[1]-a[1]);a=[a[0]+(b[0]-a[0])*3/l,a[1]+(b[1]-a[1])*3/l];}
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.01)continue;
  segments.push({f,a,b,first:i===1,L,ux:dx/L,uz:dz/L,half:(Number(f.w)||2.5)/2,ya:f.y[i-1],yb:f.y[i]});
 }
 // Clip a wall-side segment against adjoining walking corridors. This retains
 // real openings at the OSM junctions instead of guessing a fixed opening size.
 function occluded(a,b,s,pad=.01){
  const local=p=>[(p[0]-s.a[0])*s.ux+(p[1]-s.a[1])*s.uz,-(p[0]-s.a[0])*s.uz+(p[1]-s.a[1])*s.ux];
  const A=local(a),B=local(b);let lo=0,hi=1;
  for(const [axis,min,max] of [[0,-pad,s.L+pad],[1,-s.half-pad,s.half+pad]]){
   const d=B[axis]-A[axis];if(Math.abs(d)<1e-9){if(A[axis]<min||A[axis]>max)return null;continue;}
   let l=(min-A[axis])/d,h=(max-A[axis])/d;if(l>h)[l,h]=[h,l];lo=Math.max(lo,l);hi=Math.min(hi,h);if(lo>=hi)return null;
  }
  return [lo,hi];
 }
 for(const s of segments){
  const {a,b,ux,uz,half,ya,yb,L}=s,nx=-uz,nz=ux,upper=s.f.stationUpper;
  const at=(t,v,h)=>[a[0]+ux*L*t+nx*v,ya+(yb-ya)*t+h,a[1]+uz*L*t+nz*v];
  if(!upper){
   const A=at(0,-half-.25,3.2),B=at(1,-half-.25,3.2),C=at(1,half+.25,3.2),D=at(0,half+.25,3.2),up=p=>[p[0],p[1]+.25,p[2]];
   for(const q of [[A,B,C,D],[up(D),up(C),up(B),up(A)],[A,up(A),up(B),B],[B,up(B),up(C),C],[C,up(C),up(D),D],[D,up(D),up(A),A]])batch.quad(...q,'#a4aaa5');
  }
  const corners=[at(0,-half,0),at(1,-half,0),at(1,half,0),at(0,half,0)];
  for(let edge=0;edge<4;edge++){
   const A=corners[edge],B=corners[(edge+1)%4],start=[A[0],A[2]],end=[B[0],B[2]];
   // Keep external entrances and the platform exit open.
   if(edge===1||edge===3){
    const t=edge===1?1:0,p=t?b:a,y=t?yb:ya;
    if(!upper&&[1198396111,844221451,206846965].includes(s.f.id)&&
      ((s.first&&edge===3)||p===s.f.p[0]||p===s.f.p.at(-1)))continue;
    if(upper&&Math.abs(y-Math.max(...s.f.y))<.01&&s.f.level.split(/[;:]/).includes('1'))continue;
   }
   let pieces=[[0,1]];
   for(const other of segments){
    if(other===s||Math.min(other.ya,other.yb)>Math.max(ya,yb)+.2||Math.max(other.ya,other.yb)<Math.min(ya,yb)-.2)continue;
    const cut=occluded(start,end,other,edge%2?.3:.01);if(!cut)continue;
    pieces=pieces.flatMap(([l,h])=>cut[1]<=l||cut[0]>=h?[[l,h]]:[[l,Math.min(h,cut[0])],[Math.max(l,cut[1]),h]].filter(([x,y])=>y-x>.001));
   }
   const dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz),ox=dz/len*.18,oz=-dx/len*.18;
   const top=(x,z,floor)=>upper?Math.max(floor+.05,...platforms.map(p=>({p,d:Math.hypot(p.cx-x,p.cz-z)})).sort((a,b)=>a.d-b.d).slice(0,1).map(v=>v.p.y(x,z))):floor+3.2;
   for(const [l,h] of pieces){
    const point=t=>[A[0]+dx*t,A[1]+(B[1]-A[1])*t-.12,A[2]+dz*t];
    const P=point(l),Q=point(h),R=[Q[0],top(Q[0],Q[2],Q[1]+.12),Q[2]],S=[P[0],top(P[0],P[2],P[1]+.12),P[2]],out=p=>[p[0]+ox,p[1],p[2]+oz];
    for(const q of [[P,Q,R,S],[out(Q),out(P),out(S),out(R)],[P,out(P),out(Q),Q],[S,R,out(R),out(S)],[P,S,out(S),out(P)],[Q,out(Q),out(R),R]])batch.quad(...q,'#afb4ad');
   }
  }
 }

 // A simple outer retaining shell around each connected stair/landing group
 // closes the corners behind the inner walls. The mapped walking routes stay
 // untouched, with openings where they enter the enclosure.
 const pending=new Set(segments.filter(s=>s.f.stationUpper));
 while(pending.size){
  const group=[pending.values().next().value];pending.delete(group[0]);
  for(let i=0;i<group.length;i++)for(const candidate of pending){
   if([group[i].a,group[i].b].some(p=>[candidate.a,candidate.b].some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.02))){group.push(candidate);pending.delete(candidate);}
  }
  const points=group.flatMap(s=>{const n=[-s.uz,s.ux],w=s.half+.3;return [s.a,s.b].flatMap(p=>[-1,1].map(k=>[p[0]+n[0]*w*k,p[1]+n[1]*w*k]));}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const halfHull=ps=>{const h=[];for(const p of ps){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h;};
  const lower=halfHull(points),upper=halfHull([...points].reverse());lower.pop();upper.pop();const hull=[...lower,...upper];
  const bottom=Math.min(...group.flatMap(s=>[s.ya,s.yb]))-.15,top=Math.max(...group.flatMap(s=>[s.ya,s.yb]));
  const openings=[...segments.filter(s=>!s.f.stationUpper),...stairs.filter(f=>f.level==='1').flatMap(f=>f.p.slice(1).map((b,i)=>{const a=f.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,L,ux:(b[0]-a[0])/L,uz:(b[1]-a[1])/L,half:(Number(f.w)||1.8)/2};}))];
  for(let i=0;i<hull.length;i++){
   const a=hull[i],b=hull[(i+1)%hull.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.01)continue;
   let pieces=[[0,1]];
   for(const o of openings){const cut=occluded(a,b,o,.3);if(!cut)continue;pieces=pieces.flatMap(([l,h])=>cut[1]<=l||cut[0]>=h?[[l,h]]:[[l,Math.min(h,cut[0])],[Math.max(l,cut[1]),h]].filter(([x,y])=>y-x>.001));}
   for(const [l,h] of pieces)addBox(batch,a[0]+dx*(l+h)/2,(bottom+top)/2,a[1]+dz*(l+h)/2,L*(h-l),top-bottom,.18,'#afb4ad',-Math.atan2(dz,dx));
  }
 }

}

export function restoreStationUpperAccess(city,platforms,contains){
 const ground=city.road.filter(f=>f.stationGround),floorNodes=new Map();
 for(const f of ground)f.osmNodes.forEach((id,i)=>floorNodes.set(id,f.y[i]));
 const base=ground.reduce((sum,f)=>sum+f.y[0],0)/ground.length;
 const platformAt=p=>platforms.find(f=>contains(...p,f.p))||platforms.reduce((best,f)=>{
  const distance=f=>Math.hypot(Math.max(f.bounds[0]-p[0],0,p[0]-f.bounds[2]),Math.max(f.bounds[1]-p[1],0,p[1]-f.bounds[3]));
  return !best||distance(f)<distance(best)?f:best;
 },null);
 const levels=new Map();
 for(const f of access){const parsed=f.tags.level?.split(/[;:]/).map(Number)||[];
  if(parsed.length===1)f.nodes.forEach(id=>levels.set(id,parsed[0]));
 }
 for(const f of access.filter(f=>f.tags.highway==='steps')){let levelsHere=f.tags.level.split(/[;:]/).map(Number);if(f.tags.incline==='down')levelsHere.reverse();levels.set(f.nodes[0],levelsHere[0]);levels.set(f.nodes.at(-1),levelsHere.at(-1));}
 const nodeHeight=(id,p)=>{const level=levels.get(id)||0;if(level===0)return floorNodes.get(id)??base;if(level===.5)return base+1.19;return platformAt(p).y(...p);};
 const result=[],cuts=[];
 for(const source of access){if(source.tags.level==='0')continue;
  let f=city.road.find(f=>f.id===source.id);if(!f){f={id:source.id,n:'',one:0};city.road.push(f);}
  Object.assign(f,{p:source.p.map(p=>p.slice()),c:source.tags.highway,s:source.tags.surface||'paving_stones',w:source.tags.width||'1.8',steps:source.tags.step_count||'',b:false,l:1,stationUpper:true,stationGround:false,level:source.tags.level,t:false,u:false});
  f.y=f.p.map((p,i)=>nodeHeight(source.nodes[i],p));
  // OSM stairs can begin at the tunnel centreline junction. Keep that shared
  // corridor flat, then start the rise at its side, along the same mapped line.
  if(f.c==='steps'&&f.p.length===2){
   const low=f.y[0]<f.y[1]?0:1,high=1-low,a=f.p[low],b=f.p[high];
   const insideTunnel=p=>ground.filter(g=>[1198396111,206846965].includes(g.id)).some(g=>g.p.slice(1).some((q,j)=>{
    const r=g.p[j],dx=q[0]-r[0],dz=q[1]-r[1],t=((p[0]-r[0])*dx+(p[1]-r[1])*dz)/(dx*dx+dz*dz);
    return t>=0&&t<=1&&Math.hypot(p[0]-r[0]-dx*t,p[1]-r[1]-dz*t)<Number(g.w)/2;
   }));
   if(insideTunnel(a)&&!insideTunnel(b)){let lo=0,hi=1;for(let j=0;j<20;j++){const t=(lo+hi)/2,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(insideTunnel(p))lo=t;else hi=t;}
    if(hi<.8){const p=[a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi];f.p.splice(1,0,p);f.y.splice(1,0,f.y[low]);}
   }
  }
  result.push(f);
  if(f.c==='steps'||source.tags.level==='0.5')for(let i=1;i<f.p.length;i++){
   const a=f.p[i-1],b=f.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L,w=Number(f.w)/2+.12;
   cuts.push([[a[0]+nx*w,a[1]+nz*w],[b[0]+nx*w,b[1]+nz*w],[b[0]-nx*w,b[1]-nz*w],[a[0]-nx*w,a[1]-nz*w]]);
  }
 }
 return {paths:result,cuts};
}

export function paintStationStairwells({paths,batch}){
 for(const f of paths){
  if(!f.stationUpper)continue;
  const half=Number(f.w)/2;
  if(f.c!=='steps')continue;
  for(let i=1;i<f.p.length;i++){
   const A0=f.p[i-1],B0=f.p[i],L=Math.hypot(B0[0]-A0[0],B0[1]-A0[1]),ux=(B0[0]-A0[0])/L,uz=(B0[1]-A0[1])/L,nx=-uz,nz=ux;
   const setback=(p,y)=>{
    let distance=0;
    for(const g of paths.filter(g=>g.stationGround))for(let j=1;j<g.p.length;j++){
     if(![g.p[j-1],g.p[j]].some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.02)||Math.abs(g.y[j-1]-y)>.2)continue;
     const dx=g.p[j][0]-g.p[j-1][0],dz=g.p[j][1]-g.p[j-1][1],len=Math.hypot(dx,dz),cross=Math.abs(ux*dz/len-uz*dx/len);
     if(cross>.3)distance=Math.max(distance,((Number(g.w)||2.5)/2+.02)/cross);
    }
    return Math.min(L*.8,distance);
   };
   const start=setback(A0,f.y[i-1]),end=L-setback(B0,f.y[i]);if(end<=start)continue;
   const a=[A0[0]+ux*start,A0[1]+uz*start],b=[A0[0]+ux*end,A0[1]+uz*end],ya=f.y[i-1]+(f.y[i]-f.y[i-1])*start/L,yb=f.y[i-1]+(f.y[i]-f.y[i-1])*end/L,top=Math.max(ya,yb)+1;
   for(const side of [-1,1]){
    const at=(p,offset,h)=>[p[0]+nx*offset*side,h,p[1]+nz*offset*side];
    const A=at(a,half,ya-.12),B=at(b,half,yb-.12),C=at(b,half,top),D=at(a,half,top),E=at(a,half+.18,ya-.12),F=at(b,half+.18,yb-.12),G=at(b,half+.18,top),H=at(a,half+.18,top);

    // Recess-side handrail follows the stair rise instead of lying horizontal.
    const rA=at(a,half-.05,ya+.88),rB=at(b,half-.05,yb+.88),rC=at(b,half-.105,yb+.88),rD=at(a,half-.105,ya+.88),up=p=>[p[0],p[1]+.055,p[2]];
    // Closed rail section: the previous single plane vanished edge-on.
    for(const q of [[rA,rB,rC,rD],[up(rD),up(rC),up(rB),up(rA)],[rA,up(rA),up(rB),rB],[rB,up(rB),up(rC),rC],[rC,up(rC),up(rD),rD],[rD,up(rD),up(rA),rA]])batch.quad(...q,'#5c696b');
   }
  }
 }
}

export function paintStationAccessFloors({paths,batch,cutTriangles}){
 // Landing caps must not project horizontally into descending stair flights.
 const target=batch;
 if(cutTriangles)batch={
  tri(a,b,c,color){for(const t of cutTriangles([a,b,c]))target.tri(...t,color);},
  quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
 };
 const joints=new Set();
 for(const f of paths){
  if(!(f.stationGround||f.stationUpper)||f.c==='steps')continue;
  const half=(Number(f.w)||2.5)/2;
  for(let i=1;i<f.p.length;i++){
   const a=f.p[i-1],b=f.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.01)continue;
   const nx=-(b[1]-a[1])/L*half,nz=(b[0]-a[0])/L*half;
   batch.quad([a[0]+nx,f.y[i-1]+.055,a[1]+nz],[b[0]+nx,f.y[i]+.055,b[1]+nz],[b[0]-nx,f.y[i]+.055,b[1]-nz],[a[0]-nx,f.y[i-1]+.055,a[1]-nz],'#969b96');
  }
  for(let i=0;i<f.p.length;i++){
   const key=f.p[i].join(',')+':'+f.y[i];if(joints.has(key))continue;joints.add(key);
   const [x,z]=f.p[i],y=f.y[i]+.055;
   for(let j=0;j<16;j++){const t=j*Math.PI/8,T=(j+1)*Math.PI/8;batch.tri([x,y,z],[x+Math.cos(t)*half,y,z+Math.sin(t)*half],[x+Math.cos(T)*half,y,z+Math.sin(T)*half],'#969b96');}
  }
 }
}
