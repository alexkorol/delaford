> Archived: completed or superseded implementation plan retained for historical context.

# Smooth Movement Redesign

Last updated: 2025-10-14

## Goal
Deliver smooth, interpolated movement for the local player, other players, NPCs, and monsters without regressing gameplay behaviour or server authority.

## Non-goals
- Rewriting the entire networking stack.
- Changing combat/interaction logic (except where movement data wiring requires it).
- Introducing physics-based collision beyond the current tile blocking rules.

## Current State (2025-10-13)
- **Server authority**: `Player.move()` (`server/core/player.js:144`) mutates integer tile coordinates per step. Pathfinding loop (`Player.walkPath`) recursively queues `player:movement` broadcasts without timing metadata.
- **Network payloads**: `player:movement` events push the whole player object with updated `x`/`y` integers; clients immediately overwrite their local copies (`src/core/player/events/player.js:26`).
- **Rendering**: The engine loop (`src/core/engine.js`) renders at a throttled FPS (default 20). `Map.drawPlayer()` and `drawPlayers()` rely on integer tile offsets relative to the viewport; there is no sub-tile precision (`src/core/map.js:232+`).
- **Local prediction**: Client pathfinding (`Map.path` state) requests server movement per tile and waits for ack; no interpolation or blending.
- **Remote entities**: NPCs and other players are snap-drawn based on last broadcast tile.

## Target Architecture
1. **Entity state wrapper**  
   Introduce a shared client-side structure for all actors:
   ```js
   {
     tile: { x, y },          // authoritative tile
     render: { x, y },        // sub-tile float position (pixels)
     previous: { x, y },      // last render target for interpolation
     next: { x, y },          // upcoming tile target
     lastUpdate: number,      // ms timestamp the server update was observed
     eta: number,             // expected travel time (ms) for current leg
     speed: number            // pixels per second
   }
   ```
   Local player, remote players, and NPCs will all use a thin abstraction (e.g., `MovementController`) responsible for evolving `render` between `previous` and `next`.

2. **Consistent timing**  
   - Define a canonical move duration (e.g., `MOVE_TIME = 300ms` per tile) derived from existing pathfinder cadence.
   - Broadcast this value (or actual tick timestamp) when emitting `player:movement` and NPC movement events so clients can compute interpolation alpha.

3. **Render loop integration**  
   - Upgrade `Engine.loop` to compute delta time rather than just throttled frames.  
   - `Map.draw*` methods consume `render` coordinates (in pixels) instead of integer tiles. Introduce helper conversions for viewport translation.
   - Maintain camera centering using interpolated local player position.

4. **Input/prediction**  
   - Local movement should optimistically advance `render` immediately while waiting for server confirmation; on divergence, snap back with smoothing.
   - Pathfinding should enqueue waypoints with timestamps so interpolation knows how long each leg should take.

5. **Legacy compatibility**  
   - Keep tile-based collision checks and server-side logic intact to mitigate regression risk.
   - Provide feature flags / fallbacks for testing (e.g., toggle smoothing via settings).

## Incremental Implementation Plan

> Each milestone is designed to land cleanlyâ€”compile, lint, and runâ€”so we can pause/resume between sessions.

### Milestone 0 â€“ Scaffolding (in progress)
- âœ… Document architecture, goals, and unknowns.
- â˜ Introduce progress logging (this document).

### Milestone 1 â€“ Client abstractions
1. Create shared movement constants (`src/core/config/movement.js`) capturing tile size, move speed, frame cap.
2. Add a `MovementController` class managing interpolation state per entity.
3. Update local player data (`Client.buildMap`) to wrap the raw JSON into the controller without changing rendering (bridge pattern).

### Milestone 2 â€“ Rendering pipeline
1. Refactor `Map.drawPlayer/Players/NPCs` to work with `render` coordinates while still falling back to tile centers if interpolation data is missing.
2. Enhance `Engine.loop` to compute `deltaTime` and forward it to `Map.update(delta)` before drawing.
3. Add camera smoothing around interpolated positions.

### Milestone 3 â€“ Server timing metadata
1. Emit movement duration (or timestamps) alongside `player:movement` events.
2. Mirror the same metadata for NPC/monster updates.
3. Ensure backward compatibility by defaulting to existing behaviour when metadata is absent.

### Milestone 4 â€“ Local player prediction
1. When issuing movement commands, initialise interpolation immediately and reconcile on server ack.
2. Handle interruptions (new click, path break) by cancelling active interpolation segments gracefully.

### Milestone 5 â€“ Remote entities & NPCs
1. Apply interpolation controller to `map.players` array and NPC list.
2. Implement idle decay so entities stop smoothly when no new updates arrive.

### Milestone 6 â€“ Polish
- Settings toggle, QA instrumentation (debug overlay with `alpha`, `eta`).
- Regression tests (unit tests for controller math, integration sanity checks).
- Documentation updates, migration notes.

## Open Questions
- Do we maintain pixel-perfect alignment with existing sprite sheets (32px tiles) or introduce sub-tile offsets for animations?
- Should server broadcast absolute timestamps (requires clock sync) or rely on client-side assumed duration?
- How are monsters currently updated? Need to locate their event flow before Milestone 5.

## Progress Log

| Date (UTC) | Summary | Notes |
|------------|---------|-------|
| 2025-10-13 | Initial analysis of existing movement pipeline; drafted target architecture and milestone plan. | Next: scaffold movement constants, build `MovementController` skeleton. |
| 2025-10-14 | Added shared movement constants, initial `MovementController`, and attached controller to local player state (no rendering changes yet). | Next: refactor rendering loop to consume controller output. |
| 2025-10-14 | Engine loop now feeds delta time, camera offsetting keeps the view smooth, and local player movement triggers interpolation via `startMove`. Remote entities still snap. | Next: extend controller usage to other players/NPCs and introduce camera smoothing. |
| 2025-10-14 | Added fractional camera offsets, extra tile padding, and integer-aligned draws to remove seams / white bars; mouse hit-tests now include camera offsets. | Next: smooth remote entities and revisit sprite animation states. |
| 2025-10-14 | Enabled diagonal movement (server pathfinder + move commands) and adjusted client interpolation durations for diagonal steps. | Next: extend keyboard controls and animate remote entities with eased motion. |
| 2025-10-14 | Added continuous keyboard repeat, re-used movement controllers for joined players/NPC updates, and render remote entities/items with interpolated screen-space positions. | Next: surface server timing metadata and wire sprite animations to movement states. |
| 2025-10-15 | Replaced `node-sass` with Dart Sass, upgraded `sass-loader`, and added OpenSSL-compatible build flags so the repo installs and builds on Node 18/20/22. | Next: clean up Sass deprecation warnings (use `color.adjust` instead of legacy helpers). |
