<?php
/**
 * helpers.php — La boîte à outils commune à tous les fichiers de backend/.
 *
 * Elle sert à ne pas répéter cinq fois le même code pour :
 *   - répondre en JSON au JavaScript (fetch) ;
 *   - lire les paramètres envoyés par le navigateur ;
 *   - vérifier qu'une valeur est correcte avant de toucher à MySQL ;
 *   - transformer une erreur technique en message français compréhensible.
 *
 * RÈGLE DE SÉCURITÉ DU PROJET : aucune requête SQL n'est écrite en
 * concaténant une valeur envoyée par le navigateur. On utilise toujours
 * des placeholders `?` ou `:nom` avec PDO::prepare() (requêtes préparées).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

/** Les 8 familles de composants autorisées, identiques à l'ENUM SQL. */
const CATEGORIES = ['cpu', 'gpu', 'board', 'ram', 'storage', 'psu', 'case', 'cooler'];

/** Les résolutions proposées par le site. */
const RESOLUTIONS = ['1080p', '1440p', '4K'];

/** Les statuts de compatibilité autorisés, identiques à l'ENUM SQL. */
const COMPAT_STATUSES = ['compatible', 'incompatible', 'unknown'];

/**
 * Les champs techniques que le site sait lire, famille par famille.
 *
 * admin.html ne peut envoyer que ces clés-là : tout le reste est refusé.
 * C'est ce qui remplace un formulaire libre qui fabriquerait du JSON
 * imprévisible, et ce qui garde les règles du Compatibility Checker
 * fonctionnelles (elles lisent `socket` et `ramType`).
 *
 * Déclaré ici et non dans components.php : un `const` placé après l'appel à
 * handle() n'existerait pas encore au moment de la requête, car handle()
 * termine le script.
 */
const SPEC_FIELDS = [
    'cpu'     => ['socket' => 'text', 'tier' => 'tier'],
    'gpu'     => ['tier' => 'tier', 'vram' => 'gb'],
    'board'   => ['socket' => 'text', 'ramType' => 'ram'],
    'ram'     => ['ramType' => 'ram', 'gb' => 'gb'],
    'storage' => ['gb' => 'gb', 'type' => 'text'],
    'psu'     => ['watts' => 'watts'],
    'case'    => ['format' => 'text'],
    'cooler'  => ['kind' => 'text'],
];

/**
 * Réponse JSON unique pour tout le backend.
 * Format : { ok: true|false, data: ..., error: ..., meta: ... }
 */
function send_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/** Réponse de succès. `$meta` sert à dire au site combien de lignes existent. */
function send_ok($data, array $meta = []): void
{
    send_json(['ok' => true, 'data' => $data, 'meta' => $meta]);
}

/**
 * Réponse d'erreur.
 * `$hint` est le conseil affiché à l'utilisateur, par exemple « lance
 * database/buildwise.sql dans phpMyAdmin ».
 * Aucun mot de passe, aucun DSN, aucun texte de requête ne transite ici.
 */
function send_error(string $message, int $status = 400, string $hint = '', array $extra = []): void
{
    send_json(['ok' => false, 'error' => ['message' => $message, 'hint' => $hint] + $extra], $status);
}

/**
 * Enveloppe chaque endpoint dans une capture d'erreurs.
 * L'appelant n'écrit donc que la logique métier.
 */
function handle(callable $handler): void
{
    try {
        $handler();
    } catch (PDOException $e) {
        // Le détail technique part dans les journaux PHP, pas vers le navigateur.
        error_log('BuildWise SQL: ' . $e->getMessage());
        send_error(
            'La base de données a refusé la requête.',
            500,
            'Vérifie que MySQL/MariaDB est démarré dans XAMPP et que database/buildwise.sql a été importé.',
            ['sqlState' => $e->getCode()]
        );
    } catch (Throwable $e) {
        error_log('BuildWise PHP: ' . $e->getMessage());
        send_error('Le serveur PHP a rencontré une erreur inattendue.', 500, 'Ouvre backend/check.php et regarde les journaux d\'Apache (logs/php_error_log).');
    }
}

/** Lit une valeur envoyée dans l'URL : components.php?category=cpu */
function query_str(string $key, string $default = ''): string
{
    $value = $_GET[$key] ?? $default;
    return is_string($value) ? trim($value) : $default;
}

