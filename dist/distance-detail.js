// Fade static detail on the GPU before its CPU visibility cutoff. The one-byte
// per-vertex flag keeps shared materials and animated material references intact.
export function prepareDistanceDetail(T,mesh,detailClass){
  mesh.geometry.setAttribute('cityLandmark',new T.BufferAttribute(new Uint8Array(mesh.geometry.attributes.position.count).fill(Number(detailClass)),1));
  const material=mesh.material;
  if(material.userData.cityDistanceFade)return;
  material.userData.cityDistanceFade=true;
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
  const key=previousKey();
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.vertexShader='attribute float cityLandmark;\nvarying float vCityLandmark;\nvarying vec3 vCityPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec4 cityPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      cityPosition=instanceMatrix*cityPosition;
      #endif
      vCityPosition=(modelMatrix*cityPosition).xyz;
      vCityLandmark=cityLandmark;`);
    shader.fragmentShader='varying float vCityLandmark;\nvarying vec3 vCityPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float cityEnd=vCityLandmark>2.5?450.0:vCityLandmark>1.5?950.0:mix(850.0,1800.0,vCityLandmark);
      float cityDistance=length(vCityPosition.xz-cameraPosition.xz);
      float cityCoverage=1.0-smoothstep(cityEnd-(vCityLandmark>1.5?100.0:200.0),cityEnd,cityDistance);
      // Stable ordered coverage, without transparent sorting or extra draws.
      vec2 cityPixel=mod(floor(gl_FragCoord.xy),4.0);
      float cityThreshold=mod(cityPixel.x*2.0+cityPixel.y*3.0,4.0)*4.0+mod(cityPixel.x+cityPixel.y*2.0,4.0);
      if(cityCoverage<(cityThreshold+0.5)/16.0)discard;`);
  };
  material.customProgramCacheKey=()=>key+'|city-distance-v1';
  material.needsUpdate=true;
}
