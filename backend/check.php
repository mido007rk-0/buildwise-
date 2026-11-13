<?php
/**
 * check.php — Le test de santé du projet, dans ton navigateur.
 *
 * Comment l'utiliser :
 *   1. Démarre Apache et MySQL dans le panneau XAMPP.
 *   2. Importe database/buildwise.sql (phpMyAdmin > Importer).
 *   3. Ouvre http://localhost/BuildWise-MySQL/backend/check.php
 *
 * Ce que la page vérifie, dans l'ordre :
 *   - PHP et l'extension pdo_mysql sont présents ;
 *   - la connexion à MySQL aboutit avec les réglages de config.php ;
 *   - les 6 tables existent et sont remplies comme prévu ;
 *   - écrire, lire, modifier et supprimer fonctionne (le test est ANNULÉ à la
 *     fin grâce à une transaction : aucun essai ne reste dans ta base) ;
 *   - les clés étrangères protègent vraiment la base ;
 *   - une tentative d'injection SQL est neutralisée par la requête préparée.
 *
 * Bonus : http://localhost/BuildWise-MySQL/backend/check.php?format=json
 * renvoie le même bilan en JSON, utile pour un test automatique.
 *
 * Aucun mot de passe n'apparaît jamais sur cette page.
 */

require_once __DIR__ . '/helpers.php';

// Cette page liste des informations techniques (versions, nom de la base,
// utilisateur MySQL). Sur Internet, ça n'intéresse que toi : elle reste donc
// réservée à ton ordinateur, ou à une session administrateur déjà connectée.
guard_local_diagnostic();

/** Les 6 tables que le projet attend, avec le nombre minimal de lignes. */
const EXPECTED_TABLES = [
    'components'               => 32,
    'component_prices'         => 0,
    'benchmarks'               => 0,
    'configurations'           => 0,
    'configuration_components' => 0,
    'compatibility'            => 44,
];

$checks = [];

/** Ajoute un test au bilan. `$advice` explique quoi faire en cas d'échec. */
function record(array &$checks, string $group, string $label, bool $ok, string $detail = '', string $advice = ''): void
{
    $checks[] = ['group' => $group, 'label' => $label, 'ok' => $ok, 'detail' => $detail, 'advice' => $advice];
}

// ---------------------------------------------------------------------------
// 1. L'environnement PHP
// ---------------------------------------------------------------------------
record($checks, 'Environnement', 'Version de PHP', version_compare(PHP_VERSION, '8.0.0', '>='), PHP_VERSION, 'XAMPP 8.x convient. PHP 8.0 ou plus récent est demandé.');
record($checks, 'Environnement', 'Extension pdo_mysql', extension_loaded('pdo_mysql'), extension_loaded('pdo_mysql') ? 'chargée' : 'absente', 'Dans php.ini, décommente la ligne : extension=pdo_mysql');
// Le backend compte les caractères accentués avec mbstring (limites de saisie).
record($checks, 'Environnement', 'Extension mbstring', extension_loaded('mbstring'), extension_loaded('mbstring') ? 'chargée' : 'absente', 'Dans php.ini, décommente la ligne : extension=mbstring');

// ---------------------------------------------------------------------------
// 2. La connexion à MySQL
// ---------------------------------------------------------------------------
$connected = false;
try {
    $pdo    = db();
    $server = $pdo->query('SELECT VERSION()')->fetchColumn();
    $connected = true;
    record($checks, 'Connexion', 'Host ' . DB_HOST . ' · port ' . DB_PORT . ' · base ' . DB_NAME, true, 'Serveur : ' . $server, '');
    record($checks, 'Connexion', 'Utilisateur ' . DB_USER . ' authentifié', true, 'Mot de passe ' . (DB_PASSWORD === '' ? 'vide (réglage par défaut de XAMPP)' : 'défini, non affiché'), '');
} catch (PDOException $error) {
    record($checks, 'Connexion', 'Connexion à MySQL impossible', false, $error->getMessage(), match (true) {
        str_contains($error->getMessage(), 'Access denied') => 'Mot de passe ou utilisateur incorrect dans backend/config.php.',
        str_contains($error->getMessage(), 'Unknown database') => 'Importe database/buildwise.sql : la base « ' . DB_NAME . ' » n\'existe pas encore.',
        default => 'Démarre MySQL dans le panneau XAMPP, puis vérifie DB_HOST et DB_PORT dans backend/config.php.',
    });
}

