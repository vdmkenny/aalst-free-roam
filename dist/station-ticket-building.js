// Former glazed ticket building, using its mapped perimeter unchanged.
// Massing/detail reference: user May 2025 view from Majoor Claserstraat.
export function buildStationTicketBuilding({batch,windows,f,height,polygon,addBox}){
 if(f.id!==1018264313)return false;
 const p=f.p,base=Math.min(...p.map(q=>height(...q))),H=6.4;
 polygon(batch,p,()=>base-.15,'#707b7d');polygon(batch,[...p].reverse(),()=>base+H,'#596568');
 for(let i=1;i<p.length;i++){
  const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=uz,nz=-ux;
  // Clockwise mapped footprint; outward normal is to its left.
  const signed=p.slice(1).reduce((s,q,j)=>s+p[j][0]*q[1]-q[0]*p[j][1],0),sign=signed>0?1:-1,Nx=nx*sign,Nz=nz*sign;
  const at=(u,y,d=0)=>[a[0]+ux*u+Nx*d,base+y,a[1]+uz*u+Nz*d],yaw=-Math.atan2(dz,dx);
  const panel=(out,l,r,low,high,c,d=0)=>out.quad(at(l,low,d),at(r,low,d),at(r,high,d),at(l,high,d),c);
  panel(batch,0,L,-.15,H,'#687b78');
  // The station-facing end has a lightweight glazed entrance canopy.
  // Keep the wall on the OSM boundary; only the canopy projects beyond it.
  if(Nx>.7&&L>3){
   const lo=.12,hi=L-.12,reach=1.6;
   const q=[at(lo,3.05,.03),at(hi,3.05,.03),at(hi,3.3,reach),at(lo,3.3,reach)];
   windows.quad(...q,'#839e9b');
   windows.quad(q[3],q[2],q[1],q[0],'#839e9b');
   addBox(batch,...at(L/2,3.3,reach),hi-lo,.08,.08,'#adbab3',yaw);
   for(let u=lo;u<=hi+.01;u+=(hi-lo)/Math.max(2,Math.ceil(L/1.3))){
    // Each rafter is a closed wedge rising gently away from the facade.
    const A=at(u-.035,3.05,.03),B=at(u+.035,3.05,.03),C=at(u+.035,3.3,reach),D=at(u-.035,3.3,reach);
    const low=q=>[q[0],q[1]-.065,q[2]],r=[A,B,C,D];
    batch.quad(...r,'#adbab3');batch.quad(...r.map(low).reverse(),'#adbab3');
    for(let k=0;k<4;k++)batch.quad(r[k],low(r[k]),low(r[(k+1)%4]),r[(k+1)%4],'#adbab3');
   }
  }
  if(Nz<.2||L<1.5)continue;
  const count=Math.max(1,Math.round(L/1.5));
  for(let j=0;j<count;j++){const lo=j*L/count+.06,hi=(j+1)*L/count-.06;panel(windows,lo,hi,.3,2.65,'#496568',.015);addBox(batch,...at(j*L/count+.03,1.5,.025),.05,2.5,.06,'#c7cdcb',yaw);}
  panel(batch,0,L,2.7,3.2,'#466b83',.025);
  panel(windows,0,L,3.3,6.1,'#364442',.012);
  for(let y=3.35;y<6.15;y+=.16)addBox(batch,...at(L/2,y,.035),L,.035,.045,'#a1aba4',yaw);
  for(let u=.08;u<L;u+=1.3)addBox(batch,...at(u,4.75,.05),.055,2.9,.055,'#b2bdb6',yaw);
 }
 return true;
}
