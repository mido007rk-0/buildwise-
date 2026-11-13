/**
 * views.js — Les 11 écrans de BuildWise.
 *
 * Chaque fonction retourne une chaîne de HTML, exactement comme dans la
 * version d'origine. Les classes et le squelette ne changent pas : c'est le
 * CSS de la version 2.0 qui dessine tout. Seules les valeurs affichées
 * viennent maintenant de MySQL, via DB et catalog.
 *
 * Règle reprise du projet d'origine, appliquée partout :
 *   un prix ou un FPS absent de la base reste affiché comme absent.
 */

/** Échappe le HTML : un nom de composant saisi en base ne peut pas casser la page. */
const safe = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * « 1 mesure » / « 3 mesures » : évite les « mesure(s) » difficiles à lire.
 * `one` et `many` portent le mot entier, accords compris.
 */
const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;

/**
 * Fabrique les <option> d'un menu déroulant.
 *
 * La valeur d'une option est, dans cet ordre :
 *   x.value → la référence du catalogue MySQL (le slug, 'r5-7600'),
 *   x.id    → un id simple ('60' pour 60 FPS, 'gaming' pour un usage),
 *   x       → une chaîne nue ('1080p').
 * C'est le slug qui est utilisé pour les composants, comme dans la version
 * d'origine : les configurations déjà enregistrées dans le navigateur
 * continuent de se retrouver dans les menus déroulants.
 */
const optionValue = (x) => x?.value ?? x?.id ?? x;

function options(list, selected) {
  return list.map((x) => `<option value="${safe(optionValue(x))}" ${String(selected) === String(optionValue(x)) ? 'selected' : ''}>${safe(x.name ?? x)}</option>`).join('');
}

const chooser = (items, value, field, attrs = '') => `<select data-field="${field}" ${attrs}>${options(items, value)}</select>`;
const input = (value, field, type = 'text', placeholder = '', attrs = '') => `<input type="${type}" value="${safe(value)}" placeholder="${safe(placeholder)}" data-field="${field}" ${attrs}/>`;

function panel(title, body, cls = '') {
  return `<section class="panel ${cls}"><div class="panel-title">${title}</div>${body}</section>`;
}

const buttonRoute = (r, label, cls = 'button primary') => `<button class="${cls}" data-route="${r}">${label} <span aria-hidden="true">↗</span></button>`;
const mini = (label, value, detail = '') => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;

/**
 * Pastille d'état de la base, en haut de chaque page.
 * Elle remplace l'ancienne mention « Mode local · pas de prix live », qui
 * n'était plus vraie dès lors que le site est branché sur MySQL.
 */
function databaseChip() {
  if (DB.status === 'chargement') {
    return `<div class="data-label db-loading"><span class="pulse"></span> Chargement depuis MySQL…</div>`;
  }

  if (DB.status === 'hors-ligne') {
    return `<div class="data-label db-offline"><span class="pulse"></span> Base MySQL hors ligne</div>`;
  }

  const priceCount = Object.keys(DB.prices).length;
  const text = priceCount > 0
    ? `Base MySQL · ${priceCount} prix sourcé${priceCount > 1 ? 's' : ''}`
    : `Base MySQL · ${DB.totals.components || 0} composants, aucun prix saisi`;

  return `<div class="data-label"><span class="pulse"></span> ${safe(text)}</div>`;
}

