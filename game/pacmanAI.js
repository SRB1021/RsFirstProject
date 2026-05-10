const { isPassableForPacman, isPassable, wrapTunnel, DOT, POWER, EMPTY } = require('./maze');

const DIRS = {
  left:  { dc: -1, dr:  0 },
  right: { dc:  1, dr:  0 },
  up:    { dc:  0, dr: -1 },
  down:  { dc:  0, dr:  1 },
};
const DIR_LIST   = Object.keys(DIRS);
const OPPOSITE   = { left: 'right', right: 'left', up: 'down', down: 'up' };

function manhattanDistance(c1, r1, c2, r2) {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

// BFS from (startCol, startRow); returns a Map of "col,row" → distance.
// Stops at maxDepth tiles. Only traverses Pac-Man-passable tiles.
function bfsDistances(startCol, startRow, maxDepth) {
  const dist = new Map();
  const key0 = `${startCol},${startRow}`;
  dist.set(key0, 0);
  const queue = [{ col: startCol, row: startRow, d: 0 }];
  let head = 0;
  while (head < queue.length) {
    const { col, row, d } = queue[head++];
    if (d >= maxDepth) continue;
    for (const { dc, dr } of Object.values(DIRS)) {
      const { col: wc, row: wr } = wrapTunnel(col + dc, row + dr);
      if (!isPassableForPacman(wc, wr)) continue;
      const k = `${wc},${wr}`;
      if (!dist.has(k)) {
        dist.set(k, d + 1);
        queue.push({ col: wc, row: wr, d: d + 1 });
      }
    }
  }
  return dist;
}

// Project a ghost's position N ticks ahead using its current direction.
// Ghosts use isPassable (they can enter ghost house); if blocked they stay put.
function predictGhost(ghost, ticks) {
  let { col, row, direction } = ghost;
  for (let i = 0; i < ticks; i++) {
    const { dc, dr } = DIRS[direction] || { dc: 0, dr: 0 };
    const nc = col + dc, nr = row + dr;
    const { col: wc, row: wr } = wrapTunnel(nc, nr);
    if (isPassable(wc, wr)) { col = wc; row = wr; }
    // if wall, ghost likely turns — we just freeze it (conservative estimate)
  }
  return { col, row };
}

// Count exits from a tile (how many passable neighbours, excluding back-direction)
function countExits(col, row, fromDir) {
  let exits = 0;
  for (const [dir, { dc, dr }] of Object.entries(DIRS)) {
    if (dir === fromDir) continue;
    const { col: wc, row: wr } = wrapTunnel(col + dc, row + dr);
    if (isPassableForPacman(wc, wr)) exits++;
  }
  return exits;
}

// Score a candidate move direction. Higher = better for Pac-Man.
function scoreMove(dir, pac, state, maze, difficulty) {
  const { dc, dr } = DIRS[dir];
  const { col: wc, row: wr } = wrapTunnel(pac.col + dc, pac.row + dr);

  // --- Difficulty knobs ---
  const bfsDepth      = difficulty >= 9 ? 20 : difficulty >= 7 ? 14 : difficulty >= 4 ? 9 : 5;
  const avoidRange    = difficulty >= 10 ? 10 : difficulty >= 9 ? 8 : difficulty >= 7 ? 6 : 4;
  const avoidStrength = difficulty >= 10 ? 40 : difficulty >= 9 ? 25 : difficulty >= 7 ? 12 : 1 + difficulty * 0.6;
  const chaseStrength = difficulty * 2.5;
  const dotBonus      = 6 + difficulty;            // 7 … 16
  const powerBonus    = difficulty >= 10 ? 90 : difficulty >= 9 ? 60 : 8 + difficulty * 1.5;
  const noise         = difficulty >= 9 ? 0 : difficulty >= 7 ? 2 : (11 - difficulty) * 2;
  const ghostPredictTicks = difficulty >= 8 ? 3 : difficulty >= 5 ? 2 : 0;

  let score = Math.random() * noise;

  // --- 1. Immediate tile value ---
  const cell = maze[wr]?.[wc];
  if (cell === DOT)   score += dotBonus;
  if (cell === POWER) score += powerBonus;

  // --- 2. Ghost avoidance / chasing (with trajectory prediction) ---
  const anyScared = Object.values(state.ghosts).some(g => g.scared);
  for (const g of Object.values(state.ghosts)) {
    const predicted = ghostPredictTicks > 0 && !g.scared
      ? predictGhost(g, ghostPredictTicks)
      : g;
    const dist = manhattanDistance(wc, wr, predicted.col, predicted.row);
    if (g.scared) {
      const actualDist = manhattanDistance(wc, wr, g.col, g.row);
      if (actualDist < 7) score += (8 - actualDist) * chaseStrength;
    } else {
      if (dist < avoidRange) score -= (avoidRange - dist) * avoidStrength;
    }
  }

  // --- 3. BFS-based dot seeking ---
  // Find the nearest dot/power pellet reachable from the candidate tile.
  if (difficulty >= 4) {
    const distMap = bfsDistances(wc, wr, bfsDepth);
    let nearestDot   = Infinity;
    let nearestPower = Infinity;
    for (const [key, d] of distMap) {
      const [c, r] = key.split(',').map(Number);
      const tileVal = maze[r]?.[c];
      if (tileVal === DOT   && d < nearestDot)   nearestDot   = d;
      if (tileVal === POWER && d < nearestPower) nearestPower = d;
    }
    if (nearestDot   < Infinity) score += dotBonus   / (nearestDot   + 1);
    if (nearestPower < Infinity) score += powerBonus / (nearestPower + 1);

    // --- 4. Open-space preference when threatened ---
    // Count how many tiles Pac-Man can reach from this tile before a ghost gets there.
    // Fewer reachable tiles = more dangerous.
    if (difficulty >= 6) {
      let safeCount = 0;
      for (const [key, pacDist] of distMap) {
        const [c, r] = key.split(',').map(Number);
        let safe = true;
        for (const g of Object.values(state.ghosts)) {
          if (!g.scared) {
            const gDist = manhattanDistance(c, r, g.col, g.row);
            if (gDist <= pacDist) { safe = false; break; }
          }
        }
        if (safe) safeCount++;
      }
      score += safeCount * (difficulty >= 9 ? 0.6 : 0.25);
    }
  }

  // --- 5. Dead-end penalty (difficulty 7+) ---
  if (difficulty >= 7) {
    const exits = countExits(wc, wr, OPPOSITE[dir]);
    const closestGhost = Math.min(...Object.values(state.ghosts)
      .filter(g => !g.scared)
      .map(g => manhattanDistance(wc, wr, g.col, g.row)));
    if (exits === 0 && closestGhost < avoidRange) score -= avoidStrength * 10;
    else if (exits === 1 && closestGhost < 5)     score -= avoidStrength * 3;
  }

  // --- 6. Power pellet pathfinding when surrounded (difficulty 8+) ---
  if (difficulty >= 8 && !anyScared) {
    const closestGhost = Math.min(...Object.values(state.ghosts)
      .filter(g => !g.scared)
      .map(g => manhattanDistance(pac.col, pac.row, g.col, g.row)));
    if (closestGhost <= avoidRange) {
      // BFS from Pac-Man's current position to find nearest power pellet direction
      const fromPac = bfsDistances(pac.col, pac.row, bfsDepth);
      let nearestPowerFromPac = Infinity;
      let bestPowerCol = -1, bestPowerRow = -1;
      for (const [key, d] of fromPac) {
        const [c, r] = key.split(',').map(Number);
        if (maze[r]?.[c] === POWER && d < nearestPowerFromPac) {
          nearestPowerFromPac = d;
          bestPowerCol = c; bestPowerRow = r;
        }
      }
      if (nearestPowerFromPac < Infinity) {
        // Reward moves that bring Pac-Man closer to that power pellet
        const distAfter = manhattanDistance(wc, wr, bestPowerCol, bestPowerRow);
        const distBefore = manhattanDistance(pac.col, pac.row, bestPowerCol, bestPowerRow);
        if (distAfter < distBefore) score += powerBonus * 0.8;
      }
    }
  }

  return score;
}

// One movement step
function stepPacman(state, maze, difficulty) {
  const skipChance = Math.max(0, (5 - difficulty) * 0.08);
  if (Math.random() < skipChance) return;

  const pac = state.pacman;

  const available = DIR_LIST.filter(dir => {
    const { dc, dr } = DIRS[dir];
    const { col: wc, row: wr } = wrapTunnel(pac.col + dc, pac.row + dr);
    return isPassableForPacman(wc, wr);
  });
  if (available.length === 0) return;

  const choices = available;

  let best = choices[0];
  let bestScore = -Infinity;
  for (const dir of choices) {
    const s = scoreMove(dir, pac, state, maze, difficulty);
    if (s > bestScore) { bestScore = s; best = dir; }
  }

  const { dc, dr } = DIRS[best];
  pac.direction = best;
  pac.col += dc;
  pac.row += dr;
  ({ col: pac.col, row: pac.row } = wrapTunnel(pac.col, pac.row));

  // Eat dot / power pellet
  if (state.dots[pac.row]?.[pac.col] === DOT || state.dots[pac.row]?.[pac.col] === POWER) {
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

function movePacman(state, maze) {
  const difficulty = state.difficulty || 5;
  stepPacman(state, maze, difficulty);
  if (difficulty >= 10) stepPacman(state, maze, difficulty);
}

module.exports = { movePacman, stepPacman };
