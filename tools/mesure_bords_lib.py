"""Les fonctions de mesure de la ligne d'eau, partagees.

Extrait de tools/mesure-bords.py pour que tools/affiner-coins.py mesure
exactement la meme chose : deux mesures qui divergent d'un demi-pixel
feraient converger l'affinage vers un calage que la mesure refuse.
"""
import numpy as np
from PIL import Image

PORTEE = 14      # pixels sondes de part et d'autre du bord
PAS = 0.25       # finesse du sondage, en pixels


def luminance(im):
    a = np.asarray(im.convert("RGB"), dtype=np.float64)
    return 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]


def echantillon(lum, x, y):
    """Bilineaire, pour sonder entre les pixels."""
    h, w = lum.shape
    x = min(max(x, 0), w - 1.001)
    y = min(max(y, 0), h - 1.001)
    x0, y0 = int(x), int(y)
    fx, fy = x - x0, y - y0
    return (lum[y0, x0] * (1 - fx) * (1 - fy) + lum[y0, x0 + 1] * fx * (1 - fy)
            + lum[y0 + 1, x0] * (1 - fx) * fy + lum[y0 + 1, x0 + 1] * fx * fy)


def ecart_bord(lum, p, q, nom, n=40):
    """Ecart signe, en pixels, entre la ligne p->q et la marche de luminance.

    Positif = la vraie ligne d'eau est du cote de la normale (a droite du sens
    de parcours p->q).
    """
    px, py = p
    qx, qy = q
    dx, dy = qx - px, qy - py
    lg = np.hypot(dx, dy)
    ux, uy = dx / lg, dy / lg
    nx, ny = -uy, ux                     # normale unitaire

    ecarts = []
    for k in range(1, n):
        s = k / n
        # On evite les extremites : pres d'un coin, les deux bords se melent.
        if s < 0.08 or s > 0.92:
            continue
        cx, cy = px + dx * s, py + dy * s
        profil, pos = [], []
        t = -PORTEE
        while t <= PORTEE:
            profil.append(echantillon(lum, cx + nx * t, cy + ny * t))
            pos.append(t)
            t += PAS
        profil = np.array(profil)
        # Gradient lisse : la marche est nette mais l'image est compressee.
        grad = np.abs(np.gradient(profil))
        grad = np.convolve(grad, np.ones(5) / 5, mode="same")
        i = int(np.argmax(grad))
        # Un maximum colle au bord du profil veut dire que la marche est hors
        # de portee : on ne la compte pas plutot que de mentir.
        if i < 3 or i > len(grad) - 4:
            continue
        ecarts.append(pos[i])

    if not ecarts:
        return nom, None, None, 0
    e = np.array(ecarts)
    return nom, float(np.median(e)), float(np.percentile(np.abs(e), 90)), len(e)


