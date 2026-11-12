// Exact directed corridor shortcuts. Detailed edges remain the movement truth.
// Stop at every branching choice; do not remove legal directions or crossings.
const cache=new WeakMap();
export function routingCorridors(graph){
 let index=cache.get(graph);if(index)return index;
 index=new Map();index.minimumCosts=new Map();
 for(const node of graph.nodes)for(const first of node.out){
  const mode=node.mode||'default';index.minimumCosts.set(mode,Math.min(index.minimumCosts.get(mode)??Infinity,first.cost));
  const chain=[first],seen=new Set([first.from]);let edge=first;
  while(chain.length<256){
   if(seen.has(edge.to))break;seen.add(edge.to);
   const exits=graph.nodes[edge.to].out.filter(e=>e.to!==edge.from);
   if(exits.length!==1)break;
   edge=exits[0];chain.push(edge);
  }
  index.set(first,chain);
 }
 cache.set(graph,index);return index;
}
