const { freshDots, countDots } = require('./maze');

const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

// Staggered exit delays (in ticks at 150ms each): Blinky exits first
const EXIT_TIMERS = { Blinky: 20, Pinky: 30, Inky: 40, Clyde: 50 };

const GHOST_STARTS = {
  Blinky: { col: 13, row: 14 },
  Pinky:  { col: 13, row: 14 },
  Inky:   { col: 11, row: 14 },
  Clyde:  { col: 15, row: 14 },
};

const PACMAN_START = { col: 13, row: 23 };

function createGameState() {
  const dots = freshDots();
  const ghosts = {};
  for (const name of GHOST_NAMES) {
    ghosts[name] = {
      col: GHOST_STARTS[name].col,
      row: GHOST_STARTS[name].row,
      direction: 'left',
      playerId: null,
      isCPU: true,
      scared: false,
      scaredTimer: 0,
      inHouse: true,
      exitTimer: EXIT_TIMERS[name],
    };
  }
  return {
    pacman: { col: PACMAN_START.col, row: PACMAN_START.row, direction: 'left', nextDirection: 'left' },
    ghosts,
    dots,
    dotsRemaining: countDots(dots),
    phase: 'waiting',
    winner: null,
    playerCount: 0,
    difficulty: 5,
  };
}

function addPlayer(state, socketId, preferredGhost) {
  const order = preferredGhost && state.ghosts[preferredGhost]
    ? [preferredGhost, ...GHOST_NAMES.filter(n => n !== preferredGhost)]
    : GHOST_NAMES;
  for (const name of order) {
    if (state.ghosts[name].isCPU) {
      state.ghosts[name].playerId = socketId;
      state.ghosts[name].isCPU = false;
      state.playerCount++;
      if (state.phase === 'waiting') state.phase = 'playing';
      return name;
    }
  }
  return null;
}

function removePlayer(state, socketId) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].playerId = null;
      state.ghosts[name].isCPU = true;
      state.playerCount--;
      break;
    }
  }
  if (state.playerCount === 0) state.phase = 'waiting';
}

function applyInput(state, socketId, direction) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].nextDirection = direction;
      break;
    }
  }
}

function resetGame(state) {
  const dots = freshDots();
  state.pacman = { col: PACMAN_START.col, row: PACMAN_START.row, direction: 'left', nextDirection: 'left' };
  state.dots = dots;
  state.dotsRemaining = countDots(dots);
  state.winner = null;
  for (const name of GHOST_NAMES) {
    state.ghosts[name].col = GHOST_STARTS[name].col;
    state.ghosts[name].row = GHOST_STARTS[name].row;
    state.ghosts[name].direction = 'left';
    state.ghosts[name].nextDirection = 'left';
    state.ghosts[name].scared = false;
    state.ghosts[name].scaredTimer = 0;
    state.ghosts[name].inHouse = true;
    state.ghosts[name].exitTimer = EXIT_TIMERS[name];
  }
  state.phase = state.playerCount > 0 ? 'playing' : 'waiting';
}

function respawnGhost(state, name) {
  state.ghosts[name].col = GHOST_STARTS[name].col;
  state.ghosts[name].row = GHOST_STARTS[name].row;
  state.ghosts[name].direction = 'up';
  state.ghosts[name].scared = false;
  state.ghosts[name].scaredTimer = 0;
  state.ghosts[name].inHouse = true;
  state.ghosts[name].exitTimer = 20; // 3 seconds before re-entering the chase
}

function setDifficulty(state, level) {
  state.difficulty = Math.max(1, Math.min(10, level));
}

module.exports = { createGameState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost, setDifficulty, GHOST_NAMES };
