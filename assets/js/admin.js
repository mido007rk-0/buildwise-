/**
 * admin.js — La page de saisie des données (admin.html).
 *
 * Pourquoi cette page existe :
 *   la base MySQL est livrée vide de tout prix et de toute mesure de FPS.
 *   Personne n'invente un chiffre à la place du marché algérien. C'est donc toi
 *   qui saisis les prix et les mesures que tu as réellement observés, avec la
 *   source de chaque chiffre. Le site affiche ensuite ces données, et affiche
 *   « non renseigné » tant qu'elles n'existent pas.
 *
 * Ce fichier ne contient AUCUN identifiant de base de données. Il parle à PHP
 * par l'intermédiaire de API (assets/js/api.js), exactement comme le site.
 *
 * Cinq onglets :
 *   Composants  → ajouter une pièce au catalogue (jamais un prix)
 *   Prix        → enregistrer un prix observé, le corriger, voir l'historique
 *   FPS         → enregistrer une mesure de performance sourcée, la corriger
 *   Compatibilité → consigner un constat humain entre deux pièces
 *   PC          → relire et supprimer les configurations enregistrées
 *
 * Ajouter ou corriger ?
 *   « Enregistrer » (POST) ajoute une observation nouvelle — le prix vient de
 *   bouger. Le bouton « Modifier » d'une ligne charge cette ligne dans le
 *   formulaire, et « Mettre à jour » (PUT) la rectifie sans doublon.
 */

/* ---------------------------------------------------------------------- */
/* 1. État de la page                                                      */
/* ---------------------------------------------------------------------- */

const ADMIN = {
  /** Onglet affiché. */
  tab: 'components',
  /** Catalogue complet, lu une fois et partagé par tous les formulaires. */
  components: [],
  games: [],
  summary: null,
  /** Lignes de la liste à droite, par onglet. */
  lists: { prices: [], benchmarks: [], compat: [], configs: [] },
  /** Historique des prix, par id de composant. */
  history: {},
  historyFor: null,
  /** Ce qui est tapé dans les formulaires, conservé entre deux dessins d'écran. */
  values: {},
  /**
   * Ligne en cours de rectification, ou null si un formulaire ajoute.
   * Forme : { kind: 'price' | 'benchmark', id: 12 }.
   * C'est ce qui fait la différence entre « Enregistrer » (POST) et
   * « Mettre à jour » (PUT) : sans ça, corriger une faute de frappe créerait
   * une ligne de plus au lieu de rectifier la première.
   */
  editing: null,
  /** Erreur du dernier appel (message + conseil), ou null. */
  error: null,
  /** Vrai pendant un envoi : les boutons sont alors désactivés. */
  busy: false,
  loaded: false,
  /**
   * État du verrou administrateur, renvoyé par backend/login.php.
   * `checked` évite d'afficher « non connecté » pendant le premier appel.
   */
  auth: { checked: false, signedIn: false, configured: true },
};

const tabs = [
  { id: 'components', name: 'Composants' },
  { id: 'prices', name: 'Prix' },
  { id: 'benchmarks', name: 'Mesures FPS' },
  { id: 'compat', name: 'Compatibilité' },
  { id: 'configs', name: 'PC enregistrés' },
];

/* ---------------------------------------------------------------------- */
/* 2. Les choix proposés aux formulaires                                   */
/* ---------------------------------------------------------------------- */

/** Doit rester identique à SPEC_FIELDS dans backend/components.php. */
const specFields = {
  cpu: [
    { key: 'socket', label: 'Socket du processeur', type: 'text', placeholder: 'AM5, LGA1700…' },
    { key: 'tier', label: 'Niveau de performance (1 à 5)', type: 'number', min: 1, max: 5 },
  ],
  gpu: [
    { key: 'tier', label: 'Niveau de performance (1 à 5)', type: 'number', min: 1, max: 5 },
    { key: 'vram', label: 'Mémoire vidéo (Go)', type: 'number', min: 1, max: 48 },
  ],
  board: [
    { key: 'socket', label: 'Socket de la carte mère', type: 'text', placeholder: 'AM5, LGA1700…' },
    { key: 'ramType', label: 'Génération de mémoire', type: 'ram' },
  ],
  ram: [
    { key: 'ramType', label: 'Génération de mémoire', type: 'ram' },
    { key: 'gb', label: 'Capacité totale (Go)', type: 'number', min: 1, max: 512 },
  ],
  storage: [
    { key: 'gb', label: 'Capacité (Go)', type: 'number', min: 1, max: 65536 },
    { key: 'type', label: 'Type (NVMe, SATA…)', type: 'text', placeholder: 'NVMe' },
  ],
  psu: [{ key: 'watts', label: 'Puissance (watts)', type: 'number', min: 100, max: 2000 }],
  case: [{ key: 'format', label: 'Format (ATX, micro-ATX…)', type: 'text', placeholder: 'ATX' }],
  cooler: [{ key: 'kind', label: 'Type (air, AIO…)', type: 'text', placeholder: 'air' }],
};

const ramTypes = ['DDR3', 'DDR4', 'DDR5'];
const currencies = ['DZD', 'EUR', 'USD', 'TND'];
const resolutions = ['1080p', '1440p', '4K'];
const qualityLabels = { low: 'Faible', medium: 'Moyen', high: 'Élevé', ultra: 'Ultra', custom: 'Perso' };
const statusLabels = { compatible: 'Compatible', incompatible: 'Incompatible', unknown: 'À vérifier' };

/* ---------------------------------------------------------------------- */
/* 3. Petits outils d'écriture du HTML                                     */
/* ---------------------------------------------------------------------- */

/** Échappe le HTML : une valeur saisie ne peut pas casser la page. */
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const val = (field, fallback = '') => ADMIN.values[field] ?? fallback;

function panel(title, body) {
  return `<section class="panel"><div class="panel-title">${title}</div>${body}</section>`;
}

