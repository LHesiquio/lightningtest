"""Generates monochrome Material-style icons from a single polygon glyph."""

from PIL import Image, ImageDraw

# Material "bolt" outline, in a 24x24 box.
GLYPH = [
    (13.5, 1.5),
    (3.5, 14.5),
    (9.7, 14.5),
    (8.5, 22.5),
    (20.5, 9.0),
    (13.9, 9.0),
]

COLOR = (108, 92, 231, 255)  # #6c5ce7
SIZES = {"32x32": 32, "64x64": 64, "128x128": 128, "128x128@2x": 256,
         "256x256": 256, "512x512": 512, "icon": 512}
SS = 8  # supersampling factor for smooth edges


def render(size: int) -> Image.Image:
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Keep the glyph inside Material's 24dp safe zone (4dp padding).
    pad = big * 0.14
    scale = (big - 2 * pad) / 24.0
    pts = [(pad + x * scale, pad + y * scale) for x, y in GLYPH]
    draw.polygon(pts, fill=COLOR)

    return img.resize((size, size), Image.LANCZOS)


for name, size in SIZES.items():
    path = f"src-tauri/icons/{name}.png"
    render(size).save(path)
    print(f"{path} {size}x{size}")
