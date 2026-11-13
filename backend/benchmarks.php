<?php
/**
 * benchmarks.php — Les mesures de performance dans les jeux.
 *
 * Le projet a une règle absolue : un chiffre de FPS doit venir d'une mesure
 * réelle, avec un jeu, une résolution, des réglages et une source précisés.
 * C'est pour cela que la table `benchmarks` est vide après l'installation :
 * personne n'a encore saisi de mesure vérifiée.
 *
 * Utilisations :
 *   backend/benchmarks.php                                  → toutes les mesures
 *   backend/benchmarks.php?component_id=18                  → mesures d'un composant
 *   backend/benchmarks.php?game=Cyberpunk%202077&resolution=1080p
 *   backend/benchmarks.php?category=gpu&game=Valorant       → cartes graphiques seulement
 *   backend/benchmarks.php?action=games                     → liste des jeux déjà mesurés
 *   backend/benchmarks.php?action=stats&game=...&resolution=...&graphics_settings=...
 *   POST backend/benchmarks.php                             → enregistrer une mesure
 *   PUT  backend/benchmarks.php                             → corriger une mesure
 *   DELETE backend/benchmarks.php?id=4                      → retirer une mesure
 */

require_once __DIR__ . '/helpers.php';

/** Les deux familles qui vont toujours ensemble dans une mesure de FPS. */
const PAIR_LABELS = ['cpu' => 'un processeur', 'gpu' => 'une carte graphique'];

handle(function (): void {
    require_admin_write();

    switch ($_SERVER['REQUEST_METHOD'] ?? 'GET') {
        case 'GET':
            read_benchmarks();
            break;
        case 'POST':
            create_benchmark();
            break;
        case 'PUT':
            update_benchmark();
            break;
        case 'DELETE':
            delete_benchmark();
            break;
        default:
            send_error('Méthode non acceptée ici.', 405, 'Utilise GET, POST, PUT ou DELETE.');
    }
});

/** Trois lectures différentes, toutes basées sur les mêmes filtres. */
function read_benchmarks(): void
{
    $action = query_str('action');

    if ($action === 'games') {
        list_games();
    }
    if ($action === 'stats') {
        stats();
    }

    $filters = conditions();

    // La liste est plafonnée à 500 mesures : une page web ne doit pas charger
    // un historique infini. Les compteurs restent exacts dans `meta`.
    $rows = db()->prepare(select_sql($filters) . ' ORDER BY b.`created_at` DESC, b.`id` DESC LIMIT 500');
    $rows->execute($filters['params']);

    $benchmarks = array_map('format_benchmark', $rows->fetchAll());

    send_ok(
        ['benchmarks' => $benchmarks],
        [
            'count' => count($benchmarks),
            // Le site affiche ce message quand la liste est vide : rien n'est inventé.
            'emptyMessage' => $benchmarks === []
                ? 'Aucune mesure enregistrée dans la base de données pour cette sélection.'
                : '',
        ]
    );
}

/**
 * Construit la requête à partir des filtres de l'URL.
 * Chaque valeur filtre passe par un placeholder ; aucune n'est collée dans le SQL.
 *
 * @return array{sql: string, where: string, params: array}
 */
function conditions(): array
{
    $where  = [];
    $params = [];

    $componentId = query_int('component_id');
    if ($componentId !== null) {
        $where[]               = 'b.`component_id` = :componentId';
        $params[':componentId'] = $componentId;
    }

    $game = query_str('game');
    if ($game !== '') {
        $where[]        = 'b.`game` = :game';
        $params[':game'] = $game;
    }

    $resolution = query_str('resolution');
    if ($resolution !== '') {
        $where[]             = 'b.`resolution` = :resolution';
        $params[':resolution'] = $resolution;
    }

    $settings = query_str('graphics_settings');
    if ($settings !== '') {
        $where[]              = 'b.`graphics_settings` = :settings';
        $params[':settings']  = $settings;
    }

    $category = query_str('category');
    if ($category !== '') {
        if (!in_array($category, CATEGORIES, true)) {
            send_error("Famille de composants inconnue : $category", 422, 'Familles autorisées : ' . implode(', ', CATEGORIES));
        }
        $where[]             = 'c.`category` = :category';
        $params[':category'] = $category;
    }

    $brand = query_str('brand');
    if ($brand !== '') {
        $where[]           = 'c.`brand` = :brand';
        $params[':brand']  = $brand;
    }

    return [
        'where'  => $where === [] ? '' : 'WHERE ' . implode(' AND ', $where),
        'params' => $params,
    ];
}

