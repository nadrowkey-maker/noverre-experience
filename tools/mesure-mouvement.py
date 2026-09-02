#!/usr/bin/env python3
"""Profil de mouvement de chaque clip : ou la camera part, ou elle s'arrete.

    python tools/mesure-mouvement.py

Repond a deux questions qu'on ne doit pas trancher au jugé.

1. QUELS SEGMENTS PORTENT UNE `miseEnRoute` ?
   Un segment qui demarre a l'arret doit voir sa progression freinee par une
   courbe en carre sur ses premiers pour cent, sinon la camera part d'un coup a
   pleine vitesse au franchissement de la frontiere. Le critere : le mouvement
   des premieres images comparé au mouvement median du clip. Tres en dessous =
   la camera est a l'arret et prend sa vitesse.

2. QUELLE FINESSE DE SCRUB LE CLIP EXIGE-T-IL ?
   L'ecart entre deux images consecutives dit combien un saut d'image se
   verrait. Un plan quasi fixe supporte un defilement etale sur beaucoup
   d'ecrans ; un plan qui bouge vite ne le supporte pas.
"""
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image
import io

RACINE = Path(__file__).resolve().parent.parent
ORDRE = ["01-facade", "02-approche", "03-hall", "04-spa", "05-velos",
         "06-salle-sport", "07-yoga", "08-salon", "09-chambre", "10-balcon",
         "11-montee-toit", "12-restaurant", "13-piscine"]
# clip -> images par seconde retenues, comme dans build-frames.sh
CADENCE = {c: 12 for c in ORDRE}
CADENCE["04-spa"] = 30
CADENCE["05-velos"] = 24
ECRANS = {c: 6.0 for c in ORDRE}
ECRANS["02-approche"] = 5.0
ECRANS["04-spa"] = 8.0
ECRANS["13-piscine"] = 12.0
HAUTEUR_ECRAN = 900        # hauteur d'ecran de reference, comme dans la passation


def toutes_les_images(clip, largeur=240):
    cmd = ["ffmpeg", "-v", "error", "-i", str(RACINE / "rushes" / f"{clip}.mp4"),
           "-vf", f"scale={largeur}:-2,format=gray", "-vsync", "0",
           "-f", "image2pipe", "-vcodec", "png", "-"]
    brut = subprocess.run(cmd, capture_output=True).stdout
    sig = b"\x89PNG\r\n\x1a\n"
    out, i = [], brut.find(sig)
    while i >= 0:
        j = brut.find(sig, i + 8)
        out.append(np.asarray(Image.open(io.BytesIO(brut[i:] if j < 0 else brut[i:j])),
                              dtype=np.float64))
        i = j
    return out


if __name__ == "__main__":
    print(f"\n  {'clip':<17s} {'img':>4s} {'depart':>8s} {'median':>7s} {'rapport':>8s}"
          f" {'px/img':>7s}  demarrage")
    for clip in ORDRE:
        ims = toutes_les_images(clip)
        if len(ims) < 12:
            print(f"  {clip:<17s}  trop court")
            continue
        d = [float(np.abs(ims[k] - ims[k - 1]).mean()) for k in range(1, len(ims))]
        # Le depart : les six premieres transitions, le clip etant a 24 ou 30
        # images par seconde, cela couvre le quart de seconde initial.
        depart = float(np.mean(d[:6]))
        median = float(np.median(d))
        rapport = depart / median if median > 1e-6 else 1.0

        # Finesse du scrub : combien de pixels de defilement separent deux
        # images livrees.
        source = len(ims)
        pas = round(24 / CADENCE[clip]) if clip != "04-spa" else 1
        livrees = len(range(0, source, pas))
        pxparimage = ECRANS[clip] * HAUTEUR_ECRAN / max(livrees - 1, 1)

        if rapport < 0.45:
            verdict = "A L'ARRET -> miseEnRoute"
        elif rapport < 0.75:
            verdict = "ralenti au depart"
        else:
            verdict = "deja lance"
        print(f"  {clip:<17s} {livrees:4d} {depart:8.2f} {median:7.2f} {rapport:8.2f}"
              f" {pxparimage:7.0f}  {verdict}")

    print("\n  'depart'  = ecart moyen des six premieres transitions d'images")
    print("  'median'  = ecart median sur tout le clip")
    print("  'px/img'  = pixels de defilement entre deux images livrees, a 900 px d'ecran")
    print("              (Parkside tenait 35 px/img sur ses sequences ordinaires)")
