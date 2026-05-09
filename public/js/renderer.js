// Smoothly blend between two numbers (used for position interpolation)
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Get the pixel position for an entity, smoothly interpolated between ticks.
// If the entity teleported (respawned), snap instantly instead of sliding.
function lerpPx(prevCol, prevRow, curCol, curRow, alpha) {
  const MAX_JUMP = 3; // tiles — anything bigger is a teleport, snap to new pos
  if (Math.abs(curCol - prevCol) > MAX_JUMP || Math.abs(curRow - prevRow) > MAX_JUMP) {
    return {
      x: curCol * TILE_SIZE + TILE_SIZE / 2,
      y: curRow * TILE_SIZE + TILE_SIZE / 2,
    };
  }
  return {
    x: lerp(prevCol * TILE_SIZE + TILE_SIZE / 2, curCol * TILE_SIZE + TILE_SIZE / 2, alpha),
    y: lerp(prevRow * TILE_SIZE + TILE_SIZE / 2, curRow * TILE_SIZE + TILE_SIZE / 2, alpha),
  };
}

function draw(canvas, state, prevState, myGhostName, alpha = 1) {
  if (!state) return;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMaze(ctx, state.dots);
  drawPacman(ctx, state.pacman, prevState && prevState.pacman, alpha);
  drawGhosts(ctx, state.ghosts, prevState && prevState.ghosts, myGhostName, alpha);
}

function drawMaze(ctx, dots) {
  if (!dots) return;

  for (let row = 0; row < dots.length; row++) {
    for (let col = 0; col < dots[row].length; col++) {
      const cell = dots[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      if (cell === TILE_WALL) {
        ctx.fillStyle = '#1a1aff';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#3333ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      } else if (cell === TILE_DOT) {
        ctx.fillStyle = '#FFE7A0';
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === TILE_POWER) {
        ctx.fillStyle = '#FFE7A0';
        ctx.shadowColor = '#FFE7A0';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

function drawPacman(ctx, pacman, prevPacman, alpha) {
  if (!pacman) return;

  const prev = prevPacman || pacman;
  const { x, y } = lerpPx(prev.col, prev.row, pacman.col, pacman.row, alpha);
  const radius = TILE_SIZE / 2 - 2;

  const mouthAngles = {
    right: { start: 0.25, end: 1.75 },
    left:  { start: 1.25, end: 2.75 },
    up:    { start: 1.75, end: 3.25 },
    down:  { start: 0.75, end: 2.25 },
  };
  const { start, end } = mouthAngles[pacman.direction] || mouthAngles.right;

  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, start * Math.PI, end * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGhosts(ctx, ghosts, prevGhosts, myGhostName, alpha) {
  if (!ghosts) return;

  for (const [name, ghost] of Object.entries(ghosts)) {
    const prev = (prevGhosts && prevGhosts[name]) || ghost;
    const { x, y } = lerpPx(prev.col, prev.row, ghost.col, ghost.row, alpha);
    const radius = TILE_SIZE / 2 - 2;

    // Scared ghosts turn blue; flash white when the timer is almost up
    let color;
    if (ghost.scared) {
      color = (ghost.scaredTimer < 15 && Math.floor(Date.now() / 300) % 2 === 0)
        ? '#ffffff' : '#2121DE';
    } else {
      color = GHOST_COLORS[name] || '#fff';
    }

    // Ghost body: semicircle head + wavy skirt
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y - 1, radius, Math.PI, 0, false);

    const skirtY = y - 1 + radius;
    const waveWidth = radius / 2;
    ctx.lineTo(x + radius, skirtY);
    ctx.quadraticCurveTo(x + waveWidth * 0.75, skirtY + 5, x + waveWidth * 0.25, skirtY);
    ctx.quadraticCurveTo(x - waveWidth * 0.25, skirtY - 5, x - waveWidth * 0.75, skirtY);
    ctx.quadraticCurveTo(x - waveWidth * 1.25, skirtY + 5, x - radius, skirtY);
    ctx.lineTo(x - radius, y - 1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - radius * 0.35, y - radius * 0.2, 3, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.35, y - radius * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f';
    ctx.beginPath();
    ctx.arc(x - radius * 0.35, y - radius * 0.2, 1.5, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.35, y - radius * 0.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // White ring around your own ghost
    if (name === myGhostName) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Name label
    ctx.fillStyle = ghost.isCPU ? '#888' : '#fff';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ghost.isCPU ? `${name}(CPU)` : name, x, y + radius + 11);
  }
}
