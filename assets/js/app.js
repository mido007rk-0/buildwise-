/**
 * app.js — Le démarrage, l'état et les clics.
 *
 * Ce fichier reprend telle quelle la machine à états de BuildWise 2.0 :
 * les mêmes noms de champs, le même localStorage, les mêmes boutons.
 * Ce qui change : avant d'afficher un écran, le site lit la base MySQL via
 * api.js, et l'enregistrement d'une configuration écrit aussi dans PHP.
 *
 * Ordre de chargement voulu dans index.html :
 *   api.js  →  catalog.js  →  views.js  →  app.js
 */

/** Même clé que la version d'origine : les configurations déjà enregistrées
 *  dans le navigateur restent lisibles, aucune migration nécessaire. */
const STORE = 'buildwise-v2-mvp';

const routes = [
  ['home', 'Accueil'],
  ['builder', 'PC Builder'],
  ['compare', 'SmartPrice'],
  ['upgrade', 'Upgrade Path'],
  ['fps', 'FPS Range'],
  ['bottleneck', 'Bottleneck'],
  ['doctor', 'PC Doctor'],
  ['goal', 'GoalMatch'],
  ['compat', 'Compatibility'],
  ['resolution', 'Resolution Advisor'],
  ['settings', 'Game Settings'],
];

const icons = {
  home: '◫', builder: '▣', compare: '⇄', upgrade: '↗', fps: '◉',
  bottleneck: '◈', doctor: '✚', goal: '◎', compat: '◇', resolution: '▤', settings: '☷',
};

/**
 * La configuration de départ, identique à celle de la version d'origine.
 * `priceOrigin` est le seul champ ajouté : il note, famille par famille,
 * si le montant affiché vient de la base ('base') ou d'une saisie à la
 * main ('manuel'). C'est ce qui permet d'afficher un total honnête.
 */
function initialBuild() {
  return {
    name: 'Ma configuration',
    budget: '180000',
    use: 'gaming',
    resolution: '1080p',
    game: 'Valorant',
    cpuBrand: 'all',
    gpuBrand: 'all',
    parts: {
      cpu: 'r5-7600', gpu: 'rtx4060', board: 'b650-ddr5', ram: 'ddr5-16',
      storage: 'ssd-1t', psu: 'psu-650', case: 'case-atx', cooler: 'cooler-air',
    },
    prices: {},
    priceOrigin: {},
  };
}

/** Relit l'état sauvegardé, en complétant ce qui manque pour rester compatible. */
function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE));
    if (stored && stored.build && Array.isArray(stored.saved)) {
      stored.build.priceOrigin = stored.build.priceOrigin || {};
      return stored;
    }
  } catch {
    // Un localStorage corrompu ne doit pas empêcher le site de s'ouvrir.
  }

  return {
    build: initialBuild(),
    saved: [],
    route: 'home',
    problem: 'fps',
    diagStep: 0,
    goalBudget: 180000,
    goalUse: 'gaming',
    goalRes: '1080p',
    goalFps: '60',
    goalGame: 'Valorant',
    upgradeBudget: 40000,
    resGame: 'Cyberpunk 2077',
    resTarget: '60',
    settingsPreset: 'balanced',
    settingsGame: 'Cyberpunk 2077',
    settingsVRAM: 'unknown',
    settingsRT: 'off',
    cmpA: '',
    cmpB: '',
    fpsQuality: 'high',
  };
}

const state = load();

function persist() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

/** Devient vrai dès que la première lecture de la base est terminée. */
let booted = false;

/* ---------------------------------------------------------------------- */
/*  Les lectures déclenchées par les pages, sans bloquer l'affichage.      */
/* ---------------------------------------------------------------------- */

/**
 * Les vues sont des fonctions qui renvoient du HTML : elles ne peuvent pas
 * attendre. Elles demandent donc une lecture, affichent ce qu'elles ont déjà
 * (le cache, ou rien), et la page se redessine quand la réponse arrive.
 * `pending` empêche la même lecture de partir deux fois.
 */
const pending = { stats: new Set(), compat: new Set() };

