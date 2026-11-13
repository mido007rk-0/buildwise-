<?php
/**
 * prices.php -- Les prix des composants, en dinars algériens.
 *
 * Point important côté honnêteté : `component_prices` ne contient que ce
 * qu'une personne a réellement observé. Si la table est vide, le site affiche
 * « Non renseigne » et jamais un montant inventé.
 *
 * Utilisations :
 *   backend/prices.php                        → dernier prix vérifié de chaque composant
 *   backend/prices.php?component_id=12        → tout l'historique d'un composant
 *   backend/prices.php?component_id=12&latest=1
 *   POST   backend/prices.php                 → enregistrer un prix observé
 *   PUT    backend/prices.php                 → corriger un prix déjà enregistré
 *   DELETE backend/prices.php?id=3            → retirer une saisie erronée
 *
 * A quoi sert l'historique ?
 *   Un prix algérien bouge. Garder chaque observation permet de montrer la
 *   date et la source, et de comparer deux relevés du même composant.
 *
 * Corriger OU ajouter ?
 *   Les deux existent, parce qu'ils ne veulent pas dire la même chose :
 *     - POST ajoute une observation nouvelle (le prix vient de changer) ;
 *     - PUT rectifie une observation déjà saisie (une faute de frappe, un
 *       mauvais lien, une date de vérification oubliée).
 *   PUT ne change jamais le composant ni la date d'enregistrement : il garde la
 *   trace de ce qui a été tapé, et `updated_at` se met à jour tout seul.
 */

require_once __DIR__ . '/helpers.php';

handle(function (): void {
    require_admin_write();

    switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {
        case 'GET':
            read_prices();
            break;
        case 'POST':
            create_price();
            break;
        case 'PUT':
            update_price();
            break;
        case 'DELETE':
            delete_price();
            break;
        default:
            send_error('Méthode non acceptée ici.', 405, 'Utilise GET, POST, PUT ou DELETE.');
    }
});

/** Lecture : historique d'un composant, ou dernière valeur de tous les composants. */
function read_prices(): void
{
    $componentId = query_int('component_id');
    $latestOnly  = query_str('latest') === '1';

    if ($componentId !== null) {
        assert_component_exists($componentId);

        $sql = 'SELECT p.`id`, p.`component_id`, p.`price`, p.`currency`, p.`source`,
                       p.`source_url`, p.`verified_at`, p.`updated_at`, c.`name`, c.`slug`, c.`category`
                FROM `component_prices` p
                JOIN `components` c ON c.`id` = p.`component_id`
                WHERE p.`component_id` = ?
                ORDER BY p.`verified_at` DESC, p.`id` DESC'
             . ($latestOnly ? ' LIMIT 1' : '');

        $statement = db()->prepare($sql);
        $statement->execute([$componentId]);
        send_ok(['prices' => array_map('format_price', $statement->fetchAll())]);
    }

    // Vue d'ensemble utilisée par PC Builder et SmartPrice.
    // SQL_LATEST_PRICE_JOIN est LA définition partagée du prix actuel d'un
    // composant (voir helpers.php) : la liste, la fiche du composant et la
    // colonne `components.price` donnent ainsi exactement le même montant.
    $rows = db()->query(
        'SELECT lp.`id`, lp.`component_id`, lp.`price`, lp.`currency`, lp.`source`,
               lp.`source_url`, lp.`verified_at`, lp.`updated_at`, c.`name`, c.`slug`, c.`category`
        FROM `components` c
        ' . SQL_LATEST_PRICE_JOIN . '
        WHERE lp.`id` IS NOT NULL
        ORDER BY c.`category`, c.`name`'
    )->fetchAll();

    send_ok(
        ['prices' => array_map('format_price', $rows)],
        ['count' => count($rows), 'note' => 'Un seul prix affiché par composant : le dernier vérifié.']
    );
}