/**
 * Le SELECT commun aux listes et aux statistiques.
 *
 * `pc` est la pièce associée au test (le processeur quand on mesure une carte
 * graphique, et inversement). C'est une jointure LEFT : une mesure saisie sans
 * association, ou dont la pièce associée a été retirée du catalogue, existe
 * toujours et s'affiche quand même.
 * Une mesure reste une mesure : la jointure ne change jamais le nombre de
 * lignes, car un id de composant ne désigne qu'une seule pièce.
 */
function select_sql(array $conditions, string $columns = 'b.*, c.`name`, c.`slug`, c.`category`, c.`brand`, pc.`name` AS `paired_name`, pc.`category` AS `paired_category`'): string
{
    return 'SELECT ' . $columns . '
            FROM `benchmarks` b
            JOIN `components` c ON c.`id` = b.`component_id`
            LEFT JOIN `components` pc ON pc.`id` = b.`paired_component_id`
            ' . $conditions['where'];
}

/**
 * Les jeux déjà mesurés, pour remplir les menus déroulants du site.
 * On ne renvoie que ce qui existe : la liste suit donc la réalité de la base.
 */
function list_games(): void
{
    $rows = db()->query(
        'SELECT `game`, COUNT(*) AS `measures`
         FROM `benchmarks`
         GROUP BY `game`
         ORDER BY `game`'
    )->fetchAll();

    send_ok([
        'games' => array_map(static fn(array $row): array => [
            'name'     => $row['game'],
            'measures' => (int) $row['measures'],
        ], $rows),
    ], ['count' => count($rows)]);
}

/**
 * Statistiques par composant pour un jeu + résolution + réglages donné.
 * C'est ce qui alimente la page FPS Range : moyenne, minimum, maximum,
 * et le nombre de mesures qui se cache derrière — un FPS moyen sans ce
 * nombre ne voudrait rien dire.
 */
function stats(): void
{
    $conditions = conditions();

    // Sans jeu précisé, la moyenne mélangerait des jeux incomparables.
    if (query_str('game') === '') {
        send_ok(
            ['stats' => []],
            ['count' => 0, 'emptyMessage' => 'Choisis un jeu : une moyenne de FPS ne se calcule que jeu par jeu.']
        );
    }

    $statement = db()->prepare(
        select_sql(
            $conditions,
            'c.`id`, c.`name`, c.`slug`, c.`category`, c.`brand`,
             COUNT(*)                   AS `measures`,
             COUNT(DISTINCT b.`paired_component_id`) AS `paired_parts`,
             ROUND(AVG(b.`fps`))        AS `avg_fps`,
             MIN(b.`fps`)               AS `min_fps`,
             MAX(b.`fps`)               AS `max_fps`,
             MAX(b.`created_at`)        AS `last_measure`'
        ) . ' GROUP BY c.`id`, c.`name`, c.`slug`, c.`category`, c.`brand`
           ORDER BY `avg_fps` DESC, c.`name`'
    );
    $statement->execute($conditions['params']);
    $rows = $statement->fetchAll();

    $stats = array_map(static function (array $row): array {
        return [
            'componentId' => (int) $row['id'],
            'component'   => $row['name'],
            'slug'        => $row['slug'],
            'category'    => $row['category'],
            'brand'       => $row['brand'],
            'measures'    => (int) $row['measures'],
            // Combien de pièces associées différentes se cachent derrière la
            // moyenne. Une carte graphique mesurée avec trois processeurs a une
            // seule moyenne, mais le site doit le dire : la moyenne ne veut pas
            // dire « testé avec le même processeur trois fois ».
            'pairedParts' => (int) $row['paired_parts'],
            'avgFps'      => (float) $row['avg_fps'],
            'minFps'      => (int) $row['min_fps'],
            'maxFps'      => (int) $row['max_fps'],
            'lastMeasure' => $row['last_measure'],
        ];
    }, $rows);

    send_ok(
        ['stats' => $stats],
        [
            'count'        => count($stats),
            'game'         => query_str('game'),
            'resolution'   => query_str('resolution'),
            'settings'     => query_str('graphics_settings'),
            'emptyMessage' => $stats === []
                ? 'Aucune mesure dans la base pour ce jeu et ces conditions. BuildWise préfère afficher « non disponible » plutôt qu\'un chiffre inventé.'
                : '',
        ]
    );
}

/**
 * Enregistrement d'une mesure réelle.
 * Une mesure = une ligne. On n'invente ni le chiffre ni la source.
 */
