// Behavioural controls; missing sign directions are conservatively inferred
// from the nearest road axis, never treated as an authoritative turn restriction.
export function buildRoadControls(city){
  return (city.streetObject||[]).filter(f=>['stop','give_way'].includes(f.c)).map((f,id)=>{
    let best=Infinity,way=null,angle=0;
    for(const road of city.road){if(['footway','path','pedestrian','steps','cycleway'].includes(road.c))continue;
      for(let i=1;i<road.p.length;i++){const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)continue;
        const t=Math.max(0,Math.min(1,((f.p[0]-a[0])*dx+(f.p[1]-a[1])*dz)/l)),d=Math.hypot(f.p[0]-a[0]-t*dx,f.p[1]-a[1]-t*dz);
        if(d<best){best=d;way=road.id;angle=Math.atan2(dx,dz);}
      }
    }return {...f,id,way,angle};
  });
}
export function signFactor(agent,controls,others,dt){
  const fx=Math.sin(agent.a),fz=Math.cos(agent.a);let factor=1;
  agent.signStops??=new Map();agent.pendingStop=false;
  for(const sign of controls){
    const dx=sign.p[0]-agent.x,dz=sign.p[1]-agent.z,d=Math.hypot(dx,dz);
    if(d>35){agent.signStops.delete(sign.id);continue;}
    const ahead=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx);
    if(ahead<0||ahead>24||lateral>5||Math.abs(Math.cos(agent.a-sign.angle))<.7)continue;
    let state=agent.signStops.get(sign.id);if(!state){state={held:0,done:false};agent.signStops.set(sign.id,state);}
    const conflict=others.some(n=>{
      if(n===agent||Math.abs(n.y-agent.y)>1.7)return false;
      const x=sign.p[0]-n.x,z=sign.p[1]-n.z,forward=x*Math.sin(n.a)+z*Math.cos(n.a),side=Math.abs(x*Math.cos(n.a)-z*Math.sin(n.a));
      return Math.abs(Math.sin(n.a-agent.a))>.45&&((Math.hypot(x,z)<6)||((n.speed||0)>1&&forward>0&&forward<18&&side<5));
    });
    if(sign.c==='stop'&&!state.done){
      if(ahead<=4.6&&(agent.speed||0)<.25)state.held+=dt;
      if(state.held>=1.2)state.done=true;
      else {agent.pendingStop=true;factor=Math.min(factor,Math.max(0,Math.min(1,(ahead-4.4)/12)));}
    }
    if(conflict)factor=Math.min(factor,Math.max(0,Math.min(1,(ahead-4.4)/12)));
    else if(sign.c==='give_way'&&ahead>4.4)factor=Math.min(factor,.55);
  }return factor;
}
export function legalSpeed(road,mode){
  const raw=String(road?.maxspeed||road?.speed||''),limit=parseFloat(raw)*(raw.includes('mph')?.44704:1/3.6);
  const fallback=road?.c==='living_street'?20/3.6:road?.c==='service'?20/3.6:30/3.6;
  return Math.min(mode==='bike'?6:Infinity,Number.isFinite(limit)?limit:fallback);
}

// Anticipate intersecting vehicle paths before contact. Parallel lanes remain
// independent; arrival time wins, with a stable ID tie-break for equal arrivals.
export function junctionYield(agent,others){
 const ax=Math.sin(agent.a),az=Math.cos(agent.a);let factor=1;
 for(const b of others){
  if(b===agent||Math.abs((b.y||0)-(agent.y||0))>1.7)continue;
  const bx=Math.sin(b.a),bz=Math.cos(b.a),cross=ax*bz-az*bx;
  if(Math.abs(cross)<.3)continue;
  const dx=b.x-agent.x,dz=b.z-agent.z;
  const da=(dx*bz-dz*bx)/cross,db=(dx*az-dz*ax)/cross;
  if(da<0||da>20||db< -2.5||db>20)continue;
  const ta=da/Math.max(2,agent.speed||agent.rate||5),tb=db/Math.max(2,b.speed||b.rate||5);
  const otherFirst=db<3||tb<ta-.8||(Math.abs(tb-ta)<=.8&&b.id<agent.id);
  if(otherFirst)factor=Math.min(factor,Math.max(0,Math.min(1,(da-5)/10)));
 }
 return factor;
}
