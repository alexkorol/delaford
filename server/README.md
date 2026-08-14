# Verdigris server

Verdigris uses a server-authoritative WebSocket loop. The Node server owns the
world, validates player actions, updates mutable state, and broadcasts the
resulting snapshots and events to connected clients.

Accounts, Houses, scions, crypt records, and relic circulation are stored in
SQLite. Character state is saved into the living scion's Chronicle snapshot;
the client never owns authoritative progression.

See `AGENTS.md` for protocol events and the required playable-loop harness.
