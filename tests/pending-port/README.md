# Pending-port specs (excluded from the unit run)

These specs came from the `login-restyle` line and codify its client UI
wiring and legacy socket-handler payload shapes. The merged client kept the
2.5D-overhaul architecture, so the *features* below still need porting onto
it — at which point each spec should be adapted and moved back into
`tests/unit/`:

- `escape-menu-ui.spec.js` — Escape game menu registered in the pane host
  (`src/components/ui/EscapeMenu.vue` exists; needs mounting in Delaford.vue).
- `hud-orb-ui.spec.js` — HUD orbs hosted by the pane host, WearPane retired.
- `inventory-store.spec.js` — Pinia drag-store wiring in InventoryGrid.
- `quest-pane-ui.spec.js` — quest pane rendering the live first-goal snapshot.
- `remote-pane-authorization.spec.js` — cand-004/005 adjacency gates through
  the legacy `{ player, item }` payload shape. The same guarantees for the
  current shape are covered by `tests/unit/pane-action-authorization.spec.js`.
