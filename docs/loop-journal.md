# Verdigris loop journal

## 2026-07-11 — Connect scion gold to House development and clarify shops

- Goal: let a newly founded House grow from gold found by its active scion, and
  make basic purchasing predictable without replacing the existing DCSS item art.
- Root cause: House treasury had no transfer event or in-game control. It could
  only receive daily stipends and depth-record rewards, so depositing carried
  coins was impossible. Shop tiles hid prices and made the primary click appraise
  an item, leaving buying behind quantity context menus.
- Implementation: Rhea, House Banker is stationary in Delaford. Her bank pane
  shows carried gold beside the active House treasury and offers `Deposit 100`
  and `Deposit all`. The repository commits the reduced scion snapshot and
  increased treasury in one SQLite transaction, validates living-scion House
  ownership, and refreshes both balances. Shop stock keeps its current DCSS tile,
  adds the authoritative coin price, buys one on left click, retains right-click
  quantities, and reports exact buy/sell totals. Successful trades are marked for
  persistence. Full-message socket payloads now work for bank and shop openings;
  development teleports advance their movement sequence so browsers accept them.
- Proof added: `house-treasury` uses the real banker action, deposits 100 gold,
  checks both balances, reconnects, and proves neither balance can be duplicated.
  Repository and handler specs cover atomic persistence, ownership, proximity,
  full socket envelopes, buy-one, stack quantities, and transaction messages.
- Evidence: `npm run playtest` — 21/21 scenarios with session critic 100/100;
  `npm run test:unit` — 83 files and 542 tests; `npm run lint` — exit 0; `npm
  run smoke:browser` — 2/2.
- Next target: give the House improvements concrete in-run benefits, beginning
  with one small Great Hall or House Forge effect surfaced in the Chronicles UI.

## 2026-07-11 — Close the endless-descent stakes audit

- Goal: verify that looking at and advancing the recorded depth now changes
  both danger and reward through live gameplay, without duplicating systems.
- Audit result: the ladder already raises monster levels by two per floor and
  scales health, damage, experience, coins, completion rewards, treasure base
  pools, and guaranteed treasure item level. The encounter pass adds a rising
  rare share (12% on floor 1 toward a 30% cap), so deeper packs contain more
  Thick Hide and Frenzied enemies. `bestDepth` is persisted for the scion.
- Existing proof: `instance-balance` measures increasing average health and
  damage at depths 1, 3, 6, and 10 and proves a fresh build reaches a lethal
  wall. `depth-loot` descends through real stairs and observes guaranteed gear
  rise from item level 10 to 50 by floor 5; `chronicles` observes the depth
  record, and `session-arc` reaches a visible level wall before choosing run two.
- Evidence: `npm run playtest` — 20/20 scenarios with session critic 100/100;
  `npm run test:unit` — 82 files and 536 tests; `npm run lint` — exit 0; `npm
  run smoke:browser` — 2/2.
- Next target: nested containers are the clearest remaining expansion; start
  with a small server-owned bag contract and add UI only after persistence and
  stale-snapshot behavior are specified.

## 2026-07-11 — Differentiate biome encounters and rare monsters

- Goal: make biome packs demand visibly different responses and give rare
  enemies explicit, depth-scaled stakes.
- Implementation: biome-specific role profiles now vary melee, ranged, and
  support composition. Buffer monsters project a short-range 12% damage aura,
  while rare monsters can roll Thick Hide (+20% health) or Frenzied (12% faster
  attacks). Rare odds rise with depth and rare kills retain their higher gear
  chance while awarding 1.35x experience. Empty scenes skip aura work entirely.
- Proof added: `encounter-variety` observes crypt and marsh role differences,
  a live support aura, an explicit rare modifier, and a killable empowered
  depth-10 target through the real server. Unit coverage verifies aura lifecycle,
  dormant-scene behavior, role profiles, modifier math, rising rare share, and
  measured pack survivability through the combat pipeline.
- Evidence: `npm run playtest` — 20/20 scenarios with session critic 100/100;
  `npm run test:unit` — 82 files and 536 tests; `npm run lint` — exit 0; `npm
  run smoke:browser` — 2/2.
