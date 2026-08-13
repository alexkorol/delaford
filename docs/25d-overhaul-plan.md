# Verdigris 2.5D renderer overhaul plan

## Acceptance target surveyed

The packaged `Songs of the Mire` reference was run in a browser for more than two
minutes before this plan was written. Its strongest visual characteristics are:

- a low, tilted camera with the player held near 65% of the viewport height;
- strong but continuous depth scaling (near billboards are roughly three times
  the size of distant ones);
- a permanent fog-saturated horizon with a soft sky and treeline behind it;
- sharp focus around the player, smoothly increasing blur away from that plane;
- one warm-to-cool ambient grade over the fully composed frame, with local lights
  restored additively at night;
- pixel-art billboards whose feet remain attached to the same projected surface
  used by the terrain shader.

The reference's actors are not 3D models. The effect depends primarily on shared
projection, depth sorting, terrain filtering, atmosphere, and correct sprite foot
anchors. Verdigris's existing art can therefore be integrated first and judged in
the real camera before any sprite is replaced.

## Existing client/rendering architecture

- Stack: Vue 3 + Vite client with a custom Canvas 2D renderer. `Engine` owns a
  throttled `requestAnimationFrame` loop (20 fps by default).
- Main loop: `src/core/engine.js` updates the map, then calls separate map, item,
  monster, NPC, remote-player, local-player, projectile, combat-feedback, and
  mouse passes. `src/core/map.js` implements all world drawing.
- Canvas composition: the world is rendered at a native resolution into
  `Map.bufferCanvas`; that buffer is copied to the visible canvas at the current
  display scale. The default logical viewport is 24 x 15 tiles, each 32 x 32 px,
  but Vue can change the viewport dimensions responsively.
- Camera: the legacy camera is an orthographic crop centered on the local player.
  Interpolated sub-tile motion is expressed as `camera.offsetX/Y`, which shifts
  the crop while the player remains visually pinned.
- Input/picking: `GameCanvas.resolveViewportCoordinates` converts CSS pixels to
  buffer pixels, adds the legacy camera offset, and divides by 32. Context-menu
  payloads contain both viewport-relative tile coordinates and absolute world
  tile coordinates.
- Lifecycle: `Client.buildMap` constructs `Map`; scene transitions destroy and
  replace it; `Engine.stop` and `Map.destroy` are already used on reconnect and
  unmount. The new renderer must attach its WebGL/context resources to this same
  lifecycle.

## Coordinate and concept mapping

| Concept | Verdigris today | 2.5D mapping |
| --- | --- | --- |
| Gameplay position | integer tile `(x, y)` | unchanged |
| Render world unit | interpolated pixel position, 32 units per tile | one world unit remains one source pixel |
| World extent | 200 x 200 tiles / 6400 x 6400 units | unchanged |
| Depth axis | orthographic screen y | world pixel `wy`; larger `wy` is nearer |
| Camera target | local player's interpolated tile center | `cam.x/y` follows the same interpolated pixel position |
| Player screen row | viewport crop center | perspective `FOCUS = 0.65 * H` |
| Terrain contact | implicit tile square | `terrainHeight(wx, wy)`, initially zero |
| Sprite position | 32 x 32 top-left tile rectangle | bottom-center billboard anchored at the actor's interpolated world point |
| Item position | top-left of its tile | bottom-center billboard at the tile center |
| Projectile position | interpolated center point | projected point plus projected visual lift |
| Existing z-order | fixed category order; array order within categories | one far-to-near sort by foot `wy`, with overlays afterward |
| Mouse picking | inverse orthographic crop | exact `unproject(sx, sy)` at `h = 0`, then world-pixel to tile conversion |

`MovementController.getPosition()` and `centerOfTile()` already return pixel-world
centers. They will be the authoritative billboard foot coordinates. Actor frames
will draw upward from that point. The renderer will support per-sheet anchor
adjustments because the current 32 px sheets include varying transparent padding.

## Map and terrain data

- Surface and generated Adventure scenes are row-major arrays of 1-based Tiled
  GIDs with separate `background` and `foreground` layers.
- All current scenes use the configured 200 x 200 map extent. The terrain,
  objects, and dungeon atlases are selected by zero-based GID ranges in the
  current tile renderer.
- Collision and gameplay read the original tile arrays and will not depend on the
  visual terrain mesh.
- The first integration uses a single shared flat height function,
  `terrainHeight(wx, wy) = 0`. Verdigris has no authored elevation layer or tile
  elevation metadata today. This is intentional: it preserves every map and
  removes the risk of renderer-only slopes implying gameplay geometry that does
  not exist.
