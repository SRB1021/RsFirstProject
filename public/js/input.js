const KEY_TO_DIRECTION = {
  ArrowLeft:  'left',
  ArrowRight: 'right',
  ArrowUp:    'up',
  ArrowDown:  'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
};

// --- Swipe controls for mobile ---

const SWIPE_DEAD_ZONE = 20; // px — minimum drag before registering a direction

function setupSwipe(socket) {
  const target = document.getElementById('gameScreen');
  if (!target) return;

  let startX = 0, startY = 0;
  let lastDir = null;

  function onStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    lastDir = null;
  }

  function onMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < SWIPE_DEAD_ZONE) return;

    const dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');

    if (dir !== lastDir) {
      lastDir = dir;
      socket.emit('player_input', { direction: dir });
      // Reset origin so holding a direction keeps firing on continued drag
      startX = touch.clientX;
      startY = touch.clientY;
    }
  }

  function onEnd() {
    lastDir = null;
  }

  target.addEventListener('touchstart', onStart, { passive: true });
  target.addEventListener('touchmove',  onMove,  { passive: false });
  target.addEventListener('touchend',   onEnd,   { passive: true });
  target.addEventListener('touchcancel',onEnd,   { passive: true });
}

function setupInput(socket) {
  document.addEventListener('keydown', (event) => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      socket.emit('player_input', { direction });
    }
  });

  setupSwipe(socket);
}
