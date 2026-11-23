#!/usr/bin/env python3
"""Rebuild the imported sprite assets from design/sprite-sources/.

Run:  python3 -I scripts/import_sprites.py
Requires Pillow + numpy. Writes only new files under frontend/assets/
{mascots,backgrounds,achievements,effects,companions}.

Alignment: the dino body is measured as the bbox of "dino green" pixels on
frame 1. Every sprite is scaled (NEAREST) so that bbox height matches the
classic idle (171 px, 198 px wide) and translated so the body bbox bottom
(foot line) is at y=434 and its horizontal centre at x=229 on a 512 canvas.
"""
import io, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'sprite-sources')
OUT = os.path.join(ROOT, 'frontend', 'assets')
CANVAS = 512
REF_H = 171          # body height of classic idle
FOOT_Y = 434         # body bbox bottom of classic idle
CENTER_X = 229       # body bbox centre x of classic idle (130..328)
LIMIT = 120 * 1024
LADDER = (255, 192, 128, 96, 64, 48, 32)

COSTUMES = {'christmas': 1, 'halloween': 2, 'spring': 3, 'summer': 4,
            'valentine': 5, 'rainy': 6}
ACTIONS = {'blink': 7, 'wave': 8, 'tail_wag': 9, 'bounce': 10}
ACHIEVEMENTS = {'first_steps': 'first-steps', 'sharp_eye': 'sharp-eye',
                'hat_trick': 'hat-trick', 'week_warrior': 'week-warrior',
                'puzzle_pro': 'puzzle-pro', 'treasure_hunter': 'treasure-hunter',
                'fashionista': 'fashionista', 'got_baited': 'got-baited'}
BGS = ['classic', 'christmas', 'halloween', 'spring', 'space', 'summer',
       'valentine', 'rainy']


def load(path):
    im = Image.open(path)
    frames, durs = [], []
    for i in range(im.n_frames):
        im.seek(i)
        frames.append(im.convert('RGBA'))
        durs.append(im.info.get('duration', 170))
    return frames, durs


def body_bbox(fr):
    a = np.asarray(fr).astype(int)
    m = (a[..., 3] > 0) & (a[..., 1] > a[..., 0] + 15) & (a[..., 1] > a[..., 2] + 40)
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def place(frames, scale):
    """Scale (NEAREST) and align to the shared foot line / centre."""
    x0, y0, x1, y1 = body_bbox(frames[0])
    out = []
    if scale is None:
        scale = round(REF_H / (y1 - y0) / 0.025) * 0.025
    for f in frames:
        w, h = round(f.width * scale), round(f.height * scale)
        s = f.resize((w, h), Image.NEAREST) if scale != 1 else f
        dx = round(CENTER_X - (x0 + x1) / 2 * scale)
        dy = round(FOOT_Y - y1 * scale)
        c = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        c.alpha_composite(s, (dx, dy)) if dx >= 0 and dy >= 0 else c.paste(s, (dx, dy))
        out.append(c)
    return out, scale


def shift(frames, dx, dy):
    out = []
    for f in frames:
        c = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
        c.paste(f, (dx, dy))
        out.append(c)
    return out


def check_fit(frames, name):
    for f in frames:
        bb = f.getchannel('A').getbbox()
        if bb and (bb[0] < 0 or bb[1] < 0 or bb[2] > CANVAS or bb[3] > CANVAS):
            raise SystemExit(f'{name}: content clipped')
        if bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == CANVAS or bb[3] == CANVAS):
            print(f'  warn {name}: touches canvas edge', bb)