/**
 * Écriture : on ajoute une observation, puis on synchronise la colonne
 * `components.price` pour qu'elle reste le reflet du prix le plus récent.
 * Les deux requêtes forment une transaction : si la seconde échoue,
 * la première est annulée et la base ne reste pas à moitié à jour.
 */
function create_price(): void
{
    $body = request_body();
    $pdo  = db();

    $componentId = body_positive_int($body, 'component_id', 'Composant');
    assert_component_exists($componentId);

    $fields = price_fields($body);

    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare(
            'INSERT INTO `component_prices`
                (`component_id`, `price`, `currency`, `source`, `source_url`, `verified_at`)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            $componentId,
            $fields['price'],
            $fields['currency'],
            $fields['source'],
            $fields['source_url'],
            $fields['verified_at'],
        ]);
        $priceId = (int) $pdo->lastInsertId();

        sync_component_price($pdo, $componentId);

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    send_ok(
        ['price' => read_price($priceId)],
        ['message' => 'Prix enregistré pour ' . $fields['currency'] . ' ' . number_format((float) $fields['price'], 2, ',', ' ')
            . ' (vérifié le ' . $fields['verified_at'] . ').']
    );
}

/**
 * Modification d'un prix déjà enregistré : la même ligne est rectifiée,
 * aucun historique n'est ajouté.
 *
 * Ce qui ne change pas :
 *   - `component_id` : un prix appartient à la pièce qu'il tarifait. Pour
 *     décaler un montant sur une autre pièce, supprime la ligne et recrée-la.
 *   - `updated_at` : MySQL le remet à l'heure actuelle tout seul, c'est la
 *     trace de la dernière retouche.
 */
function update_price(): void
{
    $body = request_body();
    $pdo  = db();

    $priceId = body_positive_int($body, 'id', 'Identifiant du prix à modifier');

    $find = $pdo->prepare('SELECT `id`, `component_id` FROM `component_prices` WHERE `id` = ?');
    $find->execute([$priceId]);
    $existing = $find->fetch();

    if ($existing === false) {
        send_error("Ce prix (id $priceId) n'existe pas dans la base.", 404, 'Recharge la page admin.html : la liste des prix a peut-être changé.');
    }

    $componentId = (int) $existing['component_id'];
    $fields      = price_fields($body);

    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare(
            'UPDATE `component_prices`
             SET `price` = ?, `currency` = ?, `source` = ?, `source_url` = ?, `verified_at` = ?
             WHERE `id` = ?'
        );
        $update->execute([
            $fields['price'],
            $fields['currency'],
            $fields['source'],
            $fields['source_url'],
            $fields['verified_at'],
            $priceId,
        ]);

        sync_component_price($pdo, $componentId);

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    send_ok(
        ['price' => read_price($priceId)],
        ['message' => 'Prix modifié : ' . $fields['currency'] . ' ' . number_format((float) $fields['price'], 2, ',', ' ')
            . ' (vérifié le ' . $fields['verified_at'] . ').']
    );
}

/**
 * Champs communs à POST et PUT, vérifiés une seule fois pour les deux.
 * La source reste obligatoire : un prix sans provenance n'est pas vérifiable.
 *
 * @return array{price: float, currency: string, source: string, source_url: ?string, verified_at: string}
 */
function price_fields(array $body): array
{
    $price     = body_money($body, 'price', 'Prix');
    $currency  = strtoupper(body_choice($body, 'currency', ['DZD', 'EUR', 'USD', 'TND'], 'Devise', DB_CURRENCY));
    $source    = clean_text(body_required($body, 'source', 'Source du prix'), 180, 'Source du prix');
    $sourceUrl = isset($body['source_url']) ? clean_text((string) $body['source_url'], 300, 'URL de la source') : '';

    if ($sourceUrl !== '' && !filter_var($sourceUrl, FILTER_VALIDATE_URL)) {
        send_error('L\'URL de la source n\'est pas valide.', 422, 'Exemple correct : https://exemple.dz/produit');
    }

    $verifiedAt = body_date($body, 'verified_at', 'Date de vérification', true);

    return [
        'price'       => $price,
        'currency'    => $currency,
        'source'      => $source,
        'source_url'  => $sourceUrl === '' ? null : $sourceUrl,
        'verified_at' => $verifiedAt,
    ];
}

