// Reserve a junction before entering it, including room on the exit lane.
// World-space locks join nearby split OSM nodes into one conflict area.
export class JunctionReservations{
 constructor(){this.locks=[];this.roundaboutAdmissions=new WeakMap();}
 update(agents){const byId=new Map(agents.map(a=>[a.id,a]));this.locks=this.locks.filter(l=>{const a=byId.get(l.id);return a&&a.route===l.route&&!(a.edgeIndex>l.end||a.edgeIndex===l.end&&a.along>=l.exitAlong);});}
 gate(a,navigation,others,mayEnter=true){
  const g=navigation.graph,isRing=e=>e&&g.nodes[e.from]?.f?.junction==='roundabout';
  const current=a.route[a.edgeIndex];
  // Straight-through traffic crosses the same conflict area even when OSM
  // keeps it on one way and the route contains no turn edge.
  const entersJunction=e=>e&&(e.kind==='turn'||g.nodes[e.from]?.out?.some(next=>next.kind==='turn'));
  // A roundabout is a continuous priority road, not an exclusive crossing.
  if(isRing(current))this.roundaboutAdmissions.delete(a);
  if(isRing(current)||(current?.kind==='turn'&&(isRing(a.route[a.edgeIndex-1])||g.nodes[current.from]?.f?.junction==='roundabout')))return {factor:1,committed:true};
  let ringDistance=-a.along,ring=null;
  for(let i=a.edgeIndex;i<a.route.length&&ringDistance<25;i++){if(isRing(a.route[i])){ring=a.route[i];break;}ringDistance+=a.route[i].length;}
  if(ring){
   if(this.roundaboutAdmissions.get(a)===a.route)return {factor:1,committed:true};
   const entry=g.nodes[ring.from];
   const occupied=others.some(b=>b.id!==a.id&&Math.abs(b.y-entry.y)<1.7&&(isRing(b.route?.[b.edgeIndex])||(this.roundaboutAdmissions.has(b)&&this.roundaboutAdmissions.get(b)===b.route&&b.route.length))&&Math.hypot(b.x-entry.x,b.z-entry.z)<35);
   const queueAhead=others.some(b=>{const dx=b.x-a.x,dz=b.z-a.z;return b.id!==a.id&&dx*Math.sin(a.a)+dz*Math.cos(a.a)>0&&Math.abs(dx*Math.cos(a.a)-dz*Math.sin(a.a))<2.5&&Math.hypot(dx,dz)<20;});
   if(!occupied&&!queueAhead&&mayEnter&&ringDistance<=14){this.roundaboutAdmissions.set(a,a.route);return {factor:1,committed:true};}
   return {factor:occupied||!mayEnter?Math.max(0,Math.min(1,(ringDistance-13)/10)):1,committed:false};
  }
  const queueAhead=others.some(b=>{const dx=b.x-a.x,dz=b.z-a.z,angle=a.a||0;return b.id!==a.id&&Math.abs(b.y-a.y)<1.7&&Math.cos((b.a||0)-angle)>.5&&dx*Math.sin(angle)+dz*Math.cos(angle)>0&&dx*Math.sin(angle)+dz*Math.cos(angle)<18&&Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle))<2.5;});
  const owned=this.locks.find(l=>l.id===a.id);
  if(owned){if(a.edgeIndex<owned.entry&&queueAhead)this.locks=this.locks.filter(l=>l!==owned);else return {factor:1,committed:true};}
  let distance=-a.along,index=a.edgeIndex;
  for(;index<a.route.length&&distance<22;index++){if(entersJunction(a.route[index]))break;distance+=a.route[index].length;}
  if(index>=a.route.length||distance>=22)return {factor:1,committed:false};
  const node=navigation.graph.nodes[a.route[index].from];
  // Hold ownership across all nearby split junction nodes, not just the
  // first short connector. Waiting vehicles stay a car length farther back.
  let end=index;
  while(end+1<a.route.length&&Math.hypot(g.nodes[a.route[end].to].x-node.x,g.nodes[a.route[end].to].z-node.z)<35)end++;
  if(end+1<a.route.length)end++;
  const exitAlong=Math.min(8,a.route[end].length),toExit=a.route.slice(a.edgeIndex,end).reduce((s,e)=>s+e.length,0)-a.along+exitAlong;
  const exit=navigation.pose(a,toExit);
  const exitBlocked=others.some(b=>b.id!==a.id&&Math.abs(b.y-exit.y)<1.7&&Math.abs((b.x-exit.x)*Math.cos(exit.a)-(b.z-exit.z)*Math.sin(exit.a))<2&&Math.abs((b.x-exit.x)*Math.sin(exit.a)+(b.z-exit.z)*Math.cos(exit.a))<5.5);
  const occupied=this.locks.some(l=>{
    if(Math.abs(l.y-node.y)>=1.7||Math.hypot(l.x-node.x,l.z-node.z)>=40)return false;
    // Split junctions can leave the follower holding the previous crossing.
    // Its same-lane leader must clear ahead, not wait for the follower behind.
    const owner=others.find(b=>b.id===l.id);
    if(owner&&current?.kind==='road'&&owner.route?.[owner.edgeIndex]?.kind==='road'){
      const dx=owner.x-a.x,dz=owner.z-a.z,heading=a.a||0;
      const along=dx*Math.sin(heading)+dz*Math.cos(heading);
      const side=Math.abs(dx*Math.cos(heading)-dz*Math.sin(heading));
      if(along< -3&&along> -18&&side<1.5&&Math.cos((owner.a||0)-heading)>.95)return false;
    }
    return true;
  });
  // Cars already inside the crossing have priority over waiting approaches.
  const crossingOccupied=others.some(b=>b.id!==a.id&&Math.abs(b.y-node.y)<1.7&&b.route?.[b.edgeIndex]?.kind==='turn'&&Math.hypot(b.x-node.x,b.z-node.z)<15);
  // Recover an already-entered turn whose reservation was lost (e.g. reroute).
  // Pick one occupant deterministically; do not make every occupant yield forever.
  const inside=current?.kind==='turn'&&a.along>0;
  const earlierOccupant=others.some(b=>b.id<a.id&&b.route?.[b.edgeIndex]?.kind==='turn'&&b.along>0&&Math.abs(b.y-node.y)<1.7&&Math.hypot(b.x-node.x,b.z-node.z)<15);
  if(inside&&!occupied&&!exitBlocked&&!earlierOccupant){this.locks.push({id:a.id,x:node.x,z:node.z,y:node.y,route:a.route,entry:index,end,exitAlong});return {factor:1,committed:true};}
  if(occupied||exitBlocked||crossingOccupied||!mayEnter)return {factor:Math.max(0,Math.min(1,(distance-10)/10)),committed:false};
  if(distance<=18&&!queueAhead){this.locks.push({id:a.id,x:node.x,z:node.z,y:node.y,route:a.route,entry:index,end,exitAlong});return {factor:1,committed:true};}
  return {factor:1,committed:false};
 }
}
