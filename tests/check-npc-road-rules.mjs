import assert from 'node:assert/strict';
import {signFactor,legalSpeed} from '../dist/npc-road-rules.js';
const a={x:0,z:0,y:0,a:0,speed:0},stop={id:1,c:'stop',p:[0,4.4],angle:0};
assert.equal(signFactor(a,[stop],[],.5),0);assert.equal(signFactor(a,[stop],[],.5),0);assert.equal(signFactor(a,[stop],[],.3),1);
const cross={x:-8,z:4.4,y:0,a:Math.PI/2,speed:6};assert.equal(signFactor(a,[stop],[cross],.1),0);
assert.equal(signFactor({...a,signStops:new Map()},[{...stop,c:'give_way'}],[],.1),1);
assert.equal(signFactor({...a,signStops:new Map()},[{...stop,c:'give_way'}],[cross],.1),0);
assert.equal(legalSpeed({maxspeed:'30'},'car'),30/3.6);assert.equal(legalSpeed({c:'living_street'},'car'),20/3.6);
console.log('Stop dwell, cross-traffic yield, clear junction release and speed caps passed');

const {junctionYield}=await import('../dist/npc-road-rules.js');
const east={id:1,x:-10,z:0,y:0,a:Math.PI/2,speed:5},south={id:2,x:0,z:-10,y:0,a:0,speed:5};
assert.equal(junctionYield(east,[south]),1);assert(junctionYield(south,[east])<1);
assert.equal(junctionYield(east,[{...south,y:8}]),1);
assert.equal(junctionYield(east,[{...east,id:3,z:3}]),1);
console.log('Crossing arrival priority, stable tie-break, parallel lanes and bridge separation pass');
