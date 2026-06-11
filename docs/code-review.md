# Delaford Codebase Review

**Date:** 2026-02-24
**Branch:** `claude/review-delaford-codebase-DhYMP`
**Reviewer:** Claude (automated)

---

## Executive Summary

Delaford is a multiplayer 2D action-RPG built with a **Vue 3 / Pinia** client rendered on HTML5 Canvas and an **Express + WebSocket** game server running on Node 22. The codebase is approximately **31,000 lines** across ~140 source files.

**Overall assessment:** The project is in good shape for a prototype/early-alpha. The architecture is clean, the build pipeline works, and linting is enforced. There are several areas that need attention before scaling further, particularly around security, testing coverage, and client-server coupling.

### Scorecard

| Area | Grade | Notes |
|---|---|---|
| Build & Tooling | **A** | Vite + Vitest + ESLint + Playwright all configured and working |
| Code Quality | **B+** | Clean, readable code; consistent style; good use of JSDoc |
| Architecture | **B** | Clear separation of concerns; some coupling via global singletons |
| Test Coverage | **C** | 44 unit tests pass, but many subsystems are untested |
| Security | **C-** | Several issues around input validation and WebSocket message handling |
| Documentation | **B** | README, vision doc, and inline comments are good; API docs are thin |
| Performance | **B** | Double-buffered canvas, accumulator-based game loop; some areas to optimize |

---

## 1. Project Structure

```
delaford_game/
  server/              # Game server (Express + WebSocket)
    Delaford.js        # Main game class, game loop, connection handling
    index.js           # HTTP server, API routes, graceful shutdown
    socket.js          # WebSocket emit/broadcast helpers
    config.js          # Map size, tile dimensions, game constants
    core/              # World state, entities, items, maps
      world.js         # WorldManager singleton (scenes, players, instances)
      map.js           # Server-side map loading
      item.js          # Item spawn/check logic
      monster.js       # Monster spawning and tick loop
      npc.js           # NPC loading and movement
      entities/        # ECS-lite, AI controllers, movement handlers
      items/           # Affix engine (brands/bonds), item factory
      data/            # Static game data (items, NPCs, monsters, maps)
      services/        # Name validation, player persistence
    player/            # Authentication, handler dispatch, player actions
    shared/            # Shared utilities (map-utils, stats, UI helpers, combat)
    maps/              # Raw map data files
  src/                 # Vue 3 client
    main.js            # App bootstrap, WebSocket init
    Delaford.vue       # Root component
    core/              # Client game engine, map rendering, input, inventory logic
      engine.js        # Main render loop (requestAnimationFrame)
      client.js        # Game client setup
      map.js           # Canvas tile/entity rendering
    components/        # Vue components (HUD, inventory, panes, auth, passives)
    stores/            # Pinia stores (UI state, inventory)
    plugins/           # Global component registration
  tests/               # Test suites
    unit/              # 11 Vitest spec files (44 tests)
  docs/                # Project documentation
```

---

## 2. Build & Tooling (Grade: A)

**What works well:**
- `npm run dev` uses `concurrently` to start Vite dev server + nodemon game server in parallel
- Vite 5 build produces a well-optimized bundle (~429 KB JS gzipped to ~143 KB)
- ESLint 9 flat config with Vue plugin; stylelint for SCSS/Vue styles
- `lint-staged` + `yorkie` git hooks for pre-commit quality gates
- Volta pinning for Node 22.11.0 / npm 10.9.2
- Vitest for unit tests, Playwright for e2e
- Source maps enabled in production build

**Issues found:**
- **No `test` script alias.** `npm test` fails; only `test:unit` and `test:e2e` exist. Convention is to have `"test": "npm run test:unit"` so CI and contributors can use the standard `npm test`.
- **jsdom resolution at runtime.** `vitest.config.js` uses `createRequire` to check if `jsdom` is installed. jsdom is not in `devDependencies`, so tests default to `node` environment. If any test needs DOM APIs, it will silently fail. Consider either adding `jsdom` or documenting the choice.
- **`baseline-browser-mapping` warning** during test runs: "data in this module is over two months old." A minor annoyance but worth updating.

---

## 3. Code Quality (Grade: B+)

**Strengths:**
- Consistent coding style enforced by ESLint
- Good use of JSDoc comments on public methods
- Defensive coding throughout (null checks, safe defaults)
- Clean module boundaries; each file has a clear single responsibility
- `structuredCloneSafe` fallback in affix engine shows attention to compatibility

