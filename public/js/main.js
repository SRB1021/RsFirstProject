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

// --- Button handlers ---

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Ghost Player';
  socket.emit('join_game', { name });
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

socket.on('game_joined', (data) => {
  myGhostName = data.ghostName;
  playerLabel.textContent = `You are: ${myGhostName}`;
  lobby.style.display = 'none';
  gameScreen.style.display = 'flex';

  // Set canvas size once so we never resize mid-frame (resizing clears the canvas)
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
