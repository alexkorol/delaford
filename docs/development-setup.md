# Development Setup

Delaford historically targeted the archived 2020-era runtime stack, but the project now runs (and is tested) on current Node LTS releases. The steps below capture everything you need to get the modern toolchain working without guesswork.

## Prerequisites

- **Node.js 22.x** (current LTS) and the bundled npm 10.x.
  The repository publishes the version in multiple formats (`.nvmrc`, `.node-version`, `.tool-versions`, and the `volta` block in `package.json`) so whichever tool you use can pick it up automatically.
  - **nvm**: `nvm install` then `nvm use`
  - **nvm-windows**: `nvm install 22` then `nvm use 22`
  - **Volta**: `volta install` inside the project folder
  - **asdf**: `asdf install`
- Git, and a working C compiler toolchain if you are on Windows (needed for native node-gyp modules).
- You do **not** need any global Vue CLI installs. The repo uses [Vite](https://vitejs.dev/) for dev/build tooling and [Pinia](https://pinia.vuejs.org/) for client-side state, both already defined as local dependencies and exposed through npm scripts.

## First-time setup

1. Clone your fork and enter the directory.
   ```bash
   git clone git@github.com:YOUR_USERNAME/delaford_fork.git
   cd delaford_fork
   ```
2. Install **and select** a runtime that matches `.nvmrc` / `.tool-versions`. The fork is tested on Node.js 22 / npm 10. Examples:
   ```bash
   nvm install
   nvm use
   node -v   # v22.x
   npm -v    # 10.x
   ```
3. Install dependencies.
   ```bash
   npm install
   ```
   The install pulls both the Vite-powered client dependencies and the Express/WebSocket server dependencies. No additional post-install build is required for local development.

## Daily workflow

- Start everything with one command:
  ```bash
  npm run dev
  ```
  This runs the Vite dev server and the Express/WebSocket backend in parallel via `concurrently`. Both processes hot-reload on file changes.
- Visit `http://localhost:5173` to interact with the game client. The Express API and WebSocket game server share `http://localhost:6500` / `ws://localhost:6500`.
- Want to debug the backend only? Use `npm run dev:server`. For client-only work use `npm run dev:client`.

## Optional environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PLAYER_AUTO_SAVE_INTERVAL_MS` | Frequency for the server scheduler to flush all connected players to persistent storage. | `120000` (2 minutes) |
| `PLAYER_SAVE_COOLDOWN_MS` | Minimum delay between saves for the same player when the scheduler runs. Use lower values if you want very aggressive persistence. | `60000` (1 minute) |

The backend snapshots connected players in the background. Chronicle scions and local login profiles persist to SQLite; guest profiles use machine-local JSON snapshots. Raising the interval lowers write pressure, while lowering it gives quicker crash recovery at the cost of more frequent writes.

## Useful commands

- `npm run test:unit` - Vitest-powered unit tests.
- `npm run playtest` - Boot a disposable game server and play the full core loop over the real WebSocket protocol.
- `npm run test:e2e` - Build the client, boot the real game server, and exercise browser-critical guest play in Chromium.
- `npm run verify` - Run lint, stylelint, unit tests, the production build, the goal harness, and the browser smoke test.
- `npm run lint` / `npm run lint:css` - JS/Vue and stylesheet checks.
- `npm run build` - Production client bundle.
- `npm run preview` - Serve the production build locally for smoke testing.
- `npm run dev:server` - Run the Express/WebSocket backend with nodemon reloading.

## Game UI layout guardrails

The new Delaford shell layers several responsive systems on top of the map renderer. Keep these rules in mind when tweaking layout components:

1. **Canvas dimensions are real pixels.** `GameCanvas.vue` sets both the `<canvas>` attributes and the `--map-native-*` CSS vars from the active map config. If you stretch the canvas with CSS without updating the attributes, you will reintroduce sprite flicker/blur.
2. **`GameContainer` owns the stage grid.** The `game-container__world-shell` grid exposes `--world-*` custom props (width, height, aspect ratio) that downstream components consume. Add new overlays/HUD pieces inside this grid so they inherit the same sizing.
3. **PaneHost breakpoints are only `desktop`, `tablet`, `mobile`.** Desktop (≥1200px) shows both left/right panes, tablets collapse to two columns, and mobile stacks everything. When editing breakpoints, verify that inventory/stats remain reachable on intermediate widths.
4. **Chat and HUD share the stage width.** Any change to chat placement must preserve `width: min(var(--world-display-width), 100%)` so the chat rail never drifts over the map.
5. **Verification checklist.** After layout changes run `npm run dev`, open the client at 1440px, 1024px, and 768px widths, and walk around for ~30 seconds to ensure the player sprite no longer flickers or clips behind UI layers.

## Troubleshooting Tips

- After switching Node versions, remove `node_modules` and run `npm install` to refresh native bindings.
- Local authentication and Chronicle state use the SQLite database under `server/data/` by default.
- Clearing `node_modules` (`rm -rf node_modules`) and reinstalling often resolves residual dependency issues after switching Node versions.
