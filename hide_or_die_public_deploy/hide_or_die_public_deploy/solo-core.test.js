'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {movementDelta,resolveMove,canSeeTarget,chooseObjectives}=require('./solo-core');

test('camera-relative WASD vectors point in the expected direction at default yaw',()=>{
 const d=movementDelta(0,1,0,1);
 assert.ok(Math.abs(d.x)<1e-9);assert.equal(d.z,-1);
 const back=movementDelta(0,-1,0,1);assert.equal(back.z,1);
 const right=movementDelta(0,0,1,1);assert.equal(right.x,1);
 const left=movementDelta(0,0,-1,1);assert.equal(left.x,-1);
});
test('camera-relative movement rotates with the camera',()=>{
 const d=movementDelta(Math.PI/2,1,0,1);
 assert.ok(Math.abs(d.x+1)<1e-9);assert.ok(Math.abs(d.z)<1e-9);
});
test('diagonal movement is normalized to the same speed',()=>{
 const straight=movementDelta(.37,1,0,3),diagonal=movementDelta(.37,1,1,3);
 assert.ok(Math.abs(Math.hypot(straight.x,straight.z)-3)<1e-9);
 assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-3)<1e-9);
});
test('collision resolver stops at walls and slides along them',()=>{
 const wall=(x,z)=>!(x>=1&&z>=-10&&z<=10);
 const stopped=resolveMove({x:0,z:0},{x:2,z:0},wall,.1);
 assert.ok(stopped.x<1);assert.ok(Math.abs(stopped.z)<1e-9);
 const slid=resolveMove({x:0,z:0},{x:2,z:1},wall,.1);
 assert.ok(slid.x<1);assert.ok(slid.z>.8);
});
test('line of sight is blocked by intervening solid geometry',()=>{
 const clear=(x,z)=>!(x>4&&x<6&&Math.abs(z)<1);
 assert.equal(canSeeTarget({x:0,z:0},{x:10,z:0},clear),false);
 assert.equal(canSeeTarget({x:0,z:2},{x:10,z:2},clear),true);
});
test('objective selection excludes blocked spots and spawn-adjacent spots',()=>{
 const spots=[{x:0,z:0},{x:1,z:1},{x:8,z:0},{x:0,z:9},{x:-9,z:0}];
 const selected=chooseObjectives(spots,(x)=>x!==8,{x:0,z:0},3);
 assert.equal(selected.length,2);
 assert.ok(selected.every(p=>Math.hypot(p.x,p.z)>3.5&&p.x!==8));
});