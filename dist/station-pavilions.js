// Detached historic station pavilions: OSM footprints are authoritative.
// References: Inventaris Onroerend Erfgoed 255 and user May 2025 street views.
export const stationPavilionIds=new Set([956035091,956035575]);
export function buildStationPavilion({batch,windows,f,height,polygon,addBox}){
 if(!stationPavilionIds.has(f.id))return false;
 const p=f.p,points=p.slice(0,-1),cx=points.reduce((s,q)=>s+q[0],0)/points.length,cz=points.reduce((s,q)=>s+q[1],0)/points.length;
 const y=height(cx,cz),h=(Number.isFinite(f.dh)?f.dh:4.9)-.575,top=y+h,brick='#a85f49',stone='#898d89',glass='#354b51';
 const area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0),sign=area>0?1:-1;
 polygon(batch,p,()=>y-.12,stone);polygon(batch,[...p].reverse(),()=>top-.03,'#545b5b');
 for(let i=1;i<p.length;i++){
  const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=sign*uz,nz=-sign*ux,yaw=-Math.atan2(dz,dx);
  batch.quad([a[0],y-.12,a[1]],[b[0],y-.12,b[1]],[b[0],top,b[1]],[a[0],top,a[1]],brick);
  const at=(u,v,H)=>[a[0]+ux*u+nx*v,y+H,a[1]+uz*u+nz*v];
  const box=(u,v,H,w,hh,d,c)=>addBox(batch,...at(u,v,H),w,hh,d,c,yaw);
  box(L/2,0,.22,L,.44,.08,stone);
  // Thin surface details rather than projecting door/window boxes.
  const panel=(u,H,w,hh,c,depth=.012)=>{const q=[at(u-w/2,depth,H-hh/2),at(u+w/2,depth,H-hh/2),at(u+w/2,depth,H+hh/2),at(u-w/2,depth,H+hh/2)];windows.quad(...q,c);};
  const openingWidth=Math.min(1.35,L*.34),openingHeight=2.0,mid=L/2;
  // Two shallow enclosing brick niches include the rosette above the window.
  // Their relief stays only centimetres from the mapped wall plane.
  for(const [r,depth,c] of [[Math.min(L*.37,1.35),.018,'#97513e'],[Math.min(L*.32,1.17),.025,stone]]){
   const spring=Math.min(h-.65,3.62),rise=.2,thickness=.055;
   for(const side of [-1,1])box(mid+side*r,depth,(.5+spring)/2,thickness,spring-.5,.035,c);
   for(let j=0;j<16;j++){const t=j*Math.PI/16,T=(j+1)*Math.PI/16;
    batch.quad(at(mid+r*Math.cos(t),depth,spring+rise*Math.sin(t)),at(mid+r*Math.cos(T),depth,spring+rise*Math.sin(T)),at(mid+(r+thickness)*Math.cos(T),depth,spring+(rise+thickness)*Math.sin(T)),at(mid+(r+thickness)*Math.cos(t),depth,spring+(rise+thickness)*Math.sin(t)),c);
   }
  }
  panel(mid,1.85,openingWidth+.16,openingHeight+.14,stone,.014);
  panel(mid,1.85,openingWidth,openingHeight,glass,.02);
  for(const u of [-.25,.25])panel(mid+u,1.85,.035,openingHeight,'#cbd1c8',.025);
  for(const H of [1.15,1.85,2.55])panel(mid,H,openingWidth,.035,'#cbd1c8',.025);
  // The 2025 references show white crossed tracery in the upper window lights.
  const line=(u1,h1,u2,h2,c,width=.026)=>{
   const du=u2-u1,dh=h2-h1,L=Math.hypot(du,dh),ox=-dh/L*width/2,oy=du/L*width/2;
   windows.quad(at(u1+ox,.03,h1+oy),at(u2+ox,.03,h2+oy),at(u2-ox,.03,h2-oy),at(u1-ox,.03,h1-oy),c);
  };
  for(const offset of [-openingWidth/4,openingWidth/4]){
   const half=openingWidth/4-.035;
   line(mid+offset-half,2.56,mid+offset+half,2.82,'#cbd1c8');
   line(mid+offset+half,2.56,mid+offset-half,2.82,'#cbd1c8');
  }
  // Segmental stone drip mould and rosette, kept within the original facade.
  const radius=openingWidth*.6;
  for(let j=0;j<12;j++){const t=j/12*Math.PI,T=(j+1)/12*Math.PI;
   batch.quad(at(mid+Math.cos(t)*radius,.035,2.89+Math.sin(t)*.23),at(mid+Math.cos(T)*radius,.035,2.89+Math.sin(T)*.23),at(mid+Math.cos(T)*(radius+.065),.035,2.89+Math.sin(T)*.29),at(mid+Math.cos(t)*(radius+.065),.035,2.89+Math.sin(t)*.29),stone);
  }
  for(let j=0;j<12;j++){const t=j*Math.PI/6,T=(j+1)*Math.PI/6;windows.tri(at(mid, .03,3.35),at(mid+Math.cos(t)*.19,.03,3.35+Math.sin(t)*.19),at(mid+Math.cos(T)*.19,.03,3.35+Math.sin(T)*.19),'#a6aaa2');}
  for(let j=0;j<8;j++){const t=j*Math.PI/4;line(mid,3.35,mid+Math.cos(t)*.16,3.35+Math.sin(t)*.16,'#697575',.018);}
  // Crenellation height is included in the measured overall height.
  const count=Math.max(3,Math.round(L/.85));
  for(let j=0;j<count;j++){const u=(j+.5)*L/count;box(u,-.12,h+.26,.38,.52,.24,brick);box(u,-.12,h+.54,.46,.07,.3,stone);}
  for(let u=.3;u<L-.15;u+=.55)box(u,-.02,h-.35,.18,.22,.09,brick);
 }
 return true;
}
