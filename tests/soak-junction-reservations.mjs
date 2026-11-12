import assert from 'node:assert/strict';
import {NpcNavigation} from '../dist/npc-navigation.js';
import {JunctionReservations} from '../dist/junction-reservations.js';
import {vehicleMoveBlocked,vehicleOverlap} from '../dist/movement-collision.js';
const graph={nodes:[]},cars=[],nav=new NpcNavigation(graph),locks=new JunctionReservations();
// Four queues share a crossing; one approach also turns left across opposition.
for(let side=0;side<4;side++){
 const angle=side*Math.PI/2,rotate=([x,z])=>({x:x*Math.cos(angle)+z*Math.sin(angle),z:-x*Math.sin(angle)+z*Math.cos(angle),y:0});
 const points=(side===0?[[-1.6,-180],[-1.6,-7],[7,1.6],[180,1.6]]:[[-1.6,-180],[-1.6,-7],[-1.6,7],[-1.6,180]]).map(rotate),base=graph.nodes.length;graph.nodes.push(...points);
 const route=points.slice(1).map((p,i)=>({from:base+i,to:base+i+1,length:Math.hypot(p.x-points[i].x,p.z-points[i].z),kind:i===1?'turn':'road'}));
 for(let j=0;j<10;j++){const a={id:cars.length,side,mode:'car',route:[...route],edgeIndex:0,along:160-j*9,rate:6,speed:0,a:angle,node:base,x:0,z:0,y:0};Object.assign(a,nav.pose(a));cars.push(a);}
}
let passed=0,contacts=0;
for(let tick=0;tick<6000;tick++){
 const active=cars.filter(a=>a.route.length);locks.update(active);
 for(const a of active){
  const phase=(tick*.1+(a.side%2?0:17))%34,green=phase<13;
  const reservation=locks.gate(a,nav,active,green);let following=1;
  for(const b of active){if(a===b)continue;const dx=b.x-a.x,dz=b.z-a.z,front=dx*Math.sin(a.a)+dz*Math.cos(a.a),lateral=Math.abs(dx*Math.cos(a.a)-dz*Math.sin(a.a));if(front>0&&lateral<1.55&&Math.cos(b.a-a.a)>.5)following=Math.min(following,Math.max(0,Math.min(1,(front-5.2)/13)));}
  const lightFactor=green||reservation.committed||a.edgeIndex>0?1:Math.max(0,Math.min(1,(a.route[0].length-a.along-4.3)/11));
  a.speed=nav.advance(a,.6*Math.min(following,reservation.factor,lightFactor),(p,from)=>!vehicleMoveBlocked(from,p,active.filter(b=>b!==a)))/.1;
  if(!a.route.length)passed++;
 }
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(vehicleOverlap(active[i],active[j])>.01)contacts++;
 if(passed===cars.length)break;
}
console.log(JSON.stringify({cars:cars.length,passed,contacts,remaining:cars.filter(a=>a.route.length).map(a=>({id:a.id,edge:a.edgeIndex,along:a.along}))}));
assert.equal(contacts,0);assert.equal(passed,cars.length,'all queues must drain');
