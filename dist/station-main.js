// Historic station: city-facing gallery and a single central tower.
// OSM perimeter is never replaced by an axis-aligned bounding rectangle.
export function stationGalleryOpen(f,x,z){
 if(f.id!==1151964136)return false;
 const a=f.p[0],b=f.p[16],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
 const u=(x-a[0])*ux+(z-a[1])*uz,v=-(x-a[0])*uz+(z-a[1])*ux;
 if(u<.25||u>L-.25||v>0||v< -3.45)return false;
 const pitch=L/(2*Math.round((L/3.7-1)/2)+1),pier=Math.round(u/pitch)*pitch;
 return !(v>-.65&&Math.abs(u-pier)<.25);
}
export function buildHistoricStation({batch,windows,scene,f,height,polygon,addBox,T}){
 if(f.id!==1151964136)return false;
 const p=f.p,a=p[0],end=p[16],len=Math.hypot(end[0]-a[0],end[1]-a[1]),ux=(end[0]-a[0])/len,uz=(end[1]-a[1])/len,nx=-uz,nz=ux;
 const at=(u,v,h)=>[a[0]+ux*u+nx*v,base+h,a[1]+uz*u+nz*v];
 const local=q=>[(q[0]-a[0])*ux+(q[1]-a[1])*uz,(q[0]-a[0])*nx+(q[1]-a[1])*nz];
 const center=p.slice(0,-1).reduce((s,q)=>[s[0]+q[0]/(p.length-1),s[1]+q[1]/(p.length-1)],[0,0]);
 const base=height(...center),eaves=Math.min(Number.isFinite(f.dh)?f.dh:5.4,5.4),brick='#a85f49',stone='#858c8d',dark='#35484e',yaw=-Math.atan2(uz,ux);
 const box=(u,v,h,w,H,d,c=brick)=>addBox(batch,...at(u,v,h),w,H,d,c,yaw);
 const panel=(u,v,h,w,H,c)=>windows.quad(at(u-w/2,v,h-H/2),at(u+w/2,v,h-H/2),at(u+w/2,v,h+H/2),at(u-w/2,v,h+H/2),c);
 const pairedWindow=(u,y,w,H)=>{
  const r=(w-.14)/4,spring=y+H/2-r;
  for(const sign of [-1,1]){const mid=u+sign*(r+.035);
   panel(mid,.018,(y-H/2+spring)/2,r*2,spring-(y-H/2),dark);
   for(let k=0;k<12;k++){const a=k*Math.PI/12,b=(k+1)*Math.PI/12;
    windows.tri(at(mid,.019,spring),at(mid+r*Math.cos(a),.019,spring+r*Math.sin(a)),at(mid+r*Math.cos(b),.019,spring+r*Math.sin(b)),dark);
   }
   panel(mid,.026,y-.05,.045,H-.15,'#b5b8af');
   panel(mid,.026,y+.15,r*2,.04,'#b5b8af');
  }
 };
 const windowTrim=(u,y,w,H)=>{
  for(const side of [-1,1])box(u+side*(w/2+.1),.025,y,.12,H+.2,.09,stone);
  box(u,.025,y-H/2-.1,w+.32,.16,.14,stone);
  // Shallow segmental stone hood, with brick visible between hood and glazing.
  for(let j=0;j<16;j++){
   const t=Math.PI-j*Math.PI/16,s=Math.PI-(j+1)*Math.PI/16,r=w/2+.16;
   const x=u+r*Math.cos(t),X=u+r*Math.cos(s),Y=y+H/2+.08+.22*Math.sin(t),Z=y+H/2+.08+.22*Math.sin(s);
   batch.quad(at(x,.07,Y),at(X,.07,Z),at(X,.07,Z+.11),at(x,.07,Y+.11),stone);
  }
 };
 polygon(batch,p,()=>base-.15,stone);polygon(batch,[...p].reverse(),()=>base+eaves,'#4f5758');
 const edges=p.slice(1).map((q,i)=>[p[i],q]).filter(([a,b])=>Math.abs(local(a)[1])>=.08||Math.abs(local(b)[1])>=.08);edges.push([end,a]);
 for(const edge of edges){
  const A=local(edge[0]),B=local(edge[1]),L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<.03)continue;
  const gallery=Math.abs(A[1])<.08&&Math.abs(B[1])<.08&&L>5;
  if(gallery){
   const lo=Math.min(A[0],B[0]),hi=Math.max(A[0],B[0]),count=(2*Math.round((L/3.7-1)/2)+1),pitch=(hi-lo)/count;
   for(let j=0;j<count;j++){
    const mid=lo+(j+.5)*pitch,r=(pitch-.45)/2,spring=2.75,rise=.85;
    // Closed spandrel and intrados, not a dark arch pasted over a wall.
    for(let k=0;k<12;k++){
     const t=Math.PI-k*Math.PI/12,Tt=Math.PI-(k+1)*Math.PI/12;
     const l=mid+r*Math.cos(t),rgt=mid+r*Math.cos(Tt),yl=spring+rise*Math.sin(t),yr=spring+rise*Math.sin(Tt);
     batch.quad(at(l,0,yl),at(rgt,0,yr),at(rgt,0,eaves),at(l,0,eaves),brick);
     batch.quad(at(l,-.6,yl),at(l,0,yl),at(rgt,0,yr),at(rgt,-.6,yr),stone);
     batch.quad(at(rgt,-.6,yr),at(l,-.6,yl),at(l,-.6,eaves),at(rgt,-.6,eaves),brick);
    }
    for(const side of (j===0?[-1,1]:[1])){const u=mid+side*pitch/2;for(let k=0;k<10;k++){const t=k*Math.PI/5,S=(k+1)*Math.PI/5;batch.quad(at(u+.2*Math.cos(t),-.3+.2*Math.sin(t),.25),at(u+.2*Math.cos(S),-.3+.2*Math.sin(S),.25),at(u+.2*Math.cos(S),-.3+.2*Math.sin(S),2.65),at(u+.2*Math.cos(t),-.3+.2*Math.sin(t),2.65),stone);}box(u,-.3,.13,.48,.26,.58,stone);box(u,-.3,2.75,.62,.2,.72,stone);box(u,-.3,(2.8+eaves)/2,.45,eaves-2.8,.6,brick);}
    // Gallery back wall and inset tall windows/doors.
    batch.quad(at(mid-pitch/2,-3.5,0),at(mid+pitch/2,-3.5,0),at(mid+pitch/2,-3.5,eaves),at(mid-pitch/2,-3.5,eaves),brick);
    panel(mid,-3.48,1.85,1.5,3.2,dark);panel(mid,-3.47,1.85,.055,3.2,stone);
   }
  }else{
   batch.quad([edge[0][0],base-.15,edge[0][1]],[edge[1][0],base-.15,edge[1][1]],[edge[1][0],base+eaves,edge[1][1]],[edge[0][0],base+eaves,edge[0][1]],brick);
  }
  // Merlons sit inside the mapped wall edge; capstones provide small relief.
  const dx=(edge[1][0]-edge[0][0])/L,dz=(edge[1][1]-edge[0][1])/L,angle=-Math.atan2(dz,dx),N=Math.max(1,Math.round(L/1.45));
  for(let j=0;j<N;j++){const t=(j+.5)/N,x=edge[0][0]+dx*L*t-dz*.15,z=edge[0][1]+dz*L*t+dx*.15;addBox(batch,x,base+eaves+.32,z,.65,.64,.3,brick,angle);addBox(batch,x,base+eaves+.67,z,.75,.08,.38,stone,angle);}
 }
 // Clip the central tower to the original polygon, retaining its front line.
 function clip(poly,axis,bound,keepGreater){const out=[];for(let i=0;i<poly.length;i++){const A=poly[i],B=poly[(i+1)%poly.length],ina=keepGreater?A[axis]>=bound:A[axis]<=bound,inb=keepGreater?B[axis]>=bound:B[axis]<=bound;if(ina)out.push(A);if(ina!==inb){const t=(bound-A[axis])/(B[axis]-A[axis]);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t]);}}return out;}
 let tower=p.slice(0,-1).map(local);for(const [axis,bound,greater] of [[0,18.7,true],[0,24.2,false],[1,-7,true]])tower=clip(tower,axis,bound,greater);
 const towerTop=17.2,centralTop=10.0;
 let central=p.slice(0,-1).map(local);for(const [axis,bound,greater] of [[0,14,true],[0,29,false],[1,-9,true]])central=clip(central,axis,bound,greater);
 for(let i=0;i<central.length;i++){const A=central[i],B=central[(i+1)%central.length];batch.quad(at(...A,eaves),at(...B,eaves),at(...B,centralTop),at(...A,centralTop),brick);}
 const middle=central.map(q=>{const v=at(...q,0);return [v[0],v[2]];});middle.push(middle[0]);polygon(batch,middle,()=>base+centralTop,'#535b5d');
 for(const u of [16.3,21.45,26.7]){pairedWindow(u,7.7,2.3,2.3);box(u,0,6.5,2.6,.12,.12,stone);}
 for(const u of [16.3,21.45,26.7])windowTrim(u,7.7,2.3,2.3);
 // The heritage survey records two paired-window bays on each side of the
 // raised middle block. Locate them on its clipped OSM-derived side faces.
 for(let i=0;i<central.length;i++){
  const A=central[i],B=central[(i+1)%central.length];
  if(Math.abs(A[0]-B[0])>.01||Math.abs(A[1]-B[1])<5)continue;
  const u=A[0],out=u<21.5?-.02:.02,lo=Math.min(A[1],B[1]),hi=Math.max(A[1],B[1]);
  for(const fraction of [1/3,2/3]){
   const v=lo+(hi-lo)*fraction,w=1.8,H=2.3,y=7.7,r=(w-.14)/4,spring=y+H/2-r;
   const face=(q,h,depth=0)=>at(u+out+Math.sign(out)*depth,v+q,h);
   const pane=(q,h,width,hh,c,depth=0)=>windows.quad(face(q-width/2,h-hh/2,depth),face(q+width/2,h-hh/2,depth),face(q+width/2,h+hh/2,depth),face(q-width/2,h+hh/2,depth),c);
   for(const side of [-1,1]){const mid=side*(r+.035);pane(mid,(y-H/2+spring)/2,2*r,spring-y+H/2,dark);
    for(let k=0;k<12;k++){const t=k*Math.PI/12,Tt=(k+1)*Math.PI/12;windows.tri(face(mid,spring),face(mid+r*Math.cos(t),spring+r*Math.sin(t)),face(mid+r*Math.cos(Tt),spring+r*Math.sin(Tt)),dark);}
    pane(mid,y-.05,.045,H-.15,'#b5b8af',.008);pane(mid,y+.15,r*2,.04,'#b5b8af',.008);
    pane(side*(w/2+.1),y,.12,H+.2,stone,.012);
   }
   pane(0,y-H/2-.1,w+.32,.16,stone,.012);
  }
 }
 // Low crenellated parapets flank the tower on the two-storey middle block.
 for(const [lo,hi] of [[14,18.7],[24.2,29]]){
  box((lo+hi)/2,-.16,centralTop+.15,hi-lo,.3,.32,brick);
  for(let u=lo+.32;u<hi;u+=1.25){box(u,-.16,centralTop+.55,.6,.8,.32,brick);box(u,-.16,centralTop+.98,.72,.08,.42,stone);}
 }
 box(21.5,-.1,centralTop-.15,15,.15,.2,stone);
 for(let i=0;i<tower.length;i++){const A=tower[i],B=tower[(i+1)%tower.length];batch.quad(at(...A,centralTop),at(...B,centralTop),at(...B,towerTop),at(...A,towerTop),brick);}
 const ring=tower.map(q=>{const v=at(...q,0);return [v[0],v[2]];});ring.push(ring[0]);polygon(batch,ring,()=>base+towerTop,'#535b5d');
 for(let i=0;i<tower.length;i++){
  const A=tower[i],B=tower[(i+1)%tower.length],L=Math.hypot(B[0]-A[0],B[1]-A[1]),N=Math.max(2,Math.round(L/1.4));
  for(let j=0;j<N;j++){const t=(j+.5)/N,u=A[0]+(B[0]-A[0])*t,v=A[1]+(B[1]-A[1])*t;const angle=-Math.atan2((B[0]-A[0])*uz+(B[1]-A[1])*nz,(B[0]-A[0])*ux+(B[1]-A[1])*nx);addBox(batch,...at(u,v,towerTop+.32),.6,.64,.35,brick,angle);addBox(batch,...at(u,v,towerTop+.66),.7,.08,.42,stone,angle);}
 }
 for(const h of [11.7]){pairedWindow(21.45,h,2.4,2.05);}
 windowTrim(21.45,11.7,2.4,2.05);
 for(const y of [centralTop+.12,towerTop-.35])box(21.45,-.04,y,5.65,.14,.2,stone);
 for(const u of [18.78,24.12])box(u,-.035,(centralTop+towerTop)/2,.16,towerTop-centralTop,.13,brick);
 // Corbel course below the tower coping, kept attached to the facade.
 for(let u=18.95;u<24;u+=.55)box(u,.025,towerTop-.62,.18,.25,.16,stone);
 const clock=new T.Mesh(new T.CircleGeometry(.8,24),new T.MeshBasicMaterial({color:'#d9d9cf'}));clock.position.set(...at(21.45,.035,towerTop-2.5));clock.rotation.y=Math.atan2(nx,nz);scene.add(clock);
 const tickGeometry=new T.PlaneGeometry(.035,.105),tickMaterial=new T.MeshBasicMaterial({color:'#4b5557'});
 for(let j=0;j<12;j++){const t=j*Math.PI/6,tick=new T.Mesh(tickGeometry,tickMaterial);tick.position.set(Math.sin(t)*.67,Math.cos(t)*.67,.012);tick.rotation.z=-t;clock.add(tick);}
 const hands=[];for(const [w,H] of [[.055,.63],[.075,.43]]){const pivot=new T.Group(),needle=new T.Mesh(new T.PlaneGeometry(w,H),tickMaterial);needle.position.set(0,H/2,.02);pivot.add(needle);clock.add(pivot);hands.push(pivot);}
 (scene.userData.analogClocks??=[]).push({minute:hands[0],hour:hands[1]});
 return true;
}
