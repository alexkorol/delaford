# Verdigris

Verdigris is a multiplayer action RPG about persistent Houses and mortal
scions. Descend through procedural instances, shape a build through loot and a
271-node passive lattice, and leave a permanent crypt record when a scion
falls. Notable equipment from the dead can circulate back into future world
drops.

## Run locally

Requirements: Node 22+ and npm 10+.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The client runs on port 5173 and the game/API
server on port 6500.

Before treating a gameplay change as complete, run the real loop:

```bash
npm run test:unit
npm run playtest
```

The playtest boots a server and drives login, movement, combat, loot, zones,
and skill-tree persistence through the production WebSocket protocol.

## Project layout

- `server/` — authoritative world, combat, accounts, and Chronicle persistence
- `src/` — Vue client, canvas renderer, and interface
- `playtest/` — headless playable-loop harness
- `tests/` — focused unit and balance specifications
- `docs/` — design, operations, and deployment notes

## Attribution

Verdigris grew from Delaford, created by Dan Jasnowski, and preserves its
MIT-licensed foundation. The original copyright notice remains in `LICENSE`.
Additional asset-specific credits are kept beside their respective assets.
