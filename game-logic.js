'use strict';
const GRID_X=Object.freeze([-18,-6,6,18,30]);
const GRID_Z=Object.freeze([-12,0,12]);
const ROOM_HALF=4.5;
const CORRIDOR_HALF=1.55;
const PLAYER_SOLIDS=[];
const PLAYER_CIRCLES=[];
function addRoomSolids(x,z,type){
 PLAYER_SOLIDS.push({x:x+3.45,z:z+.5,w:.92,h:.9},{x:x-3.4,z:z+2.8,w:.92,h:.9});
 if(['cafeteria','office','security','lab','hub'].includes(type))PLAYER_SOLIDS.push({x:x-.6,z:z-.7,w:2.2,h:1.25});
 if(type==='medical')PLAYER_SOLIDS.push({x:x+.4,z:z-.5,w:2.6,h:1.4});
 if(type==='storage'||type==='loading')for(let i=0;i<3;i++)PLAYER_SOLIDS.push({x:x-2.7+i*1.65,z:z+.8,w:1.1,h:1.1});
 if(type==='generator')PLAYER_SOLIDS.push({x:x+.8,z:z+.8,w:2.4,h:2.1});
 if(type==='reactor')PLAYER_CIRCLES.push({x,z,r:1.35});
 if(type==='isolation'||type==='containment')PLAYER_SOLIDS.push({x:x+1.8,z:z-.9,w:1.5,h:1.5});
 if(type==='archive')for(let i=0;i<3;i++)PLAYER_SOLIDS.push({x:x-2.65+i*2.55,z:z+.75,w:.72,h:2.2});
 if(type==='maintenance')PLAYER_SOLIDS.push({x:x+1.25,z:z+.7,w:2.4,h:1.6});
}
const ROOM_TYPES=[['cafeteria','security','medical','office','archive'],['storage','hub','lab','isolation','maintenance'],['loading','generator','reactor','exit','containment']];
for(let iz=0;iz<GRID_Z.length;iz++)for(let ix=0;ix<GRID_X.length;ix++)addRoomSolids(GRID_X[ix],GRID_Z[iz],ROOM_TYPES[iz][ix]);
function isWalkable(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>35||Math.abs(z)>17)return false;
 const room=GRID_X.some(cx=>GRID_Z.some(cz=>Math.abs(x-cx)<=ROOM_HALF&&Math.abs(z-cz)<=ROOM_HALF));
 const horizontal=GRID_Z.some(cz=>Math.abs(z-cz)<=CORRIDOR_HALF)&&GRID_X.slice(0,-1).some((cx,i)=>x>=cx+ROOM_HALF-.05&&x<=GRID_X[i+1]-ROOM_HALF+.05);
 const vertical=GRID_X.some(cx=>Math.abs(x-cx)<=CORRIDOR_HALF)&&GRID_Z.slice(0,-1).some((cz,i)=>z>=cz+ROOM_HALF-.05&&z<=GRID_Z[i+1]-ROOM_HALF+.05);
 return room||horizontal||vertical;
}
function isPlayerClear(x,z,radius=.34){
 if(!isWalkable(x,z))return false;
 for(const o of PLAYER_SOLIDS)if(Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.h/2+radius)return false;
 for(const o of PLAYER_CIRCLES)if(Math.hypot(x-o.x,z-o.z)<o.r+radius)return false;
 return true;
}
function isPlayerPathClear(from,to,radius=.34){
 if(!from||!to||!isPlayerClear(from.x,from.z,radius)||!isPlayerClear(to.x,to.z,radius))return false;
 const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.16));
 for(let i=1;i<steps;i++){const t=i/steps;if(!isPlayerClear(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,radius))return false;}
 return true;
}
function nearestRoom(point){let best=null,bestDistance=Infinity;for(let ix=0;ix<GRID_X.length;ix++)for(let iz=0;iz<GRID_Z.length;iz++){const candidate={ix,iz,x:GRID_X[ix],z:GRID_Z[iz]},d=Math.hypot(point.x-candidate.x,point.z-candidate.z);if(d<bestDistance){best=candidate;bestDistance=d;}}return best;}
function roomPath(from,to){const start=nearestRoom(from),goal=nearestRoom(to),key=n=>n.ix+','+n.iz,startKey=key(start),goalKey=key(goal),queue=[start],previous=new Map([[startKey,null]]);for(let i=0;i<queue.length;i++){const current=queue[i],currentKey=key(current);if(currentKey===goalKey)break;for(const [ix,iz] of [[current.ix-1,current.iz],[current.ix+1,current.iz],[current.ix,current.iz-1],[current.ix,current.iz+1]]){if(ix<0||ix>=GRID_X.length||iz<0||iz>=GRID_Z.length)continue;const next={ix,iz,x:GRID_X[ix],z:GRID_Z[iz]},nextKey=key(next);if(previous.has(nextKey))continue;previous.set(nextKey,currentKey);queue.push(next);}}if(!previous.has(goalKey))return[start];const path=[];let cursor=goalKey;while(cursor){const [ix,iz]=cursor.split(',').map(Number);path.push({ix,iz,x:GRID_X[ix],z:GRID_Z[iz]});cursor=previous.get(cursor);}return path.reverse();}
function stepToward(from,to,maxStep){if(!from||!to||!isWalkable(from.x,from.z)||!isWalkable(to.x,to.z)||!Number.isFinite(maxStep)||maxStep<=0)return from;const path=roomPath(from,to),start=path[0],sameRoom=path.length===1;let waypoint=to;if(!sameRoom){const next=path[1];if(start.iz===next.iz&&Math.abs(from.z-start.z)>.08)waypoint={x:from.x,z:start.z};else if(start.ix===next.ix&&Math.abs(from.x-start.x)>.08)waypoint={x:start.x,z:from.z};else waypoint=next;}const dx=waypoint.x-from.x,dz=waypoint.z-from.z,distance=Math.hypot(dx,dz);if(distance<=maxStep&&isWalkable(waypoint.x,waypoint.z))return{x:waypoint.x,z:waypoint.z};const amount=Math.min(maxStep,distance);if(sameRoom){const scale=amount/(distance||1),x=from.x+dx*scale,z=from.z+dz*scale;if(isWalkable(x,z))return{x,z};}const candidates=Math.abs(dx)>=Math.abs(dz)?[{x:from.x+Math.sign(dx)*Math.min(amount,Math.abs(dx)),z:from.z},{x:from.x,z:from.z+Math.sign(dz)*Math.min(amount,Math.abs(dz))}]:[{x:from.x,z:from.z+Math.sign(dz)*Math.min(amount,Math.abs(dz))},{x:from.x+Math.sign(dx)*Math.min(amount,Math.abs(dx)),z:from.z}];for(const candidate of candidates)if(isWalkable(candidate.x,candidate.z))return candidate;return from;}
module.exports={GRID_X,GRID_Z,ROOM_HALF,CORRIDOR_HALF,PLAYER_SOLIDS,PLAYER_CIRCLES,isWalkable,isPlayerClear,isPlayerPathClear,nearestRoom,roomPath,stepToward};
