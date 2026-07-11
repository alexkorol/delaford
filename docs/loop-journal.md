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

## Session-arc metric trends

UTC | Scenario | Score | First combat (s) | First drop (s) | TTK L1 (s) | TTK L5 (s) | Choices | Deaths | Depth
--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:

2026-07-11T02:49:54.583Z | session-arc | 100 | 0.61 | 0.76 | 0.63 | 0.32 | 6 | 0 | 4

2026-07-11T02:51:03.386Z | session-arc | 100 | 0.59 | 0.74 | 1.89 | 0.62 | 6 | 0 | 4