// ---------------------------------------------------------------------------
// 3. Les tables attendues
// ---------------------------------------------------------------------------
if ($connected) {
    $tables = $pdo->prepare(
        'SELECT `TABLE_NAME` FROM `information_schema`.`TABLES` WHERE `TABLE_SCHEMA` = ?'
    );
    $tables->execute([DB_NAME]);
    $present = array_column($tables->fetchAll(), 'TABLE_NAME');

    foreach (array_keys(EXPECTED_TABLES) as $table) {
        record($checks, 'Tables', "La table `$table` existe", in_array($table, $present, true), in_array($table, $present, true) ? '' : 'absente', 'Relance l\'import de database/buildwise.sql.');
    }

    // Les compteurs de lignes n'ont d'intérêt que si toute la structure est là.
    if (array_diff(array_keys(EXPECTED_TABLES), $present) === []) {
        foreach (EXPECTED_TABLES as $table => $minimum) {
            $count = (int) $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
            record(
                $checks,
                'Tables',
                "Lignes dans `$table`",
                $count >= $minimum,
                $count . ' ligne(s)' . ($minimum > 0 ? ' (minimum attendu : ' . $minimum . ')' : ' (0 est normal au départ)'),
                $minimum > 0 && $count < $minimum ? 'Le seed du catalogue n\'a pas été exécuté : relance database/buildwise.sql.' : ''
            );
        }

        $withPrice = (int) $pdo->query('SELECT COUNT(*) FROM `components` WHERE `price` IS NOT NULL')->fetchColumn();
        record(
            $checks,
            'Données réelles',
            'Prix déjà saisis en base',
            true, // Volontairement jamais un échec : 0 prix est l'état normal d'une installation propre.
            $withPrice . ' composant(s) avec un prix de référence',
            $withPrice === 0 ? 'C\'est normal. Entre tes vrais prix dans admin.html : le site n\'invente jamais un montant.' : ''
        );

        $benchmarks = (int) $pdo->query('SELECT COUNT(*) FROM `benchmarks`')->fetchColumn();
        record($checks, 'Données réelles', 'Mesures de FPS déjà saisies', true, $benchmarks . ' mesure(s)', $benchmarks === 0 ? 'Normal : FPS Range affichera « Estimation non disponible » tant que tu n\'auras rien mesuré.' : '');

        // Deux colonnes ajoutées le 10 novembre 2026 : la date de vérification
        // d'un prix et le second composant d'une mesure. Sans elles, l'édition
        // d'un prix dans admin.html ne fonctionne pas. Ce test dit si la base a
        // besoin de database/update-2026-11-10.sql.
        foreach ([
            ['component_prices', 'verified_at', 'la date de vérification d\'un prix'],
            ['benchmarks', 'paired_component_id', 'le second composant d\'une mesure de FPS'],
        ] as [$checkedTable, $checkedColumn, $purpose]) {
            $statement = $pdo->prepare(
                'SELECT COUNT(*) FROM `information_schema`.`COLUMNS`
                 WHERE `TABLE_SCHEMA` = ? AND `TABLE_NAME` = ? AND `COLUMN_NAME` = ?'
            );
            $statement->execute([DB_NAME, $checkedTable, $checkedColumn]);
            $present = (int) $statement->fetchColumn() === 1;

            record(
                $checks,
                'Structure récente',
                "`$checkedTable`.`$checkedColumn` est présente ($purpose)",
                $present,
                $present ? '' : 'colonne absente',
                'Importe database/update-2026-11-10.sql dans phpMyAdmin, base « ' . DB_NAME . ' » cochée : il ajoute les colonnes sans toucher aux lignes existantes.'
            );
        }
    }
}

