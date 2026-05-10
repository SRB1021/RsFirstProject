// Listen for arrow key presses and send them to the server.
// The socket variable is set up in main.js and available globally.

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

// --- Virtual joystick for mobile ---

const DEAD_ZONE = 16; // px — ignore tiny movements

function createJoystick(socket) {
  const base  = document.getElementById('joyBase');
  const thumb = document.getElementById('joyThumb');
  if (!base || !thumb) return;

  let active = false;
  let originX = 0, originY = 0;
  let lastDir = null;

  function getDir(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  function onStart(e) {
    e.preventDefault();
    active = true;
    const touch = e.touches ? e.touches[0] : e;
    originX = touch.clientX;
    originY = touch.clientY;
    base.classList.add('active');
  }

  function onMove(e) {
    if (!active) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - originX;
    const dy = touch.clientY - originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = 40; // thumb travel radius px
    const clamp = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);
    thumb.style.transform =
      `translate(calc(-50% + ${Math.cos(angle) * clamp}px), calc(-50% + ${Math.sin(angle) * clamp}px))`;

    if (dist >= DEAD_ZONE) {
      const dir = getDir(dx, dy);
      if (dir !== lastDir) {
        lastDir = dir;
        socket.emit('player_input', { direction: dir });
      }
    }
  }

  function onEnd(e) {
    e.preventDefault();
    active = false;
    lastDir = null;
    thumb.style.transform = 'translate(-50%, -50%)';
    base.classList.remove('active');
  }

  base.addEventListener('touchstart',  onStart, { passive: false });
  base.addEventListener('touchmove',   onMove,  { passive: false });
  base.addEventListener('touchend',    onEnd,   { passive: false });
  base.addEventListener('touchcancel', onEnd,   { passive: false });
}

function setupInput(socket) {
  document.addEventListener('keydown', (event) => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      socket.emit('player_input', { direction });
    }
  });

  createJoystick(socket);
}
