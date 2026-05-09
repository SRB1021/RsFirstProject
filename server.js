const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { getState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost } = require('./game/gameState');
const { movePacman } = require('./game/pacmanAI');
const { moveCPUGhosts, moveHumanGhost } = require('./game/ghostAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join_game', (data) => {
    const state = getState();
    if (state.phase === 'gameover') {
      resetGame();
    }

    const ghostName = addPlayer(socket.id);
    if (!ghostName) {
      socket.emit('game_full');
      return;
    }

    console.log(`${data.name || 'Anonymous'} is now controlling ${ghostName}`);
    socket.emit('game_joined', { ghostName, playerId: socket.id });
  });

  socket.on('player_input', (data) => {
    applyInput(socket.id, data.direction);
  });

  socket.on('request_restart', () => {
    resetGame();
    io.emit('game_restarted');
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    removePlayer(socket.id);
  });
});

setInterval(() => {
  const state = getState();
  if (state.phase !== 'playing') return;

  for (const name of Object.keys(state.ghosts)) {
    const ghost = state.ghosts[name];
    if (!ghost.isCPU) {
      moveHumanGhost(ghost);
    }
  }

  moveCPUGhosts(state);
  movePacman(state, state.dots);

  // Tick down scared timers
  for (const ghost of Object.values(state.ghosts)) {
    if (ghost.scared) {
      ghost.scaredTimer--;
      if (ghost.scaredTimer <= 0) {
        ghost.scared = false;
        ghost.scaredTimer = 0;
      }
    }
  }

  // Check ghost-Pacman collisions
  for (const name of Object.keys(state.ghosts)) {
    const g = state.ghosts[name];
    if (g.col === state.pacman.col && g.row === state.pacman.row) {
      if (g.scared) {
        respawnGhost(name);
      } else {
        state.phase = 'gameover';
        state.winner = 'ghosts';
        io.emit('game_over', { winner: 'ghosts' });
        return;
      }
    }
  }

  if (state.dotsRemaining <= 0) {
    state.phase = 'gameover';
    state.winner = 'pacman';
    io.emit('game_over', { winner: 'pacman' });
    return;
  }

  io.emit('game_state', state);
}, 150);

server.listen(PORT, () => {
  console.log(`Ghost Pacman server running at http://localhost:${PORT}`);
});
