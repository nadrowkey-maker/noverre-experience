#!/usr/bin/env python3
"""Releve le chemin du soleil sur l'eau, et le relais des projecteurs immerges.

    python tools/mesure-miroitement.py [--pas 4]

POURQUOI MESURER PLUTOT QUE MODELISER (§7.5 de la passation).

Modeliser le soleil demanderait la focale du rendu, et elle n'est pas
recuperable des quatre coins seuls : deux droites du bassin sont paralleles
dans l'image, leur point de fuite est a l'infini, et la contrainte
d'orthogonalite ne donne alors que le point principal. Il faudrait la deviner.

Lire la reponse sur l'image evite entierement la question -- et surtout, la
reponse ne peut pas etre en desaccord avec l'image, puisque c'est l'image.

CE QU'ON MESURE, ET SUR QUEL SIGNAL.

  le soleil       dans le quadrilatere, l'eau est partout cyan sauf sous le
                  soleil : `rouge moins bleu` isole donc la trainee sans
                  ambiguite. On en prend le barycentre et l'ecart-type, ramenes
                  au carre unite, plus la chaleur moyenne pour la force.

  les projecteurs un AUTRE signal, et expres : la teinte du fond du bassin.
                  Les projecteurs rendent l'eau franchement cyan, donc
                  `bleu moins rouge` est propre et monotone, et la bosse chaude
                  du coucher ne le touche pas.

Le relais se fait alors de lui-meme : le soleil meurt, les projecteurs prennent
la suite, et les deux courbes viennent de deux mesures independantes.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
SEQ = "13-piscine"
L, H = 1280, 720

# Les reperes de calage, releves a la main dans tools/editeur-bassin.html.
# Ils sont recopies ici plutot qu'importes : ce script est en Python et
# src/config/bassin.js est en JavaScript. Si les reperes changent la-bas, ils
# doivent changer ici -- la recette le verifie.
REPERES = [
    (0.0, {"HG": (195, 457), "HD": (772, 333), "BD": (1062, 365), "BG": (565, 588)}),
    (1.0, {"HG": (214, 450), "HD": (767, 346), "BD": (1040, 371), "BG": (570, 563)}),
]
ORDRE = ["HG", "HD", "BD", "BG"]


def coins_a(t):
    if len(REPERES) == 1:
        return REPERES[0][1]
    k = 1
    while k < len(REPERES) - 1 and t > REPERES[k][0]:
        k += 1
    (ta, a), (tb, b) = REPERES[k - 1], REPERES[k]
    u = 0.0 if tb == ta else min(max((t - ta) / (tb - ta), 0), 1)
    return {n: (a[n][0] + (b[n][0] - a[n][0]) * u,
                a[n][1] + (b[n][1] - a[n][1]) * u) for n in ORDRE}


def carre_vers(p0, p1, p2, p3):
    """Heckbert, carre unite -> quadrilatere. Rendue en lignes."""
    dx1, dx2 = p1[0] - p2[0], p3[0] - p2[0]
    dy1, dy2 = p1[1] - p2[1], p3[1] - p2[1]
    sx = p0[0] - p1[0] + p2[0] - p3[0]
    sy = p0[1] - p1[1] + p2[1] - p3[1]
    det = dx1 * dy2 - dx2 * dy1
    g, h = (0.0, 0.0) if abs(det) < 1e-12 else (
        (sx * dy2 - dx2 * sy) / det, (dx1 * sy - sx * dy1) / det)
    return np.array([
        [p1[0] - p0[0] + g * p1[0], p3[0] - p0[0] + h * p3[0], p0[0]],
        [p1[1] - p0[1] + g * p1[1], p3[1] - p0[1] + h * p3[1], p0[1]],
        [g, h, 1.0]])


def vers_unite(coins):
    m = carre_vers(coins["HG"], coins["HD"], coins["BD"], coins["BG"])
    return np.linalg.inv(m)


# Grille de coordonnees image, calculee une fois.
YS, XS = np.mgrid[0:H, 0:L]
PIX = np.stack([XS + 0.5, YS + 0.5, np.ones_like(XS, dtype=float)])


def masque_et_uv(coins):
    """Pour chaque pixel : ses coordonnees dans le carre unite, et s'il y est."""
    inv = vers_unite(coins)
    w = inv[2, 0] * PIX[0] + inv[2, 1] * PIX[1] + inv[2, 2]
    u = (inv[0, 0] * PIX[0] + inv[0, 1] * PIX[1] + inv[0, 2]) / w
    v = (inv[1, 0] * PIX[0] + inv[1, 1] * PIX[1] + inv[1, 2]) / w
    dedans = (u > 0.02) & (u < 0.98) & (v > 0.02) & (v < 0.98)
    return u, v, dedans


