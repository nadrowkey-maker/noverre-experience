#!/usr/bin/env python3
"""Suit les quatre coins du bassin sur toute la sequence, et propose les reperes.

    python tools/suivre-bassin.py [--pas 4] [--sequence 13-piscine]

Pourquoi de proche en proche et non image par image independamment : la lumiere
change du plein jour a la nuit pendant le plan. Un affinage parti du meme point
sur toutes les images converge bien tant que la marche de luminance est franche,
puis part ailleurs des que les projecteurs immerges inversent le contraste --
l'eau devient plus claire que la margelle. En partant de l'image precedente, le
point de depart est toujours a un pixel de la solution, et la mesure n'a plus
qu'a corriger la derive.

Sortie : les coins mesures a chaque image sondee, puis une proposition de
reperes pour BASSIN_REPERES, choisis la ou l'interpolation lineaire des seuls
extremes s'ecarte le plus de la mesure.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from mesure_bords_lib import luminance, ecart_bord

ORDRE = ["HG", "HD", "BD", "BG"]
RACINE = Path(__file__).resolve().parent.parent


def droite(p, q):
    dx, dy = q[0] - p[0], q[1] - p[1]
    lg = np.hypot(dx, dy)
    a, b = -dy / lg, dx / lg
    return a, b, -(a * p[0] + b * p[1])


def intersection(d1, d2):
    a1, b1, c1 = d1
    a2, b2, c2 = d2
    det = a1 * b2 - a2 * b1
    if abs(det) < 1e-9:
        raise ValueError("bords paralleles")
    return ((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det)


def affiner(lum, coins, tours=6):
    for _ in range(tours):
        bords, ecarts = [], []
        for i, nom in enumerate(ORDRE):
            a, b = coins[nom], coins[ORDRE[(i + 1) % 4]]
            _, med, _, n = ecart_bord(lum, a, b, nom)
            bords.append(droite(a, b))
            ecarts.append(0.0 if med is None or n < 8 else med)
        depl = [(a, b, c - e) for (a, b, c), e in zip(bords, ecarts)]
        neufs = {nom: intersection(depl[(i - 1) % 4], depl[i])
                 for i, nom in enumerate(ORDRE)}
        bouge = max(np.hypot(neufs[k][0] - coins[k][0], neufs[k][1] - coins[k][1])
                    for k in ORDRE)
        coins = neufs
        if bouge < 0.1:
            break
    return coins


def residu(lum, coins):
    """Pire ecart median restant : la mesure de confiance du calage."""
    pire = 0.0
    for i, nom in enumerate(ORDRE):
        _, med, _, n = ecart_bord(lum, coins[nom], coins[ORDRE[(i + 1) % 4]], nom)
        if med is not None and n >= 8:
            pire = max(pire, abs(med))
    return pire


def interpole(reperes, t):
    if len(reperes) == 1:
        return reperes[0][1]
    k = 1
    while k < len(reperes) - 1 and t > reperes[k][0]:
        k += 1
    (ta, a), (tb, b) = reperes[k - 1], reperes[k]
    u = 0.0 if tb == ta else min(max((t - ta) / (tb - ta), 0), 1)
    return {n: (a[n][0] + (b[n][0] - a[n][0]) * u,
                a[n][1] + (b[n][1] - a[n][1]) * u) for n in ORDRE}


def pire_ecart(mesures, reperes):
    """Pire ecart, en pixels, entre les reperes interpoles et la mesure."""
    pire, ou = 0.0, None
    for t, coins, _ in mesures:
        q = interpole(reperes, t)
        for n in ORDRE:
            d = np.hypot(q[n][0] - coins[n][0], q[n][1] - coins[n][1])
            if d > pire:
                pire, ou = d, t
    return pire, ou


if __name__ == "__main__":
    pas = 4
    seq = "13-piscine"
    depart = {"HG": (159, 446), "HD": (755, 320), "BD": (1077, 354), "BG": (569, 591)}
    for a in sys.argv[1:]:
        if a.startswith("--pas="):
            pas = int(a.split("=")[1])
        elif a.startswith("--sequence="):
            seq = a.split("=")[1]

    dossier = RACINE / "frames" / "webp-1280" / seq
    fichiers = sorted(dossier.glob("*.webp"))
    N = len(fichiers)
    print(f"{seq} : {N} images, sondage tous les {pas}\n")

    indices = list(range(1, N + 1, pas))
    if indices[-1] != N:
        indices.append(N)

    mesures = []
    coins = depart
    print(f"  {'img':>4s} {'t':>6s}  " + "  ".join(f"{n:>12s}" for n in ORDRE) + "   residu")
    for i in indices:
        lum = luminance(Image.open(fichiers[i - 1]))
        coins = affiner(lum, coins)
        r = residu(lum, coins)
        t = (i - 1) / (N - 1)
        mesures.append((t, coins, r))
        drapeau = "  <-- calage douteux" if r > 1.5 else ""
        print(f"  {i:4d} {t:6.3f}  " +
              "  ".join(f"{coins[n][0]:6.1f},{coins[n][1]:5.1f}" for n in ORDRE) +
              f"   {r:4.2f}{drapeau}")

    # --- de combien le plan bouge-t-il en tout ? ---------------------------
    print("\n  amplitude de la derive, par coin :")
    for n in ORDRE:
        xs = [c[n][0] for _, c, _ in mesures]
        ys = [c[n][1] for _, c, _ in mesures]
        print(f"    {n}  x {min(xs):6.1f} -> {max(xs):6.1f}  ({max(xs)-min(xs):5.1f} px)"
              f"   y {min(ys):6.1f} -> {max(ys):6.1f}  ({max(ys)-min(ys):5.1f} px)")

    # --- combien de reperes faut-il ? --------------------------------------
    # On part des deux extremes et l'on ajoute un repere la ou l'ecart est le
    # pire, jusqu'a tenir sous le pixel. C'est exactement la logique de la
    # passation : deux reperes si la derive est reguliere, davantage sinon.
    print("\n  choix des reperes (on ajoute la ou l'ecart est le pire) :")
    reperes = [(mesures[0][0], mesures[0][1]), (mesures[-1][0], mesures[-1][1])]
    for _ in range(8):
        pire, ou = pire_ecart(mesures, reperes)
        print(f"    {len(reperes)} reperes -> pire ecart {pire:5.2f} px" +
              (f" a t = {ou:.3f}" if ou is not None else ""))
        if pire <= 1.0:
            break
        cible = min(mesures, key=lambda m: abs(m[0] - ou))
        reperes.append((cible[0], cible[1]))
        reperes.sort(key=lambda r: r[0])

    print("\nexport BASSIN_REPERES :\n")
    print("export const BASSIN_REPERES = [")
    for t, c in reperes:
        pts = ", ".join(f"{n}: [{round(c[n][0])}, {round(c[n][1])}]" for n in ORDRE)
        print(f"  {{ t: {t:.3f}, coins: {{ {pts} }} }},")
    print("];")
