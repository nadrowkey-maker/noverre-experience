#!/usr/bin/env python3
"""Affine les quatre coins du bassin sur la vraie ligne d'eau, par iteration.

    python tools/affiner-coins.py <image> [--iterations 4] [HG=x,y ...]

Le releve a la loupe donne les coins a quelques pixels pres. Ce n'est pas assez :
la perspective amplifie, et quelques pixels sur un coin se voient sur le bord
oppose. Plutot que de tatonner a la main, on mesure l'ecart de chaque BORD a la
marche de luminance (pierre claire / eau sombre), on deplace les quatre droites
de cet ecart, et l'on reprend les coins a l'INTERSECTION des droites voisines.

Deplacer les coins un par un ne marcherait pas : un coin appartient a deux
bords, et le corriger pour l'un le derangerait pour l'autre. Les droites, elles,
sont independantes.

Deux ou trois tours suffisent : l'ecart tombe sous le pixel et n'y bouge plus.
"""
import sys
import numpy as np
from PIL import Image
from mesure_bords_lib import luminance, ecart_bord

ORDRE = ["HG", "HD", "BD", "BG"]


def droite(p, q):
    """La droite p->q en (a, b, c) normalise : a*x + b*y + c = 0, |(a,b)| = 1."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    lg = np.hypot(dx, dy)
    ux, uy = dx / lg, dy / lg
    a, b = -uy, ux                       # la normale, meme convention qu'ailleurs
    return a, b, -(a * p[0] + b * p[1])


def intersection(d1, d2):
    a1, b1, c1 = d1
    a2, b2, c2 = d2
    det = a1 * b2 - a2 * b1
    if abs(det) < 1e-9:
        raise ValueError("bords paralleles : le quadrilatere est degenere")
    return ((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det)


def affiner(lum, coins, tours=4):
    for tour in range(tours):
        bords, ecarts = [], []
        for i, nom in enumerate(ORDRE):
            a, b = coins[nom], coins[ORDRE[(i + 1) % 4]]
            _, med, _, n = ecart_bord(lum, a, b, nom)
            bords.append(droite(a, b))
            ecarts.append(0.0 if med is None or n < 8 else med)

        # On deplace chaque droite de son ecart, le long de sa propre normale.
        deplacees = [(a, b, c - e) for (a, b, c), e in zip(bords, ecarts)]

        # Le coin i est a l'intersection du bord qui y arrive et de celui qui
        # en part : le bord i-1 et le bord i.
        neufs = {}
        for i, nom in enumerate(ORDRE):
            neufs[nom] = intersection(deplacees[(i - 1) % 4], deplacees[i])

        bouge = max(np.hypot(neufs[k][0] - coins[k][0], neufs[k][1] - coins[k][1])
                    for k in ORDRE)
        coins = neufs
        print(f"  tour {tour + 1} : ecarts " +
              "  ".join(f"{n}{e:+.2f}" for n, e in zip(ORDRE, ecarts)) +
              f"   deplacement max {bouge:.2f} px")
        if bouge < 0.15:
            break
    return coins


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = args[0]
    tours = 4
    for a in sys.argv[1:]:
        if a.startswith("--iterations="):
            tours = int(a.split("=")[1])

    coins = {"HG": (183, 451), "HD": (767, 328), "BD": (1058, 359), "BG": (568, 588)}
    for a in args[1:]:
        if "=" in a:
            k, v = a.split("=")
            x, y = v.split(",")
            coins[k] = (float(x), float(y))

    lum = luminance(Image.open(src))
    print(f"\n{src}")
    print("  depart : " + "  ".join(f"{k}=({coins[k][0]:.0f},{coins[k][1]:.0f})" for k in ORDRE))
    coins = affiner(lum, coins, tours)
    print("\n  { " + ", ".join(
        f"{k}: [{round(coins[k][0])}, {round(coins[k][1])}]" for k in ORDRE) + " }")
