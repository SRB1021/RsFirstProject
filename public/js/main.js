const socket = io();
let myGhostName    = null;
let currentRoomCode = null;
let currentState   = null;
let previousState  = null;
let lastUpdateTime = 0;
let isRoomCreator  = false;
const TICK_MS = 150;

// DOM refs
const lobby          = document.getElementById('lobby');
const gameScreen     = document.getElementById('gameScreen');
const canvas         = document.getElementById('gameCanvas');
const nameInput      = document.getElementById('nameInput');
const lobbyMsg       = document.getElementById('lobbyMsg');
const roomSelect     = document.getElementById('roomSelect');
const roomInfo       = document.getElementById('roomInfo');
const roomCodeInput  = document.getElementById('roomCodeInput');
const createRoomBtn  = document.getElementById('createRoomBtn');
const joinRoomBtn    = document.getElementById('joinRoomBtn');
const roomCodeText   = document.getElementById('roomCodeText');
const copyCodeBtn    = document.getElementById('copyCodeBtn');
const joinBtn        = document.getElementById('joinBtn');
const playerLabel    = document.getElementById('playerLabel');
const dotsLabel      = document.getElementById('dotsLabel');
const playersLabel   = document.getElementById('playersLabel');
const roomCodeLabel  = document.getElementById('roomCodeLabel');
const overlay        = document.getElementById('overlay');
const overlayTitle   = document.getElementById('overlayTitle');
const restartBtn     = document.getElementById('restartBtn');
const difficultyInput     = document.getElementById('difficultyInput');
const difficultyValue     = document.getElementById('difficultyValue');
const difficultyGame      = document.getElementById('difficultyGame');
const difficultyGameValue = document.getElementById('difficultyGameValue');

// --- Ghost picker ---

let selectedGhost = 'Blinky';

function drawGhostIcon(cvs, color, dimmed) {
  const ctx = cvs.getContext('2d');
  const w = cvs.width;
  const h = cvs.height - 14;
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  ctx.globalAlpha = dimmed ? 0.4 : 1;

  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 3;

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = dimmed ? 0 : 8;
  ctx.beginPath();
  ctx.arc(cx, cy - 1, r, Math.PI, 0, false);

  const skirtY = cy - 1 + r, ww = r / 2;
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
    const taken = takenGhosts.includes(name);
    el.classList.toggle('taken', taken);
    el.classList.toggle('selected', name === selectedGhost && !taken);
    drawGhostIcon(el.querySelector('canvas'), GHOST_COLORS[name], taken);
    if (taken && name === selectedGhost) {
      const first = document.querySelector('.ghost-option:not(.taken)');
      if (first) setSelectedGhost(first.dataset.ghost);
    }
  });
}

function setSelectedGhost(name) {
  selectedGhost = name;
  document.querySelectorAll('.ghost-option').forEach(el =>
    el.classList.toggle('selected', el.dataset.ghost === name)
  );
}

document.querySelectorAll('.ghost-option').forEach(el => {
  el.addEventListener('click', () => {
    if (!el.classList.contains('taken')) setSelectedGhost(el.dataset.ghost);
  });
});

renderGhostPicker(); // draw icons on page load

// --- Utility ---

function showRoomPanel(code, takenGhosts = []) {
  currentRoomCode = code;
  roomCodeText.textContent = code;
  roomSelect.style.display = 'none';
  roomInfo.style.display   = 'flex';
  lobbyMsg.textContent     = '';
  renderGhostPicker(takenGhosts);
}

function copyCode(code) {
  navigator.clipboard.writeText(code).catch(() => {});
  copyCodeBtn.textContent = '✓';
  setTimeout(() => { copyCodeBtn.innerHTML = '&#128203;'; }, 1500);
}

// --- Room selection handlers ---

createRoomBtn.addEventListener('click', () => {
  socket.emit('create_room');
  createRoomBtn.disabled = true;
  lobbyMsg.textContent = 'Creating lobby...';
});

joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    lobbyMsg.textContent = 'Enter a 4-letter room code.';
    return;
  }
  socket.emit('check_room', { code });
  joinRoomBtn.disabled = true;
  lobbyMsg.textContent = 'Looking for lobby...';
});

roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoomBtn.click();
});

