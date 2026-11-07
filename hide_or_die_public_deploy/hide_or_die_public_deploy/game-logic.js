'use strict';
const GRID_X=Object.freeze([-18,-6,6,18]);
const GRID_Z=Object.freeze([-12,0,12]);
const ROOM_HALF=4.5;
const CORRIDOR_HALF=1.55;
function isWalkable(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>23||Math.abs(z)>17)return false;
 const room=GRID_X.some(cx=>GRID_Z.some(cz=>Math.abs(x-cx)<=ROOM_HALF&&Math.abs(z-cz)<=ROOM_HALF));
 const horizontal=GRID_Z.some(cz=>Math.abs(z-cz)<=CORRIDOR_HALF)&&GRID_X.slice(0,-1).some((cx,i)=>x>=cx+ROOM_HALF-.05&&x<=GRID_X[i+1]-ROOM_HALF+.05);
 const vertical=GRID_X.some(cx=>Math.abs(x-cx)<=CORRIDOR_HALF)&&GRID_Z.slice(0,-1).some((cz,i)=>z>=cz+ROOM_HALF-.05&&z<=GRID_Z[i+1]-ROOM_HALF+.05);
 return room||horizontal||vertical;
}
function nearestRoom(point){
 let best=null,bestDistance=Infinity;
 for(let ix=0;ix<GRID_X.length;ix++)for(let iz=0;iz<GRID_Z.length;iz++){
  const candidate={ix,iz,x:GRID_X[ix],z:GRID_Z[iz]};
  const d=Math.hypot(point.x-candidate.x,point.z-candidate.z);
  if(d<bestDistance){best=candidate;bestDistance=d;}
 }
 return best;
}
function roomPath(from,to){
 const start=nearestRoom(from),goal=nearestRoom(to),key=n=>n.ix+','+n.iz;
 const startKey=key(start),goalKey=key(goal),queue=[start],previous=new Map([[startKey,null]]);
 for(let i=0;i<queue.length;i++){
  const current=queue[i],currentKey=key(current);if(currentKey===goalKey)break;
  for(const [ix,iz] of [[current.ix-1,current.iz],[current.ix+1,current.iz],[current.ix,current.iz-1],[current.ix,current.iz+1]]){
   if(ix<0||ix>=GRID_X.length||iz<0||iz>=GRID_Z.length)continue;
   const next={ix,iz,x:GRID_X[ix],z:GRID_Z[iz]},nextKey=key(next);
   if(previous.has(nextKey))continue;
   previous.set(nextKey,currentKey);queue.push(next);
  }
 }
 if(!previous.has(goalKey))return [start];
 const path=[];let cursor=goalKey;
 while(cursor){const [ix,iz]=cursor.split(',').map(Number);path.push({ix,iz,x:GRID_X[ix],z:GRID_Z[iz]});cursor=previous.get(cursor);}
 return path.reverse();
}
function stepToward(from,to,maxStep){
 if(!from||!to||!isWalkable(from.x,from.z)||!isWalkable(to.x,to.z)||!Number.isFinite(maxStep)||maxStep<=0)return from;
 const path=roomPath(from,to),start=path[0],sameRoom=path.length===1;
 let waypoint=to;
 if(!sameRoom){
  const next=path[1];
  if(start.iz===next.iz&&Math.abs(from.z-start.z)>.08)waypoint={x:from.x,z:start.z};
  else if(start.ix===next.ix&&Math.abs(from.x-start.x)>.08)waypoint={x:start.x,z:from.z};
  else waypoint=next;
 }
 const dx=waypoint.x-from.x,dz=waypoint.z-from.z,distance=Math.hypot(dx,dz);
 if(distance<=maxStep&&isWalkable(waypoint.x,waypoint.z))return {x:waypoint.x,z:waypoint.z};
 const amount=Math.min(maxStep,distance);
 if(sameRoom){const scale=amount/(distance||1),x=from.x+dx*scale,z=from.z+dz*scale;if(isWalkable(x,z))return {x,z};}
 const candidates=Math.abs(dx)>=Math.abs(dz)
  ? [{x:from.x+Math.sign(dx)*Math.min(amount,Math.abs(dx)),z:from.z},{x:from.x,z:from.z+Math.sign(dz)*Math.min(amount,Math.abs(dz))}]
  : [{x:from.x,z:from.z+Math.sign(dz)*Math.min(amount,Math.abs(dz))},{x:from.x+Math.sign(dx)*Math.min(amount,Math.abs(dx)),z:from.z}];
 for(const candidate of candidates)if(isWalkable(candidate.x,candidate.z))return candidate;
 return from;
}
module.exports={GRID_X,GRID_Z,ROOM_HALF,CORRIDOR_HALF,isWalkable,nearestRoom,roomPath,stepToward};
