#!/usr/bin/env python3
"""Build the delaford dungeon tileset from DCSS (crawl) rltiles.

Art is public domain / CC0 (RLTiles lineage; see src/assets/tiles/DCSS-ATTRIBUTION.md).

Usage:
    git clone --filter=blob:none --no-checkout --depth 1 https://github.com/crawl/crawl <crawl_dir>
    cd <crawl_dir> && git sparse-checkout set --no-cone crawl-ref/source/rltiles/dngn && git checkout
    python tools/build_dungeon_atlas.py <crawl_dir> [repo_root]

Outputs (relative to repo root):
    src/assets/tiles/dungeon.png        - 16-column 32px atlas
    server/shared/dungeon-tiles.js      - generated gid manifest (do not hand-edit)
    server/maps/layers/dungeon.tsx      - Tiled tileset (firstgid 541 in surface maps)

Adding tiles: extend the tables below, rerun, and keep existing entries in the
same order so already-painted gids stay stable.
"""
import os
import sys
import json
from PIL import Image

CRAWL = sys.argv[1] if len(sys.argv) > 1 else "../crawl"
RL = os.path.join(CRAWL, "crawl-ref/source/rltiles/dngn")
OUT_REPO = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = 16
TILE = 32
FIRST_GID = 541  # terrain 1-252, objects 253-540

def exists(rel): return os.path.exists(os.path.join(RL, rel))

def seq(pattern, start, stop):
    out = []
    for i in range(start, stop + 1):
        rel = pattern.format(i)
        if exists(rel): out.append(rel)
    return out

def first(*cands):
    for rel in cands:
        if exists(rel): return [rel]
    return []

floors = {
    "stone":    seq("floor/pebble_brown{}.png", 0, 8),
    "grey":     seq("floor/grey_dirt{}.png", 0, 7),
    "crypt":    seq("floor/crypt{}.png", 0, 7),
    "sand":     seq("floor/sandstone_floor{}.png", 0, 9),
    "volcanic": seq("floor/volcanic_floor{}.png", 0, 6),
    "marsh":    seq("floor/bog_green{}.png", 0, 3),
    "mud":      seq("floor/mud{}.png", 0, 3),
    "ice":      seq("floor/ice{}.png", 0, 3) or seq("floor/frozen{}.png", 0, 3),
    "lair":     seq("floor/lair{}.png", 0, 3),
    "blood":    seq("floor/cobble_blood{}.png", 1, 4),
    "dirt":     seq("floor/dirt{}.png", 0, 2),
    "marble":   seq("floor/marble_floor{}.png", 1, 6),
    "tomb":     seq("floor/tomb{}.png", 0, 3),
}
liquids = {
    "water_shallow": first("water/shallow_water.png", "water/shoals_shallow_water0.png"),
    "water_deep":    first("water/deep_water.png", "water/deep_water_murky.png", "water/shoals_deep_water0.png"),
    "water_murky":   first("water/deep_water_murky.png", "water/murky_water.png"),
    "lava":          seq("floor/lava{}.png", 0, 3) or first("misc/lava.png", "floor/lava.png"),
}
walls = {
    "brick":    seq("wall/brick_brown{}.png", 0, 7),
    "stone":    seq("wall/catacombs{}.png", 0, 9),
    "crypt":    seq("wall/crypt{}.png", 0, 7),
    "sand":     seq("wall/sandstone_wall{}.png", 0, 9),
    "marble":   seq("wall/marble_wall{}.png", 1, 6),
    "volcanic": seq("wall/volcanic_wall{}.png", 0, 6),
    "relief":   seq("wall/relief{}.png", 0, 3) + seq("wall/relief_brown{}.png", 0, 3),
    "vines":    seq("wall/brick_brown-vines{}.png", 1, 3),
}
doors = {
    "door_closed":       first("doors/closed_door.png", "doors/dngn_closed_door.png"),
    "door_open":         first("doors/open_door.png", "doors/dngn_open_door.png"),
    "door_broken":       first("doors/broken_door.png"),
    "door_runed":        first("doors/runed_door.png", "doors/runed_door_right.png"),
    "door_closed_crypt": first("doors/closed_door_crypt.png"),
    "door_broken_crypt": first("doors/broken_door_crypt.png"),
}
gateways = {
    "stairs_up":      first("gateways/stone_stairs_up.png"),
    "stairs_down":    first("gateways/stone_stairs_down.png"),
    "hatch_up":       first("gateways/escape_hatch_up.png"),
    "hatch_down":     first("gateways/escape_hatch_down.png"),
    "stairs_up_metal":   first("gateways/metal_stairs_up.png"),
    "stairs_down_metal": first("gateways/metal_stairs_down.png"),
    "portal":         first("gateways/dngn_portal.png", "gateways/portal.png", "gateways/dngn_enter.png"),
    "exit_portal":    first("gateways/dngn_exit.png", "gateways/exit_dungeon.png", "gateways/dngn_return.png"),
}
trees = {
    "tree":           seq("trees/tree{}.png", 1, 6),
    "tree_dead":      seq("trees/dead_tree{}.png", 1, 2) or seq("trees/tree_dead{}.png", 1, 2),
    "tree_petrified": seq("trees/tree_petrified{}.png", 1, 2),
}
decor_blocked = {
    "statue":         first("statues/granite_statue.png", "statues/statue_granite.png"),
    "statue_angel":   first("statues/angel_statue.png", "statues/statue_angel.png"),
    "statue_archer":  first("statues/archer_statue.png", "statues/statue_archer.png"),
    "statue_dragon":  first("statues/dragon_statue.png", "statues/statue_dragon.png"),
    "fountain_blue":  first("decor/blue_fountain.png", "decor/fountain_blue.png"),
    "fountain_blood": first("decor/blood_fountain.png"),
    "fountain_sparkling": first("decor/sparkling_fountain.png"),
    "fountain_dry":   first("decor/dry_fountain.png"),
    "grate":          first("grate.png"),
    "altar_generic":  [],  # filled below from altars/
    "sarcophagus":    first("decor/sarcophagus_sealed.png", "decor/sarcophagus.png", "vaults/sarcophagus_sealed.png"),
}
decor_walkable = {
    "flowers": seq("decor/flower_patch_{}.png", 0, 3),
    "floor_decorative": first("decor/decorative_floor.png"),
}

