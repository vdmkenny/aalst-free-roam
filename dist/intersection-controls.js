// OSM can map one traffic_signals node at a junction centre, rather than each
// physical pole. Expand that node onto incoming approaches of the actual ways.
export function junctionApproaches(point,ways,distance=6){
 const branches=[];
 for(const f of ways){
  const i=f.p.findIndex(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<.12);if(i<0)continue;
  for(const step of [-1,1]){
   const travel=-step;if(f.one&&f.one!==travel)continue;
   if(!f.p[i+step])continue;
   let a=f.p[i],left=distance,target=null;
   for(let k=i+step;k>=0&&k<f.p.length;k+=step){const b=f.p[k],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len>=left){target=[a[0]+(b[0]-a[0])*left/len,a[1]+(b[1]-a[1])*left/len];break;}left-=len;a=b;}
   if(!target)continue;
   const dx=point[0]-target[0],dz=point[1]-target[1],L=Math.hypot(dx,dz),u=[dx/L,dz/L];
   if(branches.some(b=>b.u[0]*u[0]+b.u[1]*u[1]>.96))continue;
   branches.push({p:target,roadId:f.id,travel,u});
  }
 }
 return branches;
}
