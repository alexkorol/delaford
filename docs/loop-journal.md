# Verdigris loop journal

## 2026-07-10 — Stabilize the session-arc baseline

- Goal: restore a green baseline before beginning the Tier 0 critic work.
- Failing scenario: the full `npm run playtest` run timed out at
  `session-arc` while waiting to descend beyond floor 1.
- Cause: frequent `dev:state` polling exhausted the same development
  rate-limit bucket as `dev:teleport`, so the stair control command could be
  dropped before the party transition.
- Acceptance coverage: `ws-message-handler.spec.js` now exhausts diagnostic
  reads and asserts that a harness teleport is still dispatched.
- Implementation: diagnostic reads and harness control commands use separate
  development-only token buckets.
- Evidence: `npm run playtest` — 13/13 scenarios; `npm run test:unit` — 73
  files and 503 tests; `npm run lint` — exit 0.
- Critic score: 3/5 (qualitative until the Tier 0 scorer lands). The arc has
  meaningful gear and tree consequences and reaches combat quickly, but its
  timings and choices are not yet emitted as trendable metrics.
- Next target: add the Tier 0 session-arc metrics block and automatic journal
  recording.

## 2026-07-10 — Add a scored session-arc critic

- Goal: make the session-arc critic emit trendable measurements instead of a
  pass/fail result alone.
- Failing scenario: `session-arc` completed its gameplay assertions, then
  failed with `recordMetrics is not a function` at the new acceptance boundary.
- Scenario added: the arc measures seconds to first combat and first drop,
  real level-1 and level-5 kill times, successful tree/equipment/zone choices,
  deaths, and maximum depth.
- Implementation: the playtest runner validates and prints a JSON metrics
  block, calculates a five-axis 0–100 critic score, and appends each run to the
  trend table below. Incomplete or negative measurements are rejected.
- Evidence: `npm run playtest` — 13/13 scenarios; `npm run test:unit` — 74
  files and 505 tests; `npm run lint` — exit 0.
- Critic score: 100/100. Final gate sample: first combat 0.59s, first drop
  0.74s, level-1 TTK 1.89s, level-5 TTK 0.62s, 6 meaningful choices, 0
  deaths, depth 4.
- Next target: automate the four browser blind-spot checks from Tier 0.

## 2026-07-10 — Close the client browser blind spot

- Goal: automate the four canonical client checks and make them a repeatable
  gate for client-touching changes.
- Failing scenario: the new browser smoke completed movement-after-UI-click
  and canvas context-menu checks, then failed because right-clicking the modern
  Bronze Pickaxe inventory tile produced no `#actions` menu.
- Scenario added: `browser-smoke.spec.mjs` drives a real built client and
  server, proving WASD after an Adventure-button click, canvas and inventory
  context menus, tree allocation across close/reopen, and the Verdant Grove
  minimap label.
- Implementation: modern inventory tiles now emit the same server-authored
  `PLAYER:MENU` request as legacy item grids. `npm run smoke:browser` builds the
  client and runs the dedicated Playwright gate.
- Evidence: `npm run smoke:browser` — 1/1; `npm run playtest` — 13/13;
  `npm run test:unit` — 74 files and 505 tests; `npm run lint` — exit 0.
- Critic score: 100/100. Final session sample: first combat 0.59s, first drop
  0.75s, level-1 TTK 0.62s, level-5 TTK 0.01s, 6 meaningful choices, 0
  deaths, depth 4.
- Next target: Tier 1 gear-outcome scenario measuring unarmed, looted weapon,
  and higher-ilvl vessel TTK margins.

## 2026-07-10 — Make gear change combat outcomes

- Goal: prove strict same-monster TTK improvements from unarmed combat to a
  looted weapon and then to a higher-ilvl Vesselforge drop.
- Failing scenario: `gear-outcomes` first lacked an exact-monster reset, then
  showed the core defect directly: ilvl 5 and ilvl 65 vessels both produced 22
  authoritative slash attack.
- Scenario added: one seeded battleaxe base is dropped at ilvl 5 and 65; one
  exact 140-HP monster is restored between all three real combat trials. The
  scenario requires explicit attack and TTK margins.
- Implementation: Vesselforge material and brand damage now contributes a
  per-hit bonus to the base item's dominant physical style. Dev-only setup can
  seed item drops and restore one monster without regenerating the floor.
- Evidence: `npm run playtest` — 14/14; `npm run test:unit` — 74 files and 506
  tests; `npm run lint` — exit 0. The three required balance specs plus
  `vesselforge.spec.js` passed 43/43.
- Outcome: full-gate gear trial measured 10.17s unarmed, 2.61s with the ilvl-5
  vessel, and 2.12s with the ilvl-65 vessel; slash attack rose 33 → 39.
- Critic score: 100/100. Session-arc remained at first combat 0.58s, first
  drop 0.76s, 6 meaningful choices, 0 deaths, and depth 4.
- Next target: Tier 1 build-divergence scenario comparing STR melee and INT
  skill combat profiles at equal level and point spend.

## 2026-07-10 — Prove equal-point builds diverge

- Goal: compare equal-level, equal-spend STR and INT scions against the same
  pack and prove distinct melee and mana-skill profiles.
- Scenario result: the new scenario passed before production changes, proving
  this item was already implemented but lacked a goal-harness contract. Two
  level-20 party members spend exactly 20 points down opposite tree axes and
  strike one exact reset monster.
- Evidence: the full run measured STR 83 vs 20 and INT 83 vs 11; STR melee won
  37 vs 9 damage while INT Frost Nova won 40 vs 10. `npm run playtest` passed
  15/15, `npm run test:unit` passed 74 files and 506 tests, and `npm run lint`
  exited 0.
- Harness hardening: comparison gear uses a stronger deterministic vessel seed;
  combat measurements heal through unrelated focus fire; loot approaches its
  item before requesting the server-authored context menu. Required margins
  were preserved.
- Critic score: 100/100. Session sample: first combat 0.59s, first drop 0.76s,
  6 meaningful choices, 0 deaths, depth 4.
- Ladder audit: Tier 1 death stakes are already proven by `chronicles` (mortal
  fall, crypt provenance, same-House successor recovery), so the next
  unfinished target is Tier 2's in-world first-session goal chain.

## Session-arc metric trends

UTC | Scenario | Score | First combat (s) | First drop (s) | TTK L1 (s) | TTK L5 (s) | Choices | Deaths | Depth
--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:

2026-07-11T02:49:54.583Z | session-arc | 100 | 0.61 | 0.76 | 0.63 | 0.32 | 6 | 0 | 4

2026-07-11T02:51:03.386Z | session-arc | 100 | 0.59 | 0.74 | 1.89 | 0.62 | 6 | 0 | 4

2026-07-11T02:59:58.659Z | session-arc | 100 | 0.59 | 0.75 | 0.62 | 0.01 | 6 | 0 | 4

2026-07-11T03:09:38.905Z | session-arc | 100 | 0.58 | 0.76 | 0.62 | 0.01 | 6 | 0 | 4

2026-07-11T03:24:56.337Z | session-arc | 100 | 0.58 | 0.75 | 0.63 | 0.01 | 6 | 0 | 4

2026-07-11T03:26:06.718Z | session-arc | 80 | 0.58 | 0.74 | 0.62 | 0.93 | 6 | 0 | 4

2026-07-11T03:27:43.689Z | session-arc | 100 | 0.57 | 0.74 | 1.24 | 0.32 | 6 | 0 | 4

2026-07-11T03:30:51.801Z | session-arc | 100 | 0.59 | 0.76 | 0.62 | 0.02 | 6 | 0 | 4