function appHeader(title, kicker, desc) {
  return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${databaseChip()}</div>`;
}

/**
 * Bandeau de panne de base, affiché sur toutes les pages quand PHP ou MySQL
 * ne répond pas. Message clair, aucune donnée inventée pour masquer l'absence.
 */
function offlineBanner() {
  if (DB.status !== 'hors-ligne') return '';

  const message = String(DB.error?.message || 'erreur inconnue').replace(/\.+$/, '');
  const hint = String(DB.error?.hint || '').replace(/\.+$/, '');

  return `<div class="alert bad">
    <b>Base de données injoignable :</b> ${safe(message)}.
    ${hint ? `<span class="src">${safe(hint)}.</span>` : ''}
    <div class="db-links"><a href="backend/check.php">Ouvrir le diagnostic backend/check.php</a><button class="text-link" data-action="retry-db">Réessayer</button></div>
  </div>`;
}

/* --------------------------------------------------------------------- */
/*  Règles techniques — inchangées par rapport à la version d'origine.    */
/* --------------------------------------------------------------------- */

/**
 * Les 6 contrôles du Compatibility Checker.
 * Ils lisent `socket` et `ramType`, qui arrivent maintenant de la colonne
 * JSON `specifications` de MySQL, mise à plat par catalog.js.
 */
function checkBuild(build) {
  const cpu = part('cpu', build.parts.cpu);
  const board = part('board', build.parts.board);
  const ram = part('ram', build.parts.ram);
  const tests = [];

  if (cpu && board) tests.push({ title: 'Socket CPU / carte mère', state: cpu.socket === board.socket ? 'ok' : 'bad', detail: `CPU ${cpu.socket} · carte mère ${board.socket}. Validation indicative du socket ; BIOS à vérifier.` });
  else tests.push({ title: 'Socket CPU / carte mère', state: 'unknown', detail: 'CPU et carte mère à sélectionner.' });

  if (ram && board) tests.push({ title: 'Génération RAM / carte mère', state: ram.ramType === board.ramType ? 'ok' : 'bad', detail: `RAM ${ram.ramType} · carte mère ${board.ramType}. Fréquence, capacité max et QVL non vérifiées.` });
  else tests.push({ title: 'Génération RAM / carte mère', state: 'unknown', detail: 'RAM et carte mère à sélectionner.' });

  tests.push({ title: 'Carte graphique / boîtier', state: 'unknown', detail: 'Longueur exacte du GPU et dégagement intérieur du boîtier non renseignés.' });
  tests.push({ title: 'Alimentation / composants', state: 'unknown', detail: 'Puissance système, qualité du bloc et connecteurs non vérifiés. La puissance nominale seule ne suffit pas.' });
  tests.push({ title: 'Refroidissement / CPU', state: 'unknown', detail: 'Montage sur socket, hauteur ou radiateur et capacité thermique à confirmer chez le fabricant.' });
  tests.push({ title: 'Connectiques et dimensions', state: 'unknown', detail: 'Ports, format de carte, emplacements M.2 et câblage à contrôler sur les fiches fabricant.' });

  return tests;
}

/** Total des prix affichés dans le formulaire (base + saisies manuelles). */
function total(build) {
  const nums = order.map((k) => Number(build.prices?.[k]));
  const count = order.filter((k) => build.prices?.[k] !== '' && build.prices?.[k] != null && Number.isFinite(Number(build.prices[k])) && Number(build.prices[k]) >= 0).length;

  return {
    value: nums.reduce((a, n) => a + (Number.isFinite(n) && n >= 0 ? n : 0), 0),
    count,
    complete: count === order.length,
  };
}

/** Combien des prix du formulaire viennent réellement de la base. */
function priceOrigins(build) {
  let fromDatabase = 0;
  let manual = 0;

  order.forEach((key) => {
    const value = build.prices?.[key];
    if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) return;
    if (build.priceOrigin?.[key] === 'manuel') manual += 1;
    else fromDatabase += 1;
  });

  return { fromDatabase, manual, declared: fromDatabase + manual };
}

/** Une petite ligne de provenance : « 98 500 DZD · Boutique · vérifié le 10 nov. 2026 ». */
function priceSourceLine(price) {
  if (!price) return '';
  const parts = [`<b>${formatDzd(price.value)}</b>`];
  if (price.source) parts.push(safe(price.source));
  if (price.date) parts.push(`vérifié le ${formatDate(price.date)}`);
  if (price.sourceUrl) parts.push(`<a href="${safe(price.sourceUrl)}" target="_blank" rel="noopener noreferrer">voir la source</a>`);
  return `<span class="src">${parts.join(' · ')}</span>`;
}

/**
 * Une ligne du catalogue sans marque enregistrée désigne une famille
 * (« SSD NVMe 1 To », « Alimentation 650 W ») et non un produit vendu tel quel :
 * aucun prix vérifié ne peut lui être rattaché honnêtement.
 */
function needsExactModel(component) {
  return Boolean(component) && !component.brand;
}

/* --------------------------------------------------------------------- */
/*  1 / Accueil                                                            */
/* --------------------------------------------------------------------- */

function home() {
  const saved = state.saved.length;
  const inDatabase = DB.configurations.length;
  const checked = checkBuild(state.build);
  const priceCount = Object.keys(DB.prices).length;

  return `${offlineBanner()}
  <div class="hero">
    <div class="hero-glow"></div>
    <div class="hero-copy">
      <div class="hero-pill"><span class="pulse"></span> BUILDWISE 2.0 <span class="line">/</span> ALGERIA EDITION</div>
      <h1>Build smarter.<br/><em>Game better.</em></h1>
      <p>Construis, compare et améliore ton PC avec une seule plateforme. Des conseils clairs, des contrôles de compatibilité transparents et un budget en dinars algériens.</p>
      <div class="hero-actions">${buttonRoute('builder', 'Créer ma configuration')}${buttonRoute('goal', 'Trouver mon PC idéal', 'button subtle')}</div>
      <div class="hero-foot"><span>◉ Conçu pour l’Algérie</span><span>◇ Analyse explicable</span><span>↗ Base MySQL locale</span></div>
    </div>
    <div class="hero-visual">
      <div class="pc-illustration">
        <div class="pc-top"><span>BUILDWISE / SYSTEM 01</span><span>● ● ●</span></div>
        <div class="pc-window">
          <div class="fan f1">✳</div><div class="fan f2">✳</div>
          <div class="gpu-line"></div><div class="core-block">BW</div>
          <div class="circuit">│ ━ ┃ ─ │ ━ ┃</div>
        </div>
        <div class="pc-bottom"><span>POWERED BY SMART CHOICES</span><span class="green">● ONLINE</span></div>
      </div>
      <div class="float-tag">✓ Compatibility insights</div>
    </div>
  </div>

  <div class="metrics">
    ${mini('COMPOSANTS EN BASE', String(DB.totals.components || catalog.cpu.length + catalog.gpu.length || '—'), 'Table components')}
    ${mini('PRIX SOURCÉS', String(priceCount), priceCount ? 'Table component_prices' : 'Aucun : saisis-les dans admin.html')}
    ${mini('MESURES DE FPS', String(DB.totals.benchmarks || 0), DB.totals.benchmarks ? 'Table benchmarks' : 'Aucune mesure en base')}
    ${mini('DEVISE', DB.totals.currency || 'DZD', `${saved} configuration${saved > 1 ? 's' : ''} dans ce navigateur, ${inDatabase} en base`)}
  </div>

  <div class="section-header">
    <div><div class="eyebrow">TOOLKIT</div><h2>Tout pour ton prochain PC</h2></div>
    <span>Choisis un outil pour commencer ↘</span>
  </div>
  <div class="feature-grid">${[
    ['builder', '▣', 'PC Builder', 'Assemble une configuration et suis tes dépenses en DZD.'],
    ['compare', '⇄', 'SmartPrice', 'Compare des configurations avec les données disponibles.'],
    ['compat', '◇', 'Compatibility Checker', 'Vérifie les correspondances techniques connues.'],
    ['doctor', '✚', 'PC Doctor', 'Résous les problèmes courants étape par étape.'],
    ['goal', '◎', 'GoalMatch', 'Définis tes objectifs et découvre une orientation matérielle.'],
    ['resolution', '▤', 'Resolution Advisor', 'Choisis entre 1080p, 1440p et 4K.'],
  ].map(([r, ic, title, desc]) => `<button class="feature-card" data-route="${r}"><div class="feature-icon">${ic}</div><h3>${title}</h3><p>${desc}</p><span class="feature-link">Explorer ↗</span></button>`).join('')}</div>

  <div class="why">
    <div><div class="eyebrow">POURQUOI BUILDWISE ?</div><h2>La transparence avant les chiffres.</h2>
    <p>Pas de fausses offres algériennes, pas de pourcentages de bottleneck inventés et pas de FPS sortis de nulle part. Lorsque les données manquent, BuildWise l’indique.</p></div>
    <div class="why-points">
      <div>01 <b>Budget local</b><span>Prix en dinars algériens, avec leur source</span></div>
      <div>02 <b>Conseils utiles</b><span>Règles expliquées, pas de verdict opaque</span></div>
      <div>03 <b>Respect des sources</b><span>Un statut inconnu reste inconnu</span></div>
    </div>
  </div>

  ${DB.status === 'pret' ? `<div class="db-links"><a href="admin.html">Gérer les prix et les mesures (admin.html)</a><a href="backend/check.php">Diagnostic de la base</a></div>` : ''}`;
}

/* --------------------------------------------------------------------- */
/*  2 / PC Builder                                                         */
/* --------------------------------------------------------------------- */

function builder() {
  const b = state.build;
  const t = total(b);
  const origins = priceOrigins(b);
  const tests = checkBuild(b);
  const errors = tests.filter((x) => x.state === 'bad').length;

  const rows = order.map((key, index) => {
    // Le filtre de marque (toutes marques / AMD / Intel) fonctionnait déjà.
    const filtered = (key === 'cpu' && b.cpuBrand !== 'all' ? catalog[key].filter((x) => x.brand === b.cpuBrand)
      : key === 'gpu' && b.gpuBrand !== 'all' ? catalog[key].filter((x) => x.brand === b.gpuBrand)
      : catalog[key]);

    const selected = part(key, b.parts[key]);
    const price = databasePrice(b.parts[key]);
    const manual = b.priceOrigin?.[key] === 'manuel';

    // Une seule ligne de provenance, pour ne pas contredire le montant affiché.
    const source = manual
      ? `<span class="src">Montant saisi à la main, non vérifié en base.${price ? ` Prix connu en base pour cette pièce : ${formatDzd(price.value)}.` : ' Aucun prix en base pour cette pièce.'}</span>`
      : price
        ? priceSourceLine(price)
        : selected
          ? `<span class="src">${needsExactModel(selected)
            ? 'Prix non renseigné : cette ligne du catalogue n’a pas encore de marque ni de modèle précis.'
            : 'Prix non renseigné : aucun prix vérifié en base pour ce composant.'}</span>`
          : '';

    return `<div class="part-row">
      <div class="part-index">${String(index + 1).padStart(2, '0')}</div>
      <div class="part-select">
        <label>${labels[key]}</label>
        ${chooser([{ id: '', name: '— Non sélectionné —' }, ...filtered], b.parts[key], 'part.' + key)}
      </div>
      <div class="part-price">
        <label>Prix · DZD</label>
        ${input(b.prices[key] ?? '', 'price.' + key, 'number', 'Non renseigné', 'min="0"')}
        ${source}
      </div>
    </div>`;
  }).join('');

  return `${appHeader('PC Builder', 'BUILD / 01', 'Compose ta configuration. Les prix viennent de la base MySQL quand ils existent ; tu peux aussi en saisir un à la main.')}
  ${offlineBanner()}
  <div class="two-col">
    <div class="stack">
      ${panel('01 / Ton objectif', `<div class="form-grid">
        <label>Nom de la configuration${input(b.name, 'build.name')}</label>
        <label>Budget maximal (DZD)${input(b.budget, 'build.budget', 'number', '', 'min="0"')}</label>
        <label>Utilisation${chooser(uses, b.use, 'build.use')}</label>
        <label>Résolution${chooser(['1080p', '1440p', '4K'], b.resolution, 'build.resolution')}</label>
        <label>Jeu principal${chooser(DB.games(), b.game, 'build.game')}</label>
        <label>Préférence processeur${chooser([{ id: 'all', name: 'Toutes marques' }, { id: 'AMD', name: 'AMD' }, { id: 'Intel', name: 'Intel' }], b.cpuBrand, 'build.cpuBrand')}</label>
        <label>Préférence GPU${chooser([{ id: 'all', name: 'Toutes marques' }, { id: 'NVIDIA', name: 'NVIDIA' }, { id: 'AMD', name: 'AMD' }], b.gpuBrand, 'build.gpuBrand')}</label>
      </div>`)}

      ${panel('02 / Composants', `<div class="parts-list">${rows}</div>
        <p class="hint">Catalogue lu dans la table <b>components</b> de MySQL. Les noms marquant une famille (« type », « modèle à préciser »), vérifie le modèle exact avant achat. Pour ajouter une pièce, passe par admin.html.</p>`)}
    </div>

    <div class="stack sticky-stack">
      ${panel('Récapitulatif', `
        <div class="summary-number">${formatDzd(t.value)}</div>
        <p class="hint">${t.count} / ${order.length} prix renseignés · ${t.complete ? 'Total entièrement renseigné' : 'Total partiel, ne représente pas le coût complet'}</p>
        ${t.count ? `<span class="src">${origins.fromDatabase} prix venant de la base · ${plural(origins.manual, 'montant saisi à la main', 'montants saisis à la main')}</span>` : ''}
        <div class="budget-track"><span style="width:${b.budget > 0 ? Math.min(t.value / Number(b.budget) * 100, 100) : 0}%"></span></div>
        <div class="summary-split"><span>Budget cible</span><b>${formatDzd(Number(b.budget) || 0)}</b></div>
        <div class="summary-split"><span>Écart sur prix affichés</span><b class="${t.value > Number(b.budget) ? 'red' : 'green'}">${formatDzd((Number(b.budget) || 0) - t.value)}</b></div>
        ${errors ? `<div class="alert bad">${plural(errors, 'incompatibilité de référence détectée', 'incompatibilités de référence détectées')}.</div>` : `<div class="alert muted">Les contrôles incomplets restent à vérifier.</div>`}
        <div class="button-stack">
          <button class="button primary full" data-action="save-build" ${DB.status === 'hors-ligne' ? 'disabled' : ''}>Enregistrer cette configuration ↗</button>
          <button class="button outline full" data-action="export">Exporter les données JSON</button>
        </div>
        ${DB.status === 'hors-ligne' ? '<p class="hint">Enregistrement en base indisponible : le backend PHP ne répond pas.</p>' : ''}`)}

      ${panel('Contrôles rapides', `<div class="checks">${tests.slice(0, 3).map((x) => `<div><span class="dot ${x.state}"></span>${x.title}<strong>${x.state === 'ok' ? 'Indicatif OK' : x.state === 'bad' ? 'Conflit' : 'À vérifier'}</strong></div>`).join('')}</div>
        <button class="text-link" data-route="compat">Ouvrir le Compatibility Checker ↗</button>`)}

      ${panel('Guide du choix', `<p class="body-muted">${b.use === 'gaming' ? 'En jeu, le GPU influence souvent fortement la fluidité et la résolution possible.' : b.use === 'video' || b.use === '3d' ? 'Pour les projets lourds, mémoire, CPU, GPU et stockage doivent être évalués ensemble.' : b.use === 'code' ? 'Privilégie une RAM adaptée à tes outils, un SSD et un processeur capable de tenir tes charges.' : 'Un SSD, suffisamment de RAM et une plateforme fiable priment sur une carte graphique coûteuse.'}</p>
        <p class="hint">${DB.hasPrices() ? 'Les prix affichés viennent de la table component_prices, avec leur source et leur date.' : 'Aucun prix en base : saisis-les dans admin.html pour que le total devienne réel.'}</p>`)}
  </div>`;
}

/* --------------------------------------------------------------------- */
/*  3 / SmartPrice                                                         */
/* --------------------------------------------------------------------- */

/**
 * Les configurations comparables : celles de MySQL ET celles déjà stockées
 * dans le navigateur par l'ancienne version. Rien n'est supprimé.
 */
function comparableConfigurations() {
  const fromDatabase = DB.configurations.map((config) => ({
    key: 'db-' + config.id,
    source: 'base',
    id: config.id,
    name: config.name,
    createdAt: config.createdAt,
    // `parts` est reconstruit par famille pour réutiliser les mêmes affichages.
    parts: Object.fromEntries((config.components || []).map((item) => [item.category, item.slug])),
    prices: Object.fromEntries((config.components || []).map((item) => [item.category, item.price])),
  }));

  const fromBrowser = state.saved.map((config) => ({
    key: 'local-' + config.id,
    source: 'local',
    id: config.id,
    name: config.name,
    createdAt: null,
    parts: config.parts,
    prices: config.prices,
  }));

  return [...fromDatabase, ...fromBrowser];
}

function compare() {
  const arr = comparableConfigurations();
  const a = arr.find((x) => x.key === state.cmpA) || arr[0];
  const b = arr.find((x) => x.key === state.cmpB) || arr[1];

  if (arr.length < 2) {
    return `${appHeader('SmartPrice', 'ANALYSE / 02', 'Compare tes configurations sauvegardées. Aucune performance chiffrée n’est déduite sans benchmark.')}
    ${offlineBanner()}
    ${panel('Deux configurations requises', `<div class="empty">
      <div class="empty-icon">⇄</div>
      <h3>Enregistre au moins deux configurations</h3>
      <p>Crée tes configurations dans PC Builder pour les comparer ici. Elles sont stockées dans la table <b>configurations</b> et dans ton navigateur.</p>
      ${DB.status === 'hors-ligne' ? '<p>La base est injoignable : enregistre au moins deux configurations locales pour comparer.</p>' : ''}
      ${buttonRoute('builder', 'Ouvrir PC Builder')}
    </div>`)}`;
  }

  const cellsOf = (config) => order.map((key) => {
    const component = part(key, config.parts[key]);
    const price = config.prices?.[key];
    const hasPrice = price !== '' && price !== null && price !== undefined && Number.isFinite(Number(price));

    return `<div>${safe(component?.name || 'Non sélectionné')}${hasPrice
      ? `<span class="src">${formatDzd(Number(price))}</span>`
      : '<span class="src">Prix non renseigné</span>'}</div>`;
  });

  const totalA = order.reduce((sum, key) => sum + (Number(a.prices?.[key]) >= 0 ? Number(a.prices[key]) : 0), 0);
  const totalB = order.reduce((sum, key) => sum + (Number(b.prices?.[key]) >= 0 ? Number(b.prices[key]) : 0), 0);
  const completeA = order.every((key) => a.prices?.[key] !== '' && a.prices?.[key] != null);
  const completeB = order.every((key) => b.prices?.[key] !== '' && b.prices?.[key] != null);

  // Un écart de FPS n'est avancé que si les deux GPU ont des mesures identiques
  // (même jeu, même résolution, même qualité) : sinon, on ne dit rien.
  const gpuA = part('gpu', a.parts.gpu);
  const gpuB = part('gpu', b.parts.gpu);
  const gpuKey = (gpu) => gpu ? gpu.slug : null;
  const measuredDifference = (() => {
    if (!gpuA || !gpuB || gpuA.slug === gpuB.slug) return null;
    const all = Object.values(DB.statsCache).filter((entry) => entry && entry.stats && entry.stats.length);
    for (const entry of all) {
      const byId = Object.fromEntries(entry.stats.map((s) => [s.slug, s]));
      const s1 = byId[gpuKey(gpuA)];
      const s2 = byId[gpuKey(gpuB)];
      if (s1 && s2) {
        return {
          game: entry.meta.game, resolution: entry.meta.resolution, settings: entry.meta.settings,
          a: s1.avgFps, b: s2.avgFps, measures: s1.measures + s2.measures,
        };
      }
    }
    return null;
  })();

  return `${appHeader('SmartPrice', 'ANALYSE / 02', 'Compare tes configurations sauvegardées. Aucune performance chiffrée n’est déduite sans benchmark.')}
  ${offlineBanner()}
  ${panel('Sélection des configurations', `<div class="form-grid">
    <label>Configuration A${chooser(arr.map((x) => ({ id: x.key, name: `${x.name} (${x.source === 'base' ? 'base' : 'navigateur'})` })), a?.key, 'cmpA')}</label>
    <label>Configuration B${chooser(arr.map((x) => ({ id: x.key, name: `${x.name} (${x.source === 'base' ? 'base' : 'navigateur'})` })), b?.key, 'cmpB')}</label>
  </div>`)}

  <div class="compare-table">
    <div class="compare-heading"><span>COMPOSANT</span><strong>${safe(a?.name)}</strong><strong>${safe(b?.name)}</strong></div>
    ${order.map((key, index) => `<div class="compare-line"><span>${labels[key]}</span>${cellsOf(a)[index]}${cellsOf(b)[index]}</div>`).join('')}
    <div class="compare-line total-line"><span>Coût ${a.source === 'base' ? 'en base' : 'renseigné'}</span><strong>${formatDzd(totalA)} ${completeA ? '' : '(partiel)'}</strong><strong>${formatDzd(totalB)} ${completeB ? '' : '(partiel)'}</strong></div>
  </div>

  ${panel('Lecture intelligente', `<div class="advice-list">
    <div><b>Rapport performances / prix</b><p>${measuredDifference && completeA && completeB
      ? `Calculable uniquement pour ${safe(measuredDifference.game)} en ${safe(measuredDifference.resolution)} (${safe(measuredDifference.settings)}) : ${measuredDifference.a} FPS contre ${measuredDifference.b} FPS mesurés en base, pour un coût de ${formatDzd(totalA)} contre ${formatDzd(totalB)}.`
      : 'Non calculable sans benchmarks sourcés dans la table benchmarks et prix complets dans les deux configurations.'}</p></div>
    <div><b>Comparaison technique</b><p>Tu peux voir précisément quels composants diffèrent ; les écarts de FPS ne sont pas inférés à partir de simples noms.${measuredDifference ? ` Seule mesure commune trouvée : ${safe(measuredDifference.game)}, ${plural(measuredDifference.measures, 'mesure en base', 'mesures en base')}.` : ' Aucune mesure commune aux deux cartes graphiques n\'est encore en base.'}</p></div>
    <div><b>Meilleur choix</b><p>${completeA && completeB
      ? `La configuration la moins chère sur la base des montants connus est ${safe(totalA <= totalB ? a.name : b.name)}. Cela ne prouve pas qu’elle est la plus performante.`
      : 'Renseigne les huit prix dans chaque configuration (en base ou à la main) pour comparer les coûts complets.'}</p></div>
  </div>`)}`;
}

/* --------------------------------------------------------------------- */
/*  4 / Upgrade Path                                                       */
/* --------------------------------------------------------------------- */

function upgrade() {
  const b = state.build;
  const ram = part('ram', b.parts.ram);
  const disk = part('storage', b.parts.storage);
  const budget = Number(state.upgradeBudget) || 0;

  /**
   * Pour une famille, les pièces réellement tarifées en base, de la moins
   * chère à la plus chère. Une famille sans prix renvoie une liste vide,
   * ce que l'écran affiche honnêtement comme « aucun prix connu ».
   */
  const pricedOptions = (type) => catalog[type]
    .map((item) => ({ item, price: DB.prices[item.slug] }))
    .filter((entry) => entry.price)
    .sort((x, y) => x.price.value - y.price.value);

  const gpuOptions = pricedOptions('gpu');
  const ramOptions = pricedOptions('ram');
  const storageOptions = pricedOptions('storage');

  const affordable = (options, excludeSlug) => options
    .filter((entry) => entry.item.slug !== excludeSlug)
    .find((entry) => entry.price.value <= budget);

  const listing = (title, entries, excludeSlug, note) => {
    if (entries.length === 0) {
      return `<div class="advice-card"><span>${title}</span><h3>Aucun prix en base</h3><p>Impossible de dire ce qu'un upgrade coûterait : la table <b>component_prices</b> ne contient encore aucun prix pour cette famille.</p><small>${note}</small></div>`;
    }

    const best = affordable(entries, excludeSlug);
    const lines = entries.slice(0, 3).map((entry) => `<div class="summary-split"><span>${safe(entry.item.name)}</span><b class="${entry.price.value <= budget ? 'green' : 'red'}">${formatDzd(entry.price.value)}</b></div>`).join('');

    return `<div class="advice-card"><span>${title}</span><h3>${best ? 'Une option tient dans le budget' : 'Rien sous ce budget'}</h3>
      ${lines}
      <small>${best ? `Moins chère option disponible en base : ${safe(best.item.name)} à ${formatDzd(best.price.value)} · ${safe(best.price.source || 'source non précisée')}.` : `Le budget déclaré (${formatDzd(budget)}) reste sous le prix le plus bas connu (${formatDzd(entries[0].price.value)}).`} ${note}</small></div>`;
  };

  return `${appHeader('Upgrade Path', 'ÉVOLUTION / 03', 'Évalue les améliorations possibles à partir de ta configuration actuelle.')}
  ${offlineBanner()}
  ${panel('Ta machine actuelle', `<p class="body-muted">L’analyse utilise les composants du PC Builder. Mets-les à jour avant de lancer des pistes d’amélioration.</p>
    <div class="form-grid">
      <label>Budget d’upgrade (DZD)${input(state.upgradeBudget, 'upgradeBudget', 'number', '', 'min="0"')}</label>
      <label>Usage souhaité${chooser(uses, b.use, 'build.use')}</label>
    </div>
    <button class="button outline" data-route="builder">Modifier mes composants ↗</button>`)}

  <div class="section-header"><h2>Pistes d’amélioration</h2><span>Conseils qualitatifs — coûts et compatibilité à confirmer</span></div>
  <div class="advice-cards">${[
    ['01', 'Mémoire vive', ram?.gb < 32 ? 'Passer à 32 Go peut aider pour multitâche, montage et certaines charges créatives.' : 'Ta capacité RAM actuelle est déjà adaptée à de nombreux usages.', 'Vérifier type, emplacements et capacité max de la carte mère.'],
    ['02', 'Stockage', disk?.slug === 'ssd-500' ? 'Un SSD plus spacieux peut améliorer le confort si ton disque est saturé.' : 'Conserver ton SSD si sa capacité, sa santé et ses débits te conviennent.', 'Vérifier les ports disponibles et le format du SSD.'],
    ['03', 'Carte graphique', 'Pour une résolution supérieure ou des jeux plus lourds, comparer des GPU avec benchmarks du même jeu.', 'Vérifier espace boîtier, puissance et connecteurs de l’alimentation.'],
    ['04', 'Processeur', 'Le gain dépend des applications ; une mise à niveau peut imposer carte mère et RAM.', 'Vérifier socket, BIOS, refroidissement et coût de plateforme.'],
  ].map(([n, title, detail, warning]) => `<div class="advice-card"><span>${n}</span><h3>${title}</h3><p>${detail}</p><small>À contrôler : ${warning}</small></div>`).join('')}</div>

  <div class="section-header"><h2>Ce que la base sait des prix</h2><span>Budget d'upgrade : ${formatDzd(budget)}</span></div>
  <div class="advice-cards">
    ${listing('GPU', gpuOptions, b.parts.gpu, 'Le gain réel dépend des mesures de FPS, pas du prix.')}
    ${listing('RAM', ramOptions, b.parts.ram, 'Garde le socket et la génération de ta carte mère.')}
    ${listing('STOCKAGE', storageOptions, b.parts.storage, 'Vérifie la place disponible sur la carte mère.')}
  </div>

  <div class="alert muted">Budget déclaré : ${formatDzd(budget)}. ${DB.hasPrices() ? 'Les montants ci-dessus viennent de la table component_prices, avec leur source.' : 'Sans prix locaux vérifiés, BuildWise ne peut pas affirmer qu’un upgrade est achetable dans cette limite.'}</div>`;
}

