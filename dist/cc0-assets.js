import {vehicleFleet} from './vehicle-access.js';
import * as T from './three.module.min.js';
import models from './cc0-models.js';
export const carPaints=['#e6e8e5','#b9bfc3','#727b83','#252a30','#304969','#882f32','#3d6458','#c0b4a0','#477b9c','#bd753d','#a7a9ad','#4c435c'];
const bodyPaint=(name,r,g,b)=>name==='sedan'?r>g*1.5&&g>r*.28:name==='van'?b>r*1.65&&b>g*1.4:g>r*1.45&&g>b*1.15;
const cache=new Map(),linear=n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;};
export function assetGeometry(name,group){
  const key=name+':'+group;
  if(cache.has(key))return cache.get(key);
  const data=models[name][group],geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(data.p,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(data.c.map(linear),3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  cache.set(key,geometry);return geometry;
}
const lampAnchorCache=new Map();
const material=new T.MeshLambertMaterial({vertexColors:true});
export function vehicleModel(name='sedan',tint){
  const root=new T.Group(),wheels=[];
  const geometry=new T.Group();root.add(geometry);
  const all=new T.Box3();
  for(const group of Object.keys(models[name])){
    const base=assetGeometry(name,group),mesh=new T.Mesh(base,material);mesh.receiveShadow=true;
    if(group.startsWith('wheel')&&/-(left|right)$/.test(group)){
      const pivot=base.boundingBox.getCenter(new T.Vector3()),wheel=new T.Group();
      wheel.position.copy(pivot);mesh.position.copy(pivot).negate();wheel.add(mesh);geometry.add(wheel);wheels.push(wheel);
    }else geometry.add(mesh);
    all.union(base.boundingBox);
  }
  const scale=1.83/(all.max.x-all.min.x);geometry.scale.setScalar(scale);
  geometry.position.set(-(all.min.x+all.max.x)*scale/2,-all.min.y*scale,-(all.min.z+all.max.z)*scale/2);
  // Read lamp locations from the original asset palette so every vehicle's
  // glow sits on its actual lenses, not on a generic bumper coordinate.
  let lampPoints=lampAnchorCache.get(name);
  if(!lampPoints){
  lampPoints={front:[],rear:[]};const rawBody=models[name].body;
  for(const kind of ['front','rear'])for(const side of [-1,1]){
    const bounds=new T.Box3();
    for(let i=0;i<rawBody.c.length;i+=3){
      const [r,g,b]=rawBody.c.slice(i,i+3),x=rawBody.p[i];
      const matches=kind==='front'?r===255&&g>150&&b<100:r>180&&g<80&&b<90;
      if(matches&&Math.sign(x)===side)bounds.expandByPoint(new T.Vector3(...rawBody.p.slice(i,i+3)));
    }
    if(!bounds.isEmpty()){const p=bounds.getCenter(new T.Vector3()).multiplyScalar(scale).add(geometry.position);p.z+=kind==='front'?.025:-.025;lampPoints[kind].push(p.toArray());}
  }
  lampAnchorCache.set(name,lampPoints);
  }
  root.userData.lampAnchors=lampPoints;
  // Keep the creator's palette, with a shared tint on the body only.
  if(tint){
    const body=geometry.children.find(o=>o.isMesh&&o.geometry===assetGeometry(name,'body'));
    if(body){
      const geo=body.geometry.clone(),colors=geo.getAttribute('color'),color=new T.Color(tint);
      for(let i=0;i<colors.count;i++){
        const r=colors.getX(i),g=colors.getY(i),b=colors.getZ(i);
        const raw=models[name].body.c;
        if(bodyPaint(name,raw[i*3],raw[i*3+1],raw[i*3+2])){const shade=Math.max(raw[i*3],raw[i*3+1],raw[i*3+2])/220;colors.setXYZ(i,color.r*shade,color.g*shade,color.b*shade);}
      }
      body.geometry=geo;
    }
  }
  return {g:root,wheels};
}
export function addAsset(batch,name,x,y,z,targetHeight,yaw=0){
  const groups=Object.keys(models[name]),bounds=new T.Box3();
  for(const group of groups)bounds.union(assetGeometry(name,group).boundingBox);
  const scale=targetHeight/(bounds.max.y-bounds.min.y),cs=Math.cos(yaw),sn=Math.sin(yaw);
  for(const group of groups){
    const geo=assetGeometry(name,group),p=geo.getAttribute('position'),c=geo.getAttribute('color');
    for(let i=0;i<p.count;i+=3){
      const tri=[];
      for(let j=i;j<i+3;j++){
        const a=p.getX(j)*scale,b=(p.getY(j)-bounds.min.y)*scale,d=p.getZ(j)*scale;
        tri.push([x+a*cs+d*sn,y+b,z-a*sn+d*cs]);
      }
      batch.tri(...tri,new T.Color().setRGB(c.getX(i),c.getY(i),c.getZ(i)));
    }
  }
}

// One shared, centred car mesh per model; instances are grouped spatially so
// distant parking lots can be culled without copying thousands of cars.
export function addParkedInstances(scene,cars){
 const grouped=new Map();
 for(const car of cars){const name=['sedan','sedan','hatchback-sports','suv','van'][Math.abs(car.id)%5],key=name+':'+Math.floor(car.x/96)+','+Math.floor(car.z/96);if(!grouped.has(key))grouped.set(key,{name,cars:[]});grouped.get(key).cars.push(car);}
 const geometries=new Map(),mat=new T.MeshLambertMaterial({vertexColors:true});
 mat.onBeforeCompile=shader=>{shader.vertexShader='attribute float bodyPaint;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',T.ShaderChunk.color_vertex.replace('vColor.xyz *= instanceColor;','vColor.xyz *= mix(vec3(1.0),instanceColor,bodyPaint);'));};
 mat.customProgramCacheKey=()=> 'parked-body-paint';
 for(const {name,cars:group} of grouped.values()){
  let geometry=geometries.get(name);
  if(!geometry){
   const groups=Object.keys(models[name]),bounds=new T.Box3();for(const g of groups)bounds.union(assetGeometry(name,g).boundingBox);
   const size=bounds.getSize(new T.Vector3()),centre=bounds.getCenter(new T.Vector3()),scale=Math.min(1.8/size.x,4.35/size.z,1.5/size.y),positions=[],colors=[],normals=[],paint=[];
   for(const g of groups){const base=assetGeometry(name,g),p=base.attributes.position,c=base.attributes.color,n=base.attributes.normal;for(let i=0;i<p.count;i++){
    positions.push((p.getX(i)-centre.x)*scale,(p.getY(i)-bounds.min.y)*scale,(p.getZ(i)-centre.z)*scale);const raw=models[name][g].c,isPaint=g==='body'&&bodyPaint(name,raw[i*3],raw[i*3+1],raw[i*3+2]),shade=Math.max(raw[i*3],raw[i*3+1],raw[i*3+2])/220;paint.push(isPaint?1:0);colors.push(...(isPaint?[shade,shade,shade]:[c.getX(i),c.getY(i),c.getZ(i)]));normals.push(n.getX(i),n.getY(i),n.getZ(i));
   }}
   geometry=new T.BufferGeometry();geometry.setAttribute('bodyPaint',new T.Float32BufferAttribute(paint,1));geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.set(name,geometry);
  }
  const mesh=new T.InstancedMesh(geometry,mat,group.length),matrix=new T.Matrix4();
  group.forEach((c,i)=>{matrix.makeRotationY(c.yaw);matrix.setPosition(c.x,c.y,c.z);const original=matrix.clone(),tint=carPaints[Math.floor((Math.sin(c.id*71.13)*43758.54%1+1)%1*carPaints.length)];mesh.setMatrixAt(i,original);mesh.setColorAt(i,new T.Color(tint));
   vehicleFleet.register({id:c.vehicleId||'parking/'+c.id,kind:'car',model:name,tint,x:c.x,y:c.y,z:c.z,a:c.yaw},hidden=>{mesh.setMatrixAt(i,hidden?new T.Matrix4().makeScale(0,0,0):original);mesh.instanceMatrix.needsUpdate=true;});
  });
  mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.staticCityBatch=true;mesh.userData.parkedVehicles=true;scene.add(mesh);
 }
}
