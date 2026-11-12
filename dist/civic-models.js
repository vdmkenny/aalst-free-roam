// Photo-based civic landmarks. Reference photographs are used for geometry only;
// no Street View imagery or copyrighted photographs are shipped as textures.
export const civicModelSources = {
  951638411: ['https://www.klimzaalbanzai.be/', 'Official logo: /onewebmedia/Banzai%20Logo%20cleanup3.png; retrieved 2026-11-11', 'User-supplied Pierre Corneliskaai frontage photographs, May 2025'],
  457963731: [
    'https://kaanarchitecten.com/work/utopia-library-and-academy-for-performing-arts',
    'https://kaanarchitecten.com/media/01-kaan-architecten-utopia-delfino-sisto-legnani-e-marco-cappelletti.jpg',
    'Street View: Esplanadestraat 38, May 2025; historic Pupillenschool wing'
  ],
  1155828993: ['Street View: Molenstraat 51, May 2025; glazed entrance facade'],
  438623395: ['Street View: Werf 2, May 2025; white chapel and segmental windows']
};
const mix=(a,b,t)=>a+(b-a)*t;
function inRing(x,z,p){
  let hit=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function facadeFrame(a,b,p){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(length<.025)return null;
  const ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
  const sign=inRing((a[0]+b[0])/2+nx*.08,(a[1]+b[1])/2+nz*.08,p)?-1:1;
  return {length,ux,uz,nx:nx*sign,nz:nz*sign,yaw:-Math.atan2(dz,dx),at:(u,d,h)=>[a[0]+ux*u+nx*sign*d,h,a[1]+uz*u+nz*sign*d]};
}
function shell(c,wallHeight,tint,roof='#65696a'){
  const {batch,f,height,center,polygon}=c,[x,z]=center(f.p),base=height(x,z);
  for(let i=1;i<f.p.length;i++){
    const a=f.p[i-1],b=f.p[i];
    batch.quad([a[0],Math.min(base,height(...a))-.18,a[1]],[b[0],Math.min(base,height(...b))-.18,b[1]],[b[0],base+wallHeight,b[1]],[a[0],base+wallHeight,a[1]],tint);
  }
  polygon(batch,f.p,()=>base+wallHeight,roof,Infinity,f.holes||[]);
  // An underside avoids open faces when a ground-level camera is below a threshold.
  polygon(batch,f.p,()=>Math.min(base,...f.p.map(p=>height(...p)))-.19,tint,Infinity,f.holes||[]);
  return base;
}
function framedRect(c,frame,u,bottom,width,h,depth=.13,frameColor='#454c4c',glassColor='#56717b'){
  const {batch,windows,addBox}=c;
  const glass=frame.at(u,depth,bottom+h/2);
  addBox(batch,...frame.at(u,depth-.02,bottom+h/2),width+.23,h+.21,.16,frameColor,frame.yaw);
  addBox(windows,...glass,width,h,.18,glassColor,frame.yaw);
  return glass;
}
function segmentOpening(batch,x,y,z,yaw,width,h,offset,tint){
  const p=(u,v)=>[x+Math.cos(yaw)*u+Math.sin(yaw)*offset,y+v,z-Math.sin(yaw)*u+Math.cos(yaw)*offset];
  const spring=h*.88;
  batch.quad(p(-width/2,0),p(width/2,0),p(width/2,spring),p(-width/2,spring),tint);
  for(let i=0;i<10;i++){
    const a=-1+2*i/10,b=-1+2*(i+1)/10;
    batch.tri(p(0,spring),p(a*width/2,spring+Math.sqrt(Math.max(0,1-a*a))*h*.12),p(b*width/2,spring+Math.sqrt(Math.max(0,1-b*b))*h*.12),tint);
  }
}
function utopia(c){
  const {batch,windows,scene,f,height,addBox,polygon,pitched,label}=c;
  const brick='#a06450',stone='#c5c0ac',dark='#383e3f',slate='#4e5559';
  // The 2013/14 DSM predates the new library. OSM's four floors and the
  // architect's facade photograph guide this building's reference height.
  const y=shell(c,14.25,brick,'#6f7471');
  const modern=facadeFrame(f.p[0],f.p[3],f.p);
  const aperture=(u,w,bottom,h,divisions=1)=>{
    framedRect(c,modern,u,y+bottom,w,h,.16,dark,'#65818b');
    for(let j=1;j<divisions;j++)addBox(batch,...modern.at(u-w/2+j*w/divisions,.31,y+bottom+h/2),.11,h+.10,.13,dark,modern.yaw);
    if(h>6){
      for(const up of [3.2,6.4,9.6])if(up<h-.4)addBox(batch,...modern.at(u,.32,y+bottom+up),w,.10,.14,dark,modern.yaw);
      // Recessed shelf silhouettes give large windows depth without a full interior.
      for(let j=0;j<Math.max(1,Math.floor(w/2.4));j++){
        const U=u-w*.38+j*2.25;
        addBox(batch,...modern.at(U,.275,y+bottom+2.0),.12,3.6,.14,'#b49b72',modern.yaw);
        for(const up of [.6,1.35,2.1,2.85])addBox(batch,...modern.at(U+.6,.28,y+bottom+up),1.25,.065,.15,'#b49b72',modern.yaw);
      }
    }
  };
  // Asymmetric openings follow the KAAN photograph of the modern south facade.
  aperture(4.0,5.6,.12,5.4,2);
  aperture(10.1,4.3,.8,7.8,2);
  aperture(18.2,6.8,.12,11.55,3);
  aperture(30.0,10.5,4.6,3.4,4);
  aperture(32.5,5.2,9.7,2.85,2);
  aperture(5.4,6.3,9.8,2.95,3);
  aperture(33.0,13.2,.12,2.25,4);
  aperture(46.7,6.1,.3,2.65,2);
  const name=modern.at(18.2,.35,y+3.2);label(scene,'UTOPIA',...name,modern.yaw,5.2);
  // West side of the modern brick block: a small number of large apertures.
  const west=facadeFrame(f.p[48],f.p[51],f.p);
  if(west){
    for(const [t,w,b,h] of [[.22,5.4,.45,7.0],[.64,6.4,4.1,5.7]]){
      framedRect(c,west,west.length*t,y+b,w,h,.15,dark,'#607b84');
      addBox(batch,...west.at(west.length*t,.31,y+b+h/2),.12,h,.13,dark,west.yaw);
    }
  }
  // Preserved historic northern school wing: red brick with pale stone
  // quoins, paired segmental windows and continuous horizontal bands.
  const north=facadeFrame([-287.92,-301.05],[-237.01,-297.30],f.p);
  for(const level of [.55,4.9,9.15,13.55])addBox(batch,...north.at(north.length/2,.10,y+level),north.length,.22,.22,stone,north.yaw);
  const bays=9;
  for(let bay=0;bay<bays;bay++){
    const u=(bay+.5)*north.length/bays;
    for(const base of [1.0,5.35,9.65]){
      for(const side of [-1,1]){
        const P=north.at(u+side*.91,.12,y+base),angle=north.yaw+(north.nx*Math.sin(north.yaw)+north.nz*Math.cos(north.yaw)<0?Math.PI:0);
        segmentOpening(batch,...P,angle,1.63,3.3,.015,stone);
        segmentOpening(windows,...P,angle,1.34,3.03,.085,'#526c78');
        addBox(batch,...north.at(u+side*.91,.27,y+base+1.42),.075,2.75,.12,stone,north.yaw);
      }
    }
    for(let h=1;h<13.4;h+=.65)addBox(batch,...north.at(bay*north.length/bays,.13,y+h),.46,.26,.25,stone,north.yaw);
  }
  const historicRoof=[[-288,-301.1],[-237,-297.35],[-237.8,-287.5],[-288.8,-291.1],[-288,-301.1]];
  pitched(batch,historicRoof,y+17.3,slate,y+14.25,brick);
  // Modern volume is fully enclosed; a parapet cap follows its real outline.
  for(const [a,b] of [[f.p[0],f.p[3]],[f.p[48],f.p[51]]]){
    const frame=facadeFrame(a,b,f.p);if(frame)addBox(batch,...frame.at(frame.length/2,0,y+14.32),frame.length,.18,.25,'#795b4f',frame.yaw);
  }
}
function footprintBox(c,x,y,z,w,h,d,tint,yaw){
  const {T,f,batch}=c,cs=Math.cos(yaw),sn=Math.sin(yaw);
  const local=p=>[(p[0]-x)*cs-(p[1]-z)*sn,(p[0]-x)*sn+(p[1]-z)*cs];
  const world=(p,Y)=>[x+p[0]*cs+p[1]*sn,Y,z-p[0]*sn+p[1]*cs];
  const ring=f.p.slice(0,-1).map(p=>new T.Vector2(...p));
  const holes=(f.holes||[]).map(r=>r.slice(0,-1).map(p=>new T.Vector2(...p))),all=[...ring,...holes.flat()];
  for(const ids of T.ShapeUtils.triangulateShape(ring,holes)){
    let poly=ids.map(i=>local([all[i].x,all[i].y]));
    for(const [axis,sign,limit] of [[0,1,-w/2],[0,-1,-w/2],[1,1,-d/2],[1,-1,-d/2]]){
      const next=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],A=a[axis]*sign-limit,B=b[axis]*sign-limit;
        if(A>=0)next.push(a);
        if((A>=0)!=(B>=0)){const t=A/(A-B);next.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      }
      poly=next;
    }
    if(poly.length<3)continue;
    for(let i=2;i<poly.length;i++){
      batch.tri(world(poly[0],y+h/2),world(poly[i-1],y+h/2),world(poly[i],y+h/2),tint);
      batch.tri(world(poly[i],y-h/2),world(poly[i-1],y-h/2),world(poly[0],y-h/2),tint);
    }
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];batch.quad(world(a,y-h/2),world(b,y-h/2),world(b,y+h/2),world(a,y+h/2),tint);}
  }
}
function deWerf(c){
  const {batch,windows,scene,f,height,center,addBox,polygon,label}=c;
  const wall='#928b7c',bronze='#71685a',steel='#3a4748',glass='#657f89';
  const y=shell(c,17.15,wall,'#676d6b');
  const frame=facadeFrame(f.p[0],f.p[3],f.p),width=frame.length;
  // Glazed Molenstraat facade, with narrow vertical bronze mullions.
  framedRect(c,frame,width*.5,y+3.25,width-.9,13.35,.23,steel,glass);
  const bays=Math.max(8,Math.round(width/2.0));
  for(let j=0;j<=bays;j++){
    const u=.45+(width-.9)*j/bays;
    addBox(batch,...frame.at(u,.40,y+10.0),.14,13.7,.20,bronze,frame.yaw);
    if(j%2===0)addBox(batch,...frame.at(u,.31,y+1.63),.19,3.26,.30,'#aaa598',frame.yaw);
  }
  for(const h of [3.2,6.65,10.1,13.55,16.65])addBox(batch,...frame.at(width/2,.40,y+h),width-.55,.15,.21,bronze,frame.yaw);
  // Recessed entrance glazing at pavement level.
  for(let j=0;j<7;j++)framedRect(c,frame,width*(j+.65)/7.9,y+.12,2.5,2.77,.19,'#8a8374','#527579');
  addBox(batch,...frame.at(width*.5,.55,y+3.10),width,.27,1.0,'#8e8a7d',frame.yaw);
  // The magenta W logo identifies the venue above the entry.
  const logoU=width*.78,logoY=y+14.7;
  const points=[[-1.5,1],[-.78,-1],[0,.55],[.78,-1],[1.5,1]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length*.13,ny=dx/length*.13;
    const P=(p,sign)=>frame.at(logoU+p[0]+nx*sign,.56,logoY+p[1]+ny*sign);
    batch.quad(P(a,1),P(b,1),P(b,-1),P(a,-1),'#c35d93');
  }
  label(scene,'DE WERF',...frame.at(width*.66,.62,y+2.8),frame.yaw,5.6);
  // The same glazed bays continue around the Onderwijsstraat corner.
  const side=facadeFrame(f.p[4],f.p[7],f.p);
  if(side){
    framedRect(c,side,side.length/2,y+3.25,side.length-.9,13.35,.23,steel,glass);
    const count=Math.max(8,Math.round(side.length/2));
    for(let j=0;j<=count;j++){
      const u=.45+(side.length-.9)*j/count;
      addBox(batch,...side.at(u,.40,y+10),.14,13.7,.20,bronze,side.yaw);
      if(j%2===0)addBox(batch,...side.at(u,.31,y+1.63),.19,3.26,.30,'#aaa598',side.yaw);
    }
    for(const h of [3.2,6.65,10.1,13.55,16.65])addBox(batch,...side.at(side.length/2,.40,y+h),side.length-.55,.15,.21,bronze,side.yaw);
    for(let j=0;j<Math.floor(side.length/3.4);j++)framedRect(c,side,1.7+j*3.4,y+.12,2.5,2.77,.19,'#8a8374','#527579');
  }
  // The fly tower is a separate rear volume; the high DSM return must not
  // become the height of the whole glass frontage.
  const rearHeight=Math.max(27.5,Math.min(33.5,Number(f.dh)||31.5));
  const u=17.0,v=24.8;
  const X=f.p[0][0]+frame.ux*u-frame.nx*v,Z=f.p[0][1]+frame.uz*u-frame.nz*v;
  footprintBox(c,X,y+(17.15+rearHeight)/2,Z,17.8,rearHeight-17.15,12.2,'#9a9385',frame.yaw);
  footprintBox(c,X,y+rearHeight+.13,Z,18.15,.26,12.55,'#686f6b',frame.yaw);
  // Vertical joints articulate the otherwise solid stage-house shell.
  for(const side of [-1,1])for(const q of [-6,-2,2,6]){
    const x=X+frame.ux*q+frame.nx*side*6.12,z=Z+frame.uz*q+frame.nz*side*6.12;
    addBox(batch,x,y+(17.15+rearHeight)/2,z,.075,rearHeight-17.15,.08,'#7d8077',frame.yaw);
  }
}
function werfChapel(c){
  const {batch,windows,scene,f,height,center,addBox,pitched,label}=c;
  const white='#d7d6c8',stone='#a2a79e',glass='#425f73',slate='#4c555b';
  const [x,z]=center(f.p),y=height(x,z);
  const total=Number.isFinite(Number(f.dh))?Math.max(9.8,Math.min(11.2,Number(f.dh))):10.64;
  const eaves=total-3.15;
  shell(c,eaves,white,slate);pitched(batch,f.p,y+total,slate,y+eaves,white);
  for(let i=1;i<f.p.length;i++){
    const edge=facadeFrame(f.p[i-1],f.p[i],f.p);if(!edge)continue;
    addBox(batch,...edge.at(edge.length/2,.045,y+.28),edge.length,.62,.16,stone,edge.yaw);
    addBox(batch,...edge.at(edge.length/2,.045,y+eaves-.13),edge.length,.22,.19,'#b7b9ae',edge.yaw);
    if(edge.length<7.5)continue;
    const count=Math.max(2,Math.round(edge.length/3.3));
    const outward=edge.nx*Math.sin(edge.yaw)+edge.nz*Math.cos(edge.yaw)>0?edge.yaw:edge.yaw+Math.PI;
    for(let j=0;j<count;j++){
      const u=(j+.5)*edge.length/count,P=edge.at(u,.11,y+3.15);
      segmentOpening(batch,...P,outward,1.72,3.66,.02,stone);
      segmentOpening(windows,...P,outward,1.40,3.34,.085,glass);
      for(const step of [-.43,0,.43])addBox(batch,...edge.at(u+step,.24,y+4.63),.043,2.88,.075,'#9a9e8c',edge.yaw);
      for(const h of [3.8,4.65,5.5,6.25])addBox(batch,...edge.at(u,.24,y+h),1.38,.038,.075,'#9a9e8c',edge.yaw);
      // Small pale devotional relief panels visible below the side windows.
      addBox(batch,...edge.at(u,.13,y+1.9),.45,.75,.10,'#c0bda5',edge.yaw);
      addBox(batch,...edge.at(u,.20,y+1.9),.055,.47,.045,'#8c8f7d',edge.yaw);
      addBox(batch,...edge.at(u,.20,y+1.98),.25,.055,.045,'#8c8f7d',edge.yaw);
    }
  }
  const doorX=43.28,doorZ=-198.72,angle=-Math.PI/2;
  segmentOpening(batch,doorX,y+.40,doorZ,angle,1.95,2.95,.10,stone);
  segmentOpening(windows,doorX,y+.43,doorZ,angle,1.52,2.59,.19,'#5b574d');
  segmentOpening(batch,doorX,y+4.15,doorZ,angle,1.40,2.60,.10,stone);
  segmentOpening(windows,doorX,y+4.25,doorZ,angle,1.12,2.36,.19,glass);
  addBox(batch,doorX-.25,y+5.32,doorZ,.09,2.14,.07,'#909b92',angle);
  for(let i=0;i<3;i++){
    const top=y+.45-i*.15;
    addBox(batch,42.93-i*.42,top-.10,doorZ,.48,.20,2.23,'#929a94');
  }
  // A small ridge cross rather than an invented tower.
  const ridge=[50.4,-200.15];
  addBox(batch,ridge[0],y+total+.35,ridge[1],.075,.84,.075,'#6f7468');
  addBox(batch,ridge[0],y+total+.51,ridge[1],.42,.075,.075,'#6f7468');
}
function banzai(c){
  const {windows,scene,f,addBox,label}=c;
  const batch=new c.batch.constructor(),facade={...c,batch};
  const y=shell(c,8.1,'#876b59','#555d5d');
  const face=facadeFrame(f.p[4],f.p[5],f.p),w=face.length;
  // Pierre Corneliskaai 10–12, supplied May 2025 frontage photographs.
  const box=(u,h,W,H,D,col,depth=.15)=>addBox(batch,...face.at(u,depth,y+h),W,H,D,col,face.yaw);
  box(w/2,4.05,w,8.1,.18,'#77817d');
  // Cut the brown cladding around the door and left entrance gate.
  const cladStart=w*.13,cladEnd=Math.min(w*.89,w*.92-2.15-.035);
  const doorLeft=w*.68-.66,doorRight=w*.68+.66;
  for(const [a,b] of [[cladStart,doorLeft],[doorRight,cladEnd]])
    if(b>a)box((a+b)/2,1.65,b-a,3.3,.22,'#705c4e',.27);
  box(w*.68,(2.48+3.3)/2,1.32,3.3-2.48,.22,'#705c4e',.27);
  for(let u=w*.13;u<w*.89;u+=.72){
    if(Math.abs(u-w*.68)<.69||u>cladEnd-.03)continue;
    box(u,1.65,.034,3.25,.04,'#494c47',.40);
  }
  for(const h of [4.25,4.88,6.95,7.58])box(w*.51,h,w*.76,.035,.045,'#424d4d',.29);
  for(const h of [3.6,6.0]){
    const count=13,start=w*.14,length=w*.74;
    for(let j=0;j<count;j++)framedRect(facade,face,start+(j+.5)*length/count,y+h,length/count-.10,h>5?.95:.85,.35,'#635e51','#829694');
  }
  // Reference gate sits below the glazing, beside the chamfer. Door skins
  // share the cladding plane; no projecting box intersects the window band.
  const panel=(u,bottom,W,H,col,depth=.405)=>{
    batch.quad(face.at(u-W/2,depth,y+bottom),face.at(u+W/2,depth,y+bottom),
      face.at(u+W/2,depth,y+bottom+H),face.at(u-W/2,depth,y+bottom+H),col);
  };
  const gateU=w*.92,gateWidth=Math.min(4.3,(w-gateU)*2-.12);
  panel(gateU,.04,gateWidth,3.29,'#a1a9a7');
  for(let h=.5;h<3.3;h+=.52)panel(gateU,h,gateWidth-.08,.018,'#727d7b',.407);
  // Second sectional gate is at the opposite (right-hand) end in the photo.
  const rightGateU=w*.065,rightGateWidth=w*.125;
  panel(rightGateU,.04,rightGateWidth,3.29,'#a1a9a7');
  for(let h=.5;h<3.3;h+=.52)panel(rightGateU,h,rightGateWidth-.08,.018,'#727d7b',.407);
  panel(w*.68,.03,1.25,2.41,'#454d4c');
  panel(w*.68,1.23,.95,.85,'#879b9c',.407);
  // The sign belongs to the existing chamfer, not an added facade volume.
  const chamfer=facadeFrame(f.p[5],f.p[6],f.p);
  batch.quad(chamfer.at(0,.015,y),chamfer.at(chamfer.length,.015,y),
    chamfer.at(chamfer.length,.015,y+8.1),chamfer.at(0,.015,y+8.1),'#77817d');
  const signYaw=chamfer.nx*Math.sin(chamfer.yaw)+chamfer.nz*Math.cos(chamfer.yaw)>0?chamfer.yaw:chamfer.yaw+Math.PI;
  const texture=new c.T.TextureLoader().load('./assets/brands/banzai.png',()=>scene.dispatchEvent({type:'asset-ready'}));
  texture.colorSpace=c.T.SRGBColorSpace;
  const signWidth=Math.min(3.1,chamfer.length*.83);
  const sign=new c.T.Mesh(new c.T.PlaneGeometry(signWidth,signWidth*951/1407),new c.T.MeshLambertMaterial({map:texture,side:c.T.DoubleSide}));
  sign.position.set(...chamfer.at(chamfer.length/2,.15,y+5.6));sign.rotation.y=signYaw;scene.add(sign);
  const apron=(u,d)=>{const p=face.at(u,d,0);return [p[0],c.height(p[0],p[2])+.045,p[2]];};
  batch.quad(apron(0,.02),apron(w,.02),apron(w,3.4),apron(0,3.4),'#919796');
  // Bicycle racks are supplied by the mapped OSM bicycle-parking feature.
  batch.mesh(scene).castShadow=true;
}
function waterTower(c){
  const {T,scene,f,height,center}=c,[x,z]=center(f.p),y=height(x,z);
  const root=new T.Group();root.position.set(x,y,z);scene.add(root);
  const white=new T.MeshLambertMaterial({color:'#d5d8d2'}),tank=new T.MeshLambertMaterial({color:'#b9b7a7'}),dark=new T.MeshLambertMaterial({color:'#363f42'}),cyan=new T.MeshLambertMaterial({color:'#489b9e'});
  const mesh=(geo,mat,X,Y,Z)=>{const m=new T.Mesh(geo,mat);m.position.set(X,Y,Z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
  const cylinder=(r,h,Y,mat,X=0,Z=0)=>mesh(new T.CylinderGeometry(r,r,h,24),mat,X,Y,Z);
  cylinder(8.15,.7,.35,cyan);cylinder(7.95,.45,.9,white);
  cylinder(2.65,33,17.4,white);
  for(let j=0;j<10;j++){const a=j*Math.PI*2/10;cylinder(.30,32.3,17.15,white,Math.cos(a)*6.85,Math.sin(a)*6.85);}
  cylinder(7.75,.65,33.2,white);cylinder(8.15,13.0,40.0,tank);cylinder(8.23,.42,46.72,dark);
  const night=new T.Group();root.add(night);night.visible=false;(scene.userData.nightObjects??=[]).push(night);
  const lightWhite=new T.MeshBasicMaterial({color:'#fff1d5'}),lightBlue=new T.MeshBasicMaterial({color:'#17d9ef'});
  const strip=(X,Y,Z,w,h,mat,angle=0)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,.045),mat);m.position.set(X,Y,Z);m.rotation.y=angle;night.add(m);};
  for(let j=0;j<10;j++){
    const a=j*Math.PI*2/10,X=Math.cos(a),Z=Math.sin(a);
    strip(X*7.17,17.4,Z*7.17,.075,31.4,lightWhite,Math.PI/2-a);
    for(const h of [4,9,14,19,24,29]){const m=mesh(new T.BoxGeometry(.75,1.65,.10),dark,X*2.66,h,Z*2.66);m.rotation.y=Math.PI/2-a;strip(X*2.73,h,Z*2.73,.60,1.48,lightBlue,Math.PI/2-a);}
    const win=mesh(new T.BoxGeometry(.70,1.9,.08),dark,X*8.16,43.8,Z*8.16);win.rotation.y=Math.PI/2-a;
  }
  for(let j=0;j<38;j++){const a=j*Math.PI*2/38,h=1.3+(j*7%11)*.27;strip(Math.cos(a)*8.25,46.7-h/2,Math.sin(a)*8.25,.11,h,j%3?lightWhite:lightBlue,Math.PI/2-a);}
  const ring=new T.Mesh(new T.TorusGeometry(7.8,.08,6,48),lightWhite);ring.rotation.x=Math.PI/2;ring.position.y=33.4;night.add(ring);
  for(const [X,Z,h] of [[-3,-2,3.6],[4,1,4.8],[0,4,2.6]]){cylinder(.055,h,47+h/2,dark,X,Z);mesh(new T.BoxGeometry(.25,.9,.18),white,X,47+h-.55,Z);}
}
export function buildCivicLandmark(context){
  const id=context.f.id;
  if(id===281837896){waterTower(context);return true;}
  if(id===951638411){banzai(context);return true;}
  if(id===457963731){utopia(context);return true;}
  if(id===1155828993){deWerf(context);return true;}
  if(id===438623395){werfChapel(context);return true;}
  return false;
}
