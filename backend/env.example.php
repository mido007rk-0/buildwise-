<?php
/**
 * env.example.php — Le modèle des identifiants en ligne.
 *
 * À FAIRE UNE SEULE FOIS, APRÈS AVOIR TÉLÉVERSÉ LES FICHIERS SUR L'HÉBERGEUR :
 *   1. Copie ce fichier et nomme la copie  env.php  (dans le même dossier).
 *   2. Ouvre le panneau de l'hébergeur, rubrique « MySQL Databases ».
 *   3. Recopie les 5 valeurs qu'il affiche : serveur, base, utilisateur,
 *      mot de passe. Le port reste 3306.
 *   4. Enregistre. Ne renvoie jamais env.php par message, capture ou ZIP.
 *
 * Ce fichier n'est PAS chargé par le site : c'est backend/env.php qui l'est.
 * Apache refuse les deux (voir le .htaccess de la racine), donc un visiteur
 * qui tape backend/env.php dans son navigateur obtient « accès refusé ».
 *
 * En local, dans XAMPP, rien de tout cela n'est nécessaire : env.php absent,
 * config.php garde ses valeurs par défaut (root, mot de passe vide).
 *
 * POURQUOI des `define()` et pas des `putenv()` :
 *   beaucoup d'hébergeurs gratuits — InfinityFree compris — placent `putenv`
 *   dans leur liste `disable_functions`. Appeler cette fonction là-bas ferait
 *   planter le site entier. `define()` n'est jamais désactivée : elle pose une
 *   constante, et config.php lit les constantes en premier.
 */

// --- Renseigne ces 5 lignes avec les valeurs de ton hébergeur ---------------
define('BUILDWISE_DB_HOST',     'sql000.epizy.com');          // « MySQL Host » du panneau
define('BUILDWISE_DB_PORT',     '3306');                      // presque toujours 3306
define('BUILDWISE_DB_NAME',     'epiz_00000000_buildwise');    // nom complet de la base
define('BUILDWISE_DB_USER',     'epiz_00000000');              // utilisateur de la base
define('BUILDWISE_DB_PASSWORD', 'remplace-moi');               // mot de passe choisi ici
// ----------------------------------------------------------------------------

// Deux réglages que tu peux laisser tels quels.
define('BUILDWISE_CURRENCY', 'DZD');
define('BUILDWISE_TIMEZONE', 'Africa/Algiers');

/**
 * Facultatif : le mot de passe de l'administration.
 *
 * Par défaut, le site lit l'empreinte dans backend/admin-credentials.php.
 * Si tu préfères ne jamais écrire l'empreinte dans ce fichier-là sur
 * l'hébergeur, décommente la ligne ci-dessous et colle-y l'empreinte fabriquée
 * par backend/new-password.php (ouvre cette page après être connecté dans
 * admin.html, puis clique sur « Fabriquer l'empreinte »).
 *
 * define('BUILDWISE_ADMIN_HASH', '$2y$10$coller ici l empreinte');
 */
