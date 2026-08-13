# Live actor-art pipeline

The shipping monster and townsfolk atlases are built from three fixed 4×4,
reference-driven ImageGen source sheets. The old player, monster, and native
Vessel art supplied the visual vocabulary; every new actor is an original
Verdigris identity.

- Surface cast source: `src/assets/graphics/actors/source/surface-cast-generated.png`
- Stone–volcanic source: `src/assets/graphics/actors/source/adventure-depths-generated.png`
- Marsh–wilds and townsfolk source: `src/assets/graphics/actors/source/wilds-and-townsfolk-generated.png`
- Shipping monster atlas: `src/assets/graphics/actors/monsters.png`
- Shipping NPC atlas: `src/assets/graphics/actors/npcs.png`
- Builder: `tools/build_actor_sheets.py`
- Runtime frame contract: `server/shared/actor-graphics.js`

Rebuild both atlases from the repository root:

```bash
python3 tools/build_actor_sheets.py \
  src/assets/graphics/actors/source/surface-cast-generated.png \
  src/assets/graphics/actors/source/adventure-depths-generated.png \
  src/assets/graphics/actors/source/wilds-and-townsfolk-generated.png \
  src/assets/graphics/actors/monsters.png \
  src/assets/graphics/actors/npcs.png
```

The builder removes the pure-black matte, normalizes each silhouette into a
60px safe area, aligns its feet to a common baseline, and packs transparent
64px frames. The shipping monster atlas has 43 columns:

- 0–14: the three baseline monsters and 12 named surface-campaign monsters;
- 15–42: seven Adventure themes in `melee, ranged, support, boss` order.

The NPC atlas has Baynard, Shop keeper, Ludovicus, and Bank gnome in columns
0–3. Server definitions own the identity column. Static actor rendering must
use that column directly—player animation columns are poses and must never be
applied to these one-frame identities.

Generated-floor themes and their frame columns are centralized in
`server/shared/actor-graphics.js`. Add a source cell, mapping, and regression
coverage together whenever the live bestiary expands.
