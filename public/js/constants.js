// Size of each tile in pixels
const TILE_SIZE = 20;

// Maze dimensions (must match maze.js on the server)
const MAZE_COLS = 28;
const MAZE_ROWS = 31;

// Ghost colors
const GHOST_COLORS = {
  Blinky: '#FF0000',  // Red
  Pinky:  '#FFB8FF',  // Pink
  Inky:   '#00FFFF',  // Cyan
  Clyde:  '#FFB852',  // Orange
};

// Tile type numbers (must match maze.js on the server)
const TILE_EMPTY      = 0;
const TILE_WALL       = 1;
const TILE_DOT        = 2;
const TILE_POWER      = 3;
const TILE_GHOST_HOME = 4; // ghost house — rendered as empty space
