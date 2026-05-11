const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { createGameState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost, GHOST_NAMES } = require('./game/gameState');
const { stepPacman, moveHumanPacman } = require('./game/pacmanAI');
const { moveCPUGhosts, moveHumanGhost } = require('./game/ghostAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// rooms: code → { state, creatorId }
const rooms = new Map();
const socketRoom = new Map();
const socketCreated = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

// Returns list of taken roles (ghost names + 'Pacman' if a human plays Pac-Man)
function getTakenRoles(state) {
  const roles = Object.entries(state.ghosts)
    .filter(([, g]) => !g.isCPU)
    .map(([name]) => name);
  if (state.pacman.isHuman) roles.push('Pacman');
  return roles;
}

// --- Socket connections ---

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create_room', () => {
    const code = generateCode();
    rooms.set(code, { state: createGameState(), creatorId: socket.id });
    socketCreated.set(socket.id, code);
    socket.join(code);
    socket.emit('room_created', { code });
    console.log(`Room created: ${code}`);
  });

  socket.on('check_room', ({ code }) => {
    const upper = (code || '').toUpperCase();
    const room = rooms.get(upper);
    if (!room) { socket.emit('room_not_found'); return; }
    socket.join(upper);
    socket.emit('room_status', { code: upper, takenGhosts: getTakenRoles(room.state) });
  });

  socket.on('join_game', ({ name, roomCode, preferredGhost }) => {
    const code = (roomCode || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) { socket.emit('room_not_found'); return; }

    const { state } = room;
    if (state.phase === 'gameover') resetGame(state);

    const role = addPlayer(state, socket.id, preferredGhost);
    if (!role) { socket.emit('game_full'); return; }

    socketRoom.set(socket.id, code);
    socket.join(code);

    const isCreator = room.creatorId === socket.id;
    console.log(`${name || 'Anonymous'} joined room ${code} as ${role}`);
    socket.emit('game_joined', { ghostName: role, roomCode: code, isCreator });
    io.to(code).emit('lobby_status', { takenGhosts: getTakenRoles(state) });
  });

  socket.on('player_input', ({ direction }) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    applyInput(room.state, socket.id, direction);
  });

  socket.on('request_restart', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    resetGame(room.state);
    io.to(code).emit('game_restarted');
    io.to(code).emit('lobby_status', { takenGhosts: getTakenRoles(room.state) });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    const createdCode = socketCreated.get(socket.id);
    socketCreated.delete(socket.id);
    if (createdCode) {
      const room = rooms.get(createdCode);
      if (room && room.state.playerCount === 0) {
        rooms.delete(createdCode);
        console.log(`Room ${createdCode} deleted (creator left)`);
      }
    }

    const code = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    removePlayer(room.state, socket.id);
    io.to(code).emit('lobby_status', { takenGhosts: getTakenRoles(room.state) });

    if (room.state.playerCount === 0) {
      rooms.delete(code);
      console.log(`Room ${code} deleted (all players left)`);
    }
  });
});

// --- Collision detection ---

function checkSwapCollisions(state, code, pacBefore, ghostsBefore) {
  for (const [name, g] of Object.entries(state.ghosts)) {
    const prev = ghostsBefore[name];
    if (!prev) continue;
    const pacSwapped  = state.pacman.col === prev.col && state.pacman.row === prev.row;
    const ghostSwapped = g.col === pacBefore.col && g.row === pacBefore.row;
    if (pacSwapped && ghostSwapped && !g.inHouse && !g.graceTimer) {
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

function checkCollisions(state, code) {
  for (const name of Object.keys(state.ghosts)) {
    const g = state.ghosts[name];
    if (g.col !== state.pacman.col || g.row !== state.pacman.row) continue;
    if (g.inHouse || g.graceTimer > 0) continue; // still exiting house — not dangerous yet
    if (g.scared) {
      respawnGhost(state, name);
    } else {
      state.phase = 'gameover';
      state.winner = 'ghosts';
      io.to(code).emit('game_over', { winner: 'ghosts' });
      return true;
    }
  }
  return false;
}

// --- Single game loop ---

setInterval(() => {
  for (const [code, { state }] of rooms) {
    if (state.phase !== 'playing') continue;

    // Move ghosts
    for (const name of Object.keys(state.ghosts)) {
      const ghost = state.ghosts[name];
      if (!ghost.isCPU) moveHumanGhost(ghost, name, state.ghosts);
    }
    moveCPUGhosts(state);

    if (checkCollisions(state, code)) continue;

    // Snapshot ghost positions before Pac-Man moves (swap detection)
    const ghostPosBefore = {};
    for (const [n, g] of Object.entries(state.ghosts)) {
      ghostPosBefore[n] = { col: g.col, row: g.row };
    }

    if (state.pacman.isHuman) {
      // Human Pac-Man moves every tick; gets a second step when a ghost is within 6 tiles
      const pacBefore = { col: state.pacman.col, row: state.pacman.row };
      moveHumanPacman(state, state.dots);
      if (checkCollisions(state, code)) continue;
      if (checkSwapCollisions(state, code, pacBefore, ghostPosBefore)) continue;

      // Speed boost: second step when a non-scared ghost is close
      const pac = state.pacman;
      const inDanger = Object.values(state.ghosts).some(g =>
        !g.scared && !g.inHouse && !g.graceTimer &&
        Math.abs(g.col - pac.col) + Math.abs(g.row - pac.row) <= 6
      );
      if (inDanger) {
        const pacBefore2 = { col: pac.col, row: pac.row };
        moveHumanPacman(state, state.dots);
        if (checkCollisions(state, code)) continue;
        if (checkSwapCollisions(state, code, pacBefore2, ghostPosBefore)) continue;
      }
    } else {
      // CPU Pac-Man (always runs at difficulty 10)
      const diff = state.difficulty || 10;
      const pacBefore = { col: state.pacman.col, row: state.pacman.row };
      stepPacman(state, state.dots, diff);
      if (checkCollisions(state, code)) continue;
      if (checkSwapCollisions(state, code, pacBefore, ghostPosBefore)) continue;

      // Second step at difficulty 10 (double speed)
      if (diff >= 10) {
        const pacBefore2 = { col: state.pacman.col, row: state.pacman.row };
        stepPacman(state, state.dots, diff);
        if (checkCollisions(state, code)) continue;
        if (checkSwapCollisions(state, code, pacBefore2, ghostPosBefore)) continue;
      }
    }

    for (const ghost of Object.values(state.ghosts)) {
      if (ghost.scared) {
        ghost.scaredTimer--;
        if (ghost.scaredTimer <= 0) { ghost.scared = false; ghost.scaredTimer = 0; }
      }
      if (ghost.graceTimer > 0) ghost.graceTimer--;
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
