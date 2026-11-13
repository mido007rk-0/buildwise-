<?php
/**
 * config.php — La connexion à MySQL.
 *
 * SEULS LES FICHIERS DE backend/ ONT BESOIN DE CE DOCUMENT :
 *   c'est ici qu'ils vont chercher la connexion. Le JavaScript du navigateur,
 *   lui, ne lit jamais ce fichier. Le mot de passe reste donc sur ton
 *   ordinateur, dans le dossier backend/.
 *
 * POUR CHANGER TES IDENTIFIANTS :
 *   chez toi (XAMPP), modifie les valeurs entre guillemets ci-dessous. Elles
 *   correspondent aux réglages par défaut de XAMPP (utilisateur root, mot de
 *   passe vide).
 *
 *   sur un hébergeur, ne touche pas ce fichier : copie backend/env.example.php
 *   en backend/env.php et remplis-le. Les identifiants restent ainsi hors du
 *   code public, ce que le projet exige.
 *
 * AVANCÉ (facultatif) : chaque valeur peut aussi venir de backend/env.php (une
 * constante dont le nom commence par BUILDWISE_), sans modifier ce fichier.
 */

/**
 * PHP ne doit jamais afficher un avertissement AU MILIEU de la réponse JSON :
 * le JavaScript ne pourrait plus la lire et afficherait « le serveur a répondu
 * sans JSON ». Les erreurs partent donc dans le journal de PHP, pas dans la
 * réponse. Les erreurs de syntaxe de ce fichier restent visibles, elles :
 * PHP les affiche avant même d'exécuter cette ligne.
 */
ini_set('display_errors', '0');
ini_set('log_errors', '1');

/**
 * Lis une valeur de configuration, sinon utilise le défaut.
 *
 * Trois sources, dans cet ordre :
 *   1. une constante posée par backend/env.php  — la voie qui marche partout ;
 *   2. une vraie variable d'environnement       — si l'hébergeur sait en fournir ;
 *   3. le défaut écrit dans ce fichier          — XAMPP, chez toi.
 *
 * Pourquoi la constante d'abord : les hébergeurs gratuits mettent souvent
 * `putenv` dans leur liste `disable_functions` (c'est le cas d'InfinityFree).
 * Un fichier env.php basé sur `define()` ne dépend d'aucune fonction autorisée
 * ou interdite : il fait simplement du PHP.
 */
function env(string $name, string $default = ''): string
{
    if (defined($name)) {
        $value = (string) constant($name);
        return $value === '' ? $default : $value;
    }

    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
}

/**
 * SUR UN HÉBERGEUR — les identifiants ne vivent pas dans ce fichier.
 *
 * backend/env.php (fabriqué depuis backend/env.example.php) pose les constantes
 * avec les valeurs réelles : nom de la base en ligne, utilisateur, mot de passe
 * MySQL. Ce fichier-là ne quitte jamais ton ordinateur, n'est jamais dans la
 * ZIP, et Apache refuse de le servir (voir le .htaccess de la racine).
 *
 * Chez toi, dans XAMPP, il n'existe pas : les 5 valeurs par défaut ci-dessous
 * s'appliquent, et ton installation continue de fonctionner telle quelle.
 */
if (is_readable(__DIR__ . '/env.php')) {
    require_once __DIR__ . '/env.php';
}

/**
 * Fuseau horaire du projet. XAMPP arrive réglé sur « Europe/Berlin », qui a la
 * même heure que l'Algérie en hiver mais une heure d'avance en été. Comme le
 * site compare des dates de vérification de prix (« ce prix a-t-il été vu
 * aujourd'hui ? »), on fixe le fuseau algérien pour que « aujourd'hui » veuille
 * dire la même chose sur ton écran et dans PHP.
 *
 * Après le chargement de env.php : si tu changes de fuseau, tu le fais dans
 * env.php sans toucher à ce fichier.
 */
date_default_timezone_set(env('BUILDWISE_TIMEZONE', 'Africa/Algiers'));

// --- Ajuste ces 5 lignes selon ton installation -----------------------------
define('DB_HOST',     env('BUILDWISE_DB_HOST', '127.0.0.1')); // XAMPP : 127.0.0.1
define('DB_PORT',     env('BUILDWISE_DB_PORT', '3306'));      // port MySQL par défaut
define('DB_NAME',     env('BUILDWISE_DB_NAME', 'buildwise')); // nom de la base du projet
define('DB_USER',     env('BUILDWISE_DB_USER', 'root'));      // utilisateur par défaut XAMPP
define('DB_PASSWORD', env('BUILDWISE_DB_PASSWORD', ''));      // mot de passe par défaut XAMPP : vide
// ---------------------------------------------------------------------------

// La devise affichée par le site. Change-la ici si tu travailles en EUR ou en TND.
define('DB_CURRENCY', env('BUILDWISE_CURRENCY', 'DZD'));

/**
 * Retourne la connexion MySQL, créée une seule fois par requête PHP.
 *
 * Pourquoi ces réglages :
 *  - ERRMODE_EXCEPTION    : une erreur SQL remonte en exception, donc en message
 *                           clair pour le débutant, au lieu d'un écran blanc.
 *  - CHARSET utf8mb4      : les accents français et les spécifications JSON
 *                           s'enregistrent correctement.
 *  - EMULATE_PREPARES off : le vrai prepare/execute de MySQL est utilisé, ce qui
 *                           protège des injections SQL (consigne du projet).
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    return $pdo;
}
