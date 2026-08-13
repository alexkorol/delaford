# Player art pipeline

The production player sheet is `human-v2.png`: four 64 px columns by four
64 px rows. It is generated from the checked-in chroma-key master rather than
edited by hand, so frame boundaries and alpha cleanup stay reproducible.

```bash
python3 tools/build_player_sheet.py \
  src/assets/graphics/actors/players/source/human-v2-magenta.png \
  src/assets/graphics/actors/players/human-v2.png
```

The tool requires Pillow. It samples the generated image border, removes the
magenta background with a soft matte and despill pass, divides non-multiple-of-
four source dimensions by proportional boundaries, then downsamples each cell
to 64 px with Lanczos resampling.

## Sheet contract

Rows, top to bottom:

1. Down / toward camera
2. Left profile
3. Right profile
4. Up / away from camera

Columns, left to right:

1. Combat-ready idle
2. First stride/contact pose
3. Opposing stride/passing pose
4. Sword attack

Every pose stays inside its cell and shares a bottom-center foot anchor. The
runtime renders these 64 px source frames at a 32 px legacy footprint and a
matching perspective billboard footprint.

## Generation provenance

The master was generated with Codex's built-in GPT Image 2 workflow, using the
original `human.png` sprite as the image reference. The generation prompt was:

> Create a production-ready pixel-art character animation contact sheet based
> on the attached existing Verdigris game hero. Preserve the recognizable
> compact adventurer with a deep green hood, verdigris armor accents, warm
> leather, muted steel, a short sword in the right hand, and a round shield in
> the left. Improve anatomy, silhouette, lighting, and material readability for
> a dark medieval-fantasy top-down action RPG. Make exactly one square 4-by-4
> contact sheet with no borders, guides, labels, or text. Rows are down, left,
> right, and up; columns are idle, two opposing stride poses, and a compact
> sword attack. Keep identity, scale, equipment, lighting, and bottom-center
> foot anchors consistent. Use crisp hand-authored pixel art intended for
> 64-by-64 frames, strong selective outlines, controlled clusters, a limited
> palette, three-quarter top-down perspective, soft upper-left light, and
> subtle cool verdigris rim accents. Keep every pose inside its cell. Fill the
> background with flat chroma-key magenta and use no magenta in the character;
> include no shadow, ground plane, particles, glow, extra characters, logos,
> or UI.

The first accepted generation is retained as
`src/assets/graphics/actors/players/source/human-v2-magenta.png`. Keep future
masters versioned instead of overwriting it.
