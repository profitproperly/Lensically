from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "lensically-web" / "public" / "lensically-logo-white-with-black-bg.png"
PUBLIC = ROOT / "lensically-worker" / "public"
OUT = PUBLIC / "brand"
OUT.mkdir(parents=True, exist_ok=True)

RESAMPLE = Image.Resampling.LANCZOS
BLACK = (0, 0, 0, 255)


def non_background_bbox(image: Image.Image):
    rgba = image.convert("RGBA")
    px = rgba.load()
    mask = Image.new("L", rgba.size, 0)
    mp = mask.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a > 8 and max(r, g, b) > 24:
                mp[x, y] = 255
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("brand_artwork_not_detected")
    return bbox


def fit_mark(source: Image.Image, canvas_size: int, fill_ratio: float) -> Image.Image:
    bbox = non_background_bbox(source)
    cropped = source.convert("RGBA").crop(bbox)
    target = int(round(canvas_size * fill_ratio))
    scale = min(target / cropped.width, target / cropped.height)
    new_size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    mark = cropped.resize(new_size, RESAMPLE)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), BLACK)
    canvas.alpha_composite(mark, ((canvas_size - mark.width) // 2, (canvas_size - mark.height) // 2))
    return canvas


def rounded_tile(flat: Image.Image, radius_ratio: float = 0.20) -> Image.Image:
    if flat.width != flat.height:
        raise RuntimeError("rounded_tile_requires_square")
    mask = Image.new("L", flat.size, 0)
    draw = ImageDraw.Draw(mask)
    radius = max(1, round(flat.width * radius_ratio))
    draw.rounded_rectangle((0, 0, flat.width - 1, flat.height - 1), radius=radius, fill=255)
    rounded = Image.new("RGBA", flat.size, (0, 0, 0, 0))
    rounded.paste(flat, (0, 0), mask)
    return rounded


def save_png(image: Image.Image, path: Path):
    image.save(path, format="PNG", optimize=True)


source = Image.open(SOURCE).convert("RGBA")
flat_master = fit_mark(source, 1024, 0.88)
save_png(flat_master, OUT / "lensically-flat-1024.png")

for size in (512, 192, 180):
    save_png(flat_master.resize((size, size), RESAMPLE), OUT / f"lensically-flat-{size}.png")

rounded_master = rounded_tile(flat_master)
for size in (32, 16):
    save_png(rounded_master.resize((size, size), RESAMPLE), OUT / f"lensically-tab-rounded-{size}.png")

flat_master.convert("RGB").save(
    PUBLIC / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)

expected = {
    "lensically-flat-1024.png": (1024, 1024),
    "lensically-flat-512.png": (512, 512),
    "lensically-flat-192.png": (192, 192),
    "lensically-flat-180.png": (180, 180),
    "lensically-tab-rounded-32.png": (32, 32),
    "lensically-tab-rounded-16.png": (16, 16),
}
for name, dimensions in expected.items():
    image = Image.open(OUT / name).convert("RGBA")
    if image.size != dimensions:
        raise RuntimeError(f"invalid_brand_asset_dimensions:{name}:{image.size}")

if Image.open(OUT / "lensically-flat-512.png").convert("RGBA").getpixel((0, 0))[3] != 255:
    raise RuntimeError("flat_asset_must_be_full_bleed")
rounded_corner_alpha = Image.open(OUT / "lensically-tab-rounded-32.png").convert("RGBA").getpixel((0, 0))[3]
if rounded_corner_alpha > 8:
    raise RuntimeError(f"rounded_tab_asset_corner_not_transparent:{rounded_corner_alpha}")


print("brand-assets=ok")

