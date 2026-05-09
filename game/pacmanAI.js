const { isPassable, DOT, POWER, EMPTY } = require('./maze');

// Direction vectors: each direction maps to a col/row change
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

// Move Pacman one tile using simple AI:
// - Prefer directions that lead toward a dot
// - Never reverse unless it's the only option
// - Avoid ghosts if they're very close
function movePacman(state, maze) {
  const pac = state.pacman;
  const allDirs = Object.keys(DIRS);

  // Find directions Pacman can actually move (not walls)
  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    return isPassable(pac.col + dc, pac.row + dr);
  });

  if (available.length === 0) return; // stuck, shouldn't happen

  // Remove the reverse direction unless it's the only option
  const nonReverse = available.filter(dir => dir !== OPPOSITE[pac.direction]);
  const choices = nonReverse.length > 0 ? nonReverse : available;

  // Score each direction: prefer dots, run from nearby ghosts
  let best = null;
  let bestScore = -Infinity;

  for (const dir of choices) {
    const { dc, dr } = DIRS[dir];
    const newCol = pac.col + dc;
    const newRow = pac.row + dr;
    let score = 0;

    // Strong bonus for moving onto a dot or power pellet
    const cell = maze[newRow] && maze[newRow][newCol];
    if (cell === DOT) score += 10;
    if (cell === POWER) score += 15;

    // Avoid normal ghosts, but CHASE scared ones
    for (const ghostName of Object.keys(state.ghosts)) {
      const g = state.ghosts[ghostName];
      const dist = manhattanDistance(newCol, newRow, g.col, g.row);
      if (g.scared) {
        if (dist < 6) score += (7 - dist) * 10; // strong pull toward scared ghosts
      } else {
        if (dist < 4) score -= (5 - dist) * 8;  // repel from normal ghosts
      }
    }

    // Small random tie-breaker so Pacman doesn't get stuck in loops
    score += Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }

  if (best) {
    const { dc, dr } = DIRS[best];
    pac.direction = best;
    pac.col += dc;
    pac.row += dr;

    // Eat the dot if Pacman walked onto one
    if (state.dots[pac.row] && (state.dots[pac.row][pac.col] === DOT || state.dots[pac.row][pac.col] === POWER)) {
      const atePower = state.dots[pac.row][pac.col] === POWER;
      state.dots[pac.row][pac.col] = EMPTY;
      state.dotsRemaining--;

      // Power pellet — make all ghosts scared for ~7 seconds (50 ticks at 150ms each)
      if (atePower) {
        for (const ghost of Object.values(state.ghosts)) {
          ghost.scared = true;
          ghost.scaredTimer = 50;
        }
      }
    }
  }
}

module.exports = { movePacman };
