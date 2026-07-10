# ============================================================
# Trafic Toulouse — image nginx alpine (~10 Mo compressée)
# La configuration (clé API, ville, intervalle…) est injectée
# au DÉMARRAGE via les variables d'environnement : pas besoin
# de reconstruire l'image pour changer un réglage.
# ============================================================
FROM nginx:1.27-alpine

# Site statique
COPY site/index.html site/app.js site/config.js.template /usr/share/nginx/html/

# Configuration nginx (cache maîtrisé sur config.js)
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Hook exécuté par l'entrypoint officiel de l'image nginx avant le démarrage
COPY docker/20-generate-config.sh /docker-entrypoint.d/20-generate-config.sh
RUN chmod +x /docker-entrypoint.d/20-generate-config.sh && mkdir -p /data

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
