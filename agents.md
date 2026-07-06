# Verdigris — agent guide (canonical)

This file is the single source of truth for AI coding agents (Claude Code,
OpenAI Codex, or any other). `CLAUDE.md` imports it. If you update agent
guidance, update THIS file.

Vue 3 + Vite client (`:5173`) and Node WebSocket server (`:6500`, PORT is
pinned — do not override it, the client hardcodes the WS URL).
`Z:\Code\WIZARD` is the prototype sandbox whose tools get ported here.

## THE RULE: prove playability by playing

**Before you claim a gameplay change works — and always before ending a
"fix/test the game" task — run the goal harness:**

```bash
npm run playtest              # boots a real server on :6510, plays the core loop
npm run playtest -- combat    # one scenario (movement|combat|loot|zones|skilltree)
npm run playtest -- --attach  # reuse an already-running dev server on :6500
```

Exit code 0 = playable, and the run terminates on its own (it kills the
server it booted) — safe for agents that must avoid long-lived processes.
It logs in, moves, fights a healer pack, loots through the real context
menu, enters every Adventure zone, and relogs to verify skill-tree
persistence — over the same WebSocket protocol the browser uses, against a
real server.

**Why this is non-negotiable:** five shipped bugs (skill tree losing
allocations, healers making packs unkillable, WASD dying after UI clicks,
right-click menus never opening, monsters two-shotting at-level players)
all hid behind a fully green 400+ unit-test suite. Unit tests prove
functions; the harness proves the game.

## Playtest harness API (playtest/harness.mjs)

```js
import HeadlessPlayer from './playtest/harness.mjs';

const p = await HeadlessPlayer.connect();   // guest login (dev account)
const s = await p.state();  // ONE authoritative server snapshot:
                            // x/y, hp/mana, lifecycle, scene name/type,
                            // layout/theme/depth/stairs, inventory, wear,
                            // passiveTree, alive monsters, ground items

await p.move('down', 3);                    // paced steps, like a held key
await p.enterZone('crypt', 'gauntlet');     // Adventure menu equivalent
await p.attack(s.monsters[0]);              // swing at target; auto-attack sustains
const menu = await p.rightClick(x, y);      // REAL server-built context menu
await p.takeItem(groundItem);               // right-click → Take → waits for pickup
p.useSkill('ability-1', 'left');
p.saveSkillTree(snapshot);
await p.waitFor(async () => predicate, { timeoutMs, label });
p.close();
```

Wiz/dev commands (server-side, disabled in production):
`p.devTeleport(x, y)` (follows portals), `p.devGive(itemId, qty)`,
`p.devSetLevel(n)`, `p.devHeal()`, `p.state()` (= `dev:state`).

**Adding a scenario:** one file in `playtest/scenarios/<name>.mjs`, default
export `async ({ connect, assert }) => {…}`. Add one for every new gameplay
feature. Full details: `playtest/README.md`.

## What the harness does NOT cover — browser pass

The harness drives server truth over the real protocol. Client-side bugs
(dead Vue event bindings, canvas focus traps, stale HUD labels, raw-HTML
rendering) are invisible to it. After client/UI changes, open the app in a
real browser (`npm run dev`, http://localhost:5173, Login button is
prefilled) and check at minimum:

1. WASD moves the character AFTER clicking a UI element (chat, a pane).
2. Right-click opens the game menu on the canvas AND on an inventory item.
3. Open the skill tree (press `p`), allocate, close, reopen — build intact.
4. Enter a zone from the Adventure menu; minimap label shows the zone name.

## Commands

```bash
npm run dev          # client :5173 + server :6500 (concurrently)
npm run test:unit    # vitest (448+ tests)
npm run lint         # eslint
npm run playtest     # goal harness — run before claiming playability
```

Process hygiene (matters for sandboxed/CLI agents):

- Do not start watch-mode or long-lived processes (`npm run dev`,
  `npm run dev:server`, `npm run dev:client`) and leave them running; if
  you must probe one, wrap it with a timeout and kill it. Prefer
  `npm run playtest` (self-terminating) or, when a dev server is already
  running, `npm run playtest -- --attach`.
- When the user should try the game themselves, give them the command
  instead of hosting the server from your session.

## Protocol crib sheet (saves you spelunking)

- Client→server messages: `{ event, data }` JSON over WS.
- Server→client: `{ event, data, meta? }`.
- **Server handlers receive the FULL message** — the client payload is at
  `data.data`. This has caused real bugs; use the existing
  `getPlayerFromPayload` helpers.
- Key events: `player:login` (guest: `{useGuestAccount:true}`),
  `player:move`, `player:skill:trigger`, `instance:enterSolo`
  (`{template, layout}`), `player:context-menu:build`/`:action`,
  `player:skilltree:save`, `dev:*`. Server pushes `player:movement`,
  `player:stats:update`, `combat:hit`, `game:send:message`,
  `core:refresh:inventory`, `world:scene:transition` /
  `party:scene:transition` (instance→instance keeps the same scene id —
  wait on the transition event, not the id).
- Vue right-click: use `@contextmenu.prevent`, never `@click.right`
  (browsers do not fire `click` for the right button).

## Conventions

- Commit locally; **NEVER push** (the user pushes).
- Big commits can SIGKILL the lint-staged pre-commit hook — run eslint
  manually first, then retry the commit.
- Balance/tuning changes must be MEASURED through the real pipeline
  (`tests/unit/instance-balance.spec.js`,
  `tests/unit/surface-monster-balance.spec.js`,
  `tests/unit/monster-support-healing.spec.js`) — never guessed.
- Persisted player data can be stale (renamed item ids, old snapshots):
  loaders must degrade gracefully, never throw (see `constructWear`).
