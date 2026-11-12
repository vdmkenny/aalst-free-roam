// All coordinates are in world metres. Never move a feature to another level.
export function placeRoadside(origin,{segments=[],width=.3,depth=.3,blocked=()=>false,level=()=>0,travel=0,primaryId=null,preferPath=false,clearance=.25}={}){
 const project=(s,x,z)=>{const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[1])*dz)/l2));return {x:s.a[0]+dx*t,z:s.a[1]+dz*t,d:Math.hypot(x-s.a[0]-dx*t,z-s.a[1]-dz*t),dx,dz,t};};
 const base=level(...origin),near=segments.filter(s=>Math.abs((s.ya??base)+( (s.yb??base)-(s.ya??base))*project(s,...origin).t-base)<1.5);
 const closest=near.slice().sort((a,b)=>project(a,...origin).d-project(b,...origin).d)[0];
 const primary=(preferPath&&closest?.path?closest:null)??near.filter(s=>primaryId!==null&&s.f?.id===primaryId).sort((a,b)=>project(a,...origin).d-project(b,...origin).d)[0]??near.filter(s=>!s.path).sort((a,b)=>project(a,...origin).d-project(b,...origin).d)[0]??near.sort((a,b)=>project(a,...origin).d-project(b,...origin).d)[0];
 if(!primary)return {p:origin,yaw:0,moved:false};
 const q=project(primary,...origin),len=Math.hypot(q.dx,q.dz);if(!len)return {p:origin,yaw:0,moved:false};
 const u=[q.dx/len,q.dz/len],n=[u[1],-u[0]],lateral=(origin[0]-q.x)*n[0]+(origin[1]-q.z)*n[1],side=Math.abs(lateral)<.35&&travel?-travel:Math.sign(lateral)||1;
 const yaw=-Math.atan2(u[1],u[0]);
 const rejected={level:0,obstacle:0,corridor:0};
 const fits=p=>{if(Math.abs(level(...p)-base)>1.2){rejected.level++;return false;}for(const a of [-width/2,0,width/2])for(const b of [-depth/2,0,depth/2]){const x=p[0]+u[0]*a+n[0]*b,z=p[1]+u[1]*a+n[1]*b;if(blocked(x,z)){rejected.obstacle++;return false;}if(near.some(s=>project(s,x,z).d<s.width/2+clearance)){rejected.corridor++;return false;}}return true;};
 if(fits(origin))return {p:origin,yaw,moved:false,side,u};
 const candidates=[];
 for(const along of (travel?[0,-travel,-2*travel,-3*travel,-5*travel,-7*travel,-10*travel,-13*travel,travel,2*travel,3*travel]:[0,-1,1,-2,2,-3,3,-5,5,-7,7]))for(let out=depth/2+clearance+.02;out<=Math.max(7,q.d-primary.width/2+3);out+=.2)candidates.push([q.x+u[0]*along+n[0]*side*(primary.width/2+out),q.z+u[1]*along+n[1]*side*(primary.width/2+out)]);
 candidates.sort((a,b)=>Math.hypot(a[0]-origin[0],a[1]-origin[1])-Math.hypot(b[0]-origin[0],b[1]-origin[1]));
 const p=candidates.find(fits);return {p:p??origin,yaw,moved:!!p,unresolved:!p,rejected:!p?rejected:undefined,side,u};
}
export function approachYaw(u,side,oneway=0){const travel=oneway===-1?-1:oneway?1:-side;return Math.atan2(-u[0]*travel,-u[1]*travel);}
