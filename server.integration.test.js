'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const net=require('node:net');
const {io}=require('socket.io-client');
const path=require('node:path');

function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function nextEvent(socket,name,timeout=7000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off(name,handler);reject(new Error('Timed out waiting for '+name));},timeout);
  const handler=(...args)=>{clearTimeout(timer);resolve(args.length===1?args[0]:args);};
  socket.once(name,handler);
 });
}
async function freePort(){
 const probe=net.createServer();
 await new Promise((resolve,reject)=>probe.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;
 await new Promise(resolve=>probe.close(resolve));
 return port;
}
async function waitForServer(url,child){
 for(let i=0;i<70;i++){
  if(child.exitCode!==null)throw new Error('Game server exited before becoming ready');
  try{const response=await fetch(url+'/healthz');if(response.ok){const body=await response.json();if(body.ok)return;}}catch{}
  await wait(100);
 }
 throw new Error('Game server did not become healthy');
}

test('Socket.IO private room, host rules, co-op start and server validation',async t=>{
 const port=await freePort(),url='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const sockets=[];
 t.after(()=>{for(const socket of sockets)socket.close();child.kill('SIGTERM');});
 await waitForServer(url,child);

 const host=io(url,{transports:['websocket'],reconnection:false});sockets.push(host);
 await nextEvent(host,'connect');
 const created=nextEvent(host,'roomUpdate');
 host.emit('createRoom',{name:'Host Operator'});
 const room=await created;
 assert.match(room.code,/^[A-F0-9]{6}$/);
 assert.equal(room.players.length,1);

 const friend=io(url,{transports:['websocket'],reconnection:false});sockets.push(friend);
 await nextEvent(friend,'connect');
 const roomChanged=nextEvent(host,'roomUpdate');
 friend.emit('joinRoom',{name:'Friend Operator',code:room.code});
 const joined=await roomChanged;
 assert.equal(joined.players.length,2);
 assert.equal(joined.started,false);

 const hostStarted=nextEvent(host,'matchStart');
 const friendStarted=nextEvent(friend,'matchStart');
 host.emit('startMatch');
 const [hostGame,friendGame]=await Promise.all([hostStarted,friendStarted]);
 assert.equal(hostGame.world.objectives.length,3);
 assert.equal(friendGame.world.objectives.length,3);
 assert.equal(hostGame.players.length,2);
 assert.ok(hostGame.world.monster);

 const moved=nextEvent(friend,'playerMoved');
 host.emit('move',{x:-8.5,z:1.3,running:false,crouched:false,hidden:false});
 const movement=await moved;
 assert.equal(movement.id,host.id);
 assert.ok(Math.abs(movement.x-(-8.5))<.001);

 const objective=hostGame.world.objectives[0];
 const worldAfterDeniedInteract=nextEvent(host,'gameUpdate');
 host.emit('interactObjective',{id:objective.id});
 const update=await worldAfterDeniedInteract;
 const stillLocked=update.world.objectives.find(item=>item.id===objective.id);
 assert.equal(stillLocked.collected,false,'server must reject an objective interaction from across the facility');

 const worldAfterDeniedExit=nextEvent(host,'gameUpdate');
 host.emit('interactExit');
 const exitUpdate=await worldAfterDeniedExit;
 assert.equal(exitUpdate.world.escaped,0,'server must reject extraction when the player is not at the exit');
});


test('a host can launch a private room alone as a practice match',async t=>{
 const port=await freePort(),url='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,env:{...process.env,PORT:String(port)},stdio:'ignore'}),sockets=[];
 t.after(()=>{for(const socket of sockets)socket.close();child.kill('SIGTERM');});
 await waitForServer(url,child);
 const host=io(url,{transports:['websocket'],reconnection:false});sockets.push(host);await nextEvent(host,'connect');
 const created=nextEvent(host,'roomUpdate');host.emit('createRoom',{name:'Solo Practice'});const room=await created;
 assert.equal(room.players.length,1);
 const started=nextEvent(host,'matchStart');host.emit('startMatch');const match=await started;
 assert.equal(match.players.length,1);assert.equal(match.world.objectives.length,3);assert.ok(match.world.monster);
});

test('room host migrates when the current host disconnects',async t=>{
 const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const url='http://127.0.0.1:'+port,child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,env:{...process.env,PORT:String(port)},stdio:'ignore'}),sockets=[];
 t.after(()=>{for(const socket of sockets)socket.close();child.kill('SIGTERM');});
 for(let n=0;n<60;n++){try{const response=await fetch(url+'/healthz');if(response.ok)break;}catch{}await wait(100);}
 const connect=async()=>{const socket=io(url,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
 const host=await connect(),friend=await connect(),third=await connect();
 const created=nextEvent(host,'roomUpdate');host.emit('createRoom',{name:'Host'});const room=await created;
 const hostJoined=nextEvent(host,'roomUpdate'),friendJoined=nextEvent(friend,'roomUpdate');friend.emit('joinRoom',{name:'Friend',code:room.code});await Promise.all([hostJoined,friendJoined]);
 await new Promise(resolve=>setTimeout(resolve,30));
 const migrated=nextEvent(friend,'roomUpdate');host.disconnect();const afterLeave=await migrated;
 assert.equal(afterLeave.host,friend.id);assert.equal(afterLeave.players.length,1);
 const thirdJoined=nextEvent(friend,'roomUpdate');third.emit('joinRoom',{name:'New teammate',code:room.code});const three=await thirdJoined;
 assert.equal(three.players.length,2);
 const match=nextEvent(friend,'matchStart');friend.emit('startMatch');const started=await match;
 assert.equal(started.players.length,2,'new host must be able to start a match');
});

test('server blocks furniture movement, validates locker hiding and uses safe spawns',async t=>{
 const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const url='http://127.0.0.1:'+port,child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,env:{...process.env,PORT:String(port)},stdio:'ignore'}),sockets=[];
 t.after(()=>{for(const socket of sockets)socket.close();child.kill('SIGTERM');});
 for(let n=0;n<60;n++){try{const response=await fetch(url+'/healthz');if(response.ok)break;}catch{}await wait(100);}
 const connect=async()=>{const socket=io(url,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
 const host=await connect(),friend=await connect();
 const created=nextEvent(host,'roomUpdate');host.emit('createRoom',{name:'Host'});const room=await created;
 const joinedHost=nextEvent(host,'roomUpdate'),joinedFriend=nextEvent(friend,'roomUpdate');friend.emit('joinRoom',{name:'Friend',code:room.code});await Promise.all([joinedHost,joinedFriend]);
 const hostGame=nextEvent(host,'matchStart'),friendGame=nextEvent(friend,'matchStart');host.emit('startMatch');const [game]=await Promise.all([hostGame,friendGame]);
 const spawnPoint=game.players.find(p=>p.id===host.id);assert.ok(spawnPoint);
 assert.ok(Math.abs(spawnPoint.x-(-8.2))<.01&&Math.abs(spawnPoint.z-1.3)<.01,'player starts at a safe central-hub point');
 let forwarded=false;const onMoved=data=>{if(data.id===host.id)forwarded=true;};friend.on('playerMoved',onMoved);
 host.emit('move',{x:-9.4,z:2.8,running:false,crouched:false,hidden:false});
 await wait(300);friend.off('playerMoved',onMoved);
 assert.equal(forwarded,false,'server rejects a move into the locker collision volume');
 const deniedHide=nextEvent(host,'hideState');host.emit('move',{x:-8.2,z:1.3,running:false,crouched:false,hidden:true});
 assert.equal((await deniedHide).hidden,false,'server rejects hiding from outside locker range');
 const approach=nextEvent(friend,'playerMoved');host.emit('move',{x:-9.0,z:1.75,running:false,crouched:false,hidden:false});await approach;
 const hidden=nextEvent(host,'hideState');host.emit('move',{x:-9.0,z:1.75,running:false,crouched:false,hidden:true});
 assert.equal((await hidden).hidden,true,'server accepts hiding at a valid collision-free locker approach');
});
