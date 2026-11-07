'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GRID_X,GRID_Z,isWalkable,isPlayerClear,isPlayerPathClear,roomPath,stepToward}=require('./game-logic');
const SPAWNS=Array.from({length:10},(_,i)=>({x:-8.2+(i%5)*.82,z:1.3+Math.floor(i/5)*1.0}));
const OBJECTIVES=[{x:-18.5,z:-9},{x:-9,z:-14.6},{x:3,z:-14.6},{x:20.2,z:-15},{x:-18.5,z:-3.1},{x:-3.3,z:-3.3},{x:3.2,z:-3.3},{x:15,z:-3.2},{x:-9.5,z:9},{x:2,z:9},{x:-18.5,z:15}];
test('all 12 facility rooms are walkable',()=>{assert.equal(GRID_X.length*GRID_Z.length,12);for(const x of GRID_X)for(const z of GRID_Z)assert.equal(isWalkable(x,z),true);});
test('horizontal and vertical corridors connect adjacent rooms',()=>{for(const z of GRID_Z)for(let i=0;i<GRID_X.length-1;i++)assert.equal(isWalkable((GRID_X[i]+GRID_X[i+1])/2,z),true);for(const x of GRID_X)for(let i=0;i<GRID_Z.length-1;i++)assert.equal(isWalkable(x,(GRID_Z[i]+GRID_Z[i+1])/2),true);});
test('invalid areas are rejected',()=>{assert.equal(isWalkable(-12,-8.5),false);assert.equal(isWalkable(30,0),false);assert.equal(isWalkable(0,30),false);assert.equal(isWalkable(NaN,0),false);});
test('room path uses connected room centres',()=>{const path=roomPath({x:-18,z:-12},{x:18,z:12});assert.deepEqual(path[0],{ix:0,iz:0,x:-18,z:-12});assert.deepEqual(path.at(-1),{ix:3,iz:2,x:18,z:12});for(let i=1;i<path.length;i++)assert.equal(Math.abs(path[i].ix-path[i-1].ix)+Math.abs(path[i].iz-path[i-1].iz),1);});
test('monster pathing remains walkable and reaches every room',()=>{for(const sx of GRID_X)for(const sz of GRID_Z)for(const tx of GRID_X)for(const tz of GRID_Z){let p={x:sx,z:sz},target={x:tx+1.25,z:tz-1.1};for(let step=0;step<1200&&Math.hypot(p.x-target.x,p.z-target.z)>.08;step++){const next=stepToward(p,target,.28);assert.equal(isWalkable(next.x,next.z),true);p=next;}assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.08,'monster path failed between room centres');}});
test('invalid movement requests cannot move an actor',()=>{const p={x:-18,z:-12};assert.deepEqual(stepToward(p,{x:80,z:12},1),p);assert.deepEqual(stepToward(p,{x:-12,z:-8.5},1),p);});
test('all multiplayer spawn locations and random objective points are collision-free',()=>{for(const p of SPAWNS)assert.equal(isPlayerClear(p.x,p.z),true,'blocked multiplayer spawn');for(const p of OBJECTIVES)assert.equal(isPlayerClear(p.x,p.z),true,'blocked objective point');});
test('solid furniture and reactor core reject player occupancy',()=>{assert.equal(isPlayerClear(-18.6,-12.7),false);assert.equal(isPlayerClear(-14.55,-11.5),false);assert.equal(isPlayerClear(6.4,-12.5),false);assert.equal(isPlayerClear(6,12),false);});
test('player path collision blocks crossing through desks and beds',()=>{assert.equal(isPlayerPathClear({x:-9,z:-12.7},{x:-3,z:-12.7}),false);assert.equal(isPlayerPathClear({x:3,z:-12.5},{x:9,z:-12.5}),false);});
test('locker approach positions are clear and within hiding range',()=>{const locker={x:-9.4,z:2.8},approach={x:-9.4,z:1.8};assert.equal(isPlayerClear(approach.x,approach.z),true);assert.ok(Math.hypot(locker.x-approach.x,locker.z-approach.z)<1.55);});
test('browser client exposes solo play, visible customization and first-person controls',()=>{const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');assert.match(html,/THREE\.WebGLRenderer/);assert.match(html,/PerspectiveCamera/);assert.match(html,/requestPointerLock/);assert.match(html,/soloButton.*startSolo/s);assert.match(html,/CUSTOMIZE YOUR OPERATOR/);assert.match(html,/id=\"hairStyle\"/);assert.match(html,/id=\"outfitStyle\"/);assert.match(html,/id=\"avatarPreview\"/);assert.match(html,/MOUSE LOOK/);assert.doesNotMatch(html,/getUserMedia|RTCPeerConnection|voiceReady|voiceSignal/);});
test('server exposes health and gameplay routes',()=>{const fs=require('node:fs'),path=require('node:path'),server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');assert.match(server,/app\.get\('\/healthz'/);assert.match(server,/\/vendor\/three/);assert.match(server,/interactObjective/);assert.match(server,/interactExit/);});

test('server supports one-player private practice and gives the monster an opening grace period',()=>{
 const fs=require('node:fs'),path=require('node:path'),server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 assert.doesNotMatch(server,/players\.size<2/);assert.match(server,/huntStartsAt:now\+20000/);assert.match(server,/d<\(p\.crouched\?4\.5:8\.5\)/);
});
