"""
Подготовка кадров BMW M5: кроп 4:5 по центру со сдвигом вверх на 45% и ресайз
в 640x800 — всегда; плюс опциональное приведение к сцене из раздела «Assets»
дизайн-хендоффа:
  * multiply слоем rgba(198,215,235,1);
  * overlay радиальным rgba(140,195,242,.20) -> rgba(10,12,16,.32);
  * снизу linear-gradient rgba(12,15,19,0) -> rgba(12,15,19,.42) от 50% высоты.

Запуск:  python3 grade_m5.py <src> <out> [strength]
`strength` — сила грейдинга, 0..1. По умолчанию 1.0 (как в хендоффе).
0 — только кроп: кадры остаются в своих цветах, как в эталонном блоке 21st.
"""
import math, sys, pathlib
from PIL import Image

W, H = 640, 800
ASPECT = W / H            # 0.8
V_ANCHOR = 0.45           # центр кадрирования — 45% высоты, т.е. сдвиг вверх

MULTIPLY = (198, 215, 235)
RADIAL_IN, RADIAL_IN_A = (140, 195, 242), 0.20
RADIAL_OUT, RADIAL_OUT_A = (10, 12, 16), 0.32
FOOT = (12, 15, 19)
FOOT_A, FOOT_START = 0.42, 0.50


def crop_45(im):
    w, h = im.size
    if w / h > ASPECT:                       # слишком широкий — режем по бокам
        cw, ch = int(round(h * ASPECT)), h
        x, y = (w - cw) // 2, 0
    else:                                    # слишком высокий — режем сверху/снизу
        cw = w
        ch = int(round(w / ASPECT))
        if ch > h:                           # источник уже уже 4:5 — режем по бокам
            ch = h
            cw = int(round(h * ASPECT))
        x = (w - cw) // 2
        y = int(round(V_ANCHOR * h - ch / 2))
        y = max(0, min(h - ch, y))
    return im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.LANCZOS)


def overlay_channel(b, s):
    # CSS blend-mode: overlay
    return 2 * b * s // 255 if b < 128 else 255 - 2 * (255 - b) * (255 - s) // 255


OVERLAY_LUT = [[overlay_channel(b, s) for s in range(256)] for b in range(256)]


def grade(im, strength=1.0):
    if strength <= 0:
        return im
    px = im.load()
    cx, cy = W / 2, H / 2
    r_max = math.hypot(cx, cy)
    mr, mg, mb = MULTIPLY

    for y in range(H):
        # подошва: линейный градиент от 50% высоты к низу
        t = (y / (H - 1) - FOOT_START) / (1 - FOOT_START)
        foot_a = FOOT_A * strength * max(0.0, min(1.0, t))
        dy2 = (y - cy) ** 2
        for x in range(W):
            r, g, b = px[x, y]
            # 1. multiply
            r = int(r * (1 - strength + strength * mr / 255))
            g = int(g * (1 - strength + strength * mg / 255))
            b = int(b * (1 - strength + strength * mb / 255))
            # 2. overlay радиальным градиентом
            k = min(1.0, math.sqrt((x - cx) ** 2 + dy2) / r_max)
            sr = RADIAL_IN[0] + (RADIAL_OUT[0] - RADIAL_IN[0]) * k
            sg = RADIAL_IN[1] + (RADIAL_OUT[1] - RADIAL_IN[1]) * k
            sb = RADIAL_IN[2] + (RADIAL_OUT[2] - RADIAL_IN[2]) * k
            a = (RADIAL_IN_A + (RADIAL_OUT_A - RADIAL_IN_A) * k) * strength
            r = int(r + (OVERLAY_LUT[r][int(sr)] - r) * a)
            g = int(g + (OVERLAY_LUT[g][int(sg)] - g) * a)
            b = int(b + (OVERLAY_LUT[b][int(sb)] - b) * a)
            # 3. затемнение снизу
            if foot_a > 0:
                r = int(r + (FOOT[0] - r) * foot_a)
                g = int(g + (FOOT[1] - g) * foot_a)
                b = int(b + (FOOT[2] - b) * foot_a)
            px[x, y] = (r, g, b)
    return im


def main(src_dir, out_dir, strength=1.0):
    src = pathlib.Path(src_dir)
    out = pathlib.Path(out_dir)
    files = sorted(
        [p for p in src.iterdir() if p.suffix.lower() in ('.jpeg', '.jpg', '.png')],
        key=lambda p: (0 if p.suffix.lower() == '.png' else 1, p.name.lower()),
    )
    for i, p in enumerate(files, 1):
        im = Image.open(p).convert('RGB')
        w0, h0 = im.size
        im = grade(crop_45(im), strength)
        dst = out / f'{i:02d}.jpeg'
        im.save(dst, 'JPEG', quality=82, optimize=True, progressive=True)
        print(f'{i:02d}.jpeg  <- {p.name:38s} {w0}x{h0} -> {W}x{H}  {dst.stat().st_size//1024} КБ')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
