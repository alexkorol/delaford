#!/usr/bin/env python3
"""Convert a Codex-generated 4x4 chroma-key contact sheet into game frames."""

from __future__ import annotations

import argparse
from pathlib import Path
from statistics import median

from PIL import Image, ImageFilter


GRID_SIZE = 4
ALPHA_NOISE_FLOOR = 8
KEY_DOMINANCE_THRESHOLD = 16.0


def clamp_channel(value: float) -> int:
    return max(0, min(255, int(round(value))))


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - (2.0 * value))


def sample_border_key(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    pixels = image.load()
    band = max(1, min(width, height, 6))
    step = max(1, min(width, height) // 256)
    samples = []

    for x in range(0, width, step):
        for y in range(band):
            samples.append(pixels[x, y][:3])
            samples.append(pixels[x, height - 1 - y][:3])
    for y in range(0, height, step):
        for x in range(band):
            samples.append(pixels[x, y][:3])
            samples.append(pixels[width - 1 - x, y][:3])

    return tuple(
        int(round(median(sample[channel] for sample in samples)))
        for channel in range(3)
    )


def spill_channels(key: tuple[int, int, int]) -> list[int]:
    key_max = max(key)
    if key_max < 128:
        return []
    return [
        channel
        for channel, value in enumerate(key)
        if value >= key_max - 16 and value >= 128
    ]


def dominance_alpha(
    rgb: tuple[int, int, int],
    key: tuple[int, int, int],
) -> int:
    spill = spill_channels(key)
    if not spill:
        return 255
    non_spill = [channel for channel in range(3) if channel not in spill]
    key_strength = min(rgb[channel] for channel in spill)
    non_key_strength = max((rgb[channel] for channel in non_spill), default=0)
    dominance = key_strength - non_key_strength
    if dominance <= 0:
        return 255
    denominator = max(1.0, float(max(key)) - non_key_strength)
    return clamp_channel((1.0 - min(1.0, dominance / denominator)) * 255.0)


def is_key_coloured(
    rgb: tuple[int, int, int],
    key: tuple[int, int, int],
    distance: int,
) -> bool:
    if distance <= 32:
        return True
    spill = spill_channels(key)
    if not spill:
        return True
    non_spill = [channel for channel in range(3) if channel not in spill]
    key_strength = min(rgb[channel] for channel in spill)
    non_key_strength = max((rgb[channel] for channel in non_spill), default=0)
    return key_strength - non_key_strength >= KEY_DOMINANCE_THRESHOLD


def remove_chroma_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    key = sample_border_key(rgba)
    spill = spill_channels(key)
    non_spill = [channel for channel in range(3) if channel not in spill]

    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, input_alpha = pixels[x, y]
            rgb = (red, green, blue)
            distance = max(abs(rgb[channel] - key[channel]) for channel in range(3))
            key_like = is_key_coloured(rgb, key, distance)

            if key_like:
                if distance <= 12:
                    matte_alpha = 0
                elif distance >= 220:
                    matte_alpha = 255
                else:
                    ratio = (distance - 12.0) / (220.0 - 12.0)
                    matte_alpha = clamp_channel(255.0 * smoothstep(ratio))
                output_alpha = min(matte_alpha, dominance_alpha(rgb, key))
            else:
                output_alpha = 255

            output_alpha = int(round(output_alpha * (input_alpha / 255.0)))
            if 0 < output_alpha <= ALPHA_NOISE_FLOOR:
                output_alpha = 0
            if output_alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue

            channels = [red, green, blue]
            if key_like and output_alpha < 252 and non_spill:
                cap = max(0.0, max(channels[channel] for channel in non_spill) - 1.0)
                for channel in spill:
                    channels[channel] = min(channels[channel], cap)
            pixels[x, y] = (*map(clamp_channel, channels), output_alpha)

    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(radius=0.5))
    rgba.putalpha(alpha)
    return rgba


def pack_sheet(source: Image.Image, frame_size: int) -> Image.Image:
    sheet = Image.new(
        "RGBA",
        (GRID_SIZE * frame_size, GRID_SIZE * frame_size),
        (0, 0, 0, 0),
    )
    for row in range(GRID_SIZE):
        top = round(row * source.height / GRID_SIZE)
        bottom = round((row + 1) * source.height / GRID_SIZE)
        for column in range(GRID_SIZE):
            left = round(column * source.width / GRID_SIZE)
            right = round((column + 1) * source.width / GRID_SIZE)
            frame = source.crop((left, top, right, bottom))
            frame = frame.resize((frame_size, frame_size), Image.Resampling.LANCZOS)
            sheet.alpha_composite(frame, (column * frame_size, row * frame_size))
    return sheet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="4x4 magenta contact-sheet PNG")
    parser.add_argument("output", type=Path, help="output RGBA PNG")
    parser.add_argument("--frame-size", type=int, default=64)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.frame_size < 1:
        raise SystemExit("--frame-size must be positive")
    with Image.open(args.input) as image:
        source = remove_chroma_key(image)
    sheet = pack_sheet(source, args.frame_size)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)
    print(f"Wrote {args.output} ({sheet.width}x{sheet.height}, RGBA)")


if __name__ == "__main__":
    main()
