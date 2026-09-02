#!/usr/bin/env python3
"""Le texte de la narration est-il lisible sur les treize fonds ?

    python tools/mesure-contraste-narration.py

C'est le meme controle que pour le curseur, et pour la meme raison (§9, piege
29) : la, un trait clair a 55 % d'alpha ne creusait que 0,074 de luminance sur
l'eau et se noyait dans les rides. On avait cru le curseur « disparu » alors
qu'il etait parfaitement opaque -- il etait simplement sans contraste.

Le meme piege attend le texte. Le bas gauche des treize plans va du noir franc
au blanc : sombre sur le spa, les velos et le yoga, franchement clair sur la
salle de sport et sur la piscine ou le travertin est en plein soleil. Sans
voile, la meilleure ligne du site serait invisible sur la piscine -- et l'on ne
s'en apercevrait qu'a la livraison.

CE QU'ON MESURE. Dans le rectangle ou le texte se pose, on prend la luminance du
fond, on lui applique le voile, et l'on regarde l'ecart avec la couleur du
texte. Le critere est celui du curseur : ECART D'AU MOINS 0,20 sur les treize.

On prend le pire cas, pas la moyenne : un mot pose sur un eclat de travertin est
illisible meme si le reste de la ligne va bien. C'est le percentile 98 de la
luminance du fond qui decide.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
L, H = 1280, 720

# La couleur du texte, --texte dans index.html.
TEXTE = (0xEC, 0xE9, 0xE4)
# Le voile : degrade du transparent vers le noir sur le tiers inferieur.
VOILE_HAUTEUR = 0.34
VOILE_MAX = 0.35
# La boite du texte, en parts de la bande d'image : marge gauche 20 px, marge
# basse d'un peu plus de deux hauteurs de ligne, mesure d'environ 21 em.
BOITE = {"x0": 20 / L, "x1": 0.42, "y0": 1 - (52 + 2 * 29) / H, "y1": 1 - 52 / H}

SEQUENCES = [
    "01-facade", "02-approche", "03-hall", "04-spa", "05-velos",
    "06-salle-sport", "07-yoga", "08-salon", "09-chambre", "10-balcon",
    "11-montee-toit", "12-restaurant", "13-piscine",
]
# L'image sur laquelle le texte est PLEIN, deduite de `a` dans sequences.js.
# On regarde le fond que le visiteur a reellement sous les yeux a ce moment-la.
PLEIN = {
    "01-facade": 0.40, "02-approche": 0.35, "03-hall": 0.55, "04-spa": 0.30,
    "05-velos": 0.12, "06-salle-sport": 0.45, "07-yoga": 0.40, "08-salon": 0.20,
    "09-chambre": 0.45, "10-balcon": 0.35, "11-montee-toit": 0.30,
    "12-restaurant": 0.40, "13-piscine": 0.45,
}


def luminance_relative(rgb):
    """Luminance relative sRGB, celle des criteres de contraste."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def voile_a(y):
    """Opacite du voile a la hauteur y (0 en haut, 1 en bas de la bande)."""
    debut = 1 - VOILE_HAUTEUR
    if y < debut:
        return 0.0
    return VOILE_MAX * (y - debut) / VOILE_HAUTEUR


if __name__ == "__main__":
    lTexte = float(luminance_relative(TEXTE))
    print(f"\n  couleur du texte : luminance {lTexte:.3f}")
    print(f"  voile : jusqu'a {VOILE_MAX:.2f} de noir sur le tiers inferieur\n")
    print(f"  {'sequence':<17s} {'sans voile':>11s} {'avec voile':>11s} "
          f"{'ecart':>7s}  verdict")

    pire = 1.0
    echecs = 0
    for seq in SEQUENCES:
        dossier = RACINE / "frames" / "webp-1280" / seq
        fichiers = sorted(dossier.glob("*.webp"))
        if not fichiers:
            print(f"  {seq:<17s}  pas encore encode")
            continue
        n = len(fichiers)
        i = min(max(int(round(PLEIN[seq] * (n - 1))), 0), n - 1)
        a = np.asarray(Image.open(fichiers[i]).convert("RGB"), dtype=np.float64)

        x0, x1 = int(BOITE["x0"] * L), int(BOITE["x1"] * L)
        y0, y1 = int(BOITE["y0"] * H), int(BOITE["y1"] * H)
        boite = a[y0:y1, x0:x1]

        # Le voile s'applique par multiplication : resultat = fond * (1 - alpha).
        ys = (np.arange(y0, y1) + 0.5) / H
        alpha = np.array([voile_a(y) for y in ys])[:, None, None]
        voilee = boite * (1 - alpha)

        # Le PIRE cas, pas la moyenne : un mot sur un eclat de travertin est
        # illisible meme si le reste de la ligne va bien.
        lSans = float(np.percentile(luminance_relative(boite), 98))
        lAvec = float(np.percentile(luminance_relative(voilee), 98))
        ecart = abs(lTexte - lAvec)
        bon = ecart >= 0.20
        if not bon:
            echecs += 1
        pire = min(pire, ecart)
        print(f"  {seq:<17s} {lSans:11.3f} {lAvec:11.3f} {ecart:7.3f}  "
              f"{'ok' if bon else 'INSUFFISANT'}")

    print(f"\n  pire ecart : {pire:.3f}   critere : >= 0,20")
    print("  " + ("tous les fonds passent" if echecs == 0
                  else f"{echecs} fond(s) sous le critere"))
    sys.exit(0 if echecs == 0 else 1)