/** Un champ de formulaire. `field` sert aussi de clé dans ADMIN.values. */
function fieldText(field, label, { type = 'text', placeholder = '', required = false, attrs = '', hint = '' } = {}) {
  return `<label>${esc(label)}${required ? ' *' : ''}
    <input type="${type}" data-field="${field}" value="${esc(val(field))}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${attrs}/>
  </label>${hint ? `<span class="src">${esc(hint)}</span>` : ''}`;
}

/** Un menu déroulant. `items` = chaînes ou { id, name }. */
function fieldChoice(field, label, items, { required = false } = {}) {
  const html = items.map((item) => {
    const id = item?.id ?? item;
    const name = item?.name ?? item;
    const selected = String(val(field, id)) === String(id) ? 'selected' : '';
    return `<option value="${esc(id)}" ${selected}>${esc(name)}</option>`;
  }).join('');

  return `<label>${esc(label)}${required ? ' *' : ''}<select data-field="${field}" ${required ? 'required' : ''}>${html}</select></label>`;
}

/**
 * Les composants dans l'ordre exact des menus déroulants : famille par famille,
 * puis l'ordre de la base dans chaque famille. `only` restreint aux familles
 * demandées.
 *
 * Cette fonction sert aussi à deviner ce que le menu « Composant testé »
 * affiche avant la première saisie : un `<select>` obligatoire pré-sélectionne
 * seul son premier option, et le menu des pièces associées doit se régler sur
 * cette pièce réellement visible, pas sur une valeur encore vide.
 */
function componentsInSelectOrder(only = null) {
  return (only || order).flatMap((cat) => ADMIN.components.filter((c) => c.category === cat));
}

/**
 * Le sélecteur de composants : tous les composants de la base, rangés par
 * famille. La valeur envoyée à PHP est l'id numérique (ce que les endpoints
 * attendent pour `component_id`).
 *
 * `only` restreint la liste à une ou plusieurs familles (ex : ['gpu']), et
 * `disabled` fige le choix — c'est le cas quand on rectifie un prix déjà
 * enregistré : PHP refuse de changer le composant d'une ligne de prix, car
 * l'historique d'un composant ne doit pas se mélanger avec un autre.
 */
function componentSelect(field, label, { required = true, only = null, disabled = false, hint = '' } = {}) {
  if (ADMIN.components.length === 0) {
    return `<label>${esc(label)}<input value="Base inaccessible" disabled/></label>`;
  }

  const rows = componentsInSelectOrder(only);
  if (rows.length === 0) {
    return `<label>${esc(label)}<input value="Aucun composant de cette famille en base" disabled/></label>`;
  }

  const groups = order.filter((cat) => rows.some((c) => c.category === cat)).map((cat) => {
    const byFamily = rows.filter((c) => c.category === cat);
    return `<optgroup label="${esc(labels[cat])}">${byFamily.map((c) =>
      `<option value="${c.id}" ${String(val(field)) === String(c.id) ? 'selected' : ''}>${esc(c.name)}${c.brand ? ' · ' + esc(c.brand) : ''}</option>`).join('')}</optgroup>`;
  }).join('');

  const placeholder = required || disabled ? '' : `<option value="">— Aucun composant —</option>`;
  const lock = disabled ? 'disabled' : '';

  return `<label>${esc(label)}${required && !disabled ? ' *' : ''}<select data-field="${field}" ${required && !disabled ? 'required' : ''} ${lock}>${placeholder}${groups}</select></label>${hint ? `<span class="src">${esc(hint)}</span>` : ''}`;
}

/** Les champs techniques affichés pour une famille de composant. */
function specInputs(category) {
  return (specFields[category] ?? []).map((f) => {
    const field = 'spec.' + f.key;
    if (f.type === 'ram') return fieldChoice(field, f.label, ramTypes);
    if (f.type === 'number') {
      return fieldText(field, f.label, { type: 'number', attrs: `min="${f.min}" max="${f.max}" step="1"` });
    }
    return fieldText(field, f.label, { placeholder: f.placeholder, attrs: 'maxlength="40"' });
  }).join('');
}

