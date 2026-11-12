// One closed swept solid: shared stations join the retaining wall and portals.
export function buildTreinstraatMasonry({T,city,height,railHeight,scene,dressMasonry,onNodes=()=>{},onDress=()=>{}}){
  const wall=city.retainingWall.find(f=>f.referenceArches);if(!wall)return;
  const nodes=[],arches=[];
  const add=(p,back,base,top)=>{const last=nodes.at(-1),s=last?last.s+Math.hypot(p[0]-last.p[0],p[1]-last.p[1]):0;nodes.push({p,back,base,top,s});return s;};
  const portal=(id,frontA,frontB,backA,backB)=>{
    const ring=city.structure.find(f=>f.id===id).p;
    const chain=front=>{const index=ring.findIndex(p=>p[0]===front[0]&&p[1]===front[1]);return (index===0?ring.slice(0,6):ring.slice(6,12).reverse()).map(p=>p.slice());};
    const edgeA=chain(frontA),edgeB=chain(frontB);
    if(id===797639483){
      // Photo-confirmed portal extension: its face is flush with the existing
      // retaining-wall tangent, rather than recessed into the OSM deck outline.
      // Keep the rear and all remaining mapped side vertices fixed.
      const a=nodes.at(-2).p,b=nodes.at(-1).p,dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz;
      const flush=p=>{const t=((p[0]-b[0])*dx+(p[1]-b[1])*dz)/L;return [b[0]+t*dx,b[1]+t*dz];};
      frontA=flush(frontA);frontB=flush(frontB);
      // A skew tunnel has straight generators from one portal to the other.
      // The mapped deck's intermediate outline vertices are not tunnel sections.
      for(let k=0;k<6;k++){
        const t=k/5;
        edgeA[k]=frontA.map((v,j)=>v+(backA[j]-v)*t);
        edgeB[k]=frontB.map((v,j)=>v+(backB[j]-v)*t);
      }
    }
    const base=Math.min(height(...frontA),height(...frontB),height(...backA),height(...backB))-.2;
    const top=id===797639483?nodes.at(-1).top:(railHeight(...frontA)+railHeight(...frontB))/2-.05;
    const start=add(frontA,backA,base,top),end=add(frontB,backB,base,top);
    nodes[nodes.length-2].edge=edgeA;nodes[nodes.length-1].edge=edgeB;
    // Masonry jambs remain outside the clear opening.
    arches.push({id,a:start+.38,b:end-.38,base,top,nodeA:nodes.length-2,nodeB:nodes.length-1});
  };
  add([59.31,-322.35],[49.85,-343.29],Math.min(height(59.31,-322.35),height(64.29,-319.5))-.2,railHeight(59.31,-322.35)-.05);
  portal(797639481,[64.29,-319.5],[76.17,-313.86],[70.45,-332.4],[82.11,-326.35]);
  portal(797639482,[89.91,-307.02],[100.45,-302.1],[95.71,-319.35],[106.3,-314.34]);
  for(let i=wall.p.length-1;i>=0;i--){
    const p=wall.p[i];if(p[0]>238.3)continue;
    const n=wall.normals[i];add(p,[p[0]+n[0]*2.1,p[1]+n[1]*2.1],wall.bottom[i]-.18,wall.top[i]);
  }
  portal(797639483,[239.92,-206.45],[246.27,-200.76],[241.9,-230.22],[248.71,-224.01]);
  // Continue along the mapped railway axis, not along the skew portal plane.
  // The photographed continuation is certain; its distant termination is not.
  {const b=nodes.at(-1),dx=263.35-247.36,dz=-192.49+211.16,L=Math.hypot(dx,dz),d=12;
    add([b.p[0]+dx/L*d,b.p[1]+dz/L*d],[b.back[0]+dx/L*d,b.back[1]+dz/L*d],b.base,b.top);}
  for(const n of nodes)n.edge??=Array.from({length:6},(_,i)=>n.p.map((v,k)=>v+(n.back[k]-v)*i/5));
  onNodes(nodes);
  const mix=(a,b,t)=>a+(b-a)*t;
  const sample=s=>{
    let i=1;while(i<nodes.length-1&&nodes[i].s<s)i++;
    const a=nodes[i-1],b=nodes[i],t=(s-a.s)/(b.s-a.s);
    const edge=a.edge.map((p,i)=>p.map((v,k)=>mix(v,b.edge[i][k],t)));
    return {edge,p:edge[0],back:edge.at(-1),base:mix(a.base,b.base,t),top:mix(a.top,b.top,t)};
  };
  const positions=[],colors=[];const brick=new T.Color('#80594b');
  const tri=(a,b,c)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(brick.r,brick.g,brick.b);};
  const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d);};
  const stations=new Set(nodes.map(n=>n.s));
  for(let s=0;s<nodes.at(-1).s;s+=.35)stations.add(s);
  for(const a of arches){stations.add(a.a);stations.add(a.b);for(let i=1;i<40;i++)stations.add(mix(a.a,a.b,i/40));}
  const ss=[...stations].sort((a,b)=>a-b),columns=[];
  for(let i=1;i<ss.length;i++){
    const s0=ss[i-1],s1=ss[i],arch=arches.find(a=>(s0+s1)/2>a.a&&(s0+s1)/2<a.b);
    const column=s=>{const n=sample(s);let low=n.base;if(arch){const t=(s-arch.a)/(arch.b-arch.a);const spring=Math.min(arch.base+2.0,arch.top-1.65);low=spring+(arch.top-.65-spring)*Math.sqrt(Math.max(0,1-(2*t-1)**2));}return {low:n.edge.map(p=>[p[0],low,p[1]]),high:n.edge.map(p=>[p[0],n.top,p[1]]),f:[n.p[0],low,n.p[1]],b:[n.back[0],low,n.back[1]],F:[n.p[0],n.top,n.p[1]],B:[n.back[0],n.top,n.back[1]]};};
    columns.push([column(s0),column(s1)]);
  }
  // Split vertical edges at jamb heights on BOTH adjacent faces: no T-junctions.
  const face=(points)=>{const c=[0,0,0];for(const p of points)for(let j=0;j<3;j++)c[j]+=p[j]/points.length;for(let j=0;j<points.length;j++)tri(c,points[j],points[(j+1)%points.length]);};
  for(let i=0;i<columns.length;i++){
    const [a,b]=columns[i],prev=columns[i-1]?.[1],next=columns[i+1]?.[0];
    const front=[a.f,b.f],back=[a.b,b.b];
    if(next&&next.f[1]>b.f[1]+1e-6){front.push(next.f);back.push(next.b);}
    front.push(b.F,a.F);back.push(b.B,a.B);
    if(prev&&prev.f[1]>a.f[1]+1e-6){front.push(prev.f);back.push(prev.b);}
    face(front);face(back.reverse());
    for(let d=0;d<5;d++){
      quad(a.high[d],b.high[d],b.high[d+1],a.high[d+1]);quad(a.low[d+1],b.low[d+1],b.low[d],a.low[d]);
      if(prev&&Math.abs(prev.f[1]-a.f[1])>1e-6)quad(prev.low[d],prev.low[d+1],a.low[d+1],a.low[d]);
    }
  }
  const a=columns[0][0],b=columns.at(-1)[1];for(let d=0;d<5;d++){quad(a.low[d],a.high[d],a.high[d+1],a.low[d+1]);quad(b.low[d+1],b.high[d+1],b.high[d],b.low[d]);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});dressMasonry(material);
  const mesh=new T.Mesh(geometry,material);mesh.name='Treinstraat continuous closed railway masonry';mesh.userData.treinstraatMasonry=true;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  onDress({nodes,arches,sample});
  return mesh;
}
