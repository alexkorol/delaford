# Inventory art provenance

The PNGs in this directory were copied from the Verdigris inventory prototype
at `Z:\Code\WIZARD\tools\rpg_inventory\assets` in Delaford commit `2dddfea`.
The game copy contains 119 item finals plus the three UI textures
(`divider.png`, `frame_ornate.png`, and `slot_texture.png`); their hashes match
the prototype originals.

The underlying prototype art is project-created AI imagery, not a third-party
RPG icon pack. The WIZARD prototype documents it as a ChatGPT Pro image run
driven by `tools/rpg_inventory/core/ASSET-BRIEF.md` and `PROMPT.txt`, then
processed locally by `art_matte.py` and `compose_assets.py`. The main batches
entered WIZARD in commits `7316f87` and `56b81ed`, followed by reviewed intake
and replacement batches through `037f485`.

Some files look unfamiliar because the prototype generated a much broader
base-item ladder than its demo screen displayed. Verdigris currently maps a
curated subset through `src/core/inventory/item-art.js`; unused finals remain
available for later catalogue replacements.