/** Une ligne « en-tête » + lignes vides, ou le message d'absence. */
function table(cols, head, rows, emptyMessage) {
  if (rows.length === 0) {
    return `<div class="alert muted">${esc(emptyMessage)}</div>`;
  }

  return `<div class="data-table">
    <div class="data-head cols-${cols}">${head.map((h) => `<div>${esc(h)}</div>`).join('')}</div>
    ${rows.map((cells) => `<div class="data-row cols-${cols}">${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`).join('')}
  </div>`;
}

/** La cellule de droite d'un tableau, où l'on range les boutons d'une ligne. */
const actions = (...buttons) => `<span class="row-actions">${buttons.join('')}</span>`;

/**
 * Le bouton de suppression, avec sa phrase de confirmation.
 * Il est toujours placé dans une cellule `actions(…)`.
 */
function delButton(endpoint, id, confirmText) {
  return `<button class="row-del" type="button" data-del="${endpoint}:${id}"
    data-confirm="${esc(confirmText)}" ${ADMIN.busy ? 'disabled' : ''}>Supprimer</button>`;
}

const money = (n, currency) => `${Number(n).toLocaleString('fr-DZ')} ${currency || 'DZD'}`;

/** La date du jour au format AAAA-MM-JJ, celle qu'attend un champ `type="date"`. */
function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/* ---------------------------------------------------------------------- */
/* 4. Chargement des données                                               */
/* ---------------------------------------------------------------------- */

/**
 * Relit ce dont l'onglet affiché a besoin.
 * `Promise.all` : les requêtes partent ensemble, et une échec n'empêche pas
 * les autres d'arriver — l'erreur est affichée dans la bannière rouge.
 */
async function loadTab() {
  const calls = [API.get('components.php', { limit: 500 }), API.get('components.php', { action: 'summary' })];

  const listCall = {
    prices: () => API.get('prices.php'),
    benchmarks: () => Promise.all([API.get('benchmarks.php'), API.get('benchmarks.php', { action: 'games' })]),
    compat: () => API.get('compatibility.php'),
    configs: () => API.get('configurations.php'),
    components: () => null,
  }[ADMIN.tab]();

  if (listCall) calls.push(listCall);

  const results = await Promise.all(calls);

  ADMIN.components = results[0].data.components;
  ADMIN.summary = results[1].data;

  const list = results[2];
  if (ADMIN.tab === 'prices') ADMIN.lists.prices = list.data.prices;
  if (ADMIN.tab === 'benchmarks') {
    ADMIN.lists.benchmarks = list[0].data.benchmarks;
    ADMIN.games = list[1].data.games.map((game) => game.name);
  }
  if (ADMIN.tab === 'compat') ADMIN.lists.compat = list.data.records;
  if (ADMIN.tab === 'configs') ADMIN.lists.configs = list.data.configurations;

  ADMIN.loaded = true;
}

/** Oublie les caches qui viennent de changer après une saisie ou une suppression. */
function forgetCache(endpoint) {
  if (endpoint === 'prices.php') ADMIN.history = {};
  if (endpoint === 'benchmarks.php') ADMIN.games = [];
}

/** Envoi commun à toutes les écritures : verrou, appel, relecture, message. */
async function submit(endpoint, body, after, method = 'post') {
  if (ADMIN.busy) return;

  ADMIN.busy = true;
  ADMIN.error = null;
  render();

  try {
    const response = await API[method](endpoint, body);
    forgetCache(endpoint);
    await after?.(response);
    await loadTab();
    notify(response.meta?.message || 'Enregistré dans la base MySQL.');
  } catch (error) {
    ADMIN.error = error;
    noteAuthProblem(error);
  }

  ADMIN.busy = false;
  render();
}

async function remove(endpoint, id) {
  if (ADMIN.busy) return;

  ADMIN.busy = true;
  ADMIN.error = null;
  render();

  try {
    const response = await API.del(endpoint, { id });
    forgetCache(endpoint);
    // La ligne qu'on était en train de rectifier vient de disparaître.
    if (ADMIN.editing && endpointKind[endpoint] === ADMIN.editing.kind && ADMIN.editing.id === id) {
      ADMIN.editing = null;
      clearForm(formPrefix[ADMIN.tab]);
    }
    await loadTab();
    notify(response.meta?.message || 'Ligne supprimée de la base.');
  } catch (error) {
    ADMIN.error = error;
    noteAuthProblem(error);
  }

  ADMIN.busy = false;
  render();
}

/* ---------------------------------------------------------------------- */
/* 5. Les cinq onglets                                                     */
/* ---------------------------------------------------------------------- */

function tabComponents() {
  const category = val('c.category', 'cpu');

  const form = panel('Ajouter un composant au catalogue', `
    <form data-form="component">
      <div class="form-grid">
        ${fieldText('c.name', 'Nom du composant', { required: true, placeholder: 'AMD Ryzen 5 8600G' })}
        ${fieldText('c.brand', 'Marque', { placeholder: 'AMD, Intel, ASUS…', attrs: 'maxlength="60"' })}
        ${fieldChoice('c.category', 'Famille', order.map((cat) => ({ id: cat, name: labels[cat] })), { required: true })}
        ${fieldText('c.slug', 'Référence technique (facultatif)', { placeholder: 'fabriqué depuis le nom si vide', attrs: 'maxlength="80"' })}
      </div>
      <div class="form-grid">${specInputs(category)}</div>
      <p class="spec-note">
        Seuls ces champs techniques sont acceptés pour la famille « ${esc(labels[category])} ».
        Ils alimentent le Compatibility Checker (socket, génération de mémoire).
        Le prix ne se saisit PAS ici : il entre par l'onglet Prix, avec sa source.
      </p>
      <div class="button-stack">
        <button class="button primary" type="submit" ${ADMIN.busy ? 'disabled' : ''}>Ajouter le composant</button>
      </div>
    </form>`);

  const rows = ADMIN.components.map((c) => [
    `<b>${esc(c.name)}</b><span class="src">${esc(c.slug)}${c.priceUpdatedAt ? ' · prix du ' + esc(c.priceUpdatedAt.slice(0, 10)) : ''}</span>`,
    esc(c.brand || '—'),
    esc(labels[c.category] ?? c.category),
    c.price === null ? '<span class="src">Aucun prix en base</span>' : esc(money(c.price, c.currency)),
    `<span class="src">${esc(describeSpecs(c.specifications))}</span>`,
  ]);

  const list = panel(
    `${counted(ADMIN.components.length, 'composant', 'composants')} en base`,
    table('component', ['Nom', 'Marque', 'Famille', 'Prix de la base', 'Caractéristiques'], rows,
      'Aucun composant dans la table `components`. Importe database/buildwise.sql, ou ajoute le premier composant avec le formulaire.',
    ),
  );

  return { left: form, right: list };
}

/** Résumé lisible des caractéristiques techniques d'un composant. */
function describeSpecs(specs) {
  const entries = Object.entries(specs || {});
  if (entries.length === 0) return 'Aucune caractéristique enregistrée.';
  return entries.map(([key, value]) => `${key} : ${value}`).join(' · ');
}

/** Vrai quand c'est le formulaire de l'onglet affiché qui rectifie une ligne. */
function isEditing(kind) {
  return ADMIN.editing !== null && ADMIN.editing.kind === kind;
}

/**
 * Le bandeau qui rappelle qu'on corrige une ligne existante au lieu d'en
 * ajouter une nouvelle : c'est la confusion la plus fréquente sur cette page.
 * `note` rappelle ce qui, dans cette ligne, ne doit pas bouger — ou au
 * contraire ce qui peut être corrigé.
 */
function editBanner(kind, title, note) {
  if (!isEditing(kind)) return '';

  return `<div class="alert muted">
    Tu es en train de <b>rectifier</b> ${esc(title)} (id ${ADMIN.editing.id}) : l'ancienne valeur sera remplacée,
    aucun nouveau relevé ne sera ajouté. ${esc(note)}
    <div class="button-stack">
      <button class="button" type="button" data-cancel-edit="${kind}" ${ADMIN.busy ? 'disabled' : ''}>Annuler la rectification</button>
    </div>
  </div>`;
}

function tabPrices() {
  const editing = isEditing('price');

  const form = panel(editing ? 'Rectifier un prix déjà enregistré' : 'Enregistrer un prix observé', `
    ${editBanner('price', 'cette saisie de prix', 'Le composant du relevé ne change pas : un prix appartient à son composant, sinon deux historiques se mélangent.')}
    <form data-form="price">
      <div class="form-grid">
        ${componentSelect('p.component_id', 'Composant', { disabled: editing })}
        ${fieldText('p.price', 'Prix', { type: 'number', required: true, attrs: 'min="0" step="0.01"', placeholder: '98500' })}
        ${fieldChoice('p.currency', 'Devise', currencies)}
        ${fieldText('p.verified_at', 'Date de vérification', { type: 'date', required: true, attrs: `max="${todayIso()}"`, hint: 'Le jour où tu as vu ce prix en boutique ou sur le site. Elle peut être antérieure à aujourd\'hui ; l\'avenir est refusé.' })}
        ${fieldText('p.source', 'Source du prix', { required: true, placeholder: 'Boutique, site, devis…', attrs: 'maxlength="180"' })}
      </div>
      <div class="form-grid">
        ${fieldText('p.source_url', 'Lien de la source (facultatif)', { type: 'url', placeholder: 'https://…', attrs: 'maxlength="300"', hint: 'Chaque prix de la base garde sa source : c\'est ce qui permet de vérifier un montant plus tard.' })}
      </div>
      <div class="button-stack">
        <button class="button primary" type="submit" ${ADMIN.busy ? 'disabled' : ''}>${editing ? 'Mettre à jour le prix' : 'Enregistrer le prix'}</button>
      </div>
    </form>`);

  const rows = ADMIN.lists.prices.map((p) => [
    `<b>${esc(p.component)}</b><span class="src">${esc(labels[p.category] ?? p.category)}</span>`,
    esc(money(p.price, p.currency)),
    `${esc(p.source || 'Sans source')}${p.sourceUrl ? ` · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">lien</a>` : ''}<span class="src">vérifié le ${esc(p.verifiedAt || '—')} · saisi le ${esc(p.updatedAt)}</span>`,
    actions(
      `<button class="row-edit" type="button" data-edit="price:${p.id}" ${ADMIN.busy ? 'disabled' : ''}>Modifier</button>`,
      `<button class="row-history" type="button" data-history="${p.componentId}">Historique</button>`,
      delButton('prices.php', p.id, `Supprimer ce prix de ${money(p.price, p.currency)} pour « ${p.component} » ?`),
    ),
  ]);

  // La liste montre un prix par composant (le dernier vérifié) ; `price_records`
  // compte tous les relevés, donc plusieurs boutiques pour une même pièce.
  const records = ADMIN.summary?.totals?.price_records ?? ADMIN.lists.prices.length;
  const list = panel(
    `${counted(ADMIN.lists.prices.length, 'prix de référence', 'prix de référence')}`
    + (records > ADMIN.lists.prices.length ? ` · ${counted(records, 'relevé au total', 'relevés au total')}` : ''),
    table('price', ['Composant', 'Montant', 'Source et date de vérification', 'Actions'], rows,
      'Aucun prix en base. Le site affiche donc « Prix non renseigné » et aucun montant inventé n\'apparaît. Saisis ici les prix que tu as réellement vérifiés.',
    ),
  );

  // Les lignes sans marque enregistrée désignent une famille, pas un produit
  // vendu tel quel : aucun prix vérifié ne peut leur être rattaché honnêtement.
  const awaiting = ADMIN.components.filter((c) => !c.brand);
  const awaitingPanel = awaiting.length === 0 ? '' : panel(
    counted(awaiting.length, 'ligne attend un modèle précis', 'lignes attendent un modèle précis'),
    `<p class="hint">Tant qu'une ligne n'a pas de marque et de modèle exacts, lui donner un prix serait inventer une donnée. Ajoute le modèle réel dans l'onglet « Composants », puis enregistre son prix ici.</p>`
    + table(2, ['Famille', 'Ligne du catalogue'],
      awaiting.map((c) => [esc(labels[c.category] ?? c.category), `<b>${esc(c.name)}</b>`]),
      'Toutes les lignes du catalogue ont un modèle précis.'),
  );

  return { left: form, right: `${list}${awaitingPanel}${historyPanel()}` };
}

/** L'historique complet d'un composant, affiché sous la liste des prix. */
function historyPanel() {
  if (ADMIN.historyFor === null) return '';

  const component = ADMIN.components.find((c) => c.id === ADMIN.historyFor);
  const rows = (ADMIN.history[ADMIN.historyFor] || []).map((p) => [
    `<b>${esc(money(p.price, p.currency))}</b>`,
    esc(p.source || 'Sans source'),
    esc(p.verifiedAt || p.updatedAt),
    actions(
      `<button class="row-edit" type="button" data-edit="price:${p.id}" ${ADMIN.busy ? 'disabled' : ''}>Modifier</button>`,
      delButton('prices.php', p.id, `Supprimer ce relevé de ${money(p.price, p.currency)} ?`),
    ),
  ]);

  return panel(`Historique des prix · ${component ? esc(component.name) : 'composant ' + ADMIN.historyFor}`,
    table('price', ['Montant', 'Source', 'Date de vérification', 'Actions'], rows,
      'Ce composant n\'a aucun prix enregistré.',
    ));
}

/**
 * La famille que doit avoir « l'autre pièce du test » pour une mesure de FPS.
 * Un processeur se mesure avec une carte graphique, et inversement : c'est la
 * règle que backend/benchmarks.php vérifie aussi, pour que personne ne puisse
 * l'éviter en passant directement par une requête.
 * Les autres familles (RAM, stockage…) n'ont rien à associer : null.
 */
function pairedFamilies(componentId) {
  const measured = ADMIN.components.find((c) => String(c.id) === String(componentId));
  if (!measured) return null;
  if (measured.category === 'cpu') return ['gpu'];
  if (measured.category === 'gpu') return ['cpu'];
  return null;
}

/**
 * La pièce réellement affichée dans le menu « Composant testé » : la valeur
 * saisie, sinon le premier composant que le menu pré-sélectionne tout seul.
 */
function measuredBenchmarkId() {
  return val('b.component_id') || String(componentsInSelectOrder()[0]?.id ?? '');
}

function tabBenchmarks() {
  const editing = isEditing('benchmark');
  const games = [...defaultGames, ...ADMIN.games.filter((name) => !defaultGames.includes(name))];
  const list = games.map((name) => `<option value="${esc(name)}">`).join('');

  const allowed = pairedFamilies(measuredBenchmarkId());
  const needsPair = allowed !== null;

  const form = panel(editing ? 'Rectifier une mesure de FPS' : 'Enregistrer une mesure de FPS', `
    ${editBanner('benchmark', 'cette mesure de FPS', 'Les deux pièces du test restent modifiables : si le processeur et la carte graphique avaient été inversés, corrige-les ici.')}
    <form data-form="benchmark">
      <div class="form-grid">
        ${componentSelect('b.component_id', 'Composant testé')}
        ${componentSelect('b.paired_component_id', 'Autre pièce du test', {
          required: needsPair,
          only: allowed,
          hint: needsPair
            ? 'Les FPS dépendent des deux pièces à la fois : le chiffre ci-dessous ne veut rien dire sans le processeur ou la carte graphique qui a servi au test.'
            : 'Facultatif pour cette famille de composant.',
        })}
        <label>Jeu *<input list="game-list" data-field="b.game" value="${esc(val('b.game'))}" maxlength="120" placeholder="Cyberpunk 2077" required/></label>
        ${fieldChoice('b.resolution', 'Résolution', resolutions)}
        ${fieldChoice('b.graphics_settings', 'Qualité graphique', Object.entries(qualityLabels).map(([id, name]) => ({ id, name })))}
        ${fieldText('b.fps', 'FPS moyens', { type: 'number', required: true, attrs: 'min="1" max="100000" step="1"', placeholder: '142' })}
        ${fieldText('b.source', 'Source de la mesure', { required: false, placeholder: 'Mon test, Hardware Unboxed…', attrs: 'maxlength="180"' })}
      </div>
      <div class="form-grid">
        ${fieldText('b.source_url', 'Lien de la mesure (facultatif)', { type: 'url', placeholder: 'https://…', attrs: 'maxlength="300"', hint: 'Une source ou un lien est obligatoire : sans origine, une mesure de FPS n\'est pas vérifiable. Le bouton « Enregistrer » refuse la saisie sinon, et le site n\'affiche jamais un chiffre sans sa provenance.' })}
      </div>
      <datalist id="game-list">${list}</datalist>
      <div class="button-stack">
        <button class="button primary" type="submit" ${ADMIN.busy ? 'disabled' : ''}>${editing ? 'Mettre à jour la mesure' : 'Enregistrer la mesure'}</button>
      </div>
    </form>`);

  const rows = ADMIN.lists.benchmarks.map((b) => [
    `<b>${esc(b.component)}</b><span class="src">${esc(labels[b.category] ?? b.category)}${b.paired
      ? ' · mesuré avec ' + esc(b.paired)
      : (b.category === 'cpu' || b.category === 'gpu' ? ' · pièce associée non renseignée' : '')}</span>`,
    `${esc(b.game)}<span class="src">${esc(qualityLabels[b.graphicsSettings] ?? b.graphicsSettings)}${b.source ? ' · ' + esc(b.source) : ''}</span>`,
    `<b>${b.fps} FPS</b><span class="src">${esc(b.resolution)}</span>`,
    esc(b.createdAt),
    actions(
      `<button class="row-edit" type="button" data-edit="benchmark:${b.id}" ${ADMIN.busy ? 'disabled' : ''}>Modifier</button>`,
      delButton('benchmarks.php', b.id, `Supprimer la mesure de ${b.fps} FPS sur « ${b.game} » ?`),
    ),
  ]);

  const listPanel = panel(
    `${counted(ADMIN.lists.benchmarks.length, 'mesure de FPS en base', 'mesures de FPS en base')}`,
    table('benchmark', ['Composant', 'Jeu', 'Résultat', 'Date', 'Actions'], rows,
      'Aucune mesure de FPS en base. Les pages FPS Range et Upgrade Path affichent donc « non disponible » au lieu d\'un chiffre inventé.',
    ),
  );

  return { left: form, right: listPanel };
}

function tabCompat() {
  const form = panel('Consigner un constat entre deux pièces', `
    <form data-form="compat">
      <div class="form-grid">
        ${componentSelect('k.component_id', 'Premier composant')}
        ${componentSelect('k.compatible_component_id', 'Second composant')}
        ${fieldChoice('k.compatibility_status', 'Verdict', Object.entries(statusLabels).map(([id, name]) => ({ id, name })))}
        ${fieldText('k.notes', 'Note', { placeholder: 'Révision de BIOS 1.20 nécessaire', attrs: 'maxlength="500"' })}
      </div>
      <p class="spec-note">
        Ces constatations sont le deuxième niveau du Compatibility Checker : ce que les règles
        techniques ne peuvent pas déduire seules (révision de BIOS, longueur d'une carte graphique
        dans un boîtier, ventirad qui masque une barrette). Si la paire existe déjà, saisi de
        nouveau : le verdict et la note sont remplacés, sans doublon.
      </p>
      <div class="button-stack">
        <button class="button primary" type="submit" ${ADMIN.busy ? 'disabled' : ''}>Enregistrer le constat</button>
      </div>
    </form>`);

  const rows = ADMIN.lists.compat.map((r) => [
    `<b>${esc(r.component.name)}</b><span class="src">${esc(labels[r.component.category] ?? '')}</span>`,
    `<b>${esc(r.with.name)}</b><span class="src">${esc(labels[r.with.category] ?? '')}</span>`,
    `${esc(statusLabels[r.status] ?? r.status)}<span class="src">${esc(r.notes || 'Sans note')} · ${esc(r.createdAt)}</span>`,
    actions(delButton('compatibility.php', r.id, `Supprimer le constat « ${r.component.name} ↔ ${r.with.name} » ?`)),
  ]);

  const list = panel(
    `${counted(ADMIN.lists.compat.length, 'constat enregistré', 'constats enregistrés')}`,
    table('compat', ['Pièce A', 'Pièce B', 'Verdict et note', 'Actions'], rows,
      'Aucun constat enregistré dans la table `compatibility`. Le Compatibility Checker applique quand même les règles techniques (socket, DDR) lues dans les caractéristiques.',
    ),
  );

  return { left: form, right: list };
}

function tabConfigs() {
  const info = panel('D\'où viennent ces lignes', `
    <p class="spec-note">
      Chaque configuration ici est un PC enregistré depuis la page PC Builder du site
      (bouton « Enregistrer »). Le total affiché est calculé par PHP à partir des prix
      réellement présents dans la base : si une pièce n'a pas de prix, le total reste
      vide au lieu d'être incomplet et présenté comme exact.
    </p>
    <div class="button-stack">
      <button class="button" type="button" data-refresh="1" ${ADMIN.busy ? 'disabled' : ''}>Recharger la liste</button>
    </div>`);

  const rows = ADMIN.lists.configs.map((c) => [
    `<b>${esc(c.name)}</b><span class="src">${counted(c.components.length, 'pièce', 'pièces')} · ${esc(c.resolution)} · ${esc(c.usage)}</span>`,
    c.totalPrice === null
      ? '<span class="src">Total non calculé : une pièce n\'a pas de prix en base.</span>'
      : esc(money(c.totalPrice, 'DZD')),
    esc(c.createdAt),
    actions(delButton('configurations.php', c.id, `Supprimer la configuration « ${c.name} » et ses pièces liées ?`)),
  ]);

  const list = panel(
    `${counted(ADMIN.lists.configs.length, 'configuration enregistrée en base', 'configurations enregistrées en base')}`,
    table('config', ['Nom', 'Total calculé par PHP', 'Enregistrée le', 'Actions'], rows,
      'Aucune configuration enregistrée dans MySQL. Ouvre le PC Builder du site et clique sur « Enregistrer ».',
    ),
  );

  return { left: info, right: list };
}

const renderers = {
  components: tabComponents,
  prices: tabPrices,
  benchmarks: tabBenchmarks,
  compat: tabCompat,
  configs: tabConfigs,
};

/* ---------------------------------------------------------------------- */
/* 6. Dessin de la page                                                    */
/* ---------------------------------------------------------------------- */

/** Copie ce qui est tapé dans les champs, pour ne rien perdre au redraw. */
function capture() {
  document.querySelectorAll('#admin [data-field]').forEach((el) => {
    ADMIN.values[el.dataset.field] = el.value;
  });
}

/** Remet un formulaire à ses valeurs de départ après une saisie réussie. */
function clearForm(prefix) {
  Object.keys(ADMIN.values).forEach((key) => {
    if (key.startsWith(prefix)) delete ADMIN.values[key];
  });
  Object.entries(formDefaults).forEach(([key, value]) => {
    if (key.startsWith(prefix)) ADMIN.values[key] = value;
  });
}

/** « 1 prix » / « 3 prix » : le singulier et le pluriel sont écrits à la main. */
const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function statusChips() {
  const totals = ADMIN.summary?.totals;
  if (!totals) {
    return '<div class="admin-status"><span class="bad">Lecture des compteurs impossible</span></div>';
  }

  const chips = [
    { text: counted(totals.components, 'composant', 'composants') },
    // Un prix ou une mesure à zéro doit rester visible comme un manque.
    { text: counted(totals.price_records, 'prix sourcé', 'prix sourcés'), warn: totals.price_records === 0 },
    { text: counted(totals.benchmarks, 'mesure de FPS', 'mesures de FPS'), warn: totals.benchmarks === 0 },
    { text: counted(totals.compatibility_rows, 'constat de compatibilité', 'constats de compatibilité') },
    { text: counted(totals.configurations, 'PC enregistré', 'PC enregistrés') },
  ];

  return `<div class="admin-status">${chips.map((chip) =>
    `<span class="${chip.warn ? 'bad' : ''}">${esc(chip.text)}</span>`).join('')}</div>`;
}

/**
 * Barre de connexion, posée au-dessus des onglets.
 *
 * Elle ne fait que demander le mot de passe à backend/login.php : la page
 * n'apprend jamais l'empreinte attendue, et le mot de passe tapé n'est ni
 * enregistré dans ADMIN.values ni dessiné de nouveau après un redraw.
 */
function authBar() {
  if (!ADMIN.auth.checked) return '';

  if (ADMIN.auth.configured === false) {
    return `<div class="alert bad">Aucun mot de passe n'est configuré sur ce serveur : le fichier
      <code>backend/admin-credentials.php</code> est absent. Les écritures restent donc fermées —
      voir <code>backend/new-password.php</code> pour en choisir un.</div>`;
  }

  if (ADMIN.auth.signedIn) {
    return `<div class="admin-auth ok">
      <span class="dot ok"></span>
      <span><b>Connecté.</b> Tu peux enregistrer, corriger et supprimer.</span>
      <button class="button outline" type="button" data-logout="1" ${ADMIN.busy ? 'disabled' : ''}>Se déconnecter</button>
    </div>`;
  }

  return `<div class="admin-auth">
    <span class="dot"></span>
    <form data-form="auth">
      <label>Mot de passe administrateur
        <input type="password" name="password" autocomplete="current-password" placeholder="Celui que tu as choisi pour l'administration" />
      </label>
      <button class="button primary" type="submit" ${ADMIN.busy ? 'disabled' : ''}>Se connecter</button>
    </form>
    <small>Sans connexion, la page reste en lecture : tu vois tout, tu n'écris rien.</small>
  </div>`;
}

function render() {
  const content = ADMIN.loaded
    ? renderers[ADMIN.tab]()
    : { left: panel('Chargement', '<p class="spec-note">Lecture de la base MySQL…</p>'), right: '' };

  const error = ADMIN.error
    ? `<div class="alert bad">Échec de l'opération : ${esc(ADMIN.error.message)}${ADMIN.error.hint ? ` — ${esc(ADMIN.error.hint)}` : ''}</div>`
    : '';

  document.getElementById('admin').innerHTML = `
  <div class="admin-wrap">
    <div class="admin-top">
      <div>
        <div class="eyebrow">BUILDWISE / BASE DE DONNÉES</div>
        <h1>Saisie des données</h1>
        <p>
          Cette page écrit dans MySQL par l'intermédiaire de backend/. Elle ne contient aucun mot de
          passe : seul le PHP serveur connaît ses identifiants. Rien n'est inventé : une ligne absente
          reste absente, et le site l'affiche comme telle.
        </p>
      </div>
      <div class="admin-links">
        <a href="index.html">← Retour au site</a>
        <a href="backend/check.php">Vérifier la connexion</a>
        <a href="README.md">Documentation</a>
      </div>
    </div>

    ${statusChips()}
    ${authBar()}
    ${error}

    <div class="admin-tabs">
      ${tabs.map((tab) => `<button class="admin-tab ${ADMIN.tab === tab.id ? 'on' : ''}" data-tab="${tab.id}" type="button">${esc(tab.name)}</button>`).join('')}
      <button class="admin-tab" data-refresh="1" type="button" title="Relire la base">Actualiser</button>
    </div>

    <div class="admin-grid">
      <div class="stack">${content.left}</div>
      <div class="stack">${content.right}</div>
    </div>
  </div>`;

  // Second relevé : un <select> non touché par l'utilisateur a déjà une valeur
  // affichée (le premier composant de la liste). On l'enregistre pour que le
  // formulaire envoie exactement ce que la page montre.
  capture();
}

function notify(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove('show'), 3600);
}

