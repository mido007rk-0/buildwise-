<?php
/**
 * compatibility.php — Les informations de compatibilité entre composants.
 *
 * Deux niveaux, et le site les affiche séparément pour rester honnête :
 *
 *  1. Les règles techniques, recalculées à partir de `components.specifications`
 *     (socket du CPU contre socket de la carte mère, génération DDR de la RAM
 *     contre génération DDR de la carte mère). C'est ce que faisait déjà la
 *     version JavaScript, mais les données viennent maintenant de MySQL.
 *
 *  2. Les constatations humaines, stockées dans la table `compatibility` :
 *     une révision de BIOS nécessaire, un GPU trop long pour un boîtier,
 *     un ventirad qui masque une barrette. Ce niveau ne peut pas être déduit
 *     tout seul : c'est à toi de le saisir, via admin.html.
 *
 * Utilisations :
 *   backend/compatibility.php                       → les dernières constatations
 *   backend/compatibility.php?component_id=18       → tout ce qui concerne un composant
 *   backend/compatibility.php?a=1&b=9               → l'état d'une paire précise
 *   backend/compatibility.php?ids=1,9,14,22         → les paires d'une configuration
 *   POST backend/compatibility.php                  → enregistrer ou corriger une constatation
 *   DELETE backend/compatibility.php?id=7           → supprimer une constatation
 */

require_once __DIR__ . '/helpers.php';

handle(function (): void {
    require_admin_write();

    switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {
        case 'GET':
            read_compatibility();
            break;
        case 'POST':
            save_observation();
            break;
        case 'DELETE':
            delete_observation();
            break;
        default:
            send_error('Méthode non acceptée ici.', 405, 'Utilise GET, POST ou DELETE.');
    }
});