/** Lit un nombre entier envoyé dans l'URL, ou null s'il est absent ou faux. */
function query_int(string $key): ?int
{
    $raw = $_GET[$key] ?? null;
    if ($raw === null || $raw === '' || !is_string($raw)) {
        return null;
    }
    return ctype_digit($raw) ? (int) $raw : null;
}

/**
 * Lit le corps JSON envoyé par fetch() avec method: 'POST'.
 * Retourne un tableau vide si le navigateur n'a rien envoyé.
 */
function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        send_error('Le corps de la requête n\'est pas du JSON valide.', 400, 'Utilise Content-Type: application/json avec fetch().');
    }
    return $decoded;
}

/** Oblige le navigateur à utiliser la méthode attendue (GET pour lire, POST pour écrire). */
function require_method(string $method): void
{
    $actual = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($actual !== $method) {
        send_error("Cette adresse n'accepte que la methode $method.", 405, '', ['allowedMethod' => $method]);
    }
}

/**
 * Récupère une valeur obligatoire dans le corps JSON et la nettoie.
 * Si elle manque : erreur 400 immédiate, aucune requête SQL lancée.
 */
function body_required(array $body, string $key, string $label): string
{
    $value = $body[$key] ?? null;
    if ($value === null || $value === '' || (is_string($value) && trim($value) === '')) {
        send_error("Il manque la valeur « $label ».", 422, "Ce champ est obligatoire : $key.");
    }
    return is_string($value) ? trim($value) : (string) $value;
}

/** Récupère une valeur facultative déjà validée par un tableau de choix. */
function body_choice(array $body, string $key, array $allowed, string $label, string $default = ''): string
{
    $value = trim((string) ($body[$key] ?? $default));
    if ($value === '') {
        return $default;
    }
    if (!in_array($value, $allowed, true)) {
        send_error("Valeur non reconnue pour « $label » : $value", 422, 'Choix autorisés : ' . implode(', ', $allowed));
    }
    return $value;
}

/**
 * Valide un montant (prix, budget, total) et le ramène à 2 décimales.
 * $allowNull = true sert aux configs où le prix n'est pas encore connu.
 */
function body_money(array $body, string $key, string $label, bool $allowNull = false): ?float
{
    $raw = $body[$key] ?? null;

    if (($raw === null || $raw === '') && $allowNull) {
        return null;
    }

    $value = is_string($raw) ? str_replace([' ', "\u{00A0}"], '', $raw) : $raw;

    if (!is_numeric($value)) {
        send_error("« $label » doit être un nombre.", 422, 'Saisis un montant sans texte, par exemple 45000.');
    }
    $number = (float) $value;
    if ($number < 0) {
        send_error("« $label » ne peut pas être négatif.", 422, 'Un prix ou un budget est toujours positif.');
    }
    if ($number > 9999999999.99) {
        send_error("« $label » est trop grand pour être enregistré.", 422, 'Maximum autorisé : 9 999 999 999,99.');
    }

    return round($number, 2);
}

/**
 * Valide un entier positif (id, quantité, fps).
 * `$hint` explique la règle particulière au champ, car la raison d'un refus
 * n'est pas la même pour un identifiant de base que pour une mesure de FPS.
 */
function body_positive_int(array $body, string $key, string $label, int $max = 4294967295, ?int $default = null, string $hint = 'Les identifiants de la base commencent à 1.'): ?int
{
    $raw = $body[$key] ?? null;

    if (($raw === null || $raw === '') && $default !== null) {
        return $default;
    }
    if (!is_numeric($raw) || (float) $raw !== floor((float) $raw)) {
        send_error("« $label » doit être un nombre entier.", 422, 'Valeur reçue : ' . json_encode($raw));
    }
    $value = (int) $raw;
    if ($value < 1 || $value > $max) {
        send_error("« $label » doit être entre 1 et $max.", 422, $hint);
    }
    return $value;
}

/**
 * Valide une date au format «AAAA-MM-JJ» (celui que renvoie un champ
 * `<input type="date">` du navigateur) et refuse l'avenir.
 *
 * Pourquoi refuser l'avenir : une date de vérification déclare « j'ai vu ce
 * prix ce jour-là ». Une date future serait une donnée inventée, ce que le
 * projet interdit.
 *
 * @param bool $required true = le champ est obligatoire, false = NULL autorisé.
 */
