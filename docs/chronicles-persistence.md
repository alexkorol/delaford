# Chronicles persistence

Chronicles are account-level data. The server is authoritative; browser
`localStorage` is only an account-scoped cache and an upgrade source for
records created before server persistence existed.

## Storage

The default file is `server/data/chronicles-store.json` (runtime data, ignored
by Git). Set `CHRONICLES_STORE_FILE` to isolate a server or test run. Writes use
a temporary file plus atomic rename, and the server acknowledges a change only
after that rename succeeds.

Each account record contains a monotonically increasing revision and a schema
v3 Chronicle:

- Houses, living Scions, crypt entries, and active selection
- server-owned renown and crypt membership
- optional fallen-Scion heirlooms with exact generated item identity and a
  server-owned `queued` → `circulating` → `recovered` lifecycle
- bounded names, IDs, levels, timestamps, and deeds

Malformed records are skipped during load rather than preventing the game
server from starting.

## Protocol

`player:chronicles:ready` includes the canonical state, revision, existence
flag, and account cache key. Normal edits use small, validated
`player:chronicles:mutate` operations (`found-house`, `add-scion`,
`select-house`, `select-scion`). `player:chronicles:update` acknowledges the
new canonical revision.

`player:chronicles:save` accepts a complete state only when the account has no
server record. This is the one-time import path for the old unscoped
`verdigris_houses` browser key. After the server acknowledges the import, the
client writes the account-scoped cache and removes the legacy key.

Final mortal death is never client-authored. The server moves the active
living Scion into the crypt, persists that revision, removes the player from
the world, and then returns the authenticated socket to Chronicles. Reconnect
and world admission resolve the selected identity against the server's living
roster, so a crypt entry cannot be resurrected by changing a browser payload.

## Fallen heirlooms

When a mortal Scion is entombed, the server selects one eligible item: equipped
gear first (main hand has highest priority), then non-stackable weapon, armour,
or jewelry in the backpack. The exact UUID, generated name, affixes, VesselForge
record, stats, and binding are stored on the crypt entry. The item is removed
from inherited character state; successor admission also prunes the UUID while
it remains unrecovered, closing the duplication window if a process stopped
mid-handoff.

The next elite slain by a living Scion of that House releases one queued
heirloom into the real scene loot. It remains account-bound and carries its
House/Scion provenance. A successful real pickup persists the character item
and moves the Chronicle record to `recovered`. `circulating` is transient world
state, so a server restart safely requeues it rather than losing the heirloom.

Entombment is idempotent. Repeating the return request after an interrupted
handoff returns the existing crypt record without duplicating the fallen Scion
or incrementing the Chronicle revision.