/** Mesures de FPS pour un jeu + une résolution + une qualité. */
function requestBenchmarkStats(conditions) {
  const key = DB.statsKey(conditions);
  if (DB.cachedStats(conditions) || pending.stats.has(key)) return;

  pending.stats.add(key);
  DB.stats(conditions)
    .then(() => {
      if (state.route === 'fps') render();
    })
    .catch((error) => {
      // La page doit expliquer l'échec au lieu de laisser « en cours » :
      // on mémorise une réponse vide dont le message est la cause réelle.
      DB.statsCache[key] = {
        stats: [],
        meta: {
          ...conditions,
          emptyMessage: `La lecture des mesures a échoué : ${error.message}`,
        },
      };
      if (state.route === 'fps') render();
    })
    .finally(() => pending.stats.delete(key));
}

/** Constatations de compatibilité déjà saisies en base pour ces pièces. */
function requestCompatibility(ids) {
  const key = DB.compatKey(ids);
  if (!key || DB.compatCache[key] || pending.compat.has(key)) return;

  pending.compat.add(key);
  DB.compatFor(ids)
    .then(() => {
      DB.compatError = '';
      if (state.route === 'compat') render();
    })
    .catch((error) => {
      DB.compatCache[key] = [];
      DB.compatError = error.message;
      if (state.route === 'compat') render();
    })
    .finally(() => pending.compat.delete(key));
}

/* ---------------------------------------------------------------------- */
/*  Les prix de la base dans le PC Builder.                                */
/* ---------------------------------------------------------------------- */

/**
 * Place le prix connu en base dans le champ de la famille concernée.
 * Un montant déjà présent (saisi à la main ou non) n'est jamais écrasé :
 * « Ne remplace pas les données existantes sans vérifier leur utilité ».
 */
function fillPriceFromDatabase(key) {
  const current = state.build.prices[key];
  const hasValue = current !== '' && current !== null && current !== undefined
    && Number.isFinite(Number(current));
  if (hasValue) return false;

  const price = databasePrice(state.build.parts[key]);
  if (!price) return false;

  state.build.prices[key] = String(price.value);
  state.build.priceOrigin[key] = 'base';
  return true;
}

/** Au démarrage : complète tous les prix que la base connaît vraiment. */
function autofillPrices() {
  const changed = order.map((key) => fillPriceFromDatabase(key)).filter(Boolean).length;
  if (changed) persist();
  return changed;
}

/**
 * Quand on change de pièce dans une famille, le champ prix suit la nouvelle
 * sélection : le montant précédent appartenait à l'autre composant.
 */
function resyncPrice(key) {
  const price = databasePrice(state.build.parts[key]);

  if (price) {
    state.build.prices[key] = String(price.value);
    state.build.priceOrigin[key] = 'base';
    return;
  }

  state.build.prices[key] = '';
  delete state.build.priceOrigin[key];
}

/* ---------------------------------------------------------------------- */
/*  Affichage                                                              */
/* ---------------------------------------------------------------------- */

/** Écran d'ouverture, le temps que PHP réponde. */
function bootScreen() {
  return `<div class="boot">
    <div class="boot-mark">B<span>W</span></div>
    <h1>BuildWise</h1>
    <p>Lecture de la base MySQL…</p>
    <small>Si ce message reste à l'écran, le backend PHP ne répond pas : ouvre <b>backend/check.php</b> ou lis le README.md.</small>
  </div>`;
}

function statusLabel() {
  if (DB.status === 'chargement') return 'CHARGEMENT / MYSQL';
  if (DB.status === 'hors-ligne') return 'BASE HORS LIGNE';

  const prices = Object.keys(DB.prices).length;
  return prices ? `MYSQL / ${prices} PRIX SOURCÉS` : 'MYSQL / AUCUN PRIX SAISI';
}

/**
 * Le squelette de la page (menu, barre du haut, pied) — mêmes classes et même
 * ordre que la version d'origine. Seuls deux textes changent : la pastille du
 * haut, qui disait « DEMO DATA / OFFLINE », et l'astuce du menu latéral, qui
 * parlait d'un site 100 % local.
 */