/* ---------------------------------------------------------------------- */
/* 7. Événements                                                           */
/* ---------------------------------------------------------------------- */

/** Lit le corps JSON à envoyer selon l'onglet, à partir des champs saisis. */
function buildBody() {
  if (ADMIN.tab === 'components') {
    const category = val('c.category', 'cpu');
    const specifications = {};

    (specFields[category] ?? []).forEach((f) => {
      const raw = val('spec.' + f.key, '').trim();
      if (raw === '') return;
      specifications[f.key] = f.type === 'number' ? Number(raw) : raw;
    });

    return {
      name: val('c.name').trim(),
      brand: val('c.brand').trim(),
      category,
      slug: val('c.slug').trim(),
      specifications,
    };
  }

  if (ADMIN.tab === 'prices') {
    return {
      component_id: Number(val('p.component_id')),
      price: Number(val('p.price')),
      currency: val('p.currency', 'DZD'),
      source: val('p.source').trim(),
      source_url: val('p.source_url').trim(),
      verified_at: val('p.verified_at').trim(),
    };
  }

  if (ADMIN.tab === 'benchmarks') {
    return {
      component_id: Number(val('b.component_id')),
      // Chaîne vide = pas d'association (autorisé hors CPU/GPU) ; PHP répond
      // avec un message explicite si la mesure avait pourtant besoin d'une.
      paired_component_id: val('b.paired_component_id') === '' ? '' : Number(val('b.paired_component_id')),
      game: val('b.game').trim(),
      resolution: val('b.resolution', '1080p'),
      graphics_settings: val('b.graphics_settings', 'high'),
      fps: Number(val('b.fps')),
      source: val('b.source').trim(),
      source_url: val('b.source_url').trim(),
    };
  }

  return {
    component_id: Number(val('k.component_id')),
    compatible_component_id: Number(val('k.compatible_component_id')),
    compatibility_status: val('k.compatibility_status', 'unknown'),
    notes: val('k.notes').trim(),
  };
}

