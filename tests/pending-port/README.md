# Pending-port specs (excluded from the unit run)

These specs came from the `login-restyle` line and codify its client UI
wiring and legacy socket-handler payload shapes. The merged client kept the
2.5D-overhaul architecture, so the *features* below still need porting onto
it — at which point each spec should be adapted and moved back into
`tests/unit/`:

- `hud-orb-ui.spec.js` — HUD orbs hosted by the pane host, WearPane retired.
- `inventory-store.spec.js` — Pinia drag-store wiring in InventoryGrid.
- `quest-pane-ui.spec.js` — quest pane rendering the live first-goal snapshot.
- `remote-pane-authorization.spec.js` — cand-004/005 adjacency gates through
  the legacy `{ player, item }` payload shape. The same guarantees for the
  current shape are covered by `tests/unit/pane-action-authorization.spec.js`.
- `browser-reconnect.spec.mjs` — session-resilience assertions welded to the
  `window.__verdigrisDiagnostics` API (ClientDiagnostics + ConnectionManager),
  which the merged client does not install. The merged client has its own
  reconnect/auto-relogin in Delaford.vue; porting the diagnostics API brings
  these assertions back.
- `browser-smoke.spec.mjs` — login-restyle's Playwright gate. Its early steps
  pass against the merged client, but each test ends on an unported feature:
  the browser-local account sign-in screen, the Escape game menu, and the
  narrow-viewport pane containment. `npm run smoke:browser` runs the
  browser-critical-loop spec until this returns.