- The terrain texture bake will reuse the same GID-to-atlas resolver and layer
  order as the legacy renderer. To keep a 6400 x 6400 world within a practical
  memory budget, it may bake at a reduced pixels-per-tile density before POT
  upload; mipmaps and anisotropic filtering remain mandatory.
- The height API will be isolated so a future Tiled height layer can replace the
  flat implementation without changing projection, billboards, or picking.

## Renderer structure

The legacy path remains intact. A dedicated perspective renderer owned by `Map`
will provide:

1. shared projection state and exact `project`, `projectTerrain`, and `unproject`
   equations;
2. a pre-baked scene texture and one-draw-call WebGL terrain mesh;
3. Canvas 2D billboard collection, far-to-near sorting, continuous sprite DoF,
   and overlays;
4. a quarter-resolution screen-space lightmap and atmosphere passes;
5. context-loss handling and explicit resource disposal.

`Engine.paintCanvas` will choose one complete render pipeline per frame instead of
mixing passes. The runtime flag will default to the 2.5D renderer, preserve a
legacy fallback, support `?renderer=legacy`, remember the last selection locally,
and expose an `F6` debug toggle. Toggling must not change game/server state.

## Phase gates

### Phase 1 — projection and billboards

- Introduce the shared camera/projection module and perspective render pass.
- Project every actor, pickup, projectile, combat label, and mouse marker through
  the same formula; draw shadows at the foot points and sort billboards by `wy`.
- Switch browser picking to `unproject` in 2.5D mode.
- Keep the legacy ground temporarily and retain the runtime toggle.
- Add numerical projection/inverse tests and verify near/far scale ratio.

### Phase 2 — terrain

- Bake the current scene with the existing tile/GID semantics.
- Build the flat height grid and WebGL shaders with JS/shader camera parity.
- Upload through a legal POT texture with trilinear mipmaps and up to 8x
  anisotropy.
- Draw sky, horizon treeline, terrain fog, and the GL composite below billboards.
- Numerically compare terrain and billboard projection at representative points.

### Phase 3 — lighting and atmosphere

- Add a deterministic 90-second ambient cycle, quarter-resolution multiply
  lightmap, screen-space cloud shadows, and additive projected lights.
- Start with projectile/spell light and map-theme ambient cues; do not invent
  gameplay entities.
- Add vignette after the lighting composite.

### Phase 4 — DoF and polish

- Add continuous mip-bias terrain DoF and continuous, quantized Canvas blur for
  sprites, with strength coupled to zoom.
- Add wheel zoom and restrained tone-appropriate mist/firefly/ray passes.
- Skip terrain occlusion while height is flat; the hook remains available for a
  later authored height layer.

### Phase 5 — performance and hardening

- Enforce one terrain draw call, quarter-resolution lighting, cached static
  textures/gradients, and minimized sprite filter changes.
- Skip rendering below a 10 px viewport, floor zoom, handle WebGL context loss and
  restoration, and release textures/buffers/programs on scene destruction.
- Run lint, unit tests, production build, the complete `npm run playtest` harness,
  and the required real-browser interaction pass.

## Asset strategy

The sparse integration sheets have now been replaced where the live renderer
showed the most leverage. The player uses a reference-driven 4×4 directional
and action sheet. Monsters and NPCs use foot-aligned 64px identity frames built
from three fixed 4×4 pure-black-matte source sheets. The generated bestiary
covers all 15 surface monsters and all 28 combinations of seven Adventure
themes × four roles; generated instances no longer collapse to frame zero.

The deterministic actor builder, source order, and runtime column contract are
documented in `docs/actor-art-pipeline.md`. Shipping frames remain transparent,
render into a 32px world footprint in the legacy renderer, and use an equivalent
scale in perspective so source resolution improves zoom detail without changing
collision or visual occupancy. New actors must extend the source sheet and
server mapping together, then pass both live near/far comparison and the atlas
contract tests.

## Known failure guards adopted from the reference

- No rendering with a viewport under 10 px; projection zoom is always floored.
- Clouds remain in screen space and never go through the near-plane projection.
- DoF is continuous; no discrete blur bands.
- Terrain textures are POT-resampled before generating WebGL1 mipmaps.
- Projection uses high precision in the vertex shader.
- Terrain and billboards call the same height function contract.
- The GL canvas is transparent and composited into the 2D buffer so the entire
  post stack operates on one image.
