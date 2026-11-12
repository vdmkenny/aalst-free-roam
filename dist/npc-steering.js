// Rounded polyline corners. Trim lengths leave a straight portion on every
// edge, and cap departure from mapped lane centre lines to 65 cm.
const dist=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
// Route arrays are replaced on reroute; weak keys release cached geometry with them.
const curveCache=new WeakMap();
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function roundedPose(graph,route,index,along,mode){
  const edge=route[index],p=graph.nodes[edge.from],q=graph.nodes[edge.to];
  const plain={x:p.x+(q.x-p.x)*along/edge.length,z:p.z+(q.z-p.z)*along/edge.length,y:p.y+(q.y-p.y)*along/edge.length,a:Math.atan2(q.x-p.x,q.z-p.z)};
  if(mode!=='car'&&mode!=='bike')return plain;
  let cache=curveCache.get(route);
  if(!cache||cache.graph!==graph||cache.mode!==mode){cache={graph,mode,corners:new Map()};curveCache.set(route,cache);}
  function makeCorner(i){
    if(i<1||i>=route.length)return null;
    const before=route[i-1],after=route[i],a=graph.nodes[before.from],b=graph.nodes[before.to],c=graph.nodes[after.to];
    const l=dist(a,b),r=dist(b,c);if(l<.05||r<.05)return null;
    const ux=(b.x-a.x)/l,uz=(b.z-a.z)/l,vx=(c.x-b.x)/r,vz=(c.z-b.z)/r;
    const sine=Math.sqrt(Math.max(0,(1-ux*vx-uz*vz)/2));
    if(sine<.005)return null;
    const trim=Math.min(mode==='car'?3.5:1.8,l*.45,r*.45,1.3/sine);
    return {b,start:{x:b.x-ux*trim,z:b.z-uz*trim,y:b.y-(b.y-a.y)*trim/l},end:{x:b.x+vx*trim,z:b.z+vz*trim,y:b.y+(c.y-b.y)*trim/r},trim};
  }
  function corner(i){
    if(cache.corners.has(i))return cache.corners.get(i);
    const value=makeCorner(i);
    if(cache.corners.size>=12)cache.corners.delete(cache.corners.keys().next().value);
    cache.corners.set(i,value);return value;
  }
  let curve=corner(index),t;
  if(curve&&along<curve.trim)t=.5+along/(2*curve.trim);
  else {curve=corner(index+1);if(!curve||edge.length-along>=curve.trim)return plain;t=.5-(edge.length-along)/(2*curve.trim);}
  const {start:a,b,end:c}=curve,u=1-t,result={curved:true};
  for(const k of ['x','y','z'])result[k]=u*u*a[k]+2*u*t*b[k]+t*t*c[k];
  result.a=Math.atan2(u*(b.x-a.x)+t*(c.x-b.x),u*(b.z-a.z)+t*(c.z-b.z));return result;
}
