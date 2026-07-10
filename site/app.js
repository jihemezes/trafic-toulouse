/* ============================================================
   Trafic Toulouse — application
   Fond de carte : CARTO (données OpenStreetMap)
   Trafic       : TomTom Traffic Flow + Incidents (raster tiles)
                  + TomTom Incident Details (JSON) pour les popups
   Jour/nuit    : calcul solaire NOAA local (aucun appel réseau)
   Paramètres   : config.js = défauts, localStorage = utilisateur
   ============================================================ */
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const STORAGE_KEY = "trafic.settings.v2";
  const KEY_STORE = "trafic.apikey.v1";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // ============================================================
  // Internationalisation (francais par defaut, anglais disponible)
  // ============================================================
  const LANG_KEY = "trafic.lang.v1";
  function getLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      return (v === "en" || v === "fr") ? v : "fr";
    } catch { return "fr"; }
  }
  function setLangStorage(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch { /* navigation privee */ }
  }
  let currentLang = getLang();
  let appIsRunning = false;
  let refreshDynamicTexts = () => {}; // reassignee reellement dans startApp()

  const I18N = {
    fr: {
      mapAriaLabel: "Carte du trafic routier",
      settingsAriaLabel: "Param\u00e8tres d'affichage",
      lastUpdate: "Derni\u00e8re mise \u00e0 jour",
      nextIn: "Prochaine dans",
      legendFree: "Fluide",
      legendJam: "Bloqu\u00e9",
      hudToggleLabel: "Afficher ou masquer le panneau",
      pause: "Pause",
      resume: "Reprendre",
      paused: "en pause",
      settingsBtn: "Param\u00e8tres",
      settingsTitle: "Param\u00e8tres",
      close: "Fermer",
      settingsHint: "R\u00e9glages enregistr\u00e9s dans ce navigateur. Appliqu\u00e9s imm\u00e9diatement.",
      langLegend: "Langue",
      cityLegend: "Ville",
      cityShown: "Affich\u00e9e :",
      cityPlaceholder: "Nom de ville ou code postal\u2026",
      cityResetPrefix: "Revenir \u00e0 ",
      mapLegend: "Carte",
      basemapLabel: "Fond de carte",
      basemapAuto: "Auto jour / nuit (soleil)",
      basemapDark: "Sombre",
      basemapLight: "Clair",
      basemapVoyager: "Voyager (routier)",
      dayStyleLabel: "Fond utilis\u00e9 le jour (mode auto)",
      flowLegend: "Flux trafic",
      flowStyleLabel: "Style de coloration",
      flowRelative: "Relatif \u2014 \u00e9cart \u00e0 la vitesse normale",
      flowRelativeDark: "Relatif sombre \u2014 pour fond sombre",
      flowAbsolute: "Absolu \u2014 vitesse r\u00e9elle",
      flowDelay: "Retard seul \u2014 masque le fluide",
      flowReduced: "Sensibilit\u00e9 r\u00e9duite \u2014 gros bouchons seulement",
      thicknessLabel: "\u00c9paisseur des tron\u00e7ons",
      opacityLabel: "Opacit\u00e9",
      jamsLegend: "Bouchons et incidents",
      jamsLabel: 'Bouchons toujours affich\u00e9s<br><span style="color:var(--text-dim);font-size:11px">trac\u00e9s cliquables avec retard estim\u00e9</span>',
      incidentsLabel: 'Autres incidents<br><span style="color:var(--text-dim);font-size:11px">travaux, fermetures, accidents\u2026</span>',
      incidentDetailsLabel: "Infos au survol / clic",
      incidentStyleLabel: "Style des ic\u00f4nes",
      incStyleS0: "s0 \u2014 lignes seules, sans ic\u00f4nes",
      incStyleS1: "s1 \u2014 ic\u00f4nes discr\u00e8tes",
      incStyleS2: "s2 \u2014 ic\u00f4nes moyennes",
      incStyleS3: "s3 \u2014 ic\u00f4nes d\u00e9taill\u00e9es (chevrons)",
      incStyleNight: "night \u2014 adapt\u00e9 au fond sombre",
      refreshLegend: "Rafra\u00eechissement",
      refreshLabel: "Intervalle",
      refresh30: "30 secondes",
      refresh60: "60 secondes (recommand\u00e9)",
      refresh120: "2 minutes",
      refresh300: "5 minutes",
      apiKeyLegend: "Cl\u00e9 API TomTom",
      keySourceLabel: "Source :",
      keySourceBrowser: "ce navigateur",
      keySourceServer: "le serveur",
      keyChangeBtn: "Modifier la cl\u00e9\u2026",
      keyClearBtn: "Revenir \u00e0 la cl\u00e9 du serveur",
      settingsReset: "R\u00e9initialiser les valeurs par d\u00e9faut",
      setupTitle: "Cl\u00e9 API TomTom requise",
      setupIntro: "La carte du trafic utilise les tuiles TomTom Traffic. Une cl\u00e9 gratuite suffit largement pour un usage personnel.",
      setupStep1: 'Cr\u00e9er un compte sur <a href="https://developer.tomtom.com" target="_blank" rel="noopener">developer.tomtom.com</a>',
      setupStep2: "Copier la cl\u00e9 depuis <em>My Dashboard</em>",
      setupStep3: "La coller ci-dessous \u2014 elle sera enregistr\u00e9e dans ce navigateur",
      setupPlaceholder: "Coller la cl\u00e9 API ici",
      setupSave: "Enregistrer",
      setupCancel: "Annuler",
      keyTooShort: "Cl\u00e9 trop courte \u2014 v\u00e9rifier la copie.",
      keyChecking: "V\u00e9rification de la cl\u00e9 aupr\u00e8s de TomTom\u2026",
      keyRejected: "Cl\u00e9 refus\u00e9e par TomTom. V\u00e9rifier la copie \u2014 et noter qu'une cl\u00e9 fra\u00eechement cr\u00e9\u00e9e peut mettre quelques minutes \u00e0 s'activer.",
      keyStorageError: "Impossible d'enregistrer (navigation priv\u00e9e ?).",
      citySearching: "Recherche\u2026",
      cityNoResults: "Aucun r\u00e9sultat",
      cityError: "Erreur de recherche \u2014 r\u00e9essayer",
      tomtomLang: "fr-FR",
      localeCode: "fr-FR",
      category: {0:"Incident",1:"Accident",2:"Brouillard",3:"Conditions dangereuses",4:"Pluie",5:"Verglas",6:"Embouteillage",7:"Voie ferm\u00e9e",8:"Route ferm\u00e9e",9:"Travaux",10:"Vent fort",11:"Inondation",14:"V\u00e9hicule en panne"},
      magnitude: {0:"l\u00e9ger",1:"mineur",2:"mod\u00e9r\u00e9",3:"majeur",4:"s\u00e9v\u00e8re"},
      jamWord: "Embouteillage",
      popupFromTo: (from,to) => `De <b>${from}</b> \u00e0 <b>${to}</b>`,
      popupDelay: (min,sev) => `Retard estim\u00e9 : <b>+${min} min</b>${sev ? " (" + sev + ")" : ""}`,
      popupClosed: "<b>Axe coup\u00e9</b>",
    },
    en: {
      mapAriaLabel: "Road traffic map",
      settingsAriaLabel: "Display settings",
      lastUpdate: "Last update",
      nextIn: "Next in",
      legendFree: "Free-flowing",
      legendJam: "Jammed",
      hudToggleLabel: "Show or hide panel",
      pause: "Pause",
      resume: "Resume",
      paused: "paused",
      settingsBtn: "Settings",
      settingsTitle: "Settings",
      close: "Close",
      settingsHint: "Settings saved in this browser. Applied immediately.",
      langLegend: "Language",
      cityLegend: "City",
      cityShown: "Shown:",
      cityPlaceholder: "City name or postal code\u2026",
      cityResetPrefix: "Back to ",
      mapLegend: "Map",
      basemapLabel: "Base map",
      basemapAuto: "Auto day / night (sun)",
      basemapDark: "Dark",
      basemapLight: "Light",
      basemapVoyager: "Voyager (roads)",
      dayStyleLabel: "Daytime base map (auto mode)",
      flowLegend: "Traffic flow",
      flowStyleLabel: "Coloring style",
      flowRelative: "Relative \u2014 deviation from normal speed",
      flowRelativeDark: "Relative dark \u2014 for dark base map",
      flowAbsolute: "Absolute \u2014 actual speed",
      flowDelay: "Delay only \u2014 hides free-flow",
      flowReduced: "Reduced sensitivity \u2014 major jams only",
      thicknessLabel: "Segment thickness",
      opacityLabel: "Opacity",
      jamsLegend: "Jams \u0026 incidents",
      jamsLabel: 'Jams always shown<br><span style="color:var(--text-dim);font-size:11px">clickable traces with estimated delay</span>',
      incidentsLabel: 'Other incidents<br><span style="color:var(--text-dim);font-size:11px">roadworks, closures, accidents\u2026</span>',
      incidentDetailsLabel: "Hover / click info",
      incidentStyleLabel: "Icon style",
      incStyleS0: "s0 \u2014 lines only, no icons",
      incStyleS1: "s1 \u2014 subtle icons",
      incStyleS2: "s2 \u2014 medium icons",
      incStyleS3: "s3 \u2014 detailed icons (chevrons)",
      incStyleNight: "night \u2014 for dark base map",
      refreshLegend: "Refresh",
      refreshLabel: "Interval",
      refresh30: "30 seconds",
      refresh60: "60 seconds (recommended)",
      refresh120: "2 minutes",
      refresh300: "5 minutes",
      apiKeyLegend: "TomTom API key",
      keySourceLabel: "Source:",
      keySourceBrowser: "this browser",
      keySourceServer: "the server",
      keyChangeBtn: "Change key\u2026",
      keyClearBtn: "Revert to server key",
      settingsReset: "Reset to defaults",
      setupTitle: "TomTom API key required",
      setupIntro: "The traffic map uses TomTom Traffic tiles. A free key is more than enough for personal use.",
      setupStep1: 'Create an account at <a href="https://developer.tomtom.com" target="_blank" rel="noopener">developer.tomtom.com</a>',
      setupStep2: "Copy the key from <em>My Dashboard</em>",
      setupStep3: "Paste it below \u2014 it will be saved in this browser",
      setupPlaceholder: "Paste API key here",
      setupSave: "Save",
      setupCancel: "Cancel",
      keyTooShort: "Key too short \u2014 check what you copied.",
      keyChecking: "Checking the key with TomTom\u2026",
      keyRejected: "Key rejected by TomTom. Check what you copied \u2014 a freshly created key can take a few minutes to activate.",
      keyStorageError: "Could not save (private browsing?).",
      citySearching: "Searching\u2026",
      cityNoResults: "No results",
      cityError: "Search error \u2014 try again",
      tomtomLang: "en-US",
      localeCode: "en-GB",
      category: {0:"Incident",1:"Accident",2:"Fog",3:"Hazardous conditions",4:"Rain",5:"Ice",6:"Traffic jam",7:"Lane closed",8:"Road closed",9:"Roadworks",10:"Strong wind",11:"Flooding",14:"Broken-down vehicle"},
      magnitude: {0:"light",1:"minor",2:"moderate",3:"major",4:"severe"},
      jamWord: "Traffic jam",
      popupFromTo: (from,to) => `From <b>${from}</b> to <b>${to}</b>`,
      popupDelay: (min,sev) => `Estimated delay: <b>+${min} min</b>${sev ? " (" + sev + ")" : ""}`,
      popupClosed: "<b>Road closed</b>",
    },
  };

  function applyI18n(lang) {
    const dict = I18N[lang] || I18N.fr;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key] !== undefined) el.placeholder = dict[key];
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (dict[key] !== undefined) el.setAttribute("aria-label", dict[key]);
    });
  }

  function changeLang(l) {
    if (l !== "fr" && l !== "en") return;
    currentLang = l;
    setLangStorage(l);
    applyI18n(l);
    const a = document.getElementById("setupLang");
    const b = document.getElementById("setLang");
    if (a) a.value = l;
    if (b) b.value = l;
    if (appIsRunning) refreshDynamicTexts();
  }

  applyI18n(currentLang);
  const setupLangEl0 = document.getElementById("setupLang");
  if (setupLangEl0) {
    setupLangEl0.value = currentLang;
    setupLangEl0.addEventListener("change", () => changeLang(setupLangEl0.value));
  }

  // ============================================================
  // Clé API : celle enregistrée dans le navigateur PRIME sur
  // celle fournie par le serveur (config.js / variables Docker).
  // ============================================================
  const cfgKey = (cfg.TOMTOM_API_KEY || "").trim();
  const cfgKeyValid = !!cfgKey && !/REMPLACER|COLLER/i.test(cfgKey);
  const getStoredKey = () => {
    try { return (localStorage.getItem(KEY_STORE) || "").trim(); } catch { return ""; }
  };

  const setupEl = $("setup");
  const keyInput = $("apiKeyInput");
  const keyMsg = $("apiKeyMsg");

  function showSetup(cancellable) {
    $("apiKeyCancel").hidden = !cancellable;
    keyMsg.textContent = "";
    keyInput.value = "";
    setupEl.hidden = false;
    keyInput.focus();
  }

  // Mini-requête Incident Details sur une bbox minuscule : réponse 200 = clé valide
  async function validateKey(k) {
    try {
      const u = "https://api.tomtom.com/traffic/services/5/incidentDetails" +
        "?key=" + encodeURIComponent(k) +
        "&bbox=1.44,43.60,1.45,43.61" +
        "&fields=" + encodeURIComponent("{incidents{type}}");
      const r = await fetch(u);
      return r.ok;
    } catch { return false; }
  }

  async function saveKey() {
    const k = keyInput.value.trim();
    if (k.length < 10) { keyMsg.textContent = I18N[currentLang].keyTooShort; return; }
    keyMsg.textContent = I18N[currentLang].keyChecking;
    const ok = await validateKey(k);
    if (!ok) {
      keyMsg.textContent = I18N[currentLang].keyRejected;
      return;
    }
    try { localStorage.setItem(KEY_STORE, k); } catch {
      keyMsg.textContent = I18N[currentLang].keyStorageError;
      return;
    }
    location.reload();
  }

  $("apiKeySave").addEventListener("click", saveKey);
  keyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveKey(); });
  $("apiKeyCancel").addEventListener("click", () => { setupEl.hidden = true; });

  // ============================================================
  // Application
  // ============================================================
  function startApp(API_KEY) {

  setupEl.hidden = true;
  $("hud").hidden = false;
  appIsRunning = true;

  // ---- Panneau repliable (utile en petit écran / mobile) ----
  const HUD_COLLAPSE_KEY = "trafic.hudCollapsed.v1";
  const hudToggle = $("hudToggle");
  const hudBody = $("hudBody");
  function getHudCollapsed() {
    try { return localStorage.getItem(HUD_COLLAPSE_KEY) === "1"; } catch { return false; }
  }
  function setHudCollapsed(collapsed) {
    hudBody.hidden = collapsed;
    hudToggle.setAttribute("aria-expanded", String(!collapsed));
    try { localStorage.setItem(HUD_COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* navigation privée */ }
  }
  hudToggle.addEventListener("click", () => setHudCollapsed(!hudBody.hidden));
  setHudCollapsed(getHudCollapsed());

  // Ville par défaut (config.js) ; la ville choisie est stockée dans les réglages
  const DEFAULT_CITY = {
    label: cfg.CITY_LABEL || "Toulouse",
    lat: cfg.MAP_LAT || 43.6045,
    lon: cfg.MAP_LON || 1.4442,
  };
  function activeCity() {
    return (typeof settings !== "undefined" && settings.city) ? settings.city : DEFAULT_CITY;
  }

  // ============================================================
  // Calcul solaire (algorithme NOAA, portage compact de SunCalc)
  // ============================================================
  const SunCalc = (function () {
    const rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
    const e = rad * 23.4397; // obliquité de l'écliptique
    const toJulian = (d) => d.valueOf() / dayMs - 0.5 + J1970;
    const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
    const toDays = (d) => toJulian(d) - J2000;
    const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
    const eclipticLongitude = (M) =>
      M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
    const declination = (L) => Math.asin(Math.sin(L) * Math.sin(e));
    const julianCycle = (d, lw) => Math.round(d - 0.0009 - lw / (2 * Math.PI));
    const approxTransit = (Ht, lw, n) => 0.0009 + (Ht + lw) / (2 * Math.PI) + n;
    const solarTransitJ = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    const hourAngle = (h, phi, dec) =>
      Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

    // h0 = -0.833° : horizon corrigé de la réfraction (définition officielle lever/coucher)
    function getTimes(date, lat, lon) {
      const lw = rad * -lon, phi = rad * lat;
      const d = toDays(date);
      const n = julianCycle(d, lw);
      const ds = approxTransit(0, lw, n);
      const M = solarMeanAnomaly(ds);
      const L = eclipticLongitude(M);
      const dec = declination(L);
      const Jnoon = solarTransitJ(ds, M, L);
      const w = hourAngle(rad * -0.833, phi, dec);
      if (isNaN(w)) return null; // jour/nuit polaire — non applicable à Toulouse
      const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
      const Jrise = Jnoon - (Jset - Jnoon);
      return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
    }
    return { getTimes };
  })();

  function isDaytime(now) {
    const c = activeCity();
    const t = SunCalc.getTimes(now, c.lat, c.lon);
    if (!t) return true;
    return now >= t.sunrise && now < t.sunset;
  }

  // ============================================================
  // Paramètres : défauts (config.js) + surcharge utilisateur
  // ============================================================
  const DEFAULTS = {
    city: null,                                           // null = ville de config.js
    basemap: "auto",                                      // auto | dark | light | voyager
    dayStyle: "voyager",                                  // fond utilisé le jour en mode auto
    flowStyle: cfg.TRAFFIC_STYLE || "relative0",
    thickness: clamp(Number(cfg.FLOW_THICKNESS) || 7, 1, 20),
    flowOpacity: 85,
    incidents: cfg.SHOW_INCIDENTS === true,
    incidentDetails: true,
    jams: cfg.SHOW_JAMS !== false,   // bouchons toujours visibles (tracés cliquables)
    incidentStyle: "s1",
    incidentOpacity: 90,
    refreshS: Math.max(30, Number(cfg.REFRESH_INTERVAL_S) || 60),
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { return { ...DEFAULTS }; }
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* mode privé */ }
  }
  let settings = loadSettings();

  // ============================================================
  // Carte et couches
  // ============================================================
  const map = L.map("map", {
    center: [activeCity().lat, activeCity().lon],
    zoom: cfg.MAP_ZOOM || 12,
    zoomControl: true,
  });
  map.zoomControl.setPosition("bottomright");

  const BASEMAPS = {
    dark:    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    light:   "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    voyager: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  };
  const ATTRIB =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a> · Trafic &copy; TomTom';

  let cacheBust = Date.now();
  let baseLayer = null, flowLayer = null, incidentLayer = null;
  let currentBasemapKey = null;

  const statusDot = $("statusDot");
  let tileErrors = 0;

  function resolveBasemapKey() {
    if (settings.basemap !== "auto") return settings.basemap;
    return isDaytime(new Date()) ? settings.dayStyle : "dark";
  }

  // Le panneau n'affiche plus les heures de lever/coucher (gain de place
  // sur mobile) ; le calcul solaire reste utilisé ailleurs (isDaytime)
  // pour la bascule automatique jour/nuit du fond de carte.
  function updateSunRow() {}

  function buildBaseLayer(force) {
    const key = resolveBasemapKey();
    if (!force && key === currentBasemapKey) return;
    currentBasemapKey = key;
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(BASEMAPS[key] || BASEMAPS.dark, {
      maxZoom: 19, attribution: ATTRIB,
    }).addTo(map);
    if (baseLayer.bringToBack) baseLayer.bringToBack();
    updateSunRow();
  }

  function buildFlowLayer() {
    if (flowLayer) map.removeLayer(flowLayer);
    flowLayer = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/${settings.flowStyle}/{z}/{x}/{y}.png` +
      `?key=${API_KEY}&thickness=${settings.thickness}&ts={ts}`,
      { maxZoom: 19, opacity: settings.flowOpacity / 100, ts: () => cacheBust }
    ).addTo(map);
    flowLayer.on("tileerror", () => {
      tileErrors++;
      if (tileErrors >= 3) statusDot.className = "dot error";
    });
    flowLayer.on("tileload", () => {
      tileErrors = 0;
      if (!paused) statusDot.className = "dot";
    });
  }

  function buildIncidentLayer() {
    if (incidentLayer) { map.removeLayer(incidentLayer); incidentLayer = null; }
    if (settings.incidents) {
      incidentLayer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/incidents/${settings.incidentStyle}/{z}/{x}/{y}.png` +
        `?key=${API_KEY}&ts={ts}`,
        { maxZoom: 19, opacity: settings.incidentOpacity / 100, ts: () => cacheBust }
      ).addTo(map);
    }
    fetchIncidentDetails();
  }

  // ============================================================
  // Détails des incidents (API TomTom Incident Details, JSON)
  // ============================================================
  const incidentMarkers = L.layerGroup().addTo(map);
  const jamsLayer = L.layerGroup().addTo(map);   // bouchons : toujours au-dessus du flux
  let incidentsAbort = null;

  function clearIncidentMarkers() { incidentMarkers.clearLayers(); }

  // Couleur d'un bouchon selon sa gravité TomTom (magnitudeOfDelay) :
  // 0 inconnu, 1 mineur, 2 modere, 3 majeur, 4 indetermine/route coupee.
  // Degrade complet jaune -> orange -> rouge -> rouge fonce ; le jaune
  // sert aussi de repli neutre (au lieu du rouge, qui exagererait un
  // bouchon dont la gravite n'est simplement pas connue).
  const JAM_COLORS = {
    0: "#f5c542",  // inconnu -> jaune
    1: "#f5c542",  // mineur  -> jaune
    2: "#f5a623",  // modere  -> orange
    3: "#e2493b",  // majeur  -> rouge
    4: "#8b1e14",  // route coupee -> rouge fonce
  };
  const JAM_COLOR_DEFAULT = "#f5c542"; // repli neutre = jaune, jamais rouge par defaut

  function jamLine(geometry, color, popupHtml, tooltip) {
    if (!geometry) return null;
    if (geometry.type === "LineString" && geometry.coordinates.length > 1) {
      const latlngs = geometry.coordinates.map((c) => [c[1], c[0]]);
      return L.polyline(latlngs, { color, weight: 7, opacity: 0.9, lineCap: "round" })
        .bindTooltip(tooltip, { className: "incident-tip", sticky: true })
        .bindPopup(popupHtml, { maxWidth: 280 });
    }
    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates;
      return L.circleMarker([lat, lon], { radius: 6, weight: 1.5, color: "rgba(255,255,255,0.6)", fillColor: color, fillOpacity: 0.85 })
        .bindTooltip(tooltip, { className: "incident-tip", direction: "top", offset: [0, -8] })
        .bindPopup(popupHtml, { maxWidth: 280 });
    }
    return null;
  }

  // Style adapté au zoom : quasi invisible en vue d'ensemble (≤12),
  // ne prend de la présence qu'en zoomant sur un secteur.
  function markerStyle(iconCategory) {
    const z = map.getZoom();
    const radius = z <= 12 ? 1 : clamp((z - 11) * 2, 2, 12);  // z≤12→1, z13→4, z14→6, z16→10
    const near = z >= 14;
    return {
      radius,
      weight: near ? 1.5 : 0.5,
      color: near ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.20)",
      fillColor: iconCategory === 8 ? "#8b1e14" : "#f5a623",
      fillOpacity: near ? 0.30 : 0.10,
    };
  }
  map.on("zoomend", () => {
    incidentMarkers.eachLayer((m) => {
      if (m.setStyle) m.setStyle(markerStyle(m._iconCategory));
    });
  });

  function incidentAnchor(geometry) {
    // Point médian d'une LineString, ou le point lui-même
    if (!geometry || !geometry.coordinates) return null;
    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates;
      return [lat, lon];
    }
    if (geometry.type === "LineString" && geometry.coordinates.length) {
      const c = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
      return [c[1], c[0]];
    }
    return null;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function incidentPopupHtml(p) {
    const dict = I18N[currentLang];
    const cat = dict.category[p.iconCategory] || dict.category[0];
    const descs = (p.events || []).map((e) => e.description).filter(Boolean);
    const desc = descs.length ? descs.join(" · ") : cat;
    const roads = (p.roadNumbers || []).join(", ");
    const delayMin = p.delay ? Math.round(p.delay / 60) : 0;
    const mag = dict.magnitude[p.magnitudeOfDelay];

    let html = '<div class="incident-popup">';
    html += `<h3><span class="cat c${p.iconCategory}"></span>${esc(cat)}${roads ? " — " + esc(roads) : ""}</h3>`;
    html += `<p class="desc">${esc(desc)}</p>`;
    const meta = [];
    if (p.from && p.to) meta.push(dict.popupFromTo(esc(p.from), esc(p.to)));
    if (delayMin > 0) meta.push(dict.popupDelay(delayMin, mag));
    else if (p.iconCategory === 8) meta.push(dict.popupClosed);
    if (meta.length) html += `<p class="meta">${meta.join("<br>")}</p>`;
    html += "</div>";
    return html;
  }

  async function fetchIncidentDetails() {
    const wantJams = settings.jams;
    const wantOthers = settings.incidents && settings.incidentDetails;
    if (!wantJams && !wantOthers) { clearIncidentMarkers(); jamsLayer.clearLayers(); return; }
    if (map.getZoom() < 10) { clearIncidentMarkers(); jamsLayer.clearLayers(); return; } // zone trop vaste

    if (incidentsAbort) incidentsAbort.abort();
    incidentsAbort = new AbortController();

    const b = map.getBounds();
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      .map((v) => v.toFixed(5)).join(",");
    const fields = "{incidents{type,geometry{type,coordinates},properties{" +
      "iconCategory,magnitudeOfDelay,delay,from,to,roadNumbers,events{description,iconCategory}}}}";
    const url = "https://api.tomtom.com/traffic/services/5/incidentDetails" +
      `?key=${API_KEY}&bbox=${bbox}&language=${I18N[currentLang].tomtomLang}&timeValidityFilter=present` +
      `&fields=${encodeURIComponent(fields)}`;

    try {
      const res = await fetch(url, { signal: incidentsAbort.signal });
      if (!res.ok) return;
      const data = await res.json();
      clearIncidentMarkers();
      jamsLayer.clearLayers();
      (data.incidents || []).forEach((inc) => {
        const p = inc.properties || {};

        // --- Bouchons (cat. 6) : trace permanent, independant des incidents ---
        if (p.iconCategory === 6) {
          if (!wantJams) return;
          const mag = p.magnitudeOfDelay;
          const color = (mag !== undefined && JAM_COLORS[mag] !== undefined)
            ? JAM_COLORS[mag] : JAM_COLOR_DEFAULT;
          const delayMin = p.delay ? Math.round(p.delay / 60) : 0;
          const dict = I18N[currentLang];
          const sev = dict.magnitude[mag];
          let tip = dict.jamWord + (sev ? " " + sev : "");
          if (delayMin > 0) tip += " · +" + delayMin + " min";
          const line = jamLine(inc.geometry, color, incidentPopupHtml(p), tip);
          if (line) jamsLayer.addLayer(line);
          return;
        }

        // --- Autres incidents (travaux, fermetures, accidents...) : a la demande ---
        if (!wantOthers) return;
        const pos = incidentAnchor(inc.geometry);
        if (!pos) return;
        const cat = I18N[currentLang].category[p.iconCategory] || I18N[currentLang].category[0];
        const marker = L.circleMarker(pos, markerStyle(p.iconCategory));
        marker._iconCategory = p.iconCategory;
        marker.bindTooltip(cat, { className: "incident-tip", direction: "top", offset: [0, -8] });
        marker.bindPopup(incidentPopupHtml(p), { maxWidth: 280 });
        incidentMarkers.addLayer(marker);
      });
    } catch { /* requête annulée ou réseau — silencieux */ }
  }

  // Recharge les détails quand la vue change (avec temporisation)
  let moveTimer = null;
  map.on("moveend zoomend", () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(fetchIncidentDetails, 800);
  });

  // ============================================================
  // Choix de la ville (API TomTom Search / Geocoding)
  // ============================================================
  const cityLabelEl = $("cityLabel");
  const currentCityEl = $("currentCity");
  const cityQueryEl = $("setCityQuery");
  const cityResultsEl = $("cityResults");
  const cityResetBtn = $("cityReset");

  function applyCityUI() {
    const c = activeCity();
    cityLabelEl.textContent = c.label;
    currentCityEl.textContent = c.label;
    cityResetBtn.hidden = !settings.city;
    cityResetBtn.textContent = I18N[currentLang].cityResetPrefix + DEFAULT_CITY.label;
    document.title = "City Road Traffic — " + c.label;
  }

  function goToCity(c) {
    settings.city = c; saveSettings();
    map.setView([c.lat, c.lon], cfg.MAP_ZOOM || 12);
    applyCityUI();
    buildBaseLayer(false);   // le mode auto réévalue jour/nuit sur place
    updateSunRow();
    cityResultsEl.hidden = true;
    cityQueryEl.value = "";
  }

  async function searchCity() {
    const q = cityQueryEl.value.trim();
    if (q.length < 2) return;
    cityResultsEl.innerHTML = `<li class="empty">${I18N[currentLang].citySearching}</li>`;
    cityResultsEl.hidden = false;
    try {
      const url = "https://api.tomtom.com/search/2/search/" + encodeURIComponent(q) +
        `.json?key=${API_KEY}&limit=5&language=${I18N[currentLang].tomtomLang}&idxSet=Geo`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("TomTom Search API — erreur", res.status, body);
        throw new Error(String(res.status));
      }
      const data = await res.json();
      const results = (data.results || []).filter((r) => r.position);
      cityResultsEl.innerHTML = "";
      if (!results.length) {
        cityResultsEl.innerHTML = `<li class="empty">${I18N[currentLang].cityNoResults}</li>`;
        return;
      }
      results.forEach((r) => {
        const a = r.address || {};
        const name = a.municipality || a.freeformAddress || q;
        const detail = [a.postalCode, a.countrySubdivision, a.country]
          .filter(Boolean).join(", ");
        const li = document.createElement("li");
        li.tabIndex = 0;
        li.textContent = detail ? `${name} — ${detail}` : name;
        const choice = { label: name, lat: r.position.lat, lon: r.position.lon };
        li.addEventListener("click", () => goToCity(choice));
        li.addEventListener("keydown", (e) => { if (e.key === "Enter") goToCity(choice); });
        cityResultsEl.appendChild(li);
      });
    } catch (err) {
      const code = err && err.message && /^\d+$/.test(err.message) ? ` (${err.message})` : "";
      cityResultsEl.innerHTML = `<li class="empty">${I18N[currentLang].cityError}${code}</li>`;
    }
  }

  $("citySearchBtn").addEventListener("click", searchCity);
  cityQueryEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); searchCity(); }
  });
  cityResetBtn.addEventListener("click", () => {
    settings.city = null; saveSettings();
    map.setView([DEFAULT_CITY.lat, DEFAULT_CITY.lon], cfg.MAP_ZOOM || 12);
    applyCityUI();
    buildBaseLayer(false);
    updateSunRow();
  });

  // ---- Initialisation des couches (toutes les dépendances sont déclarées) ----
  applyCityUI();
  buildBaseLayer(true);
  buildFlowLayer();
  buildIncidentLayer();

  // ============================================================
  // Cycle de rafraîchissement
  // ============================================================
  const lastUpdateEl = $("lastUpdate");
  const countdownEl = $("countdown");
  const pauseBtn = $("pauseBtn");

  let paused = false;
  let nextRefreshAt = Date.now() + settings.refreshS * 1000;

  const fmtTime = (d) =>
    d.toLocaleTimeString(I18N[currentLang].localeCode, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function refreshTraffic() {
    cacheBust = Date.now();
    if (flowLayer) flowLayer.redraw();
    if (incidentLayer) incidentLayer.redraw();
    fetchIncidentDetails();
    lastUpdateEl.textContent = fmtTime(new Date());
    nextRefreshAt = Date.now() + settings.refreshS * 1000;
  }

  lastUpdateEl.textContent = fmtTime(new Date());
  updateSunRow();

  setInterval(() => {
    if (paused) { countdownEl.textContent = I18N[currentLang].paused; return; }
    if (Date.now() >= nextRefreshAt) refreshTraffic();
    const remain = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    countdownEl.textContent = remain + " s";
  }, 1000);

  // Bascule jour/nuit : vérification chaque minute en mode auto
  setInterval(() => {
    if (settings.basemap === "auto") buildBaseLayer(false);
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (settings.basemap === "auto") buildBaseLayer(false);
    if (!paused && Date.now() >= nextRefreshAt) refreshTraffic();
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? I18N[currentLang].resume : I18N[currentLang].pause;
    statusDot.className = paused ? "dot stale" : "dot";
    if (!paused) refreshTraffic();
  });

  // ============================================================
  // Panneau des paramètres
  // ============================================================
  const settingsPanel = $("settings");
  const settingsBtn = $("settingsBtn");

  function toggleSettings(open) {
    const show = open !== undefined ? open : settingsPanel.hidden;
    settingsPanel.hidden = !show;
    settingsBtn.setAttribute("aria-expanded", String(show));
    settingsBtn.classList.toggle("active", show);
  }
  settingsBtn.addEventListener("click", () => toggleSettings());
  $("settingsClose").addEventListener("click", () => toggleSettings(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsPanel.hidden) toggleSettings(false);
  });

  const ctl = {
    lang: $("setLang"),
    basemap: $("setBasemap"),
    dayStyle: $("setDayStyle"),
    flowStyle: $("setFlowStyle"),
    thickness: $("setThickness"),
    flowOpacity: $("setFlowOpacity"),
    incidents: $("setIncidents"),
    incidentDetails: $("setIncidentDetails"),
    showJams: $("setShowJams"),
    incidentStyle: $("setIncidentStyle"),
    incidentOpacity: $("setIncidentOpacity"),
    refresh: $("setRefresh"),
  };
  const out = {
    thickness: $("thicknessVal"),
    flowOpacity: $("flowOpacityVal"),
    incidentOpacity: $("incidentOpacityVal"),
  };
  const dayStyleField = $("dayStyleField");

  function syncControls() {
    ctl.lang.value = currentLang;
    ctl.basemap.value = settings.basemap;
    ctl.dayStyle.value = settings.dayStyle;
    dayStyleField.hidden = settings.basemap !== "auto";
    ctl.flowStyle.value = settings.flowStyle;
    ctl.thickness.value = settings.thickness;
    ctl.flowOpacity.value = settings.flowOpacity;
    ctl.incidents.checked = settings.incidents;
    ctl.incidentDetails.checked = settings.incidentDetails;
    ctl.showJams.checked = settings.jams;
    ctl.incidentStyle.value = settings.incidentStyle;
    ctl.incidentOpacity.value = settings.incidentOpacity;
    ctl.refresh.value = String(settings.refreshS);
    out.thickness.textContent = settings.thickness;
    out.flowOpacity.textContent = settings.flowOpacity + " %";
    out.incidentOpacity.textContent = settings.incidentOpacity + " %";
    const noInc = !settings.incidents;
    ctl.incidentDetails.disabled = noInc;
    ctl.incidentStyle.disabled = noInc;
    ctl.incidentOpacity.disabled = noInc;
  }
  syncControls();

  ctl.lang.addEventListener("change", () => {
    changeLang(ctl.lang.value);
  });

  ctl.basemap.addEventListener("change", () => {
    settings.basemap = ctl.basemap.value;
    dayStyleField.hidden = settings.basemap !== "auto";
    buildBaseLayer(true); updateSunRow(); saveSettings();
  });

  ctl.dayStyle.addEventListener("change", () => {
    settings.dayStyle = ctl.dayStyle.value;
    buildBaseLayer(true); saveSettings();
  });

  ctl.flowStyle.addEventListener("change", () => {
    settings.flowStyle = ctl.flowStyle.value;
    buildFlowLayer(); saveSettings();
  });

  ctl.thickness.addEventListener("input", () => {
    out.thickness.textContent = ctl.thickness.value;
  });
  ctl.thickness.addEventListener("change", () => {
    settings.thickness = clamp(Number(ctl.thickness.value), 1, 20);
    buildFlowLayer(); saveSettings();
  });

  ctl.flowOpacity.addEventListener("input", () => {
    settings.flowOpacity = Number(ctl.flowOpacity.value);
    out.flowOpacity.textContent = settings.flowOpacity + " %";
    if (flowLayer) flowLayer.setOpacity(settings.flowOpacity / 100);
  });
  ctl.flowOpacity.addEventListener("change", saveSettings);

  ctl.incidents.addEventListener("change", () => {
    settings.incidents = ctl.incidents.checked;
    syncControls();
    buildIncidentLayer(); saveSettings();
  });

  ctl.incidentDetails.addEventListener("change", () => {
    settings.incidentDetails = ctl.incidentDetails.checked;
    syncControls();
    if (settings.incidentDetails) fetchIncidentDetails(); else clearIncidentMarkers();
    saveSettings();
  });

  ctl.showJams.addEventListener("change", () => {
    settings.jams = ctl.showJams.checked;
    fetchIncidentDetails(); saveSettings();
  });

  ctl.incidentStyle.addEventListener("change", () => {
    settings.incidentStyle = ctl.incidentStyle.value;
    buildIncidentLayer(); saveSettings();
  });

  ctl.incidentOpacity.addEventListener("input", () => {
    settings.incidentOpacity = Number(ctl.incidentOpacity.value);
    out.incidentOpacity.textContent = settings.incidentOpacity + " %";
    if (incidentLayer) incidentLayer.setOpacity(settings.incidentOpacity / 100);
  });
  ctl.incidentOpacity.addEventListener("change", saveSettings);

  ctl.refresh.addEventListener("change", () => {
    settings.refreshS = Math.max(30, Number(ctl.refresh.value) || 60);
    nextRefreshAt = Date.now() + settings.refreshS * 1000;
    saveSettings();
  });

  $("settingsReset").addEventListener("click", () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    settings = { ...DEFAULTS };
    syncControls();
    map.setView([DEFAULT_CITY.lat, DEFAULT_CITY.lon], cfg.MAP_ZOOM || 12);
    applyCityUI();
    buildBaseLayer(true); buildFlowLayer(); buildIncidentLayer(); updateSunRow();
    nextRefreshAt = Date.now() + settings.refreshS * 1000;
  });

  // ---- Gestion de la clé API depuis les paramètres ----
  const usingStoredKey = !!getStoredKey();
  function updateKeySourceText() {
    const dict = I18N[currentLang];
    $("keySource").textContent =
      (usingStoredKey ? dict.keySourceBrowser : dict.keySourceServer) + " (…" + API_KEY.slice(-4) + ")";
  }
  updateKeySourceText();
  $("keyChangeBtn").addEventListener("click", () => {
    toggleSettings(false);
    showSetup(true); // annulable : l'application tourne déjà
  });
  const keyClearBtn = $("keyClearBtn");
  keyClearBtn.hidden = !(usingStoredKey && cfgKeyValid);
  keyClearBtn.addEventListener("click", () => {
    try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
    location.reload();
  });

  // Rafraichit tous les textes construits dynamiquement en JS (pas via data-i18n)
  // lorsque la langue change alors que l'application tourne deja.
  refreshDynamicTexts = function () {
    pauseBtn.textContent = paused ? I18N[currentLang].resume : I18N[currentLang].pause;
    cityResetBtn.textContent = I18N[currentLang].cityResetPrefix + DEFAULT_CITY.label;
    updateKeySourceText();
    updateSunRow();
    fetchIncidentDetails();
  };

  } // ---- fin de startApp ----

  // ============================================================
  // Amorçage : clé du navigateur, sinon clé du serveur,
  // sinon écran de saisie
  // ============================================================
  const initialKey = getStoredKey() || (cfgKeyValid ? cfgKey : "");
  if (initialKey) startApp(initialKey);
  else showSetup(false);
})();
