import stationAccess from './station-access-data.js';
import {createDepartureFeed} from './station-departures.js';
export function createStationScreens({T,scene,city,height,platforms=[],solids}){
 const station=city.building.find(b=>b.id===1151964136);if(!station)return {update(){},dispose(){}};
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=600;
 const ctx=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const screenMaterial=new T.MeshBasicMaterial({map:texture,toneMapped:false}),caseMaterial=new T.MeshStandardMaterial({color:0x202b37,roughness:.75});
 const faceGeometry=new T.PlaneGeometry(2,1.17),caseGeometry=new T.BoxGeometry(2.1,1.27,.12),screens=[];
 // One board beside each mapped tunnel approach. Keep the casing and pole
 // outside the walking corridor; face arriving passengers on Statieplein.
 for(const [id,width] of [[206846964,3],[844221451,5]]){
  const route=stationAccess.find(f=>f.id===id);if(!route||route.p.length<2)continue;
  const [a,b]=route.p,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const nx=-dz/length,nz=dx/length,offset=width/2+1.3;
  const x=a[0]+nx*offset,z=a[1]+nz*offset,y=height(...a);
  const group=new T.Group();group.name=`station-tunnel-departures-${id}`;
  group.position.set(x,y+2.6,z);group.rotation.y=Math.atan2(-dx,-dz);
  group.add(new T.Mesh(caseGeometry,caseMaterial));
  const face=new T.Mesh(faceGeometry,screenMaterial);face.position.z=.066;group.add(face);
  const post=new T.Mesh(new T.BoxGeometry(.12,2.6,.12),caseMaterial);post.position.y=-1.3;group.add(post);
  scene.add(group);screens.push(group);solids?.addBox(x,y+1.3,z,.12,2.6,.12);
 }
 // Use a cross-section near the station access, safely inside each island.
 for(const f of platforms.filter(f=>f.ref&&f.cx>-500&&f.cx<0)){
  const x=-230,hits=[];for(let i=1;i<f.p.length;i++){const a=f.p[i-1],b=f.p[i];if((a[0]>x)!==(b[0]>x))hits.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}
  hits.sort((a,b)=>a-b);if(hits.length<2||hits[1]-hits[0]<3)continue;
  const z=(hits[0]+hits[1])/2,y=f.y(x,z),group=new T.Group();group.position.set(x,y+2.65,z);group.rotation.y=Math.atan2(f.ux,f.uz);
  const casing=new T.Mesh(caseGeometry,caseMaterial);group.add(casing);
  for(const side of [-1,1]){const face=new T.Mesh(faceGeometry,screenMaterial);face.position.z=side*.066;face.rotation.y=side<0?Math.PI:0;group.add(face);}
  const post=new T.Mesh(new T.BoxGeometry(.13,2.65,.13),caseMaterial);post.position.y=-1.325;group.add(post);scene.add(group);screens.push(group);solids?.addBox(x,y+1.325,z,.13,2.65,.13);
 }
 const timeFormat=new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit'});
 let lastState={status:'idle',rows:[],updated:0},lastPaint=-1;
 function paint(state){
  lastState=state;ctx.fillStyle='#10233e';ctx.fillRect(0,0,1024,600);ctx.fillStyle='#fff';ctx.font='bold 46px sans-serif';ctx.fillText('AALST • Vertrek',30,62);
  ctx.font='23px sans-serif';ctx.fillStyle='#bdcce0';ctx.fillText('Echte tijd • iRail',30,100);ctx.fillText(timeFormat.format(Date.now()),890,62);
  ctx.fillStyle='#2b4461';ctx.fillRect(22,118,980,42);ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText('Tijd',36,147);ctx.fillText('Bestemming',210,147);ctx.fillText('Spoor',895,147);
  const rows=state.rows.filter(r=>r.cancelled||r.time+r.delay*1000>Date.now()-60000).slice(0,6);
  for(let i=0;i<rows.length;i++){const r=rows[i],y=201+i*52;ctx.font='28px sans-serif';ctx.fillStyle=r.cancelled?'#ffbb84':'#fff';ctx.fillText(timeFormat.format(r.time),36,y);ctx.fillText(r.destination,210,y,650);ctx.fillText(r.platform,920,y);if(r.delay||r.cancelled){ctx.font='18px sans-serif';ctx.fillStyle='#ffcf78';ctx.fillText(r.cancelled?'AFGESCHAFT':`+${Math.ceil(r.delay/60)} min`,36,y+20);}}
  if(!rows.length){ctx.fillStyle='#fff';ctx.font='28px sans-serif';ctx.fillText(['unavailable','stale'].includes(state.status)?'Vertrekinfo niet beschikbaar':state.status==='live'?'Geen vertrekken gemeld':'Vertrekinfo laden…',36,230);}
  ctx.font='22px sans-serif';ctx.fillStyle=state.status==='stale'?'#ffcf78':'#bdcce0';
  ctx.fillText(state.status==='stale'?'Verbinding verbroken — gegevens mogelijk verouderd':state.updated?`Bijgewerkt ${timeFormat.format(state.updated)} • irail.be`:'Live vertrekinfo via iRail',30,573);
  texture.needsUpdate=true;scene.dispatchEvent({type:'asset-ready'});
 }
 let storage;try{storage=localStorage;}catch{}
 const feed=createDepartureFeed({storage,onChange:paint});feed.subscribe();
 return {screens,update(camera){const active=!document.hidden&&screens.some(s=>Math.hypot(camera.x-s.position.x,camera.z-s.position.z)<350);if(!active)return;feed.update();const minute=Math.floor(Date.now()/60000);if(minute!==lastPaint){lastPaint=minute;paint(lastState);}},dispose(){feed.dispose();}};
}