const formPrefix = { components: 'c.', prices: 'p.', benchmarks: 'b.', compat: 'k.' };

/** Le type de ligne que chaque formulaire sait rectifier (voir ADMIN.editing). */
const formKind = { component: null, price: 'price', benchmark: 'benchmark', compat: null };

/** Même information, cette fois depuis l'adresse appelée (pour les suppressions). */
const endpointKind = { 'prices.php': 'price', 'benchmarks.php': 'benchmark' };

/**
 * Connexion : le mot de passe part directement vers backend/login.php, sans
 * jamais être recopié dans ADMIN.values ni réaffiché par un redraw du champ.
 */
async function signIn(form) {
  if (ADMIN.busy) return;

  const password = form.password ? form.password.value : '';

  ADMIN.busy = true;
  ADMIN.error = null;
  render();

  try {
    await API.login(password);
    ADMIN.auth = { checked: true, signedIn: true, configured: true };
    notify('Connecté : les écritures dans MySQL sont ouvertes.');
  } catch (error) {
    ADMIN.error = error;
    noteAuthProblem(error);
  }

  ADMIN.busy = false;
  render();
}

async function signOut() {
  if (ADMIN.busy) return;

  ADMIN.busy = true;

  try {
    await API.logout();
    ADMIN.auth = { checked: true, signedIn: false, configured: true };
    notify('Déconnecté. La page est revenue en lecture seule.');
  } catch (error) {
    ADMIN.error = error;
    noteAuthProblem(error);
  }

  ADMIN.busy = false;
  render();
}

