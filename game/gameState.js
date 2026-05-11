const { freshDots, countDots } = require('./maze');

const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

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
    pacman: {
      col: PACMAN_START.col,
      row: PACMAN_START.row,
      direction: 'left',
      nextDirection: 'left',
      playerId: null,
      isHuman: false,
    },
    ghosts,
    dots,
    dotsRemaining: countDots(dots),
    phase: 'waiting',
    winner: null,
    playerCount: 0,
    difficulty: 10, // CPU Pac-Man always runs at max difficulty
  };
}

function addPlayer(state, socketId, preferredRole) {
  // Allow one player to be Pac-Man
  if (preferredRole === 'Pacman' && !state.pacman.isHuman) {
    state.pacman.playerId = socketId;
    state.pacman.isHuman = true;
    state.playerCount++;
    if (state.phase === 'waiting') state.phase = 'playing';
    return 'Pacman';
  }

  // Assign a ghost slot
  const order = preferredRole && state.ghosts[preferredRole]
    ? [preferredRole, ...GHOST_NAMES.filter(n => n !== preferredRole)]
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
  // Check if this player was Pac-Man
  if (state.pacman.playerId === socketId) {
    state.pacman.playerId = null;
    state.pacman.isHuman = false;
    state.playerCount--;
    if (state.playerCount === 0) state.phase = 'waiting';
    return;
  }

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
  // Route input to Pac-Man if this player controls it
  if (state.pacman.playerId === socketId) {
    state.pacman.nextDirection = direction;
    return;
  }
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].nextDirection = direction;
      break;
    }
  }
}

function resetGame(state) {
  const dots = freshDots();
  state.pacman.col = PACMAN_START.col;
  state.pacman.row = PACMAN_START.row;
  state.pacman.direction = 'left';
  state.pacman.nextDirection = 'left';
  // Keep pacman.playerId/isHuman — the player stays as Pac-Man across restarts
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
  state.ghosts[name].exitTimer = 20;
}

module.exports = { createGameState, addPlayer, removePlayer, applyInput, resetGame, respawnGhost, GHOST_NAMES };
