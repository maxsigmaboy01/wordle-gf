#!/usr/bin/env python3
"""Regenerate every Daily Puzzle app icon (procedural, from existing mascot art only).

Usage: python3 scripts/make_app_icons.py
Themed icons christmas/halloween/spring/space/summer/valentine/rainy are built from the dino art in
design/icon-sources/<id>_1024.png (inner frame cropped, then rounded); classic stays procedural.
Writes:
  src-tauri/icons/icon.png, icon.icns            (Dino Classic, bundle/Finder icon)
  src-tauri/icons/app-icons/classic/             1024 512 256 128 64 + favicon-32
  frontend/assets/app-icons/<id>.png, <id>-128.png   for classic + the 8 themed ids (incl. stealth, label "Stealth Puzzle")
Backgrounds are drawn on a 103x103 pixel grid (cell = 8px of the 824px body) and scaled with
NEAREST; mascot art is scaled with NEAREST at integer factors. Needs Pillow + sips/iconutil.
"""
import math, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"
ASSETS = ROOT / "frontend" / "assets"
OUT = ASSETS / "app-icons"
CANVAS, BODY, RADIUS, SS = 1024, 824, 185, 4
CELL = 8
G = BODY // CELL  # 103 grid cells


# ---------- rounding (same look as before) ----------
def squircle_mask(size, radius, n=5.0):
    s = size * SS
    r = radius * SS * 1.1
    m = Image.new("L", (s, s), 0)
    pts = []
    corners = [(s - r, r, -90), (s - r, s - r, 0), (r, s - r, 90), (r, r, 180)]
    for cx, cy, start in corners:
        for i in range(91):
            a = math.radians(start + 90 * i / 90)
            c, sn = math.cos(a), math.sin(a)
            pts.append((cx + r * math.copysign(abs(c) ** (2 / n), c),
                        cy + r * math.copysign(abs(sn) ** (2 / n), sn)))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def round_icon(art):
    art = art.convert("RGBA")
    mask = squircle_mask(BODY, RADIUS)
    off = (CANVAS - BODY) // 2
    shape = Image.new("L", (CANVAS, CANVAS), 0)
    shape.paste(mask, (off, off))
    sh = shape.filter(ImageFilter.GaussianBlur(14))
    sh = ImageChops.offset(sh, 0, 10).point(lambda v: int(v * 0.5))
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 255)), (0, 0), sh)
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    layer.paste(art, (off, off))
    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), shape))
    return Image.alpha_composite(out, layer)


# ---------- pixel helpers (grid coordinates) ----------
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def new_grid():
    return Image.new("RGBA", (G, G), (0, 0, 0, 255))


def bands(d, top, bot, c1, c2, step=4):
    """Vertical gradient quantised into hard bands (pixel look)."""
    c1, c2 = hexc(c1), hexc(c2)
    n = max(1, (bot - top) // step)
    for i in range(n + 1):
        t = i / n
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(4))
        d.rectangle([0, top + i * step, G, top + i * step + step - 1], fill=col)


