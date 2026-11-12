// Persistent simulation identities survive visual streaming; renderer bindings do not own vehicles.
export class VehicleFleet {
 constructor(){this.records=new Map();this.active=null;this.claimed=new Set();}
 register(data,hide){let v=this.records.get(data.id);if(!v){v={claimed:false,occupied:false,...data};this.records.set(v.id,v);}if(hide){for(const k of ['model','tint'])if(data[k]!==undefined)v[k]=data[k];v.hide=hide;hide(v.claimed);}return v;}
 nearest(p,max=3.2,reachable=()=>true){let found=null,d=max;for(const v of this.records.values()){if(v.occupied||Math.abs(v.y-p.y)>1.3)continue;const n=Math.hypot(v.x-p.x,v.z-p.z);if(n<d&&reachable(v)){found=v;d=n;}}return found;}
 enter(v){if(this.active||!v||v.occupied)return false;v.occupied=true;v.claimed=true;this.claimed.add(v);v.hide?.(true);this.active=v;return true;}
 leave(p){if(!this.active)return null;const v=this.active;Object.assign(v,p,{occupied:false});this.active=null;return v;}
}
export const vehicleFleet=new VehicleFleet();
// +Z is forward; driver-left is local -X. Try it before every alternative.
export function safeVehicleExit(v,clear,ground){
 const lateral=v.kind==='bike'?.9:1.65;
 const options=[];for(const side of [-1,1])for(const along of [0,-.75,.75])for(const out of [lateral,lateral+.45])options.push([side*out,along]);
 for(const along of [-2.8,2.8])options.push([0,along]);
 for(const [side,along] of options){const x=v.x+Math.cos(v.a)*side+Math.sin(v.a)*along,z=v.z-Math.sin(v.a)*side+Math.cos(v.a)*along,y=ground(x,z,v.y);if(!Number.isFinite(y)||Math.abs(y-v.y)> .65)continue;if(clear(x,z,y,.55))return {x,z,y,a:v.a};}return null;
}
