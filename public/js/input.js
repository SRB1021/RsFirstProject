// Listen for arrow key presses and send them to the server.
// The socket variable is set up in main.js and available globally.

const KEY_TO_DIRECTION = {
  ArrowLeft:  'left',
  ArrowRight: 'right',
  ArrowUp:    'up',
  ArrowDown:  'down',
  // WASD support too
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
};

function setupInput(socket) {
  document.addEventListener('keydown', (event) => {
    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault(); // stop the page from scrolling
      socket.emit('player_input', { direction });
    }
  });
}
