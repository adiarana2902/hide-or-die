const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const makeCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const cleanName = value => String(value || 'Player').trim().slice(0, 16) || 'Player';
const DEFAULT_AVATAR = { skin: '#c6865b', hair: '#24201e', outfit: '#334c63', pants: '#22252b', hairStyle: 'short', outfitStyle: 'hoodie', accessory: 'none' };
const WALKABLE=[
 {x:-16,z:-16,w:11,h:9},{x:-16,z:-4,w:9,h:8},{x:-16,z:7,w:11,h:9},
 {x:5,z:-16,w:11,h:9},{x:7,z:-4,w:9,h:8},{x:5,z:7,w:11,h:9},
 {x:-4,z:-4,w:8,h:8},
 {x:-5.8,z:-10,w:11.6,h:3.6},{x:-1.8,z:-7.5,w:3.6,h:4},
 {x:-7.5,z:-1.8,w:4,h:3.6},{x:3.5,z:-1.8,w:4,h:3.6},
 {x:-5.8,z:3.5,w:11.6,h:3.7}
];
const SOLIDS=[
 {x:-12,z:-12,w:2.1,h:1.1},{x:-8,z:-12,w:1.8,h:1.1},
 {x:-12,z:0,w:1.3,h:2.5},{x:-9,z:0,w:1.3,h:2.5},
 {x:-12,z:11,w:2,h:2},{x:-8,z:12,w:2,h:1.6},
 {x:8,z:-12,w:2.3,h:1.4},{x:12,z:-12,w:2.3,h:1.4},
 {x:10,z:0,w:2,h:1.4},{x:12,z:2,w:1.5,h:1.2},
 {x:8,z:12,w:2.4,h:1.4},{x:12,z:12,w:2.4,h:1.4},
 {x:-1.5,z:-1.5,w:1.1,h:1.1},{x:1.5,z:1.5,w:1.1,h:1.1}
];
function isWalkable(x,z){
 const m=.22,inside=WALKABLE.some(r=>x>=r.x+m&&x<=r.x+r.w-m&&z>=r.z+m&&z<=r.z+r.h-m);
 const blocked=SOLIDS.some(o=>x>o.x-.58&&x<o.x+o.w+.58&&z>o.z-.58&&z<o.z+o.h+.58);
 return inside&&!blocked;
}
const cleanAvatar = value => {
  const a = value && typeof value === 'object' ? value : {};
  const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : fallback;
  return {
    skin: color(a.skin, DEFAULT_AVATAR.skin), hair: color(a.hair, DEFAULT_AVATAR.hair),
    outfit: color(a.outfit, DEFAULT_AVATAR.outfit), pants: color(a.pants, DEFAULT_AVATAR.pants),
    hairStyle: ['short', 'long', 'spiky', 'shaved'].includes(a.hairStyle) ? a.hairStyle : 'short',
    outfitStyle: ['hoodie', 'jacket', 'coat'].includes(a.outfitStyle) ? a.outfitStyle : 'hoodie',
    accessory: ['none', 'mask', 'cap'].includes(a.accessory) ? a.accessory : 'none'
  };
};

function snapshot(room) {
  return {
    code: room.code,
    host: room.host,
    players: [...room.players.values()].map(player => ({ id: player.id, name: player.name, avatar: player.avatar }))
  };
}

function update(room) {
  io.to(room.code).emit('roomUpdate', snapshot(room));
}

function leave(socket) {
  const roomCode = socket.data.room;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  socket.data.room = null;
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(roomCode);
  if (!room.players.size) {
    rooms.delete(roomCode);
    return;
  }
  if (room.host === socket.id) room.host = room.players.keys().next().value;
  update(room);
}

io.on('connection', socket => {
  socket.on('createRoom', payload => {
    // A socket can only belong to one private room at a time.
    leave(socket);
    let roomCode = makeCode();
    while (rooms.has(roomCode)) roomCode = makeCode();
    const room = {
      code: roomCode,
      host: socket.id,
      players: new Map(),
      started: false,
      positions: {},
      roles: {},
    };
    rooms.set(roomCode, room);
    room.players.set(socket.id, { id: socket.id, name: cleanName(payload && payload.name), avatar: cleanAvatar(payload && payload.avatar) });
    socket.join(roomCode);
    socket.data.room = roomCode;
    socket.emit('roomUpdate', snapshot(room));
  });

  socket.on('joinRoom', payload => {
    const roomCode = String((payload && payload.code) || '').trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!/^[A-F0-9]{6}$/.test(roomCode) || !room) {
      socket.emit('errorMsg', 'Room not found. Check the 6-character code.');
      return;
    }
    if (room.started) {
      socket.emit('errorMsg', 'That match has already started.');
      return;
    }
    if (room.players.size >= 10) {
      socket.emit('errorMsg', 'Room is full (10 players max).');
      return;
    }
    leave(socket);
    room.players.set(socket.id, { id: socket.id, name: cleanName(payload && payload.name), avatar: cleanAvatar(payload && payload.avatar) });
    socket.join(room.code);
    socket.data.room = room.code;
    update(room);
  });

  socket.on('updateAvatar', value => {
    const room = rooms.get(socket.data.room);
    const player = room && room.players.get(socket.id);
    if (!player) return;
    player.avatar = cleanAvatar(value);
    update(room);
  });

  socket.on('leaveRoom', () => leave(socket));

  socket.on('startMatch', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return socket.emit('errorMsg', 'Create or join a room first.');
    if (room.host !== socket.id) return socket.emit('errorMsg', 'Only the room host can start the match.');
    if (room.players.size < 2) return socket.emit('errorMsg', 'Invite at least one friend before starting.');
    room.started = true;
    const ids = [...room.players.keys()].sort(() => Math.random() - 0.5);
    room.roles = {};
    ids.forEach((id, index) => { room.roles[id] = index === 0 ? 'seeker' : 'hider'; });
    room.positions = {};
    io.to(room.code).emit('matchStart', { roles: room.roles });
  });

  socket.on('move', position => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.started || !room.players.has(socket.id)) return;
    const x=Math.max(-18,Math.min(18,Number(position&&position.x)||0));
    const z=Math.max(-18,Math.min(18,Number(position&&position.z)||0));
    if(!isWalkable(x,z))return;
    room.positions[socket.id]={
      x,z,role:room.roles[socket.id],name:room.players.get(socket.id).name,
      avatar:room.players.get(socket.id).avatar
    };
    socket.to(room.code).emit('positions', room.positions);
    const seeker = [...room.players.keys()].find(id => room.roles[id] === 'seeker');
    if (seeker && seeker !== socket.id && room.roles[socket.id] === 'hider') {
      const a = room.positions[seeker];
      const b = room.positions[socket.id];
      if (a && b && Math.hypot(a.x - b.x, a.z - b.z) < 1.2) {
        io.to(room.code).emit('roundEnd', { message: 'The seeker caught a hider!' });
        room.started = false;
      }
    }
  });

  socket.on('ghostSeen', () => {
    const room = rooms.get(socket.data.room);
    if (!room || !room.started) return;
    io.to(room.code).emit('ghostEvent', { target: socket.id });
    const position = room.positions[socket.id];
    if (position) io.to(room.code).emit('locationPing', { id: socket.id, x: position.x, z: position.z });
  });

  socket.on('backToLobby', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    room.started = false;
    room.positions = {};
    room.roles = {};
    update(room);
    io.to(room.code).emit('backLobby', snapshot(room));
  });

  socket.on('disconnect', () => leave(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`HIDE OR DIE listening on 0.0.0.0:${PORT}`));
