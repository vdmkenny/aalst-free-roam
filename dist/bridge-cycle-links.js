// Join separate OSM cycleway decks to their parallel road deck without moving
// either mapped centreline. Never join an at-grade path to an overhead road.
export function bridgeCycleLinks(lines,width){
 const bridges=lines.filter(r=>r.f.b&&!['cycleway','footway','path','steps','pedestrian'].includes(r.f.c));
 const result=[];
 for(const path of lines.filter(r=>r.f.b&&r.f.c==='cycleway'))for(const {a,b} of path.segments){
  const dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],length=Math.hypot(dx,dz);if(length<.01)continue;
  let best=null;
  for(const road of bridges){
   if((road.f.l||0)!==(path.f.l||0)||!!road.f.t!==!!path.f.t)continue;
   for(const segment of road.segments){
    const A=segment.a,B=segment.b,rx=B.p[0]-A.p[0],rz=B.p[1]-A.p[1],rl=Math.hypot(rx,rz);
    if(rl<.01||Math.abs(dx*rx+dz*rz)/(length*rl)<.94)continue;
    const project=p=>{const t=((p[0]-A.p[0])*rx+(p[1]-A.p[1])*rz)/(rl*rl);return {t,x:A.p[0]+rx*t,z:A.p[1]+rz*t,y:A.y+(B.y-A.y)*t};};
    const mid=project([(a.p[0]+b.p[0])/2,(a.p[1]+b.p[1])/2]);if(mid.t<-.1||mid.t>1.1)continue;
    const d=Math.hypot(mid.x-(a.p[0]+b.p[0])/2,mid.z-(a.p[1]+b.p[1])/2),gap=d-width(road.f)/2-width(path.f)/2;
    if(gap<.03||gap>5||Math.abs(mid.y-(a.y+b.y)/2)>.7)continue;
    if(!best||d<best.d)best={road,project,d};
   }
  }
  if(!best)continue;
  const corners=[];
  for(const node of [a,b]){
   const q=best.project(node.p),vx=node.p[0]-q.x,vz=node.p[1]-q.z,d=Math.hypot(vx,vz),nx=vx/d,nz=vz/d;
   corners.push({road:[q.x+nx*width(best.road.f)/2,q.y+.028,q.z+nz*width(best.road.f)/2],cycle:[node.p[0]-nx*width(path.f)/2,node.y+(best.road.f.n==='Brusselse steenweg'?.105:.028),node.p[1]-nz*width(path.f)/2]});
  }
  result.push({road:best.road.f.id,path:path.f.id,corners});
 }
 return result;
}
