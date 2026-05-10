const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { createGameState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost, setDifficulty } = require('./game/gameState');
const { movePacman } = require('./game/pacmanAI');
const { moveCPUGhosts, moveHumanGhost } = require('./game/ghostAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// rooms: code → { state }
const rooms = new Map();
// which room each socket is playing in (as an assigned ghost)
const socketRoom = new Map();
// which room each socket created but hasn't joined as a player yet
const socketCreated = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid 1/0 confusion

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function getTakenGhosts(state) {
  return Object.entries(state.ghosts)
    .filter(([, g]) => !g.isCPU)
    .map(([name]) => name);
}

// --- Socket connections ---

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Player wants to create a new lobby
  socket.on('create_room', () => {
    const code = generateCode();
    rooms.set(code, { state: createGameState(), creatorId: socket.id });
    socketCreated.set(socket.id, code);
    socket.join(code); // join Socket.io room so lobby_status broadcasts reach this socket
    socket.emit('room_created', { code });
    console.log(`Room created: ${code}`);
  });

  // Player wants to join an existing lobby by code
  socket.on('check_room', ({ code }) => {
    const upper = (code || '').toUpperCase();
    const room = rooms.get(upper);
    if (!room) {
      socket.emit('room_not_found');
      return;
    }
    socket.join(upper);
    socket.emit('room_status', { code: upper, takenGhosts: getTakenGhosts(room.state) });
  });

  // Player confirmed their ghost and is ready to play
  socket.on('join_game', ({ name, roomCode, preferredGhost, difficulty }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('room_not_found');
      return;
    }

    const { state } = room;
    if (state.phase === 'gameover') resetGame(state);
    if (difficulty) setDifficulty(state, difficulty);

    const ghostName = addPlayer(state, socket.id, preferredGhost);
    if (!ghostName) {
      socket.emit('game_full');
      return;
    }

    socketRoom.set(socket.id, code);
    socket.join(code);

    const isCreator = room.creatorId === socket.id;
    console.log(`${name || 'Anonymous'} joined room ${code} as ${ghostName}`);
    socket.emit('game_joined', { ghostName, roomCode: code, isCreator });
    io.to(code).emit('lobby_status', { takenGhosts: getTakenGhosts(state) });
  });

  socket.on('player_input', ({ direction }) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    applyInput(room.state, socket.id, direction);
  });

  socket.on('set_difficulty', ({ difficulty }) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.creatorId !== socket.id) return;
    setDifficulty(room.state, difficulty);
  });

  socket.on('request_restart', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    resetGame(room.state);
    io.to(code).emit('game_restarted');
    io.to(code).emit('lobby_status', { takenGhosts: [] });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    // If they created a room but never joined as a player, clean it up if still empty
    const createdCode = socketCreated.get(socket.id);
    socketCreated.delete(socket.id);
    if (createdCode) {
      const room = rooms.get(createdCode);
      if (room && room.state.playerCount === 0) {
        rooms.delete(createdCode);
        console.log(`Room ${createdCode} deleted (creator left)`);
      }
    }

    // Remove from game if they were an active player
    const code = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    removePlayer(room.state, socket.id);
    io.to(code).emit('lobby_status', { takenGhosts: getTakenGhosts(room.state) });

    if (room.state.playerCount === 0) {
      rooms.delete(code);
      console.log(`Room ${code} deleted (all players left)`);
    }
  });
});

// --- Collision detection ---

function checkCollisions(state, code) {
  for (const name of Object.keys(state.ghosts)) {
    const g = state.ghosts[name];
    if (g.col === state.pacman.col && g.row === state.pacman.row) {
      if (g.scared) {
        respawnGhost(state, name);
      } else {
        state.phase = 'gameover';
        state.winner = 'ghosts';
        io.to(code).emit('game_over', { winner: 'ghosts' });
        return true;
      }
    }
  }
  return false;
}

// --- Single game loop ticks every active room ---

setInterval(() => {
  for (const [code, { state }] of rooms) {
    if (state.phase !== 'playing') continue;

    for (const name of Object.keys(state.ghosts)) {
      const ghost = state.ghosts[name];
      if (!ghost.isCPU) moveHumanGhost(ghost, name, state.ghosts);
    }

    moveCPUGhosts(state);

    if (checkCollisions(state, code)) continue;

    movePacman(state, state.dots);

    if (checkCollisions(state, code)) continue;

    for (const ghost of Object.values(state.ghosts)) {
      if (ghost.scared) {
        ghost.scaredTimer--;
        if (ghost.scaredTimer <= 0) {
          ghost.scared = false;
          ghost.scaredTimer = 0;
        }
      }
    }

    if (state.dotsRemaining <= 0) {
      state.phase = 'gameover';
      state.winner = 'pacman';
      io.to(code).emit('game_over', { winner: 'pacman' });
      continue;
    }

    io.to(code).emit('game_state', state);
  }
}, 150);

server.listen(PORT, () => {
  console.log(`Ghost Pacman server running at http://localhost:${PORT}`);
});