roomCodeInput.addEventListener('input', () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

copyCodeBtn.addEventListener('click', () => copyCode(currentRoomCode));
roomCodeLabel.addEventListener('click', () => currentRoomCode && copyCode(currentRoomCode));

// --- Join game handler ---

joinBtn.addEventListener('click', () => {
  if (!currentRoomCode) return;
  socket.emit('join_game', {
    name: nameInput.value.trim() || 'Ghost Player',
    roomCode: currentRoomCode,
    preferredGhost: selectedGhost,
    difficulty: Number(difficultyInput.value),
  });
  joinBtn.disabled = true;
  lobbyMsg.textContent = 'Joining game...';
});

restartBtn.addEventListener('click', () => {
  socket.emit('request_restart');
  overlay.style.display = 'none';
});

// --- Difficulty sliders ---

difficultyInput.addEventListener('input', () => {
  difficultyValue.textContent = difficultyInput.value;
});

difficultyGame.addEventListener('input', () => {
  difficultyGameValue.textContent = difficultyGame.value;
  socket.emit('set_difficulty', { difficulty: Number(difficultyGame.value) });
});

// --- Socket events from server ---

socket.on('room_created', ({ code }) => {
  createRoomBtn.disabled = false;
  showRoomPanel(code);
});

socket.on('room_status', ({ code, takenGhosts }) => {
  joinRoomBtn.disabled = false;
  showRoomPanel(code, takenGhosts);
});

socket.on('room_not_found', () => {
  createRoomBtn.disabled = false;
  joinRoomBtn.disabled = false;
  lobbyMsg.textContent = 'Room not found. Check the code and try again.';
});

socket.on('lobby_status', ({ takenGhosts }) => {
  renderGhostPicker(takenGhosts);
});

socket.on('game_joined', ({ ghostName, roomCode, isCreator }) => {
  myGhostName = ghostName;
  currentRoomCode = roomCode;
  isRoomCreator = !!isCreator;
  playerLabel.textContent  = `You are: ${ghostName}`;
  roomCodeLabel.textContent = `Room: ${roomCode}`;
  lobby.style.display      = 'none';
  gameScreen.style.display = 'flex';

  difficultyGame.disabled = !isRoomCreator;
  difficultyGame.title = isRoomCreator ? '' : 'Only the lobby creator can change difficulty';

  difficultyGame.value = difficultyInput.value;
  difficultyGameValue.textContent = difficultyInput.value;

  canvas.width  = MAZE_COLS * TILE_SIZE;
  canvas.height = MAZE_ROWS * TILE_SIZE;

  setupInput(socket);
  requestAnimationFrame(renderLoop);
});

socket.on('game_full', () => {
  joinBtn.disabled = false;
  lobbyMsg.textContent = 'Sorry, that lobby is full! (4/4 players)';
});

socket.on('game_state', (state) => {
  const prev = currentState;
  previousState  = prev;
  currentState   = state;
  lastUpdateTime = performance.now();

  audio.update(state, prev);

  if (state.difficulty !== undefined && Number(difficultyGame.value) !== state.difficulty) {
    difficultyGame.value = state.difficulty;
    difficultyGameValue.textContent = state.difficulty;
  }

  const humanCount = Object.values(state.ghosts).filter(g => !g.isCPU).length;
  dotsLabel.textContent    = `Dots left: ${state.dotsRemaining}`;
  playersLabel.textContent = `Players: ${humanCount}/4`;

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

socket.on('game_over', ({ winner }) => {
  overlayTitle.textContent = winner === 'ghosts'
    ? 'Ghosts Win! You caught Pacman!'
    : 'Pacman Wins! He ate all the dots!';
  overlay.style.display = 'flex';
  audio.stopSiren();
  if (winner === 'ghosts') audio.death(); else audio.victory();
});

socket.on('game_restarted', () => {
  previousState = null;
  overlay.style.display = 'none';
  audio.stopSiren();
});

// --- 60fps render loop ---

function renderLoop() {
  if (currentState && currentState.phase === 'playing') {
    const alpha = Math.min((performance.now() - lastUpdateTime) / TICK_MS, 1);
    draw(canvas, currentState, previousState, myGhostName, alpha);
  }
  requestAnimationFrame(renderLoop);
}