- Next target: audit the existing endless-descent risk/reward ladder before
  adding another subsystem.

## 2026-07-11 — Surface one real Vesselforge choice in town

- Goal: expose the highest-value missing Vesselforge interaction without
  changing the existing crafting engine.
- Implementation: in Delaford, right-clicking a vessel item with patience and
  an open slot now offers `Add a random brand (100 coins)`. The server validates
  town location, exact owned item UUID, capacity, patience, and funds; it then
  calls the existing `sear` operation, spends exactly 100 coins, refreshes the
  vessel tooltip/combat projection, and marks the scion dirty for persistence.
  Out-of-town and invalid direct requests fail without mutation.
- Harness/browser support: the harness can now build the real server-authored
  inventory context menu, and deterministic dev grants accept seed/item level.
  The new `vesselforge-brand` scenario proves discovery, stated cost, mutation,
  payment, and refreshed tooltip lines. Browser resilience returns from the
  quick-start instance to town, adds a brand through the visible context menu,
  sees the new tooltip line, then drags the crafted pike into main hand.
- Evidence: focused Vesselforge/context coverage — 4 files and 47 tests; `npm
  run playtest` — 19/19 scenarios, session critic 100/100; `npm run test:unit`
  — 81 files and 531 tests; `npm run lint` — exit 0; `npm run smoke:browser`
  — 2/2; browser resilience — 3/3.
- Next target: audit encounter and descent tracks against current rare-tier,
  biome-boss, and depth-reward code before adding anything else.

## 2026-07-11 — Verify July 4 inventory remainders live

- Goal: check the July 4 fix-plan's drag-to-equip and floating tooltip claims
  against current code and the actual browser/server path.
- Audit result: both were already implemented in commit `2dddfea`; no duplicate
  production change was needed. Pointer drag resolves a paperdoll target and
  emits the same authoritative equip commit as other inventory paths. The
  floating ornate tooltip renders rarity-colored headers, live combat values,
  vessel lines and pips, attunement, relic names, and viewport-aware placement.
- Live proof: the dedicated browser resilience spec granted a generated Bronze
  Pike, verified its WIZARD art and vessel material lines, dragged it onto the
  main-hand slot, and observed the server-refreshed equipped art/name. It also
  asserted no client handler or uncaught errors.
- Evidence: `npm run build` — exit 0; `npx playwright test
  tests/e2e/browser-reconnect.spec.mjs` — 3/3 passed, including the real
  tooltip/drag/equip case.
- Next target: relic circulation is already scenario-backed in `chronicles` and
  `session-arc`; audit and surface the highest-value missing Vesselforge player
  interaction.

## 2026-07-11 — Tolerate stale Chronicle player snapshots

- Goal: prove renamed ids and malformed old snapshot fields cannot prevent a
  Chronicle scion from loading.
- Failing proof: a non-object `inventory` reached `.map`, and missing/null skill
  entries reached the Player constructor's level reconciliation unchecked.
- Implementation: the loader rebuilds the six canonical skills from safe XP,
  defaults malformed bank/friend data, discards malformed inventory entries,
  and preserves unknown-but-structured item ids as inert possessions with no
  actions. Existing wear and passive-tree validators clear renamed ids.
- Regression proof: a fuzzed old snapshot with renamed skills, inventory,
  wear, and tree ids constructs a real Player; focused specs also prove valid
  inventory siblings survive. The full suite initially caught an overly
  destructive unknown-item policy, so opaque legacy records are retained.
- Evidence: focused stale/schema coverage — 5 files and 32 tests; `npm run
  playtest` — 18/18 scenarios with session critic 100/100; `npm run test:unit`
  — 80 files and 528 tests; `npm run lint` — exit 0.
- Next target: verify the July 4 drag-to-equip and floating vessel tooltip
  claims against the live client and close any remaining proof gap.

## 2026-07-11 — Contain malformed actions and instance broadcasts

- Goal: exercise hostile context-menu input and audit broadcasts for state
  leaking between independent scenes.
- Bugs found: `player:context-menu:action` dereferenced an assumed nested item
  shape before validation, and equip/unequip notifications omitted recipients,
  sending one scion's complete refreshed state to every connected client.
