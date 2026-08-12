from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "lensically-web" / "public" / "lensically-logo-white-with-black-bg.png"
OUT = ROOT / "lensically-worker" / "public" / "brand"
OUT.mkdir(parents=True, exist_ok=True)

RESAMPLE = Image.Resampling.LANCZOS
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)


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
    x = (canvas_size - mark.width) // 2
    y = (canvas_size - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas


def save_png(image: Image.Image, path: Path):
    image.save(path, format="PNG", optimize=True)


def load_font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


source = Image.open(SOURCE).convert("RGBA")
master = fit_mark(source, 1024, 0.88)
save_png(master, OUT / "lensically-mark-1024.png")

for size in (512, 192, 180, 32, 16):
    resized = master.resize((size, size), RESAMPLE)
    save_png(resized, OUT / f"lensically-mark-{size}.png")

master.convert("RGB").save(
    OUT / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)

card = Image.new("RGBA", (1200, 630), BLACK)
mark = master.resize((300, 300), RESAMPLE)
card.alpha_composite(mark, (92, 165))
draw = ImageDraw.Draw(card)
brand_font = load_font(82, bold=True)
product_font = load_font(38, bold=False)
draw.text((438, 212), "Lensically", font=brand_font, fill=WHITE)
draw.text((442, 326), "Operator for Threads", font=product_font, fill=WHITE)
save_png(card, OUT / "lensically-social-1200x630.png")

expected = {
    "lensically-mark-1024.png": (1024, 1024),
    "lensically-mark-512.png": (512, 512),
    "lensically-mark-192.png": (192, 192),
    "lensically-mark-180.png": (180, 180),
    "lensically-mark-32.png": (32, 32),
    "lensically-mark-16.png": (16, 16),
    "lensically-social-1200x630.png": (1200, 630),
}
for name, dimensions in expected.items():
    actual = Image.open(OUT / name).size
    if actual != dimensions:
        raise RuntimeError(f"invalid_brand_asset_dimensions:{name}:{actual}")

print("brand-assets=ok")