function render() {
  const r = state.route;
  const views = {
    home, builder, compare, upgrade, fps, bottleneck, doctor, goal,
    compat: compatibility, resolution, settings,
  };

  document.getElementById('app').innerHTML = `
<div class="shell">
  <aside class="sidebar">
    <button class="logo" data-route="home"><span class="logo-mark">B<span>W</span></span><span>Build<span>Wise</span><small>2.0</small></span></button>
    <div class="nav-head">WORKSPACE</div>
    <nav aria-label="Navigation principale">${routes.map(([id, name]) => `<button data-route="${id}" class="nav-item ${r === id ? 'active' : ''}"><span class="nav-icon">${icons[id]}</span><span>${name}</span>${r === id ? '<span class="active-dot"></span>' : ''}</button>`).join('')}</nav>
    <div class="sidebar-bottom">
      <div class="tip"><span class="tip-icon">✦</span><b>PHP + MySQL</b><p>Composants, prix, mesures et configurations viennent de la base <b>buildwise</b>. Le mot de passe reste dans backend/config.php, jamais dans le JavaScript.</p></div>
      <div class="sidebar-foot"><span class="pulse"></span> BUILDWISE 2.0 <span>•</span> BASE MYSQL</div>
    </div>
  </aside>
  <main class="main">
    <div class="topbar">
      <div class="breadcrumb">BUILDWISE <span>/</span> ${safe(routes.find((x) => x[0] === r)?.[1] || 'Accueil')}</div>
      <div class="topbar-right">
        <span class="top-status"><span class="pulse"></span> ${safe(statusLabel())}</span>
        <button class="top-action" data-action="export" title="Exporter tes données">↓ EXPORT</button>
      </div>
    </div>
    <div class="content">${booted ? (views[r] || home)() : bootScreen()}</div>
    <footer><span>© 2026 BuildWise · Built to make better decisions.</span><span>Données indicatives · Prix et FPS seulement s'ils sont sourcés en base</span></footer>
  </main>
</div>
<div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

function navigate(route) {
  state.route = route;
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer;
function notify(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------------------------------------------------------------------- */
/*  Formulaire                                                             */
/* ---------------------------------------------------------------------- */

function update(field, value) {
  let shouldRender = false;

  if (field.startsWith('build.')) {
    state.build[field.slice(6)] = value;
    shouldRender = true;
  } else if (field.startsWith('part.')) {
    const key = field.slice(5);
    state.build.parts[key] = value;
    resyncPrice(key);
    shouldRender = true;
  } else if (field.startsWith('price.')) {
    const key = field.slice(6);
    state.build.prices[key] = value;

    if (value === '' || value === null) delete state.build.priceOrigin[key];
    else state.build.priceOrigin[key] = 'manuel';

    shouldRender = true;
  } else {
    state[field] = value;
    shouldRender = true;
  }

  // Comportement d'origine : un filtre de marque qui ne correspond plus à la
  // pièce choisie sélectionne la première pièce de cette marque.
  if (field === 'build.cpuBrand' || field === 'build.gpuBrand') {
    const type = field.endsWith('cpuBrand') ? 'cpu' : 'gpu';
    const brand = state.build[type + 'Brand'];
    if (brand !== 'all' && part(type, state.build.parts[type])?.brand !== brand) {
      state.build.parts[type] = catalog[type].find((x) => x.brand === brand)?.slug ?? '';
      resyncPrice(type);
    }
  }

  persist();
  if (shouldRender) render();
}

document.addEventListener('change', (event) => {
  const field = event.target?.dataset?.field;
  if (field) update(field, event.target.value);
});

/* ---------------------------------------------------------------------- */
/*  Enregistrer une configuration                                          */
/* ---------------------------------------------------------------------- */

/**
 * Deux écritures, comme convenu :
 *   1. la copie navigateur (localStorage), celle de la version d'origine ;
 *   2. la ligne en base, via POST backend/configurations.php.
 * Si la base est muette, la copie navigateur reste : rien n'est perdu, et le
 * message le dit au lieu de faire semblant d'avoir enregistré.
 */
async function saveBuild() {
  const local = JSON.parse(JSON.stringify(state.build));
  local.id = 'bw-' + Date.now();
  local.name = local.name?.trim() || 'Configuration sans nom';
  state.saved.push(local);
  persist();

  if (DB.status === 'hors-ligne') {
    render();
    notify('Enregistrée dans ce navigateur uniquement : la base MySQL ne répond pas.');
    return;
  }

  let message = 'Enregistrement en base…';

  try {
    const response = await API.post('configurations.php', {
      name: local.name,
      budget: Number(state.build.budget) || null,
      usage: state.build.use,
      resolution: state.build.resolution,
      parts: state.build.parts,
    });

    const saved = response.data.configuration;
    const list = await API.get('configurations.php');
    DB.configurations = list.data.configurations;

    message = saved.totalPrice === null
      ? `Enregistrée en base (id ${saved.id}). Total non calculé : il manque un prix en base pour au moins une pièce.`
      : `Enregistrée en base (id ${saved.id}) · total calculé : ${formatDzd(saved.totalPrice)}.`;
  } catch (error) {
    message = 'Enregistrée dans ce navigateur. La base a refusé : ' + error.message;
  }

  // render() reconstruit le bandeau de notification : le message vient après.
  render();
  notify(message);
}

/** Relance la lecture de la base après une panne (bouton « Réessayer »). */
async function retryDatabase() {
  booted = true;
  DB.status = 'chargement';
  render();

  const ok = await DB.load();
  let message;

  if (ok) {
    autofillPrices();
    const priced = Object.keys(DB.prices).length;
    message = `Base relue : ${DB.totals.components || 0} composants, ${priced} prix sourcé${priced > 1 ? 's' : ''}.`;
  } else {
    message = 'Toujours impossible de joindre PHP ou MySQL : ouvre backend/check.php.';
  }

  render();
  notify(message);
}

/* ---------------------------------------------------------------------- */
/*  Clics                                                                  */
/* ---------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const item = event.target.closest('[data-route],[data-action],[data-problem],[data-set-res]');
  if (!item) return;

  if (item.dataset.route) {
    navigate(item.dataset.route);
    return;
  }

  if (item.dataset.problem) {
    state.problem = item.dataset.problem;
    state.diagStep = 0;
    persist();
    render();
    return;
  }

  if (item.dataset.setRes) {
    state.build.resolution = item.dataset.setRes;
    persist();
    render();
    return;
  }

  const action = item.dataset.action;

  if (action === 'save-build') {
    saveBuild();
    return;
  }

  if (action === 'retry-db') {
    retryDatabase();
    return;
  }

  if (action === 'export') {
    const blob = new Blob(
      [JSON.stringify({
        exportedAt: new Date().toISOString(),
        base: 'les prix et mesures affichés viennent de MySQL, à la date de cette exportation',
        build: state.build,
        saved: state.saved,
      }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'buildwise-configurations.json';
    link.click();
    URL.revokeObjectURL(url);
    notify('Fichier JSON exporté.');
    return;
  }

  if (action === 'diag-next') {
    state.diagStep = Math.min(state.diagStep + 1, doctorFlows[state.problem].questions.length);
    persist();
    render();
    return;
  }

  if (action === 'diag-reset') {
    state.diagStep = 0;
    persist();
    render();
    return;
  }

  if (action === 'goal-builder') {
    state.build.budget = String(state.goalBudget);
    state.build.use = state.goalUse;
    state.build.resolution = state.goalRes;
    state.build.game = state.goalGame;
    navigate('builder');
  }
});

// Deux onglets ouverts, la même base : l'autre page prévient, comme avant.
window.addEventListener('storage', (event) => {
  if (event.key === STORE) location.reload();
});

/* ---------------------------------------------------------------------- */
/*  Démarrage                                                              */
/* ---------------------------------------------------------------------- */

async function boot() {
  render();

  const ok = await DB.load();
  booted = true;

  if (ok) {
    autofillPrices();
  }

  render();

  if (!ok) {
    notify(DB.error?.message || 'La base de données est injoignable.');
  }
}

boot();
