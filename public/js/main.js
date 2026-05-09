const socket = io();
let myGhostName = null;
let lastState = null;

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

socket.on('game_joined', (data) => {
  myGhostName = data.ghostName;
  playerLabel.textContent = `You are: ${myGhostName}`;
  lobby.style.display = 'none';
  gameScreen.style.display = 'flex';
  setupInput(socket);
});

socket.on('game_full', () => {
  lobbyMsg.textContent = 'Sorry, the game is full! (4/4 players)';
  joinBtn.disabled = false;
});

socket.on('game_state', (state) => {
  lastState = state;

  const humanCount = Object.values(state.ghosts).filter(g => !g.isCPU).length;
  dotsLabel.textContent    = `Dots left: ${state.dotsRemaining}`;
  playersLabel.textContent = `Players online: ${humanCount}/4`;

  draw(canvas, state, myGhostName);

  if (state.phase === 'waiting') {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height / 2 - 30, canvas.width, 50);
    ctx.fillStyle = '#FFD700';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for players to join...', canvas.width / 2, canvas.height / 2 + 8);
  }
});

socket.on('game_over', (data) => {
  if (data.winner === 'ghosts') {
    overlayTitle.textContent = 'Ghosts Win! You caught Pacman!';
  } else {
    overlayTitle.textContent = 'Pacman Wins! He ate all the dots!';
  }
  overlay.style.display = 'flex';
  if (lastState) draw(canvas, lastState, myGhostName);
});

socket.on('game_restarted', () => {
  overlay.style.display = 'none';
});
