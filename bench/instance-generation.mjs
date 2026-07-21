/**
 * Benchmark: procedural instance generation (Map.generateInstance).
 *
 * WHY THIS WORKLOAD
 * -----------------
 * Map.generateInstance (server/core/map.js) is the narrowest deterministic,
 * high-leverage production workload in the hot path: every Adventure
 * `instance:enterSolo` and every world-web `world:zone:enter` builds a floor
 * through it, and the measured suite spends seconds inside it
 * (tests/unit/instance-balance.spec.js ~2.5s, tests/unit/dungeon-instance.spec.js
 * ~1.46s, full unit suite 15.41s on the reference machine). Given a numeric
* seed it is fully deterministic (seeded RNG; the Date.now() fallback in
* normaliseSeed is never reached by the fixed case matrix below), so its
* entire output can be hashed and used as an output-equivalence oracle.
 * The sole exception is the treasure drop's item instance: ItemFactory stamps
 * per-run uuid/timestamp fields and rolls the gear's affix/vessel block at
 * drop time (server/core/items/factory.js), so the oracle hashes a semantic
 * projection - full map/metadata/monsters plus each drop's deterministic
 * identity/type/position/quantity - see projectionOf below.
*
* WHAT A FUTURE >=10x CLAIM MUST PROVE (this script is the gate)
 * -------------------------------------------------------------
 * 1. Identical per-case sha256 digests against a baseline saved with --save,
 *    re-run with --verify baseline.json (exit code is non-zero on mismatch).
 * 2. The semantic invariants asserted on every run still hold: dungeon tileset
 *    purity on both layers, entry/exit stairs placed, every room centre
 *    reachable on foot from the entry stairs, monster spawns outside
 *    INSTANCE_SPAWN_SAFE_RADIUS, exactly one elite boss, and the request
 *    (template/layout/depth) echoed in metadata.
 * 3. A >= 10x median speedup across the fixed 12-case matrix (reported by
 *    --verify as verify.medianSpeedup).
 *
 * COST MODEL (hypotheses for the optimization turn; measured here, fixed there)
 * ----------------------------------------------------------------------------
 * - decorateInstance's wall pass scans all 200x200 cells x 8 neighbours, and
 *   each isFloor probe runs wallPool.includes(tile): a linear scan per probe.
 * - Carving resolves every tile through the floorPicker/Map.pickTile closures.
 * - The connectivity guarantee flood-fills with a Set of indices and {x, y}
 *   queue objects, one full flood per repair pass.
 * - Two 40k-element Array allocations/fills per floor.
 * NOTE: map.background/foreground must stay plain Arrays (unit tests compare
 * them with toEqual), so typed-array swaps alone are not semantics-preserving.
 *
 * RUNTIME BUDGET
 * --------------
 * 12 cases x (3 warmup + 30 measured + 2 digest) generations ~= 420 floor
 * builds: a few seconds on the reference machine. The measured loop contains
 * ONLY the production call; digest/invariant work happens outside it.
 * Tune with --rounds N --warmup N.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import GameMap, { INSTANCE_SPAWN_SAFE_RADIUS } from '#server/core/map.js';
import UI from '#shared/ui.js';
import { DUNGEON_FIRST_GID, dungeonGid } from '#shared/dungeon-tiles.js';

const BENCHMARK_ID = 'instance-generation';
const TARGET = 'server/core/map.js :: Map.generateInstance';

// Fixed representative matrix: all three layout recipes (warren / clearings /
// gauntlet), indoor and outdoor themes, depths 1/3/6 (depth rotates the theme
// pools and scales monster counts). Seeds are non-zero so normaliseSeed never
// falls back to Date.now().
const CASES = [
  { name: 'dungeon-warren-depth1', input: { seed: 1234, template: 'dungeon', layout: 'warren', depth: 1 } },
  { name: 'dungeon-warren-depth6', input: { seed: 20260710, template: 'dungeon', layout: 'warren', depth: 6 } },
  { name: 'dungeon-warren-seed1001', input: { seed: 1001, template: 'dungeon', layout: 'warren', depth: 1 } },
  { name: 'crypt-warren-depth1', input: { seed: 99, template: 'crypt', layout: 'warren', depth: 1 } },
  { name: 'crypt-clearings-depth1', input: { seed: 9, template: 'crypt', layout: 'clearings', depth: 1 } },
  { name: 'crypt-gauntlet-depth3', input: { seed: 12, template: 'crypt', layout: 'gauntlet', depth: 3 } },
  { name: 'marsh-warren-depth1', input: { seed: 8675309, template: 'marsh', layout: 'warren', depth: 1 } },
  { name: 'marsh-warren-depth6', input: { seed: 8675309, template: 'marsh', layout: 'warren', depth: 6 } },
  { name: 'grove-clearings-depth1', input: { seed: 4, template: 'grove', layout: 'clearings', depth: 1 } },
  { name: 'wilds-clearings-depth3', input: { seed: 4, template: 'wilds', layout: 'clearings', depth: 3 } },
  { name: 'sand-warren-depth3', input: { seed: 7, template: 'sand', layout: 'warren', depth: 3 } },
  { name: 'volcanic-warren-depth3', input: { seed: 7, template: 'volcanic', layout: 'warren', depth: 3 } },
];

// Per-run noise proven from the production constructors (see projectionOf
// below): ItemFactory stamps every world drop with a fresh uuid() and a
// Date.now() timestamp (server/core/items/factory.js createFromBase /
// toWorldInstance), and the treasure gear's affix/vessel roll is drop-time
// randomness. uuid/timestamp are stripped here at any depth; the rolled
// affix/vessel fields are excluded by the item projection below. Extend this
// ONLY for proven per-run noise, never to hide a real output change.
const VOLATILE_KEYS = new Set(['uuid', 'timestamp']);

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach((key) => {
      if (!VOLATILE_KEYS.has(key)) {
        sorted[key] = canonicalize(value[key]);
      }
    });
    return sorted;
  }
  return value;
};

// The equivalence oracle hashes a SEMANTIC PROJECTION of the generation, not
// the raw object. Provenance, from the production source:
//
// - server/core/map.js: every tile, room, corridor, decor, water, stair,
//   spawn, rarity, pack-size, and reward roll consumes the seeded
//   createSeededGenerator rng, and normaliseSeed's Date.now() fallback is
//   unreachable for the fixed non-zero case seeds. The returned monsters are
//   plain definition objects (id instance-<seed>-<index>); `new Monster()`
//   (which would attach uuid()/Date.now() state, server/core/monster.js)
//   never runs inside generateInstance.
// - server/core/items/factory.js: world drops are the only per-run-varying
//   output. createFromBase assigns uuid(); toWorldInstance re-stamps uuid and
//   adds a Date.now() timestamp; rollAffixes + createVesselBlock produce the
//   gear's affixes, vessel, affix/vessel-merged stats, and composed
//   name/displayName as drop-time rolls that a fixed map seed does not
//   reproduce. Proof by elimination: identical inputs produced differing
//   digests with uuid/timestamp already stripped, while map, metadata, and
//   monsters are provably seeded - the drop roll is the only remaining
//   source of variance.
//
// The projection keeps the full equivalence contract: both tile layers, all
// of metadata (seed/depth/template/theme/layout, rooms, stairs, spawns,
// treasure, rewards), every monster definition in full, and each drop's
// deterministic identity - base id/name, type, equip slot, stackable flag,
// stack quantity, and tile position.
const projectItemForDigest = item => ({
  id: item.id ?? null,
  baseId: item.baseId ?? null,
  baseName: item.baseName ?? null,
  type: item.type ?? null,
  equipSlot: item.equipSlot ?? item.slotType ?? null,
  stackable: item.stackable === true,
  qty: Number.isFinite(item.qty) ? item.qty : null,
  x: item.x,
  y: item.y,
});

const projectionOf = generation => ({
  map: generation.map,
  metadata: generation.metadata,
  respawns: generation.respawns,
  npcs: generation.npcs,
  monsters: generation.monsters,
  items: (generation.items || []).map(projectItemForDigest),
});

const digestOf = generation => createHash('sha256')
  .update(JSON.stringify(canonicalize(projectionOf(generation))))
  .digest('hex');

const walkableAt = (map, index) => {
  const bgWalkable = UI.tileWalkable(map.background[index] - 1);
  const fgGid = map.foreground[index];
  const fgWalkable = fgGid ? UI.tileWalkable(fgGid - 1, 'foreground') : true;
  return bgWalkable && fgWalkable;
};

const floodFromEntry = (map, entry, width) => {
  const seen = new Uint8Array(map.background.length);
  const start = (entry.y * width) + entry.x;
  seen[start] = 1;
  const queue = [start];
  while (queue.length) {
    const current = queue.pop();
    const x = current % width;
    const y = Math.floor(current / width);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= width) {
        return;
      }
      const ni = (ny * width) + nx;
      if (!seen[ni] && walkableAt(map, ni)) {
        seen[ni] = 1;
        queue.push(ni);
      }
    });
  }
  return seen;
};

const assertInvariants = (generation, input) => {
  const { map, metadata, monsters } = generation;
  const width = Math.sqrt(map.background.length);
  assert.ok(Number.isInteger(width), 'map stays square');

  assert.equal(map.foreground.length, map.background.length, 'layers stay aligned');
  assert.ok(
    map.background.every(gid => gid >= DUNGEON_FIRST_GID),
    'background stays inside the dungeon tileset',
  );
  assert.ok(
    map.foreground.every(gid => gid === 0 || gid >= DUNGEON_FIRST_GID),
    'foreground stays inside the dungeon tileset',
  );

  const stairsUpIndex = (metadata.stairsUp.y * width) + metadata.stairsUp.x;
  assert.equal(map.foreground[stairsUpIndex], dungeonGid('stairs_up'), 'entry stairs placed');
  if (metadata.stairsDown) {
    const stairsDownIndex = (metadata.stairsDown.y * width) + metadata.stairsDown.x;
    assert.equal(map.foreground[stairsDownIndex], dungeonGid('stairs_down'), 'exit stairs placed');
  }

  assert.equal(metadata.template, input.template, 'template echoes the request');
  assert.equal(metadata.depth, Math.max(1, Math.floor(input.depth || 1)), 'depth echoes the request');
  if (input.layout) {
    assert.equal(metadata.layout, input.layout, 'layout echoes the request');
  }
  assert.ok(metadata.spawnPoints.length > 0, 'spawn points exist');

  const seen = floodFromEntry(map, metadata.stairsUp, width);
  metadata.roomCentres.forEach((room) => {
    assert.ok(seen[(room.y * width) + room.x], `room centre ${room.x},${room.y} reachable from entry`);
  });

  monsters.forEach((monster) => {
    const chebyshev = Math.max(
      Math.abs(monster.spawn.x - metadata.stairsUp.x),
      Math.abs(monster.spawn.y - metadata.stairsUp.y),
    );
    assert.ok(chebyshev > INSTANCE_SPAWN_SAFE_RADIUS, `${monster.id} respects the spawn safe radius`);
  });
  assert.equal(
    monsters.filter(monster => monster.rarity === 'elite').length,
    1,
    'exactly one elite guards the stairs down',
  );
};

const summarise = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    min: sorted[0],
    median,
    mean: sum / sorted.length,
    max: sorted[sorted.length - 1],
  };
};

const round3 = value => Math.round(value * 1000) / 1000;

const parseArgs = (argv) => {
  const options = {
    rounds: 30,
    warmup: 3,
    save: null,
    verify: null,
  };
  argv.forEach((flag, index) => {
    if (flag === '--rounds') {
      options.rounds = Number.parseInt(argv[index + 1], 10);
    } else if (flag === '--warmup') {
      options.warmup = Number.parseInt(argv[index + 1], 10);
    } else if (flag === '--save') {
      options.save = argv[index + 1];
    } else if (flag === '--verify') {
      options.verify = argv[index + 1];
    }
  });
  assert.ok(options.rounds >= 5, '--rounds must be >= 5 for a useful median');
  assert.ok(options.warmup >= 1, '--warmup must be >= 1');
  return options;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  // Warm the JIT and any one-time module cost; discarded before measurement.
  for (let round = 0; round < options.warmup; round += 1) {
    for (let index = 0; index < CASES.length; index += 1) {
      await GameMap.generateInstance(CASES[index].input);
    }
  }

  // Measured rounds, interleaved across cases so machine drift hits every
  // case evenly. Nothing but the production call is timed.
  const samplesByCase = CASES.map(() => []);
  for (let round = 0; round < options.rounds; round += 1) {
    for (let index = 0; index < CASES.length; index += 1) {
      const before = performance.now();
      await GameMap.generateInstance(CASES[index].input);
      samplesByCase[index].push(performance.now() - before);
    }
  }

  // Per case: determinism self-check (same inputs -> identical digest twice),
  // semantic invariants, then timing summary.
  const cases = [];
  for (let index = 0; index < CASES.length; index += 1) {
    const testCase = CASES[index];
    const first = await GameMap.generateInstance(testCase.input);
    const second = await GameMap.generateInstance(testCase.input);
    const digest = digestOf(first);
    assert.equal(
      digestOf(second),
      digest,
      `${testCase.name}: generateInstance must be deterministic for a fixed seed`,
    );
    assertInvariants(first, testCase.input);

    const stats = summarise(samplesByCase[index]);
    cases.push({
      name: testCase.name,
      input: testCase.input,
      digest,
      theme: first.metadata.theme,
      layout: first.metadata.layout,
      roomCentres: first.metadata.roomCentres.length,
      monsters: first.monsters.length,
      samplesMs: samplesByCase[index].map(round3),
      minMs: round3(stats.min),
      medianMs: round3(stats.median),
      meanMs: round3(stats.mean),
      maxMs: round3(stats.max),
    });
  }

  const allSamples = samplesByCase.reduce((flat, samples) => flat.concat(samples), []);
  const measuredMs = allSamples.reduce((total, value) => total + value, 0);
  const overall = summarise(allSamples);
  const totals = {
    cases: CASES.length,
    generations: allSamples.length,
    measuredMs: round3(measuredMs),
    medianMs: round3(overall.median),
    meanMs: round3(overall.mean),
    generationsPerSecond: round3(allSamples.length / (measuredMs / 1000)),
  };

  const result = {
    benchmark: BENCHMARK_ID,
    target: TARGET,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    startedAt: new Date().toISOString(),
    params: { rounds: options.rounds, warmup: options.warmup },
    totals,
    cases,
  };

  let failed = false;
  if (options.verify) {
    const baseline = JSON.parse(readFileSync(options.verify, 'utf8'));
    assert.equal(
      baseline.benchmark,
      BENCHMARK_ID,
      `${options.verify} is not an ${BENCHMARK_ID} baseline`,
    );
    const baselineByName = new Map();
    baseline.cases.forEach(entry => baselineByName.set(entry.name, entry));

    const comparisons = [];
    const failures = [];
    cases.forEach((entry) => {
      const before = baselineByName.get(entry.name);
      if (!before) {
        failures.push({ case: entry.name, reason: 'case missing from baseline' });
        return;
      }
      const digestMatch = before.digest === entry.digest;
      if (!digestMatch) {
        failures.push({
          case: entry.name,
          reason: 'digest mismatch',
          baseline: before.digest,
          current: entry.digest,
        });
      }
      comparisons.push({
        case: entry.name,
        digestMatch,
        baselineMedianMs: before.medianMs,
        currentMedianMs: entry.medianMs,
        speedup: round3(before.medianMs / entry.medianMs),
      });
    });
    baseline.cases.forEach((entry) => {
      if (!cases.some(current => current.name === entry.name)) {
        failures.push({ case: entry.name, reason: 'case missing from current run' });
      }
    });

    const speedups = comparisons.map(entry => entry.speedup);
    result.verify = {
      baseline: options.verify,
      comparisons,
      medianSpeedup: speedups.length ? round3(summarise(speedups).median) : null,
      failures,
      ok: failures.length === 0,
    };
    failed = failures.length > 0;
  }

  if (options.save) {
    writeFileSync(options.save, `${JSON.stringify(result, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failed) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  process.stderr.write(`${BENCHMARK_ID} benchmark failed: ${error.stack || error}\n`);
  process.exitCode = 1;
});
