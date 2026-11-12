// Same 24 m cell coverage as the world Hash, with bucket storage reused each frame.
// Only moving actors belong here; callers must clear before reinserting them.
export class ActorGrid {
  constructor(){this.cells=new Map();this.active=[];this.empty=Object.freeze([]);}
  clear(){for(const bucket of this.active)bucket.length=0;this.active.length=0;}
  insert(item,x1,z1,x2,z2){
    for(let x=Math.floor(x1/24);x<=Math.floor(x2/24);x++)for(let z=Math.floor(z1/24);z<=Math.floor(z2/24);z++){
      const key=x+','+z;let bucket=this.cells.get(key);
      if(!bucket){bucket=[];this.cells.set(key,bucket);}
      if(!bucket.length)this.active.push(bucket);
      bucket.push(item);
    }
  }
  get(x,z){return this.cells.get(Math.floor(x/24)+','+Math.floor(z/24))||this.empty;}
}
