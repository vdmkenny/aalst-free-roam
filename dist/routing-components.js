// Iterative Kosaraju: destinations in the same directed component are reachable
// and have a return route. Weak connectivity alone cannot establish this.
export function routingComponents(nodes){
 const seen=new Uint8Array(nodes.length),order=[];
 for(let root=0;root<nodes.length;root++){
  if(seen[root])continue;seen[root]=1;const stack=[[root,0]];
  while(stack.length){const top=stack.at(-1),edges=nodes[top[0]].out;
   if(top[1]<edges.length){const next=edges[top[1]++].to;if(!seen[next]){seen[next]=1;stack.push([next,0]);}}
   else{order.push(top[0]);stack.pop();}
  }
 }
 const ids=new Int32Array(nodes.length).fill(-1),groups=[];
 for(let i=order.length-1;i>=0;i--){const root=order[i];if(ids[root]>=0)continue;
  const id=groups.length,group=[root];ids[root]=id;
  for(let j=0;j<group.length;j++)for(const e of nodes[group[j]].incoming||[]){if(ids[e.from]<0){ids[e.from]=id;group.push(e.from);}}
  groups.push(group);
 }
 return {ids,groups};
}