/** Relit une ligne de prix avec le nom de son composant, pour la réponse JSON. */
function read_price(int $priceId): array
{
    $statement = db()->prepare(
        'SELECT p.`id`, p.`component_id`, p.`price`, p.`currency`, p.`source`,
                p.`source_url`, p.`verified_at`, p.`updated_at`, c.`name`, c.`slug`, c.`category`
         FROM `component_prices` p
         JOIN `components` c ON c.`id` = p.`component_id`
         WHERE p.`id` = ?'
    );
    $statement->execute([$priceId]);

    return format_price($statement->fetch());
}

/** Suppression d'une saisie erronée, avec resynchronisation du prix de référence. */
function delete_price(): void
{
    require_method('DELETE');

    $priceId = query_int('id');
    if ($priceId === null) {
        send_error('Il manque l\'id du prix à supprimer.', 422, 'Utilise prices.php?id=123');
    }

    $pdo  = db();
    $find = $pdo->prepare('SELECT `component_id` FROM `component_prices` WHERE `id` = ?');
    $find->execute([$priceId]);
    $row = $find->fetch();

    if ($row === false) {
        send_error('Ce prix n\'existe pas dans la base.', 404, '');
    }

    $componentId = (int) $row['component_id'];

    $pdo->beginTransaction();
    try {
        $delete = $pdo->prepare('DELETE FROM `component_prices` WHERE `id` = ?');
        $delete->execute([$priceId]);
        sync_component_price($pdo, $componentId);
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    send_ok(['deleted' => $priceId], ['message' => 'Saisie supprimée, prix de référence mis à jour.']);
}

/**
 * `components.price` = le prix le plus récent du composant (celui dont la date
 * de vérification est la plus proche), ou NULL si plus aucune ligne ne lui
 * correspond. Centralisé ici pour que les trois écritures restent cohérentes
 * avec la jointure SQL_LATEST_PRICE_JOIN utilisée par le reste du site.
 */
function sync_component_price(PDO $pdo, int $componentId): void
{
    $statement = $pdo->prepare(
        'UPDATE `components`
         SET `price` = (
             SELECT p.`price` FROM `component_prices` p
             WHERE p.`component_id` = components.`id`
             ORDER BY p.`verified_at` DESC, p.`id` DESC
             LIMIT 1
         )
         WHERE `id` = ?'
    );
    $statement->execute([$componentId]);
}

/** Verifie la clé étrangère avant d'insérer, pour un message clair plutôt qu'un erreur SQL. */
function assert_component_exists(int $componentId): void
{
    $statement = db()->prepare('SELECT `id`, `name`, `slug` FROM `components` WHERE `id` = ?');
    $statement->execute([$componentId]);
    $component = $statement->fetch();

    if ($component === false) {
        send_error("Le composant id $componentId n'existe pas dans la table components.", 404, 'Ouvre admin.html pour choisir un composant existant.');
    }
}

/** Une ligne de prix prête pour le JavaScript. */
function format_price(array $row): array
{
    return [
        'id'          => (int) $row['id'],
        'componentId' => (int) $row['component_id'],
        'component'   => $row['name'],
        'slug'        => $row['slug'],
        'category'    => $row['category'],
        'price'       => (float) $row['price'],
        'currency'    => $row['currency'],
        'source'      => $row['source'],
        'sourceUrl'   => $row['source_url'],
        // Le jour où le prix a été constaté : c'est la date que le site affiche.
        'verifiedAt'  => $row['verified_at'],
        // Le moment où la ligne a été tapée (ou rectifiée) dans la base.
        'updatedAt'   => $row['updated_at'],
    ];
}
