// Closed trim solids attached to the verified railway masonry shell.
export function finishRailway({T,scene,Batch,addBox,dressMasonry,data}){
  const stone=new Batch(),iron=new Batch(),brick=new Batch();let solids=0;
  const {nodes,arches,sample}=data,length=nodes.at(-1).s;
  const at=(s,y,offset=0,rear=false)=>{const n=sample(s),dx=n.back[0]-n.p[0],dz=n.back[1]-n.p[1],L=Math.hypot(dx,dz);return rear?[n.back[0]+dx/L*offset,y,n.back[1]+dz/L*offset]:[n.p[0]-dx/L*offset,y,n.p[1]-dz/L*offset];};
  // Polygon is in developed wall coordinates [distance, elevation].
  const prism=(batch,poly,front,back,tint,rear=false)=>{
    poly=poly.filter((p,i)=>!i||Math.hypot(p[0]-poly[i-1][0],p[1]-poly[i-1][1])>1e-7);
    const a=poly.map(p=>at(p[0],p[1],front,rear)),b=poly.map(p=>at(p[0],p[1],back,rear));
    const triangles=T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(...p)),[]);
    for(const ids of triangles){batch.tri(...ids.map(i=>a[i]),tint);batch.tri(...ids.toReversed().map(i=>b[i]),tint);}
    for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;batch.quad(a[i],b[i],b[j],a[j],tint);}solids++;
  };
  const band=(s0,s1,y0,y1,h,front,back,batch,tint,rear=false)=>prism(batch,[[s0,y0],[s1,y1],[s1,y1+h],[s0,y0+h]],front,back,tint,rear);
  // Continuous stone coping and iron railings follow the curved plan.
  const breaks=[...new Set([0,length,...nodes.map(n=>n.s),...Array.from({length:Math.floor(length/1.5)},(_,i)=>(i+1)*1.5)])].sort((a,b)=>a-b);
  for(let i=1;i<breaks.length;i++){
    const a=breaks[i-1],b=breaks[i],A=sample(a),B=sample(b);
    band(a,b,A.top+.015,B.top+.015,.15,.10,-.34,stone,'#999585');
    for(const h of [.49,.92])band(a,b,A.top+h,B.top+h,.045,-.04,-.095,iron,'#454f49');
  }
  for(let s=.3;s<length;s+=2.2){const n=sample(s),p=at(s,n.top+.63,-.07);addBox(iron,p[0],p[1],p[2],.065,1.06,.065,'#454f49');solids++;}
  const rearStart=nodes[arches.at(-1).nodeA].s;
  for(let s=rearStart;s<length;s+=1.2){const end=Math.min(length,s+1.2),a=sample(s),b=sample(end);
    band(s,end,a.top+.015,b.top+.015,.15,.10,-.34,stone,'#999585',true);
    for(const h of [.49,.92])band(s,end,a.top+h,b.top+h,.045,-.04,-.095,iron,'#454f49',true);
  }
  for(let s=rearStart;s<length;s+=2.2){const n=sample(s),p=at(s,n.top+.63,-.07,true);addBox(iron,p[0],p[1],p[2],.065,1.06,.065,'#454f49');solids++;}
  const openingY=(a,s)=>{const t=(s-a.a)/(a.b-a.a),spring=Math.min(a.base+2,a.top-1.65);return spring+(a.top-.65-spring)*Math.sqrt(Math.max(0,1-(2*t-1)**2));};
  for(const arch of arches)for(const rear of [false,true]){
    for(let i=0;i<40;i++){
      const a=arch.a+(arch.b-arch.a)*i/40,b=arch.a+(arch.b-arch.a)*(i+1)/40;
      band(a,b,openingY(arch,a),openingY(arch,b),.23,.12,-.035,stone,i%5===0?'#a29b89':'#918d7e',rear);
    }
    // Stone jamb faces stay within the masonry; never reduce clear road width.
    for(const side of [-1,1]){const s=side<0?arch.a:arch.b,lo=side<0?s-.26:s,hi=side<0?s:s+.26;
      band(lo,hi,arch.base,arch.base,Math.min(2,arch.top-arch.base-1.65),.12,-.035,stone,'#8d897b',rear);
    }
  }
  // Blind arches: solid brick infill with closed, projecting stone edging.
  const blind=(centre,radius,base,rise,spring)=>{
    const outline=[[centre-radius,base],[centre-radius,base+spring]];
    for(let i=0;i<=24;i++){const t=Math.PI-i*Math.PI/24;outline.push([centre+Math.cos(t)*radius,base+spring+Math.sin(t)*rise]);}
    outline.push([centre+radius,base]);prism(brick,outline,.035,-.035,'#695346');
    for(let i=0;i<24;i++){
      const t=Math.PI-i*Math.PI/24,u=Math.PI-(i+1)*Math.PI/24;
      prism(stone,[[centre+Math.cos(t)*radius,base+spring+Math.sin(t)*rise],[centre+Math.cos(u)*radius,base+spring+Math.sin(u)*rise],[centre+Math.cos(u)*(radius+.22),base+spring+Math.sin(u)*(rise+.22)],[centre+Math.cos(t)*(radius+.22),base+spring+Math.sin(t)*(rise+.22)]],.12,-.04,'#99927f');
    }
    for(const side of [-1,1]){const s=centre+side*radius;band(Math.min(s,s+side*.22),Math.max(s,s+side*.22),base,base,spring,.12,-.04,stone,'#99927f');}
  };
  // Former passage behind the kiosk: same full-height portal profile, bricked shut.
  const left=arches[0].b+.38,right=arches[1].a-.38,mid=(left+right)/2,n=sample(mid);
  const closed={a:left+.38,b:right-.38,base:n.base,top:n.top};
  const infill=[[closed.a,closed.base],[closed.a,openingY(closed,closed.a)]];
  for(let i=1;i<=40;i++){const s=closed.a+(closed.b-closed.a)*i/40;infill.push([s,openingY(closed,s)]);}
  infill.push([closed.b,closed.base]);prism(brick,infill,.035,-.035,'#80594b');
  for(let i=0;i<40;i++){
    const a=closed.a+(closed.b-closed.a)*i/40,b=closed.a+(closed.b-closed.a)*(i+1)/40;
    band(a,b,openingY(closed,a),openingY(closed,b),.23,.12,-.035,stone,i%5===0?'#a29b89':'#918d7e');
  }
  for(const side of [-1,1]){const s=side<0?closed.a:closed.b;band(side<0?s-.26:s,side<0?s:s+.26,closed.base,closed.base,Math.min(2,closed.top-closed.base-1.65),.12,-.035,stone,'#8d897b');}
  for(let s=arches[1].b+19;s<arches[2].a-5;s+=7.2){const n=sample(s);blind(s,2.95,n.base+.16,Math.min(2.0,n.top-n.base-1.5),.92);}
  const sm=stone.mesh(scene);sm.castShadow=true;
  const bm=brick.mesh(scene);bm.castShadow=true;dressMasonry(bm.material);
  iron.mesh(scene).castShadow=true;
  scene.userData.railwayClosedTrimSolids=solids;
}
