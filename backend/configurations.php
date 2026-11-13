<?php
/**
 * configurations.php — Les PC enregistrés.
 *
 * Une configuration = une ligne dans `configurations` (le nom, le budget,
 * l'usage, la résolution, le total) + une ligne par pièce dans
 * `configuration_components` (avec la quantité). C'est la relation
 * plusieurs-à-plusieurs entre un PC et des composants.
 *
 * Sur le total : `total_price` est calculé par le serveur à partir des prix
 * réellement présents dans `component_prices`. Si une pièce n'a pas de prix
 * en base, le total reste NULL au lieu d'afficher un montant incomplet comme
 * s'il était complet. Les prix saisis à la main dans PC Builder, eux,
 * continuent d'exister dans le navigateur (localStorage), comme avant.
 *
 * Utilisations :
 *   backend/configurations.php          → les 50 dernières configurations
 *   backend/configurations.php?id=3     → une configuration avec ses composants
 *   POST backend/configurations.php     → enregistrer la configuration du PC Builder
 *   DELETE backend/configurations.php?id=3 → supprimer une configuration
 */

require_once __DIR__ . '/helpers.php';

handle(function (): void {
    // Seule la CREATION d'une configuration reste publique : c'est le bouton
    // « Enregistrer mon PC » du visiteur. La supprimer demande le mot de passe.
    require_admin_write(['POST']);

    switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {
        case 'GET':
            $id = query_int('id');
            $id === null ? list_configurations() : single_configuration($id);
            break;
        case 'POST':
            create_configuration();
            break;
        case 'DELETE':
            delete_configuration();
            break;
        default:
            send_error('Méthode non acceptée ici.', 405, 'Utilise GET, POST ou DELETE.');
    }
});

/**
 * Liste + ses composants.
 * Les composants de TOUTES les configurations sont lus en une seule requête
 * (Table IN) : avec une requête par configuration, 50 configs = 51 requêtes.
 */
function list_configurations(): void
{
    $configurations = db()->query(
        'SELECT `id`, `name`, `budget`, `usage`, `resolution`, `total_price`, `created_at`
         FROM `configurations`
         ORDER BY `created_at` DESC, `id` DESC
         LIMIT 50'
    )->fetchAll();

    if ($configurations === []) {
        send_ok(
            ['configurations' => []],
            [
                'count' => 0,
                'emptyMessage' => 'Aucune configuration enregistrée dans la base. Enregistre une configuration depuis PC Builder.',
            ]
        );
    }

    $ids  = array_map(static fn(array $row): int => (int) $row['id'], $configurations);
    $link = components_of($ids);

    $result = array_map(function (array $row) use ($link): array {
        return format_configuration($row, $link[(int) $row['id']] ?? []);
    }, $configurations);

    send_ok(['configurations' => $result], ['count' => count($result)]);
}

/** Une configuration détaillée. */
function single_configuration(int $id): void
{
    $statement = db()->prepare(
        'SELECT `id`, `name`, `budget`, `usage`, `resolution`, `total_price`, `created_at`
         FROM `configurations` WHERE `id` = ?'
    );
    $statement->execute([$id]);
    $row = $statement->fetch();

    if ($row === false) {
        send_error('Cette configuration n\'existe pas dans la base.', 404, 'Utilise configurations.php sans id pour voir la liste.');
    }

    send_ok(['configuration' => format_configuration($row, components_of([$id])[$id] ?? [])]);
}

/**
 * Enregistrement d'une configuration envoyée par PC Builder.
 *
 * Corps attendu :
 * {
 *   "name": "Ma configuration",
 *   "budget": 180000,
 *   "usage": "gaming",
 *   "resolution": "1080p",
 *   "parts": { "cpu": "r5-7600", "gpu": 18, "board": "b650-ddr5", ... }
 * }
 * `parts` accepte le slug (r5-7600) ou l'id numérique (18). Une valeur vide
 * ou inconnue est ignorée silencieusement, jamais inventée.
 */
