// Distant light cues are instanced, while only nearby vehicles get real spots.
export function createNightLighting(T,scene,surface){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
 const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);
 gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.35,'rgba(255,255,255,.45)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const texture=new T.CanvasTexture(canvas),matrix=new T.Object3D();
 function material(color,opacity,map=null){return new T.MeshBasicMaterial({color,opacity,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,map,toneMapped:false});}
 const cone=new T.ConeGeometry(1,1,12,1,true);cone.translate(0,-.5,0);cone.rotateX(-Math.PI/2);
 const beamMaterial=material('#fff0bf',.035);
 beamMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying float beamReach;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbeamReach=position.z;');
  shader.fragmentShader='varying float beamReach;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= pow(1.0-clamp(beamReach,0.0,1.0),2.0);');
 };
 beamMaterial.customProgramCacheKey=()=> 'soft-vehicle-beam';
 const beams=new T.InstancedMesh(cone,beamMaterial,2400);
 const heads=new T.InstancedMesh(new T.SphereGeometry(1,6,4),material('#fff3d4',1),2400);
 const tails=new T.InstancedMesh(new T.SphereGeometry(1,6,4),material('#ff2115',1),2400);
 const rearGlow=new T.InstancedMesh(new T.PlaneGeometry(1,1),material('#ff180a',.3,texture),1200);
 const pools=new T.InstancedMesh(new T.PlaneGeometry(1,1),material('#ffe1a1',.34,texture),12000);
 for(const m of [beams,heads,tails,rearGlow,pools]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(m);}
 const color=new T.Color();
 function put(mesh,i,x,y,z,yaw,sx,sy,sz,fade,flat=false){
  matrix.position.set(x,y,z);matrix.rotation.set(flat?-Math.PI/2:0,yaw,0);matrix.scale.set(sx,sy,sz);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);color.setRGB(fade,fade,fade);mesh.setColorAt(i,color);
 }
 const spots=Array.from({length:2},()=>{const light=new T.SpotLight('#fff0c9',0,34,.38,.65,2);light.castShadow=false;scene.add(light,light.target);return {light,actor:null};});
 const poolGround=new WeakMap();
 const bicycleAnchors={front:[[0,.86,.73]],rear:[[0,.7,-.74]]};
 let lastPools=-1;
 return {update(night,dt,time,camera,actors,lamps){
  for(const m of [beams,heads,tails,rearGlow,pools])m.visible=night;
  if(!night){for(const slot of spots)slot.light.intensity=0;return;}
  let h=0,b=0,r=0;const near=[];
  for(const actor of actors){
   const g=actor.g;if(!g?.visible)continue;
   const {x,y,z}=g.position,yaw=g.rotation.y,d=Math.hypot(x-camera.x,z-camera.z);
   if(d>420)continue;const fade=Math.min(1,Math.max(0,(420-d)/140));
   const bike=actor.bike,sin=Math.sin(yaw),cos=Math.cos(yaw);
   const anchors=bike?bicycleAnchors:g.userData.lampAnchors;
   if(!anchors)continue;
   for(let i=0;i<anchors.front.length;i++){
    const [side,lampY,front]=anchors.front[i],rear=anchors.rear[i]??anchors.rear[0];
    const X=x+sin*front+cos*side,Z=z+cos*front-sin*side;
    put(heads,h,X,y+lampY,Z,yaw,bike?.045:.09,.06,.04,fade);
    if(rear)put(tails,h,x+sin*rear[2]+cos*rear[0],y+rear[1],z+cos*rear[2]-sin*rear[0],yaw,bike?.035:.09,.055,.035,fade);h++;
    put(beams,b++,X,y+lampY,Z,yaw,bike?1.5:2.2,bike?1.1:1.4,bike?12:20,fade);
   }
   const back=anchors.rear[0]?.[2]??-1.6;
   put(rearGlow,r++,x+sin*(back-.4),y+.035,z+cos*(back-.4),0,bike?.65:1.9,1.2,1,fade,true);
   if(d<70)near.push({actor,d});
  }
  for(const [m,n] of [[heads,h],[tails,h],[beams,b],[rearGlow,r]]){m.count=n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  near.sort((a,b)=>a.d-b.d);const selected=near.slice(0,spots.length).map(v=>v.actor);
  for(const slot of spots){
   const retained=selected.includes(slot.actor),target=retained?1:0;
   slot.light.intensity+=(target*(slot.actor?.bike?18:65)-slot.light.intensity)*Math.min(1,dt*5);
   if(!retained&&slot.light.intensity<.1){slot.actor=selected.find(a=>!spots.some(s=>s.actor===a))??null;}
   if(slot.actor){const g=slot.actor.g,a=g.rotation.y,s=Math.sin(a),c=Math.cos(a),p=g.position;slot.light.position.set(p.x+s,p.y+.8,p.z+c);slot.light.target.position.set(p.x+s*16,p.y-.1,p.z+c*16);}
  }
  // Broad pools remain visible beyond the small real-light pool. Distance
  // fading avoids the visible nearest-N boundary without extra GPU lights.
  if(time-lastPools>.10){lastPools=time;let n=0;
   for(const lamp of lamps){const [x,y,z]=lamp;const d=Math.hypot(x-camera.x,z-camera.z);if(d>1100||n>=12000)continue;
    let ground=poolGround.get(lamp);if(ground===undefined){ground=surface(x,z);poolGround.set(lamp,ground);}
    const size=Math.max(4,Math.min(16,(y-ground)*2.2));
    put(pools,n++,x,ground+.07,z,0,size,size,1,(()=>{const t=Math.min(1,Math.max(0,(1100-d)/500));return t*t*(3-2*t);})(),true);
   }
   pools.count=n;pools.instanceMatrix.needsUpdate=true;if(pools.instanceColor)pools.instanceColor.needsUpdate=true;
  }
 }};
}
