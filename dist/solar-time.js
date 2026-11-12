// NOAA fractional-year solar approximation. World axes: east +X, south +Z.
export function solarPosition(ms,latitude=50.94,longitude=4.04){
 const d=new Date(ms),year=d.getUTCFullYear(),day=(ms-Date.UTC(year,0,1))/86400000;
 const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
 const g=2*Math.PI/days*(day-.5),s=Math.sin,c=Math.cos;
 const eq=229.18*(.000075+.001868*c(g)-.032077*s(g)-.014615*c(2*g)-.040849*s(2*g));
 const dec=.006918-.399912*c(g)+.070257*s(g)-.006758*c(2*g)+.000907*s(2*g)-.002697*c(3*g)+.00148*s(3*g);
 const minutes=d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60+d.getUTCMilliseconds()/60000;
 const ha=(minutes+eq+4*longitude)/4*Math.PI/180-Math.PI,lat=latitude*Math.PI/180;
 const x=-c(dec)*s(ha),y=s(lat)*s(dec)+c(lat)*c(dec)*c(ha),z=s(lat)*c(dec)*c(ha)-c(lat)*s(dec);
 return {x,y,z,altitude:Math.asin(y)};
}
const brusselsClockFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Brussels',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function brusselsMinutes(ms){
 const parts=brusselsClockFormatter.formatToParts(new Date(ms));
 return Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);
}
