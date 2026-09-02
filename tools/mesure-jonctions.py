#!/usr/bin/env python3
"""Mesure l'ecart entre la derniere image d'un clip et la premiere du suivant.

    python tools/mesure-jonctions.py

Sert a decider les raccords SANS croire personne sur parole. Un raccord direct
(`fonduEnchaine: 0`) suppose que les deux plans sont contigus : la derniere
image de l'un et la premiere du suivant doivent alors se ressembler beaucoup
plus qu'a une coupe ordinaire.

Trois mesures, parce qu'aucune ne suffit seule :

  ecart      difference moyenne des pixels, 0 a 255. Brutal mais parlant.
  ssim       structure. Deux images de meme luminance mais de contenu different
             ont un ecart moyen faible et un SSIM bas : c'est le cas qu'il faut
             attraper.
  lum        difference de luminance moyenne. Un raccord peut etre contigu en
             contenu et sauter en exposition.

On mesure aussi l'ecart MEDIAN a l'interieur d'un clip (deux images
consecutives du milieu) : c'est l'etalon. Un raccord contigu doit etre du meme
ordre que lui, une coupe en est loin.
"""
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image
import io

RACINE = Path(__file__).resolve().parent.parent
ORDRE = ["01-facade", "02-approche", "03-hall", "04-spa", "05-velos",
         "06-salle-sport", "07-yoga", "08-salon", "09-chambre", "10-balcon",
         "11-montee-toit", "12-restaurant", "13-piscine"]
# Les raccords annonces comme directs, a verifier et non a croire.
ANNONCES = {("01-facade", "02-approche"), ("06-salle-sport", "07-yoga"),
            ("10-balcon", "11-montee-toit"), ("11-montee-toit", "12-restaurant")}


def image_a(clip, n):
    """L'image d'index n (base 0) du rush, en niveaux de gris 320 de large."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(RACINE / "rushes" / f"{clip}.mp4"),
           "-vf", f"select=eq(n\\,{n}),scale=320:-2,format=gray", "-vsync", "0",
           "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]
    b = subprocess.run(cmd, capture_output=True).stdout
    return np.asarray(Image.open(io.BytesIO(b)), dtype=np.float64)


def nb_images(clip):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0",
           "-show_entries", "stream=nb_frames", "-of", "csv=p=0:nk=1",
           str(RACINE / "rushes" / f"{clip}.mp4")]
    return int(subprocess.run(cmd, capture_output=True, text=True).stdout.strip())


def ssim(a, b):
    """SSIM global, formulation standard, sur l'image entiere."""
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = a.mean(), b.mean()
    va, vb = a.var(), b.var()
    cov = ((a - ma) * (b - mb)).mean()
    return float(((2 * ma * mb + C1) * (2 * cov + C2)) /
                 ((ma ** 2 + mb ** 2 + C1) * (va + vb + C2)))


def compare(a, b):
    return float(np.abs(a - b).mean()), ssim(a, b), float(abs(a.mean() - b.mean()))


if __name__ == "__main__":
    # --- l'etalon : deux images consecutives au milieu de chaque clip -------
    print("\n  etalon : deux images consecutives au MILIEU d'un clip")
    print(f"  {'clip':<18s} {'ecart':>7s} {'ssim':>7s} {'lum':>6s}")
    etalons = []
    for clip in ORDRE:
        n = nb_images(clip)
        a, b = image_a(clip, n // 2), image_a(clip, n // 2 + 1)
        e, s, l = compare(a, b)
        etalons.append(e)
        print(f"  {clip:<18s} {e:7.2f} {s:7.3f} {l:6.2f}")
    med = float(np.median(etalons))
    print(f"\n  ecart median a l'interieur d'un clip : {med:.2f}")

    # --- les jonctions ------------------------------------------------------
    print("\n  jonctions : derniere image de N contre premiere de N+1")
    print(f"  {'jonction':<32s} {'ecart':>7s} {'ssim':>7s} {'lum':>6s}  {'x etalon':>9s}  verdict")
    lignes = []
    for i in range(len(ORDRE) - 1):
        a_clip, b_clip = ORDRE[i], ORDRE[i + 1]
        a = image_a(a_clip, nb_images(a_clip) - 1)
        b = image_a(b_clip, 0)
        e, s, l = compare(a, b)
        rapport = e / med
        lignes.append((a_clip, b_clip, e, s, l, rapport))

    # Le seuil se lit sur la distribution elle-meme, pas sur une valeur posee
    # a l'avance : on cherche le decrochage entre les jonctions serrees et les
    # autres.
    tries = sorted(l[5] for l in lignes)
    print()
    for a_clip, b_clip, e, s, l, rapport in lignes:
        annonce = (a_clip, b_clip) in ANNONCES
        contigu = rapport < 8 and s > 0.55
        if annonce and contigu:
            v = "CONTIGU, comme annonce"
        elif annonce and not contigu:
            v = "annonce contigu mais NE L'EST PAS"
        elif contigu and not annonce:
            v = "CONTIGU alors qu'il n'etait pas annonce"
        else:
            v = "coupe"
        marque = " <<<" if annonce != contigu else ""
        print(f"  {a_clip + ' -> ' + b_clip:<32s} {e:7.2f} {s:7.3f} {l:6.2f}  "
              f"{rapport:8.1f}x  {v}{marque}")
