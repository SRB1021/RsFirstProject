const { isPassableForPacman, wrapTunnel, DOT, POWER, EMPTY } = require('./maze');

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

// Count open exits from a tile (excluding a blocked-back direction)
function countExits(col, row, fromDir) {
  let exits = 0;
  for (const [dir, { dc, dr }] of Object.entries(DIRS)) {
    if (dir === fromDir) continue;
    if (isPassableForPacman(col + dc, row + dr)) exits++;
  }
  return exits;
}

// Simulate Pac-Man moving n steps in a direction; return final col,row
function lookaheadPos(col, row, dc, dr, steps) {
  let c = col, r = row;
  for (let i = 0; i < steps; i++) {
    const nc = c + dc, nr = r + dr;
    if (!isPassableForPacman(nc, nr)) break;
    ({ col: c, row: r } = wrapTunnel(nc, nr));
  }
  return { col: c, row: r };
}

// Single Pac-Man step
function stepPacman(state, maze, difficulty) {
  const skipChance = Math.max(0, (5 - difficulty) * 0.08);
  if (Math.random() < skipChance) return;

  const pac = state.pacman;
  const allDirs = Object.keys(DIRS);

  const available = allDirs.filter(dir => {
    const { dc, dr } = DIRS[dir];
    return isPassableForPacman(pac.col + dc, pac.row + dr);
  });

  if (available.length === 0) return;

  const nonReverse = available.filter(dir => dir !== OPPOSITE[pac.direction]);
  const choices = nonReverse.length > 0 ? nonReverse : available;

  // --- Difficulty scaling ---
  const avoidRange    = difficulty >= 10 ? 10
                      : difficulty === 9  ?  7
                      : 4;

  const avoidStrength = difficulty >= 10 ? 35
                      : difficulty === 9  ? 20
                      : 1 + difficulty * 0.6;

  const chaseStrength = difficulty * 2;

  const dotBonus   = 5 + difficulty;
  const powerBonus = difficulty >= 10 ? 80
                   : difficulty === 9  ? 50
                   : 8 + difficulty;

  const noise = difficulty >= 9 ? 0 : (11 - difficulty) * 2;

  let best = null;
  let bestScore = -Infinity;

  for (const dir of choices) {
    const { dc, dr } = DIRS[dir];
    const newCol = pac.col + dc;
    const newRow = pac.row + dr;
    const { col: wc, row: wr } = wrapTunnel(newCol, newRow);
    let score = 0;

    const cell = maze[wr] && maze[wr][wc];
    if (cell === DOT)   score += dotBonus;
    if (cell === POWER) score += powerBonus;

    // Ghost avoidance / scared-ghost chasing
    for (const g of Object.values(state.ghosts)) {
      const dist = manhattanDistance(wc, wr, g.col, g.row);
      if (g.scared) {
        if (dist < 6) score += (7 - dist) * chaseStrength;
      } else {
        if (dist < avoidRange) score -= (avoidRange - dist) * avoidStrength;
      }
    }

    // Lookahead: scan up to 5 tiles forward for power pellets and ghost proximity
    if (difficulty >= 8) {
      const lookaheadDepth = difficulty >= 9 ? 5 : 3;
      let lc = wc, lr = wr;
      for (let step = 1; step <= lookaheadDepth; step++) {
        const nlc = lc + dc, nlr = lr + dr;
        if (!isPassableForPacman(nlc, nlr)) break;
        ({ col: lc, row: lr } = wrapTunnel(nlc, nlr));

        if (maze[lr] && maze[lr][lc] === POWER) {
          score += (lookaheadDepth + 1 - step) * (difficulty - 7) * 4;
          break;
        }

        // Penalise paths that walk toward a non-scared ghost
        if (difficulty >= 9) {
          for (const g of Object.values(state.ghosts)) {
            if (!g.scared) {
              const fwdDist = manhattanDistance(lc, lr, g.col, g.row);
              if (fwdDist < 3) score -= (4 - fwdDist) * avoidStrength * 0.5;
            }
          }
        }
      }
    }

    // Dead-end penalty at 9-10: if destination is a corridor dead-end and a ghost is close
    if (difficulty >= 9) {
      const exits = countExits(wc, wr, OPPOSITE[dir]);
      if (exits === 0) {
        // True dead-end — extremely dangerous if a ghost is nearby
        for (const g of Object.values(state.ghosts)) {
          if (!g.scared) {
            const dist = manhattanDistance(wc, wr, g.col, g.row);
            if (dist < avoidRange) score -= avoidStrength * 8;
          }
        }
      } else if (exits === 1) {
        // Narrow corridor — penalise if ghost is close
        for (const g of Object.values(state.ghosts)) {
          if (!g.scared) {
            const dist = manhattanDistance(wc, wr, g.col, g.row);
            if (dist < 5) score -= avoidStrength * 3;
          }
        }
      }
    }

    score += Math.random() * noise;

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
    ({ col: pac.col, row: pac.row } = wrapTunnel(pac.col, pac.row));
    eatDot(state, maze);
  }
}

function eatDot(state, maze) {
  const pac = state.pacman;
  if (state.dots[pac.row] && (state.dots[pac.row][pac.col] === DOT || state.dots[pac.row][pac.col] === POWER)) {
    const atePower = state.dots[pac.row][pac.col] === POWER;
    state.dots[pac.row][pac.col] = EMPTY;
    state.dotsRemaining--;

    if (atePower) {
      for (const ghost of Object.values(state.ghosts)) {
        ghost.scared = true;
        ghost.scaredTimer = 50;
      }
    }
  }
}

// Move Pacman one tile (or two at difficulty 10).
function movePacman(state, maze) {
  const difficulty = state.difficulty || 5;
  stepPacman(state, maze, difficulty);
  // At difficulty 10 Pac-Man moves twice per tick — much harder to catch
  if (difficulty >= 10) stepPacman(state, maze, difficulty);
}

module.exports = { movePacman };
