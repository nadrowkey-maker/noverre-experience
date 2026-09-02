#!/usr/bin/env python3
"""Cherche les images les plus a risque de BANDES, clip par clip.

    python tools/mesure-bandes.py [clip ...]

Le critere de la qualite d'encodage n'est pas le detail, c'est le risque de
bandes : la part de l'image a la fois SOMBRE et LISSE, la ou un codec avec
perte plafonne un degrade sur quelques valeurs. Le detail, lui, coute des
octets mais MASQUE les defauts.

Le piege que cette mesure evite (§9, piege 4 de la passation) : echantillonner
au milieu des clips. Les vrais pires cas sont l'heure bleue d'une facade et la
nuit d'un toit -- trois a sept fois pires qu'au milieu du meme clip. On sonde
donc tout le clip et l'on garde le PIRE, pas la moyenne.

Sortie : par clip, la part sombre-et-lisse au pire, l'image ou elle est, et une
qualite WebP conseillee.
"""
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import io

RACINE = Path(__file__).resolve().parent.parent
PAS = 8            # une image sondee sur huit du rush
SOMBRE = 0.34      # luminance normalisee en dessous de laquelle on est « sombre »
LISSE = 2.2        # ecart-type local en dessous duquel on est « lisse » (sur 255)


def images_du_rush(chemin, pas):
    """Sort les images du rush en PNG brut, une sur `pas`, sans fichier temporaire."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(chemin),
           "-vf", f"select=not(mod(n\\,{pas})),scale=640:-2", "-vsync", "0",
           "-f", "image2pipe", "-vcodec", "png", "-"]
    brut = subprocess.run(cmd, capture_output=True).stdout
    # Les PNG concatenes se decoupent sur leur signature.
    sig = b"\x89PNG\r\n\x1a\n"
    bouts, i = [], brut.find(sig)
    while i >= 0:
        j = brut.find(sig, i + 8)
        bouts.append(brut[i:] if j < 0 else brut[i:j])
        i = j
    return bouts


def part_sombre_lisse(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert("L"), dtype=np.float64)
    # Ecart-type local sur 5x5, par integrales : rapide et suffisant.
    k = 5
    pad = k // 2
    b = np.pad(a, pad, mode="edge")
    s = np.zeros_like(a)
    s2 = np.zeros_like(a)
    for dy in range(k):
        for dx in range(k):
            v = b[dy:dy + a.shape[0], dx:dx + a.shape[1]]
            s += v
            s2 += v * v
    n = k * k
    var = np.maximum(s2 / n - (s / n) ** 2, 0)
    ecart = np.sqrt(var)
    sombre = a / 255.0 < SOMBRE
    lisse = ecart < LISSE
    return float((sombre & lisse).mean()), float(a.mean() / 255.0)


def qualite_conseillee(part):
    """La part sombre-et-lisse decide, par paliers.

    Parkside : 38 % de sombre-et-lisse sur une facade a l'heure bleue ->
    q 95 ; 4 a 8 % au milieu d'une salle -> q 82. On interpole ces paliers.
    """
    if part >= 0.30:
        return 95
    if part >= 0.20:
        return 92
    if part >= 0.12:
        return 90
    if part >= 0.06:
        return 88
    return 85


if __name__ == "__main__":
    clips = sys.argv[1:] or sorted(p.stem for p in (RACINE / "rushes").glob("*.mp4"))
    print(f"\n  {'clip':<18s} {'pire sombre+lisse':>18s} {'a l ind.':>9s} "
          f"{'lum. moy.':>10s} {'q conseille':>12s}")
    for clip in clips:
        rush = RACINE / "rushes" / f"{clip}.mp4"
        if not rush.exists():
            print(f"  {clip:<18s}  introuvable")
            continue
        pires = []
        for k, png in enumerate(images_du_rush(rush, PAS)):
            try:
                part, moy = part_sombre_lisse(png)
            except Exception:
                continue
            pires.append((part, k * PAS + 1, moy))
        if not pires:
            print(f"  {clip:<18s}  aucune image lue")
            continue
        part, ind, moy = max(pires)
        q = qualite_conseillee(part)
        print(f"  {clip:<18s} {part*100:17.1f}% {ind:9d} {moy:10.3f} {q:12d}")