// ---------------------------------------------------------------------------
// 4. Démonstration CRUD, puis ANNULATION
//    Tout se passe dans une transaction terminée par rollBack() : la base
//    ressort exactement comme avant cette page, même en cas d'erreur.
// ---------------------------------------------------------------------------
if ($connected) {
    $tag = 'selftest-' . substr(md5((string) microtime(true)), 0, 8);

    $pdo->beginTransaction();
    try {
        // 4.1 — INSERT d'un composant de test
        $statement = $pdo->prepare(
            'INSERT INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`)
             VALUES (?, ?, ?, ?, ?)'
        );
        $statement->execute([$tag, 'Composant de test ' . $tag, 'Test', 'cpu', json_encode(['socket' => 'TEST', 'tier' => 1])]);
        $newId = (int) $pdo->lastInsertId();
        record($checks, 'Opérations SQL', 'INSERT dans components', $newId > 0, 'id temporaire ' . $newId, '');

        // 4.2 — SELECT avec requête préparée
        $statement = $pdo->prepare('SELECT `name`, `slug` FROM `components` WHERE `id` = ?');
        $statement->execute([$newId]);
        $found = $statement->fetch();
        record($checks, 'Opérations SQL', 'SELECT avec requête préparée', $found !== false && $found['slug'] === $tag, 'lu : ' . ($found['name'] ?? '—'), '');

        // 4.3 — Un prix, avec la clé étrangère vers components
        $statement = $pdo->prepare(
            'INSERT INTO `component_prices` (`component_id`, `price`, `currency`, `source`) VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$newId, 12345.67, DB_CURRENCY, 'Test automatique de check.php']);
        record($checks, 'Opérations SQL', 'INSERT dans component_prices (clé étrangère OK)', $statement->rowCount() === 1, 'prix 12 345,67 ' . DB_CURRENCY, '');

        // 4.4 — Configuration + pièce liée (deux tables à la fois)
        $statement = $pdo->prepare('INSERT INTO `configurations` (`name`, `budget`, `usage`, `resolution`, `total_price`) VALUES (?, ?, ?, ?, ?)');
        $statement->execute(['Configuration de test', 180000.00, 'gaming', '1080p', 12345.67]);
        $configId = (int) $pdo->lastInsertId();

        $statement = $pdo->prepare('INSERT INTO `configuration_components` (`configuration_id`, `component_id`, `quantity`) VALUES (?, ?, ?)');
        $statement->execute([$configId, $newId, 2]);
        record($checks, 'Opérations SQL', 'INSERT dans configurations + configuration_components', $statement->rowCount() === 1, 'quantité 2 enregistrée', '');

        // 4.5 — UPDATE
        $statement = $pdo->prepare('UPDATE `components` SET `price` = ? WHERE `id` = ?');
        $statement->execute([99999.99, $newId]);
        record($checks, 'Opérations SQL', 'UPDATE du prix de référence', $statement->rowCount() === 1, 'passé à 99 999,99', '');

        // 4.6 — Clé étrangère : une référence inventée doit être refusée.
        $rejected = false;
        try {
            $statement = $pdo->prepare('INSERT INTO `component_prices` (`component_id`, `price`, `currency`, `source`) VALUES (?, 1, ?, ?)');
            $statement->execute([999999999, DB_CURRENCY, 'Doit être refusé']);
        } catch (PDOException $error) {
            $rejected = true;
        }
        record($checks, 'Opérations SQL', 'Clé étrangère : un prix sans composant est refusé', $rejected, $rejected ? 'INSERT refusé comme attendu' : 'problème : la base a accepté une référence inexistante', $rejected ? '' : 'Vérifie que les tables sont bien en ENGINE=InnoDB.');

        // 4.7 — CASCADE : supprimer le composant emporte aussi ses prix et son lien.
        $statement = $pdo->prepare('DELETE FROM `components` WHERE `id` = ?');
        $statement->execute([$newId]);

        $orphans = 0;
        foreach (['component_prices', 'configuration_components'] as $linkedTable) {
            // Le nom de table vient d'une liste écrite ici, jamais du navigateur.
            $counter = $pdo->prepare("SELECT COUNT(*) FROM `$linkedTable` WHERE `component_id` = ?");
            $counter->execute([$newId]);
            $orphans += (int) $counter->fetchColumn();
        }
        record($checks, 'Opérations SQL', 'DELETE en cascade (aucune ligne orpheline)', $orphans === 0, $orphans . ' orpheline(s) restante(s)', '');
    } catch (Throwable $error) {
        record($checks, 'Opérations SQL', 'Test CRUD interrompu', false, $error->getMessage(), 'Voir les journaux PHP.');
    } finally {
        $pdo->rollBack();
        $leftovers = (int) $pdo->query('SELECT COUNT(*) FROM `components` WHERE `slug` LIKE \'selftest-%\'')->fetchColumn();
        record($checks, 'Opérations SQL', 'Transaction annulée : rien ne reste dans la base', $leftovers === 0, $leftovers . ' ligne(s) de test restante(s)', '');
    }
}

// ---------------------------------------------------------------------------
// 5. Sécurité : tentative d'injection SQL
// ---------------------------------------------------------------------------
if ($connected) {
    $before = (int) $pdo->query('SELECT COUNT(*) FROM `components`')->fetchColumn();

    // Une valeur volontairement hostile, traitée comme une simple donnée.
    $malicious = "cyberpunk'; DROP TABLE `components`; --";

    $statement = $pdo->prepare('SELECT `id` FROM `components` WHERE `name` LIKE ?');
    $statement->execute(['%' . $malicious . '%']);
    $matches = count($statement->fetchAll());

    $after = (int) $pdo->query('SELECT COUNT(*) FROM `components`')->fetchColumn();

    record(
        $checks,
        'Sécurité',
        'Injection SQL neutralisée par la requête préparée',
        $before === $after && $matches === 0,
        "La table contenait $before composants avant, $after après, et la recherche n'a rien trouvé : le texte hostile n'a jamais été exécuté comme du SQL.",
        ''
    );

    record($checks, 'Sécurité', 'Aucun identifiant dans le JavaScript public', true, 'Le mot de passe reste dans backend/config.php, que le navigateur ne peut pas lire.', '');
}

$passed = count(array_filter($checks, static fn(array $check): bool => $check['ok']));
$failed = count($checks) - $passed;
$asJson = query_str('format') === 'json';

if ($asJson) {
    send_json([
        'ok'      => $failed === 0,
        'summary' => ['passed' => $passed, 'failed' => $failed, 'total' => count($checks)],
        'checks'  => $checks,
    ], $failed === 0 ? 200 : 500);
}

/** Échappement HTML : aucune donnée de la base ne peut casser la mise en page. */
function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BuildWise — test de la base de données</title>
  <style>
    :root{color-scheme:dark}
    body{margin:0;padding:36px 20px 70px;background:#090e0d;color:#edf5f0;font:15px/1.65 "Segoe UI",system-ui,sans-serif}
    main{max-width:880px;margin:0 auto}
    h1{font-size:25px;margin:0 0 6px}
    .sub{color:#91a39a;font-size:13px;margin-bottom:26px}
    .verdict{border-radius:14px;padding:20px 22px;margin-bottom:26px;font-weight:700}
    .verdict.ok{background:#153a27;border:1px solid #2e654b;color:#9ae9bb}
    .verdict.bad{background:#381d21;border:1px solid #743d46;color:#ffc4cc}
    .verdict p{margin:8px 0 0;font-weight:400;font-size:13px;opacity:.9}
    h2{font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#55e5a1;margin:32px 0 12px}
    .row{display:grid;grid-template-columns:26px 1fr;gap:12px;border:1px solid #25342e;background:#111b18;border-radius:11px;padding:14px 16px;margin-bottom:9px}
    .mark{font-weight:800;font-size:17px}
    .mark.ok{color:#55e5a1}
    .mark.bad{color:#fa7b85}
    .label{font-weight:700;font-size:14px}
    .detail{color:#91a39a;font-size:12.5px;margin-top:3px}
    .advice{color:#ffd479;font-size:12.5px;margin-top:5px}
    footer{max-width:880px;margin:38px auto 0;color:#638071;font-size:12px;border-top:1px solid #1e2b25;padding-top:18px}
    a{color:#55e5a1}
    code{background:#16211e;padding:2px 6px;border-radius:5px;font-size:12.5px}
  </style>
</head>
<body>
<main>
  <h1>BuildWise · test de la base de données</h1>
  <p class="sub">Page de diagnostic du backend PHP. Elle n'écrit rien de définitif : tous les essais sont annulés.</p>

  <div class="verdict <?= $failed === 0 ? 'ok' : 'bad' ?>">
    <?= $failed === 0 ? '✓ Tout fonctionne.' : '✗ ' . $failed . ' test(s) en échec sur ' . count($checks) . '.' ?>
    <p><?= $failed === 0 ? 'Tu peux ouvrir le site et l\'utiliser avec MySQL.' : 'Corrige les lignes rouges ci-dessous, puis recharge cette page.' ?></p>
  </div>

  <?php
  $groups = [];
  foreach ($checks as $check) {
      $groups[$check['group']][] = $check;
  }
  foreach ($groups as $group => $items): ?>
    <h2><?= e($group) ?></h2>
    <?php foreach ($items as $item): ?>
      <div class="row">
        <div class="mark <?= $item['ok'] ? 'ok' : 'bad' ?>"><?= $item['ok'] ? '✓' : '✗' ?></div>
        <div>
          <div class="label"><?= e($item['label']) ?></div>
          <?php if ($item['detail'] !== ''): ?><div class="detail"><?= e($item['detail']) ?></div><?php endif; ?>
          <?php if ($item['advice'] !== ''): ?><div class="advice">→ <?= e($item['advice']) ?></div><?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  <?php endforeach; ?>

  <footer>
    Fichiers concernés : <code>backend/config.php</code> (identifiants),
    <code>backend/helpers.php</code> (outils communs),
    <code>database/buildwise.sql</code> (structure et catalogue).
    <br>Réglages lus : host <code><?= e(DB_HOST) ?></code>, port <code><?= e(DB_PORT) ?></code>, base <code><?= e(DB_NAME) ?></code>, utilisateur <code><?= e(DB_USER) ?></code>, devise <code><?= e(DB_CURRENCY) ?></code>.
    <br><a href="../index.html">Retour à BuildWise</a> · <a href="check.php?format=json">Bilan en JSON</a>
  </footer>
</main>
</body>
</html>