/** Une écriture refusée pour cause de session doit se voir dans la barre. */
function noteAuthProblem(error) {
  if (/Mot de passe administrateur|Jeton de sécurité/.test((error && error.message) || '')) {
    ADMIN.auth = { checked: true, signedIn: false, configured: true };
  }
}

async function handleSubmit(form) {
  if (form.dataset.form === 'auth') {
    await signIn(form);
    return;
  }

  capture();

  const name = form.dataset.form;
  const endpoint = { component: 'components.php', price: 'prices.php', benchmark: 'benchmarks.php', compat: 'compatibility.php' }[name];
  const editing = formKind[name] && isEditing(formKind[name]) ? ADMIN.editing : null;

  const body = buildBody();
  if (editing) body.id = editing.id;

  await submit(endpoint, body, async () => {
    clearForm(formPrefix[ADMIN.tab]);
    ADMIN.editing = null;
    ADMIN.history = {};
    ADMIN.historyFor = null;
  }, editing ? 'put' : 'post');
}

/**
 * Charge une ligne déjà enregistrée dans le formulaire de gauche, pour la
 * rectifier au lieu d'en créer une nouvelle.
 */
function startEdit(kind, id) {
  capture();

  const rows = kind === 'price' ? ADMIN.lists.prices : ADMIN.lists.benchmarks;
  const row = rows.find((item) => item.id === id);

  if (!row) {
    notify('Cette ligne n\'est plus dans la liste. Clique sur « Actualiser » puis réessaie.');
    return;
  }

  ADMIN.tab = kind === 'price' ? 'prices' : 'benchmarks';
  ADMIN.editing = { kind, id };
  ADMIN.error = null;

  if (kind === 'price') {
    Object.assign(ADMIN.values, {
      'p.component_id': String(row.componentId),
      'p.price': String(row.price),
      'p.currency': row.currency,
      'p.verified_at': row.verifiedAt || todayIso(),
      'p.source': row.source || '',
      'p.source_url': row.sourceUrl || '',
    });
  } else {
    Object.assign(ADMIN.values, {
      'b.component_id': String(row.componentId),
      'b.paired_component_id': row.pairedId ? String(row.pairedId) : '',
      'b.game': row.game,
      'b.resolution': row.resolution,
      'b.graphics_settings': row.graphicsSettings,
      'b.fps': String(row.fps),
      'b.source': row.source || '',
      'b.source_url': row.sourceUrl || '',
    });
  }

  render();
  notify('Ligne chargée dans le formulaire à gauche. Corrige, puis clique sur « Mettre à jour ».');
}