/* --------------------------------------------------------------------- */
/*  5 / FPS Range                                                          */
/* --------------------------------------------------------------------- */

/**
 * Le processeur derrière une moyenne de FPS.
 * Une moyenne peut mélanger des mesures relevées avec des processeurs
 * différents : le dire évite de laisser croire que toutes les mesures ont le
 * même contexte. Rien ici n'est calculé à partir des FPS : c'est un comptage
 * de lignes de la table benchmarks, renvoyé par l'action stats.
 */
function contextLine(stat) {
  if (stat.pairedParts > 1) {
    return `<p class="body-muted">${plural(stat.measures, 'Mesure', 'Mesures')} relevées avec ${plural(stat.pairedParts, 'processeur différent', 'processeurs différents')} : la moyenne mélange donc des contextes de test différents. Chaque mesure garde la pièce associée à son test, visible dans <a href="admin.html">l'administration</a>.</p>`;
  }
  if (stat.pairedParts === 1) {
    return '<p class="body-muted">Toutes ces mesures ont été relevées avec le même processeur.</p>';
  }
  return '<p class="body-muted">Aucune de ces mesures n\'indique le processeur utilisé pendant le test.</p>';
}

function fps() {
  const b = state.build;
  const conditions = { game: b.game, resolution: b.resolution, settings: state.fpsQuality || 'high', category: 'gpu' };

  // Le premier dessin de l'écran déclenche la lecture en base ; les suivants
  // relisent le cache, sans rappeler PHP inutilement.
  requestBenchmarkStats(conditions);

  const loaded = DB.cachedStats(conditions);
  const gpu = part('gpu', b.parts.gpu);
  const settings = conditions.settings;
  const stats = loaded?.stats ?? [];
  const selectedStat = gpu ? stats.find((s) => s.slug === gpu.slug) : null;

  const table = `<div class="measure-table">
    <div class="measure-head"><span>CARTE GRAPHIQUE</span><span>FPS MOYEN</span><span>MIN / MAX</span><span>MESURES</span><span>SOURCE</span></div>
    ${stats.map((s) => `<div class="measure-row">
      <span>${safe(s.component)}${s.brand ? ` <small class="src">${safe(s.brand)}</small>` : ''}</span>
      <b>${s.avgFps}</b>
      <span>${s.minFps} / ${s.maxFps}</span>
      <span>${s.measures}</span>
      <span class="src">${formatDate(s.lastMeasure)}</span>
    </div>`).join('')}
  </div>`;

  const result = () => {
    if (!loaded) {
      return `<div class="no-data"><div class="no-data-badge">…</div><h2>Lecture des mesures en cours</h2><p>BuildWise demande les benchmarks enregistrés pour ${safe(b.game)} en ${safe(b.resolution)}, qualité ${safe(settings)}.</p></div>`;
    }

    if (stats.length === 0) {
      return `<div class="no-data">
        <div class="no-data-badge">— FPS</div>
        <h2>Estimation non disponible</h2>
        <p>${safe(loaded.meta.emptyMessage || 'Aucune mesure qualifiée avec source, configuration complète et conditions de test correspondant à cette sélection n’est enregistrée dans cette version.')}</p>
        <div class="data-chip">SOURCE : TABLE BENCHMARKS</div>
        <div class="data-chip">MESURES POUR CE JEU : ${DB.totals.benchmarks || 0}</div>
        <div class="db-links"><a href="admin.html">Ajouter une mesure réelle</a></div>
      </div>`;
    }

    const headline = selectedStat
      ? `<div class="fps-big">${selectedStat.avgFps}</div>
         <p class="body-muted">FPS moyens mesurés pour <b>${safe(gpu.name)}</b> sur ${safe(b.game)} en ${safe(b.resolution)}, qualité ${safe(settings)} — ${plural(selectedStat.measures, 'mesure en base', 'mesures en base')}, entre ${selectedStat.minFps} et ${selectedStat.maxFps} FPS.</p>
         ${contextLine(selectedStat)}`
      : `<p class="body-muted">Ce jeu a des mesures en base, mais aucune ne concerne la carte graphique sélectionnée (${safe(gpu ? gpu.name : 'aucune carte sélectionnée')}). Choisis-en une autre ou ajoute une mesure.</p>`;

    return `${panel('Conditions de test et résultat', headline)}${panel(`Autres cartes mesurées · ${safe(b.game)} · ${safe(b.resolution)} · ${safe(settings)}`, table)}`;
  };

  return `${appHeader('FPS Range', 'PERFORMANCE / 04', 'Un estimateur responsable affiche des mesures sourcées ou indique qu’il manque des données.')}
  ${offlineBanner()}
  ${panel('Conditions de test demandées', `<div class="form-grid">
    <label>Processeur${chooser(catalog.cpu, b.parts.cpu, 'part.cpu')}</label>
    <label>Carte graphique${chooser(catalog.gpu, b.parts.gpu, 'part.gpu')}</label>
    <label>Mémoire${chooser(catalog.ram, b.parts.ram, 'part.ram')}</label>
    <label>Jeu${chooser(DB.games(), b.game, 'build.game')}</label>
    <label>Résolution${chooser(['1080p', '1440p', '4K'], b.resolution, 'build.resolution')}</label>
    <label>Qualité${chooser([{ id: 'low', name: 'Faible' }, { id: 'medium', name: 'Moyenne' }, { id: 'high', name: 'Élevée' }, { id: 'ultra', name: 'Ultra' }], settings, 'fpsQuality')}</label>
  </div>`)}
  ${result()}`;
}

