#!/usr/bin/env python3
"""Mesure la bande REELLEMENT occupee de chaque piste, et en deduit un debit.

    python tools/mesure-spectre.py [dossier]

La §6.5 de la passation exige que le debit de chaque piste soit choisi « selon
la bande reellement occupee, mesuree par analyse spectrale et non estimee ».
C'est ce que fait ce script : il lit chaque fichier, calcule un spectre moyen,
et cherche la frequence en dessous de laquelle vit 99 % de l'energie.

Un choix a expliquer : on mesure sur le spectre d'ENERGIE moyen de tout le
fichier, pas sur un instant. Une nappe d'ambiance n'a pas de transitoire qui
compte ; ce qui decide de son debit, c'est ou son energie vit en permanence.

Deux colonnes de sortie meritent d'etre lues ensemble :

  f99    la frequence sous laquelle vit 99 % de l'energie. C'est elle qui
         decide du debit.
  aigus  la part d'energie AU-DESSUS de 4 kHz. C'est elle qui dit si une piste
         peut servir de prise au scellement : fermer une fenetre coupe au-dessus
         de 200 Hz, et si une piste n'a rien en haut, la fermer ne s'entend pas.
         Voir §6.8 -- c'est l'argument commercial du site qui en depend.
"""
import subprocess
import sys
from pathlib import Path
import numpy as np

RACINE = Path(__file__).resolve().parent.parent
TAUX = 22050          # on ne s'interesse a rien au-dessus de 11 kHz
BLOC = 4096


def pcm(chemin):
    """Le fichier en mono, flottant, a TAUX. Passe par ffmpeg, pas de dependance."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(chemin),
           "-ac", "1", "-ar", str(TAUX), "-f", "f32le", "-"]
    brut = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(brut, dtype=np.float32)


def spectre(x):
    """Spectre d'energie moyen, par blocs fenetres."""
    n = len(x) // BLOC
    if n == 0:
        return None
    x = x[:n * BLOC].reshape(n, BLOC)
    # On sous-echantillonne a 200 blocs au plus : un fichier de dix minutes n'a
    # pas besoin d'etre analyse en entier pour donner sa bande.
    if n > 200:
        x = x[np.linspace(0, n - 1, 200).astype(int)]
    fen = np.hanning(BLOC)
    s = np.abs(np.fft.rfft(x * fen, axis=1)) ** 2
    return s.mean(axis=0)


def debit_conseille(f99, aigus, canaux, duree):
    """Les paliers de la §6.5, appliques a ce qui est mesure.

    Parkside : 64 k pour les nappes graves mono, 80-96 k pour ce qui reste sous
    1,4 kHz, 128 k pour ce qui a du contenu aigu reel, 192 k pour les musiques.
    """
    if duree > 120 and aigus > 0.10:
        return 192          # une musique : du contenu aigu reel, et longue
    if aigus > 0.04:
        return 128
    if f99 < 1400:
        return 96 if canaux > 1 else 64
    return 96


if __name__ == "__main__":
    dossier = Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / "audio" / "sources"
    freqs = np.fft.rfftfreq(BLOC, 1 / TAUX)

    print(f"\n  {'piste':<22s} {'duree':>7s} {'can':>4s} {'debit':>6s} "
          f"{'f99':>7s} {'aigus':>7s} {'conseil':>8s}")
    for f in sorted(dossier.glob("*.mp3")):
        x = pcm(f)
        s = spectre(x)
        if s is None:
            print(f"  {f.name:<22s}  trop court")
            continue
        cum = np.cumsum(s) / s.sum()
        f99 = float(freqs[np.searchsorted(cum, 0.99)])
        aigus = float(s[freqs > 4000].sum() / s.sum())

        info = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "format=duration,bit_rate:stream=channels", "-of", "csv=p=0",
             str(f)], capture_output=True, text=True).stdout.split()
        canaux = int(info[0])
        duree, br = float(info[1].split(",")[0]), int(info[1].split(",")[1])

        c = debit_conseille(f99, aigus, canaux, duree)
        marque = "" if c >= br // 1000 else "   <- allegeable"
        print(f"  {f.stem:<22s} {duree:7.1f} {canaux:4d} {br//1000:6d} "
              f"{f99:7.0f} {aigus:7.3f} {c:8d}{marque}")

    print("\n  f99   : frequence sous laquelle vit 99 % de l'energie")
    print("  aigus : part d'energie au-dessus de 4 kHz -- c'est elle qui donne")
    print("          prise au scellement (§6.8)")
