"""Рисует значки «Таверны» в docs/icons: кружка эля на тёмно-рыжем."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"
BG, MUG, ALE, FOAM = "#8a4524", "#f3e3c8", "#e0a238", "#fffaf0"


def draw(size, maskable):
    s = 4
    n = size * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, n, n], fill=BG)
        k = 0.55
    else:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.22, fill=BG)
        k = 0.75
    c, u = n / 2, n * k / 2
    x0, x1, y0, y1 = c - u * 0.62, c + u * 0.38, c - u * 0.45, c + u * 0.85
    w = u * 0.1
    d.rounded_rectangle([x1 - w, c - u * 0.25, x1 + u * 0.55, c + u * 0.55], radius=u * 0.25, outline=MUG, width=int(u * 0.13))
    d.rounded_rectangle([x0, y0, x1, y1], radius=u * 0.12, fill=MUG)
    d.rounded_rectangle([x0 + w, y0 + w * 2.2, x1 - w, y1 - w], radius=u * 0.08, fill=ALE)
    for fx, fr in ((-0.5, 0.26), (-0.18, 0.3), (0.15, 0.27)):
        cx, cy, r = c + u * fx, y0 - u * 0.02, u * fr
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FOAM)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
draw(192, False).save(OUT / "icon-192.png")
draw(512, False).save(OUT / "icon-512.png")
draw(512, True).save(OUT / "maskable-512.png")
print("ok")
