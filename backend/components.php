<?php
/**
 * components.php — Le catalogue des composants, lu depuis MySQL.
 *
 * Avant, cette liste était écrite en dur dans le JavaScript de BuildWise.html.
 * Elle vient maintenant de la table `components`, donc tu peux ajouter, corriger
 * ou retirer un composant dans la base sans toucher au code du site.
 *
 * Utilisations :
 *   backend/components.php                      → tous les composants
 *   backend/components.php?category=cpu         → une seule famille
 *   backend/components.php?category=gpu&brand=NVIDIA
 *   backend/components.php?q=ryzen              → recherche dans les noms
 *   backend/components.php?id=12                → un composant précis
 *   backend/components.php?slug=rtx4060         → par son identifiant technique
 *   backend/components.php?action=summary       → compteurs pour l'interface
 *   POST backend/components.php                 → ajouter un composant (admin.html)
 */

require_once __DIR__ . '/helpers.php';

handle(function (): void {
    // Ajouter un composant change le catalogue vu par tout le monde :
    // réservé à l'administrateur connecté. La lecture reste publique.
    require_admin_write();

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        create_component();
    }

    require_method('GET');

    // L'action "summary" répond à une question différente : combien de choses
    // existent dans la base, et combien ont un vrai prix.
    if (query_str('action') === 'summary') {
        send_ok(summary());
    }

    $id   = query_int('id');
    $slug = query_str('slug');

    if ($id !== null || $slug !== '') {
        $component = find_one($id, $slug);
        if ($component === null) {
            send_error('Composant introuvable dans la base de données.', 404, 'Vérifie l\'id ou le slug demandé.');
        }
        send_ok(['component' => $component]);
    }

    send_ok(['components' => search()]);
});

/**
 * Recherche simple avec des requêtes préparées.
 * La valeur de `category` est d'abord confrontée à la liste CATEGORIES :
 * une valeur inventée ne peut donc jamais atteindre le SQL.
 */
function search(): array
{
    $where  = [];
    $params = [];

    $category = query_str('category');
    if ($category !== '') {
        if (!in_array($category, CATEGORIES, true)) {
            send_error("Famille de composants inconnue : $category", 422, 'Familles autorisées : ' . implode(', ', CATEGORIES));
        }
        $where[]      = 'c.`category` = :category';
        $params[':category'] = $category;
    }

    $brand = query_str('brand');
    if ($brand !== '') {
        $where[]           = 'c.`brand` = :brand';
        $params[':brand']  = $brand;
    }

    // Le texte de recherche passe par un placeholder, jamais par du SQL collé.
    $term = query_str('q');
    if ($term !== '') {
        $where[]        = '(c.`name` LIKE :term1 OR c.`slug` LIKE :term2)';
        $params[':term1'] = '%' . $term . '%';
        $params[':term2'] = '%' . $term . '%';
    }

    $limit  = 200;
    $offset = 0;

    // `limit` et `offset` sont attendus dans l'URL mais PDO ne permet pas
    // partout de placer un placeholder sur LIMIT : on les fabrique donc ici,
    // à partir d'entiers forcés, jamais à partir du texte du navigateur.
    $requestedLimit = query_str('limit');
    if ($requestedLimit !== '' && ctype_digit($requestedLimit)) {
        $limit = min(max((int) $requestedLimit, 1), 500);
    }
    $requestedOffset = query_str('offset');
    if ($requestedOffset !== '' && ctype_digit($requestedOffset)) {
        $offset = (int) $requestedOffset;
    }

    // Tri simple et prévisible : famille puis nom. L'interface, elle, présente
    // toujours les familles dans son ordre métier (cpu, gpu, carte mère...).
    $sql = 'SELECT c.*,
                   lp.`price` AS `latest_price`, lp.`currency`, lp.`source`,
                   lp.`source_url`, lp.`verified_at` AS `price_verified_at`,
                   lp.`updated_at` AS `price_updated_at`
            FROM `components` c
            ' . SQL_LATEST_PRICE_JOIN .
         ($where === [] ? '' : '    WHERE ' . implode(' AND ', $where) . "\n") .
         '  ORDER BY c.`category`, c.`name`
            LIMIT ' . $limit . ' OFFSET ' . $offset;

    $statement = db()->prepare($sql);
    $statement->execute($params);

    return array_map('format_component', $statement->fetchAll());
}

