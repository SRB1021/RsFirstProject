// Maze tile types
const EMPTY = 0;
const WALL = 1;
const DOT = 2;
const POWER = 3;
const GHOST_HOME = 4; // ghost house interior — passable for ghosts, not for Pacman

// Classic 28-column x 31-row Pacman maze
// 1 = wall, 2 = dot, 3 = power pellet, 0 = empty (no dot, like the ghost house)
const MAZE_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,1,0,0,1,2,1,0,0,0,1,2,1,1,2,1,0,0,0,1,2,1,0,0,1,3,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,4,4,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,0,2,0,0,0,1,4,4,4,4,4,4,1,0,0,0,2,0,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,4,4,4,4,4,4,1,0,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
  [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
  [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// The one row where walking off the left/right edge warps to the other side
const TUNNEL_ROW = 14;
const MAZE_WIDTH = 28;

function isWall(col, row) {
  if (row < 0 || row >= MAZE_TEMPLATE.length) return true;
  if (col < 0 || col >= MAZE_TEMPLATE[0].length) return true;
  return MAZE_TEMPLATE[row][col] === WALL;
}

function isPassable(col, row) {
  // Allow stepping one tile off either edge on the tunnel row
  if (row === TUNNEL_ROW && (col === -1 || col === MAZE_WIDTH)) return true;
  if (row < 0 || row >= MAZE_TEMPLATE.length) return false;
  if (col < 0 || col >= MAZE_TEMPLATE[0].length) return false;
  return MAZE_TEMPLATE[row][col] !== WALL;
}

// Same as isPassable but also blocks the ghost house — used by Pacman AI
function isPassableForPacman(col, row) {
  if (row === TUNNEL_ROW && (col === -1 || col === MAZE_WIDTH)) return true;
  if (row < 0 || row >= MAZE_TEMPLATE.length) return false;
  if (col < 0 || col >= MAZE_TEMPLATE[0].length) return false;
  const tile = MAZE_TEMPLATE[row][col];
  return tile !== WALL && tile !== GHOST_HOME;
}

// After a move, wrap position if the entity walked through a tunnel exit
function wrapTunnel(col, row) {
  if (row === TUNNEL_ROW) {
    if (col < 0)          return { col: MAZE_WIDTH - 1, row };
    if (col >= MAZE_WIDTH) return { col: 0, row };
  }
  return { col, row };
}

// Return a fresh copy of the maze dots (so each game gets a clean slate)
function freshDots() {
  return MAZE_TEMPLATE.map(row => row.slice());
}

function countDots(dots) {
  let count = 0;
  for (const row of dots) {
    for (const cell of row) {
      if (cell === DOT || cell === POWER) count++;
    }
  }
  return count;
}

module.exports = { EMPTY, WALL, DOT, POWER, GHOST_HOME, MAZE_TEMPLATE, isWall, isPassable, isPassableForPacman, wrapTunnel, freshDots, countDots };