**Areas for improvement:**
- **`new Error({...})` in `authentication.js:35`.** `Error` constructor expects a string; passing an object produces `"[object Object]"` as the error message. Should be `new Error('Username and password are incorrect.')` or a custom error class.
- **Promise anti-pattern in `authentication.js`.** Methods `getToken`, `getProfile`, and `logout` wrap axios (which already returns Promises) in `new Promise()`. This is unnecessary and loses error stack traces. Prefer `async/await` or returning the axios promise directly.
- **`console.log` for errors.** Several places use `console.log(error)` instead of `console.error`. Examples: `Delaford.js:109`, `authentication.js:59`.
- **Magic numbers.** Tile offset `252` in `movement-handler.js:225` and background/foreground index calculations should be named constants.
- **`node-emoji` dependency.** Used only for console log decorations (`rocket`, `alarm_clock`, etc.). This adds unnecessary weight. Consider removing or replacing with simple Unicode characters.

---

## 4. Architecture (Grade: B)

### Server Architecture

The server follows a **singleton-based architecture** centered around the `WorldManager`:

- `world.js` exports a single `WorldManager` instance that acts as the global game state
- The game loop in `Delaford.js` uses a `setTimeout`-based tick with accumulator-based periodic tasks (NPC movement, monster AI, item respawns, auto-save)
- WebSocket messages are dispatched through a flat `Handler` object that maps event names to functions
- Entities use a lightweight ECS (`ecs-lite.js`) for monster AI, with component-based state and system functions

**Strengths:**
- Clean game loop with configurable intervals and scheduler stats logging
- Graceful shutdown handling with signal trapping and timeout
- Scene-based world partitioning (towns, instances) ready for instanced content
- The ECS-lite pattern is appropriately lightweight for this scale

**Concerns:**
- **Global mutable singleton.** `WorldManager` is the single source of truth for all game state. This makes testing harder (tests must reset world state) and prevents horizontal scaling. Acceptable for a prototype but will become a bottleneck.
- **No rate limiting on WebSocket messages.** Any client can flood the server with events.
- **Handler dispatch is unsafe.** `Handler[data.event](data, ws, this)` in `Delaford.js:248` calls whatever method name the client sends. If a client sends `{event: "constructor"}` or `{event: "toString"}`, it would invoke inherited Object methods. This is a **security risk** (see Section 6).
- **Pathfinding runs on the main thread.** The `walkPath` function uses recursive `setTimeout` scheduling which works but could cause stalls if many players pathfind simultaneously.

### Client Architecture

- Vue 3 SPA with Pinia stores for UI state and inventory
- Custom canvas rendering engine (`Engine` + `Map`) running at a capped 20 FPS
- WebSocket connection established in `main.js`, stored as `window.ws` (global)
- Event-based communication using `mitt` bus for internal component messaging

**Strengths:**
- Double-buffered canvas rendering prevents flicker
- Frame rate capping prevents unnecessary CPU usage
- Good component decomposition (HUD, inventory grid, panes, auth)
- Pinia stores with persisted state for client-side data

**Concerns:**
- **`window.ws` global.** The WebSocket is attached to `window`, making it accessible from the console and any injected script. Should be encapsulated.
- **`window.focusOnGame` global.** Minor, but globals invite conflicts.
- **20 FPS cap.** This is quite low for an action RPG. Consider making this configurable per-user (the setting hook exists via `SETTINGS:FPS` event but defaults to 20).
- **No WebSocket reconnection logic.** If the connection drops, the client doesn't attempt to reconnect.

---

## 5. Test Coverage (Grade: C)

**Current state:** 11 test files, 44 passing tests.

**What's tested:**
- World manager (scene CRUD, player assignment)
- Client socket utility (queue, event handling)
- Context menu (strategy registry, action execution)
- Monster melee behaviour (attack, idle, chase)
- Movement controller (direction delta, step duration)
- Inventory system (grid collision, stacking, placement)
- Flower of life passive tree (node connections, path finding)
- Skills schema (validation)
- Socket broadcast (multi-client emission)
- UI utilities

**What's NOT tested (gaps):**
- Authentication flow
- Player handler dispatch (the entire RPC layer)
- Affix engine (brands/bonds rolling)
- Item factory
- Player persistence service
- Name validation service
- Map loading and tile walkability
- Server startup/shutdown lifecycle
- Any Vue component rendering
- Any e2e gameplay flows (Playwright config exists but no test files found in the expected location)

**Recommendation:** Prioritize testing the affix engine (pure functions, easy to test), the handler dispatch (critical path), and authentication. Target 60%+ line coverage as a near-term goal.

---

## 6. Security (Grade: C-)

### Critical Issues

1. **Unsafe handler dispatch** (`server/Delaford.js:248`)
   ```js
   Handler[data.event](data, ws, this);
   ```
   A malicious client can send any event name. If the event name matches an inherited property (e.g., `constructor`, `__proto__`, `toString`), this will either throw or behave unexpectedly. **Fix:** Add a whitelist check:
   ```js
   if (!Object.prototype.hasOwnProperty.call(Handler, data.event)) {
     console.warn(`Unknown event: ${data.event}`);
     return;
   }
   ```

