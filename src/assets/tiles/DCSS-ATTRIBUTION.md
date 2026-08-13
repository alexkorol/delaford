# Dungeon tileset attribution

`dungeon.png` is assembled from the Dungeon Crawl Stone Soup (DCSS) `rltiles` set
(https://github.com/crawl/crawl, crawl-ref/source/rltiles), which builds on the
public-domain RLTiles set (http://rltiles.sf.net). The tiles are public domain /
CC0; some were modified by DCSS contributors.

The final three mining-node tiles (`rock_depleted`, `rock_copper`, and
`rock_tin`) are Verdigris project assets generated with OpenAI's built-in image
generation workflow on 2026-08-13, using the legacy Verdigris resource sprites
only as a style reference. Their checked-in 32 px sources live under
`sources/mining/` and are appended by `tools/build_dungeon_atlas.py`; they are
not part of DCSS/RLTiles.
