#!/usr/bin/env python3
"""Build the 13-icon native Vessel atlas from an ImageGen 4x4 source sheet."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


GRID_SIZE = 4
ITEM_COUNT = 13
MATTE_FLOOR = 4
MATTE_CEILING = 24
DEFAULT_ICON_SIZE = 28


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


def fit_icon(cell: Image.Image, frame_size: int, icon_size: int) -> Image.Image:
    keyed = remove_black_matte(cell)
    bounds = keyed.getbbox()
    frame = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    if not bounds:
        return frame

    icon = keyed.crop(bounds)
    icon.thumbnail((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = ((frame_size - icon.width) // 2, (frame_size - icon.height) // 2)
    frame.alpha_composite(icon, offset)
    return frame


def pack_sheet(source: Image.Image, frame_size: int, icon_size: int) -> Image.Image:
    sheet = Image.new("RGBA", (ITEM_COUNT * frame_size, frame_size), (0, 0, 0, 0))
    for index in range(ITEM_COUNT):
        row, column = divmod(index, GRID_SIZE)
        left = round(column * source.width / GRID_SIZE)
        top = round(row * source.height / GRID_SIZE)
        right = round((column + 1) * source.width / GRID_SIZE)
        bottom = round((row + 1) * source.height / GRID_SIZE)
        frame = fit_icon(source.crop((left, top, right, bottom)), frame_size, icon_size)
        sheet.alpha_composite(frame, (index * frame_size, 0))
    return sheet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="ImageGen 4x4 source-sheet PNG")
    parser.add_argument("output", type=Path, help="output 13x1 RGBA atlas")
    parser.add_argument("--frame-size", type=int, default=32)
    parser.add_argument("--icon-size", type=int, default=DEFAULT_ICON_SIZE)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.frame_size < 1 or args.icon_size < 1 or args.icon_size > args.frame_size:
        raise SystemExit("icon and frame sizes must be positive, with icon <= frame")
    with Image.open(args.input) as image:
        source = image.convert("RGBA")
    sheet = pack_sheet(source, args.frame_size, args.icon_size)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)
    print(f"Wrote {args.output} ({sheet.width}x{sheet.height}, RGBA)")


if __name__ == "__main__":
    main()