/* --------------------------------------------------------------------- */
/*  6 / Bottleneck — qualitatif, comme dans la version d'origine           */
/* --------------------------------------------------------------------- */

function bottleneck() {
  const b = state.build;
  const ram = part('ram', b.parts.ram);

  return `${appHeader('Bottleneck Explainer', 'ANALYSE / 05', 'Comprends les limitations possibles sans faux pourcentages.')}
  ${offlineBanner()}
  ${panel('Contexte', `<div class="form-grid">
    <label>Processeur${chooser(catalog.cpu, b.parts.cpu, 'part.cpu')}</label>
    <label>Carte graphique${chooser(catalog.gpu, b.parts.gpu, 'part.gpu')}</label>
    <label>RAM${chooser(catalog.ram, b.parts.ram, 'part.ram')}</label>
    <label>Utilisation${chooser(uses, b.use, 'build.use')}</label>
    <label>Résolution${chooser(['1080p', '1440p', '4K'], b.resolution, 'build.resolution')}</label>
  </div>`)}
  <div class="advice-cards">${[
    ['CPU', 'Peut limiter les fréquences d’images élevées, certaines simulations et tâches fortement dépendantes du processeur.'],
    ['GPU', b.resolution === '4K' ? 'À 4K, la charge graphique est souvent importante ; vérifie benchmarks et mémoire vidéo du jeu.' : 'Selon les détails graphiques du jeu, le GPU peut être le facteur limitant.'],
    ['RAM', ram?.gb < 32 ? '16 Go peuvent devenir contraignants pour certaines applications lourdes et le multitâche.' : 'La quantité de RAM déclarée offre une marge pour de nombreux usages, sans garantir l’absence de saturation.'],
    ['STOCKAGE', 'Un SSD peut accélérer les chargements, mais n’augmente pas automatiquement les FPS moyens.'],
  ].map(([name, p]) => `<div class="advice-card"><div class="eyebrow">${name}</div><p>${p}</p></div>`).join('')}</div>
  <div class="alert muted">Un véritable diagnostic nécessite mesures d’utilisation CPU/GPU, températures, RAM, disque et test de charge sur l’application concernée.</div>`;
}

