const { freshDots, countDots } = require('./maze');

// The 4 ghost characters, in classic order
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

// Starting positions for each ghost (col, row) inside the ghost house
const GHOST_STARTS = {
  Blinky: { col: 13, row: 14 },
  Pinky:  { col: 13, row: 14 },
  Inky:   { col: 11, row: 14 },
  Clyde:  { col: 15, row: 14 },
};

// Pacman starts near the bottom center
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
    phase: 'waiting',   // 'waiting' | 'playing' | 'gameover'
    winner: null,       // 'ghosts' | 'pacman'
    playerCount: 0,
  };
}

let state = createGameState();

// Assign the next available ghost to a newly connected player
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
  return null; // game is full
}

// Free a ghost back to CPU when a player disconnects
function removePlayer(socketId) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].playerId = null;
      state.ghosts[name].isCPU = true;
      state.playerCount--;
      break;
    }
  }
  // If everyone left, go back to waiting
  if (state.playerCount === 0) {
    state.phase = 'waiting';
  }
}

// Store a player's intended direction so the game loop can apply it
function applyInput(socketId, direction) {
  for (const name of GHOST_NAMES) {
    if (state.ghosts[name].playerId === socketId) {
      state.ghosts[name].nextDirection = direction;
      break;
    }
  }
}

// Reset everything for a new round
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
