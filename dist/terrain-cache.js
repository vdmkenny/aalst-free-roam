// Local static geometry only. No players, traffic or live/network state.
// Conservative world-generation dependencies; gameplay/UI edits do not change
// terrain. ETags are content hashes supplied by the preview server.
export const terrainDependencies=['world.js','station-access.js','station-access-data.js','rail-platforms.js','rail-platform-data.js','city.js','railway-finish.js','treinstraat-masonry.js','rail-underpasses.js','civic-models.js','cc0-assets.js','three.module.min.js','terrain-cache.js'];
export async function terrainCacheVersion(fetchAsset=fetch){
  const tags=await Promise.all(terrainDependencies.map(async name=>{
    const response=await fetchAsset(new URL(name,import.meta.url),{method:'HEAD',cache:'no-cache'});
    const tag=response.headers.get('ETag');
    if(!response.ok||!tag)throw new Error('Terrain dependency cannot be validated');
    return name+':'+tag;
  }));
  return 'terrain-v2:'+tags.join('|');
}
export async function openTerrainCache(box){
  if(typeof indexedDB==='undefined'||typeof location==='undefined')return null;
  try{
    const version=await terrainCacheVersion();
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('oilsjt-static-terrain',1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('chunks');r.result.createObjectStore('meta');};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    const read=(store,key)=>new Promise(resolve=>{const t=db.transaction(store),r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});
    if(await read('meta','version')!==version)await new Promise((resolve,reject)=>{
      const t=db.transaction(['chunks','meta'],'readwrite');t.objectStore('chunks').clear();t.objectStore('meta').put(version,'version');t.oncomplete=resolve;t.onerror=()=>reject(t.error);
    });
    const loaded=new Map();let enabled=true;
    const key=(x,z)=>version+':'+x+','+z;
    const get=(x,z)=>read('chunks',key(x,z));
    const jobs=[];
    for(let z=Math.floor((box[1]-80)/240)*240;z<box[3]+80;z+=240)
      for(let x=Math.floor((box[0]-80)/240)*240;x<box[2]+80;x+=240){
        const d=Math.hypot(Math.max(x+239,0,-239-x-240),Math.max(z-3,0,3-z-240));
        if(d<1000)jobs.push(get(x,z).then(value=>{if(value)loaded.set(x+','+z,value);}));
      }
    await Promise.all(jobs);
    return {loaded,get,
      put(x,z,meshes){if(!enabled)return;
        const data=meshes.map(m=>({position:m.geometry.attributes.position.array,normal:m.geometry.attributes.normal.array,color:m.geometry.attributes.color.array}));
        try{const t=db.transaction('chunks','readwrite');t.objectStore('chunks').put(data,key(x,z));t.onerror=()=>{enabled=false;};}catch{enabled=false;}
      }
    };
  }catch{return null;}
}
