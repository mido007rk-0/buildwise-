<?php
/**
 * auth.php — Le verrou des écritures.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Tant que le site restait dans XAMPP, personne d'autre que toi n'y avait
 *   accès : l'administration n'avait donc pas de mot de passe. Publié sur
 *   Internet, ce serait different : chaque visiteur pourrait effacer tes prix.
 *   Cette feuille dit donc au serveur : « lire, tout le monde peut ; écrire,
 *   seulement moi ».
 *
 * CE QUI EST PROTÉGÉ
 *   POST, PUT et DELETE sur tous les fichiers de backend/, SAUF la création
 *   d'une configuration depuis le site public (configurations.php en POST),
 *   qui reste ouverte : c'est la fonction « Enregistrer mon PC » du visiteur.
 *
 * LES DEUX CONTRÔLES D'UNE ÉCRITURE
 *   1. La session : le navigateur doit prouver qu'il s'est connecté
 *      (cookie `buildwise_admin`, signé par PHP, jamais lisible en clair).
 *   2. Le jeton CSRF : une page d'un autre site ne doit pas pouvoir faire
 *      écrire ton navigateur sans que tu le veuilles. Le jeton est envoyé
 *      dans l'en-tête `X-BuildWise-Csrf`.
 *
 * LE MOT DE PASSE
 *   Il n'est écrit nulle part, pas même ici : voir admin-credentials.php.
 */

require_once __DIR__ . '/config.php';

/** Nom du cookie de session et clé qui dit « connecté » à l'intérieur. */
const ADMIN_COOKIE = 'buildwise_admin';
const ADMIN_FLAG   = 'buildwise_admin_ok';
const CSRF_KEY     = 'buildwise_csrf';

/** Combien de fois on peut se tromper avant une pause, et combien de temps. */
const MAX_FAILED   = 5;
const LOCK_SECONDS = 300;

/** Ouvre la session PHP une seule fois, avec des cookies bien réglés. */
function admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,          // le cookie meurt quand on ferme le navigateur
        'path'     => '/',
        'httponly' => true,       // le JavaScript des autres ne peut pas le lire
        'samesite' => 'Lax',      // ne part pas sur les sites étrangers
        'secure'   => !empty($_SERVER['HTTPS']), // en HTTPS sur l'hébergeur
    ]);
    session_name(ADMIN_COOKIE);
    session_start();
}

/** L'empreinte attendue : variable d'environnement sinon le fichier. */
function admin_hash(): string
{
    $fromEnv = env('BUILDWISE_ADMIN_HASH', '');
    if ($fromEnv !== '') {
        return $fromEnv;
    }

    $file = __DIR__ . '/admin-credentials.php';
    if (!is_readable($file)) {
        return '';
    }

    require_once $file;

    return defined('BUILDWISE_ADMIN_HASH') ? BUILDWISE_ADMIN_HASH : '';
}

/** Le navigateur a-t-il déjà montré le mot de passe ? */
function is_admin(): bool
{
    admin_session();

    return !empty($_SESSION[ADMIN_FLAG]);
}

/**
 * Vérifie le mot de passe. Retourne false si c'est faux ou si l'on attend.
 * `$secondsLeft` reçoit le temps de pause restant, pour le message.
 */
function admin_login(string $password, int &$secondsLeft = 0): bool
{
    admin_session();

    $secondsLeft = 0;
    $blocked     = (int) ($_SESSION['buildwise_block_until'] ?? 0);

    if ($blocked > time()) {
        $secondsLeft = $blocked - time();
        return false;
    }

    $hash = admin_hash();

    // Sans empreinte enregistrée, on refuse tout : mieux vaut une porte
    // fermée qu'une porte grande ouverte à cause d'un fichier oublié.
    if ($hash === '' || !password_verify($password, $hash)) {
        $fails = (int) ($_SESSION['buildwise_fails'] ?? 0) + 1;
        $_SESSION['buildwise_fails'] = $fails;

        if ($fails >= MAX_FAILED) {
            $_SESSION['buildwise_block_until'] = time() + LOCK_SECONDS;
            $_SESSION['buildwise_fails']       = 0;
            $secondsLeft = LOCK_SECONDS;
        }

        return false;
    }

    // Réussite : on repart de zéro et on change d'identifiant de session.
    session_regenerate_id(true);
    $_SESSION[ADMIN_FLAG] = true;
    unset($_SESSION['buildwise_fails'], $_SESSION['buildwise_block_until']);

    // Un jeton neuf pour cette session connectée.
    $_SESSION[CSRF_KEY] = bin2hex(random_bytes(32));

    return true;
}

/** Oublie la connexion de ce navigateur. */
function admin_logout(): void
{
    admin_session();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        setcookie(ADMIN_COOKIE, '', time() - 3600, '/');
    }

    session_destroy();
}

/** Le jeton CSRF de la session, créé si besoin. */
function csrf_token(): string
{
    admin_session();

    if (empty($_SESSION[CSRF_KEY])) {
        $_SESSION[CSRF_KEY] = bin2hex(random_bytes(32));
    }

    return $_SESSION[CSRF_KEY];
}

/** Le jeton reçu est-il bien celui de cette session ? */
function csrf_ok(string $token): bool
{
    admin_session();

    return $token !== ''
        && !empty($_SESSION[CSRF_KEY])
        && hash_equals($_SESSION[CSRF_KEY], $token);
}

/**
 * Arrête la requête si une écriture arrive sans administrateur connecté.
 *
 * @param string[] $public méthodes qui restent ouvertes au visiteur
 *                         (ex. ['POST'] pour enregistrer une configuration).
 */
function require_admin_write(array $public = []): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Lire n'est jamais protégé : la page d'accueil du cours reste publique.
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) || in_array($method, $public, true)) {
        return;
    }

    if (!is_admin()) {
        send_error(
            'Mot de passe administrateur demandé.',
            401,
            'Ouvre admin.html, connecte-toi, puis recommence. Les visiteurs, eux, ne peuvent que lire.',
        );
    }

    if (!csrf_ok((string) ($_SERVER['HTTP_X_BUILDWISE_CSRF'] ?? ''))) {
        send_error(
            'Jeton de sécurité absent ou périmé.',
            403,
            'Rafraîchis la page admin.html (F5) pour recharger le jeton, puis réessaie.',
        );
    }
}

/**
 * check.php sert à diagnostiquer une installation : il affiche des
 * informations techniques (versions, utilisateur MySQL). On ne le montre
 * donc qu'à toi, depuis ton ordinateur ou une session connectée.
 */
function guard_local_diagnostic(): void
{
    $address = $_SERVER['REMOTE_ADDR'] ?? '';
    $local   = in_array($address, ['127.0.0.1', '::1', 'localhost'], true);

    if ($local || is_admin()) {
        return;
    }

    send_error(
        'Diagnostic réservé à l\'ordinateur de l\'administrateur.',
        403,
        'Cette page indique des informations techniques sur ton installation. Connecte-toi dans admin.html pour la consulter à distance.',
    );
}
