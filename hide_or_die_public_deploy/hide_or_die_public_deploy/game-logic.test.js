'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {GRID_X,GRID_Z,isWalkable,isPlayerClear,isPlayerPathClear,roomPath,stepToward}=require('./game-logic');
const {movementDelta,resolveMove,canSeeTarget,chooseObjectives}=require('./solo-core');
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
test('server exposes health and gameplay routes',()=>{const fs=require('node:fs'),path=require('node:path'),server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');assert.match(server,/app\.get\('\/healthz'/);assert.match(server,/\/vendor\/three/);assert.match(server,/app\.get\('\/solo-core\.js'/);assert.match(server,/interactObjective/);assert.match(server,/interactExit/);});

test('server supports one-player private practice and gives the monster an opening grace period',()=>{
 const fs=require('node:fs'),path=require('node:path'),server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 assert.doesNotMatch(server,/players\.size<2/);assert.match(server,/huntStartsAt:now\+20000/);assert.match(server,/d<\(p\.crouched\?4\.5:8\.5\)/);
});

test('solo power-cell collection triggers a timed investigation clue',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/noiseAt\+4200/);
 assert.match(html,/searchUntil=noiseAt\+4200/);
});

test('facility room props define the trim material used by locker details',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 const start=html.indexOf('function addRoomProps(room,parent){'),end=html.indexOf('\nfunction ',start+10);
 assert.ok(start>=0&&end>start);
 const props=html.slice(start,end);
 assert.match(props,/trimMat=material\(/);
 assert.match(props,/addBox\(parent,\.08,2\.2,\.07,[^;]+trimMat\)/);
});

test('movement uses camera-relative WASD and swept collision helpers',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 const start=html.indexOf('function updateMovement(dt){'),end=html.indexOf('\nfunction updateMonster',start),movement=html.slice(start,end);
 assert.match(movement,/HODSoloCore\.movementDelta\(state\.yaw,f,s,speed\*dt\)/);
 assert.match(movement,/HODSoloCore\.resolveMove\(state\.localPos,delta/);
 assert.match(html,/state\.yaw=mode==='solo'\?0:Math\.PI\/2/);
 const {movementDelta}=require('./solo-core');
 const forward=movementDelta(0,1,0,1),back=movementDelta(0,-1,0,1),right=movementDelta(0,0,1,1),left=movementDelta(0,0,-1,1);
 assert.ok(Math.abs(forward.x)<1e-9&&forward.z===-1);assert.ok(Math.abs(back.x)<1e-9&&back.z===1);
 assert.ok(right.x===1&&Math.abs(right.z)<1e-9);assert.ok(left.x===-1&&Math.abs(left.z)<1e-9);
 const turned=movementDelta(Math.PI/2,1,0,1);
 assert.ok(turned.x<-.99&&Math.abs(turned.z)<1e-9,'W must follow the camera after turning');
});

test('solo starts at a clear spawn and selects reachable objective points',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/state\.localPos=self\?\{x:self\.x,z:self\.z\}:\(mode==='solo'\?\{x:-6,z:2\.5\}:\{x:-8\.2,z:1\.3\}\)/);
 assert.match(html,/chooseObjectives\(OBJECTIVE_SPOTS/);
 assert.match(html,/nearestClearPoint\(\{x:18,z:-12\}/);
});
test('solo monster uses line of sight, obstacle-aware pathing and locker searches',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/canSeeTarget\(enemy,state\.localPos/);
 assert.match(html,/resolveMove\(enemy,delta/);
 assert.match(html,/state\.hidden&&contactDistance<1\.7/);assert.match(html,/damagePlayer\(45,'THE CREATURE SEARCHED YOUR LOCKER'\)/);
});
test('solo replay resets run state and returns through the shared startup path',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/function startWorld\(mode,world,players,scenario\)\{\s*init3D\(\);state\.keys=\{\};state\.dead=false/);
 assert.match(html,/replayButton'\)\.onclick=\(\)=>\{if\(state\.mode==='multi'\).*?else startSolo\(\)/s);
});

