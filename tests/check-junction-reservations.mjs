import assert from 'node:assert/strict';
import {JunctionReservations} from '../dist/junction-reservations.js';
const nodes=[{x:0,z:0,y:0},{x:0,z:5,y:0},{x:0,z:30,y:0}];
const route=[{from:0,to:0,length:8,kind:'road'},{from:0,to:1,length:5,kind:'turn'},{from:1,to:2,length:25,kind:'road'}];
const nav={graph:{nodes},pose:()=>({x:0,z:13,y:0,a:0})};
const a={id:1,x:0,z:-8,y:0,route,edgeIndex:0,along:0},b={...a,id:2,x:-8,z:0,route:[...route]};
const locks=new JunctionReservations();
assert(locks.gate(a,nav,[b],true).committed);
assert(locks.gate(b,nav,[a],true).factor<1);
assert(locks.gate(a,nav,[b],false).committed,'owner clears after phase change');
a.edgeIndex=2;a.along=9;locks.update([a,b]);assert.equal(locks.locks.length,0);
assert(locks.gate(b,nav,[],true).committed);
const blocked=new JunctionReservations();assert.equal(blocked.gate({...a,edgeIndex:0,along:0},nav,[{id:3,x:0,z:13,y:0}],true).factor,0,'blocked approach stops outside the conflict area');
assert.equal(new JunctionReservations().gate(b,nav,[],false).committed,false);
// Repeated contested entries: each accepted vehicle clears before another enters.
const soak=new JunctionReservations();let passed=0;
for(let cycle=0;cycle<1000;cycle++){
 const entrants=[1,2,3,4].map(id=>({...b,id,edgeIndex:0,along:0,route:[...route]}));
 for(const car of entrants){assert(soak.gate(car,nav,[],true).committed);assert.equal(soak.locks.length,1);for(const other of entrants.filter(n=>n!==car))assert(!soak.gate(other,nav,[],true).committed);car.edgeIndex=2;car.along=9;soak.update(entrants);passed++;}
}
console.log(passed+' contested passages: exclusive entry, exit clearance, red-light hold, committed clearance and release pass');

const orphan=new JunctionReservations();
const insideA={...b,id:11,x:0,z:1,edgeIndex:1,along:1},insideB={...b,id:12,x:-3,z:1,edgeIndex:1,along:1};
assert(orphan.gate(insideA,nav,[insideB],false).committed,'already-entered occupant may clear after lost reservation on red');
assert(!orphan.gate(insideB,nav,[insideA],false).committed,'only one orphan resumes');

const ordered=new JunctionReservations();
const back={...b,id:20,x:0,z:-10,a:0,edgeIndex:0,along:0},front={...b,id:21,x:0,z:-4,a:0,edgeIndex:0,along:4};
assert(!ordered.gate(back,nav,[front],true).committed,'rear car cannot reserve ahead of front car');
assert(ordered.gate(front,nav,[back],true).committed,'front car gets first reservation');

const split=new JunctionReservations();
const leader={...front,route:[...route],z:0,edgeIndex:0,along:7};
const follower={...back,route:[...route],z:-5,edgeIndex:0,along:5};
split.locks.push({id:follower.id,x:0,z:0,y:0,route:follower.route,entry:0,end:2,exitAlong:8});
assert(split.gate(leader,nav,[follower],true).committed,'same-lane leader clears a follower-held split junction');
const crossed=new JunctionReservations();crossed.locks.push({...split.locks[0]});
assert(!crossed.gate(leader,nav,[{...follower,a:Math.PI/2}],true).committed,'crossing traffic still holds exclusion');
console.log('Follower-held split-junction deadlock regression passed');
