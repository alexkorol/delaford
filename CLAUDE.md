# Verdigris — agent guide

Vue 3 + Vite client (:5173) and Node WS server (:6500, PORT is pinned).
`Z:\Code\WIZARD` is the prototype sandbox whose tools get ported here.

## The rule: prove playability by playing

**Before you claim a gameplay change works — and always before ending a
"fix/test the game" task — run the goal harness:**

```bash
npm run playtest            # boots a real server, plays the core loop, exit 0 = playable
npm run playtest -- combat  # a single scenario
npm run playtest -- --attach  # reuse the running dev server on :6500
```

It moves, fights (healer packs), loots via the real context menu, enters
every Adventure zone, and relogs to check skill-tree persistence. Green unit
tests are NOT sufficient: five shipped bugs (lost skill allocations,
unkillable healer packs, dead WASD, dead right-click, two-shot monsters)
hid behind a fully green suite. See `playtest/README.md` for the
headless-player API (`HeadlessPlayer.connect()`, `state()`, `move()`,
`attack()`, `enterZone()`, `takeItem()`) and wiz commands (`dev:teleport`,
`dev:give`, `dev:setlevel`, `dev:heal`, `dev:state`).

The harness covers server truth over the real protocol. After CLIENT/UI
changes also do a short browser pass (`preview_start` config `delaford-dev`):
WASD after clicking a UI element, right-click canvas + inventory, open/close
skill tree.

## Commands

```bash
npm run dev          # client :5173 + server :6500
npm run test:unit    # vitest
npm run lint         # eslint
npm run playtest     # goal harness (see above)
```

## Conventions

- Commit locally; NEVER push (the user pushes).
- Big commits can SIGKILL the lint-staged hook — lint manually first, retry.
- Socket handlers receive the full message `{event, data}`; the client
  payload is at `data.data`.
- Balance/tuning changes must be measured through the real pipeline
  (see tests/unit/instance-balance.spec.js, surface-monster-balance.spec.js),
  not guessed.
