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
module.exports={GRID_X,GRID_Z,ROOM_HALF,CORRIDOR_HALF,isWalkable};