function create_configuration(): void
{
    $body = request_body();

    $name       = clean_text(body_required($body, 'name', 'Nom de la configuration'), 150, 'Nom de la configuration');
    $budget     = body_money($body, 'budget', 'Budget', true);
    $usage      = body_choice($body, 'usage', ['gaming', 'code', 'video', '3d', 'office'], 'Utilisation', 'gaming');
    $resolution = body_choice($body, 'resolution', RESOLUTIONS, 'Résolution', RESOLUTIONS[0]);

    $parts = resolve_parts($body['parts'] ?? []);

    if ($parts === []) {
        send_error('Aucun composant reconnu dans cette configuration.', 422, 'Sélectionne au moins une pièce dans PC Builder avant d\'enregistrer.');
    }

    $total = database_total($parts);

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $insertConfig = $pdo->prepare(
            'INSERT INTO `configurations`
                (`name`, `budget`, `usage`, `resolution`, `total_price`)
             VALUES (?, ?, ?, ?, ?)'
        );
        $insertConfig->execute([$name, $budget, $usage, $resolution, $total]);
        $configurationId = (int) $pdo->lastInsertId();

        $insertLink = $pdo->prepare(
            'INSERT INTO `configuration_components`
                (`configuration_id`, `component_id`, `quantity`)
             VALUES (?, ?, ?)'
        );
        foreach ($parts as $componentId => $quantity) {
            $insertLink->execute([$configurationId, $componentId, $quantity]);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    $read = $pdo->prepare(
        'SELECT `id`, `name`, `budget`, `usage`, `resolution`, `total_price`, `created_at`
         FROM `configurations` WHERE `id` = ?'
    );
    $read->execute([$configurationId]);

    send_ok(
        ['configuration' => format_configuration($read->fetch(), components_of([$configurationId])[$configurationId] ?? [])],
        [
            'message' => $total === null
                ? 'Configuration enregistrée. Total non calculé : certaines pièces n\'ont pas encore de prix en base.'
                : 'Configuration enregistrée avec un total basé sur les prix de la base.',
            'totalPriceComplete' => $total !== null,
        ]
    );
}

/** Suppression. Les composants liés partent avec, grâce à ON DELETE CASCADE. */
function delete_configuration(): void
{
    require_method('DELETE');

    $id = query_int('id');
    if ($id === null) {
        send_error('Il manque l\'id de la configuration à supprimer.', 422, 'Utilise configurations.php?id=123');
    }

    $statement = db()->prepare('DELETE FROM `configurations` WHERE `id` = ?');
    $statement->execute([$id]);

    if ($statement->rowCount() === 0) {
        send_error('Cette configuration n\'existe pas dans la base.', 404, '');
    }

    send_ok(['deleted' => $id], ['message' => 'Configuration supprimée, ainsi que les pièces qui y étaient liées.']);
}

/**
 * Transforme `parts` (slug ou id, ou tableau de composants) en
 * [component_id => quantité].
 *
 * Les slugs sont résolus en bloc par une requête préparée avec un placeholder
 * par slug demandé : c'est rapide et ça ne laisse aucune valeur brute dans le SQL.
 *
 * @return array<int, int>
 */
function resolve_parts($parts): array
{
    if (!is_array($parts)) {
        return [];
    }

    // PC Builder envoie { "cpu": "r5-7600", ... } ; on accepte aussi
    // [ { "slug": "r5-7600", "quantity": 2 }, ... ] pour une saisie fine.
    $wanted = [];
    foreach ($parts as $value) {
        if (is_array($value)) {
            $slug = trim((string) ($value['slug'] ?? $value['componentId'] ?? ''));
            $qty  = (int) ($value['quantity'] ?? 1);
        } else {
            $slug = trim((string) $value);
            $qty  = 1;
        }

        // Une pièce non sélectionnée arrive en valeur vide : on l'ignore.
        if ($slug === '' || (ctype_digit($slug) && (int) $slug < 1)) {
            continue;
        }

        $wanted[] = ['ref' => $slug, 'quantity' => max(1, min($qty, 99)), 'isId' => ctype_digit($slug)];
    }

    if ($wanted === []) {
        return [];
    }

    $slugs = array_values(array_unique(array_column(array_filter($wanted, static fn(array $w): bool => !$w['isId']), 'ref')));
    $ids   = array_values(array_unique(array_map('intval', array_column(array_filter($wanted, static fn(array $w): bool => $w['isId']), 'ref'))));

    $bySlug = [];
    if ($slugs !== []) {
        $placeholders = implode(', ', array_fill(0, count($slugs), '?'));
        $statement    = db()->prepare("SELECT `id`, `slug` FROM `components` WHERE `slug` IN ($placeholders)");
        $statement->execute($slugs);
        foreach ($statement->fetchAll() as $row) {
            $bySlug[$row['slug']] = (int) $row['id'];
        }
    }

    $byId = [];
    if ($ids !== []) {
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $statement    = db()->prepare("SELECT `id` FROM `components` WHERE `id` IN ($placeholders)");
        $statement->execute($ids);
        $byId = array_map(static fn(array $row): int => (int) $row['id'], $statement->fetchAll());
    }

    $result = [];
    foreach ($wanted as $entry) {
        $componentId = $entry['isId']
            ? (int) $entry['ref']
            : ($bySlug[$entry['ref']] ?? null);

        if ($componentId === null || ($entry['isId'] && !in_array($componentId, $byId, true))) {
            continue;
        }
        // Une catégorie ne doit apparaître qu'une fois : la quantité s'accumule.
        $result[$componentId] = ($result[$componentId] ?? 0) + $entry['quantity'];
    }

    return $result;
}

/**
 * Total en DZD calculé avec les prix de la base.
 * NULL dès qu'une pièce manque de prix : mieux vaut aucun total qu'un faux total.
 *
 * @param array<int, int> $parts
 */
function database_total(array $parts): ?float
{
    if ($parts === []) {
        return null;
    }

    $placeholders = implode(', ', array_fill(0, count($parts), '?'));
    $statement    = db()->prepare(
        "SELECT c.`id`, lp.`price`
         FROM `components` c
         " . SQL_LATEST_PRICE_JOIN . "
         WHERE c.`id` IN ($placeholders)"
    );
    $statement->execute(array_keys($parts));
    $rows = $statement->fetchAll();

    $pricesById = [];
    foreach ($rows as $row) {
        if ($row['price'] === null) {
            return null; // une pièce sans prix => total partiel, donc non enregistré
        }
        $pricesById[(int) $row['id']] = (float) $row['price'];
    }

    $total = 0.0;
    foreach ($parts as $componentId => $quantity) {
        $total += $pricesById[$componentId] * $quantity;
    }

    return round($total, 2);
}

/**
 * Les composants des configurations demandées, classés par id de configuration.
 *
 * @param int[] $configurationIds
 * @return array<int, array>
 */
function components_of(array $configurationIds): array
{
    if ($configurationIds === []) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($configurationIds), '?'));
    $statement    = db()->prepare(
        "SELECT lc.`configuration_id`, lc.`quantity`,
                c.`id`, c.`slug`, c.`name`, c.`brand`, c.`category`, c.`specifications`, c.`image`,
                lp.`price` AS `latest_price`, lp.`currency`, lp.`source`, lp.`updated_at` AS `price_updated_at`
         FROM `configuration_components` lc
         JOIN `components` c ON c.`id` = lc.`component_id`
         " . SQL_LATEST_PRICE_JOIN . "
         WHERE lc.`configuration_id` IN ($placeholders)
         ORDER BY c.`category`, c.`name`"
    );
    $statement->execute($configurationIds);

    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $grouped[(int) $row['configuration_id']][] = [
            'id'          => (int) $row['id'],
            'slug'        => $row['slug'],
            'name'        => $row['name'],
            'brand'       => $row['brand'],
            'category'    => $row['category'],
            'quantity'    => (int) $row['quantity'],
            'price'       => $row['latest_price'] === null ? null : (float) $row['latest_price'],
            'currency'    => $row['currency'] ?? DB_CURRENCY,
            'priceSource' => $row['source'] ?? null,
            'priceDate'   => $row['price_updated_at'] ?? null,
        ];
    }

    return $grouped;
}

/** Une configuration prête pour le JavaScript. */
function format_configuration(array $row, array $components): array
{
    return [
        'id'              => (int) $row['id'],
        'name'            => $row['name'],
        'budget'          => $row['budget'] === null ? null : (float) $row['budget'],
        'usage'           => $row['usage'],
        'resolution'      => $row['resolution'],
        'totalPrice'      => $row['total_price'] === null ? null : (float) $row['total_price'],
        // Faux = le total n'a pas pu être calculé entièrement depuis la base.
        'totalIsComplete' => $row['total_price'] !== null,
        'createdAt'       => $row['created_at'],
        'components'      => $components,
    ];
}
