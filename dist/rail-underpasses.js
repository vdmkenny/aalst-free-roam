// Rail crossing corridors are merged before constructing portals. Parallel
// tracks share one clear opening instead of receiving overlapping tubes.
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function nearestOnLine(feature,point,height){
  let best=null;
  for(let i=1;i<feature.p.length;i++){
    const a=feature.p[i-1],b=feature.p[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<.01)continue;
    const t=clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(length*length),0,1);
    const x=mix(a[0],b[0],t),z=mix(a[1],b[1],t),distance=Math.hypot(point[0]-x,point[1]-z);
    if(!best||distance<best.distance)best={distance,x,z,ux:dx/length,uz:dz/length,y:mix(feature.y?.[i-1]??height(...a),feature.y?.[i]??height(...b),t)};
  }
  return best;
}
export function collectRailUnderpassGroups(city,height){
  const spans=[];
  const upper=[...city.road.filter(f=>f.b).map(f=>({...f,kind:'road'})),...city.rail.filter(f=>f.b||f.l>0).map(f=>({...f,kind:'rail'}))];
  for(const f of city.rail){
    for(const [start,end] of f.portalSpans||[]){
      const A=f.p[start],B=f.p[end],length=Math.hypot(B[0]-A[0],B[1]-A[1]);
      if(length<1)continue;
      const ux=(B[0]-A[0])/length,uz=(B[1]-A[1])/length,mid=[(A[0]+B[0])/2,(A[1]+B[1])/2];
      let crossing=null;
      for(const source of upper){
        if(source.kind==='rail'&&source.id===f.id)continue;
        const hit=nearestOnLine(source,mid,height);
        if(!hit||hit.distance>15||Math.abs(hit.ux*ux+hit.uz*uz)>.84)continue;
        const preferRoad=source.kind==='road'&&!['cycleway','path','footway','steps'].includes(source.c);
        const score=hit.distance+(preferRoad?0:3);
        if(!crossing||score<crossing.score)crossing={source,hit,score};
      }
      if(!crossing)continue;
      spans.push({id:f.id,start,end,A,B,ux,uz,mid,ya:f.y[start],yb:f.y[end],crossing});
    }
  }
  // Connected source bridge ways may describe separate carriageways or cycle
  // strips. Merge them too when they span the same parallel track fan.
  const groups=[];
  for(const span of spans){
    let group=groups.find(g=>{
      if(g.sources.has(span.crossing.source.kind+':'+span.crossing.source.id))return true;
      const sharedTrack=g.spans.some(s=>s.id===span.id);
      if(sharedTrack&&Math.hypot(span.mid[0]-g.origin[0],span.mid[1]-g.origin[1])<75&&Math.abs(g.deck-span.crossing.hit.y)<1.2)return true;
      const dot=Math.abs(g.ux*span.ux+g.uz*span.uz);
      if(dot<.91)return false;
      const dx=span.mid[0]-g.origin[0],dz=span.mid[1]-g.origin[1];
      return Math.abs(dx*g.ux+dz*g.uz)<20&&Math.abs(dx*(-g.uz)+dz*g.ux)<40&&Math.abs(g.deck-span.crossing.hit.y)<1.2;
    });
    if(!group){
      const sign=span.ux<0?-1:1;
      group={origin:span.mid,ux:span.ux*sign,uz:span.uz*sign,deck:span.crossing.hit.y,spans:[],sources:new Set()};groups.push(group);
    }
    group.spans.push(span);group.sources.add(span.crossing.source.kind+':'+span.crossing.source.id);
  }
  return groups.map(group=>{
    const {origin,ux,uz}=group,nx=-uz,nz=ux;
    const along=p=>(p[0]-origin[0])*ux+(p[1]-origin[1])*uz;
    const across=p=>(p[0]-origin[0])*nx+(p[1]-origin[1])*nz;
    const points=group.spans.flatMap(s=>city.rail.find(f=>f.id===s.id).p.slice(s.start,s.end+1));
    const a=Math.min(...points.map(along)),b=Math.max(...points.map(along));
    const left=Math.min(...points.map(across))-2.15,right=Math.max(...points.map(across))+2.15;
    const world=(u,v)=>[origin[0]+ux*u+nx*v,origin[1]+uz*u+nz*v];
    // Each rail retains its own profile. The portal floor follows the lowest
    // track so the surrounding masonry cannot intrude into a neighboring rail.
    const floorA=Math.min(...group.spans.map(s=>s.ya)),floorB=Math.min(...group.spans.map(s=>s.yb));
    const deck=Math.min(...group.spans.map(s=>s.crossing.hit.y));
    const maximumTrack=Math.max(...group.spans.flatMap(s=>[s.ya,s.yb]));
    return {A:world(a,0),B:world(b,0),ux,uz,nx,nz,left,right,floorA,floorB,deck,ceiling:deck-.62,clearance:deck-.62-maximumTrack,sourceIds:[...group.sources],trackIds:[...new Set(group.spans.map(s=>s.id))],spanCount:group.spans.length};
  });
}
export function buildMergedRailUnderpasses({city,scene,Batch,height,dressMasonry,addBox,ribbon}){
  const masonry=new Batch(),concrete=new Batch(),bed=new Batch(),groups=collectRailUnderpassGroups(city,height);
  let rendered=0;
  for(const g of groups){
    // Insufficient source clearance is reported instead of manufacturing a
    // roof that intersects the electrification or a track.
    if(g.clearance<5.65)continue;
    const length=Math.hypot(g.B[0]-g.A[0],g.B[1]-g.A[1]),yaw=-Math.atan2(g.uz,g.ux);
    const pos=(p,c,y)=>[p[0]+g.nx*c,y,p[1]+g.nz*c];
    const cap=g.deck-.12;
    const sourceFeatures=g.sourceIds.map(key=>{const [kind,id]=key.split(':');return (kind==='road'?city.road:city.rail).find(f=>f.id===Number(id));}).filter(Boolean);
    const covered=p=>sourceFeatures.some(source=>{
      const hit=nearestOnLine(source,p,height);
      const path=['cycleway','footway','path'].includes(source.c),roadWidth=Number(source.lanes)?Math.max(4.1,Number(source.lanes)*2.9):9;
      return hit&&hit.distance<(source.c?(path?2:roadWidth/2+4.9):4);
    });
    const count=Math.max(1,Math.ceil(length/1.5));
    // Interior walls stop at the actual upper deck rather than projecting
    // far beyond the bridge as freestanding brick sheets.
    for(const cross of [g.left,g.right])for(let i=0;i<count;i++){
      const t=i/count,u=(i+1)/count,P=[mix(g.A[0],g.B[0],t),mix(g.A[1],g.B[1],t)],Q=[mix(g.A[0],g.B[0],u),mix(g.A[1],g.B[1],u)];
      const midpoint=pos([(P[0]+Q[0])/2,(P[1]+Q[1])/2],cross,0);
      if(!covered([midpoint[0],midpoint[2]]))continue;
      const lowA=mix(g.floorA,g.floorB,t)-.25,lowB=mix(g.floorA,g.floorB,u)-.25;
      masonry.quad(pos(P,cross,lowA),pos(Q,cross,lowB),pos(Q,cross,cap),pos(P,cross,cap),'#815c48');
      const A=pos(P,cross,cap+.08),B=pos(Q,cross,cap+.08);
      ribbon(concrete,[A[0],A[2]],[B[0],B[2]],.20,A[1],B[1],'#a7aaa3');
    }
    // The cut includes the space between tracks, so give the whole corridor
    // a continuous gravel bed rather than leaving sky visible between strips.
    const A=[g.A[0]-g.ux*4,g.A[1]-g.uz*4],B=[g.B[0]+g.ux*4,g.B[1]+g.uz*4];
    bed.quad(pos(A,g.left-.65,g.floorA-.17),pos(B,g.left-.65,g.floorB-.17),pos(B,g.right+.65,g.floorB-.17),pos(A,g.right+.65,g.floorA-.17),'#77786e');
    // The mapped upper road / rail deck supplies the ceiling. Do not add a
    // second broad roof or a portal wing across diverging lower tracks.
    rendered++;
  }
  const wall=masonry.mesh(scene);wall.castShadow=true;dressMasonry(wall.material);concrete.mesh(scene).castShadow=true;bed.mesh(scene);
  scene.userData.railUnderpasses={groups:groups.length,rendered,insufficient:groups.filter(g=>g.clearance<5.65).map(g=>({trackIds:g.trackIds,clearance:g.clearance}))};
  return groups;
}
