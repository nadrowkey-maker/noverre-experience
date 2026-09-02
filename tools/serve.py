#!/usr/bin/env python3
"""Serveur statique du banc, accessible depuis le telephone sur le reseau local.

    python tools/serve.py [port]

Sert la racine du projet, pour que tools/bench/ atteigne build/encoded/.
Ajoute les types MIME image/avif et image/webp, que http.server ignore.
"""
import functools, http.server, socket, socketserver, sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".avif": "image/avif",
        ".webp": "image/webp",
    }

    def end_headers(self):
        # Les livrables se mettent en cache : le banc mesure le decodage, pas
        # le reseau, et il faut que le second passage vienne du cache.
        #
        # Le CODE ne se met JAMAIS en cache. Un max-age global gelait src/*.js
        # et index.html pendant une heure : on rechargeait la page et on
        # regardait la version d'avant sans le savoir.
        chemin = self.path.split("?")[0]
        if chemin.startswith(("/frames/", "/audio/")):
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # le journal d'acces noierait la sortie


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Serveur(socketserver.ThreadingTCPServer):
    """Serveur a DOUBLE PILE, et c'est le point essentiel de ce fichier.

    Ecouter sur 0.0.0.0 n'ecoute qu'en IPv4. Or un navigateur resout
    « localhost » en ::1 AVANT 127.0.0.1 : il tente donc l'IPv6, attend le
    delai d'expiration de la connexion -- deux secondes pleines -- puis
    retombe sur IPv4.

    Mesure sur cette machine : 2040 ms par requete via localhost, 1,2 ms via
    127.0.0.1. Chaque image de la page payait ces deux secondes, ce qui
    affamait completement la chaine de decodage : le defilement se bloquait
    des l'arrivee, et les images en retard continuaient d'arriver apres qu'on
    avait lache, ce qui se voyait comme une video qui se lit toute seule.

    En ecoutant sur :: avec IPV6_V6ONLY a zero, la meme socket accepte les
    deux familles et la premiere tentative du navigateur aboutit.
    """

    address_family = socket.AF_INET6
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass  # pile IPv6 indisponible : on restera en IPv4 seul
        super().server_bind()


if __name__ == "__main__":
    # HTTP/1.1 pour garder les connexions ouvertes : sans cela le navigateur
    # rouvre une socket par image, soit des milliers de poignees de main.
    Handler.protocol_version = "HTTP/1.1"
    handler = functools.partial(Handler, directory=str(ROOT))
    with Serveur(("::", PORT), handler) as httpd:
        print(f"racine   {ROOT}")
        print(f"ordi     http://localhost:{PORT}/tools/bench/")
        print(f"telephone http://{lan_ip()}:{PORT}/tools/bench/")
        httpd.serve_forever()
