import assert from 'node:assert/strict';
import {signFactor} from '../dist/npc-road-rules.js';
import {JunctionReservations} from '../dist/junction-reservations.js';
for(const kind of ['stop','give_way']){
 const nodes=[{x:0,z:-30,y:0},{x:0,z:0,y:0},{x:0,z:10,y:0},{x:0,z:100,y:0},{x:0,z:200,y:0}];
 const route=nodes.slice(1).map((n,i)=>({from:i,to:i+1,length:n.z-nodes[i].z,kind:i===1?'turn':'road'}));
 const a={id:1,x:0,z:-25,y:0,a:0,speed:0,route,edgeIndex:0,along:5};
 const nav={graph:{nodes},pose:(a,d)=>({x:0,z:a.z+d,y:0,a:0})},locks=new JunctionReservations();
 const sign={id:1,c:kind,p:[0,-1],angle:0};let held=0;
 for(let i=0;i<2000&&a.z<15;i++){
  locks.update([a]);const law=signFactor(a,[sign],[],.1),gate=locks.gate(a,nav,[],law>.95&&!a.pendingStop);
  const speed=6*Math.min(gate.factor,gate.committed?1:law);
  if(kind==='stop'&&a.z< -5&&speed<.25)held+=.1;
  a.z+=speed*.1;a.along+=speed*.1;a.speed=speed;
  while(a.edgeIndex<route.length-1&&a.along>=route[a.edgeIndex].length){a.along-=route[a.edgeIndex].length;a.edgeIndex++;}
 }
 assert(a.z>=15,kind+' controlled junction must clear');
 if(kind==='stop')assert(a.signStops.get(1)?.held>=1.2,'must actually dwell at stop');
 // Ownership expires on the outgoing road, not at its far end/next junction.
 a.edgeIndex=2;a.along=9;locks.update([a]);assert.equal(locks.locks.length,0);
 console.log(kind+' integrated stop-line/admission/exit release passed');
}