def encode_gif(frames, durs, n):
    """Shared n-colour palette (+1 transparent), no dither, binary alpha."""
    px = []
    for f in frames:
        a = np.asarray(f)
        px.append(a[a[..., 3] > 0][:, :3])
    allpx = np.concatenate(px)
    uniq = np.unique(allpx, axis=0)
    strip = Image.fromarray(uniq.reshape(1, -1, 3).astype(np.uint8), 'RGB')
    if len(uniq) > n:
        pal_img = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    else:
        pal_img = strip.quantize(colors=max(len(uniq), 2), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = pal_img.getpalette()[:768]
    ncol = len(pal) // 3
    ncol = min(ncol, n)
    tidx = ncol
    pal = pal[:ncol * 3] + [0, 0, 0]
    pal += [0] * (768 - len(pal))
    base = Image.new('P', (1, 1)); base.putpalette(pal)
    pframes = []
    for f in frames:
        a = np.asarray(f)
        rgb = Image.fromarray(a[..., :3].copy(), 'RGB')
        q = rgb.quantize(palette=base, dither=Image.Dither.NONE)
        idx = np.asarray(q).copy()
        idx[a[..., 3] == 0] = tidx
        p = Image.fromarray(idx, 'P'); p.putpalette(pal)
        pframes.append(p)
    buf = io.BytesIO()
    pframes[0].save(buf, 'GIF', save_all=True, append_images=pframes[1:], duration=durs,
                    loop=0, disposal=2, transparency=tidx, optimize=False)
    return buf.getvalue()


def write_gif(frames, durs, path, limit=LIMIT):
    for n in LADDER:
        data = encode_gif(frames, durs, n)
        if len(data) <= limit:
            break
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as fh:
        fh.write(data)
    png = path[:-4] + '.png'
    frames[0].save(png, optimize=True)
    print(f'  {os.path.relpath(path, ROOT)}: {len(data)/1024:.1f} KB ({n} colours), png {os.path.getsize(png)/1024:.1f} KB')
    return len(data) + os.path.getsize(png)


def save_png(src, dst):
    im = Image.open(src).convert('RGBA')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    opaque = im.getchannel('A').getextrema()[0] == 255
    best = None
    im2 = im.convert('RGB') if opaque else im
    buf = io.BytesIO(); im2.save(buf, 'PNG', optimize=True); best = buf.getvalue()
    # lossless palette form when <=256 colours
    cols = im2.getcolors(256)
    if cols is not None:
        q = im2.quantize(colors=len(cols), method=Image.Quantize.FASTOCTREE if not opaque else Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        if (np.asarray(q.convert(im2.mode)) == np.asarray(im2)).all():
            b2 = io.BytesIO(); q.save(b2, 'PNG', optimize=True)
            if len(b2.getvalue()) < len(best):
                best = b2.getvalue()
    with open(dst, 'wb') as fh:
        fh.write(best)
    print(f'  {os.path.relpath(dst, ROOT)}: {len(best)/1024:.1f} KB')
    return len(best)


def main():
    total = 0
    print('costumes')
    for name, n in COSTUMES.items():
        fr, du = load(os.path.join(SRC, 'gpt', f'{n}.gif'))
        out, s = place(fr, None)
        check_fit(out, name)
        print(f'  {name}: scale {s:.3f} body {body_bbox(out[0])}')
        total += write_gif(out, du, os.path.join(OUT, 'mascots', f'{name}.gif'))
    print('classic actions')
    ref = body_bbox(load(os.path.join(SRC, 'classic_idle_reference.gif'))[0][0])
    assert ref == (130, 263, 328, 434), ref
    for name, n in ACTIONS.items():
        fr, du = load(os.path.join(SRC, 'gpt', f'{n}.gif'))
        out, s = place(fr, None)
        check_fit(out, name)
        print(f'  {name}: scale {s:.3f} body {body_bbox(out[0])}')
        total += write_gif(out, du, os.path.join(OUT, 'mascots', f'classic_{name}.gif'))
    fr, du = load(os.path.join(SRC, 'v2', 'mascots', 'dino_classic_sparkle_pop_transparent_512.gif'))
    b = body_bbox(fr[0])
    out = shift(fr, 130 - b[0], FOOT_Y - b[3])
    check_fit(out, 'sparkle_pop')
    print(f'  sparkle_pop: shift ({130-b[0]},{FOOT_Y-b[3]}) body {body_bbox(out[0])}')
    total += write_gif(out, du, os.path.join(OUT, 'mascots', 'classic_sparkle_pop.gif'))
    print('backgrounds')
    for b in BGS:
        total += save_png(os.path.join(SRC, 'v2', 'backgrounds', f'bg_{b}_1600x400.png'),
                          os.path.join(OUT, 'backgrounds', f'{b}.png'))
    print('achievements')
    for k, v in ACHIEVEMENTS.items():
        total += save_png(os.path.join(SRC, 'v2', 'achievements', f'{k}_128.png'),
                          os.path.join(OUT, 'achievements', f'{v}.png'))
    print('effects / companions')
    fr, du = load(os.path.join(SRC, 'v2', 'effects', 'daily_streak_flame_128.gif'))
    total += write_gif(fr, du, os.path.join(OUT, 'effects', 'streak_flame.gif'))
    fr, du = load(os.path.join(SRC, 'v2', 'companions', 'summer_duck_straw_hat_transparent_512.gif'))
    total += write_gif(fr, du, os.path.join(OUT, 'companions', 'summer_duck.gif'))
    print(f'TOTAL {total/1024:.1f} KB')


if __name__ == '__main__':
    main()
