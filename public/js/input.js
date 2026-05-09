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

function setupInput(socket) {
  document.addEventListener('keydown', (event) => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      socket.emit('player_input', { direction });
    }
  });
}
