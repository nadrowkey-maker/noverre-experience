#!/usr/bin/env python3
"""Projette la grille du carre unite sur une image du bassin, pour juger le calage.

    python tools/apercu-calage.py <image> <sortie> [--coins HG=x,y HD=... BD=... BG=...]

C'est la GRILLE qui juge le calage, pas le quadrilatere : le quadrilatere passe
toujours par les quatre points qu'on vient de poser, donc il a toujours l'air
juste. La grille montre si l'interieur suit vraiment le bassin.

L'homographie est celle de src/water/homographie.js, reecrite ici en Python a
l'identique -- meme forme fermee de Heckbert. La recette JS reste l'autorite ;
ce fichier ne sert qu'a REGARDER.
"""
import sys
from PIL import Image, ImageDraw

L, H = 1280, 720


def carre_vers(p0, p1, p2, p3):
    """(0,0) (1,0) (1,1) (0,1) -> les quatre points. Rendue en LIGNES ici."""
    dx1, dx2 = p1[0] - p2[0], p3[0] - p2[0]
    dy1, dy2 = p1[1] - p2[1], p3[1] - p2[1]
    sx = p0[0] - p1[0] + p2[0] - p3[0]
    sy = p0[1] - p1[1] + p2[1] - p3[1]
    det = dx1 * dy2 - dx2 * dy1
    if abs(det) < 1e-12:
        g = h = 0.0
    else:
        g = (sx * dy2 - dx2 * sy) / det
        h = (dx1 * sy - sx * dy1) / det
    a = p1[0] - p0[0] + g * p1[0]
    b = p3[0] - p0[0] + h * p3[0]
    c = p0[0]
    d = p1[1] - p0[1] + g * p1[1]
    e = p3[1] - p0[1] + h * p3[1]
    f = p0[1]
    return (a, b, c, d, e, f, g, h, 1.0)


def projeter(m, u, v):
    a, b, c, d, e, f, g, h, i = m
    w = g * u + h * v + i
    return ((a * u + b * v + c) / w, (d * u + e * v + f) / w)


def dessiner(src, dst, coins, divisions=8):
    im = Image.open(src).convert("RGB")
    dr = ImageDraw.Draw(im, "RGBA")
    m = carre_vers(coins["HG"], coins["HD"], coins["BD"], coins["BG"])

    # La grille du carre unite, projetee. Si elle ne suit pas les bords du
    # bassin, le calage est faux -- et c'est visible sans rien mesurer.
    for k in range(1, divisions):
        s = k / divisions
        dr.line([projeter(m, 0, s), projeter(m, 1, s)], fill=(0, 255, 255, 150), width=1)
        dr.line([projeter(m, s, 0), projeter(m, s, 1)], fill=(0, 255, 255, 150), width=1)

    pts = [coins["HG"], coins["HD"], coins["BD"], coins["BG"]]
    dr.polygon(pts, outline=(255, 0, 255, 255))
    dr.line(pts + [pts[0]], fill=(255, 0, 255, 255), width=2)

    for nom, p in coins.items():
        x, y = p
        dr.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 255, 0, 255), width=2)
        dr.text((x + 9, y - 16), f"{nom} {int(x)},{int(y)}", fill=(255, 255, 0, 255))

    im.save(dst)
    print(f"{dst}  coins " + "  ".join(f"{k}=({int(v[0])},{int(v[1])})" for k, v in coins.items()))


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    coins = {"HG": (183, 451), "HD": (767, 328), "BD": (1058, 359), "BG": (568, 588)}
    for a in sys.argv[3:]:
        if "=" in a:
            k, v = a.split("=")
            x, y = v.split(",")
            coins[k] = (float(x), float(y))
    dessiner(src, dst, coins)
