// Release shared GPU resources once when a document is actually being discarded.
export function disposeScene(scene,renderer){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 scene.traverse(object=>{
  if(object.isInstancedMesh)object.dispose?.();
  if(object.geometry)geometries.add(object.geometry);
  for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
   materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
   for(const uniform of Object.values(material.uniforms||{}))if(uniform?.value?.isTexture)textures.add(uniform.value);
  }
 });
 for(const value of [scene.background,scene.environment])if(value?.isTexture)textures.add(value);
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
 for(const texture of textures)texture.dispose();
 renderer.dispose();renderer.forceContextLoss();
}
