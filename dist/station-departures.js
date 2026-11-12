// Real-world rail information: deliberately independent of accelerated game time.
export const LIVEBOARD_URL='https://api.irail.be/liveboard/?station=Aalst&format=json&lang=nl&arrdep=departure';
const CACHE_KEY='oilsjt:aalst-departures:v1', MIN_REFRESH=60000;
export function decodeDepartures(data){
 if(!data?.departures||!Array.isArray(data.departures.departure))throw new Error('Invalid liveboard');
 return data.departures.departure.filter(d=>Number.isFinite(Number(d.time))&&Number(d.time)>0&&String(d.left)!=='1').map(d=>({time:Number(d.time)*1000,delay:Math.max(0,Number(d.delay)||0),destination:String(d.station||'Onbekend').slice(0,80),platform:String(d.platform||'?').slice(0,8),cancelled:String(d.canceled)==='1'})).sort((a,b)=>a.time-b.time).slice(0,12);
}
export function createDepartureFeed({fetcher=fetch,storage=null,now=Date.now,onChange=()=>{}}={}){
 let state={status:'idle',rows:[],updated:0},next=0,pending=null,disposed=false,failures=0;
 try{const cached=JSON.parse(storage?.getItem(CACHE_KEY)||'null');if(cached&&now()-cached.updated<90000&&now()>=cached.updated&&Array.isArray(cached.rows)){state={...cached,status:'live'};next=cached.updated+MIN_REFRESH;}}catch{}
 const publish=()=>onChange({...state,rows:state.rows.slice()});
 async function update(active=true){
  if(disposed||!active||pending||now()<next)return;
  const controller=new AbortController();pending=controller;const timeout=setTimeout(()=>controller.abort(),10000);
  if(!state.updated){state.status='loading';publish();}
  try{
   const response=await fetcher(LIVEBOARD_URL,{signal:controller.signal,cache:'default',credentials:'omit'});
   if(!response.ok){const retry=response.headers?.get('retry-after');const seconds=Number(retry);if(retry)next=Math.max(next,Number.isFinite(seconds)?now()+seconds*1000:Date.parse(retry)||0);throw new Error('Liveboard unavailable');}
   const rows=decodeDepartures(await response.json());if(disposed)return;
   state={status:'live',rows,updated:now()};failures=0;
   const maxAge=Number(response.headers?.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||0)*1000;
   next=now()+Math.max(MIN_REFRESH,maxAge);
   try{storage?.setItem(CACHE_KEY,JSON.stringify(state));}catch{}
  }catch{if(disposed)return;failures++;next=Math.max(next,now()+Math.min(600000,MIN_REFRESH*2**(failures-1)));state.status=state.updated?'stale':'unavailable';}
  finally{clearTimeout(timeout);pending=null;if(!disposed)publish();}
 }
 return {update,get state(){return state;},dispose(){disposed=true;pending?.abort();},subscribe:publish};
}