- Implementation: malformed action envelopes now fail closed before creating an
  `Action`; valid actions also require a socket-bound player. Equip and unequip
  updates now target only players in the acting scion's current scene, including
  paperdoll-to-world drops.
- Regression proof: context-menu specs cover four malformed shapes; equipment
  specs require explicit scene recipients for equip, backpack unequip, and
  world-drop unequip.
- Evidence: focused authorization/context/equipment run — 4 files and 30 tests;
  `npm run playtest` — 18/18 scenarios; `npm run test:unit` — 79 files and 525
  tests; `npm run lint` — exit 0.
- Next target: fuzz stale Chronicle snapshots through the real Player loader,
  especially malformed skills and inventory records.

## 2026-07-10 — Finish development account registration

- Goal: finish and isolate the existing landing/auth restyle and make local
  account creation work when Vite and the authoritative server use different
  ports.
- Review result: the presentation changes were complete, but cross-port
  routing and the development CORS allowlist had no focused regression proof.
- Implementation: registration derives its HTTP endpoint from the selected
  WebSocket server, returns safely to same-origin for unavailable/malformed
  sockets, and development CORS accepts only the same host (including loopback
  aliases) on Vite port 5173. The landing and registration panels have wider,
  clearer spacing and a distinct primary registration action.
- Proof added: unit coverage exercises ws/wss/fallback endpoint routing and
  rejects hostile origins and wrong ports. Browser smoke now creates a real
  local account and verifies that sign-in receives the username with a blank
  password and guest mode disabled.
- Evidence: focused registration/server specs — 3 files and 8 tests passed;
  touched-file ESLint — exit 0; `npm run smoke:browser` — 2/2 passed.
- Next target: audit the robustness checklist for full-message payload mistakes,
  cross-instance broadcasts, and stale persisted-data failures.

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

## 2026-07-10 — Put the first goal in the world

- Goal: give a new scion one explicit in-world objective from a town NPC,
  through a named zone clear, to a permanent character reward.
- Failing scenario: `first-goal` failed because the town guide exposed no
  Talk action. The full-sequence proof then caught a stale-coordinate defect
  when the original wandering NPC moved before the interaction.
- Scenario added: the harness discovers Aldwyn from the authoritative town
  scene, accepts “clear The Old Barrow floor 1,” clears the real instance,
  receives the return objective, and proves exactly one Verdigris point on
  returning to Delaford.
- Implementation: Baynard is now the stationary Aldwyn guide with a
  server-authorized Talk action. The server owns quest stages and advances
  them only for the Old Barrow template/layout/depth and the real return path.
  Quest state and its 23-point capped reward source persist with guest,
  Chronicle, and account snapshots; tree allocations are revalidated against
  the enlarged 123-point budget.
- Evidence: `npm run playtest` — 16/16 scenarios; `npm run test:unit` — 75
  files and 510 tests, including all three balance specs; `npm run lint` —
  exit 0; `npm run smoke:browser` — 1/1.
- Critic score: 80/100 in the final sample. First combat remained 0.58s,
  first drop 0.74s, 6 measured choices, 0 deaths, and depth 4; the unscored new
  quest adds an explicit objective and reward, while the variable level-5 TTK
  sample missed the scorer's strict faster-than-level-1 point.
- Next target: Tier 2 boss proof — give each biome a readable boss mechanic,
  beginning with one scenario-backed Old Barrow boss encounter.

## 2026-07-10 — Make biome bosses readable and dodgeable

- Goal: turn procedural biome bosses from oversized melee trash into a real,
  readable encounter with one avoidable mechanic.
- Failing scenario: `boss-mechanic` found the named Warden of the Deep, then
  timed out waiting for any pre-hit boss warning; the existing elite only used
  an ordinary 320ms adjacent swing.
- Scenario added: the harness approaches the Old Barrow Warden, verifies a
  server-authored Ground Slam radius and one-second dodge window, leaves the
  circle and takes no hit, then stays inside a second warning and receives the
  named impact while surviving at level 5.
