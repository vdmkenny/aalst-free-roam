// Stable layouts: reloading a streamed tile must not reshuffle parked bicycles.
export function bicycleParkingLayout(site,{angle=0,clear=()=>true,contains=()=>true}={}){
  if(['building','shed'].includes(site.type)||['no','private'].includes(site.access))return [];
  const polygon=site.outline?.length>2, p=site.p;
  let u=[Math.cos(angle),Math.sin(angle)];
  if(polygon){let best=0;for(let i=0;i<site.outline.length;i++){const a=site.outline[i],b=site.outline[(i+1)%site.outline.length],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>best){best=d;u=[(b[0]-a[0])/d,(b[1]-a[1])/d];}}}
  const v=[-u[1],u[0]], coords=polygon?site.outline.map(q=>[(q[0]-p[0])*u[0]+(q[1]-p[1])*u[1],(q[0]-p[0])*v[0]+(q[1]-p[1])*v[1]]):[[-4.5,-2.9],[4.5,2.9]];
  const bounds=[Math.min(...coords.map(q=>q[0])),Math.min(...coords.map(q=>q[1])),Math.max(...coords.map(q=>q[0])),Math.max(...coords.map(q=>q[1]))];
  const limit=Math.min(site.capacity??8,polygon?300:24), slots=[];
  let seed=2166136261;for(const c of site.id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
  const random=i=>{let n=Math.imul(seed^(i+1),2246822519);n=Math.imul(n^(n>>>13),3266489917);return ((n^(n>>>16))>>>0)/4294967296;};
  // Centre-first ordering keeps point-only sites compact. Rows retain a walking aisle.
  const candidates=[];for(let a=Math.ceil((bounds[0]+.38)/.8)*.8;a<=bounds[2]-.38;a+=.8)for(let b=Math.ceil((bounds[1]+1)/3.2)*3.2;b<=bounds[3]-1;b+=3.2)candidates.push([a,b]);
  candidates.sort((a,b)=>Math.hypot(...a)-Math.hypot(...b));
  for(const [a,b] of candidates){if(slots.length>=limit)break;const x=p[0]+u[0]*a+v[0]*b,z=p[1]+u[1]*a+v[1]*b;
    const samples=[[-.33,-.95],[.33,-.95],[.33,.95],[-.33,.95],[0,0]].map(([s,t])=>[x+u[0]*s+v[0]*t,z+u[1]*s+v[1]*t]);
    if(samples.some(q=>(polygon&&!contains(...q,site.outline))||!clear(...q)))continue;
    const i=slots.length;slots.push({x,z,u,v,occupied:random(i)<.64,color:Math.floor(random(i+1000)*6),type:site.type});
  }return slots;
}
export function paintBicycleParking(batch,slots,ground,solids,bikeOnly=false){
 const colors=['#325569','#a94538','#495349','#b39a54','#6c627b','#c6c9c8'];
 for(const s of slots){const y=ground(s.x,s.z),point=([x,h,z])=>[s.x+s.u[0]*x+s.v[0]*z,y+h,s.z+s.u[1]*x+s.v[1]*z];
 const pipe=(a,b,r,color)=>{a=point(a);b=point(b);const d=b.map((n,i)=>n-a[i]),len=Math.hypot(...d);if(len<.001)return;const axis=d.map(n=>n/len),ref=Math.abs(axis[1])<.9?[0,1,0]:[1,0,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];let u=cross(axis,ref),l=Math.hypot(...u);u=u.map(n=>n/l);const v=cross(axis,u),ring=(p,i)=>p.map((n,j)=>n+r*(u[j]*Math.cos(i*Math.PI/3)+v[j]*Math.sin(i*Math.PI/3)));
 for(let i=0;i<6;i++){const aa=ring(a,i),ab=ring(a,i+1),ba=ring(b,i),bb=ring(b,i+1);batch.tri(aa,ba,bb,color);batch.tri(aa,bb,ab,color);batch.tri(a,ab,aa,color);batch.tri(b,ba,bb,color);}};
 const rack='#939da0';
 if(!bikeOnly){
 if(['wall_loops','rack','lean_and_stick'].includes(s.type)){pipe([-.23,0,.66],[-.23,.42,.66],.025,rack);pipe([.23,0,.66],[.23,.42,.66],.025,rack);pipe([-.23,.42,.66],[.23,.42,.66],.025,rack);}
 else{pipe([.27,0,-.38],[.27,.77,-.38],.027,rack);pipe([.27,.77,-.38],[.27,.77,.38],.027,rack);pipe([.27,.77,.38],[.27,0,.38],.027,rack);}
 solids?.addBox(s.x+s.u[0]*.27,y+.4,s.z+s.u[1]*.27,.07,.8,.82,Math.atan2(s.v[0],s.v[1]));
 }
 if(!s.occupied)continue;
 const color=colors[s.color];for(const z of [-.6,.6]){for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;pipe([0,.34+.31*Math.sin(a),z+.31*Math.cos(a)],[0,.34+.31*Math.sin(b),z+.31*Math.cos(b)],.035,'#252a2b');if(i%3===0)pipe([0,.34,z],[0,.34+.28*Math.sin(a),z+.28*Math.cos(a)],.009,'#a7afb0');}}
 const rear=[0,.34,-.6],seat=[0,.85,-.24],crank=[0,.34,-.13],head=[0,.78,.41],front=[0,.34,.6];
 for(const [a,b] of [[rear,seat],[rear,crank],[seat,crank],[seat,head],[crank,head],[head,front]])pipe(a,b,.024,color);
 pipe([0,.82,.41],[0,1,.42],.023,rack);pipe([-.23,1,.42],[.23,1,.42],.027,'#30383a');pipe([0,.9,-.38],[0,.9,-.14],.065,'#30383a');pipe([-.15,.34,-.13],[.15,.34,-.13],.018,rack);
 }
}
