const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { getState, addPlayer, removePlayer, applyInput, resetGame } = require('./game/gameState');
const { movePacman } = require('./game/pacmanAI');
const { moveCPUGhosts, moveHumanGhost } = require('./game/ghostAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve everything in the public/ folder to browsers
app.use(express.static(path.join(__dirname, 'public')));

// When a browser connects via Socket.io
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Player wants to join the game
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

  // Player pressed an arrow key
  socket.on('player_input', (data) => {
    applyInput(socket.id, data.direction);
  });

  // Player wants to restart after game over
  socket.on('request_restart', () => {
    resetGame();
    io.emit('game_restarted');
  });

  // Player disconnected (closed tab, lost internet, etc.)
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    removePlayer(socket.id);
  });
});

// The main game loop — runs 10 times per second
setInterval(() => {
  const state = getState();
  if (state.phase !== 'playing') return;

  // Move all human-controlled ghosts based on their last input
  for (const name of Object.keys(state.ghosts)) {
    const ghost = state.ghosts[name];
    if (!ghost.isCPU) {
      moveHumanGhost(ghost);
    }
  }

  // Move CPU-controlled ghosts using AI
  moveCPUGhosts(state);

  // Move Pacman using AI
  movePacman(state, state.dots);

  // Check if any ghost caught Pacman
  for (const name of Object.keys(state.ghosts)) {
    const g = state.ghosts[name];
    if (g.col === state.pacman.col && g.row === state.pacman.row) {
      state.phase = 'gameover';
      state.winner = 'ghosts';
      io.emit('game_over', { winner: 'ghosts' });
      return;
    }
  }

  // Check if Pacman ate all the dots
  if (state.dotsRemaining <= 0) {
    state.phase = 'gameover';
    state.winner = 'pacman';
    io.emit('game_over', { winner: 'pacman' });
    return;
  }

  // Send the latest game state to every connected browser
  io.emit('game_state', state);
}, 150);

server.listen(PORT, () => {
  console.log(`Ghost Pacman server running at http://localhost:${PORT}`);
});