- Implementation: every generated biome boss now commits in place to a
  2.5-tile Ground Slam. The authoritative server anchors the warning and
  resolves damage against that exact circle. The client renders a dashed
  orange danger ring whose inner ring fills toward impact.
- Evidence: `npm run playtest` — 17/17 scenarios; `npm run test:unit` — 77
  files and 516 tests; `npm run lint` — exit 0; `npm run smoke:browser` — 1/1.
  The three required balance specs passed, and generation tests cover dungeon,
  grove, crypt, wilds, and marsh bosses.
- Critic score: 100/100. Final sample: first combat 0.58s, first drop 0.73s,
  level-1 TTK 0.63s, level-5 TTK 0.32s, 6 choices, 0 deaths, depth 4.
- Next target: Tier 2 depth-based loot proof — make deeper-floor rewards
  visibly and measurably stronger through the live drop pipeline.

## 2026-07-10 — Make deeper treasure visibly stronger

- Goal: prove that endless-depth progression changes the guaranteed treasure
  through the live generated-floor loot pipeline.
- Failing scenario: `depth-loot` reached both treasure rooms successfully but
  measured item level 10 on floor 1 and the same item level 10 on floor 5.
- Scenario added: a scion reads the guaranteed floor-1 Vesselforge treasure,
  descends through real stair transitions to floor 5, and compares the deep
  treasure's authoritative vessel item level.
- Implementation: guaranteed instance treasure now gains 10 item levels per
  floor after the first, capped at 80. Existing depth-based base pools and
  monster-drop scaling remain unchanged.
- Evidence: `npm run playtest` — 18/18 scenarios; `npm run test:unit` — 77
  files and 517 tests; `npm run lint` — exit 0; `npm run smoke:browser` — 1/1.
  The live comparison measured item level 10 → 50, and all three required
  balance specs passed.
- Critic score: 80/100 in the final sample. First combat was 0.58s, first drop
  0.74s, 6 choices, 0 deaths, and depth 4; the variable level-5 TTK sample was
  1.03s versus 0.62s at level 1 and missed that scorer point.
- Next target: Tier 3 UI clarity — replace the hard-coded quest pane with the
  current server-authored Aldwyn objective and reward state.

## 2026-07-10 — Show the live objective in the quest pane

- Goal: replace placeholder quest UI with the current server-authored Aldwyn
  objective and reward.
- Failing proof: `quest-pane-ui` could not import any quest presentation model,
  and the pane source contained only the fictional hard-coded “Haunted
  Trails.” The first browser attempt also proved the modern shell had no
  mounted legacy quest icon.
- Proof added: unit coverage maps all four server stages to concrete objective
  text and applies live `quest:update` payloads. Browser smoke opens Quests
  through the new `Q` hotkey and verifies Aldwyn plus the Verdigris reward.
- Implementation: the pane renders the login snapshot, quest stage changes are
  pushed after accept/clear/return, completion refreshes the displayed tree
  budget, and the modern pane system exposes Quests through `Q`.
- Evidence: `npm run playtest` — 18/18 scenarios; `npm run test:unit` — 78
  files and 520 tests; `npm run lint` — exit 0; `npm run smoke:browser` — 1/1.
- Critic score: 80/100 in the final sample. First combat was 0.58s, first drop
  0.75s, 6 choices, 0 deaths, and depth 4; variable TTK again missed the
  faster-at-level-5 scorer point (0.32s → 1.02s).
- Next target: consolidate the charter exit into `session-arc` itself so one
  command proves the explicit goal, boss mechanic, gear/tree choices,
  death/relic inheritance, relog, and voluntary second run.

## 2026-07-10 — Close the complete session-arc charter

- Goal: make the single `session-arc` exit command prove the whole intended
  first-session and legacy loop instead of relying on separate scenarios.
- Scenario expansion: one House now accepts Aldwyn's goal through Talk,
  fights and dodges the Warden, clears the floor for a permanent quest point,
  equips outcome-changing loot, spends the tree, reaches a depth wall, relogs
  with the build, voluntarily starts run two, dies permanently, enters the
  crypt, and has a later scion recover the developed battleaxe heirloom.
