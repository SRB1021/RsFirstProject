const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { getState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost, setDifficulty } = require('./game/gameState');
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

    if (data.difficulty) setDifficulty(data.difficulty);

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

  // Player changed the difficulty slider
  socket.on('set_difficulty', (data) => {
    setDifficulty(data.difficulty);
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

// Returns true if the game ended (so the loop can stop early)
function checkCollisions(state) {
  for (const name of Object.keys(state.ghosts)) {
    const g = state.ghosts[name];
    if (g.col === state.pacman.col && g.row === state.pacman.row) {
      if (g.scared) {
        respawnGhost(name);
      } else {
        state.phase = 'gameover';
        state.winner = 'ghosts';
        io.emit('game_over', { winner: 'ghosts' });
        return true;
      }
    }
  }
  return false;
}

// The main game loop — runs ~7 times per second
setInterval(() => {
  const state = getState();
  if (state.phase !== 'playing') return;

  // Move all human-controlled ghosts
  for (const name of Object.keys(state.ghosts)) {
    const ghost = state.ghosts[name];
    if (!ghost.isCPU) moveHumanGhost(ghost, name, state.ghosts);
  }

  // Move CPU-controlled ghosts
  moveCPUGhosts(state);

  // Check collisions now — catches ghosts that walked into Pacman
  if (checkCollisions(state)) return;

  // Move Pacman
  movePacman(state, state.dots);

  // Check collisions again — catches Pacman walking into a ghost
  // (this is what was missing before: the "tunneling" bug fix)
  if (checkCollisions(state)) return;

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

  // Check if Pacman ate all the dots
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
