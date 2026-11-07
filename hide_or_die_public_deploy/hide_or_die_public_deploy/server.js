'use strict';
const express=require('express');
const http=require('http');
const path=require('path');
const crypto=require('crypto');
const {Server}=require('socket.io');
const {isWalkable,isPlayerPathClear,GRID_X,GRID_Z,stepToward}=require('./game-logic');

const app=express();
const httpServer=http.createServer(app);
const io=new Server(httpServer,{cors:{origin:true},pingInterval:25000,pingTimeout:20000});
const rooms=new Map();
const PORT=Number(process.env.PORT)||3000;
const MAX_PLAYERS=10;
const ROUND_SECONDS=360;
const EXIT={x:18,z:12};
const PATROL=[{x:6,z:12},{x:-6,z:12},{x:-18,z:12},{x:-18,z:0},{x:-6,z:0},{x:6,z:0},{x:18,z:0},{x:18,z:-12},{x:6,z:-12},{x:-6,z:-12},{x:-18,z:-12}];
const OBJECTIVES=[{x:-18.5,z:-9},{x:-9,z:-14.6},{x:3,z:-14.6},{x:20.2,z:-15},{x:-18.5,z:-3.1},{x:-3.3,z:-3.3},{x:3.2,z:-3.3},{x:15,z:-3.2},{x:-9.5,z:9},{x:2,z:9},{x:-18.5,z:15}];
const HIDE_SPOTS=GRID_X.flatMap(x=>GRID_Z.flatMap(z=>[
 {x:x+3.45,z:z+.5},{x:x-3.4,z:z+2.8}
]));

app.get('/healthz',(_req,res)=>res.json({ok:true,game:'HIDE OR DIE',rooms:rooms.size,uptime:Math.round(process.uptime())}));
app.use('/vendor/three',express.static(path.join(__dirname,'node_modules','three','build'),{maxAge:'1d',fallthrough:false}));
app.use(express.static(path.join(__dirname,'public'),{etag:true,maxAge:'1h'}));

