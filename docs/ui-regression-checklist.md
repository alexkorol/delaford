# UI Regression Checklist

## Movement Smoothing
- Log into a world, hold `W` then change direction diagonally and confirm transitions stay eased with no snapping.
- Compare the move duration to `DEFAULT_MOVE_DURATION_MS` by counting tiles travelled; ensure long strides remain proportional.
- Watch NPC patrols for hitching after resizing the window; interpolation should remain smooth at 60 FPS.

## Pane Mechanics
- Desktop >= 1200px: click the HP orb (or press `S` in debug) to open the Stats pane; confirm the pane docks left, the world view stays centered, and closing with `Esc` restores layout.
- Desktop: click the MP orb to open Inventory; verify the pane docks right, retains scroll position on reopen, and outside clicks close it.
- Tablet 768-1199px: resize the window, open Stats/Inventory, ensure the overlay slides in, ESC + backdrop click closes, and focus returns to game.

## Chat + Quickbar
- With chat collapsed, send/receive a message; badge increments, preview updates, and `Show chat` opens the overlay without shifting the canvas.
- Keep chat unpinned, interact, and verify it auto-collapses after ~8s of inactivity; pinning disables auto-hide.
- Press numeric keys `1-8` while the canvas is focused; the matching quick slot highlights briefly and activates its assigned skill.
- Hit `/` to open chat and focus the input, then `Esc` to collapse (when unpinned) without affecting panes.

## Responsive Behaviour
- Sweep viewport widths 480px to 1920px ensuring:
  - Canvas scales smoothly while preserving a 16:10 aspect ratio; horizontal scroll never appears.
  - Pixel edges remain crisp at 2x scale; no browser smoothing or stretching artifacts when resizing.
  - Quickbar stays anchored between orbs; chat toggle relocates (fixed) on mobile.
  - Pane overlay switches between push (desktop) and float (tablet/mobile) with safe tap targets.
- Mobile (<768px) landscape: open chat; overlay behaves like a bottom sheet and world remains scrollable.

## Pane Scroll Checks
- Populate Inventories (use bank debug) and confirm overflow areas support native scroll momentum on all breakpoints.
- Switch between Stats <-> Inventory; the previously visited pane should restore its scroll offset and focus the first control when reopened.
