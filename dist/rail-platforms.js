import platformData from './rail-platform-data.js';
export function platformProfiles(railHeight){
 return platformData.filter(f=>f.p.length>3&&f.p[0][0]===f.p.at(-1)[0]&&f.p[0][1]===f.p.at(-1)[1]).map(f=>{
  const p=f.p.slice(0,-1),cx=p.reduce((s,v)=>s+v[0],0)/p.length,cz=p.reduce((s,v)=>s+v[1],0)/p.length;
  let xx=0,zz=0,xz=0;for(const [x,z] of p){xx+=(x-cx)**2;zz+=(z-cz)**2;xz+=(x-cx)*(z-cz);}
  const a=.5*Math.atan2(2*xz,xx-zz),ux=Math.cos(a),uz=Math.sin(a),t=p.map(([x,z])=>(x-cx)*ux+(z-cz)*uz),lo=Math.min(...t),hi=Math.max(...t);
  const rise=Math.max(0,Math.min(1,parseFloat(f.tags.height)||.76))+.16;
  const y0=railHeight(cx+lo*ux,cz+lo*uz)+rise,y1=railHeight(cx+hi*ux,cz+hi*uz)+rise;
  const slope=Math.max(-.025,Math.min(.025,(y1-y0)/Math.max(1,hi-lo)));
  return {...f,cx,cz,ux,uz,y:(x,z)=>y0+((x-cx)*ux+(z-cz)*uz-lo)*slope,bounds:[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]};
 });
}
export function paintPlatforms({profiles,batch,polygon,cutTriangles}){
 const surfaceBatch=cutTriangles?{tri(a,b,c,tint){for(const t of cutTriangles([a,b,c]))batch.tri(...t,tint);},quad(a,b,c,d,tint){this.tri(a,b,c,tint);this.tri(a,c,d,tint);}}:batch;
 for(const f of profiles){
  polygon(surfaceBatch,f.p,p=>f.y(...p),'#9c9e9a');
  polygon(surfaceBatch,[...f.p].reverse(),p=>f.y(...p)-.85,'#747974');
  for(let i=1;i<f.p.length;i++){const a=f.p[i-1],b=f.p[i],ya=f.y(...a),yb=f.y(...b);batch.quad([a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb-.85,b[1]],[a[0],ya-.85,a[1]],'#7b807c');}
 }
}