/** On revient en mode ajout : le formulaire reprend ses valeurs de départ. */
function cancelEdit() {
  const prefix = isEditing('price') ? 'p.' : 'b.';
  ADMIN.editing = null;
  clearForm(prefix);
  render();
}

async function handleHistory(componentId) {
  ADMIN.historyFor = componentId;

  if (!ADMIN.history[componentId]) {
    try {
      const response = await API.get('prices.php', { component_id: componentId });
      ADMIN.history[componentId] = response.data.prices;
    } catch (error) {
      ADMIN.error = error;
    }
  }

  render();
}

function wire() {
  const root = document.getElementById('admin');

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target.closest('form[data-form]');
    if (form) handleSubmit(form);
  });

  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-logout]')) {
      await signOut();
      return;
    }

    const tab = event.target.closest('[data-tab]');
    if (tab) {
      capture();
      ADMIN.tab = tab.dataset.tab;
      ADMIN.error = null;
      ADMIN.loaded = false;
      ADMIN.historyFor = null;
      // Changer d'onglet abandonne la rectification en cours : le formulaire
      // de l'onglet suivant n'a rien à voir avec la ligne chargée.
      ADMIN.editing = null;
      render();
      await refresh();
      return;
    }

    if (event.target.closest('[data-cancel-edit]')) {
      cancelEdit();
      return;
    }

    const edit = event.target.closest('[data-edit]');
    if (edit) {
      const [kind, id] = edit.dataset.edit.split(':');
      startEdit(kind, Number(id));
      return;
    }

    if (event.target.closest('[data-refresh]')) {
      ADMIN.loaded = false;
      ADMIN.editing = null;
      render();
      await refresh();
      return;
    }

    const history = event.target.closest('[data-history]');
    if (history) {
      await handleHistory(Number(history.dataset.history));
      return;
    }

    const del = event.target.closest('[data-del]');
    if (del) {
      if (!window.confirm(del.dataset.confirm || 'Supprimer cette ligne de la base ?')) return;
      const [endpoint, id] = del.dataset.del.split(':');
      await remove(endpoint, Number(id));
    }
  });

  // Garder la saisie entre deux dessins d'écran, et redessiner quand la
  // famille change (les champs techniques dépendent d'elle).
  root.addEventListener('input', capture);
  root.addEventListener('change', (event) => {
    capture();
    if (event.target.dataset.field === 'c.category') render();

    // La liste des « autres pièces du test » dépend de la famille du composant
    // mesuré : changer ce choix redessine le second menu, et une association
    // qui ne correspond plus (un processeur associé à un processeur) est
    // retirée du formulaire au lieu d'être envoyée à PHP pour se faire refuser.
    if (event.target.dataset.field === 'b.component_id') {
      const allowed = pairedFamilies(measuredBenchmarkId());
      const current = val('b.paired_component_id');
      const piece = ADMIN.components.find((c) => String(c.id) === String(current));
      if (current && (!piece || (allowed && !allowed.includes(piece.category)))) {
        delete ADMIN.values['b.paired_component_id'];
      }
      render();
    }
  });
}

