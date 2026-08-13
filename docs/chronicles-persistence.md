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