- Harness hardening: floor-clear setup retries until server acknowledgement;
  the boss position is read immediately before engagement; isolated gear
  trials cannot receive ambient support healing; low/high-ilvl TTK uses a
  240-HP hit-count comparison. The critic permits only 0.05s of live-loop
  scheduling tolerance, while still scoring real TTK regressions down.
- Evidence: `npm run playtest -- session-arc` passed consecutive runs at
  100/100; final `npm run playtest` passed 18/18; `npm run test:unit` passed 78
  files and 521 tests; `npm run lint` exited 0; `npm run smoke:browser` passed
  1/1, including the live Quests pane.
- Final critic sample: first combat 0.58s, first drop 4.72s, level-1 TTK
  0.97s, level-5 TTK 0.31s, 6 measured choices, 1 intentional death, depth 4,
  score 100/100.
- Exit: the goal-loop charter criteria are satisfied. No ladder item remains
  in this charter.

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

2026-07-11T03:39:57.407Z | session-arc | 100 | 0.58 | 0.75 | 1.88 | 0.62 | 6 | 0 | 4

2026-07-11T03:41:49.059Z | session-arc | 80 | 0.59 | 0.75 | 0.63 | 0.64 | 6 | 0 | 4

2026-07-11T03:43:00.739Z | session-arc | 80 | 0.59 | 0.76 | 0.63 | 0.63 | 6 | 0 | 4

2026-07-11T03:44:12.440Z | session-arc | 80 | 0.58 | 0.74 | 0.64 | 1.26 | 6 | 0 | 4

2026-07-11T03:54:22.594Z | session-arc | 100 | 0.58 | 0.73 | 0.63 | 0.32 | 6 | 0 | 4

2026-07-11T04:00:51.605Z | session-arc | 80 | 0.58 | 0.74 | 0.62 | 1.03 | 6 | 0 | 4

2026-07-11T04:10:21.428Z | session-arc | 80 | 0.58 | 0.75 | 0.32 | 1.02 | 6 | 0 | 4

2026-07-11T04:13:17.997Z | session-arc | 100 | 0.59 | 3.03 | 0.63 | 0.62 | 6 | 1 | 4

2026-07-11T04:16:10.941Z | session-arc | 80 | 0.6 | 4.42 | 0.63 | 0.63 | 6 | 1 | 4

2026-07-11T04:17:11.299Z | session-arc | 100 | 0.59 | 4.61 | 0.95 | 0.32 | 6 | 1 | 4

2026-07-11T04:21:11.737Z | session-arc | 100 | 0.61 | 4.67 | 1.27 | 0.63 | 6 | 1 | 4

2026-07-11T04:22:03.059Z | session-arc | 100 | 0.6 | 4.82 | 1.57 | 0.31 | 6 | 1 | 4

2026-07-11T04:22:17.119Z | session-arc | 100 | 0.59 | 4.85 | 0.95 | 0.63 | 6 | 1 | 4

2026-07-11T04:24:43.698Z | session-arc | 100 | 0.6 | 4.18 | 1.27 | 0.62 | 6 | 1 | 4

2026-07-11T04:26:02.492Z | session-arc | 100 | 0.58 | 4.72 | 0.97 | 0.31 | 6 | 1 | 4

2026-07-11T07:00:34.046Z | session-arc | 80 | 0.6 | 16.91 | 13.69 | 0.63 | 6 | 1 | 4

2026-07-11T07:04:26.529Z | session-arc | 100 | 0.59 | 6.03 | 2.82 | 0.31 | 6 | 1 | 4

2026-07-11T07:18:35.199Z | session-arc | 100 | 0.59 | 5.67 | 2.49 | 0.63 | 6 | 1 | 4

2026-07-11T07:29:57.738Z | session-arc | 100 | 0.6 | 4.92 | 1.89 | 0.63 | 6 | 1 | 4

2026-07-11T07:31:19.297Z | session-arc | 100 | 0.57 | 4.64 | 0.62 | 0.63 | 6 | 1 | 4

2026-07-12T00:36:11.404Z | session-arc | 100 | 0.6 | 3.79 | 0.94 | 0.62 | 6 | 1 | 4