def pat(d, x, y, rows, pal):
    """Draw a character-pattern sprite; '.' is transparent."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != ".":
                d.point((x + i, y + j), fill=hexc(pal[ch]))


CLOUD = [
    "....#####.......",
    "..##ooooo##.....",
    ".#ooooooooo###..",
    "#ooooooooooooo#.",
    "#oooooooooooooo#",
    ".################",
]
CLOUD = [r.ljust(17, ".") for r in CLOUD]


def cloud(d, x, y, fill="#ffffff", line="#bcd3df"):
    pat(d, x, y, CLOUD, {"#": line, "o": fill})


def hill(d, top, base, amp, phase, c_top, c_mid, c_bot, period=60):
    """Rolling hill: surface y = top + wave; filled with banded greens."""
    cols = [hexc(c_top), hexc(c_mid), hexc(c_bot)]
    for x in range(G):
        y0 = int(top + amp * math.sin((x + phase) * 2 * math.pi / period))
        for y in range(y0, G):
            depth = y - y0
            col = cols[0] if depth < 2 else cols[1] if y < base else cols[2]
            d.point((x, y), fill=col)
    return lambda x: int(top + amp * math.sin((x + phase) * 2 * math.pi / period))


TUFT = ["#..#.#", "#.##.#", "######", ".####."]
TUFT_LT = ["o..o.o", "o.oo.o", "oooooo", ".oooo."]


def tufts(d, surf, xs, dy, dark="#3f7d2a", mid="#5da23a"):
    for x in xs:
        y = surf(x + 3) + dy
        pat(d, x, y, [r.replace("#", "d") for r in TUFT], {"d": dark})
        d.point((x + 2, y + 1), fill=hexc(mid))
        d.point((x + 3, y + 2), fill=hexc(mid))


def sparkle(d, x, y, c="#ffffff", r=2):
    col = hexc(c)
    d.point((x, y), fill=col)
    for k in range(1, r + 1):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            d.point((x + dx, y + dy), fill=col)


def dot(d, x, y, c, s=1):
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=hexc(c))


def disc(d, cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                d.point((x, y), fill=hexc(c))


def mascot(path, scale, crop=None):
    im = Image.open(path).convert("RGBA")
    if crop:
        im = im.crop(crop)
    else:
        im = im.crop(im.getchannel("A").getbbox())
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST)


def finish(grid, sprite, cx_off=0, bottom=None, top=None, extras=None):
    art = grid.resize((BODY, BODY), Image.NEAREST)
    x = (BODY - sprite.width) // 2 + cx_off
    y = (bottom - sprite.height) if bottom is not None else top
    art.alpha_composite(sprite, (x, y))
    if extras:
        extras(art)
    return art


def dino_sprite():
    """Classic dino from seasons/01 (below the heart bubble), 3x NEAREST."""
    return mascot(ASSETS / "seasons/01_classic_dino_idle.png", 3, crop=(110, 245, 345, 450))


# ---------- icons ----------
def classic_bg(d, sun=False):
    bands(d, 0, 78, "#fdf6dc" if not sun else "#8fd3f4", "#f3f0d0" if not sun else "#d4f0fb", 6)
    return None


def icon_classic():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 80, "#fff8e0", "#f2efcf", 5)
    cloud(d, 10, 12); cloud(d, 72, 8, "#f6fbff")
    surf = hill(d, 72, 90, 3, 10, "#8fcf55", "#78b845", "#5f9e36", 120)
    tufts(d, surf, [3, 92, 80], 1)
    # bottom edge darker tufts
    tufts(d, surf, [10, 34, 62, 88], 14, "#4a8a2e")
    for x in range(0, G, 3):
        d.point((x, 100 + (x // 3) % 3), fill=hexc("#6fb23e"))
    spr = dino_sprite()

    def lines(art):
        a = ImageDraw.Draw(art)
        black = (24, 24, 24, 255)
        # three stepped pixel strokes fanning out from the dino's snout
        for sx, sy, dy in ((720, 250, -1), (736, 322, 0), (720, 394, 1)):
            for i in range(4):
                x, y = sx + i * CELL * 2, sy + dy * i * CELL
                a.rectangle([x, y, x + CELL * 2 - 1, y + CELL - 1], fill=black)
    return finish(g, spr, cx_off=-44, bottom=744), lines


def icon_christmas():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 100, "#3f7fd0", "#a9d8f5", 5)
    for (x, y, r) in [(10, 12, 1), (30, 26, 1), (85, 14, 2), (70, 36, 1), (14, 50, 1), (92, 54, 1), (50, 8, 1), (22, 70, 1), (88, 78, 1)]:
        sparkle(d, x, y, "#ffffff", r)
    for (x, y) in [(40, 18), (60, 30), (6, 34), (96, 38), (78, 60), (30, 44), (52, 56)]:
        dot(d, x, y, "#ffffff")
    surf = hill(d, 88, 96, 3, 5, "#ffffff", "#e8f2fb", "#cfe3f4", 90)
    for x in range(0, G, 4):
        d.point((x, surf(x) + 4), fill=hexc("#bcd6ee"))
    spr = mascot(ASSETS / "seasons/02_christmas_santa_wave.png", 2)
    return finish(g, spr, bottom=770), None


def icon_halloween():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 90, "#3a1d6e", "#f08a4b", 4)
    # moon crescent
    for y in range(8, 34):
        for x in range(66, 96):
            if (x - 80) ** 2 + (y - 20) ** 2 <= 110 and (x - 86) ** 2 + (y - 16) ** 2 > 90:
                d.point((x, y), fill=hexc("#ffe27a"))
    bat = ["#.....#", "##...##", "#######", ".#.#.#.", "..#.#.."]
    big = [("".join(c * 2 for c in r)) for r in bat for _ in (0, 1)]
    for (x, y) in [(12, 12), (46, 32), (28, 48)]:
        pat(d, x, y, [r.replace("#", "b") for r in big], {"b": "#12081f"})
    for (x, y) in [(10, 30), (60, 12), (92, 40), (40, 18)]:
        sparkle(d, x, y, "#ffe9a8", 1)
    surf = hill(d, 86, 94, 3, 20, "#2d1650", "#22103f", "#180b2e", 100)
    for x in (8, 94):
        pat(d, x, surf(x) - 8, ["#..#", "#..#", "####", ".##.", ".##."], {"#": "#150a28"})
    spr = mascot(ASSETS / "seasons/04_halloween_pumpkin_ghost.png", 2)
    return finish(g, spr, bottom=760), None


def icon_spring():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 84, "#ffc4d9", "#ffe9ef", 5)
    cloud(d, 6, 10, "#ffffff", "#f4b8cc")
    # blossom branch top-right
    for x in range(60, 103):
        d.point((x, 6 + (x - 60) // 6), fill=hexc("#7a4a3a"))
    for (x, y) in [(70, 4), (80, 6), (90, 5), (96, 10), (86, 12), (74, 10), (98, 2)]:
        disc(d, x, y, 2, "#ff9fc2"); dot(d, x, y, "#fff0f5")
    for (x, y) in [(20, 30), (44, 22), (60, 40), (12, 52), (88, 46), (34, 60), (72, 62), (52, 14), (94, 66)]:
        dot(d, x, y, "#ff8fb8", 2); dot(d, x, y, "#ffd6e5")
    surf = hill(d, 76, 90, 3, 15, "#9fdc62", "#82c94e", "#68ad3c", 110)
    tufts(d, surf, [6, 86, 46], 1)
    for (x, y) in [(18, 84), (40, 90), (66, 86), (92, 92), (10, 96), (76, 97), (52, 95)]:
        dot(d, x, y, "#ffffff", 2); dot(d, x, y, "#ff9fc2")
    spr = mascot(ASSETS / "seasons/03_spring_blossom_bunny.png", 2)
    return finish(g, spr, bottom=760), None


def icon_space():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 100, "#141a4d", "#35308a", 6)
    for (x, y, r) in [(14, 14, 3), (50, 10, 2), (30, 36, 2), (92, 40, 2), (10, 58, 1), (60, 30, 1)]:
        sparkle(d, x, y, "#ffd86b", r)
    for (x, y) in [(6, 28), (42, 22), (70, 8), (96, 24), (84, 62), (22, 48), (58, 48)]:
        dot(d, x, y, "#ffffff")
    # ringed planet
    disc(d, 78, 18, 8, "#ff8fc0"); disc(d, 75, 15, 3, "#ffb5d6")
    for x in range(64, 94):
        d.point((x, 18 + (x - 64) // 6 - 2 if x < 79 else 18 + 4 - (x - 79) // 6 - 2 + 2), fill=hexc("#ffe8f2"))
    surf = hill(d, 84, 92, 3, 0, "#b9a8f0", "#8f7ed8", "#6a5ab8", 80)
    for (x, y) in [(10, 92), (60, 96), (86, 90), (34, 98)]:
        disc(d, x, y, 3, "#5a4aa8")
    spr = mascot(ASSETS / "seasons/05_space_dino_astronaut.png", 2)
    return finish(g, spr, bottom=752), None


def icon_summer():
    g = new_grid(); d = ImageDraw.Draw(g)
    bands(d, 0, 80, "#4cb8f0", "#bfeaff", 5)
    # sun with rays
    disc(d, 82, 18, 8, "#ffd23a"); disc(d, 82, 18, 5, "#ffe770")
    for a in range(0, 360, 45):
        for r in (11, 12, 13):
            dot(d, int(82 + r * math.cos(math.radians(a))), int(18 + r * math.sin(math.radians(a))), "#ffc21a")
    cloud(d, 8, 14); cloud(d, 34, 36, "#f6fbff")
    surf = hill(d, 66, 90, 3, 0, "#8fd24f", "#74bf3f", "#5ea834", 110)
    tufts(d, surf, [6, 90, 28], 2)
    # red-checked picnic cloth strip along the bottom
    for y in range(84, G):
        for x in range(G):
            d.point((x, y), fill=hexc("#e03a3a" if ((x // 4) + (y // 4)) % 2 == 0 else "#ffffff"))
    for x in range(G):
        d.point((x, 83), fill=hexc("#b02a2a"))
    spr = dino_sprite()
    return finish(g, spr, cx_off=-8, bottom=730), None


SRC = ROOT / "design" / "icon-sources"
SRC_IDS = ["christmas", "halloween", "spring", "space", "summer", "valentine", "rainy", "stealth"]
FRAME_CROP = (56, 56, 972, 972)  # drops the 1024 art's inset rounded frame stroke


CROPS = {"stealth": (110, 110, 920, 920)}  # drop the frame stroke so the 2x2 tiles fill the squircle


def icon_from_source(name):
    def fn():
        im = Image.open(SRC / f"{name}_1024.png").convert("RGBA").crop(CROPS.get(name, FRAME_CROP))
        return im.resize((BODY, BODY), Image.LANCZOS), None
    return fn


# classic: our procedural icon; the rest come from the reference art. (Old procedural
# icon_christmas/... functions above are kept only as unused legacy.)
ICONS_MAP = {"classic": icon_classic}
ICONS_MAP.update({n: icon_from_source(n) for n in SRC_IDS})


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (ICONS / "app-icons" / "classic").mkdir(parents=True, exist_ok=True)
    rounded = {}
    for name, fn in ICONS_MAP.items():
        art, extra = fn()
        if extra:
            extra(art)
        icon = round_icon(art)
        rounded[name] = icon
        icon.save(OUT / f"{name}.png")
        icon.resize((128, 128), Image.LANCZOS).save(OUT / f"{name}-128.png")

    base = rounded["classic"]
    base.save(ICONS / "icon.png")
    cdir = ICONS / "app-icons" / "classic"
    for s in (1024, 512, 256, 128, 64):
        base.resize((s, s), Image.LANCZOS).save(cdir / f"icon-{s}.png")
    base.resize((32, 32), Image.LANCZOS).save(cdir / "favicon-32.png")

    with tempfile.TemporaryDirectory() as t:
        iconset = Path(t) / "icon.iconset"
        iconset.mkdir()
        for b in (16, 32, 128, 256, 512):
            for sc in (1, 2):
                px = b * sc
                nm = f"icon_{b}x{b}{'@2x' if sc == 2 else ''}.png"
                base.resize((px, px), Image.LANCZOS).save(iconset / nm)
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon.icns")], check=True)
    print("wrote app icons:", ", ".join(ICONS_MAP))


if __name__ == "__main__":
    main()
