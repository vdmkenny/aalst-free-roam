// Persistent, height-aware simulation data. Never references renderer objects.
export class SolidCollisions {
  constructor(cellSize=24){this.cellSize=cellSize;this.cells=new Map();this.count=0;}
  addSegment(a,b,width,height,meta={}){
    if(height<=.18)return; // ordinary kerbs remain traversable
    const item={a,b,width,height,...meta},r=width/2;
    const key=v=>Math.floor(v/this.cellSize);
    for(let x=key(Math.min(a[0],b[0])-r);x<=key(Math.max(a[0],b[0])+r);x++)
      for(let z=key(Math.min(a[2],b[2])-r);z<=key(Math.max(a[2],b[2])+r);z++){
        const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(item);
      }
    this.count++;return item;
  }
  insertShape(item,bounds){
    item.bounds=bounds;
    for(let x=Math.floor(bounds[0]/this.cellSize);x<=Math.floor(bounds[2]/this.cellSize);x++)
      for(let z=Math.floor(bounds[1]/this.cellSize);z<=Math.floor(bounds[3]/this.cellSize);z++){
        const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(item);
      }
    this.count++;return item;
  }
  addBox(x,y,z,w,h,d,yaw=0){
    const cs=Math.cos(yaw),sn=Math.sin(yaw),rx=(Math.abs(cs)*w+Math.abs(sn)*d)/2,rz=(Math.abs(sn)*w+Math.abs(cs)*d)/2;
    return this.insertShape({box:true,x,y,z,w,h,d,cs,sn},[x-rx,z-rz,x+rx,z+rz]);
  }
  addTriangle(a,b,c){
    const p=[a.slice(),b.slice(),c.slice()];
    return this.insertShape({triangle:p,minY:Math.min(a[1],b[1],c[1]),maxY:Math.max(a[1],b[1],c[1])},
      [Math.min(a[0],b[0],c[0]),Math.min(a[2],b[2],c[2]),Math.max(a[0],b[0],c[0]),Math.max(a[2],b[2],c[2])]);
  }
  blocked(x,z,y,radius=.25,bodyHeight=1.7,ignoreVehicle=null){
    const key=v=>Math.floor(v/this.cellSize),seen=new Set();
    for(let i=key(x-radius);i<=key(x+radius);i++)for(let j=key(z-radius);j<=key(z+radius);j++){
      for(const s of this.cells.get(i+','+j)||[]){
        if(seen.has(s)||s.vehicle?.claimed||(ignoreVehicle&&s.vehicle===ignoreVehicle))continue;seen.add(s);
        if(s.bounds&&(x+radius<s.bounds[0]||z+radius<s.bounds[1]||x-radius>s.bounds[2]||z-radius>s.bounds[3]))continue;
        if(s.box){
          if(y+bodyHeight<=s.y-s.h/2+.04||y+.18>=s.y+s.h/2)continue;
          const dx=x-s.x,dz=z-s.z,u=dx*s.cs-dz*s.sn,v=dx*s.sn+dz*s.cs;
          if(Math.hypot(Math.max(0,Math.abs(u)-s.w/2),Math.max(0,Math.abs(v)-s.d/2))<radius)return true;
          continue;
        }
        if(s.triangle){
          if(y+bodyHeight<=s.minY+.04||y+.18>=s.maxY)continue;
          let poly=s.triangle;
          for(const [level,sign] of [[y+.18,1],[y+bodyHeight,-1]]){
            const out=[];
            for(let k=0;k<poly.length;k++){
              const a=poly[k],b=poly[(k+1)%poly.length],ain=(a[1]-level)*sign>=0,bin=(b[1]-level)*sign>=0;
              if(ain)out.push(a);
              if(ain!==bin){const t=(level-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,level,a[2]+(b[2]-a[2])*t]);}
            }
            poly=out;if(!poly.length)break;
          }
          let inside=false;
          for(let k=0;k<poly.length;k++){
            const a=poly[k],b=poly[(k+1)%poly.length],dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;
            const t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/l)):0;
            if(Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t)<radius)return true;
            if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
          }
          if(inside)return true;continue;
        }
        const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],len=dx*dx+dz*dz;
        const t=len?Math.max(0,Math.min(1,((x-s.a[0])*dx+(z-s.a[2])*dz)/len)):0;
        const bottom=s.a[1]+(s.b[1]-s.a[1])*t;
        if(y+bodyHeight<=bottom+.04||y>=bottom+s.height-.08)continue;
        if(Math.hypot(x-s.a[0]-dx*t,z-s.a[2]-dz*t)<radius+s.width/2)return true;
      }
    }
    return false;
  }
}
