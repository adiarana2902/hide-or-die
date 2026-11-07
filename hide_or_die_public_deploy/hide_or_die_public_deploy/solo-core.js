'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.HODSoloCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function movementDelta(yaw,forwardInput,strafeInput,distance){const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);let x=fx*forwardInput+rx*strafeInput,z=fz*forwardInput+rz*strafeInput;const n=Math.hypot(x,z);return n>1e-9?{x:x/n*distance,z:z/n*distance}:{x:0,z:0};}
 function resolveMove(position,delta,canOccupy,maxStep=.12){let x=position.x,z=position.z;const count=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/maxStep)),sx=delta.x/count,sz=delta.z/count;for(let i=0;i<count;i++){if(canOccupy(x+sx,z+sz)){x+=sx;z+=sz;continue;}if(canOccupy(x+sx,z))x+=sx;if(canOccupy(x,z+sz))z+=sz;}return{x,z};}
 function isWithinVisionCone(from,to,facing,minDot=.35){const dx=to.x-from.x,dz=to.z-from.z,fd=Math.hypot(facing.x,facing.z),d=Math.hypot(dx,dz);if(fd<1e-9||d<1e-9)return true;return(dx*facing.x+dz*facing.z)/(d*fd)>=minDot;}
 function canSeeTarget(from,to,clearAt,spacing=.35){const d=Math.hypot(to.x-from.x,to.z-from.z),n=Math.max(1,Math.ceil(d/spacing));for(let i=1;i<n;i++){const t=i/n;if(!clearAt(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t))return false;}return true;}
 function chooseObjectives(spots,canOccupy,spawn,count=3){return spots.filter(p=>canOccupy(p.x,p.z)&&Math.hypot(p.x-spawn.x,p.z-spawn.z)>3.5).sort(()=>Math.random()-.5).slice(0,count);}
 return{movementDelta,resolveMove,canSeeTarget,isWithinVisionCone,chooseObjectives};
});