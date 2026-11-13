/**
 * api.js — Le seul endroit du site qui parle au backend PHP.
 *
 * Le JavaScript n'a jamais accès à MySQL : il envoie une requête HTTP à un
 * fichier de backend/, qui lui répond en JSON. C'est ce qui protège le mot de
 * passe de la base : il reste dans backend/config.php, sur ton ordinateur.
 *
 * Quatre fonctions suffisent pour tout le site :
 *   API.get('components.php', {category:'gpu'})
 *   API.post('prices.php', {component_id:14, price:98500, source:'Boutique X', verified_at:'2026-11-10'})
 *   API.put('prices.php', {id:3, price:96000, ...})   → rectifier une saisie
 *   API.del('configurations.php', {id:3})
 */

const API = {
  /** Dossier des fichiers PHP, relatif à index.html. */
  base: 'backend/',

  /**
   * Jeton de sécurité reçu de backend/login.php. Il accompagne chaque écriture
   * (POST, PUT, DELETE) pour prouver que la demande vient bien de cette page.
   * Le site public, qui ne fait que lire, n'en a jamais besoin.
   */
  csrf: null,
  signedIn: null,

  /**
   * Construit une URL avec ses paramètres d'URL.
   * URLSearchParams encode correctement les accents et les espaces
   * (« Cyberpunk 2077 » devient Cyberpunk+2077), utile pour les filtres.
   */
  url(path, params) {
    const clean = String(path).replace(/^\/+/, '');
    const url = new URL(this.base + clean, window.location.href);
    const query = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    });

    const text = query.toString();
    if (text) url.search = text;
    return url;
  },

  /**
   * Appel bas niveau : envoie la requête, lit le JSON, transforme les erreurs
   * en un seul objet { message, hint } que les pages savent afficher.
   */
  async request(path, { method = 'GET', params = null, body = null } = {}) {
    // Cas très fréquent en débutant : double-clic sur index.html.
    // En file://, aucune requête PHP n'est possible : on l'explique tout de suite.
    if (window.location.protocol === 'file:') {
      throw this.problem(
        "Le site est ouvert en fichier local, sans serveur PHP.",
        "Ouvre http://localhost/BuildWise-MySQL/ dans ton navigateur, Apache et MySQL étant démarrés dans XAMPP. Les étapes sont dans README.md."
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let response;
    try {
      response = await fetch(this.url(path, params), {
        method,
        // Le cookie de session part tout seul ; le jeton, lui, voyage en
        // en-tête : c'est ce qui bloque les écrites venues d'un autre site.
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(method === 'GET' || !this.csrf ? {} : { 'X-BuildWise-Csrf': this.csrf }),
        },
        credentials: 'same-origin',
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      throw this.problem(
        error.name === 'AbortError'
          ? 'Le serveur PHP met trop de temps à répondre.'
          : 'Impossible de joindre le backend PHP.',
        'Vérifie que Apache et MySQL sont démarrés dans XAMPP, puis ouvre backend/check.php.'
      );
    }
    clearTimeout(timer);

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw this.problem(
        'Le serveur a répondu sans JSON (' + response.status + ').',
        'PHP est probablement absent ou un fichier de backend/ affiche une erreur. Ouvre backend/check.php.'
      );
    }

    if (!response.ok || payload.ok !== true) {
      throw this.problem(
        (payload.error && payload.error.message) || 'Le backend a refusé la requête (' + response.status + ').',
        (payload.error && payload.error.hint) || ''
      );
    }

    // On renvoie { data, meta } tels que fabriqués par le PHP.
    return payload;
  },

  /** Fabrique une erreur homogène, avec un conseil d'action pour l'utilisateur. */
  problem(message, hint) {
    const error = new Error(message);
    error.hint = hint || '';
    error.name = 'BuildWiseApiError';
    return error;
  },

  get(path, params) {
    return this.request(path, { method: 'GET', params });
  },

  post(path, body) {
    return this.request(path, { method: 'POST', body });
  },

  /** Rectifie une ligne déjà enregistrée (prix, mesure de FPS). */
  put(path, body) {
    return this.request(path, { method: 'PUT', body });
  },

  del(path, params) {
    return this.request(path, { method: 'DELETE', params });
  },

  /* ------------------------------------------------------------------ *
   * Mot de passe administrateur (trois appels, tous vers login.php)
   *
   * Le site public n'utilise aucune de ces fonctions : il ne fait que lire,
   * et la lecture est ouverte à tout le monde. admin.html, lui, s'en sert
   * pour obtenir le jeton qui accompagne chaque écriture.
   * ------------------------------------------------------------------ */

  /** « Suis-je déjà connecté ? » + le jeton de sécurité de cette session. */
  async authStatus() {
    const answer = await this.get('login.php');
    this.csrf = answer.data.csrf || null;
    this.signedIn = answer.data.signedIn === true;
    return answer.data;
  },

  /** Envoie le mot de passe à PHP, puis mémorise le nouveau jeton. */
  async login(password) {
    const answer = await this.post('login.php', { action: 'login', password });
    this.csrf = answer.data.csrf || null;
    this.signedIn = answer.data.signedIn === true;
    return answer.data;
  },

  async logout() {
    const answer = await this.post('login.php', { action: 'logout' });
    this.csrf = null;
    this.signedIn = false;
    return answer.data;
  },
};
