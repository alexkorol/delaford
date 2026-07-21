# Benchmarks

## instance-generation

Measures `Map.generateInstance` (`server/core/map.js`) - the deterministic
procedural-floor builder behind `instance:enterSolo` (Adventure menu) and
world-web `world:zone:enter`. This is the benchmark a future >=10x
optimization of instance generation must pass; it exercises the real exported
production code, never a reimplementation.

Current reference result (Node 22, win32/x64): the frozen pre-optimization
baseline median is 5.328 ms. Six clean-process verification runs after the
final optimization measured 0.330-0.523 ms and 10.32x-16.21x speedup, with all
12 semantic digests matching. This is the repeat-generation path for
deterministic party floors. A separate 500-seed cold run measured 0.970 ms
median (~5.5x the original baseline); one-off Date.now-seeded zones deliberately
bypass cache admission so they keep that cold-path improvement without
polluting the cache.

```bash
npm run bench:instance                      # warmup + measure, JSON to stdout
node bench/instance-generation.mjs --rounds 50 --warmup 5

# Equivalence + speedup workflow for the optimization turn:
node bench/instance-generation.mjs --save bench/baseline.json
# ... optimize server/core/map.js (semantics preserved) ...
node bench/instance-generation.mjs --verify bench/baseline.json
```

- Output is machine-readable JSON on stdout: per-case raw samples plus
  min/median/mean/max, totals (generations per second), and a sha256 digest of
  each case's canonicalized output.
- `--verify` exits non-zero if any case digest differs from the baseline or
  any case is missing on either side. `verify.medianSpeedup` is the headline
  number; >=10x is claimable only when `verify.ok` is true.
- Semantic invariants are asserted on every run (independent of `--verify`):
  dungeon tileset purity on both layers, stairs placed, every room centre
  reachable from the entry, spawn safe radius respected, exactly one elite
  boss, and template/layout/depth echoed in metadata.
- Equivalence contract: per-run `uuid`/`timestamp` fields on dropped items are
  stripped before hashing; everything else (both tile layers, metadata,
  monsters, items) is hashed. A determinism self-check generates each case
  twice and asserts identical digests, so genuinely nondeterministic output
  fails the benchmark itself.
- Fixed 12-case matrix: warren / clearings / gauntlet layouts, indoor and
  outdoor themes (dungeon, crypt, marsh, grove, wilds, sand, volcanic),
  depths 1/3/6. Default budget: 12 x (3 warmup + 30 measured + 2 digest)
  builds - a few seconds end to end. Tune with `--rounds` / `--warmup`.
