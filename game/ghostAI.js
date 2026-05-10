const { isPassable, wrapTunnel } = require('./maze');

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

// Pick the direction that brings the ghost closest to its target tile
function moveTowardTarget(ghost, targetCol, targetRow) {
  const allDirs = Object.keys(DIRS);

  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    return isPassable(ghost.col + dc, ghost.row + dr);
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
function moveAwayFromTarget(ghost, targetCol, targetRow) {
  const allDirs = Object.keys(DIRS);

  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    return isPassable(ghost.col + dc, ghost.row + dr);
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

// Move all CPU-controlled ghosts using their individual targeting rules
function moveCPUGhosts(state) {
  const pac = state.pacman;
  const ghosts = state.ghosts;

  for (const ghost of Object.values(ghosts)) {
    if (!ghost.isCPU) continue;

    // All scared ghosts run away from Pacman regardless of their normal behavior
    if (ghost.scared) {
      moveAwayFromTarget(ghost, pac.col, pac.row);
      continue;
    }
  }

  // Blinky (red): always targets Pacman directly
  if (ghosts.Blinky.isCPU && !ghosts.Blinky.scared) {
    moveTowardTarget(ghosts.Blinky, pac.col, pac.row);
  }

  // Pinky (pink): targets 4 tiles ahead of Pacman's direction
  if (ghosts.Pinky.isCPU && !ghosts.Pinky.scared) {
    const DIRS_VEC = { left: [-4, 0], right: [4, 0], up: [0, -4], down: [0, 4] };
    const [dc, dr] = DIRS_VEC[pac.direction] || [0, 0];
    moveTowardTarget(ghosts.Pinky, pac.col + dc, pac.row + dr);
  }

  // Inky (cyan): targets Pacman directly (simpler version of classic Inky)
  if (ghosts.Inky.isCPU && !ghosts.Inky.scared) {
    moveTowardTarget(ghosts.Inky, pac.col, pac.row);
  }

  // Clyde (orange): chases Pacman when far, retreats to corner when close
  if (ghosts.Clyde.isCPU && !ghosts.Clyde.scared) {
    const dist = manhattanDistance(ghosts.Clyde.col, ghosts.Clyde.row, pac.col, pac.row);
    if (dist > 8) {
      moveTowardTarget(ghosts.Clyde, pac.col, pac.row);
    } else {
      moveTowardTarget(ghosts.Clyde, 1, 29);
    }
  }
}

// Move a single human-controlled ghost in the direction they pressed
function moveHumanGhost(ghost) {
  if (!ghost.nextDirection) return;

  const { dc, dr } = DIRS[ghost.nextDirection] || {};
  if (dc === undefined) return;

  const newCol = ghost.col + dc;
  const newRow = ghost.row + dr;

  if (isPassable(newCol, newRow)) {
    ghost.direction = ghost.nextDirection;
    const wrapped = wrapTunnel(newCol, newRow);
    ghost.col = wrapped.col;
    ghost.row = wrapped.row;
  }
  // If blocked, keep trying same direction next tick (feels responsive)
}

module.exports = { moveCPUGhosts, moveHumanGhost };
