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

// Move Pacman one tile.
// difficulty 1 = slow + random + poor avoidance
// difficulty 10 = full speed + smart + strong avoidance
function movePacman(state, maze) {
  const difficulty = state.difficulty || 5;

  // At low difficulty Pacman sometimes skips a turn (feels slower/dumber)
  // difficulty 1 → 40% skip, difficulty 5 → 0% skip, 6-10 → never skip
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

  // Ghost avoidance: capped at 7 so Pacman still pursues dots even at max difficulty.
  // Previous value (difficulty*1.2) reached 12 at level 10, making Pacman too paralysed to win.
  const avoidStrength = 1 + difficulty * 0.6; // 1→1.6  5→4  10→7
  const chaseStrength = difficulty * 2;        // 1→2    5→10 10→20
  // Dot bonus scales up with difficulty so high-difficulty Pacman stays aggressive about eating
  const dotBonus   = 5 + difficulty;           // 1→6    5→10 10→15
  const powerBonus = 8 + difficulty;           // 1→9    5→13 10→18
  // Random noise drowns out smart decisions at low difficulty
  const noise = (11 - difficulty) * 2;         // 1→20   5→12 10→2

  let best = null;
  let bestScore = -Infinity;

  for (const dir of choices) {
    const { dc, dr } = DIRS[dir];
    const newCol = pac.col + dc;
    const newRow = pac.row + dr;
    let score = 0;

    const cell = maze[newRow] && maze[newRow][newCol];
    if (cell === DOT)   score += dotBonus;
    if (cell === POWER) score += powerBonus;

    for (const ghostName of Object.keys(state.ghosts)) {
      const g = state.ghosts[ghostName];
      const dist = manhattanDistance(newCol, newRow, g.col, g.row);
      if (g.scared) {
        if (dist < 6) score += (7 - dist) * chaseStrength;
      } else {
        if (dist < 4) score -= (5 - dist) * avoidStrength;
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
}

module.exports = { movePacman };
