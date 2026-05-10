const socket = io();
let myGhostName = null;
let currentState  = null;
let previousState = null;
let lastUpdateTime = 0;
const TICK_MS = 150; // must match server interval

const lobby      = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const canvas     = document.getElementById('gameCanvas');
const joinBtn    = document.getElementById('joinBtn');
const nameInput  = document.getElementById('nameInput');
const lobbyMsg   = document.getElementById('lobbyMsg');
const playerLabel  = document.getElementById('playerLabel');
const dotsLabel    = document.getElementById('dotsLabel');
const playersLabel = document.getElementById('playersLabel');
const overlay      = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const restartBtn   = document.getElementById('restartBtn');

const difficultyInput     = document.getElementById('difficultyInput');
const difficultyValue     = document.getElementById('difficultyValue');
const difficultyGame      = document.getElementById('difficultyGame');
const difficultyGameValue = document.getElementById('difficultyGameValue');

// --- Ghost picker ---

let selectedGhost = 'Blinky'; // default selection

function drawGhostIcon(canvas, color, dimmed) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height - 14; // leave room for name label below
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = dimmed ? 0.4 : 1;

  const cx = w / 2;
  const cy = h / 2;
  const r  = Math.min(w, h) / 2 - 3;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = dimmed ? 0 : 8;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, r, Math.PI, 0, false);

  const skirtY = cy - 1 + r;
  const ww = r / 2;
  ctx.lineTo(cx + r, skirtY);
  ctx.quadraticCurveTo(cx + ww * 0.75, skirtY + 5, cx + ww * 0.25, skirtY);
  ctx.quadraticCurveTo(cx - ww * 0.25, skirtY - 5, cx - ww * 0.75, skirtY);
  ctx.quadraticCurveTo(cx - ww * 1.25, skirtY + 5, cx - r, skirtY);
  ctx.lineTo(cx - r, cy - 1);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.28, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#00f';
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.14, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function renderGhostPicker(takenGhosts = []) {
  document.querySelectorAll('.ghost-option').forEach(el => {
    const name  = el.dataset.ghost;
    const color = GHOST_COLORS[name];
    const taken = takenGhosts.includes(name);
    const cvs   = el.querySelector('canvas');

    el.classList.toggle('taken', taken);
    el.classList.toggle('selected', name === selectedGhost && !taken);

    drawGhostIcon(cvs, color, taken);

    // If our selection just got taken, pick first available
    if (taken && name === selectedGhost) {
      const firstFree = document.querySelector('.ghost-option:not(.taken)');
      if (firstFree) setSelectedGhost(firstFree.dataset.ghost);
    }
  });
}

function setSelectedGhost(name) {
  selectedGhost = name;
  document.querySelectorAll('.ghost-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.ghost === name);
  });
}

document.querySelectorAll('.ghost-option').forEach(el => {
  el.addEventListener('click', () => {
    if (!el.classList.contains('taken')) setSelectedGhost(el.dataset.ghost);
  });
});

// Draw on page load (no taken ghosts yet)
renderGhostPicker();

// --- Difficulty sliders ---

difficultyInput.addEventListener('input', () => {
  difficultyValue.textContent = difficultyInput.value;
});

difficultyGame.addEventListener('input', () => {
  difficultyGameValue.textContent = difficultyGame.value;
  socket.emit('set_difficulty', { difficulty: Number(difficultyGame.value) });
});

// --- Button handlers ---

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Ghost Player';
  socket.emit('join_game', {
    name,
    difficulty: Number(difficultyInput.value),
    preferredGhost: selectedGhost,
  });
  joinBtn.disabled = true;
  lobbyMsg.textContent = 'Joining game...';
});

restartBtn.addEventListener('click', () => {
  socket.emit('request_restart');
  overlay.style.display = 'none';
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// --- Socket events from server ---

socket.on('lobby_status', ({ takenGhosts }) => {
  renderGhostPicker(takenGhosts);
});

socket.on('game_joined', (data) => {
  myGhostName = data.ghostName;
  playerLabel.textContent = `You are: ${myGhostName}`;
  lobby.style.display = 'none';
  gameScreen.style.display = 'flex';

  difficultyGame.value = difficultyInput.value;
  difficultyGameValue.textContent = difficultyInput.value;

  canvas.width  = MAZE_COLS * TILE_SIZE;
  canvas.height = MAZE_ROWS * TILE_SIZE;

  setupInput(socket);
  requestAnimationFrame(renderLoop);
});

socket.on('game_full', () => {
  lobbyMsg.textContent = 'Sorry, the game is full! (4/4 players)';
  joinBtn.disabled = false;
});

socket.on('game_state', (state) => {
  previousState = currentState;
  currentState  = state;
  lastUpdateTime = performance.now();

  if (state.difficulty !== undefined && Number(difficultyGame.value) !== state.difficulty) {
    difficultyGame.value = state.difficulty;
    difficultyGameValue.textContent = state.difficulty;
  }

  const humanCount = Object.values(state.ghosts).filter(g => !g.isCPU).length;
  dotsLabel.textContent    = `Dots left: ${state.dotsRemaining}`;
  playersLabel.textContent = `Players online: ${humanCount}/4`;

  if (state.phase === 'waiting') {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFD700';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for players to join...', canvas.width / 2, canvas.height / 2 + 8);
  }
});

socket.on('game_over', (data) => {
  overlayTitle.textContent = data.winner === 'ghosts'
    ? 'Ghosts Win! You caught Pacman!'
    : 'Pacman Wins! He ate all the dots!';
  overlay.style.display = 'flex';
});

socket.on('game_restarted', () => {
  previousState = null;
  overlay.style.display = 'none';
});

// --- 60fps render loop ---
function renderLoop() {
  if (currentState && currentState.phase === 'playing') {
    const elapsed = performance.now() - lastUpdateTime;
    const alpha = Math.min(elapsed / TICK_MS, 1);
    draw(canvas, currentState, previousState, myGhostName, alpha);
  }
  requestAnimationFrame(renderLoop);
}
