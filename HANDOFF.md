# Hand-off: continue 2026-06-10 session (Cowork → Claude Code)

You are picking up mid-session on **delaford** (`Z:\Code\Games\delaford\delaford_game`, GitHub `alexkorol/Delaford` — renamed today from `delaford_game`; the local origin URL still says `delaford_game`, redirects work). A Vue 3 + Node 22 (Vite/Vitest) 2D multiplayer ARPG forked from the old Delaford project. Windows, repo `.gitattributes` forces LF (`* text=auto eol=lf`).

## Goals for this session (in priority order)

1. **Commit this morning's uncommitted work** (see below) — it is finished and tested.
2. **Salvage good work from old branches** (audit below) — merge the two near-master `claude/*` branches if clean; mine the codex combat chain for data/design, not wholesale merges.
3. **Combat + levelling, end to end**: attack monsters in instances → damage → death → XP → level-ups visible in UI. Combat controllers already exist server-side; the gap is the full loop, tuning, feedback (HP bars, hit flashes, death/respawn) and XP/level progression wired into skills.
4. **Dungeon/instance exploration**: stairs_down should descend to a new floor (new seed, depth+1, theme rotation/scaling); a way to leave back to town; per-floor difficulty scaling.

Keep `npm run test:unit` green throughout (baseline: **114 passing**) and add tests for combat/levelling/descent.

## State right now