/** Lecture, avec quatre formes de filtre. */
function read_compatibility(): void
{
    $componentId = query_int('component_id');
    $pairA       = query_int('a');
    $pairB       = query_int('b');
    $ids         = query_id_list('ids');

    if ($pairA !== null && $pairB !== null) {
        $statement = db()->prepare(base_sql() . ' WHERE (k.`component_id` = ? AND k.`compatible_component_id` = ?)
                                       OR (k.`component_id` = ? AND k.`compatible_component_id` = ?)
                                       LIMIT 1');
        $statement->execute([$pairA, $pairB, $pairB, $pairA]);
        $rows = $statement->fetchAll();

        send_ok(
            ['records' => array_map('format_record', $rows)],
            [
                'count' => count($rows),
                'emptyMessage' => $rows === []
                    ? 'Aucune constatation enregistrée pour cette paire. Le site applique donc uniquement les règles techniques.'
                    : '',
            ]
        );
    }

    if ($ids !== []) {
        // Les paires dont les DEUX composants font partie de la configuration.
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $statement    = db()->prepare(
            base_sql() . " WHERE k.`component_id` IN ($placeholders)
                            AND k.`compatible_component_id` IN ($placeholders)"
        );
        $statement->execute(array_merge($ids, $ids));
        $rows = $statement->fetchAll();

        send_ok(
            ['records' => array_map('format_record', $rows)],
            [
                'count' => count($rows),
                'emptyMessage' => $rows === []
                    ? 'Aucune constatation enregistrée entre les pièces de cette configuration.'
                    : '',
            ]
        );
    }

    if ($componentId !== null) {
        $statement = db()->prepare(
            base_sql() . ' WHERE k.`component_id` = ? OR k.`compatible_component_id` = ?
                          ORDER BY k.`created_at` DESC, k.`id` DESC LIMIT 200'
        );
        $statement->execute([$componentId, $componentId]);
        $rows = $statement->fetchAll();

        send_ok(
            ['records' => array_map('format_record', $rows)],
            [
                'count' => count($rows),
                'emptyMessage' => $rows === []
                    ? 'Aucune constatation humaine enregistrée pour ce composant. Les règles techniques, elles, s\'appliquent quand même.'
                    : '',
            ]
        );
    }

    // Sans filtre : les 100 constatations les plus récentes de la base.
    $rows = array_map('format_record', db()->query(base_sql() . ' ORDER BY k.`created_at` DESC, k.`id` DESC LIMIT 100')->fetchAll());

    send_ok(['records' => $rows], ['count' => count($rows)]);
}

/**
 * La même sélection, avec le nom des deux composants à chaque fois.
 * `a` désigne la première pièce de la paire, `b` la seconde.
 */
function base_sql(): string
{
    return 'SELECT k.`id`, k.`component_id`, k.`compatible_component_id`,
                  k.`compatibility_status`, k.`notes`, k.`created_at`,
                  ca.`name` AS `a_name`, ca.`slug` AS `a_slug`, ca.`category` AS `a_category`,
                  cb.`name` AS `b_name`, cb.`slug` AS `b_slug`, cb.`category` AS `b_category`
           FROM `compatibility` k
           JOIN `components` ca ON ca.`id` = k.`component_id`
           JOIN `components` cb ON cb.`id` = k.`compatible_component_id`';
}

/**
 * Enregistre (ou corrige) une constatation.
 *
 * ON DUPLICATE KEY UPDATE : si la paire est déjà présente, on remplace son
 * statut et sa note au lieu de créer un doublon. Pour que cela fonctionne,
 * les deux ids sont d'abord triés par ordre croissant — sinon (18 → 9) et
 * (9 → 18) seraient deux lignes différentes aux yeux de la clé unique.
 */
function save_observation(): void
{
    $body = request_body();

    $first  = body_positive_int($body, 'component_id', 'Composant');
    $second = body_positive_int($body, 'compatible_component_id', 'Composant compatible');

    if ($first === $second) {
        send_error('Un composant ne peut pas être comparé à lui-même.', 422, 'Choisis deux composants différents.');
    }

    $status = body_choice($body, 'compatibility_status', COMPAT_STATUSES, 'Statut de compatibilité', 'unknown');
    $notes  = isset($body['notes']) ? clean_text((string) $body['notes'], 500, 'Note') : '';

    // On range la paire dans l'ordre croissant des ids : c'est ce qui évite
    // d'avoir (18 -> 9) ET (9 -> 18) dans la même table.
    $low  = min($first, $second);
    $high = max($first, $second);

    foreach ([$low, $high] as $componentId) {
        $statement = db()->prepare('SELECT `id` FROM `components` WHERE `id` = ?');
        $statement->execute([$componentId]);
        if ($statement->fetch() === false) {
            send_error("Le composant id $componentId n'existe pas dans la table components.", 404, 'Choisis deux composants existants dans admin.html.');
        }
    }

    $statement = db()->prepare(
        'INSERT INTO `compatibility`
            (`component_id`, `compatible_component_id`, `compatibility_status`, `notes`)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            `compatibility_status` = VALUES(`compatibility_status`),
            `notes`                = VALUES(`notes`)'
    );
    $statement->execute([$low, $high, $status, $notes !== '' ? $notes : null]);

    $read = db()->prepare(base_sql() . ' WHERE k.`component_id` = ? AND k.`compatible_component_id` = ?');
    $read->execute([$low, $high]);

    send_ok(
        ['record' => format_record($read->fetch())],
        ['message' => 'Constatation enregistrée pour cette paire.']
    );
}

/** Suppression d'une constatation. */
function delete_observation(): void
{
    require_method('DELETE');

    $id = query_int('id');
    if ($id === null) {
        send_error('Il manque l\'id de la constatation à supprimer.', 422, 'Utilise compatibility.php?id=123');
    }

    $statement = db()->prepare('DELETE FROM `compatibility` WHERE `id` = ?');
    $statement->execute([$id]);

    if ($statement->rowCount() === 0) {
        send_error('Cette constatation n\'existe pas dans la base.', 404, '');
    }

    send_ok(['deleted' => $id], ['message' => 'Constatation supprimée.']);
}

/**
 * Lit une liste d'ids séparés par des virgules, par exemple ids=1,9,14.
 * Chaque morceau doit être un nombre entier, sinon il est jeté : seule une
 * liste de nombres atteindra la requête.
 *
 * @return int[]
 */
function query_id_list(string $key): array
{
    $raw = query_str($key);
    if ($raw === '') {
        return [];
    }

    $ids = [];
    foreach (explode(',', $raw) as $piece) {
        $piece = trim($piece);
        if (ctype_digit($piece)) {
            $ids[] = (int) $piece;
        }
    }

    return array_values(array_unique($ids));
}

/** Une constatation prête pour le JavaScript, dans les deux sens de lecture. */
function format_record(array $row): array
{
    return [
        'id'         => (int) $row['id'],
        'component'  => ['id' => (int) $row['component_id'], 'name' => $row['a_name'], 'slug' => $row['a_slug'], 'category' => $row['a_category']],
        'with'       => ['id' => (int) $row['compatible_component_id'], 'name' => $row['b_name'], 'slug' => $row['b_slug'], 'category' => $row['b_category']],
        'status'     => $row['compatibility_status'],
        'notes'      => $row['notes'],
        'createdAt'  => $row['created_at'],
        // Les deux ids ensemble, pour que le site retrouve la paire facilement.
        'pair'       => [(int) $row['component_id'], (int) $row['compatible_component_id']],
    ];
}
