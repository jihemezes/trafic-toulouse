# Modifier les réglages côté serveur (Umbrel)

Deux méthodes, selon ce que vous voulez faire :

- **Réglages courants** (zoom, ville, intervalle, style du flux, clé API…) → fichier `data/settings.env`, éditable dans le gestionnaire de fichiers Umbrel, **sans SSH ni redémarrage**. C'est la méthode recommandée, décrite en premier ci-dessous.
- **Cas particuliers** (déboguer une valeur qui ne semble pas prise en compte, modifier le compose lui-même) → SSH, décrit en second.

> Rappel de la priorité appliquée par l'application pour la clé API :
> **clé du navigateur** (localStorage) > **`data/settings.env`** > **variable du docker-compose.yml** > écran de saisie.
> Un navigateur qui a déjà enregistré sa propre clé continuera de l'utiliser
> (Paramètres → Clé API TomTom → *Revenir à la clé du serveur* pour l'effacer).

## Méthode recommandée : `data/settings.env` (interface graphique)

Une fois l'application installée :

1. Sur umbrelOS, ouvrir l'app **Files** → **Applications** → **City Road Traffic** (ou `ezes-trafic-toulouse`) → dossier **data**.
2. Ouvrir le fichier **`settings.env`** (créé automatiquement au premier démarrage, avec un modèle commenté en français listant tous les réglages disponibles : `TOMTOM_API_KEY`, `MAP_LAT`, `MAP_LON`, `MAP_ZOOM`, `REFRESH_INTERVAL_S`, `TRAFFIC_STYLE`, `FLOW_THICKNESS`, `SHOW_INCIDENTS`, `SHOW_JAMS`, `CITY_LABEL`).
3. Modifier la ou les valeurs voulues, par exemple :
   ```
   MAP_ZOOM=14
   CITY_LABEL=Bordeaux
   ```
4. Enregistrer.

C'est tout : une boucle de surveillance à l'intérieur du conteneur détecte la modification en quelques secondes et régénère la configuration automatiquement. Recharger la page de la carte (`http://umbrel.local:8480`) pour voir le changement. **Aucun redémarrage de l'application n'est nécessaire.**

Une ligne laissée vide (`TOMTOM_API_KEY=` par exemple) signifie « ne pas surcharger » — la valeur du `docker-compose.yml` ou le défaut intégré s'applique alors.

### Vérifier que la modification a bien été prise en compte

Panneau **Paramètres → Clé API TomTom** dans l'application : la source doit indiquer **« le serveur »**. Pour les autres réglages, la valeur affichée sur la carte (zoom, ville dans le panneau d'état) est la vérification la plus directe.

### Limite à connaître

Le dossier `data/` est propre à l'installation de l'app — il **survit** aux mises à jour de l'image Docker (contrairement au `docker-compose.yml` du store, re-copié à chaque mise à jour). C'est donc l'endroit le plus stable pour les réglages qui doivent persister dans la durée.

---

## Méthode alternative : SSH (dépannage ou modification du compose)

Utile si `data/settings.env` n'existe pas encore (app pas encore démarrée une première fois), si le dossier `data` n'apparaît pas dans Files, ou pour modifier des éléments qui ne sont pas des réglages applicatifs (le compose lui-même, par exemple pour changer le port exposé).

### 1. Se connecter en SSH

```bash
ssh umbrel@umbrel.local
```

Mot de passe : celui de l'interface web Umbrel. Si `umbrel.local` ne répond pas, utiliser l'adresse IP du Pi.

### 2. Vérifier ou éditer `settings.env` directement

```bash
cat ~/umbrel/app-data/ezes-trafic-toulouse/data/settings.env
nano ~/umbrel/app-data/ezes-trafic-toulouse/data/settings.env
```

Enregistrer et quitter nano : `Ctrl+O`, `Entrée`, `Ctrl+X`. Le changement est repris automatiquement en quelques secondes, comme via l'interface graphique — pas besoin de redémarrer.

### 3. Modifier le docker-compose.yml (cas particuliers uniquement)

```bash
nano ~/umbrel/app-data/ezes-trafic-toulouse/docker-compose.yml
```

⚠️ Contrairement à `settings.env`, une modification ici **nécessite un vrai redémarrage** de l'application (pas un simple `docker restart`, qui ne relit pas les variables d'environnement) :

- **Interface web** : clic droit sur l'icône *City Road Traffic* → **Restart**.
- **Terminal** : `umbreld client apps.restart.mutate --appId ezes-trafic-toulouse`

### 4. Vérifier dans les logs

```bash
docker logs ezes-trafic-toulouse_web_1 2>&1 | grep trafic
```

Attendu :

```
[trafic] config.js genere (ville: Toulouse, zoom: 12, refresh: 60s)
```

Si la ligne « Pas de cle serveur » apparaît alors qu'une clé a été renseignée, vérifier l'absence de faute de frappe dans le nom de la variable et que le fichier a bien été enregistré.

## Persistance de la clé API en cas de réinstallation complète

`data/` survit aux mises à jour normales de l'app, mais une **désinstallation** complète depuis Umbrel supprime ce dossier avec le reste des données de l'app. Pour une clé qui doit survivre même à une désinstallation/réinstallation totale, deux options :

- La saisir à nouveau après réinstallation (30 secondes, dans le navigateur ou dans `settings.env`).
- La committer dans **le dépôt GitHub du store** (`ezes-trafic-toulouse/docker-compose.yml`), auquel cas toute nouvelle installation repart avec elle. Contrepartie : la clé est alors visible dans un dépôt public — pensez à la restreindre par domaine/IP dans le dashboard TomTom.
