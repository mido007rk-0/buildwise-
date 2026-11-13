/**
 * catalog.js — Le catalogue qui venait du JavaScript, lu depuis MySQL.
 *
 * Dans la version d'origine, les 32 composants étaient écrits à la main dans
 * BuildWise.html. Ils vivent maintenant dans la table `components`, et ce
 * fichier les met en cache pour que les pages restent rapides.
 *
 * Ce qui reste du JavaScript, volontairement :
 *   labels, order, games, uses, doctorFlows.
 * Ce ne sont pas des données métier : ce sont des mots d'interface (les
 * libellés des familles, l'ordre d'affichage, les familles de problèmes du
 * PC Doctor). Les stocker en base n'apporterait rien et rendrait la
 * maintenance plus difficile pour un débutant.
 */

/** Les familles de composants, dans l'ordre métier du PC Builder. */
const order = ['cpu', 'gpu', 'board', 'ram', 'storage', 'psu', 'case', 'cooler'];

/** Libellés affichés dans l'interface. */
const labels = {
  cpu: 'Processeur', gpu: 'Carte graphique', board: 'Carte mère', ram: 'Mémoire RAM',
  storage: 'Stockage', psu: 'Alimentation', case: 'Boîtier', cooler: 'Refroidissement',
};

/** Jeux proposés par défaut. Les jeux déjà mesurés en base s'ajoutent à cette liste. */
const defaultGames = ['Valorant', 'Counter-Strike 2', 'Fortnite', 'GTA V', 'Cyberpunk 2077', 'Warzone', 'Minecraft', 'Autre jeu'];

/** Usages proposés. La valeur envoyée en base est l'id (colonne `usage`). */
const uses = [
  { id: 'gaming', name: 'Gaming' }, { id: 'code', name: 'Programmation' },
  { id: 'video', name: 'Montage vidéo' }, { id: '3d', name: 'Modélisation 3D' },
  { id: 'office', name: 'Bureautique' },
];

/** Arborescence du PC Doctor : textes d'aide, pas des données de base. */
const doctorFlows = {
  fps: { name: 'Baisse de FPS', questions: ['Le problème apparaît-il dans un seul jeu ?', 'Les pilotes graphiques ont-ils été mis à jour récemment ?'], steps: ['Fermer les programmes gourmands et relever l’utilisation CPU/GPU/RAM dans le gestionnaire des tâches.', 'Vérifier les températures avec un logiciel de surveillance fiable.', 'Comparer les paramètres graphiques et la résolution avant/après la baisse.', 'Tester le jeu avec les overlays désactivés.'] },
  slow: { name: 'PC lent', questions: ['Le ralentissement concerne-t-il tout Windows ?', 'Le disque système est-il presque plein ?'], steps: ['Ouvrir le gestionnaire des tâches et vérifier l’usage du disque et de la RAM.', 'Vérifier l’espace libre du disque système.', 'Désactiver uniquement les applications de démarrage non essentielles.', 'Lancer une analyse de sécurité avec l’outil intégré au système.'] },
  heat: { name: 'Surchauffe', questions: ['Les ventilateurs tournent-ils normalement ?', 'Le PC s’éteint-il pendant une charge élevée ?'], steps: ['Arrêter les tests lourds si les températures sont anormalement élevées.', 'Nettoyer les grilles sans ouvrir l’alimentation électrique.', 'Vérifier la circulation d’air et l’absence d’obstruction.', 'Faire contrôler la fixation du refroidisseur si le problème persiste.'] },
  boot: { name: 'Problème de démarrage', questions: ['Les ventilateurs ou voyants s’allument-ils ?', 'Un message d’erreur s’affiche-t-il ?'], steps: ['Contrôler la prise, le câble et l’interrupteur du bloc d’alimentation.', 'Débrancher les accessoires USB non essentiels puis réessayer.', 'Noter les bips, voyants de diagnostic ou messages affichés.', 'Éviter toute intervention interne sous tension ; contacter un technicien si nécessaire.'] },
  noise: { name: 'Bruit inhabituel', questions: ['Le bruit vient-il d’un ventilateur ?', 'Se produit-il seulement sous charge ?'], steps: ['Sauvegarder les données si le bruit provient d’un disque dur mécanique.', 'Éteindre l’ordinateur et contrôler les obstructions visibles.', 'Localiser le bruit sans toucher aux pièces mobiles.', 'Faire examiner tout cliquetis électrique ou bruit du bloc d’alimentation.'] },
  wifi: { name: 'Connexion Wi-Fi', questions: ['D’autres appareils ont-ils le même souci ?', 'Le problème concerne-t-il un seul réseau ?'], steps: ['Redémarrer l’adaptateur réseau et le routeur si possible.', 'Tester un autre appareil sur le même réseau.', 'Mettre à jour le pilote depuis le constructeur.', 'Comparer 2,4 GHz et 5 GHz suivant portée et interférences.'] },
  crash: { name: 'Plantages et instabilité', questions: ['Une erreur ou un code apparaît-il ?', 'Le problème a-t-il commencé après une mise à jour matérielle ?'], steps: ['Noter le message exact et les conditions du plantage.', 'Sauvegarder les fichiers importants.', 'Revenir aux réglages de fréquence d’origine en cas d’overclocking.', 'Tester progressivement RAM et stockage avec des outils reconnus.'] },
};