function body_date(array $body, string $key, string $label, bool $required = false, ?string $default = null): ?string
{
    $raw = trim((string) ($body[$key] ?? ''));

    if ($raw === '') {
        if ($required) {
            send_error("Il manque la date « $label ».", 422, 'Le format attendu est AAAA-MM-JJ, par exemple 2026-11-10.');
        }
        return $default;
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        send_error("« $label » n'est pas une date valide.", 422, 'Le format attendu est AAAA-MM-JJ, par exemple 2026-11-10.');
    }

    // Le « ! » est indispensable : sans lui, PHP complète l'heure manquante avec
    // l'heure actuelle, et la date du jour serait alors « plus tard » que
    // minuit — donc refusée à tort comme étant dans le futur.
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $raw);
    if ($date === false || $date->format('Y-m-d') !== $raw) {
        send_error("« $label » n'existe pas dans le calendrier.", 422, 'Valeur reçue : ' . $raw);
    }

    $today = new DateTimeImmutable('today');
    if ($date > $today) {
        send_error("« $label » est dans le futur.", 422, 'On ne vérifie un prix que le jour où on le voit. Aujourd\'hui : ' . $today->format('Y-m-d') . '.');
    }

    return $raw;
}

/** Décode la colonne JSON `specifications` en objet utilisable par le JavaScript. */
function decode_specifications(?string $raw): ?array
{
    if ($raw === null || trim($raw) === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

/** Nettoie une chaîne libre (nom, source, note) : espaces de trop et longueur. */
function clean_text(?string $value, int $maxLength, string $label): string
{
    $text = trim(preg_replace('/\s+/u', ' ', (string) $value));
    if (mb_strlen($text) > $maxLength) {
        send_error("« $label » dépasse $maxLength caractères.", 422, 'Raccourcis la saisie.');
    }
    return $text;
}

/**
 * Ligne SQL partagée : le prix le plus récent d'un composant.
 * `component_prices` garde tout l'historique ; on affiche le dernier vérifié.
 * C'est `verified_at` (la date où le prix a été constaté) qui désigne le prix
 * actuel, et non `updated_at` (la date où la ligne a été tapée) : corriger un
 * vieux relevé ne doit pas le faire passer devant un relevé plus récent.
 * `id` départage deux relevés vérifiés le même jour.
 */
const SQL_LATEST_PRICE_JOIN = "
    LEFT JOIN `component_prices` lp ON lp.id = (
        SELECT p2.id FROM `component_prices` p2
        WHERE p2.`component_id` = c.`id`
        ORDER BY p2.`verified_at` DESC, p2.`id` DESC
        LIMIT 1
    )";

/** Transforme une ligne `components` lue en SQL en objet pour le JavaScript. */
function format_component(array $row): array
{
    $hasVerifiedPrice = $row['latest_price'] !== null;

    return [
        'id'             => (int) $row['id'],
        'slug'           => $row['slug'],
        'name'           => $row['name'],
        'brand'          => $row['brand'],
        'category'       => $row['category'],
        // Le site n'affiche un prix que s'il existe vraiment dans la base.
        'price'          => $hasVerifiedPrice ? (float) $row['latest_price'] : null,
        'currency'       => $hasVerifiedPrice ? $row['currency'] : DB_CURRENCY,
        'priceSource'    => $hasVerifiedPrice ? $row['source'] : null,
        'priceSourceUrl' => $hasVerifiedPrice ? $row['source_url'] : null,
        // `priceVerifiedAt` = le jour où le prix a été constaté (ce que voit l'utilisateur).
        'priceVerifiedAt' => $hasVerifiedPrice ? $row['price_verified_at'] : null,
        // `priceUpdatedAt` = le moment où la ligne a été tapée dans la base.
        'priceUpdatedAt' => $hasVerifiedPrice ? $row['price_updated_at'] : null,
        // Prix de secours enregistré directement sur la fiche du composant.
        'listedPrice'    => $row['price'] === null ? null : (float) $row['price'],
        'specifications' => decode_specifications($row['specifications'] ?? null),
        'image'          => $row['image'],
        'createdAt'      => $row['created_at'],
    ];
}