function nameOf(v){return String(v||'Player').replace(/[<>]/g,'').trim().slice(0,16)||'Player';}
function codeOf(){return crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}
function avatarOf(v){const a=v&&typeof v==='object'?v:{};const color=(x,d)=>/^#[0-9a-f]{6}$/i.test(String(x||''))?String(x):d;return{skin:color(a.skin,'#c6865b'),hair:color(a.hair,'#24201e'),outfit:color(a.outfit,'#334c63'),pants:color(a.pants,'#22252b'),hairStyle:['short','long','spiky','shaved'].includes(a.hairStyle)?a.hairStyle:'short',outfitStyle:['hoodie','jacket','coat'].includes(a.outfitStyle)?a.outfitStyle:'hoodie',accessory:['none','mask','cap'].includes(a.accessory)?a.accessory:'none'};}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function shuffled(a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=crypto.randomInt(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
function newGame(){return{objectives:shuffled(OBJECTIVES).slice(0,3).map((p,i)=>({id:'cell-'+(i+1),label:'POWER CELL '+(i+1),x:p.x,z:p.z,collected:false})),exit:{...EXIT},monster:{x:6,z:12,state:'patrol'},patrol:0,lastKnown:null,searchUntil:0,startedAt:Date.now(),lastTick:Date.now(),timeLeft:ROUND_SECONDS,escaped:[]};}
function roomView(r){return{code:r.code,host:r.host,started:r.started,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,alive:p.alive,escaped:p.escaped}))};}
function worldView(r){const g=r.game;if(!g)return null;return{objectives:g.objectives.map(o=>({...o})),exit:g.exit,monster:g.monster,timeLeft:g.timeLeft,escaped:g.escaped.length,alive:[...r.players.values()].filter(p=>p.alive&&!p.escaped).length,exitUnlocked:g.objectives.every(o=>o.collected)};}
function sendWorld(r){io.to(r.code).emit('gameUpdate',{world:worldView(r),players:[...r.players.values()].map(p=>({id:p.id,x:p.x,z:p.z,name:p.name,avatar:p.avatar,alive:p.alive,escaped:p.escaped,hidden:p.hidden}))});}
function updateRoom(r){io.to(r.code).emit('roomUpdate',roomView(r));}
function endRound(r,won,message){if(!r||!r.started)return;r.started=false;r.ended=true;io.to(r.code).emit('roundEnd',{won,message,world:worldView(r)});updateRoom(r);}
function removePlayer(s){const c=s.data.room;if(!c)return;s.data.room=null;const r=rooms.get(c);if(!r)return;r.players.delete(s.id);s.leave(c);if(!r.players.size){rooms.delete(c);return;}const hostChanged=r.host===s.id;if(hostChanged)r.host=r.players.keys().next().value;if(r.started){const living=[...r.players.values()].filter(p=>p.alive);if(living.length&&living.every(p=>p.escaped))endRound(r,true,'THE TEAM REACHED EXTRACTION');else if(!living.some(p=>!p.escaped))endRound(r,false,'NO SURVIVORS LEFT');else{sendWorld(r);if(hostChanged)updateRoom(r);}}else updateRoom(r);}
function moveToward(a,b,step){return stepToward(a,b,step);}
function hasLineOfSight(a,b){const d=dist(a,b),samples=Math.max(2,Math.ceil(d*2));for(let i=1;i<samples;i++){const t=i/samples;if(!isWalkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}return true;}

function tick(){
 const now=Date.now();
 for(const r of rooms.values()){
  if(!r.started||!r.game)continue;
  const g=r.game,dt=Math.min(.45,Math.max(.05,(now-g.lastTick)/1000));g.lastTick=now;g.timeLeft=Math.max(0,ROUND_SECONDS-Math.floor((now-g.startedAt)/1000));
  if(g.timeLeft<=0){endRound(r,false,'TIME EXPIRED — THE FACILITY SEALED');continue;}
  const survivors=[...r.players.values()].filter(p=>p.alive&&!p.escaped);
  if(!survivors.length){const saved=[...r.players.values()].some(p=>p.alive&&p.escaped);endRound(r,saved,saved?'SURVIVOR REACHED EXTRACTION':'THE MONSTER FOUND EVERYONE');continue;}
  const visible=survivors.filter(p=>!p.hidden);
  let target=null,nearest=Infinity,targetWasHeard=false;
  for(const p of visible){
   const d=dist(g.monster,p),heard=!!p.running&&d<24,seen=d<(p.crouched?7:14)&&hasLineOfSight(g.monster,p);
   if((heard||seen)&&d<nearest){target=p;nearest=d;targetWasHeard=heard&&!seen;}
  }
  if(target){
   g.monster.state=nearest<5?'chase':targetWasHeard?'investigate':'stalk';
   g.lastKnown={x:target.x,z:target.z};g.searchUntil=now+(targetWasHeard?4200:2800);
   g.monster=moveToward(g.monster,g.lastKnown,(g.monster.state==='chase'?2.75:1.7)*dt);
  }else if(g.lastKnown&&now<g.searchUntil){
   g.monster.state='search';g.monster=moveToward(g.monster,g.lastKnown,1.15*dt);
  }else{
   g.lastKnown=null;g.monster.state='patrol';const waypoint=PATROL[g.patrol%PATROL.length];if(dist(g.monster,waypoint)<.9)g.patrol++;g.monster=moveToward(g.monster,PATROL[g.patrol%PATROL.length],1.05*dt);
  }
  for(const p of visible){if(dist(g.monster,p)<1.35&&hasLineOfSight(g.monster,p)){p.alive=false;p.hidden=false;io.to(r.code).emit('playerCaught',{id:p.id,name:p.name});}}
  const living=[...r.players.values()].filter(p=>p.alive);
  if(living.length&&living.every(p=>p.escaped)){endRound(r,true,'THE TEAM REACHED EXTRACTION');continue;}
  sendWorld(r);
 }
}
setInterval(tick,250).unref();

io.on('connection',s=>{
 s.data.room=null;s.data.lastMove=Date.now();
 s.on('createRoom',payload=>{
  removePlayer(s);let code=codeOf();while(rooms.has(code))code=codeOf();
  const r={code,host:s.id,players:new Map(),started:false,ended:false,game:null};
  r.players.set(s.id,{id:s.id,name:nameOf(payload&&payload.name),avatar:avatarOf(payload&&payload.avatar),x:-18,z:-12,alive:true,escaped:false,hidden:false,running:false});
  rooms.set(code,r);s.join(code);s.data.room=code;s.emit('roomUpdate',roomView(r));
 });
 s.on('joinRoom',payload=>{
  const code=String(payload&&payload.code||'').trim().toUpperCase(),r=rooms.get(code);
  if(!/^[A-F0-9]{6}$/.test(code)||!r)return s.emit('errorMsg','ROOM NOT FOUND — CHECK THE 6-CHARACTER CODE');
  if(r.started)return s.emit('errorMsg','THIS ROUND HAS ALREADY STARTED');
  if(r.players.size>=MAX_PLAYERS)return s.emit('errorMsg','ROOM FULL — 10 PLAYERS MAX');
  removePlayer(s);r.players.set(s.id,{id:s.id,name:nameOf(payload&&payload.name),avatar:avatarOf(payload&&payload.avatar),x:-18,z:-12,alive:true,escaped:false,hidden:false,running:false});
  s.join(code);s.data.room=code;updateRoom(r);
 });
 s.on('updateAvatar',value=>{const r=rooms.get(s.data.room),p=r&&r.players.get(s.id);if(!p)return;p.avatar=avatarOf(value);if(!r.started)updateRoom(r);});
 s.on('leaveRoom',()=>removePlayer(s));
 s.on('startMatch',()=>{
  const r=rooms.get(s.data.room);if(!r)return s.emit('errorMsg','CREATE OR JOIN A ROOM FIRST');
  if(r.host!==s.id)return s.emit('errorMsg','ONLY THE ROOM HOST CAN START');
  if(r.started)return s.emit('errorMsg','THIS MATCH IS ALREADY RUNNING');
  if(r.players.size<2)return s.emit('errorMsg','INVITE AT LEAST ONE FRIEND TO START CO-OP');
  r.started=true;r.ended=false;r.game=newGame();let i=0;
  for(const p of r.players.values()){p.x=-8.2+(i%5)*.82;p.z=1.3+Math.floor(i/5)*1.0;p.alive=true;p.escaped=false;p.hidden=false;p.running=false;p.crouched=false;i++;}
  io.to(r.code).emit('matchStart',{world:worldView(r),players:[...r.players.values()].map(p=>({id:p.id,x:p.x,z:p.z,name:p.name,avatar:p.avatar,alive:true}))});
 });
 s.on('move',v=>{
  const r=rooms.get(s.data.room),p=r&&r.players.get(s.id);if(!r||!r.started||!p||!p.alive||p.escaped)return;
  const x=Number(v&&v.x),z=Number(v&&v.z);if(!isPlayerPathClear(p,{x,z},.34))return;
  const now=Date.now(),dt=Math.max(.04,Math.min(.5,(now-s.data.lastMove)/1000));if(dist(p,{x,z})>8.5*dt+.85)return;
  s.data.lastMove=now;p.x=x;p.z=z;p.running=!!(v&&v.running);p.crouched=!!(v&&v.crouched);p.hidden=!!(v&&v.hidden)&&HIDE_SPOTS.some(spot=>dist(p,spot)<1.55);if(v&&v.hidden)s.emit('hideState',{hidden:p.hidden});
  s.to(r.code).emit('playerMoved',{id:s.id,x,z,running:p.running,hidden:p.hidden});
 });
 s.on('interactObjective',v=>{
  const r=rooms.get(s.data.room),p=r&&r.players.get(s.id);if(!r||!r.started||!p||!p.alive||p.escaped)return;
  const o=r.game.objectives.find(o=>o.id===String(v&&v.id));if(!o||o.collected||dist(p,o)>2.6)return;o.collected=true;
  io.to(r.code).emit('objectiveCollected',{id:o.id,label:o.label,by:p.name,world:worldView(r)});
 });
 s.on('interactExit',()=>{
  const r=rooms.get(s.data.room),p=r&&r.players.get(s.id);if(!r||!r.started||!p||!p.alive||p.escaped)return;
  if(!r.game.objectives.every(o=>o.collected))return s.emit('errorMsg','EXTRACTION LOCKED — RESTORE POWER FIRST');
  if(dist(p,r.game.exit)>2.8)return;p.escaped=true;p.hidden=false;r.game.escaped.push(p.id);
  io.to(r.code).emit('playerEscaped',{id:p.id,name:p.name});const living=[...r.players.values()].filter(x=>x.alive);
  if(living.length&&living.every(x=>x.escaped))endRound(r,true,'THE TEAM REACHED EXTRACTION');
 });
 s.on('disconnect',()=>removePlayer(s));
});

httpServer.listen(PORT,'0.0.0.0',()=>console.log('HIDE OR DIE listening on 0.0.0.0:'+PORT));
