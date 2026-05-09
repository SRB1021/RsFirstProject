# Ghost Pacman — Project Context

A multiplayer browser game where players control ghosts chasing an AI-controlled Pacman.
Built by a beginner coder learning the ropes with Claude Code.

## How to Run

```bash
npm install        # only needed once
node server.js     # starts the game server
```

Then open `http://localhost:3000` in your browser.
Share the link with friends on the same network to play together!

## What This Game Does

- Up to **4 players** join via browser — each controls one ghost
- Empty ghost slots become **CPU-controlled** automatically
- **AI Pacman** wanders the maze eating dots, trying to avoid ghosts
- **Ghosts win** if they catch Pacman
- **Pacman wins** if he eats all the dots

---

## Project File Map

```
RsFirstProject/
├── server.js                  ← Node.js server: game loop + Socket.io connections
├── package.json               ← Dependencies: express, socket.io
├── railway.json               ← Railway deployment config
│
├── game/                      ← Server-side logic (runs on YOUR computer, not browser)
│   ├── maze.js                ← 28×31 tile grid (0=floor, 1=wall, 2=dot, 3=power pellet)
│   ├── gameState.js           ← All positions, scores, who's playing which ghost
│   ├── pacmanAI.js            ← AI that moves Pacman (prefers dots, avoids ghosts)
│   └── ghostAI.js             ← AI that moves CPU ghosts (each has different target logic)
│
└── public/                    ← Browser files (what players download)
    ├── index.html             ← The webpage with the canvas + join button
    ├── style.css              ← Black background, yellow title, ghost game look
    └── js/
        ├── constants.js       ← Shared numbers: TILE_SIZE=20, ghost colors, tile types
        ├── input.js           ← Arrow keys / WASD → socket.emit('player_input')
        ├── renderer.js        ← Draws maze walls, dots, Pacman (mouth wedge), ghosts (wavy skirt)
        └── main.js            ← Connects to server, handles lobby/game screens, calls draw()
```

---

## How Multiplayer Works

The server runs the game and sends updates to all browsers 6-7 times per second (every 150ms).

```
Player presses arrow key
  → browser sends: socket.emit('player_input', { direction: 'left' })
  → server stores the input
  → next game tick: server moves ghost, moves Pacman AI, moves CPU ghosts
  → server sends full game_state to every browser
  → each browser redraws the canvas
```

### Socket Events
| Event | Who sends it | What it means |
|---|---|---|
| `join_game` | Browser → Server | Player clicks Join |
| `player_input` | Browser → Server | Arrow key pressed |
| `game_joined` | Server → Browser | "You are Blinky!" |
| `game_state` | Server → Browser | Full positions every 150ms |
| `game_over` | Server → Browser | Someone won |
| `request_restart` | Browser → Server | Play Again clicked |

---

## The 4 Ghosts

| Ghost | Color | CPU Behavior |
|---|---|---|
| Blinky | Red | Chases Pacman directly |
| Pinky | Pink | Aims 4 tiles AHEAD of Pacman |
| Inky | Cyan | Chases Pacman directly (simple version) |
| Clyde | Orange | Chases when far, retreats to corner when close |

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Project setup (npm, Express, Socket.io) | ✅ Done | `npm install` to set up |
| Maze tile grid (28×31) | ✅ Done | `game/maze.js` |
| Game state management | ✅ Done | `game/gameState.js` |
| Pacman AI | ✅ Done | Prefers dots, avoids ghosts |
| Ghost AI (CPU + human) | ✅ Done | Each ghost has different target logic |
| Server game loop | ✅ Done | Runs every 150ms |
| HTML canvas page | ✅ Done | Lobby + game screen |
| Renderer (maze, Pacman, ghosts) | ✅ Done | Ghosts have wavy skirt + eyes |
| Player input (arrow keys + WASD) | ✅ Done | `public/js/input.js` |
| Win/lose detection + game over | ✅ Done | Ghost catches Pacman OR dots = 0 |
| Auto-CLAUDE.md update hook | ✅ Done | `.claude/settings.json` Stop hook |
| Railway deployment config | ✅ Done | `railway.json` + PORT env var |
| **Pushed to GitHub** | ✅ Done | github.com/SRB1021/rsfirstproject |

---

## What's Next (Ideas for Future Features)

- [ ] Sound effects when Pacman is caught
- [ ] Animated mouth on Pacman (open/close as it moves)
- [ ] Score display (points per dot eaten)
- [ ] High score leaderboard
- [ ] Power pellets that make ghosts run away (scared mode)
- [ ] Better ghost shapes (more detailed sprites)
- [ ] Mobile touch controls
- [ ] Lobby screen showing who's connected before game starts

---

## Key Design Decisions

- **Server is the judge**: The server decides all positions. Browsers just draw what they're told. This prevents cheating and keeps everyone in sync.
- **Tile coordinates**: Positions are stored as grid column/row (not pixels). The renderer converts to pixels when drawing. Makes collision detection simple: just check if two things are at the same tile.
- **150ms game tick**: Fast enough to feel smooth, slow enough to be easy to understand.
- **No database**: Game state lives in server memory and resets when server restarts. Perfect for a first project!
