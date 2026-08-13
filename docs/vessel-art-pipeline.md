# Native Vessel item-art pipeline

The shipping native Vessel atlas is generated from one reference-driven
ImageGen source sheet. Legacy catalogue atlases remain unchanged.

- Source: `src/assets/graphics/items/source/vessels-generated.png`
- Shipping atlas: `src/assets/graphics/items/vessels.png`
- Builder: `tools/build_vessel_sheet.py`

Rebuild it from the repository root:

```bash
python3 tools/build_vessel_sheet.py \
  src/assets/graphics/items/source/vessels-generated.png \
  src/assets/graphics/items/vessels.png
```

The source is a 4×4 pure-black-matte contact sheet. The first 13 cells are,
in order: handaxe, spear, macuahuitl, atlatl, khopesh, sling, shield, wrap,
crest, grips, sandals, gorget, and ring. The builder removes the matte, fits
each silhouette into a 28px safe area, and packs a transparent 416×32 atlas.