/**
 * Le catalogue, sous la même forme que l'ancienne version :
 *   catalog.cpu  →  [{ id:1, slug:'r5-5600', name:'…', socket:'AM4', tier:2, price:null }, …]
 *
 * Les champs techniques (socket, ramType, tier, gb, watts) sont sortis du
 * JSON `specifications` et posés à plat sur l'objet. C'est ce qui permet au
 * Compatibility Checker de rester écrit exactement comme avant.
 */
const catalog = { cpu: [], gpu: [], board: [], ram: [], storage: [], psu: [], case: [], cooler: [] };

/** Accès rapide par slug et par id numérique. */
const bySlug = {};
const byId = {};

const DB = {
  /** 'chargement' | 'pret' | 'hors-ligne' — sert à la pastille d'état. */
  status: 'chargement',
  error: null,
  /** Compteurs renvoyés par components.php?action=summary. */
  totals: {},
  /** Derniers prix connus, par slug. */
  prices: {},
  /** Configurations stockées dans MySQL. */
  configurations: [],
  configurationsError: '',
  /** Jeux déjà mesurés en base. */
  measuredGames: [],
  /** Petits caches pour ne pas rappeler PHP à chaque dessin d'écran. */
  statsCache: {},
  compatCache: {},
  historyCache: {},
  /** Message de la dernière lecture de compatibilité qui a échoué, ou ''. */
  compatError: '',

  /**
   * Charge tout ce dont les pages ont besoin dès l'ouverture du site.
   * Les quatre requêtes partent en même temps : c'est plus rapide, et une
   * seule brique en échec ne casse pas les autres.
   */
  async load() {
    this.status = 'chargement';
    this.error = null;

    const [components, summary, configurations, games] = await Promise.allSettled([
      API.get('components.php', { limit: 500 }),
      API.get('components.php', { action: 'summary' }),
      API.get('configurations.php'),
      API.get('benchmarks.php', { action: 'games' }),
    ]);

    // Sans composants, le site ne peut rien afficher : c'est l'erreur bloquante.
    if (components.status !== 'fulfilled') {
      this.status = 'hors-ligne';
      this.error = components.reason;
      return false;
    }

    this.fill(components.value.data.components);

    if (summary.status === 'fulfilled') this.totals = summary.value.data.totals;
    if (games.status === 'fulfilled') {
      this.measuredGames = games.value.data.games.map((game) => game.name);
    }
    if (configurations.status === 'fulfilled') {
      this.configurations = configurations.value.data.configurations;
      this.configurationsError = '';
    } else {
      this.configurations = [];
      this.configurationsError = configurations.reason.message;
    }

    this.status = 'pret';
    return true;
  },

  /** Range la réponse de MySQL dans `catalog`, `bySlug`, `byId` et `prices`. */
  fill(components) {
    order.forEach((type) => { catalog[type] = []; });
    Object.keys(bySlug).forEach((key) => delete bySlug[key]);
    Object.keys(byId).forEach((key) => delete byId[key]);
    this.prices = {};

    components.forEach((raw) => {
      const item = { ...raw, ...(raw.specifications || {}) };

      // `value` porte le slug, qui sert de référence dans les formulaires et
      // dans le localStorage, exactement comme l'ancien `id` du catalogue JS.
      item.value = raw.slug;

      if (catalog[item.category]) catalog[item.category].push(item);
      bySlug[item.slug] = item;
      byId[item.id] = item;

      // On ne garde que les prix réellement présents en base.
      if (item.price !== null && item.price !== undefined) {
        this.prices[item.slug] = {
          value: Number(item.price),
          currency: item.currency || 'DZD',
          source: item.priceSource,
          sourceUrl: item.priceSourceUrl,
          // La date affichée est celle de la vérification du prix ; la date
          // d'enregistrement en base ne sert que de secours.
          date: item.priceVerifiedAt || item.priceUpdatedAt,
        };
      }
    });
  },

  /**
   * Les mesures de FPS correspondant à un jeu + résolution + qualité.
   * C'est la source unique de la page FPS Range : vide en base, vide à l'écran.
   */
  async stats({ game, resolution, settings, category }) {
    const key = this.statsKey({ game, resolution, settings, category });
    if (this.statsCache[key]) return this.statsCache[key];

    const response = await API.get('benchmarks.php', {
      action: 'stats', game, resolution, graphics_settings: settings, category,
    });

    this.statsCache[key] = { stats: response.data.stats, meta: response.meta };
    return this.statsCache[key];
  },

  /** La clé qui identifie une demande de mesures, pour le cache et pour les vues. */
  statsKey({ game, resolution, settings, category }) {
    return [game, resolution, settings, category].join('|');
  },

  /** Résultat déjà reçu, ou null si la lecture n'est pas encore terminée. */
  cachedStats({ game, resolution, settings, category }) {
    return this.statsCache[this.statsKey({ game, resolution, settings, category })] ?? null;
  },

  /** Les constatations de compatibilité enregistrées entre plusieurs pièces. */
  async compatFor(ids) {
    const key = this.compatKey(ids);
    if (!key) return [];
    if (this.compatCache[key]) return this.compatCache[key];

    const response = await API.get('compatibility.php', { ids: key });
    this.compatCache[key] = response.data.records;
    return this.compatCache[key];
  },

  compatKey(ids) {
    return (ids || []).slice().sort((a, b) => a - b).join(',');
  },

  /** Constatations déjà reçues pour une liste de pièces, ou null. */
  cachedCompat(ids) {
    const key = this.compatKey(ids);
    return key ? (this.compatCache[key] ?? null) : [];
  },

  /** Tout l'historique des prix d'un composant (page admin). */
  async priceHistory(componentId) {
    if (this.historyCache[componentId]) return this.historyCache[componentId];
    const response = await API.get('prices.php', { component_id: componentId });
    this.historyCache[componentId] = response.data.prices;
    return response.data.prices;
  },

  /** Oublie un cache : à utiliser après une saisie, pour relire la valeur fraîche. */
  invalidate(kind, key) {
    if (kind === 'stats') this.statsCache = {};
    if (kind === 'compat') {
      this.compatCache = {};
      this.compatError = '';
    }
    if (kind === 'history') delete this.historyCache[key];
    if (kind === 'configurations') this.configurations = [];
  },

  /** Liste des jeux : celles du site + celles déjà mesurées, sans doublon. */
  games() {
    const merged = [...defaultGames];
    this.measuredGames.forEach((name) => {
      if (!merged.includes(name)) merged.push(name);
    });
    return merged;
  },

  /** Vrai seulement si au moins un prix existe en base. */
  hasPrices() {
    return Object.keys(this.prices).length > 0;
  },
};

