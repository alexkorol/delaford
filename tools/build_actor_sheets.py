#!/usr/bin/env python3
"""Build the live 64px monster and NPC atlases from three ImageGen sheets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


GRID_SIZE = 4
FRAME_SIZE = 64
MONSTER_FRAME_COUNT = 43
NPC_FRAME_COUNT = 4
MATTE_FLOOR = 4
MATTE_CEILING = 24
ACTOR_SAFE_SIZE = 60


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - (2.0 * value))


def remove_black_matte(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, input_alpha = pixels[x, y]
            brightness = max(red, green, blue)
            if brightness <= MATTE_FLOOR:
                matte_alpha = 0
            elif brightness >= MATTE_CEILING:
                matte_alpha = 255
            else:
                ratio = (brightness - MATTE_FLOOR) / (MATTE_CEILING - MATTE_FLOOR)
                matte_alpha = round(255 * smoothstep(ratio))

            output_alpha = round(matte_alpha * (input_alpha / 255))
            pixels[x, y] = (red, green, blue, output_alpha) if output_alpha else (0, 0, 0, 0)

    return rgba


def source_cell(source: Image.Image, index: int) -> Image.Image:
    row, column = divmod(index, GRID_SIZE)
    left = round(column * source.width / GRID_SIZE)
    top = round(row * source.height / GRID_SIZE)
    right = round((column + 1) * source.width / GRID_SIZE)
    bottom = round((row + 1) * source.height / GRID_SIZE)
    return source.crop((left, top, right, bottom))


def fit_actor(cell: Image.Image) -> Image.Image:
    keyed = remove_black_matte(cell)
    bounds = keyed.getbbox()
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    if not bounds:
        return frame

    actor = keyed.crop(bounds)
    actor.thumbnail((ACTOR_SAFE_SIZE, ACTOR_SAFE_SIZE), Image.Resampling.LANCZOS)
    # Align feet rather than centering vertically so every identity stands on
    # the same world-space baseline when the atlas is rendered.
    offset = ((FRAME_SIZE - actor.width) // 2, FRAME_SIZE - actor.height - 2)
    frame.alpha_composite(actor, offset)
    return frame


def pack(frames: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (len(frames) * FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
    return sheet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("surface", type=Path, help="surface-cast 4x4 source sheet")
    parser.add_argument("depths", type=Path, help="stone-to-volcanic 4x4 source sheet")
    parser.add_argument("wilds", type=Path, help="marsh-to-wilds plus NPC 4x4 source sheet")
    parser.add_argument("monsters", type=Path, help="output 43x1 monster atlas")
    parser.add_argument("npcs", type=Path, help="output 4x1 NPC atlas")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with Image.open(args.surface) as image:
        surface = image.convert("RGBA")
    with Image.open(args.depths) as image:
        depths = image.convert("RGBA")
    with Image.open(args.wilds) as image:
        wilds = image.convert("RGBA")

    monster_frames = [fit_actor(source_cell(surface, index)) for index in range(15)]
    monster_frames.extend(fit_actor(source_cell(depths, index)) for index in range(16))
    monster_frames.extend(fit_actor(source_cell(wilds, index)) for index in range(12))
    npc_frames = [fit_actor(source_cell(wilds, index)) for index in range(12, 16)]

    if len(monster_frames) != MONSTER_FRAME_COUNT or len(npc_frames) != NPC_FRAME_COUNT:
        raise SystemExit("actor source contract produced the wrong frame count")

    args.monsters.parent.mkdir(parents=True, exist_ok=True)
    args.npcs.parent.mkdir(parents=True, exist_ok=True)
    monster_sheet = pack(monster_frames)
    npc_sheet = pack(npc_frames)
    monster_sheet.save(args.monsters, optimize=True)
    npc_sheet.save(args.npcs, optimize=True)
    print(f"Wrote {args.monsters} ({monster_sheet.width}x{monster_sheet.height}, RGBA)")
    print(f"Wrote {args.npcs} ({npc_sheet.width}x{npc_sheet.height}, RGBA)")


if __name__ == "__main__":
    main()
