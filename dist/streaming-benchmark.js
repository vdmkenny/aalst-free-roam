import {findRoute} from './npc-navigation.js';
// Explicit diagnostic replay: real mapped route at the player's maximum speed.
// Collision/signals are bypassed so congestion cannot turn a streaming test idle.
export function streamingBenchmark({graph,state,button,output,place,start}){
 let run=null;
 button.onclick=()=>{
  if(run)return;
  const pool=graph.nodes.filter(n=>n.mode==='car'&&n.out.length);
  const from=pool.reduce((a,b)=>Math.hypot(b.x-state.x,b.z-state.z)<Math.hypot(a.x-state.x,a.z-state.z)?b:a);
  const targets=pool.filter(n=>n.component===from.component&&Math.hypot(n.x-from.x,n.z-from.z)>1500&&Math.hypot(n.x-from.x,n.z-from.z)<1900);
  let route=null;
  const liveCongestion=graph.congestion;graph.congestion=null;
  try{for(const target of targets.filter((_,i)=>i%30===0)){route=findRoute(graph,from.id,target.id,51);if(route?.length)break;}}finally{graph.congestion=liveCongestion;}
  if(!route?.length){output.textContent='No connected benchmark route found';return;}
  run={route,index:0,along:0,distance:0,total:route.reduce((sum,e)=>sum+e.length,0),samples:[],slow:[],saved:{...state},last:0};
  start();button.disabled=true;output.textContent='Streaming replay: 86 km/h — collisions/signals bypassed';
 };
 return {get active(){return !!run;},recordFrame(interval,stages){
  if(!run||!run.last||interval<40)return;
  const cpu=Object.entries(stages).reduce((sum,[name,value])=>sum+(name==='routing'||name.startsWith('npc:')?0:value),0);
  run.slow.push({interval,distance:run.distance,cpu,stages:{...stages}});
 },tick(ms,dt){
  if(!run)return;
  if(run.last)run.samples.push(ms-run.last);run.last=ms;
  let travel=24*dt;run.distance+=travel;
  while(travel>0&&run.index<run.route.length){const e=run.route[run.index],step=Math.min(travel,e.length-run.along);run.along+=step;travel-=step;if(run.along>=e.length){run.index++;run.along=0;}}
  if(run.index>=run.route.length){
   const sorted=run.samples.sort((a,b)=>a-b),p=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]||0;
   output.textContent=`Replay complete: ${Math.round(run.distance)}m | p95 ${p(.95).toFixed(1)}ms | p99 ${p(.99).toFixed(1)}ms | max ${p(1).toFixed(1)}ms | >50ms ${sorted.filter(t=>t>50).length}/${sorted.length} frames`;
   const worst=run.slow.sort((a,b)=>b.interval-a.interval).slice(0,5);
   output.style.whiteSpace='pre-wrap';output.style.maxWidth='700px';
   for(const sample of worst){const top=Object.entries(sample.stages).sort((a,b)=>b[1]-a[1]).slice(0,3);output.textContent+=`\n${sample.interval.toFixed(1)}ms at ${Math.round(sample.distance)}m: CPU ${sample.cpu.toFixed(1)}ms; ${top.map(([name,t])=>name+' '+t.toFixed(1)+'ms').join(', ')}; other ${(Math.max(0,sample.interval-sample.cpu)).toFixed(1)}ms`;}
   Object.assign(state,run.saved);place();run=null;button.disabled=false;return;
  }
  const e=run.route[run.index],a=graph.nodes[e.from],b=graph.nodes[e.to],t=run.along/e.length;
  Object.assign(state,{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:a.y+(b.y-a.y)*t,a:Math.atan2(b.x-a.x,b.z-a.z),v:24,driving:true});place();
  output.textContent=`Streaming replay: 86 km/h | ${Math.round(run.distance)}/${Math.round(run.total)}m | collisions/signals bypassed`;
 }};
}