if __name__ == "__main__":
    pas = 4
    for a in sys.argv[1:]:
        if a.startswith("--pas="):
            pas = int(a.split("=")[1])

    fichiers = sorted((RACINE / "frames" / "webp-1280" / SEQ).glob("*.webp"))
    N = len(fichiers)
    indices = list(range(1, N + 1, pas))
    if indices[-1] != N:
        indices.append(N)

    lignes = []
    for i in indices:
        t = (i - 1) / (N - 1)
        a = np.asarray(Image.open(fichiers[i - 1]).convert("RGB"), dtype=np.float64)
        u, v, dedans = masque_et_uv(coins_a(t))

        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        chaleur = (r - b)[dedans]
        froid = (b - r)[dedans]
        uu, vv = u[dedans], v[dedans]

        # Le chemin du soleil : la partie franchement chaude de la distribution.
        # Le seuil est pris SUR LA DISTRIBUTION elle-meme et non pose a
        # l'avance -- sinon il ne veut plus rien dire quand le soleil est parti.
        seuil = max(chaleur.max() * 0.55, 1.0)
        pris = chaleur > seuil
        if pris.sum() > 60:
            p = chaleur[pris] - seuil
            cu = float((uu[pris] * p).sum() / p.sum())
            cv = float((vv[pris] * p).sum() / p.sum())
            eu = float(np.sqrt(((uu[pris] - cu) ** 2 * p).sum() / p.sum()))
            ev = float(np.sqrt(((vv[pris] - cv) ** 2 * p).sum() / p.sum()))
            force = float(chaleur[pris].mean())
        else:
            cu = cv = float("nan"); eu = ev = float("nan"); force = 0.0

        lignes.append((t, i, cu, cv, eu, ev, force, float(froid.mean())))

    # --- normalisation -------------------------------------------------------
    forces = np.array([l[6] for l in lignes])
    forces = np.maximum(forces - forces.min(), 0)
    fmax = forces.max() if forces.max() > 0 else 1.0
    soleil = forces / fmax

    froids = np.array([l[7] for l in lignes])
    fr0, fr1 = froids.min(), froids.max()
    nuit = (froids - fr0) / (fr1 - fr0) if fr1 > fr0 else froids * 0

    print(f"\n  {SEQ} : {N} images, sondage tous les {pas}\n")
    print(f"  {'t':>6s} {'img':>4s} {'centre u':>9s} {'centre v':>9s} "
          f"{'et. u':>7s} {'et. v':>7s} {'chaleur':>8s} {'soleil':>7s} {'froid':>7s} {'nuit':>6s}")
    for (t, i, cu, cv, eu, ev, f, fr), s, n in zip(lignes, soleil, nuit):
        cu_s = "     n/d" if np.isnan(cu) else f"{cu:9.3f}"
        cv_s = "     n/d" if np.isnan(cv) else f"{cv:9.3f}"
        eu_s = "    n/d" if np.isnan(eu) else f"{eu:7.3f}"
        ev_s = "    n/d" if np.isnan(ev) else f"{ev:7.3f}"
        print(f"  {t:6.3f} {i:4d} {cu_s} {cv_s} {eu_s} {ev_s} "
              f"{f:8.2f} {s:7.3f} {fr:7.2f} {n:6.3f}")

    imax = int(np.argmax(soleil))
    print(f"\n  chaleur maximale a l'image {lignes[imax][1]} (t = {lignes[imax][0]:.3f})")
    sous5 = [l for l, s in zip(lignes, soleil) if s < 0.05 and l[0] > lignes[imax][0]]
    if sous5:
        print(f"  sous 5 % a partir de l'image {sous5[0][1]} (t = {sous5[0][0]:.3f})")
    dem = [l for l, n in zip(lignes, nuit) if n > 0.10]
    ple = [l for l, n in zip(lignes, nuit) if n > 0.90]
    if dem:
        print(f"  les projecteurs entrent vers t = {dem[0][0]:.3f}")
    if ple:
        print(f"  ils sont pleins vers t = {ple[0][0]:.3f}")
