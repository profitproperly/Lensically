from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "lensically-worker" / "public"
SOURCE = ROOT / "lensically-web" / "public" / "lensically-logo-white-with-black-bg.png"
OUT = PUBLIC / "brand"
VERSION = "20260811"
PREFIX = f"lensically-{VERSION}"
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
REMOTE_LOGO = "https://raw.githubusercontent.com/profitproperly/Lensically/main/lensically-web/public/lensically-logo-white-with-black-bg.png"


def font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def make_master():
    src = Image.open(SOURCE).convert("RGBA")
    base = Image.new("RGBA", src.size, BLACK)
    base.alpha_composite(src)
    gray = ImageOps.grayscale(base.convert("RGB"))
    mask = gray.point(lambda p: 255 if p >= 32 else 0)
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Lensically mark not detected in source logo")
    mark = base.crop(bbox)
    target_side = 1024
    target_mark = round(target_side * 0.76)
    scale = min(target_mark / mark.width, target_mark / mark.height)
    resized = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.Resampling.LANCZOS)
    master = Image.new("RGBA", (target_side, target_side), BLACK)
    master.alpha_composite(resized, ((target_side - resized.width)//2, (target_side - resized.height)//2))
    return master


def save_png(img, path, size):
    out = img.resize((size, size), Image.Resampling.LANCZOS)
    out.convert("RGBA").save(path, "PNG", optimize=True)


def build_assets():
    OUT.mkdir(parents=True, exist_ok=True)
    master = make_master()
    sizes = [1024, 512, 192, 180, 32, 16]
    for s in sizes:
        name = f"{PREFIX}-icon-{s}.png"
        save_png(master, OUT / name, s)
    save_png(master, OUT / f"{PREFIX}-apple-touch-icon.png", 180)
    master.convert("RGBA").save(OUT / f"{PREFIX}-favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48)])

    card = Image.new("RGBA", (1200, 630), BLACK)
    icon = master.resize((220, 220), Image.Resampling.LANCZOS)
    card.alpha_composite(icon, (64, 205))
    draw = ImageDraw.Draw(card)
    title_font = font(54, bold=True)
    sub_font = font(30, bold=False)
    domain_font = font(24, bold=False)
    x = 330
    draw.text((x, 205), "Lensically Operator", font=title_font, fill=WHITE)
    draw.text((x, 270), "for Threads", font=title_font, fill=WHITE)
    draw.text((x, 355), "The system that puts your Threads on autopilot.", font=sub_font, fill=WHITE)
    draw.text((x, 420), "lensically.com", font=domain_font, fill=(190,190,190,255))
    card.convert("RGB").save(OUT / f"{PREFIX}-social-card.png", "PNG", optimize=True)

    manifest = {
        "name": "Lensically Operator for Threads",
        "short_name": "Lensically",
        "description": "Lensically Operator for Threads",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#ffffff",
        "icons": [
            {"src": f"/brand/{PREFIX}-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": f"/brand/{PREFIX}-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"}
        ]
    }
    (PUBLIC / "site.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (PUBLIC / "favicon.ico").write_bytes((OUT / f"{PREFIX}-favicon.ico").read_bytes())


def favicon_block():
    return f'''  <link rel="icon" type="image/png" sizes="32x32" href="/brand/{PREFIX}-icon-32.png">\n  <link rel="icon" type="image/png" sizes="16x16" href="/brand/{PREFIX}-icon-16.png">\n  <link rel="shortcut icon" href="/favicon.ico">\n  <link rel="apple-touch-icon" sizes="180x180" href="/brand/{PREFIX}-apple-touch-icon.png">\n  <link rel="manifest" href="/site.webmanifest">\n'''


def wire_html():
    block = favicon_block()
    html_files = sorted(PUBLIC.rglob("*.html"))
    for path in html_files:
        text = path.read_text(encoding="utf-8")
        if f"{PREFIX}-icon-32.png" not in text and "</head>" in text:
            text = text.replace("</head>", block + "</head>", 1)
        text = text.replace(REMOTE_LOGO, f"/brand/{PREFIX}-icon-192.png")
        path.write_text(text, encoding="utf-8")

    root = PUBLIC / "index.html"
    text = root.read_text(encoding="utf-8")
    if 'property="og:image"' not in text:
        marker = '  <meta property="og:url" content="https://lensically.com/">\n'
        addition = marker + f'  <meta property="og:image" content="https://lensically.com/brand/{PREFIX}-social-card.png">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:type" content="image/png">\n  <meta property="og:image:alt" content="Lensically Operator for Threads">\n'
        if marker not in text:
            raise RuntimeError("Root og:url marker changed; refusing silent metadata drift")
        text = text.replace(marker, addition, 1)
    if 'name="twitter:image"' not in text:
        marker = '  <meta name="twitter:card" content="summary_large_image">\n'
        if marker not in text:
            raise RuntimeError("Root twitter card marker changed; refusing silent metadata drift")
        text = text.replace(marker, marker + f'  <meta name="twitter:image" content="https://lensically.com/brand/{PREFIX}-social-card.png">\n  <meta name="twitter:image:alt" content="Lensically Operator for Threads">\n', 1)
    text = text.replace('.seller-logo { width:28px; height:28px; display:block; object-fit:contain; }', '.seller-logo { width:28px; height:28px; display:block; object-fit:contain; border-radius:7px; }')
    root.write_text(text, encoding="utf-8")

    operator = PUBLIC / "operator" / "index.html"
    if operator.exists():
        text = operator.read_text(encoding="utf-8")
        text = text.replace('.brand-mark { width:32px; height:32px; display:block; object-fit:contain; }', '.brand-mark { width:32px; height:32px; display:block; object-fit:contain; border-radius:8px; }')
        text = text.replace('.seller-logo { width:28px; height:28px; display:block; object-fit:contain; }', '.seller-logo { width:28px; height:28px; display:block; object-fit:contain; border-radius:7px; }')
        operator.write_text(text, encoding="utf-8")


def validate():
    expected = [
        OUT / f"{PREFIX}-icon-1024.png", OUT / f"{PREFIX}-icon-512.png", OUT / f"{PREFIX}-icon-192.png",
        OUT / f"{PREFIX}-apple-touch-icon.png", OUT / f"{PREFIX}-icon-32.png", OUT / f"{PREFIX}-icon-16.png",
        OUT / f"{PREFIX}-social-card.png", PUBLIC / "favicon.ico", PUBLIC / "site.webmanifest"
    ]
    for p in expected:
        if not p.exists() or p.stat().st_size == 0:
            raise RuntimeError(f"Missing generated brand asset: {p}")
    dims = {
        f"{PREFIX}-icon-1024.png": (1024,1024),
        f"{PREFIX}-icon-512.png": (512,512),
        f"{PREFIX}-icon-192.png": (192,192),
        f"{PREFIX}-apple-touch-icon.png": (180,180),
        f"{PREFIX}-icon-32.png": (32,32),
        f"{PREFIX}-icon-16.png": (16,16),
        f"{PREFIX}-social-card.png": (1200,630),
    }
    for name, dim in dims.items():
        if Image.open(OUT / name).size != dim:
            raise RuntimeError(f"Wrong dimensions for {name}")
    root = (PUBLIC / "index.html").read_text(encoding="utf-8")
    required = ["og:image", "og:image:width", "og:image:height", "twitter:image", "apple-touch-icon", "site.webmanifest", f"/brand/{PREFIX}-icon-192.png"]
    for token in required:
        if token not in root:
            raise RuntimeError(f"Root brand metadata missing: {token}")
    if REMOTE_LOGO in root or REMOTE_LOGO in (PUBLIC / "operator" / "index.html").read_text(encoding="utf-8"):
        raise RuntimeError("Remote GitHub logo reference remains on a public sales page")
    for html in PUBLIC.rglob("*.html"):
        text = html.read_text(encoding="utf-8")
        if "</head>" in text and "apple-touch-icon" not in text:
            raise RuntimeError(f"Brand head links missing from {html.relative_to(PUBLIC)}")


if __name__ == "__main__":
    build_assets()
    wire_html()
    validate()
    print(f"Lensically brand assets generated and validated: {PREFIX}")
