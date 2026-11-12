// ALT lower bounds on the undirected relaxation of the legal movement graph.
// Ignoring direction only lowers costs; actual routes still use directed edges.
export function buildRoutingLandmarks(graph){
 const local=new Int32Array(graph.nodes.length),groups=new Map();
 graph.components.forEach(ids=>ids.forEach((id,i)=>{local[id]=i;}));
 for(let component=0;component<graph.components.length;component++){
  const ids=graph.components[component];if(ids.length<100)continue;
  const tables=[];let source=ids[0];
  for(let pass=0;pass<3;pass++){
   const d=new Float64Array(ids.length).fill(Infinity),heap=[];
   const push=(id,cost)=>{let i=heap.length;heap.push({id,cost});while(i){const p=(i-1)>>1;if(heap[p].cost<=cost)break;heap[i]=heap[p];i=p;}heap[i]={id,cost};};
   const pop=()=>{const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].cost<heap[j].cost)j++;if(heap[j].cost>=last.cost)break;heap[i]=heap[j];i=j;}heap[i]=last;}return result;};
   d[local[source]]=0;push(source,0);
   while(heap.length){const a=pop();if(a.cost!==d[local[a.id]])continue;const node=graph.nodes[a.id];
    for(const list of [node.out,node.incoming])for(const e of list){const id=e.from===a.id?e.to:e.from;if(graph.nodes[id].component!==component)continue;const cost=a.cost+e.length*e.cost;
     if(cost<d[local[id]]){d[local[id]]=cost;push(id,cost);}
    }
   }
   tables.push(d);
   let furthest=-1;for(const id of ids){const nearest=Math.min(...tables.map(t=>t[local[id]]));if(Number.isFinite(nearest)&&nearest>furthest){furthest=nearest;source=id;}}
  }
  groups.set(component,tables);
 }
 return (a,b)=>{let bound=0;const tables=groups.get(graph.nodes[a].component);if(tables)for(const d of tables){const value=Math.abs(d[local[a]]-d[local[b]]);if(Number.isFinite(value))bound=Math.max(bound,value*.82);}return bound;};
}
