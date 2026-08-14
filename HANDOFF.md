# Handoff — 2026-08-13, post-merge state

Read `AGENTS.md` first (it is the canonical agent guide) and OBEY its
**HARD STOP git preflight** — this very handoff exists because a month of
work was once built on a stale checkout and had to be hand-merged back.

## Where the project stands

`master` (local, ~180 commits ahead of origin — the user pushes) is the
reunified line: the 2.5D renderer / four-quest campaign / Chronicles
Houses-and-Scions line merged with the Crossroads world-web / wagons /
security line. Ore mining/smithing is deliberately removed (ARPG direction;
crafting arrives through the Houses meta systems — Vesselforge brand-searing
is live).

Verified green as of this handoff:

- `npm run lint` clean; `npm run test:unit` 696/696
- `npm run playtest` 31/31 (real server, real protocol)
- `npm run test:e2e` — the browser-critical-loop Playwright gate (built
  client: login, Chronicles onboarding, WASD after UI focus, context menus,
  pointer equip/unequip, zone entry)

Deployment: one Node process serves the built client + WS on :6500;
`pm2 start ecosystem.config.cjs`; cloudflared quick tunnel for public play;
`/?play` = one-URL quick start (per-browser guest House); `/stats` = human
status page; `/api/stats` = JSON. HTML shell is `no-cache`, hashed assets
immutable.

## THE ACTUAL PRIORITY: the game looks and plays badly

The owner's verdict after playing on real devices: **"looks and plays
awful."** All the plumbing above is necessary but not sufficient. The next
agent's job is GAME FEEL and VISUAL QUALITY, played by hand in a real
browser, not proven by harness. Concrete starting points observed:

- The 2.5D perspective view renders but reads muddy: heavy fog/blur over the
  village, low contrast, washed-out tiles (see any `?play` session).
- The inventory was reverted to 32px cells so the pane fits and drags work;
  the intended 54px "art fills the pane" scale needs the login-restyle pane
  layout ported (below) — right now items look tiny.
- Combat/feedback polish, HUD legibility, and first-minute impressions have
  had no human-driven iteration since the merge.

Iterate: play in the browser (`npm run dev`, or build + `npm start`), change,
play again. Use the owner's feedback loop; do not declare feel-work done from
green tests.

## Pending ports (login-restyle features whose specs are parked)

`tests/pending-port/README.md` lists them; each spec should return to
`tests/unit/` or `tests/e2e/` when its feature lands:

1. Escape game menu (`src/components/ui/EscapeMenu.vue` exists, unmounted).
2. Login-restyle pane layout + 54px inventory scale + HUD-orb pane host.
3. Browser-local account sign-in screen ("Continue as browser guest").
4. Client diagnostics API (`window.__verdigrisDiagnostics`, ClientDiagnostics
   + ConnectionManager) — the reconnect e2e asserts on it.
5. Narrow-viewport pane containment.

## Known seams (do NOT "simplify" one side away)

- `player:login` dispatches TWO flows: payloads with `guestId`/`quickGuest`/
  `resumeScionId` → chronicle-auth flow (SQLite houses/scions, wagon-pitch
  spawn, world web); plain payloads → direct admission (JSON guest saves,
  `awaitChronicles` browser flow). The client socket wrapper decorates only
  interactive logins with `awaitChronicles`.
- The town is the 2.5D Delaford Village carrying the four world-web road
  gates one tile beside its own portals (tin 37,94 / salt 64,114 / chalk
  37,138 / copper 12,115) plus wagon pitches. The full Crossroads conversion
  (sanctuary truce, wagon/chart panes in the client shell) is planned
  follow-up; server systems + playtests for it are live.
- Two Chronicles persistence stacks coexist (JSON chronicles-store + SQLite
  chronicles-repository). Unification is open work.
- `inventory.add` is synchronous, returns `{ ok, added, remainder, ... }`;
  currency is a slot-less carried balance; overflow defaults to `'reject'`,
  reward paths pass `{ overflow: 'drop' }`.

## Hard-won verification lessons

- The playtest harness proves the PROTOCOL, not the DOM. The merge shipped
  five client breaks invisible to 31/31 playtests (dead store action,
  never-set socket-auth flag, missing Adventure menu, clipped inventory rows,
  missing `?play` hook). After ANY client change run `npm run test:e2e` and
  actually look at the game.
- Playtest scenarios are timing/order sensitive; fire-and-forget `dev:*`
  commands can be dropped by the rate bucket — re-request inside `waitFor`.
- Windows console tools mangle regex escapes through heredocs; prefer direct
  file edits for regex-bearing code.
