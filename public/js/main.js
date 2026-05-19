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
const joinBtn           = document.getElementById('joinBtn');
const playerLabel       = document.getElementById('playerLabel');
const dotsLabel         = document.getElementById('dotsLabel');
const playersLabel      = document.getElementById('playersLabel');
const roomCodeLabel     = document.getElementById('roomCodeLabel');
const overlay           = document.getElementById('overlay');
const overlayTitle      = document.getElementById('overlayTitle');
const restartBtn        = document.getElementById('restartBtn');
const lobbyReady        = document.getElementById('lobbyReady');
const roomCodeText2     = document.getElementById('roomCodeText2');
const startGameBtn      = document.getElementById('startGameBtn');
const waitingMsg        = document.getElementById('waitingMsg');
const lobbyPlayerList   = document.getElementById('lobbyPlayerList');
const pauseBtn          = document.getElementById('pauseBtn');
const pauseOverlay      = document.getElementById('pauseOverlay');
const joinNotification  = document.getElementById('joinNotification');

let notifTimer = null;

// --- Character picker ---

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

function drawPacmanIcon(cvs, dimmed) {
  const ctx = cvs.getContext('2d');
  const w = cvs.width, h = cvs.height - 14;
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  ctx.globalAlpha = dimmed ? 0.4 : 1;

  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 3;
  const mouth = 0.25; // mouth opening in units of π

  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = dimmed ? 0 : 10;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, mouth * Math.PI, (2 - mouth) * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Eye
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx + r * 0.1, cy - r * 0.45, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function renderGhostPicker(takenRoles = []) {
  document.querySelectorAll('.ghost-option').forEach(el => {
    const name  = el.dataset.ghost;
    const taken = takenRoles.includes(name);
    el.classList.toggle('taken', taken);
    el.classList.toggle('selected', name === selectedGhost && !taken);

    const cvs = el.querySelector('canvas');
    if (name === 'Pacman') {
      drawPacmanIcon(cvs, taken);
    } else {
      drawGhostIcon(cvs, GHOST_COLORS[name], taken);
    }

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

renderGhostPicker();

// --- Utility ---

function showRoomPanel(code, takenRoles = []) {
  currentRoomCode = code;
  roomCodeText.textContent = code;
  roomSelect.style.display = 'none';
  roomInfo.style.display   = 'flex';
  lobbyMsg.textContent     = '';
  renderGhostPicker(takenRoles);
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

pauseBtn.addEventListener('click', () => socket.emit('toggle_pause'));

socket.on('pause_state', ({ paused }) => {
  pauseBtn.textContent       = paused ? '▶' : '⏸';
  pauseOverlay.style.display = paused ? 'flex' : 'none';
});

// --- Join game handler ---

joinBtn.addEventListener('click', () => {
  if (!currentRoomCode) return;
  socket.emit('join_game', {
    name: nameInput.value.trim() || (selectedGhost === 'Pacman' ? 'Pac-Man' : 'Ghost Player'),
    roomCode: currentRoomCode,
    preferredGhost: selectedGhost,
  });
  joinBtn.disabled = true;
  lobbyMsg.textContent = 'Joining game...';
});

restartBtn.addEventListener('click', () => {
  socket.emit('request_restart');
  overlay.style.display = 'none';
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
  // Update player list in waiting room if visible
  if (lobbyReady.style.display !== 'none') {
    lobbyPlayerList.innerHTML = takenGhosts.length === 0
      ? '<span class="lobby-player-row" style="color:#555;">No players yet</span>'
      : takenGhosts.map(r => {
          const label = r === 'Pacman' ? 'Pac-Man' : r;
          return `<span class="lobby-player-row"><span class="role-name">${label}</span></span>`;
        }).join('');
  }
});

socket.on('game_joined', ({ ghostName, roomCode, isCreator, phase }) => {
  myGhostName = ghostName;
  currentRoomCode = roomCode;
  isRoomCreator = !!isCreator;

  if (phase === 'playing') {
    // Mid-game join (e.g. after a restart) — go straight to game screen
    enterGameScreen(ghostName, roomCode);
  } else {
    // Game not started yet — show the waiting room
    roomInfo.style.display  = 'none';
    roomCodeText2.textContent = roomCode;
    lobbyReady.style.display = 'flex';
    if (isCreator) {
      startGameBtn.style.display = 'inline-block';
      waitingMsg.textContent = 'Start when everyone is ready.';
    } else {
      waitingMsg.textContent = 'Waiting for the host to start...';
    }
  }
});

function enterGameScreen(ghostName, roomCode) {
  const label = ghostName === 'Pacman' ? 'Pac-Man' : ghostName;
  playerLabel.textContent   = `You are: ${label}`;
  roomCodeLabel.textContent = `Room: ${roomCode}`;
  lobby.style.display       = 'none';
  gameScreen.style.display  = 'flex';

  canvas.width  = MAZE_COLS * TILE_SIZE;
  canvas.height = MAZE_ROWS * TILE_SIZE;

  fitCanvas();
  setupInput(socket);
  requestAnimationFrame(renderLoop);
}

function fitCanvas() {
  const statusH = (document.getElementById('statusBar').offsetHeight || 36) + 4;
  const scale = Math.min(
    window.innerWidth / canvas.width,
    (window.innerHeight - statusH) / canvas.height,
    1
  );
  if (scale >= 1) {
    canvas.style.transform    = '';
    canvas.style.marginBottom = '';
  } else {
    canvas.style.transform    = `scale(${scale})`;
    canvas.style.transformOrigin = 'top center';
    // Collapse the phantom layout space left behind by transform
    canvas.style.marginBottom = `${canvas.height * (scale - 1)}px`;
  }
}

window.addEventListener('resize', fitCanvas);

startGameBtn.addEventListener('click', () => {
  socket.emit('start_game');
  startGameBtn.disabled = true;
});

socket.on('game_started', () => {
  enterGameScreen(myGhostName, currentRoomCode);
});

socket.on('player_joined_notify', ({ name, role }) => {
  const roleLabel = role === 'Pacman' ? 'Pac-Man' : role;
  joinNotification.textContent = `${name} joined as ${roleLabel}!`;
  joinNotification.style.display = 'block';
  // Auto-hide after 3s
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { joinNotification.style.display = 'none'; }, 3000);
});

socket.on('game_full', () => {
  joinBtn.disabled = false;
  lobbyMsg.textContent = 'Sorry, that lobby is full!';
});

socket.on('game_state', (state) => {
  const prev = currentState;
  previousState  = prev;
  currentState   = state;
  lastUpdateTime = performance.now();

  audio.update(state, prev);

  const humanCount = Object.values(state.ghosts).filter(g => !g.isCPU).length
    + (state.pacman.isHuman ? 1 : 0);
  dotsLabel.textContent    = `Dots left: ${state.dotsRemaining}`;
  playersLabel.textContent = `Players: ${humanCount}/5`;

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
  // In case someone was still in the waiting room (edge case)
  if (lobbyReady.style.display !== 'none') {
    enterGameScreen(myGhostName, currentRoomCode);
  }
});

// --- 60fps render loop ---

function renderLoop() {
  if (currentState && currentState.phase === 'playing') {
    const alpha = Math.min((performance.now() - lastUpdateTime) / TICK_MS, 1);
    draw(canvas, currentState, previousState, myGhostName, alpha);
  }
  requestAnimationFrame(renderLoop);
}
