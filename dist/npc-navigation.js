import {routingComponents} from './routing-components.js';
import {buildRoutingLandmarks} from './routing-landmarks.js';
import {routingCorridors} from './routing-corridors.js';
import {busyCarRoad} from './npc-population.js';
import {roundedPose,angleDelta} from './npc-steering.js';
// Connected OSM navigation and simulation state, independent of Three.js.
const paths=new Set(['pedestrian','footway','path','cycleway','steps','corridor','track','bridleway']);
const main=new Set(['primary','secondary','tertiary','trunk']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=(a,b=0)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
class Heap{
  constructor(){this.a=[];}
  push(v){const a=this.a;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].score<=v.score)break;a[i]=a[p];i=p;}a[i]=v;}
  pop(){const a=this.a,top=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].score<a[j].score)j++;if(a[j].score>=v.score)break;a[i]=a[j];i=j;}a[i]=v;}return top;}
}
export function buildNavigation(city,{height=()=>0,roadWidth=()=>6}={}){
  const nodes=[],junctions=new Map(),cells=new Map(),edges=[];
  const cell=(x,z)=>Math.floor(x/32)+','+Math.floor(z/32);
  const addNode=(p,f,mode,side,tangent,marked)=>{
    const width=roadWidth(f),path=paths.has(f.c);
    let offset=0;
    if(mode==='walk'&&!path)offset=side*(width/2+.65+(side===-1&&f.shoulderParking?f.shoulderParking+1.55:0));
    if(mode==='car')offset=-side*Math.min(1.65,width*.25);
    if(mode==='bike')offset=path?-side*.35:-side*Math.max(.55,width/2-.55);
    const n={id:nodes.length,x:p.x+tangent[1]*offset,z:p.z-tangent[0]*offset,y:p.y,mode,side,f,marked,endpoint:p.endpoint,out:[],incoming:[],component:-1};nodes.push(n);
    const key=cell(n.x,n.z);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(n);
    const j=Math.round(p.x*10)+','+Math.round(p.z*10);
    if(!junctions.has(j))junctions.set(j,[]);junctions.get(j).push(n);return n;
  };
  const connect=(a,b,kind,cost=1)=>{
    const length=Math.max(.02,distance(a,b));if(a===b||a.out.some(e=>e.to===b.id))return;
    const e={id:edges.length,from:a.id,to:b.id,length,cost,kind,way:a.f.id,major:main.has(a.f.c)};edges.push(e);a.out.push(e);b.incoming.push(e);
  };
  const crossCells=new Map();for(const c of city.crossing||[]){const k=cell(...c.p);if(!crossCells.has(k))crossCells.set(k,[]);crossCells.get(k).push(c);}
  for(const f of city.road){
    if(['no','private','agricultural'].includes(f.access)||f.c==='motorway'||f.c==='motorway_link')continue;
    const isPath=paths.has(f.c),points=[];
    for(let i=1;i<f.p.length;i++){
      const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
      const cuts=new Map([[0,false],[1,false]]);
      for(let j=1;j<Math.ceil(len/18);j++)cuts.set(j/Math.ceil(len/18),false);
      if(!isPath)for(let X=Math.floor((Math.min(a[0],b[0])-4)/32);X<=Math.floor((Math.max(a[0],b[0])+4)/32);X++)for(let Z=Math.floor((Math.min(a[1],b[1])-4)/32);Z<=Math.floor((Math.max(a[1],b[1])+4)/32);Z++){
        for(const c of crossCells.get(X+','+Z)||[]){const t=Math.max(0,Math.min(1,((c.p[0]-a[0])*dx+(c.p[1]-a[1])*dz)/(len*len)));
          if(Math.hypot(c.p[0]-a[0]-dx*t,c.p[1]-a[1]-dz*t)<3.5)cuts.set(t,true);
        }
      }
      for(const [t,marked] of [...cuts].sort((a,b)=>a[0]-b[0])){
        const x=a[0]+dx*t,z=a[1]+dz*t,y=f.y?f.y[i-1]+(f.y[i]-f.y[i-1])*t:height(x,z);
        const prev=points.at(-1);if(prev&&Math.hypot(prev.x-x,prev.z-z)<.05){prev.marked||=marked;continue;}
        points.push({x,z,y,marked});
      }
    }
    if(points.length<2)continue;
    points[0].endpoint=true;points.at(-1).endpoint=true;
    const tangents=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],l=distance(a,b)||1;return [(b.x-a.x)/l,(b.z-a.z)/l];});
    for(const mode of ['walk','car','bike']){
      if(mode==='car'&&(isPath||f.access==='destination'))continue;
      if(mode==='walk'&&f.c==='trunk')continue;
      if(mode==='bike'&&(f.c==='steps'||f.c==='corridor'||f.c==='trunk'))continue;
      const sides=mode==='walk'?(isPath?[0]:f.sw==='right'?[-1]:f.sw==='left'?[1]:['no','none','separate'].includes(f.sw)?[]:[-1,1]):isPath?[1]:f.one?[f.one<0?-1:1]:[-1,1];
      for(const side of sides){
        const line=points.map((p,i)=>addNode(p,f,mode,side,tangents[i],p.marked));
        const kind=mode==='walk'?(isPath?(f.c==='pedestrian'?'plaza':'path'):'sidewalk'):mode==='bike'?(f.c==='cycleway'?'cycleway':isPath?'shared':'road'):'road';
        const cost=mode==='bike'?(kind==='cycleway'?.65:kind==='road'?1.3:2.5):mode==='car'?(main.has(f.c)?.85:1.2):1;
        for(let i=1;i<line.length;i++){
          const forward=mode==='walk'||(isPath?f.one!==-1:side>0),back=mode==='walk'||(isPath?f.one!==1:side<0);
          if(forward)connect(line[i-1],line[i],kind,cost);
          if(back)connect(line[i],line[i-1],kind,cost);
        }
      }
    }
  }
  // Offset sidewalks and lanes join at shared OSM nodes, never at a geometric
  // bridge crossing. Walking across a carriageway is explicit and penalised.
  const longitudinal=e=>!['turn','crossing','join'].includes(e.kind);
  for(const list of junctions.values())for(const a of list)for(const b of list){
    if(a===b||a.mode!==b.mode||Math.abs(a.y-b.y)>1.8)continue;
    if(a.mode==='car'||a.mode==='bike'){
      if(!a.incoming.some(longitudinal)||!b.out.some(longitudinal))continue;
      if(a.f===b.f){
        const exit=list.some(n=>n.mode===a.mode&&n.f!==a.f&&n.out.some(longitudinal));
        if(exit||a.side===b.side||!a.endpoint||!b.endpoint)continue;
      }
      connect(a,b,a.mode==='bike'&&distance(a,b)>3.1?'crossing':'turn',a.mode==='car'?1.2:1.4);
    }else{
      if(a.f===b.f&&a.side===b.side)continue;
      const crossing=distance(a,b)>3.1&&a.side!==0&&b.side!==0;
      if(crossing&&a.f===b.f&&!a.marked)continue;
      connect(a,b,crossing?'crossing':'join',crossing?(a.marked||b.marked?1.3:5):1);
    }
  }
  // Link mapped paths/sidewalk endpoints to nearby inferred sidewalks when
  // their centreline attachment is absent from the export (same elevation).
  for(const a of nodes){
    if(!['walk','bike'].includes(a.mode)||!paths.has(a.f.c)||!a.endpoint||a.out.length>1)continue;
    let best=null,bestD=9;
    for(let X=Math.floor(a.x/32)-1;X<=Math.floor(a.x/32)+1;X++)for(let Z=Math.floor(a.z/32)-1;Z<=Math.floor(a.z/32)+1;Z++)for(const b of cells.get(X+','+Z)||[]){
      const d=distance(a,b);if(b.mode===a.mode&&!paths.has(b.f.c)&&Math.abs(a.y-b.y)<1.3&&d<bestD){best=b;bestD=d;}
    }
    if(best){connect(a,best,'join',1.4);connect(best,a,'join',1.4);}
  }
  const components=[];
  for(const n of nodes)if(n.component<0){const id=components.length,group=[],queue=[n];n.component=id;for(let i=0;i<queue.length;i++){const v=queue[i];group.push(v.id);for(const e of [...v.out,...v.incoming]){const other=nodes[e.from===v.id?e.to:e.from];if(other.component<0){other.component=id;queue.push(other);}}}components.push(group);}
  const nearest=(x,z,mode,component=null)=>{
    let best=null,d=70;for(let X=Math.floor((x-70)/32);X<=Math.floor((x+70)/32);X++)for(let Z=Math.floor((z-70)/32);Z<=Math.floor((z+70)/32);Z++)for(const n of cells.get(X+','+Z)||[]){if(n.mode!==mode||!n.out.length||(component!==null&&n.component!==component))continue;const v=Math.hypot(n.x-x,n.z-z);if(v<d){d=v;best=n;}}return best;
  };
  const goals=[];
  const businesses=new Set(city.business||[]);
  for(const f of [...(city.business||[]),...(city.door||[]),...(city.building||[]).filter((_,i)=>i%3===0)]){
    const p=typeof f.p[0]==='number'?f.p:f.p.reduce((p,q)=>[p[0]+q[0]/f.p.length,p[1]+q[1]/f.p.length],[0,0]);
    const node=nearest(...p,'walk');if(node)goals.push({node:node.id,name:f.n||'Een gebouw',kind:businesses.has(f)?'shop':'building'});
  }
  const deliveryGoals={pickup:[],dropoff:[]};
  for(const [kind,features] of [['pickup',(city.business||[]).filter(f=>f.c==='restaurant')],['dropoff',(city.building||[]).filter(f=>['house','residential','apartments','terrace','detached','semidetached_house'].includes(f.c))]]){
    for(const f of features){const p=typeof f.p[0]==='number'?f.p:f.p.reduce((p,q)=>[p[0]+q[0]/f.p.length,p[1]+q[1]/f.p.length],[0,0]);const n=nearest(...p,'bike');if(n)deliveryGoals[kind].push({node:n.id,name:f.n||'Woning',kind,source:f.id||f.n});}
  }
  const graph={nodes,edges,components,goals,nearest,deliveryGoals,strong:routingComponents(nodes)};routingCorridors(graph);graph.routingLowerBound=buildRoutingLandmarks(graph);return graph;
}
// Searches lease scratch space until completion, including across yields.
// Reuse the large cost array instead of allocating one for every NPC trip.
const routeScratch=new WeakMap();
function* routeSearch(graph,start,end,seed=1){
  if(start===end)return [];
  const nodes=graph.nodes,corridors=routingCorridors(graph);if(nodes[start].component!==nodes[end].component)return null;
  const heuristicScale=(corridors.minimumCosts.get(nodes[start].mode||'default')||0)*.82;
  let pool=routeScratch.get(graph);if(!pool){pool=[];routeScratch.set(graph,pool);}
  let scratch=pool.pop();
  if(!scratch){scratch={open:new Heap(),cost:new Float64Array(nodes.length),parent:new Map(),wayWeights:new Map()};graph.routingScratchAllocations=(graph.routingScratchAllocations||0)+1;}
  const {open,cost,parent,wayWeights}=scratch;cost.fill(Infinity);cost[start]=0;open.push({id:start,score:0,g:0});let count=0;
  try {
  while(open.a.length&&count++<18000){
    if(count%32===0)yield null;
    const current=open.pop();if(current.g!==cost[current.id])continue;
    if(current.id===end){const result=[];let n=end;while(n!==start){const chain=parent.get(n);for(let i=chain.length-1;i>=0;i--)result.push(chain[i]);n=chain[0].from;}return result.reverse();}
    for(const first of nodes[current.id].out){
      const chain=corridors.get(first)||[first];let next=current.g,used=0,to=first.to;
      for(const e of chain){
        const wayKey=Number(e.way)||e.from;let streetWeight=wayWeights.get(wayKey);if(streetWeight===undefined){streetWeight=.82+hash(wayKey,seed)*.6;wayWeights.set(wayKey,streetWeight);}
        const variation=streetWeight+hash(e.id,seed+17)*.10;
        next+=e.length*e.cost*variation*(graph.congestion?.get(e.way)||1);
        to=e.to;used++;if(to===end)break;
      }
      if(next>=cost[to])continue;cost[to]=next;parent.set(to,used===chain.length?chain:chain.slice(0,used));
      open.push({id:to,g:next,score:next+Math.max(distance(nodes[to],nodes[end])*heuristicScale,graph.routingLowerBound?.(to,end)||0)});
    }
  }
  return null;
  } finally {open.a.length=0;parent.clear();wayWeights.clear();if(pool.length<4)pool.push(scratch);}
}
export function findRoute(graph,start,end,seed=1){
  const search=routeSearch(graph,start,end,seed);let step;do{step=search.next();}while(!step.done);return step.value;
}
export class NpcNavigation{
  constructor(graph,seed=1){this.graph=graph;this.seed=seed;this.serial=0;this.agents=[];this.queue=[];this.plans=0;this.arrivals=0;this.failedPlans=0;this.pending=null;this.carGoalPools=new Map();this.otherGoalPools=new Map();}
  random(){return hash(++this.serial,this.seed);}
  spawn(mode,count){
    const g=this.graph,turnCells=new Map(),key=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16);
    if(mode==='car')for(const n of g.nodes)if(n.mode==='car'&&(n.endpoint||n.out.some(e=>e.kind==='turn'))){const k=key(n.x,n.z);if(!turnCells.has(k))turnCells.set(k,[]);turnCells.get(k).push(n);}
    const nearJunction=n=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if((turnCells.get(key(n.x+dx*16,n.z+dz*16))||[]).some(p=>distance(n,p)<12))return true;return false;};
    const pool=g.nodes.filter(n=>n.mode===mode&&n.out.length&&g.components[n.component].length>100&&(mode==='walk'||g.strong.groups[g.strong.ids[n.id]].length>8)&&(mode!=='car'||(!n.marked&&!nearJunction(n))));
    const weights=pool.map(n=>{const central=Math.hypot(n.x+255,n.z+5);return Math.min(20,Math.max(...n.out.map(e=>e.length),1))*(mode==='walk'?(central<220?65:central<480?22:central<900?3:1):mode==='car'?(busyCarRoad(n.f)?32:main.has(n.f.c)?12:1):1);});
    const total=weights.reduce((a,b)=>a+b,0),result=[];if(!total)return result;
    for(let i=0;i<count;i++){
      let n;for(let tries=0;tries<30;tries++){
        let r=this.random()*total,j=0;while(j<pool.length-1&&(r-=weights[j])>0)j++;n=pool[j];
        if(mode!=='car'||!this.agents.some(a=>a.mode==='car'&&Math.abs(a.y-n.y)<2&&distance(a,n)<8))break;
        n=null;
      }
      if(!n)continue; // Never force an overlapping spawn after exhausting retries.
      const a={id:this.agents.length,mode,node:n.id,x:n.x,z:n.z,y:n.y,a:Math.atan2(g.nodes[n.out[0].to].x-n.x,g.nodes[n.out[0].to].z-n.z),route:[],edgeIndex:0,along:0,wait:0,trip:0,goal:null,queued:false,rate:mode==='car'?7+this.random()*4:mode==='bike'?3.8+this.random()*2: .85+this.random()*.65};
      this.agents.push(a);result.push(a);this.enqueue(a);
    }
    return result;
  }
  enqueue(a){if(!a.queued){a.queued=true;this.queue.push(a);}}
  requestDetour(a){
    if(a.route.length&&!a.queued&&!a.planning){a.detourRequested=true;this.enqueue(a);}
  }
  *plan(a){
    if(a.detourRequested){
      a.detourRequested=false;
      const edge=a.route[a.edgeIndex],index=a.edgeIndex;
      if(!edge||!a.goal)return;
      const route=yield* routeSearch(this.graph,edge.to,a.goal.node,a.id*7919+a.trip*31);
      // The agent may have advanced while the search yielded. Never rewind it.
      if(route?.length&&a.route[index]===edge&&a.edgeIndex===index){
        a.route=[...a.route.slice(0,index+1),...route];this.plans++;
      }
      return;
    }
    const g=this.graph,from=g.nodes[a.node],central=Math.hypot(from.x+255,from.z+5)<750;
    const region=a.mode==='walk'?from.component:g.strong.ids[from.id],group=a.mode==='walk'?g.components[from.component]:g.strong.groups[region];
    const poolKey=a.mode+':'+region;
    if(a.mode!=='car'&&!this.otherGoalPools.has(poolKey))this.otherGoalPools.set(poolKey,a.mode==='walk'?g.goals.filter(t=>g.nodes[t.node].component===from.component):group.map(node=>({node,name:'Fietstocht'})));
    let candidates=a.mode==='car'?[]:this.otherGoalPools.get(poolKey);
    if(a.mode==='car'){
      // Reuse destination pools rather than allocating the component per trip.
      let pools=this.carGoalPools.get(region);
      if(!pools){const all=group.filter(id=>g.nodes[id].mode==='car'&&g.nodes[id].out.length).map(node=>({node,name:'Rondrit'}));
        pools={all,busy:all.filter(t=>busyCarRoad(g.nodes[t.node].f)||main.has(g.nodes[t.node].f.c))};this.carGoalPools.set(region,pools);}
      candidates=pools.busy.length&&this.random()<.85?pools.busy:pools.all;
    }
    if(a.delivery){const key='delivery:'+region+':'+(a.deliveryPhase||'pickup');if(!this.otherGoalPools.has(key))this.otherGoalPools.set(key,(g.deliveryGoals?.[a.deliveryPhase||'pickup']||[]).filter(t=>g.strong.ids[t.node]===region));candidates=this.otherGoalPools.get(key);}
    if(a.mode==='walk'&&central&&this.random()<.85){const shops=candidates.filter(t=>t.kind==='shop'&&distance(from,g.nodes[t.node])>20&&distance(from,g.nodes[t.node])<400);if(shops.length)candidates=shops;}
    let chosen=null,route=null;
    for(let attempt=0;attempt<12;attempt++){
      const goal=candidates[Math.floor(this.random()*candidates.length)];if(!goal)break;
      const n=g.nodes[goal.node],d=distance(from,n),min=a.delivery?2:a.mode==='walk'?20:a.mode==='bike'?650:450,max=a.delivery?Infinity:a.mode==='walk'?(central?850:1400):4500;
      if(d<(attempt<6?min:2)||d>max||goal.node===a.goal?.node)continue;
      route=yield* routeSearch(g,a.node,goal.node,a.id*7919+a.trip*31+attempt);if(route?.length){chosen=goal;break;}
    }
    if(!chosen){this.failedPlans++;a.wait=1+this.random()*2;return;}
    a.route=route;a.edgeIndex=0;a.along=0;a.goal=chosen;a.trip++;this.plans++;
  }
  updatePlans(dt){
    for(const a of this.agents)if(!a.route.length&&!a.queued&&!a.planning){a.wait-=dt;if(a.wait<=0)this.enqueue(a);}
    // A bounded number of route searches per frame, with a time budget.
    const until=performance.now()+1;
    let completed=0;
    while(performance.now()<until){
      if(!this.pending){const a=this.queue.shift();if(!a)break;a.queued=false;a.planning=true;this.pending={a,steps:this.plan(a)};}
      if(this.pending.steps.next().done){this.pending.a.planning=false;this.pending=null;completed++;}
    }
  }
  pose(a,travel=0){
    const g=this.graph;let index=a.edgeIndex,along=a.along+travel;
    while(index<a.route.length&&along>a.route[index].length){along-=a.route[index].length;index++;}
    if(index>=a.route.length)return {x:a.x,z:a.z,y:a.y,a:a.a,index,along};
    const e=a.route[index],p=g.nodes[e.from],q=g.nodes[e.to],t=Math.min(1,along/e.length);
    return {...roundedPose(g,a.route,index,Math.min(along,e.length),a.mode),index,along,kind:e.kind};
  }
  retreat(a,travel,allowed=()=>true){
    // Reverse only along the current lane segment, never across a junction.
    let moved=0;
    while(travel>0&&a.route.length&&a.along>.02){
      const step=Math.min(.15,travel,a.along-.02),p=this.pose(a,-step);p.a=a.a;
      if(step<=0||!allowed(p,a))break;
      Object.assign(a,{x:p.x,z:p.z,y:p.y,along:p.along});moved+=step;travel-=step;
    }
    return moved;
  }
  advance(a,travel,allowed=()=>true){
    if(!a.route.length)return 0;
    let moved=0;const steps=Math.max(1,Math.ceil(travel/.18));
    for(let i=0;i<steps&&travel>0;i++){
      const delta=travel/steps,p=this.pose(a,delta);
      if(p.index>=a.route.length){
        const end=this.graph.nodes[a.route.at(-1).to];Object.assign(a,{x:end.x,z:end.z,y:end.y,node:end.id});
        if(a.delivery){a.deliveryPhase=a.deliveryPhase==='dropoff'?'pickup':'dropoff';a.deliveries=(a.deliveries||0)+(a.deliveryPhase==='pickup'?1:0);}
        a.route=[];a.wait=a.delivery?5+this.random()*5:a.mode==='walk'?3+this.random()*14:a.mode==='bike'?1+this.random()*3:0;this.arrivals++;break;
      }
      if(a.mode==='car'||a.mode==='bike'){
        // Aim along the lane ahead, not sideways along a tiny OSM lane connector.
        // Position still follows the rounded, collision-checked route.
        let look=this.pose(a,delta+(a.mode==='car'?2.5:1.2));
        const connector=e=>e&&['turn','crossing','join'].includes(e.kind);
        // Lane-offset connectors can point backwards. Use the outgoing lane
        // as the steering target while crossing them, avoiding a full spin.
        if(connector(a.route[p.index])||connector(a.route[look.index])){
          let i=connector(a.route[p.index])?p.index:look.index;
          while(i<a.route.length&&connector(a.route[i]))i++;
          if(i<a.route.length){const e=a.route[i],u=this.graph.nodes[e.from],v=this.graph.nodes[e.to],t=Math.min(1,3/e.length);look={x:u.x+(v.x-u.x)*t,z:u.z+(v.z-u.z)*t,index:i};}
        }
        if(look.index<a.route.length&&Math.hypot(look.x-p.x,look.z-p.z)>.1)p.a=Math.atan2(look.x-p.x,look.z-p.z);
        const maxYaw=delta*(a.mode==='car'?.45:.8);
        p.a=a.a+Math.max(-maxYaw,Math.min(maxYaw,angleDelta(a.a,p.a)));
      }
      if(!allowed(p,a))break;
      Object.assign(a,{x:p.x,z:p.z,y:p.y,a:p.a,edgeIndex:p.index,along:p.along});a.node=a.route[p.index].from;moved+=delta;
    }
    return moved;
  }
}
