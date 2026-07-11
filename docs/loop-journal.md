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
