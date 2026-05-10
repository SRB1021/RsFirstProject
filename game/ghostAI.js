const { isPassable, wrapTunnel, GHOST_HOME, MAZE_TEMPLATE } = require('./maze');

const DIRS = {
  left:  { dc: -1, dr:  0 },
  right: { dc:  1, dr:  0 },
  up:    { dc:  0, dr: -1 },
  down:  { dc:  0, dr:  1 },
};

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

function manhattanDistance(c1, r1, c2, r2) {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

// Returns true if col,row is inside the ghost house (stacking allowed there)
function isGhostHome(col, row) {
  return MAZE_TEMPLATE[row] && MAZE_TEMPLATE[row][col] === GHOST_HOME;
}

// Build a Set of "col,row" strings for every ghost except the one moving
function otherGhostTiles(ghosts, movingName) {
  const tiles = new Set();
  for (const [name, g] of Object.entries(ghosts)) {
    if (name !== movingName) tiles.add(`${g.col},${g.row}`);
  }
  return tiles;
}

// Pick the direction that brings the ghost closest to its target tile
function moveTowardTarget(ghost, ghostName, targetCol, targetRow, occupied) {
  const allDirs = Object.keys(DIRS);

  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    const nc = ghost.col + dc;
    const nr = ghost.row + dr;
    if (!isPassable(nc, nr)) return false;
    // Check occupation against the post-wrap position so tunnel exits are handled correctly
    const { col: wc, row: wr } = wrapTunnel(nc, nr);
    if (isGhostHome(wc, wr)) return true;
    return !occupied.has(`${wc},${wr}`);
  });

  if (available.length === 0) return;

  const nonReverse = available.filter(dir => dir !== OPPOSITE[ghost.direction]);
  const choices = nonReverse.length > 0 ? nonReverse : available;

  let best = null;
  let bestDist = Infinity;

  for (const dir of choices) {
    const { dc, dr } = DIRS[dir];
    const dist = manhattanDistance(ghost.col + dc, ghost.row + dr, targetCol, targetRow);
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }

  if (best) {
    const { dc, dr } = DIRS[best];
    ghost.direction = best;
    ghost.col += dc;
    ghost.row += dr;
    ({ col: ghost.col, row: ghost.row } = wrapTunnel(ghost.col, ghost.row));
  }
}

// When scared, pick the direction that moves AWAY from Pacman
function moveAwayFromTarget(ghost, ghostName, targetCol, targetRow, occupied) {
  const allDirs = Object.keys(DIRS);

  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    const nc = ghost.col + dc;
    const nr = ghost.row + dr;
    if (!isPassable(nc, nr)) return false;
    const { col: wc, row: wr } = wrapTunnel(nc, nr);
    if (isGhostHome(wc, wr)) return true;
    return !occupied.has(`${wc},${wr}`);
  });

  if (available.length === 0) return;

  const nonReverse = available.filter(dir => dir !== OPPOSITE[ghost.direction]);
  const choices = nonReverse.length > 0 ? nonReverse : available;

  let best = null;
  let bestDist = -Infinity;

  for (const dir of choices) {
    const { dc, dr } = DIRS[dir];
    const dist = manhattanDistance(ghost.col + dc, ghost.row + dr, targetCol, targetRow);
    if (dist > bestDist) {
      bestDist = dist;
      best = dir;
    }
  }

  if (best) {
    const { dc, dr } = DIRS[best];
    ghost.direction = best;
    ghost.col += dc;
    ghost.row += dr;
    ({ col: ghost.col, row: ghost.row } = wrapTunnel(ghost.col, ghost.row));
  }
}

// Ghost house exit target: the open tile just above the house door
const EXIT_COL = 13;
const EXIT_ROW = 11;

// Handles ghost-house timer and exit navigation.
// Returns true if the ghost's movement was handled (skip normal AI).
function handleGhostHouse(ghost, ghostName, allGhosts) {
  if (!ghost.inHouse) return false;

  if (ghost.exitTimer > 0) {
    ghost.exitTimer--;
    return true; // waiting — don't move
  }

  // Timer done: steer toward the exit tile
  moveTowardTarget(ghost, ghostName, EXIT_COL, EXIT_ROW, otherGhostTiles(allGhosts, ghostName));

  // Once the ghost is no longer on a ghost-house tile, it has exited
  if (!isGhostHome(ghost.col, ghost.row)) {
    ghost.inHouse = false;
  }

  return true; // movement already handled
}

// Move all CPU-controlled ghosts using their individual targeting rules
function moveCPUGhosts(state) {
  const pac = state.pacman;
  const ghosts = state.ghosts;

  for (const [name, ghost] of Object.entries(ghosts)) {
    if (!ghost.isCPU) continue;
    if (handleGhostHouse(ghost, name, ghosts)) continue;

    // Scared ghosts run away from Pacman
    if (ghost.scared) {
      moveAwayFromTarget(ghost, name, pac.col, pac.row, otherGhostTiles(ghosts, name));
      continue;
    }

    // Individual chase targets
    if (name === 'Blinky') {
      moveTowardTarget(ghost, name, pac.col, pac.row, otherGhostTiles(ghosts, name));
    } else if (name === 'Pinky') {
      const DIRS_VEC = { left: [-4, 0], right: [4, 0], up: [0, -4], down: [0, 4] };
      const [dc, dr] = DIRS_VEC[pac.direction] || [0, 0];
      moveTowardTarget(ghost, name, pac.col + dc, pac.row + dr, otherGhostTiles(ghosts, name));
    } else if (name === 'Inky') {
      moveTowardTarget(ghost, name, pac.col, pac.row, otherGhostTiles(ghosts, name));
    } else if (name === 'Clyde') {
      const dist = manhattanDistance(ghost.col, ghost.row, pac.col, pac.row);
      if (dist > 8) {
        moveTowardTarget(ghost, name, pac.col, pac.row, otherGhostTiles(ghosts, name));
      } else {
        moveTowardTarget(ghost, name, 1, 29, otherGhostTiles(ghosts, name));
      }
    }
  }
}

// Move a single human-controlled ghost in the direction they pressed
function moveHumanGhost(ghost, ghostName, allGhosts) {
  // Ghost house exit: handle timer and auto-exit, then return
  if (ghost.inHouse) {
    handleGhostHouse(ghost, ghostName, allGhosts);
    return;
  }

  if (!ghost.nextDirection) return;

  const { dc, dr } = DIRS[ghost.nextDirection] || {};
  if (dc === undefined) return;

  const newCol = ghost.col + dc;
  const newRow = ghost.row + dr;

  if (!isPassable(newCol, newRow)) return;

  // Apply tunnel wrapping BEFORE the occupation check so the wrapped destination
  // is compared against other ghosts' actual positions (fixes tunnel stacking bug)
  const { col: destCol, row: destRow } = wrapTunnel(newCol, newRow);

  if (!isGhostHome(destCol, destRow)) {
    for (const [name, other] of Object.entries(allGhosts)) {
      if (name !== ghostName && other.col === destCol && other.row === destRow) return;
    }
  }

  ghost.direction = ghost.nextDirection;
  ghost.col = destCol;
  ghost.row = destRow;
}

module.exports = { moveCPUGhosts, moveHumanGhost };