/* --------------------------------------------------------------------- */
/*  7 / PC Doctor — aucune donnée de base nécessaire                      */
/* --------------------------------------------------------------------- */

function doctor() {
  const f = doctorFlows[state.problem] || doctorFlows.fps;

  return `${appHeader('PC Doctor', 'SUPPORT / 06', 'Un diagnostic guidé, avec des étapes simples et sans manipulation électrique dangereuse.')}
  ${offlineBanner()}
  ${panel('Quel est ton problème ?', `<div class="issue-grid">${Object.entries(doctorFlows).map(([id, x]) => `<button class="issue ${id === state.problem ? 'selected' : ''}" data-problem="${id}">${id === state.problem ? '<span class="pulse"></span>' : '<span>○</span>'}${x.name}</button>`).join('')}</div>`)}
  <div class="diagnostic">
    <div class="diag-top"><span>DIAGNOSTIC GUIDÉ</span><span>Étape ${Math.min(state.diagStep + 1, f.questions.length + 1)} / ${f.questions.length + 1}</span></div>
    ${state.diagStep < f.questions.length
      ? `<h2>${f.questions[state.diagStep]}</h2><p>Note la réponse pour la suite du diagnostic. Les conseils sont conservateurs même si tu ne connais pas la réponse.</p>
         <div class="answer-row"><button class="button outline" data-action="diag-next">Oui</button><button class="button outline" data-action="diag-next">Non</button><button class="button subtle" data-action="diag-next">Je ne sais pas</button></div>`
      : `<h2>Plan de vérification</h2><ol class="steps">${f.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
         <div class="alert muted">Si tu constates de la fumée, une odeur de brûlé ou des étincelles : arrête et débranche le PC, puis consulte un professionnel.</div>
         <button class="button primary" data-action="diag-reset">Recommencer le diagnostic ↻</button>`}
  </div>`;
}

/* --------------------------------------------------------------------- */
/*  8 / GoalMatch                                                          */
/* --------------------------------------------------------------------- */

function goal() {
  const b = Number(state.goalBudget) || 0;
  const goalUse = state.goalUse;
  const res = state.goalRes;
  const fpsTarget = state.goalFps;

  const focus = goalUse === 'gaming'
    ? (res === '4K' ? 'Priorité à la carte graphique et à un écran adapté ; prévoir un budget matériel plus exigeant.' : 'Priorité à un GPU adapté au jeu et une plateforme CPU/RAM équilibrée.')
    : goalUse === 'office' ? 'Privilégier SSD, 16 Go de RAM selon besoins et fiabilité globale.'
    : goalUse === 'code' ? 'Viser une bonne capacité RAM, un SSD rapide et un CPU polyvalent.'
    : 'Évaluer les logiciels, mémoire, accélération GPU et besoins CPU avant de choisir.';

  // Le devis n'est proposé que si des prix existent réellement en base.
  const priced = order.flatMap((key) => catalog[key].map((item) => ({ item, price: DB.prices[item.slug] })))
    .filter((entry) => entry.price && (entry.item.tier ?? 0) >= 2)
    .sort((x, y) => x.price.value - y.price.value);

  const estimate = () => {
    if (!DB.hasPrices()) {
      return `<div class="alert muted">Aucun prix en base : impossible de proposer honnêtement une liste d’achat respectant exactement ${formatDzd(b)}. Entre des prix vérifiés dans admin.html.</div>`;
    }
    if (priced.length === 0) {
      return `<div class="alert muted">Les prix existants en base ne couvrent pas encore les familles nécessaires à cette orientation.</div>`;
    }
    return `<div class="alert muted">Quelques pièces tarifées existent en base (à partir de ${formatDzd(priced[0].price.value)}). Un devis complet demanderait un prix pour chacune des huit familles ; le total affiché reste donc partiel.</div>`;
  };

  return `${appHeader('GoalMatch', 'RECOMMANDATION / 07', 'Définis ton objectif pour obtenir des recommandations qualitatives, sans inventer un devis.')}
  ${offlineBanner()}
  ${panel('Ton PC idéal, pour quoi faire ?', `<div class="form-grid">
    <label>Budget disponible (DZD)${input(state.goalBudget, 'goalBudget', 'number', '', 'min="0"')}</label>
    <label>Utilisation principale${chooser(uses, goalUse, 'goalUse')}</label>
    <label>Jeu principal${chooser(DB.games(), state.goalGame, 'goalGame')}</label>
    <label>Résolution visée${chooser(['1080p', '1440p', '4K'], res, 'goalRes')}</label>
    <label>Objectif de fluidité${chooser([{ id: '60', name: '60 FPS' }, { id: '120', name: '120 FPS' }, { id: '144', name: '144 FPS' }, { id: '240', name: '240 FPS' }], fpsTarget, 'goalFps')}</label>
  </div>`)}
  <div class="recommendation">
    <div class="eyebrow">ORIENTATION PERSONNALISÉE</div>
    <h2>${res} / ${safe(fpsTarget)} FPS ciblés</h2>
    <p>${focus}</p>
    <div class="recommend-grid">
      <div><span>Budget</span><b>${formatDzd(b)}</b></div>
      <div><span>Usage</span><b>${uses.find((x) => x.id === goalUse)?.name || '—'}</b></div>
      <div><span>Statut</span><b>À confirmer par tests</b></div>
    </div>
    ${estimate()}
    <div class="alert muted">Ce niveau de FPS n’est pas garanti. ${DB.totals.benchmarks ? `${plural(DB.totals.benchmarks, 'mesure existe', 'mesures existent')} en base : vérifie les conditions exactes dans FPS Range.` : 'Aucune mesure de FPS n’est enregistrée en base.'}</div>
    <button class="button primary" data-action="goal-builder">Continuer dans PC Builder ↗</button>
  </div>`;
}

/* --------------------------------------------------------------------- */
/*  9 / Compatibility Checker                                              */
/* --------------------------------------------------------------------- */

function compatibility() {
  const b = state.build;
  const tests = checkBuild(b);
  const ok = tests.filter((x) => x.state === 'ok').length;
  const bad = tests.filter((x) => x.state === 'bad').length;

  // Constatations humaines enregistrées en base pour les pièces de cette config.
  const ids = order.map((key) => part(key, b.parts[key])?.id).filter(Boolean);
  requestCompatibility(ids);
  const records = DB.cachedCompat(ids) || [];

  return `${appHeader('Compatibility Checker', 'VALIDATION / 08', 'Contrôles partiels fondés sur les champs du catalogue ; une inconnue n’est jamais validée.')}
  ${offlineBanner()}
  <div class="metrics compact">
    ${mini('MATCHES INDICATIFS', String(ok), 'Socket et génération RAM')}
    ${mini('CONFLITS', String(bad), 'Règles renseignées')}
    ${mini('À VÉRIFIER', String(tests.filter((x) => x.state === 'unknown').length), 'Données manquantes')}
  </div>

  ${panel('Contrôle de la configuration active', `<div class="checks-detail">${tests.map((x) => `<div class="check-detail"><span class="status-icon ${x.state}">${x.state === 'ok' ? '✓' : x.state === 'bad' ? '×' : '?'}</span><div><h3>${x.title}</h3><p>${x.detail}</p></div><span class="status-name ${x.state}">${x.state === 'ok' ? 'Correspondance indicative' : x.state === 'bad' ? 'Conflit' : 'Inconnu'}</span></div>`).join('')}</div>`)}

  ${DB.compatError ? `<div class="alert bad">Lecture des constatations impossible : ${safe(DB.compatError)} Les six contrôles ci-dessus restent calculés depuis le catalogue.</div>` : ''}

  ${panel('Constatations enregistrées dans la base', records.length === 0
    ? `<div class="empty"><div class="empty-icon">◇</div><h3>Aucune constatation pour ces pièces</h3><p>La table <b>compatibility</b> contient ${plural(DB.totals.compatibility_rows || 0, 'ligne', 'lignes')}, mais aucune ne concerne les composants de cette configuration. Les règles techniques ci-dessus restent valables.</p>${DB.status === 'pret' ? '<div class="db-links"><a href="admin.html">Ajouter une constatation</a></div>' : ''}</div>`
    : `<div class="checks-detail">${records.map((r) => `<div class="check-detail"><span class="status-icon ${r.status === 'compatible' ? 'ok' : r.status === 'incompatible' ? 'bad' : ''}">${r.status === 'compatible' ? '✓' : r.status === 'incompatible' ? '×' : '?'}</span><div><h3>${safe(r.component.name)} ↔ ${safe(r.with.name)}</h3><p>${safe(r.notes || 'Aucune note jointe.')}</p></div><span class="status-name ${r.status === 'compatible' ? 'ok' : r.status === 'incompatible' ? 'bad' : ''}">${r.status === 'compatible' ? 'Constat compatible' : r.status === 'incompatible' ? 'Constat conflit' : 'À vérifier'}</span></div>`).join('')}</div>
       <p class="hint">Ces lignes viennent de la table compatibility : elles ont été saisies par une personne, pas déduites automatiquement.</p>`)}

  <div class="alert muted">Le contrôle socket/RAM se fonde sur le référentiel indicatif stocké dans la table components. Il ne constitue pas une certification du modèle exact. Vérifie la documentation fabricant, la révision BIOS et les dimensions avant achat.</div>
  <button class="button primary" data-route="builder">Modifier la configuration ↗</button>`;
}

/* --------------------------------------------------------------------- */
/*  10 / Resolution Advisor                                                */
/* --------------------------------------------------------------------- */

function resolution() {
  const b = state.build;

  return `${appHeader('Resolution Advisor', 'AFFICHAGE / 09', 'Compare le rendu et la charge graphique selon tes priorités.')}
  ${offlineBanner()}
  ${panel('Tes priorités', `<div class="form-grid">
    <label>Carte graphique${chooser(catalog.gpu, b.parts.gpu, 'part.gpu')}</label>
    <label>Jeu${chooser(DB.games(), state.resGame, 'resGame')}</label>
    <label>Fluidité cible${chooser([{ id: '60', name: '60 FPS' }, { id: '120', name: '120 FPS' }, { id: '144', name: '144 FPS' }, { id: '240', name: '240 FPS' }], state.resTarget, 'resTarget')}</label>
    <label>Résolution de ton écran${chooser(['1080p', '1440p', '4K'], b.resolution, 'build.resolution')}</label>
  </div>`)}
  <div class="res-grid">${[
    ['1080p', '1920 × 1080', 'Charge généralement plus faible ; souvent pertinent pour la haute fluidité.'],
    ['1440p', '2560 × 1440', 'Compromis entre netteté et puissance GPU nécessaire.'],
    ['4K', '3840 × 2160', 'Image plus détaillée, charge GPU beaucoup plus importante.'],
  ].map(([name, pixels, detail]) => `<div class="res-card ${b.resolution === name ? 'selected' : ''}">
    <div class="res-screen"><div class="res-inner"></div></div>
    <h3>${name}</h3><div class="mono">${pixels}</div><p>${detail}</p>
    <button class="button ${b.resolution === name ? 'subtle' : 'outline'}" data-set-res="${name}">${b.resolution === name ? 'Résolution actuelle' : 'Choisir pour ma config'}</button>
  </div>`).join('')}</div>
  <p class="hint">Le GPU sélectionné ne suffit pas pour garantir les FPS à cette résolution : il faut des tests du jeu, de ses réglages et des versions matérielles exactes.</p>`;
}

/* --------------------------------------------------------------------- */
/*  11 / Game Settings Advisor                                             */
/* --------------------------------------------------------------------- */

function settings() {
  const s = state.settingsPreset;
  const presets = {
    performance: { textures: 'Moyennes si VRAM limitée', shadows: 'Faibles / moyennes', aa: 'Faible ou adapté au jeu', rt: 'Désactivé', scaling: 'Évaluer DLSS/FSR/XeSS si compatible' },
    balanced: { textures: 'Selon VRAM disponible', shadows: 'Moyennes', aa: 'Moyen / élevé', rt: 'À tester, désactivé par défaut', scaling: 'Qualité si nécessaire et pris en charge' },
    quality: { textures: 'Élevées si VRAM suffisante', shadows: 'Élevées', aa: 'Élevé', rt: 'Activer seulement après mesure des performances', scaling: 'Natif ou mode Qualité selon résultat' },
  };
  const p = presets[s];

  return `${appHeader('Game Settings Advisor', 'OPTIMISATION / 10', 'Des points de départ à tester dans le jeu, pas des gains FPS garantis.')}
  ${offlineBanner()}
  ${panel('Personnaliser le conseil', `<div class="form-grid">
    <label>Jeu${chooser(DB.games(), state.settingsGame, 'settingsGame')}</label>
    <label>Carte graphique${chooser(catalog.gpu, state.build.parts.gpu, 'part.gpu')}</label>
    <label>Priorité${chooser([{ id: 'performance', name: 'Fluidité' }, { id: 'balanced', name: 'Équilibré' }, { id: 'quality', name: 'Qualité visuelle' }], s, 'settingsPreset')}</label>
    <label>Mémoire vidéo connue ?${chooser([{ id: 'unknown', name: 'Inconnue' }, { id: 'low', name: '6 Go ou moins' }, { id: 'mid', name: '8 Go' }, { id: 'high', name: '12 Go ou plus' }], state.settingsVRAM, 'settingsVRAM')}</label>
  </div>`)}
  ${panel('Réglages de départ', `<div class="setting-lines">${[
    ['Textures', state.settingsVRAM === 'low' ? 'Basses / moyennes selon consommation VRAM' : p.textures],
    ['Ombres', p.shadows],
    ['Anti-aliasing', p.aa],
    ['Ray tracing', p.rt],
    ['Upscaling', p.scaling],
  ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    <p class="hint">Disponibilité et efficacité des technologies d’upscaling à vérifier pour le jeu, le pilote et la carte sélectionnés.</p>`)}
  ${panel('Impact des réglages', `<div class="advice-list">${[
    ['Textures', 'Consomment surtout de la mémoire vidéo ; une saturation peut causer des saccades.'],
    ['Ombres et effets', 'Peuvent peser sur le GPU. Les réduire est un test utile en cas de chute de FPS.'],
    ['Ray tracing', 'Peut augmenter fortement la charge GPU ; tester avec et sans.'],
    ['DLSS / FSR / XeSS', 'Le rendu interne plus faible peut améliorer les performances dans certains jeux compatibles, avec compromis visuels variables.'],
  ].map(([title, text]) => `<div><b>${title}</b><p>${text}</p></div>`).join('')}</div>`)}`;
}