altdir = os.path.join(RL, "altars")
if os.path.isdir(altdir):
    alts = sorted(f for f in os.listdir(altdir) if f.endswith(".png"))[:6]
    decor_blocked["altar_generic"] = ["altars/" + f for f in alts]

categories = [
    ("floor", floors, "bg", True),
    ("liquid", liquids, "bg", False),
    ("wall", walls, "bg", False),
    ("door", doors, "fg", False),       # open/broken doors adjusted to walkable below
    ("gateway", gateways, "fg", True),
    ("tree", trees, "fg", False),
    ("decor", decor_blocked, "fg", False),
    ("decor_walk", decor_walkable, "fg", True),
]

tiles = []
group_index = {}
for cat, table, layer, walk in categories:
    group_index[cat] = {}
    for variant, files in table.items():
        if not files:
            print(f"warn: no files for {cat}/{variant}", file=sys.stderr)
            continue
        ids = []
        # floor/wall/liquid/tree variant names can collide across categories
        # (e.g. floor "stone" vs wall "stone"), so prefix those categories.
        base = f"{cat}_{variant}" if cat in ("floor", "wall", "liquid", "tree") else variant
        for n, rel in enumerate(files):
            name = base if len(files) == 1 else f"{base}_{n}"
            ids.append(len(tiles))
            tiles.append((name, os.path.join(RL, rel)))
        group_index[cat][variant] = ids

count = len(tiles)
rows = (count + COLS - 1) // COLS
atlas = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
names = {}
for i, (name, path) in enumerate(tiles):
    img = Image.open(path).convert("RGBA")
    if img.size != (TILE, TILE):
        base = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        src = img if img.width <= TILE and img.height <= TILE else img.crop((0, max(0, img.height - TILE), min(TILE, img.width), img.height))
        base.paste(src, (0, TILE - src.height))
        img = base
    atlas.paste(img, ((i % COLS) * TILE, (i // COLS) * TILE))
    names[name] = i

os.makedirs(os.path.join(OUT_REPO, "src/assets/tiles"), exist_ok=True)
atlas.save(os.path.join(OUT_REPO, "src/assets/tiles/dungeon.png"))

walkable_bg, blocked_bg, walkable_fg, blocked_fg = set(), set(), set(), set()
for cat, table, layer, walk in categories:
    for variant, ids in group_index[cat].items():
        w = walk
        if variant in ("door_open", "door_broken", "door_broken_crypt"): w = True
        for i in ids:
            (walkable_bg if (w and layer == "bg") else blocked_bg if layer == "bg" else walkable_fg if w else blocked_fg).add(i)

manifest = {
    "firstGid": FIRST_GID,
    "tileCount": count,
    "columns": COLS,
    "names": names,
    "groups": group_index,
    "blockedBg": sorted(blocked_bg),
    "walkableFg": sorted(walkable_fg),
}

js = (
    "// GENERATED by tools/build_dungeon_atlas.py - DCSS/RLTiles (public domain / CC0) dungeon tileset manifest.\n"
    "// Local ids are 0-based within dungeon.png; global gid = firstGid + localId.\n"
    f"const DUNGEON_TILESET = {json.dumps(manifest, indent=2)};\n\n"
    "export const DUNGEON_FIRST_GID = DUNGEON_TILESET.firstGid;\n"
    "export const dungeonGid = name => {\n"
    "  const local = DUNGEON_TILESET.names[name];\n"
    "  return typeof local === 'number' ? DUNGEON_TILESET.firstGid + local : 0;\n"
    "};\n"
    "export const dungeonGroupGids = (category, variant) => {\n"
    "  const group = DUNGEON_TILESET.groups[category];\n"
    "  const ids = group && group[variant] ? group[variant] : [];\n"
    "  return ids.map(id => DUNGEON_TILESET.firstGid + id);\n"
    "};\n\n"
    "export default DUNGEON_TILESET;\n"
)
with open(os.path.join(OUT_REPO, "server/shared/dungeon-tiles.js"), "w") as f:
    f.write(js)

tsx = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    f'<tileset name="Dungeon" tilewidth="32" tileheight="32" tilecount="{count}" columns="{COLS}">\n'
    f' <image source="../../../src/assets/tiles/dungeon.png" width="{COLS * TILE}" height="{rows * TILE}"/>\n'
    "</tileset>\n"
)
with open(os.path.join(OUT_REPO, "server/maps/layers/dungeon.tsx"), "w") as f:
    f.write(tsx)

print(f"atlas: {count} tiles, {COLS}x{rows} grid, gids {FIRST_GID}..{FIRST_GID + count - 1}")
