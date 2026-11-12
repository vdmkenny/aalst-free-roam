import model from './traffic-light-model.js';
// Same CC0 Kenney pack as the stop sign. Keep the hooded circular lenses,
// but use dark housings and striped poles familiar on Belgian approaches.
export function paintTrafficLight(batch,signals,x,y,z,yaw=0,height=3.05){
 const data=model['traffic-light'],scale=height/.515,a=yaw+Math.PI/2,cs=Math.cos(a),sn=Math.sin(a);
 const transform=(v)=>[x+scale*(v[0]*cs+v[2]*sn),y+scale*v[1],z+scale*(-v[0]*sn+v[2]*cs)];
 const levels=[.477625,.4365625,.3955],dark=['#452723','#494126','#203c2e'];
 for(let i=0;i<data.p.length;i+=9){
  const v=[data.p.slice(i,i+3),data.p.slice(i+3,i+6),data.p.slice(i+6,i+9)],cy=v.reduce((s,p)=>s+p[1],0)/3,cz=v.reduce((s,p)=>s+p[2],0)/3;
  const lens=v.every(p=>Math.abs(p[0]+.05)<.000001)?levels.findIndex(h=>Math.hypot(cy-h,cz)<.016):-1;
  const tri=v.map(transform);
  if(lens>=0){batch.tri(...tri,dark[lens]);signals[lens].tri(...tri.map(p=>[p[0]+Math.sin(yaw)*.001,p[1],p[2]+Math.cos(yaw)*.001]),'#ffffff');}
  else batch.tri(...tri,cy<.1?'#51575b':cy<.35?(Math.floor(cy*scale/.3)%2?'#e4c85a':'#303536'):'#292e30');
 }
}