test('Solo spawn, exit and all configured power-cell locations are collision-free',()=>{
 const objectives=[{x:-18.5,z:-9},{x:-9,z:-14.6},{x:3,z:-14.6},{x:20.2,z:-15},{x:-18.5,z:-3.1},{x:-3.3,z:-3.3},{x:3.2,z:-3.3},{x:15,z:-3.2},{x:-9.5,z:9},{x:2,z:9},{x:-18.5,z:15}];
 assert.equal(isPlayerClear(-6,2.5,.34),true,'Solo spawn must be clear');
 assert.equal(isPlayerClear(18,12,.34),true,'extraction approach must be clear');
 for(const point of objectives)assert.equal(isPlayerClear(point.x,point.z,.22),true,'Solo objective must be reachable');
 const chosen=chooseObjectives(objectives,(x,z)=>isPlayerClear(x,z,.22),{x:-6,z:2.5},3);
 assert.equal(chosen.length,3,'three reachable objectives must always be selectable');
});
test('Solo monster spawn and patrol waypoints can be resolved to clear floor',()=>{
 const points=[{x:18,z:-12},{x:6,z:-12},{x:-6,z:-12},{x:-18,z:-12},{x:-18,z:0},{x:-18,z:12},{x:-6,z:12},{x:6,z:12},{x:18,z:12},{x:18,z:0},{x:6,z:0},{x:-6,z:0}];
 function nearestClear(point,radius=.42){if(isPlayerClear(point.x,point.z,radius))return point;for(let ring=1;ring<=12;ring++){const offset=ring*.35;for(let i=-ring;i<=ring;i++)for(const [dx,dz] of [[i*.35,-offset],[i*.35,offset],[-offset,i*.35],[offset,i*.35]])if(isPlayerClear(point.x+dx,point.z+dz,radius))return{x:point.x+dx,z:point.z+dz};}return null;}
 for(const point of points){const resolved=nearestClear(point);assert.ok(resolved,'patrol point must have a clear nearby floor position');assert.equal(isPlayerClear(resolved.x,resolved.z,.42),true);}
});
test('Solo end screen cleanly leaves gameplay and extraction hint explains remaining cells',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/setScreen\('ended'\);\$\('endScreen'\)\.style\.display='grid'/);
 assert.match(html,/EXTRACTION LOCKED · '\+cellsLeft\+' CELL\(S\) LEFT/);
 assert.match(html,/nearbyObjective\.label/);
});

test('Solo monster continues searching the last known location while player hides',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 const start=html.indexOf('function updateSolo(dt){'),end=html.indexOf('\nfunction updateMovement',start),ai=html.slice(start,end);
 assert.match(ai,/if\(now>=run\.graceUntil\)\{\s*if\(!state\.hidden\)\{/);
 assert.match(ai,/if\(run\.lastKnown&&now<run\.searchUntil\)\{target=run\.lastKnown/);
 const hide=html.slice(html.indexOf('function toggleHide()'),html.indexOf('function toggleFlashlight'));
 assert.match(hide,/canSeeTarget\(run\.enemy,state\.localPos/);
 assert.match(hide,/searchUntil=Date\.now\(\)\+10000/);
});

test('Solo controls clear held keys when the browser loses focus',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/addEventListener\('blur',\(\)=>\{state\.keys=\{\};state\.running=false;\}\)/);
 assert.match(html,/addEventListener\('visibilitychange',\(\)=>\{if\(document\.hidden\)\{state\.keys=\{\};state\.running=false;\}\}\)/);
});

test('Solo incident includes inventory, evidence inspection, medkits, health and pause controls',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 for(const id of ['inventoryPanel','journalPanel','inspectPanel','pausePanel','healthFill','damageVignette','resumeButton','settingsButton'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const feature of ['function refreshInventory','function showEvidence','function damagePlayer','function setupSoloSystems','function collectPickup','function useInventoryItem','function openPause'])assert.ok(html.includes(feature),feature+' should exist');
 assert.match(html,/Security keycard/);assert.match(html,/Shift report/);assert.match(html,/Damaged voice recorder/);assert.match(html,/Emergency medkit/);
});
test('Solo pause freezes monster simulation and player movement',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 assert.match(html,/if\(!run\|\|state\.paused\)return/);assert.match(html,/if\(state\.hidden\|\|state\.dead\|\|state\.paused\)return/);
});

test('Solo incidents have distinct monster behaviour and a working generator breaker',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8');
 for(const value of ['hearing:1.25','vision:1.35','search:1.5','pace:1.25'])assert.ok(html.includes(value),'incident AI profile '+value+' should exist');
 assert.match(html,/const noise=run\.lastNoise,heard=!!noise&&now-run\.lastNoiseAt<1900&&distance\(enemy,noise\)<noise\.radius\*ai\.hearing/);
 assert.match(html,/function toggleFacilityBreaker\(\)/);assert.match(html,/AUXILIARY POWER RESTORED/);assert.match(html,/state\.environmentLights\.push\(lamp\)/);
 assert.match(html,/distance\(p,\{x:-9\.15,z:11\.35\}\)<2\.0/);
});