2. **No input validation on WebSocket messages** (`server/Delaford.js:244`)
   ```js
   const data = JSON.parse(msg);
   ```
   If a client sends invalid JSON, this will throw and crash the connection handler. There's no try/catch, no schema validation, and no size limit on incoming messages.

3. **World state endpoints expose internal data** (`server/index.js:96-99`)
   ```js
   app.get('/world/items', (_req, res) => res.send(world.items));
   app.get('/world/players', (_req, res) => res.send(world.players));
   ```
   These REST endpoints expose raw game state to anyone. The `/world/players` endpoint likely leaks player tokens, socket IDs, and other sensitive data. These should be removed or protected.

### Moderate Issues

4. **No WebSocket authentication.** Any client that connects gets a UUID and full server access. There's no token verification on the WebSocket upgrade.
5. **No rate limiting** on either HTTP endpoints or WebSocket messages.
6. **`SITE_URL` from environment** used in `authentication.js` for API calls without validation. If misconfigured, auth requests could go to an unintended host.

---

## 7. Performance (Grade: B)

**Good practices observed:**
- Server game loop uses `setTimeout` with accumulator-based task scheduling, avoiding drift
- Scheduler stats logging tracks tick cadence and max delta for monitoring
- Client uses double-buffered canvas rendering
- Client FPS is capped to avoid unnecessary redraws
- `computeStepDuration` adjusts movement timing for diagonal movement

**Potential improvements:**
- **Large audio asset in bundle.** `main_menu-CL0eeM48.mp3` is 5 MB. Consider lazy-loading or compressing further.
- **Pathfinding library.** Uses the `pathfinding` npm package which is fine for small maps but may become a bottleneck on larger maps. Consider caching paths or using a web worker.
- **Monster AI creates new ECS world per monster.** Each monster gets its own `createWorld()` instance. For large monster counts, consider a shared ECS world.
- **No object pooling.** Items, monsters, and movement steps create new objects on every tick. For a game server, object pooling can significantly reduce GC pressure.
- **`Array.filter` for player/item lookups.** Several hot paths use `Array.filter` or `Array.find` on the world's player/item lists. For scaling, consider indexed lookups (Map by UUID).

---

## 8. Dependencies

### Production (notable)

| Package | Version | Notes |
|---|---|---|
| vue | ^3.5.12 | Core UI framework |
| pinia | ^2.2.6 | State management |
| express | ^5.0.1 | HTTP server (Express 5 - still in beta/RC, monitor for stability) |
| ws | ^8.18.3 | WebSocket server |
| pathfinding | ^0.4.18 | A* pathfinding for tile maps |
| axios | ^1.7.7 | HTTP client (used for auth API calls) |
| pm2 | ^6.0.13 | Process manager (production deployment) |
| lodash | ^4.17.21 | Utility library (check if still used; may be replaceable) |
| node-emoji | ^2.1.3 | Console log decoration only; consider removing |
| uuid | ^13.0.0 | Generates connection IDs |

### Observations
- **Express 5** is used (`^5.0.1`). This is relatively new and may have breaking changes compared to Express 4 tutorials/middleware. Ensure all middleware is Express 5 compatible.
- **lodash** is listed as a dependency but should be audited for actual usage. Modern JS may make it unnecessary.
- **`cross-env`** is a production dependency but should be a dev dependency (only used in npm scripts).

---

## 9. Actionable Recommendations

### Priority 1 (Security - fix now)
1. Add `hasOwnProperty` guard to WebSocket handler dispatch
2. Wrap `JSON.parse(msg)` in try/catch
3. Remove or protect `/world/players` and `/world/items` endpoints
4. Add WebSocket message size limits

### Priority 2 (Reliability - fix soon)
5. Fix `new Error({...})` in authentication.js
6. Refactor authentication.js to use async/await instead of Promise anti-pattern
7. Add `"test": "npm run test:unit"` to package.json scripts
8. Add WebSocket reconnection logic on the client
9. Add basic rate limiting to WebSocket message handling

### Priority 3 (Quality - plan for next sprint)
10. Increase test coverage to 60%+ (focus on affix engine, handler dispatch, persistence)
11. Move `cross-env` to devDependencies
12. Audit lodash usage and remove if not needed
13. Replace `node-emoji` with raw Unicode
14. Add indexed lookups (Map by UUID) for players/items in hot paths
15. Lazy-load the 5 MB menu audio file
16. Document the WebSocket message protocol (event names, payloads)

---

## 10. Build Verification

```
$ npm run build    -> OK (6.88s, 429 KB JS)
$ npm run lint     -> OK (0 warnings)
$ npx vitest run   -> OK (11 files, 44 tests, 2.02s)
```

All checks pass. The codebase is in a healthy, buildable state.