function create_benchmark(): void
{
    $fields = benchmark_fields(request_body());

    $insert = db()->prepare(
        'INSERT INTO `benchmarks`
            (`component_id`, `paired_component_id`, `game`, `resolution`, `graphics_settings`, `fps`, `source`, `source_url`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([
        $fields['component_id'],
        $fields['paired_component_id'],
        $fields['game'],
        $fields['resolution'],
        $fields['graphics_settings'],
        $fields['fps'],
        $fields['source'],
        $fields['source_url'],
    ]);

    send_ok(
        ['benchmark' => read_benchmark((int) db()->lastInsertId())],
        ['message' => "Mesure enregistrée : {$fields['fps']} FPS (moyenne) sur {$fields['game']} en {$fields['resolution']}, qualité « {$fields['graphics_settings']} »."]
    );
}

/**
 * Correction d'une mesure mal saisie (mauvais jeu, FPS recopié de travers,
 * pièce associée oubliée). La date `created_at` ne change pas : elle reste le
 * moment où la mesure a été enregistrée dans la base.
 */
function update_benchmark(): void
{
    $body = request_body();
    $pdo  = db();

    $id = body_positive_int($body, 'id', 'Identifiant de la mesure à modifier');

    $find = $pdo->prepare('SELECT `id` FROM `benchmarks` WHERE `id` = ?');
    $find->execute([$id]);

    if ($find->fetch() === false) {
        send_error("Cette mesure (id $id) n'existe pas dans la base.", 404, 'Recharge la page admin.html : la liste des mesures a peut-être changé.');
    }

    $fields = benchmark_fields($body);

    $update = $pdo->prepare(
        'UPDATE `benchmarks`
         SET `component_id` = ?, `paired_component_id` = ?, `game` = ?, `resolution` = ?,
             `graphics_settings` = ?, `fps` = ?, `source` = ?, `source_url` = ?
         WHERE `id` = ?'
    );
    $update->execute([
        $fields['component_id'],
        $fields['paired_component_id'],
        $fields['game'],
        $fields['resolution'],
        $fields['graphics_settings'],
        $fields['fps'],
        $fields['source'],
        $fields['source_url'],
        $id,
    ]);

    send_ok(
        ['benchmark' => read_benchmark($id)],
        ['message' => "Mesure modifiée : {$fields['fps']} FPS sur {$fields['game']} en {$fields['resolution']}, qualité « {$fields['graphics_settings']} »."]
    );
}

/**
 * Valide entièrement une mesure, que la requête soit POST ou PUT.
 * Les deux écritures partagent cette fonction : un champ ne peut pas passer
 * par une porte sans contrôle.
 *
 * @return array{component_id:int, paired_component_id:?int, game:string,
 *               resolution:string, graphics_settings:string, fps:int,
 *               source:?string, source_url:?string}
 */
function benchmark_fields(array $body): array
{
    $componentId = body_positive_int($body, 'component_id', 'Composant');
    $component   = find_component($componentId);

    $game = clean_text(body_required($body, 'game', 'Jeu'), 120, 'Jeu');
    $fps  = body_positive_int($body, 'fps', 'FPS', 100000, null, 'Une mesure réelle est toujours d\'au moins 1 image par seconde ; un test à 0 FPS n\'est pas une mesure.');

    $source    = isset($body['source']) ? clean_text((string) $body['source'], 180, 'Source') : '';
    $sourceUrl = isset($body['source_url']) ? clean_text((string) $body['source_url'], 300, 'URL de la source') : '';

    if ($source === '' && $sourceUrl === '') {
        send_error(
            'Une mesure de FPS a besoin d\'une source.',
            422,
            'Indique le test personnel, le site ou la vidéo d\'où vient ce chiffre. Sans source, la donnée n\'est pas vérifiable.'
        );
    }

    if ($sourceUrl !== '' && !filter_var($sourceUrl, FILTER_VALIDATE_URL)) {
        send_error('L\'URL de la source n\'est pas valide.', 422, 'Exemple correct : https://exemple.com/test');
    }

    return [
        'component_id'        => $componentId,
        'paired_component_id' => paired_id($body, $component),
        'game'                => $game,
        'resolution'          => body_choice($body, 'resolution', RESOLUTIONS, 'Résolution', RESOLUTIONS[0]),
        'graphics_settings'   => body_choice($body, 'graphics_settings', ['low', 'medium', 'high', 'ultra', 'custom'], 'Qualité graphique', 'high'),
        'fps'                 => $fps,
        'source'              => $source !== '' ? $source : null,
        'source_url'          => $sourceUrl !== '' ? $sourceUrl : null,
    ];
}

/**
 * L'autre pièce du test : une carte graphique quand on mesure un processeur,
 * un processeur quand on mesure une carte graphique.
 *
 * Pourquoi c'est obligatoire pour ces deux familles : les FPS en jeu sortent
 * du travail des deux pièces à la fois. Une mesure « RTX 4060 : 92 FPS » sans
 * le processeur qui l'accompagne ne prouve rien et ne se compare à rien.
 * Les autres familles (RAM, stockage…) gardent la colonne vide.
 */
function paired_id(array $body, array $component): ?int
{
    $measuredCategory = $component['category'];
    $mustPair         = isset(PAIR_LABELS[$measuredCategory]);
    $raw              = $body['paired_component_id'] ?? null;

    if ($raw === null || $raw === '') {
        if ($mustPair) {
            send_error(
                'Il manque « Autre pièce du test ».',
                422,
                $measuredCategory === 'cpu'
                    ? 'Un processeur se mesure toujours avec une carte graphique : choisis-la dans le menu « Autre pièce du test ».'
                    : 'Une carte graphique se mesure toujours avec un processeur : choisis-le dans le menu « Autre pièce du test ».'
            );
        }
        return null;
    }

    $pairedId = body_positive_int($body, 'paired_component_id', 'Autre pièce du test');
    $paired   = find_component($pairedId);

    if ($pairedId === (int) $component['id']) {
        send_error('La pièce mesurée et la pièce associée doivent être deux composants différents.', 422, 'Le composant « ' . $component['name'] . ' » est déjà choisi comme pièce mesurée.');
    }

    if ($mustPair && $paired['category'] !== ($measuredCategory === 'cpu' ? 'gpu' : 'cpu')) {
        send_error(
            '« Autre pièce du test » est de la mauvaise famille.',
            422,
            'On mesure ' . PAIR_LABELS[$measuredCategory] . ' : la pièce associée doit être '
                . PAIR_LABELS[$measuredCategory === 'cpu' ? 'gpu' : 'cpu']
                . ', alors que « ' . $paired['name'] . ' » est ' . (PAIR_LABELS[$paired['category']] ?? 'un autre composant') . '.'
        );
    }

    return $pairedId;
}

/** Un composant du catalogue, avec un message clair s'il n'existe pas. */
function find_component(int $componentId): array
{
    $statement = db()->prepare('SELECT `id`, `name`, `slug`, `category` FROM `components` WHERE `id` = ?');
    $statement->execute([$componentId]);
    $component = $statement->fetch();

    if ($component === false) {
        send_error("Le composant id $componentId n'existe pas dans la table components.", 404, 'Choisis un composant existant dans admin.html.');
    }

    return $component;
}

/** Relit une mesure avec ses deux composants, pour la réponse au navigateur. */
function read_benchmark(int $id): array
{
    $statement = db()->prepare(
        select_sql(['where' => '', 'params' => []]) . ' WHERE b.`id` = ?'
    );
    $statement->execute([$id]);
    $row = $statement->fetch();

    if ($row === false) {
        send_error("Cette mesure (id $id) est introuvable.", 404, 'Recharge la page admin.html.');
    }

    return format_benchmark($row);
}

/** Suppression d'une mesure mal saisie. */
function delete_benchmark(): void
{
    require_method('DELETE');

    $id = query_int('id');
    if ($id === null) {
        send_error('Il manque l\'id de la mesure à supprimer.', 422, 'Utilise benchmarks.php?id=123');
    }

    $statement = db()->prepare('DELETE FROM `benchmarks` WHERE `id` = ?');
    $statement->execute([$id]);

    if ($statement->rowCount() === 0) {
        send_error('Cette mesure n\'existe pas dans la base.', 404, '');
    }

    send_ok(['deleted' => $id], ['message' => 'Mesure supprimée.']);
}

/** Une ligne de benchmark prête pour le JavaScript. */
function format_benchmark(array $row): array
{
    return [
        'id'               => (int) $row['id'],
        'componentId'      => (int) $row['component_id'],
        'component'        => $row['name'],
        'slug'             => $row['slug'],
        'category'         => $row['category'],
        'brand'            => $row['brand'],
        // L'autre pièce du test, ou null si la mesure n'en a pas.
        'pairedId'         => $row['paired_component_id'] === null ? null : (int) $row['paired_component_id'],
        'paired'           => $row['paired_name'] ?? null,
        'pairedCategory'   => $row['paired_category'] ?? null,
        'game'             => $row['game'],
        'resolution'       => $row['resolution'],
        'graphicsSettings' => $row['graphics_settings'],
        'fps'              => (int) $row['fps'],
        'source'           => $row['source'],
        'sourceUrl'        => $row['source_url'],
        'createdAt'        => $row['created_at'],
    ];
}
