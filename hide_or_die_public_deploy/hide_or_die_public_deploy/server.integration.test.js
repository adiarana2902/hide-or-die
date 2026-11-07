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

 const soloStartError=nextEvent(host,'errorMsg');
 host.emit('startMatch');
 assert.match(await soloStartError,/at least one friend/i);

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
 host.emit('move',{x:-18.5,z:-13.1,running:false,crouched:false,hidden:false});
 const movement=await moved;
 assert.equal(movement.id,host.id);
 assert.ok(Math.abs(movement.x-(-18.5))<.001);

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