- `master` = `9a74ac9` (pushed). The **working tree has uncommitted, finished work**: the DCSS dungeon tileset + themed instance generation + a tile-addressing refactor + 7 new tests.
- **FIRST ACTION**: delete `.git\index.lock` if it exists (a stale lock from a sandboxed tool, blocks all git). Then run `npm run test:unit` (expect 114 green), then commit & push everything (a ready-made `_commit_dungeon_tiles.bat` in the parent folder's repo root does lock-cleanup + test + commit + push; using it or doing it manually is equivalent). `_consolidate_repos.bat` and `_commit_dungeon_tiles.bat` are one-shot helpers — fine to delete after use, don't commit them if unwanted.
- Caution: the Z: drive showed flaky write/read sync today (files appearing truncated through one view while intact on disk). If you see impossible file corruption, re-read before acting on it.

## What was built this morning (uncommitted)

- `src/assets/tiles/dungeon.png` — 182-tile 32×32 atlas (16 cols) assembled from DCSS `rltiles` (CC0/public domain; `src/assets/tiles/DCSS-ATTRIBUTION.md`). 13 floor families, 8 wall families, doors, stairs/hatches/portals, trees, statues, altars, fountains, water. Regenerable via `tools/build_dungeon_atlas.py` (header has usage; tile order must stay stable).
- `server/shared/dungeon-tiles.js` — **generated** manifest (don't hand-edit): `names`, `groups`, `blockedBg`, `walkableFg`; helpers `dungeonGid(name)`, `dungeonGroupGids(category, variant)`, `DUNGEON_FIRST_GID = 541`.
- `server/maps/layers/dungeon.tsx` + registered in `surface.json`/`surface.tmx` at firstgid 541 → paintable in Tiled.
- **Tile addressing refactor** (the part to internalize):
  - Sheets by gid: terrain 1–252, objects 253–540, dungeon 541–722. Everything now passes **zero-based global ids (gid − 1)**.
  - `UI.tileWalkable(zeroId, layer)` (`server/shared/ui.js`, shared with client via `@shared` alias) resolves the sheet internally. `tile < 0` ⇒ walkable (no tile). Foreground default-blocked unless in a walkable list (objects: `config.map.objects.walkable` **0-based locals**; dungeon: manifest `walkableFg`). Background blocked lists are 0-based locals too (`server/config.js`, terrain ocean band incl. 31).
  - `UI.getTileOverMouse` / `UI.getFutureTileID` return gid − 1 for **both** layers now (the old `specialEquation`/`- 252` call-site conversions were removed in: monster & npc movement-handlers, server `core/map.js` pathfinder grid, client `src/core/map.js` mouse path; `server/core/context-menu.js` keeps one explicit `- 252` because `Query.getForegroundData` is keyed by objects-local ids).
  - Client renderer `src/core/map.js drawMap()` resolves per-tile sheet (terrain/objects/dungeon images); dungeon image loads as `assets[8]` in `src/core/client.js` `loadAssets()`, `monstersImage` moved to index 9 in `setImages`.
- **Themed instance generation** (`server/core/map.js`): `generateInstance({ seed, template, theme, rooms, corridorWidth })` now carves rooms+corridors out of solid themed rock (no more town-map clone): per-tile floor variants (12% accent), varied wall faces adjacent to open space, open doors at room junctions, `stairs_up` on `metadata.spawnPoints[0]` (entry), `stairs_down` in the last room, themed decor, water pools for `marsh`. Themes: `INSTANCE_THEMES` = stone/crypt/sand/volcanic/marsh; `TEMPLATE_THEMES` maps template strings (dungeon→stone, tomb→crypt, hell→volcanic, swamp→marsh, …). Deterministic per seed. `metadata.theme` is set.
- `tests/unit/dungeon-instance.spec.js` — manifest integrity, cross-sheet walkability, full-map dungeon-range check, **BFS connectivity** of all room centres, determinism, all 5 themes.

## Architecture map (verified today)

- **Scenes/instances**: `server/core/world.js` — `WorldManager` with `scenes`, `towns`, `instances` (keyed by partyId), `WorldScene`, `assignPlayerToScene`, `createInstance`, `destroyInstance`, `getSceneForPlayer`. Default town `town:delaford`.
- **Party → instance flow**: `server/player/handlers/party.js` `startInstance()` → `GameMap.generateInstance({ seed, template: party.metadata.template })` → `world.createInstance(party.id, …)` → monsters instantiated with `sceneId`, members teleported to `metadata.spawnPoints`. Cleanup via `ensureInstanceCleanup`. Client: `src/core/client.js` `loadScene(scenePayload, playerState)`; event `party:scene:transition` exists in `src/core/player/events/party.js`.
- **Combat (existing, to build on)**: `server/core/entities/monster/{combat-controller,stats-manager,movement-handler,behaviours/{ranged,support}}.js`, `server/core/entities/player/combat-controller.js`, AI under `server/core/entities/ai`. Instance monsters already get role configs (melee/ranged/support: aggression/pursuit ranges, attack interval/windup/damage/range, support heals) and `rewards: { experience, coins }`, `respawn.delayMs`. Instance `metadata.rewards` has completion `coinsPerPlayer` + skill XP.
- **Skills**: `server/core/skills/` and `tests/unit/skills-schema.spec.js` exist — check shape before inventing a levelling model; PoE/D2-style direction per README (`docs/vision.md`), Str/Dex/Int stats planned, flower-of-life passive tree concepts in old branches.
- **Socket security**: `server/Delaford.js` — `authorizeSocketMessage` / `hasForeignPlayerReference` + `PUBLIC_EVENTS` + rate limiting; `tests/unit/socket-events-authorization.spec.js`. Don't regress this when adding combat events; bind actions to the authenticated socket's player.
- **Watch-out**: `Socket.broadcast('npc:movement', world.npcs, …)` in `server/core/npc.js` looks scene-unaware — instance players may receive town NPC traffic. Verify and scope broadcasts per scene while doing combat networking.

## Branch audit (62 branches on origin, all fetched)

Already in master: PR #59 (fixes/polish), #60 (socket auth + tests), #61 (controls/HUD), Feb UI refactor, Jun 7 ARPG UI/inventory prototype.

**Merge candidates (small, Feb 24 2026, close to master):**
- `claude/delaford-improvements-YVkA7` — 4 commits: server null guards, async re-validation in action handlers.
- `claude/review-delaford-codebase-DhYMP` — 3 commits: UI spacing/z-index/responsive polish.
Review diffs vs master first (`git log --oneline master..origin/<branch>`; the Jun work may have rewritten the same spots), merge or cherry-pick what still applies.

**Reference-only (Oct–Nov 2025, pre-date the Feb merge-base; master's combat/entities were rewritten since — do NOT merge wholesale):**
- Codex combat chain (stacked): `codex/add-combat-config-module-and-update-loaders` → `implement-combatengine-class-and-related-features` → `implement-abilitymanager-and-update-mechanics` → `implement-input-mapping-layer-and-bindings` → `define-monster-archetypes-in-combat-config` → `build-reusable-vue-components-for-combat` (combat HUD/FX). Mine for: ability definitions/cooldown mechanics, monster archetype data tables, combat HUD component ideas — extract data/design, reimplement against current entity controllers.
- ECS chain (`codex/add-movement-and-action-queue-systems`, `refactor-ecs-integration-for-entities`, `integrate-networking-emitters-into-systems`, docs in `codex/document-ecs-migration-strategy`) — architecture direction if ECS is ever wanted; current code is not ECS.
- Misc fixes (`codex/fix-item-drop-handling-and-validation`, `update-inventory.add-for-overflow-handling`, `update-websocket-import-in-socket.js`, …) — probably superseded by #59/#60; verify per-diff before bothering.
- `codex/add-node-definitions-to-flower-of-life.js` — passive tree node data; relevant to levelling design later.

## Conventions

- Conventional-ish commit messages as in recent history; LF endings; run `npx eslint <files>` on touched files (flat config, repo root).
- `npm run dev` = Vite client (5173) + nodemon server (ws 9000, express 6500). Manual test of instances: form a party in the UI, start an instance; `party.metadata.template` picks the theme.
- Tile names: `dungeonGid('stairs_up' | 'stairs_down' | 'door_open' | …)`, groups via `dungeonGroupGids('floor'|'wall'|'liquid'|'tree'|'decor'|'decor_walk'|'door'|'gateway', variant)` — see generated manifest for the full list.

## Suggested order of attack

1. Unblock git (index.lock), test, commit, push this morning's work.
2. Quick wins: review/merge the two Feb `claude/*` branches.
3. Combat loop in instances (use existing controllers; add target HP feedback + death + XP awards into skills; scene-scoped broadcasts).
4. Levelling: XP curve + level-up (stats per vision doc), surfaced in HUD.
5. Descent: interacting with `stairs_down` regenerates a deeper floor for the party (seed derive from `metadata.seed` + depth, rotate/scale theme + monster levels), `stairs_up`/portal on floor 1 exits to town.
6. Tests for all of the above; keep 114+ green.
