#!/usr/bin/env python3
"""Mesure l'ecart entre les bords du quadrilatere pose et la vraie ligne d'eau.

    python tools/mesure-bords.py <image> [HG=x,y HD=... BD=... BG=...]

Le principe : la ligne d'eau est une marche de luminance -- la pierre claire
d'un cote, l'eau sombre de l'autre. Le long de chaque bord, on echantillonne un
profil PERPENDICULAIRE et l'on cherche le maximum du gradient. L'ecart median
entre ce maximum et la ligne posee dit si le calage tient.

On mesure au lieu de juger a l'oeil sur un rendu reduit : quelques pixels
d'erreur sur un coin donnent un decalage visible sur le bord oppose, parce que
la perspective amplifie.
"""
import sys
from PIL import Image
import numpy as np
from mesure_bords_lib import luminance, ecart_bord


if __name__ == "__main__":
    src = sys.argv[1]
    coins = {"HG": (183, 451), "HD": (767, 328), "BD": (1058, 359), "BG": (568, 588)}
    for a in sys.argv[2:]:
        if "=" in a:
            k, v = a.split("=")
            x, y = v.split(",")
            coins[k] = (float(x), float(y))

    lum = luminance(Image.open(src))
    print(f"\n{src}")
    print(f"  {'bord':10s} {'ecart median':>13s} {'|ecart| p90':>12s} {'sondes':>7s}")
    bords = [("HG->HD", "HG", "HD"), ("HD->BD", "HD", "BD"),
             ("BD->BG", "BD", "BG"), ("BG->HG", "BG", "HG")]
    pire = 0.0
    for nom, a, b in bords:
        _, med, p90, n = ecart_bord(lum, coins[a], coins[b], nom)
        if med is None:
            print(f"  {nom:10s} {'marche hors de portee':>13s}")
            continue
        pire = max(pire, abs(med))
        print(f"  {nom:10s} {med:+12.2f} px {p90:11.2f} px {n:7d}")
    print(f"\n  pire ecart median : {pire:.2f} px")