/** Un composant par id numérique ou par slug. */
function find_one(?int $id, string $slug): ?array
{
    $sql = 'SELECT c.*,
                   lp.`price` AS `latest_price`, lp.`currency`, lp.`source`,
                   lp.`source_url`, lp.`verified_at` AS `price_verified_at`,
                   lp.`updated_at` AS `price_updated_at`
            FROM `components` c
            ' . SQL_LATEST_PRICE_JOIN . '
            WHERE ' . ($id !== null ? 'c.`id` = ?' : 'c.`slug` = ?') . '
            LIMIT 1';

    $statement = db()->prepare($sql);
    $statement->execute([$id !== null ? $id : $slug]);
    $row = $statement->fetch();

    return $row === false ? null : format_component($row);
}

/**
 * Compteurs affichés dans l'interface et dans admin.html.
 * Ils disent aussi la vérité sur ce qui manque : c'est le principe du projet,
 * un nombre de prix à zéro doit rester visible comme zéro.
 */
function summary(): array
{
    $byCategory = db()->query(
        'SELECT c.`category`,
                COUNT(*) AS `components`,
                SUM(lp.`id` IS NOT NULL) AS `with_price`
         FROM `components` c
         ' . SQL_LATEST_PRICE_JOIN . '
         GROUP BY c.`category`
         ORDER BY c.`category`'
    )->fetchAll();

    $totals = db()->query(
        'SELECT
            (SELECT COUNT(*) FROM `components`)                     AS components,
            (SELECT COUNT(*) FROM `components` WHERE `price` > 0)   AS priced_by_reference,
            (SELECT COUNT(*) FROM `component_prices`)                AS price_records,
            (SELECT COUNT(*) FROM `benchmarks`)                      AS benchmarks,
            (SELECT COUNT(*) FROM `configurations`)                  AS configurations,
            (SELECT COUNT(*) FROM `compatibility`)                   AS compatibility_rows,
            (SELECT COUNT(*) FROM `compatibility` WHERE `compatibility_status` = \'compatible\') AS compatibility_ok'
    )->fetch();

    return [
        'totals'        => array_map(static fn($value) => (int) $value, $totals),
        'byCategory'    => array_map(static fn(array $row): array => [
            'category'   => $row['category'],
            'components' => (int) $row['components'],
            'withPrice'  => (int) ($row['with_price'] ?? 0),
        ], $byCategory),
        'currency'      => DB_CURRENCY,
        // Le site a besoin de savoir si des données réelles existent déjà.
        'hasAnyPrice'   => (int) $totals['price_records'] > 0,
        'hasAnyBenchmark' => (int) $totals['benchmarks'] > 0,
    ];
}

/**
 * Les champs techniques autorisés sont décrits par SPEC_FIELDS dans
 * helpers.php : c'est la liste que le formulaire d'admin.html reproduit.
 */

/**
 * Ajout d'un composant depuis admin.html.
 *
 * Corps attendu :
 * {
 *   "name": "AMD Ryzen 5 8600G",
 *   "brand": "AMD",
 *   "category": "cpu",
 *   "slug": "r5-8600g",            ← facultatif, fabriqué depuis le nom sinon
 *   "specifications": { "socket": "AM5", "tier": 2 }
 * }
 *
 * Le prix n'est PAS accepté ici : un composant arrive en base sans prix, et
 * son premier prix entre par prices.php avec sa source. C'est la règle du
 * projet : aucun chiffre inventé ne peut entrer dans la base.
 */
function create_component(): void
{
    require_method('POST');

    $body = request_body();

    $name     = clean_text(body_required($body, 'name', 'Nom du composant'), 180, 'Nom du composant');
    $category = body_required($body, 'category', 'Famille');

    if (!in_array($category, CATEGORIES, true)) {
        send_error("Famille de composants inconnue : $category", 422, 'Familles autorisées : ' . implode(', ', CATEGORIES));
    }

    $brand    = isset($body['brand']) && trim((string) $body['brand']) !== ''
        ? clean_text((string) $body['brand'], 60, 'Marque')
        : null;

    $slug = isset($body['slug']) && trim((string) $body['slug']) !== ''
        ? slugify((string) $body['slug'])
        : slugify($name);

    if ($slug === '') {
        send_error('Le slug fabriqué est vide.', 422, 'Utilise un nom contenant au moins une lettre ou un chiffre.');
    }

    if (slug_exists($slug)) {
        send_error("Ce slug existe déjà en base : $slug", 409, 'Choisis un autre slug, par exemple ' . $slug . '-2.');
    }

    $specifications = clean_specifications($category, $body['specifications'] ?? []);

    $insert = db()->prepare(
        'INSERT INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`)
         VALUES (?, ?, ?, ?, ?)'
    );
    $insert->execute([$slug, $name, $brand, $category, json_encode($specifications, JSON_UNESCAPED_UNICODE)]);

    // Relecture par find_one() : la même requête que les autres lectures, donc
    // avec les colonnes de prix jointes que format_component() attend.
    $component = find_one((int) db()->lastInsertId(), '');

    send_ok(
        ['component' => $component],
        [
            'message' => 'Composant ajouté sans prix : saisis maintenant un prix sourcé dans l’onglet Prix.',
            'specifications' => $specifications,
        ]
    );
}

/**
 * Fabrique un slug sûr : minuscules sans accents, lettres, chiffres et tirets.
 * Le slug sert de référence stable côté JavaScript (comme 'r5-7600' avant).
 */
function slugify(string $value): string
{
    $mapped = strtr(mb_strtolower(trim($value), 'UTF-8'), [
        'à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a',
        'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
        'ý' => 'y', 'ñ' => 'n', 'ç' => 'c', 'œ' => 'oe', 'æ' => 'ae',
    ]);

    $clean = preg_replace('/[^a-z0-9]+/', '-', $mapped);

    return trim((string) $clean, '-');
}

/** Un slug est-il déjà pris ? (requête préparée, jamais une valeur collée) */
function slug_exists(string $slug): bool
{
    $statement = db()->prepare('SELECT 1 FROM `components` WHERE `slug` = ? LIMIT 1');
    $statement->execute([$slug]);

    return $statement->fetch() !== false;
}

/**
 * Garde uniquement les champs techniques autorisés pour la famille, et
 * contrôle chacun d'eux. Une valeur inconnue est refusée, pas stockée.
 *
 * @return array<string, mixed>
 */
function clean_specifications(string $category, $raw): array
{
    if (!is_array($raw)) {
        send_error('Les caractéristiques techniques sont mal formulées.', 422, 'Envoyer un objet JSON, par exemple {"socket":"AM5","tier":2}.');
    }

    $allowed = SPEC_FIELDS[$category] ?? [];
    $clean   = [];

    foreach ($allowed as $field => $kind) {
        $value = $raw[$field] ?? null;
        if ($value === null || trim((string) $value) === '') {
            continue;
        }

        $clean[$field] = match ($kind) {
            'tier'  => spec_int($field, (int) $value, 1, 5, 'niveau (de 1 à 5)'),
            'gb'    => spec_int($field, (int) $value, 1, 8192, 'capacité en Go'),
            'watts' => spec_int($field, (int) $value, 100, 3000, 'puissance en watts'),
            'ram'   => spec_choice($field, (string) $value, ['DDR3', 'DDR4', 'DDR5'], 'génération de mémoire'),
            default => mb_substr(clean_text((string) $value, 40, $field), 0, 40),
        };
    }

    return $clean;
}

/** Un nombre entier de caractéristique, dans une plage qui a du sens. */
function spec_int(string $field, int $value, int $min, int $max, string $label): int
{
    if ($value < $min || $value > $max) {
        send_error("Valeur impossible pour « $field » : $value.", 422, "Attends $label entre $min et $max.");
    }

    return $value;
}

/** Une valeur choisie dans une liste courte (DDR4, DDR5...). */
function spec_choice(string $field, string $value, array $allowed, string $label): string
{
    $upper = mb_strtoupper(trim($value), 'UTF-8');

    if (!in_array($upper, $allowed, true)) {
        send_error("Valeur inconnue pour « $field » : $value", 422, 'Valeurs autorisées : ' . implode(', ', $allowed) . ".");
    }

    return $upper;
}
