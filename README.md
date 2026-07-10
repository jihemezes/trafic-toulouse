# City Road Traffic

Carte plein écran du trafic routier en temps réel — agglomération toulousaine par défaut, toute autre ville sélectionnable par nom ou code postal. Conçue pour l'auto-hébergement (Docker / Umbrel sur Raspberry Pi).

Fonctionnalités : flux trafic TomTom rafraîchi automatiquement (intervalle réglable) ; **bouchons visibles en permanence** — coloration des axes par le flux **et** tracé cliquable de chaque bouchon avec retard estimé, indépendamment de la couche incidents ; autres incidents (travaux, fermetures, accidents) affichables à la demande avec fiche détaillée en français ; bascule jour/nuit automatique calée sur le lever/coucher du soleil (calcul astronomique local, sans appel réseau) ; interface disponible en français et anglais (choix dans les Paramètres, ou dès l'écran de première configuration — français par défaut) ; panneau de paramètres complet avec persistance des réglages dans le navigateur.

## Prérequis : clé API TomTom (gratuite)

1. Créer un compte sur <https://developer.tomtom.com>
2. Dans **My Dashboard**, copier la clé API. Le palier gratuit (~50 000 tuiles/jour + 2 500 requêtes API/jour) couvre très largement un usage personnel.

## Arborescence

```
.
├── site/                     # le site statique
│   ├── index.html
│   ├── app.js
│   └── config.js.template    # gabarit → config.js généré au démarrage du conteneur
├── docker/
│   ├── 20-generate-config.sh # hook nginx : env → config.js
│   └── default.conf          # nginx (no-store sur config.js)
├── Dockerfile                # nginx:alpine, multi-arch
├── docker-compose.yml        # test standalone
├── .env.example
├── .github/workflows/docker-publish.yml   # build+push ghcr.io (amd64+arm64)
└── umbrel-community-app-store/            # à publier dans un dépôt séparé
    ├── umbrel-app-store.yml
    └── ezes-trafic-toulouse/
        ├── umbrel-app.yml
        └── docker-compose.yml
```

## 1. Test local (Mac / PC, sans Docker)

```bash
cd site
cp config.js.template config.js   # puis remplacer les ${...} à la main
python3 -m http.server 8080       # http://localhost:8080
```

(Plus simple : réutiliser le `config.js` de développement déjà renseigné.)

## 2. Test du conteneur (Mac / Synology)

```bash
cp .env.example .env              # renseigner TOMTOM_API_KEY
docker compose up -d --build
open http://localhost:8480
```

Toute la configuration passe par les variables d'environnement — changer un réglage = éditer `.env` puis `docker compose up -d` (pas de rebuild) :

| Variable | Défaut | Rôle |
|---|---|---|
| `TOMTOM_API_KEY` | — (**requis**) | Clé TomTom |
| `MAP_LAT` / `MAP_LON` | 43.6045 / 1.4442 | Centre par défaut (Capitole) |
| `MAP_ZOOM` | 12 | Zoom initial |
| `REFRESH_INTERVAL_S` | 60 | Intervalle de rafraîchissement (min. 30) |
| `TRAFFIC_STYLE` | relative0 | Style du flux |
| `FLOW_THICKNESS` | 7 | Épaisseur des tronçons (1-20) |
| `SHOW_INCIDENTS` | false | Autres incidents (travaux, fermetures) au démarrage |
| `SHOW_JAMS` | true | Bouchons toujours affichés (tracés cliquables) |
| `CITY_LABEL` | Toulouse | Nom affiché |

Ces valeurs sont les **défauts serveur** ; chaque navigateur peut ensuite les surcharger via le panneau Paramètres (persisté en localStorage).

## 2bis. Modifier les réglages sans toucher au compose (fichier `data/settings.env`)

Une fois le conteneur démarré, un dossier `data/` apparaît à côté de `config.js` (monté depuis `./data` en standalone, ou visible dans **Umbrel → Files → Applications → City Road Traffic → data** sur umbrelOS). Il contient un fichier `settings.env`, créé automatiquement avec un modèle commenté si absent.

Éditer ce fichier — au choix avec un éditeur de texte local, en SSH, ou **directement dans le gestionnaire de fichiers Umbrel** — et l'enregistrer suffit : une boucle de surveillance à l'intérieur du conteneur détecte la modification en quelques secondes et régénère `config.js` toute seule. Il suffit de recharger la page du navigateur pour voir le changement ; **aucun redémarrage de l'application n'est nécessaire**.

Ordre de priorité : `data/settings.env` > variables d'environnement du compose > défauts intégrés. Une ligne vide ou absente dans `settings.env` laisse la valeur du compose (ou le défaut) inchangée.

C'est la méthode recommandée pour ajuster `MAP_ZOOM`, `CITY_LABEL`, `REFRESH_INTERVAL_S`, etc. au jour le jour sans SSH ; le compose reste la référence pour la configuration initiale et pour `TOMTOM_API_KEY` si vous préférez ne pas la stocker en clair dans un fichier écrit par le conteneur (dans ce cas, laissez-la vide dans `settings.env` et renseignez-la seulement dans le compose, ou via le navigateur à la première visite).

## 3. Publication de l'image (GitHub → ghcr.io)

Umbrel ne construit pas les images : il les tire d'un registre. Le workflow fourni s'en charge.

1. Créer un dépôt GitHub `trafic-toulouse` et y pousser ce contenu.
2. Le workflow `docker-publish` se déclenche sur `main` : il construit l'image **amd64 + arm64** (Raspberry Pi 4) et la pousse sur `ghcr.io/<compte>/trafic-toulouse:latest`. Aucun secret à configurer, `GITHUB_TOKEN` suffit.
3. Rendre le paquet public : GitHub → profil → *Packages* → `trafic-toulouse` → *Package settings* → *Change visibility* → **Public** (sinon Umbrel ne pourra pas tirer l'image).
4. Pour figer une version : `git tag v1.0.0 && git push --tags` → image `ghcr.io/<compte>/trafic-toulouse:1.0.0`.

## 4. Installation sur Umbrel (community app store)

1. Créer un **second** dépôt GitHub public, p. ex. `ezes-umbrel-store`, contenant le contenu du dossier `umbrel-community-app-store/` (à la racine du dépôt : `umbrel-app-store.yml` + le dossier `ezes-trafic-toulouse/`).
2. Dans `ezes-trafic-toulouse/docker-compose.yml` : remplacer `VOTRE_COMPTE` par le compte GitHub et **coller la clé TomTom** dans `TOMTOM_API_KEY`. Même chose pour les URL de `umbrel-app.yml`. (Le dépôt du store peut rester public sans exposer la clé : mettre ce dépôt en **privé** n'est pas supporté par Umbrel, donc si la clé ne doit pas être visible, la laisser vide ici et l'ajouter après installation — voir note ci-dessous.)
3. Sur umbrelOS : **App Store → ⋯ (menu) → Community App Stores → coller l'URL du dépôt** (`https://github.com/<compte>/ezes-umbrel-store`) → *Add*.
4. Ouvrir le store ajouté et installer **City Road Traffic**. L'app est servie sur le port **8480** du Umbrel : `http://umbrel.local:8480`.

> **Clé API côté serveur (optionnel)** : depuis que la clé peut être saisie à la première visite dans le navigateur, `TOMTOM_API_KEY` peut rester vide partout. Pour renseigner malgré tout une clé côté serveur — partagée par tous les appareils du foyer — suivre le guide pas à pas [docs/UMBREL-CLE-API.md](docs/UMBREL-CLE-API.md) (édition du compose en SSH, redémarrage correct de l'app, vérifications). Pensez aussi à restreindre la clé par domaine/IP dans le dashboard TomTom.

## Mise à jour de l'app

Pousser les changements sur `main` (nouvelle image `:latest`), puis sur Umbrel : désinstaller/réinstaller l'app, ou `docker pull` + redémarrage de l'app en SSH. Pour un cycle propre, utiliser des tags de version et les référencer dans le compose du store.

## Feuille de route

- ~~Saisie de la clé API à la première visite~~ — fait : la clé peut être saisie dans le navigateur (localStorage), `TOMTOM_API_KEY` devient optionnelle
- Publication éventuelle sur le store communautaire officiel Umbrel

## Licence & données

Code : MIT. Fonds de carte © OpenStreetMap contributors / CARTO. Données trafic © TomTom (soumises aux CGU de leur offre développeur).
