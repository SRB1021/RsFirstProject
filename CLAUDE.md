# Ghost Pacman — Project Context

A multiplayer browser game where players control ghosts chasing an AI-controlled Pacman.
Built by a beginner coder learning the ropes with Claude Code.

## How to Run

```bash
npm install        # only needed once
node server.js     # starts the game server
```

Then open `http://localhost:3000` in your browser.

## Live on Railway
Auto-deploys from github.com/SRB1021/rsfirstproject on every push to `main`.

## What This Game Does

- Up to **4 players** join via browser — each controls one ghost
- Empty ghost slots become **CPU-controlled** automatically
- **AI Pacman** wanders the maze eating dots, trying to avoid ghosts
- **Power pellets** (big dots) make all ghosts turn blue — Pacman hunts them!
- **Ghosts win** if they catch Pacman while he's not powered up
- **Pacman wins** if he eats all the dots

---

## Project File Map

```
RsFirstProject/
├── server.js                  ← Node.js server: game loop + Socket.io connections
├── package.json               ← Dependencies: express, socket.io
├── railway.json               ← Railway deployment config
│
├── game/                      ← Server-side logic
│   ├── maze.js                ← 28×31 tile grid (0=floor, 1=wall, 2=dot, 3=power pellet)
│   ├── gameState.js           ← All positions, scores, who's playing which ghost
│   ├── pacmanAI.js            ← AI: eats dots, avoids normal ghosts, HUNTS scared ones
│   └── ghostAI.js             ← CPU ghosts chase Pacman; scared ghosts run away
│
└── public/                    ← Browser files
    ├── index.html
    ├── style.css
    └── js/
        ├── constants.js       ← TILE_SIZE=20, ghost colors, tile types
        ├── input.js           ← Arrow keys / WASD → socket.emit
        ├── renderer.js        ← Draws everything; lerps positions for smooth motion
        └── main.js            ← Socket connection, 60fps render loop, UI
```

---

## How Multiplayer Works

Server ticks every 150ms. Browser renders at 60fps using interpolation.

```
Player presses arrow key
  → browser sends: socket.emit('player_input', { direction: 'left' })
  → server moves ghost on next tick
  → server sends full game_state to every browser
  → browser lerps characters smoothly to new positions at 60fps
```

---

## The 4 Ghosts

| Ghost | Color | CPU Behavior |
|---|---|---|
| Blinky | Red | Chases Pacman directly |
| Pinky | Pink | Aims 4 tiles AHEAD of Pacman |
| Inky | Cyan | Chases Pacman directly |
| Clyde | Orange | Chases when far, retreats to corner when close |

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Project setup | ✅ Done | |
| Maze tile grid (28×31) | ✅ Done | `game/maze.js` |
| Game state management | ✅ Done | `game/gameState.js` |
| Pacman AI | ✅ Done | Avoids normal ghosts, hunts scared ones |
| Ghost AI (CPU + human) | ✅ Done | Each ghost has different target logic |
| Server game loop | ✅ Done | Runs every 150ms |
| HTML canvas page | ✅ Done | Lobby + game screen |
| Renderer | ✅ Done | Ghosts have wavy skirt + eyes |
| Player input (arrow keys + WASD) | ✅ Done | |
| Win/lose detection | ✅ Done | Ghost catches Pacman OR dots = 0 |
| Auto-CLAUDE.md update hook | ✅ Done | `.claude/settings.json` Stop hook |
| Railway deployment | ✅ Done | Auto-deploys on push to main |
| Power pellet scared mode | ✅ Done | Ghosts turn blue; Pacman hunts them; respawn on catch |
| Tunneling bug fix | ✅ Done | Collision checked after ghosts move AND after Pacman moves |
| Pacman hunts scared ghosts | ✅ Done | AI attracted to blue ghosts |
| Smooth movement | ✅ Done | 60fps lerp in `main.js` + `renderer.js` |

---

## What's Next (Ideas)

- [ ] Score display (points per dot/ghost eaten)
- [ ] Animated Pacman mouth (open/close)
- [ ] Sound effects
- [ ] High score leaderboard
- [ ] Mobile touch controls
- [ ] Lobby screen showing connected players before game starts

---

## Key Design Decisions

- **Server is the judge**: All positions decided server-side. Browsers just draw what they're told.
- **Tile coordinates**: Grid col/row internally; pixels only at draw time. Collision = same tile.
- **150ms server tick + 60fps client lerp**: Game logic is simple to reason about; visuals are smooth.
- **No database**: State resets on server restart. Perfect for a first project.