/**
 * Retrouve un composant à partir de sa famille et de sa valeur de formulaire.
 *
 * La valeur peut être un slug ('r5-7600', comme dans l'ancienne version et
 * dans le localStorage du navigateur) ou un id numérique (14), donc les
 * configurations déjà enregistrées continuent de fonctionner sans migration.
 */
function part(type, ref) {
  if (ref === null || ref === undefined || ref === '') return null;

  const found = bySlug[ref] ?? byId[Number(ref)] ?? null;
  if (found) return found;

  // Dernier recours : la famille demandée, si on sait de quelle famille il s'agit.
  if (type && catalog[type]) {
    return catalog[type].find((item) => String(item.slug) === String(ref)) ?? null;
  }
  return null;
}

/** Prix en base pour une référence de composant, ou null si aucun prix connu. */
function databasePrice(ref) {
  const component = typeof ref === 'object' && ref !== null ? ref : part(null, ref);
  if (!component) return null;
  return DB.prices[component.slug] ?? null;
}

/** Formatage d'un montant : 98500 → « 98 500 DZD ». */
function formatDzd(n) {
  return Number(n).toLocaleString('fr-DZ') + ' DZD';
}

/** Une date de base (« 2026-11-10 17:02:11 ») lisible dans l'interface. */
function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
}
