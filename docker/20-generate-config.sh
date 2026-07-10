#!/bin/sh
# ============================================================
# Genere /usr/share/nginx/html/config.js depuis, dans l'ordre :
#   1) les valeurs par defaut ci-dessous
#   2) les variables d'environnement (docker-compose.yml)
#   3) le fichier /data/settings.env s'il existe (prioritaire) --
#      ce fichier est visible et editable depuis le gestionnaire
#      de fichiers Umbrel (Applications > <app> > data > settings.env).
#
# Une boucle de surveillance tourne ensuite en tache de fond et
# regenere config.js des qu'un changement de settings.env est
# detecte (verification toutes les 4 secondes) -- un simple
# enregistrement du fichier dans l'interface Umbrel suffit,
# sans redemarrer l'application. Un rechargement du navigateur
# (Cmd/Ctrl+R) fait apparaitre le changement.
# ============================================================
set -eu

TEMPLATE="/usr/share/nginx/html/config.js.template"
TARGET="/usr/share/nginx/html/config.js"
DATA_DIR="/data"
SETTINGS="$DATA_DIR/settings.env"
KNOWN_VARS="TOMTOM_API_KEY MAP_LAT MAP_LON MAP_ZOOM REFRESH_INTERVAL_S TRAFFIC_STYLE FLOW_THICKNESS SHOW_INCIDENTS SHOW_JAMS CITY_LABEL"

# ---- Modele de settings.env cree au premier demarrage si /data est monte ----
write_template_settings() {
  [ -d "$DATA_DIR" ] || return 0
  [ -f "$SETTINGS" ] && return 0
  cat > "$SETTINGS" << 'EOF'
# ============================================================
# Reglages de Trafic Toulouse
# Modifiez les valeurs ci-dessous et enregistrez le fichier :
# la carte les reprend automatiquement en quelques secondes,
# sans redemarrer l'application (juste recharger la page).
#
# Une ligne commencant par # est ignoree.
# Laissez TOMTOM_API_KEY vide si vous saisissez la cle
# directement dans le navigateur, a la premiere visite.
# ============================================================

TOMTOM_API_KEY=

# Coordonnees du centre par defaut (Toulouse, place du Capitole)
MAP_LAT=43.6045
MAP_LON=1.4442

# Niveau de zoom initial (1 = monde, 19 = rue)
MAP_ZOOM=12

# Intervalle de rafraichissement du trafic, en secondes (minimum 30)
REFRESH_INTERVAL_S=60

# Style de coloration du flux :
# relative0 | relative0-dark | absolute | relative-delay | reduced-sensitivity
TRAFFIC_STYLE=relative0

# Epaisseur des troncons colores (1 a 20)
FLOW_THICKNESS=7

# Afficher les autres incidents (travaux, fermetures) : true ou false
SHOW_INCIDENTS=false

# Bouchons toujours affiches (traces cliquables) : true ou false
SHOW_JAMS=true

# Nom de la ville affiche dans le panneau
CITY_LABEL=Toulouse
EOF
  echo "[trafic] Modele de settings.env cree dans $DATA_DIR"
}

# ---- Lecture securisee de settings.env (liste blanche de variables) ----
load_settings_file() {
  [ -f "$SETTINGS" ] || return 0
  while IFS='=' read -r key val || [ -n "$key" ]; do
    key=$(echo "$key" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
    case "$key" in
      ''|'#'*) continue ;;
    esac
    match=0
    for k in $KNOWN_VARS; do [ "$k" = "$key" ] && match=1; done
    [ "$match" = "1" ] || continue
    val=$(echo "$val" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')
    [ -n "$val" ] || continue
    export "$key=$val"
  done < "$SETTINGS"
}

# ---- Generation de config.js a partir de l'environnement courant ----
generate_config() {
  : "${TOMTOM_API_KEY:=REMPLACER_PAR_VOTRE_CLE}"
  : "${MAP_LAT:=43.6045}"
  : "${MAP_LON:=1.4442}"
  : "${MAP_ZOOM:=12}"
  : "${REFRESH_INTERVAL_S:=60}"
  : "${TRAFFIC_STYLE:=relative0}"
  : "${FLOW_THICKNESS:=7}"
  : "${SHOW_INCIDENTS:=false}"
  : "${SHOW_JAMS:=true}"
  : "${CITY_LABEL:=Toulouse}"
  export TOMTOM_API_KEY MAP_LAT MAP_LON MAP_ZOOM REFRESH_INTERVAL_S \
         TRAFFIC_STYLE FLOW_THICKNESS SHOW_INCIDENTS SHOW_JAMS CITY_LABEL

  envsubst '${TOMTOM_API_KEY} ${MAP_LAT} ${MAP_LON} ${MAP_ZOOM} ${REFRESH_INTERVAL_S} ${TRAFFIC_STYLE} ${FLOW_THICKNESS} ${SHOW_INCIDENTS} ${SHOW_JAMS} ${CITY_LABEL}' \
    < "$TEMPLATE" > "$TARGET"

  echo "[trafic] config.js genere (ville: ${CITY_LABEL}, zoom: ${MAP_ZOOM}, refresh: ${REFRESH_INTERVAL_S}s)"
  if [ "$TOMTOM_API_KEY" = "REMPLACER_PAR_VOTRE_CLE" ]; then
    echo "[trafic] Pas de cle serveur -- l'ecran de saisie s'affichera dans le navigateur."
  fi
}

# ---- Boucle de surveillance de settings.env (tache de fond) ----
watch_settings() {
  [ -f "$SETTINGS" ] || return 0
  last=""
  while true; do
    sleep 4
    [ -f "$SETTINGS" ] || continue
    current=$(stat -c '%Y' "$SETTINGS" 2>/dev/null || echo "")
    if [ -n "$current" ] && [ "$current" != "$last" ]; then
      last="$current"
      # Repartir des variables d'environnement d'origine du conteneur
      # avant de reappliquer settings.env, pour prendre en compte
      # aussi bien les ajouts que les suppressions de lignes.
      env_snapshot="$1"
      # shellcheck disable=SC1090
      . "$env_snapshot" 2>/dev/null || true
      load_settings_file
      generate_config
    fi
  done
}

# ============================================================
# Execution
# ============================================================
write_template_settings

# Sauvegarde des variables d'environnement d'origine (celles du
# docker-compose.yml), pour que la boucle de surveillance puisse
# toujours repartir d'une base propre a chaque relecture du fichier.
ENV_SNAPSHOT="/tmp/trafic-env-snapshot.sh"
: > "$ENV_SNAPSHOT"
for k in $KNOWN_VARS; do
  eval "v=\${$k:-}"
  [ -n "$v" ] && printf '%s=%s\n' "$k" "$(printf '%s' "$v" | sed "s/'/'\\\\''/g")" | sed "s/^\([A-Z_]*\)=\(.*\)/\1='\2'/" >> "$ENV_SNAPSHOT"
done

load_settings_file
generate_config

# Lance la surveillance en arriere-plan (le hook doit rendre la main
# immediatement pour laisser nginx demarrer). Les flux sont rediriges
# pour detacher completement le processus (sinon il retient les
# descripteurs herites et peut bloquer l'entrypoint).
watch_settings "$ENV_SNAPSHOT" </dev/null >/proc/1/fd/1 2>/proc/1/fd/2 &
disown 2>/dev/null || true
