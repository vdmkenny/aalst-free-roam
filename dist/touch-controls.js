// Track fingers independently so releasing one control cannot cancel another.
export function touchHolds(keys){
 const pointers=new Map();
 return {
  press(id,key){pointers.set(id,key);keys.add(key);},
  release(id){const key=pointers.get(id);pointers.delete(id);if(key&&!Array.from(pointers.values()).includes(key))keys.delete(key);},
  clear(){for(const key of pointers.values())keys.delete(key);pointers.clear();}
 };
}
export function installTouchControls({keys,active,action,look}){
 const holds=touchHolds(keys),root=document.querySelector('.touch');
 for(const button of root.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',event=>{
   if(!active()||event.button>0)return;
   event.preventDefault();button.setPointerCapture(event.pointerId);
   holds.press(event.pointerId,button.dataset.key);button.classList.add('held');
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{holds.release(event.pointerId);button.classList.remove('held');});
 }
 for(const button of root.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{if(active())action(button.dataset.action);});
 let swipe=null;
 const view=document.querySelector('#world');
 view.addEventListener('pointerdown',e=>{
  if(!active()||e.pointerType==='mouse')return;
  swipe={id:e.pointerId,x:e.clientX,y:e.clientY};view.setPointerCapture(e.pointerId);
 });
 view.addEventListener('pointermove',e=>{
  if(!swipe||swipe.id!==e.pointerId||!active())return;
  look(e.clientX-swipe.x,e.clientY-swipe.y);swipe.x=e.clientX;swipe.y=e.clientY;
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(type,e=>{if(swipe?.id===e.pointerId)swipe=null;});
 const clear=()=>{swipe=null;holds.clear();root.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));};
 window.addEventListener('blur',clear);window.addEventListener('pagehide',clear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 root.addEventListener('contextmenu',e=>e.preventDefault());
 return {clear};
}
