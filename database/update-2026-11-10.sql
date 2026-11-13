-- ===========================================================================
-- update-2026-11-10.sql — Mise à jour de la base `buildwise` du 10 novembre 2026
-- ===========================================================================
--
-- POURQUOI CE FICHIER
--   Deux fonctions demandées ne pouvaient pas exister avec le schéma de départ :
--
--   1. Un prix doit porter sa DATE DE VÉRIFICATION, et doit rester modifiable.
--      Avant : une seule date, `updated_at`, fixée par MySQL au moment de la
--      frappe, impossible à corriger. On ne pouvait donc pas dire « j'ai vu ce
--      prix le 3 novembre » ni rectifier une faute de frappe sans créer un
--      deuxième prix.
--
--   2. Une mesure de FPS doit préciser le PROCESSEUR ET la CARTE GRAPHIQUE du
--      test. Avant : une seule colonne `component_id`, donc on ne pouvait
--      attacher la mesure qu'à l'une des deux pièces — le contexte manquait.
--
-- CE QUE CE SCRIPT NE FAIT PAS
--   - Il ne supprime AUCUNE table, AUCUNE ligne, AUCUNE colonne.
--   - Il ne modifie pas le catalogue de 32 composants ni les 44 notes de
--     compatibilité.
--   - Il n'écrase aucun prix : les deux nouvelles colonnes sont ajoutées à côté
--     des anciennes, et les lignes déjà présentes reçoivent une valeur par
--     défaut (la date du jour pour `verified_at`, NULL pour le composant
--     associé).
--
-- À QUI IL S'ADRESSE
--   Uniquement aux bases importées AVANT le 10 novembre 2026. Une base importée
--   avec le `database/buildwise.sql` livré dans ce dossier contient déjà ces
--   colonnes : le script n'a pas besoin d'être lancé, et le refaire afficherait
--   simplement « Duplicate column name », sans conséquence.
--
-- COMMENT LE LANCER
--   1. Démarrer Apache et MySQL dans XAMPP, ouvrir phpMyAdmin.
--   2. Cliquer sur la base `buildwise` dans la colonne de gauche.
--   3. Onglet « Importer » → choisir ce fichier → « Exécuter ».
--      (Ou onglet « SQL » → coller le contenu → « Exécuter ».)
--   4. Contrôler : http://localhost/BuildWise-MySQL/backend/check.php doit
--      afficher le groupement « Structure récente » tout en vert.
--
--   En ligne de commande, la même chose :
--     "C:\xampp\mysql\bin\mysql.exe" -u root buildwise < "C:\xampp\htdocs\BuildWise-MySQL\database\update-2026-11-10.sql"
--
-- AVANT DE LE LANCER : fais une sauvegarde (dossier `backups/`, voir son
-- README.md). C'est la règle du projet : aucune structure ne bouge sans
-- sauvegarde préalable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. `component_prices.verified_at` — la date où le prix a été constaté
--    NOT NULL avec une valeur par défaut : les relevés déjà en base restent
--    valides, ils prennent la date du jour de la mise à jour.
-- ---------------------------------------------------------------------------
ALTER TABLE `component_prices`
  ADD COLUMN `verified_at` DATE NOT NULL DEFAULT CURRENT_DATE AFTER `source_url`;

-- ---------------------------------------------------------------------------
-- 2. `benchmarks.paired_component_id` — l'autre pièce du banc d'essai
--    NULL autorisé : une mesure déjà enregistrée n'a pas besoin d'être
--    complétée de force. `ON DELETE SET NULL` : retirer la pièce associée du
--    catalogue efface le lien, mais garde la mesure de l'autre pièce.
-- ---------------------------------------------------------------------------
ALTER TABLE `benchmarks`
  ADD COLUMN `paired_component_id` INT UNSIGNED NULL DEFAULT NULL AFTER `component_id`;

ALTER TABLE `benchmarks`
  ADD KEY `idx_benchmarks_paired` (`paired_component_id`);

ALTER TABLE `benchmarks`
  ADD CONSTRAINT `fk_benchmarks_paired`
    FOREIGN KEY (`paired_component_id`) REFERENCES `components` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Les prix déjà enregistrés n'ont jamais eu de date de vérification.
--    Leur date d'enregistrement (`updated_at`) est la seule chose honnête à
--    leur donner : c'est le jour où quelqu'un les a tapés. Cette requête ne
--    change aucun montant, aucune source : elle remplit une colonne toute neuve.
-- ---------------------------------------------------------------------------
UPDATE `component_prices` SET `verified_at` = DATE(`updated_at`);

-- ---------------------------------------------------------------------------
-- 4. Vérification rapide, à lire après l'exécution :
--    les deux lignes du bas doivent apparaître.
-- ---------------------------------------------------------------------------
SELECT `TABLE_NAME`, `COLUMN_NAME`, `COLUMN_TYPE`, `IS_NULLABLE`, `COLUMN_DEFAULT`
FROM `information_schema`.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE()
  AND ((`TABLE_NAME` = 'component_prices' AND `COLUMN_NAME` = 'verified_at')
    OR (`TABLE_NAME` = 'benchmarks' AND `COLUMN_NAME` = 'paired_component_id'));
