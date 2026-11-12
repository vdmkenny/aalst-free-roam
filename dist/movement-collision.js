// Pure simulation helpers: no scene/mesh visibility dependencies.
export function hullBlocked(blocked,x,z,y,angle,driving){
  if(!driving)return blocked(x,z,y,.25);
  const sx=Math.sin(angle),sz=Math.cos(angle);
  // Overlapping circles cover the body, including the front and rear bumper.
  return [-1.2,-.6,0,.6,1.2].some(d=>blocked(x+sx*d,z+sz*d,y,.88));
}
export function sweepMove(state,dx,dz,blocked){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  const sx=dx/steps,sz=dz/steps;
  let hit=false;
  for(let i=0;i<steps;i++){
    if(!blocked(state.x+sx,state.z+sz)){state.x+=sx;state.z+=sz;continue;}
    hit=true;
    if(!blocked(state.x+sx,state.z))state.x+=sx;
    if(!blocked(state.x,state.z+sz))state.z+=sz;
    break;
  }
  return hit;
}

// Separating-axis overlap for car bodies. Contact permits motion away from an
// existing overlap, so a collision never traps both vehicles in place.
export function vehicleOverlap(a,b){
  if(Math.abs(a.x-b.x)>4.5||Math.abs(a.z-b.z)>4.5||Math.abs((a.y||0)-(b.y||0))>1.7)return 0;
  const ac=Math.cos(a.a),as=Math.sin(a.a),bc=Math.cos(b.a),bs=Math.sin(b.a);
  const parallel=Math.abs(ac*bc+as*bs),cross=Math.abs(as*bc-ac*bs);
  const width=.9+.9*parallel+2.05*cross,length=2.05+.9*cross+2.05*parallel;
  const dx=b.x-a.x,dz=b.z-a.z;
  const aw=width-Math.abs(dx*ac-dz*as);if(aw<=0)return 0;
  const al=length-Math.abs(dx*as+dz*ac);if(al<=0)return 0;
  const bw=width-Math.abs(dx*bc-dz*bs);if(bw<=0)return 0;
  const bl=length-Math.abs(dx*bs+dz*bc);if(bl<=0)return 0;
  return Math.pow(aw*al*bw*bl,.25);
}
export function vehicleMoveBlocked(from,to,others){
  return others.some(other=>{
    const after=vehicleOverlap(to,other);
    return after>1e-6&&after>=vehicleOverlap(from,other)-1e-6;
  });
}
