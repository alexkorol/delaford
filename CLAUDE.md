# Verdigris — Claude Code notes

The canonical agent guide (playtest rule, harness API, protocol crib sheet,
conventions) lives in AGENTS.md so it serves every coding agent. Read it
and follow it:

@AGENTS.md

## Claude-Code-specific

- Browser pass: use the preview tools (`preview_start`, config
  `delaford-dev` from `.claude/launch.json`) instead of running `npm run
  dev` in a shell. The dev server auto-logs-in as the `dev` guest account.
- Right-click in the preview: dispatch a `contextmenu` event on
  `#game-map` (the canvas listens for `contextmenu`, and synthetic `click`
  with button 2 does nothing).
- The skill tree opens with the `p` key; synthetic keys must be dispatched
  on `document.body` (window-level listeners guard against typing targets).
