# Verdigris — agent guide (canonical)

This file is the single source of truth for AI coding agents (Claude Code,
OpenAI Codex, or any other). `CLAUDE.md` imports it. If you update agent
guidance, update THIS file.

## HARD STOP: synchronize Git before spending work

Before planning, editing, generating assets, running expensive tests, or
committing anything, every coding agent MUST run this preflight from the
repository root:

```bash
git status --short
git remote -v
git fetch --prune origin
git status -sb
git rev-list --left-right --count HEAD...@{upstream}
```

This preflight is the only repository work allowed until it passes.

- If `git fetch` fails, the branch has no upstream, or the remote reports that
  the repository moved, STOP. Fix/confirm the remote and rerun the preflight;
  never assume the local checkout is current.
- If the worktree is dirty, preserve the user's changes. Do not pull, rebase,
  switch branches, or hide them in a stash without explicit approval. Use a
  clean worktree from the current remote branch for isolated work, or stop and
  ask.
- If the behind count is nonzero, DO NOT edit files. A clean branch that is
  only behind may use `git pull --ff-only`; a diverged branch must stop and be
  reconciled deliberately before implementation begins.
- Repeat the preflight after a long pause/compaction, when resuming a handoff
  from another machine or agent, and immediately before publishing work.
- Before any push, fetch again and confirm the behind count is zero. Never
  force-push over remote work unless the user explicitly names the branch and
  authorizes that exact overwrite after seeing what would be lost.

Do not spend tokens or compute on a substantive task while these checks are
unresolved. Report the exact ahead/behind counts to the user instead.

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

## What the harness does NOT cover — browser smoke

The harness drives server truth over the real protocol. Client-side bugs
(dead Vue event bindings, canvas focus traps, stale HUD labels, raw-HTML
rendering) are invisible to it. After every client/UI change, run:

```bash
npm run smoke:browser   # builds, boots a real server, drives Playwright
```

The browser gate checks:

1. WASD moves the character AFTER clicking a UI element (chat, a pane).
2. Right-click opens the game menu on the canvas AND on an inventory item.
3. Open the skill tree (press `p`), allocate, close, reopen — build intact.
4. Enter a zone from the Adventure menu; minimap label shows the zone name.

Use `npm run dev` for additional exploratory browser checks when the changed
surface extends beyond these four contracts; do not leave it running.

## Commands

```bash
npm run dev          # client :5173 + server :6500 (concurrently)
npm run test:unit    # vitest (448+ tests)
npm run lint         # eslint
npm run playtest     # goal harness — run before claiming playability
npm run smoke:browser # required after client/UI changes
```

Process hygiene (matters for sandboxed/CLI agents):

- Do not start watch-mode or long-lived processes (`npm run dev`,
  `npm run dev:server`, `npm run dev:client`) merely for an agent-side probe;
  prefer `npm run playtest` (self-terminating) or, when a dev server is already
  running, `npm run playtest -- --attach`.
- When the user explicitly asks to run, launch, open, or try the game, start it
  for them and keep the process attached so it can be stopped cleanly. If a
  manual command is still useful, provide one copy-paste block that includes
  the directory change and launch command.

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
- World web (docs/crossroads-world-web.md): `world:road:chart` (`{roadId}`,
  roads: tin/salt/chalk/copper) opens the chart pane; `world:zone:enter`
  (`{nodeId: 'road:tier:index'}`) travels to a charted node. Zones are
  per-House scenes `zone:<houseId>:<nodeId>` that linger `ZONE_LINGER_MS`
  (default 15 min) after emptying. The Warden (the floor's elite) bars the
  onward gates; its death marks the node cleared in SQLite and unlocks the
  children. Wagon pane events: `player:screen:wagon` (context-menu action —
  lives in handlers/actions/index.js because the Action dispatcher only
  routes there), `wagon:outfit:buy`, `wagon:daily:claim`, `wagon:upgrade`,
  `chronicles:house:deposit` (bank or wagon pane).
- The town (`town:delaford`, displayed as "The Crossroads") is truce-ground:
  `metadata.sanctuary` is true, no monsters may exist or deal damage there,
  and scions log in at their House's wagon pitch.
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
