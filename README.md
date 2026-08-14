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

The Vite dev server runs at `http://localhost:5173`. The game server and its
WebSocket protocol share `http://localhost:6500`.

Before treating a gameplay change as complete, run the real loop:

```bash
npm run build        # bundle the client via Vite
npm run test:unit    # execute Vitest-powered unit tests
npm run playtest     # play the core loop over the real WebSocket protocol
npm run smoke:browser # build, boot a real server, and drive the Playwright smoke
npm run verify       # run every release gate above, plus lint and style checks
```

The playtest boots a server and drives login, movement, combat, loot, zones,
and skill-tree persistence through the production WebSocket protocol.
Troubleshooting tips and platform-specific notes live in [`docs/development-setup.md`](docs/development-setup.md).

## Roadmap

- [x] Foundation & Tooling — one-command release verification now covers lint,
  unit tests, production build, real-protocol playtests, and a built-browser loop.
- [x] Gameplay Core — shared Str/Dex/Int stats, soft and mortal death loops,
  authoritative quests, cheat death, combat, and passive-tree persistence.
- [ ] Inventory & Items — the 12×7 spatial backpack, equipment, Vesselforge
  affixes, tooltips, and pointer drag are live; nested containers remain.
- [x] UI/UX — PoE-inspired panes, closable chat, responsive 2.5D rendering,
  context menus, minimap, HUD orbs, and quickbar are browser-proven.
- [x] Monsters & Combat — shared stat scaling, role AI, support healing,
  generated bosses, feedback, loot, and interpolated movement are playable.
- [x] Networking & World — persistent town, solo and party instances,
  procedural layouts, depth transitions, and two-client party flow are live.

The focused path from the current playable build to 1.0 is maintained in
[`docs/vision.md`](docs/vision.md#release-runway-toward-10).

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
