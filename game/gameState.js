const { freshDots, countDots } = require('./maze');

const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

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
    };
  }

  return {
    pacman: {
      col: PACMAN_START.col,
      row: PACMAN_START.row,
      direction: 'left',
      nextDirection: 'left',
    },
    ghosts,
    dots,
    dotsRemaining: countDots(dots),
    phase: 'waiting',
    winner: null,
    playerCount: 0,
  };
}

let state = createGameState();

function addPlayer(socketId) {
  for (const name of GHOST_NAMES) {
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

function removePlayer(socketId) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].playerId = null;
      state.ghosts[name].isCPU = true;
      state.playerCount--;
      break;
    }
  }
  if (state.playerCount === 0) {
    state.phase = 'waiting';
  }
}

function applyInput(socketId, direction) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].nextDirection = direction;
      break;
    }
  }
}

function resetGame() {
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
  }

  state.phase = state.playerCount > 0 ? 'playing' : 'waiting';
}

function getState() {
  return state;
}

module.exports = { getState, addPlayer, removePlayer, applyInput, resetGame, GHOST_NAMES };