async function refresh() {
  try {
    await loadTab();
    ADMIN.error = null;
  } catch (error) {
    // La base est peut-être éteinte : on l'affiche, la page reste utilisable.
    ADMIN.error = error;
    ADMIN.loaded = true;
  }
  render();
}

/* ---------------------------------------------------------------------- */
/* 8. Démarrage                                                            */
/* ---------------------------------------------------------------------- */

/**
 * Valeurs de départ des menus déroulants : la page reste compréhensible avant
 * la première saisie, et un formulaire vidé revient à ces valeurs-là.
 */
const formDefaults = {
  'c.category': 'cpu',
  'p.currency': 'DZD',
  // La date du jour par défaut : on relève presque toujours un prix le jour où
  // on le voit. Le champ reste modifiable pour un relevé plus ancien.
  'p.verified_at': todayIso(),
  'b.resolution': '1080p',
  'b.graphics_settings': 'high',
  'k.compatibility_status': 'unknown',
};

async function boot() {
  ADMIN.values = { ...formDefaults };

  render();
  wire();

  // Première question au serveur : cette fenêtre est-elle déjà connectée ?
  // Un échec ici (login.php absent, base éteinte) laisse la page en lecture.
  try {
    const status = await API.authStatus();
    ADMIN.auth = {
      checked: true,
      signedIn: status.signedIn === true,
      configured: status.configured !== false,
    };
  } catch {
    ADMIN.auth = { checked: true, signedIn: false, configured: true };
  }

  render();
  refresh();
}

boot();
