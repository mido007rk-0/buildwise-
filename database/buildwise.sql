-- =====================================================================
-- BuildWise 2.0 -- base de données MySQL
-- =====================================================================
--
-- A quoi sert ce fichier ?
--   Il crée la base `buildwise`, ses 6 tables, leurs relations,
--   puis il remplit la table `components` avec le catalogue déjà present
--   dans l'application (32 références) et la table `compatibility` avec les
--   règles de socket et de génération RAM déjà appliquées par le site.
--
-- Ce que ce fichier ne fait PAS, volontairement :
--   - il ne met aucun prix (la table `component_prices` reste vide) ;
--   - il ne met aucun benchmark (la table `benchmarks` reste vide).
--   BuildWise refuse d'afficher un prix ou des FPS inventés. Ces données
--   doivent être saisies par une personne réelle, avec une source, via la
--   page `admin.html` du projet.
--
-- Comment l'importer :
--   1) Via phpMyAdmin : onglet "Importer" > choisir ce fichier > Exécuter.
--   2) Via ligne de commande :
--        mysql -u root -p < database/buildwise.sql
--
-- Re-importable : oui. Les INSERT sont ignorés si la ligne existe déjà,
-- donc relancer ce fichier n'écrase pas tes prix saisis entre-temps.
--
-- Compatible MySQL 5.7 / MySQL 8.x / MariaDB 10.4+ (XAMPP).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La base de données
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `buildwise`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `buildwise`;


-- ---------------------------------------------------------------------
-- 2. Table `components` : les composants informatiques
--    C'est la table centrale : prix, benchmarks et compatibilités la
--    pointent tous par une clé étrangère `component_id`.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `components` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  -- `slug` : identifiant technique court, stable, utilisé par le site
  -- (ex : 'r5-7600'). Il etait déjà employe par l'ancienne version
  -- JavaScript, ce qui permet de garder les configurations déjà
  -- enregistrées dans le navigateur de l'utilisateur.
  `slug`           VARCHAR(60)     NOT NULL,
  `name`           VARCHAR(180)    NOT NULL,
  `brand`          VARCHAR(60)     NULL DEFAULT NULL,
  `category`       ENUM('cpu','gpu','board','ram','storage','psu','case','cooler')
                                   NOT NULL,
  -- Prix indicatif en dinars algériens. NULL = aucun prix vérifié saisi.
  -- Cette colonne est un raccourci : elle est maintenue identique au prix
  -- le plus récent de la table `component_prices` (voir backend/prices.php).
  `price`          DECIMAL(12,2)   NULL DEFAULT NULL,
  -- Détails techniques au format JSON, utilisés par le Compatibility Checker
  -- (ex : {"socket":"AM5","ramType":"DDR5","tier":3,"gb":32,"watts":750}).
  `specifications` JSON            NULL,
  -- Chemin ou URL d'une photo du composant. NULL = aucune image connue.
  `image`          VARCHAR(255)    NULL DEFAULT NULL,
  `created_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_components_slug` (`slug`),
  KEY `idx_components_category` (`category`),
  KEY `idx_components_brand` (`brand`),
  CONSTRAINT `chk_components_price` CHECK (`price` IS NULL OR `price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 3. Table `component_prices` : l'historique des prix
--    Une ligne = un prix observé une fois, dans une boutique, a une date.
--    On garde l'historique au lieu d'écraser : cela permet de voir si un
--    prix a monté ou baissé, et surtout de savoir d'ou vient chaque chiffre.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `component_prices` (
  `id`           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `component_id` INT UNSIGNED   NOT NULL,
  `price`        DECIMAL(12,2)  NOT NULL,
  -- Devise principale du projet : le dinar algérien.
  `currency`     CHAR(3)        NOT NULL DEFAULT 'DZD',
  -- D'ou vient le prix : nom du vendeur, marché, ou "saisie manuelle".
  `source`       VARCHAR(180)   NOT NULL,
  -- Optionnel : URL de la fiche produit, pour pouvoir vérifier plus tard.
  `source_url`   VARCHAR(300)   NULL DEFAULT NULL,
  -- Date à laquelle le prix a réellement été vérifié en boutique ou sur le site.
  -- Elle peut différer de `updated_at` (date d'enregistrement dans la base) :
  -- on peut relever un prix le 3 et le saisir le 5. Le site affiche `verified_at`.
  -- C'est aussi elle qui désigne « le prix actuel » d'un composant, ce qui
  -- permet de corriger un ancien relevé sans fausser le prix affiché.
  `verified_at`  DATE           NOT NULL DEFAULT CURRENT_DATE,
  `updated_at`   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prices_component_date` (`component_id`, `updated_at`),
  CONSTRAINT `fk_prices_component`
    FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_prices_positive` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 4. Table `benchmarks` : résultats de performance dans les jeux
--    Une ligne = une mesure réellement effectuée (ou citée avec source) pour
--    un composant, un jeu, une résolution et des réglages précis.
--    Sans ces 4 informations, un chiffre de FPS ne veut rien dire :
--    c'est pourquoi la page FPS Range refuse d'inventer une estimation.
--
--    LE PROCESSEUR ET LA CARTE GRAPHIQUE : une mesure en jeu dépend toujours
--    des deux à la fois. `component_id` reste la pièce que la mesure documente
--    (celle dont on veut connaître le FPS), et `paired_component_id` est
--    l'autre pièce du test. La colonne est NULL : les mesures des autres
--    familles (RAM, stockage...) n'ont rien à associer, et une mesure saisie
--    avant cette colonne garde sa valeur sans être modifiée.
--    L'association se lit sans jamais mélanger les statistiques : le site
--    affiche « mesuré avec Ryzen 5 5600 » à côté de la ligne, il ne calcule
--    jamais une moyenne à travers les paires.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `benchmarks` (
  `id`                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `component_id`      INT UNSIGNED      NOT NULL,
  -- L'autre pièce du test : un GPU si `component_id` est un CPU, et
  -- inversement. ON DELETE SET NULL : si la pièce associée est retirée du
  -- catalogue plus tard, la mesure reste en base, elle perd seulement sa
  -- mention. Effacer une preuve de performance serait le pire des choix.
  `paired_component_id` INT UNSIGNED    NULL DEFAULT NULL,
  `game`              VARCHAR(120)      NOT NULL,
  -- Ex : '1080p', '1440p', '4K'.
  `resolution`        VARCHAR(20)       NOT NULL,
  -- Ex : 'high', 'ultra', 'medium + ray tracing on'.
  `graphics_settings` VARCHAR(60)       NOT NULL,
  `fps`               SMALLINT UNSIGNED NOT NULL,
  -- Provenance de la mesure (test personnel, vidéo, site spécialisé).
  `source`            VARCHAR(180)      NULL DEFAULT NULL,
  `source_url`        VARCHAR(300)      NULL DEFAULT NULL,
  `created_at`        TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_benchmarks_component` (`component_id`),
  KEY `idx_benchmarks_paired` (`paired_component_id`),
  KEY `idx_benchmarks_game` (`game`, `resolution`),
  CONSTRAINT `fk_benchmarks_component`
    FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_benchmarks_paired`
    FOREIGN KEY (`paired_component_id`) REFERENCES `components` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_benchmarks_fps` CHECK (`fps` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 5. Table `configurations` : un PC complet enregistré
--    Une ligne = la tête d'une configuration (nom, budget, usage).
--    Ses composants sont stockés dans `configuration_components`.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `configurations` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(150)  NOT NULL,
  `budget`      DECIMAL(12,2) NULL DEFAULT NULL,
  -- 'gaming', 'code', 'video', '3d' ou 'office' (liste utilisée du site).
  `usage`       VARCHAR(30)   NULL DEFAULT NULL,
  `resolution`  VARCHAR(20)   NULL DEFAULT NULL,
  -- Total calculé au moment de l'enregistrement, en DZD.
  -- NULL si tous les prix n'étaient pas renseignés.
  `total_price` DECIMAL(12,2) NULL DEFAULT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_configurations_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 6. Table `configuration_components` : la liaison PC <-> composants
--    Table d'association many-to-many : une configuration contient
--    plusieurs composants, et un composant apparait dans plusieurs
--    configurations. `quantity` gère les cas réels (2 barrettes, 2 SSD).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `configuration_components` (
  `id`               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `configuration_id` INT UNSIGNED      NOT NULL,
  `component_id`     INT UNSIGNED      NOT NULL,
  `quantity`         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  -- Une seule ligne par composant dans une configuration : la quantité
  -- porte la répétition. Évite les doublons si on re-enregistre.
  UNIQUE KEY `uq_config_component` (`configuration_id`, `component_id`),
  KEY `idx_link_component` (`component_id`),
  CONSTRAINT `fk_link_configuration`
    FOREIGN KEY (`configuration_id`) REFERENCES `configurations` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_link_component`
    FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_link_quantity` CHECK (`quantity` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 7. Table `compatibility` : les paires déjà vérifiées
--    Le Compatibility Checker applique d'abord les règles techniques
--    (socket, génération RAM) lues dans `components.specifications`.
--    Cette table y ajoute ce qu'un humain a constaté : un BIOS requis,
--    un GPU trop long pour un boîtier, un ventirad qui masque une barrette.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `compatibility` (
  `id`                       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `component_id`             INT UNSIGNED  NOT NULL,
  `compatible_component_id`  INT UNSIGNED  NOT NULL,
  -- 'compatible', 'incompatible' ou 'unknown' (à vérifier).
  `compatibility_status`     ENUM('compatible','incompatible','unknown')
                             NOT NULL DEFAULT 'unknown',
  `notes`                    VARCHAR(500)  NULL DEFAULT NULL,
  `created_at`               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Une seule ligne par paire, dans un sens ou dans l'autre.
  UNIQUE KEY `uq_compat_pair` (`component_id`, `compatible_component_id`),
  KEY `idx_compat_other` (`compatible_component_id`),
  CONSTRAINT `fk_compat_component`
    FOREIGN KEY (`component_id`) REFERENCES `components` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_compat_other_component`
    FOREIGN KEY (`compatible_component_id`) REFERENCES `components` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Note : « une pièce ne doit pas être comparée à elle-même » n'est pas une
-- contrainte SQL ici. Les CHECK entre deux différentes colonnes sont refusées
-- par certaines versions de MariaDB. La règle est donc vérifiée en PHP, dans
-- backend/compatibility.php, avant toute insertion.


-- =====================================================================
-- 8. DONNÉES DE DÉPART : le catalogue de composants
-- =====================================================================
-- Reprises à l'identique du catalogue JavaScript de BuildWise 2.0.
-- `price` est NULL partout : aucun prix n'est connu, donc aucun n'est écrit.
-- Les noms marquent des FAMILLES de produits ("type", "modèle à préciser") :
-- c'est volontaire, le site ne certifie pas un modele exact.
-- INSERT IGNORE + clé `slug` unique => ce bloc peut être relance sans risque.
-- =====================================================================

-- 8.1 Processeurs (cpu)
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('r5-5600',   'AMD Ryzen 5 5600',       'AMD',   'cpu', '{"socket":"AM4","tier":2}'),
('r5-7600',   'AMD Ryzen 5 7600',       'AMD',   'cpu', '{"socket":"AM5","tier":3}'),
('r7-7700',   'AMD Ryzen 7 7700',       'AMD',   'cpu', '{"socket":"AM5","tier":4}'),
('i5-12400f', 'Intel Core i5-12400F',   'Intel', 'cpu', '{"socket":"LGA1700","tier":2}'),
('i5-14400f', 'Intel Core i5-14400F',   'Intel', 'cpu', '{"socket":"LGA1700","tier":3}'),
('i7-14700',  'Intel Core i7-14700',    'Intel', 'cpu', '{"socket":"LGA1700","tier":4}');

-- 8.2 Cartes mères (board) : les seules pièces qui portent socket + RAM
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('b550-ddr4', 'Carte mère B550 / DDR4 (type)',  NULL, 'board', '{"socket":"AM4","ramType":"DDR4"}'),
('b650-ddr5', 'Carte mère B650 / DDR5 (type)',  NULL, 'board', '{"socket":"AM5","ramType":"DDR5"}'),
('b660-ddr4', 'Carte mère B660 / DDR4 (type)',  NULL, 'board', '{"socket":"LGA1700","ramType":"DDR4"}'),
('b760-ddr5', 'Carte mère B760 / DDR5 (type)',  NULL, 'board', '{"socket":"LGA1700","ramType":"DDR5"}');

-- 8.3 Cartes graphiques (gpu)
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('rx6600',   'AMD Radeon RX 6600',           'AMD',    'gpu', '{"tier":2}'),
('rx7600',   'AMD Radeon RX 7600',           'AMD',    'gpu', '{"tier":3}'),
('rx7800xt', 'AMD Radeon RX 7800 XT',        'AMD',    'gpu', '{"tier":4}'),
('rtx4060',  'NVIDIA GeForce RTX 4060',      'NVIDIA', 'gpu', '{"tier":3}'),
('rtx4070s', 'NVIDIA GeForce RTX 4070 SUPER','NVIDIA', 'gpu', '{"tier":4}'),
('rtx4080s', 'NVIDIA GeForce RTX 4080 SUPER','NVIDIA', 'gpu', '{"tier":5}');

-- 8.4 Memoire RAM
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('ddr4-16', '16 Go DDR4 (2 × 8 Go)',  NULL, 'ram', '{"ramType":"DDR4","gb":16}'),
('ddr4-32', '32 Go DDR4 (2 × 16 Go)', NULL, 'ram', '{"ramType":"DDR4","gb":32}'),
('ddr5-16', '16 Go DDR5 (2 × 8 Go)',  NULL, 'ram', '{"ramType":"DDR5","gb":16}'),
('ddr5-32', '32 Go DDR5 (2 × 16 Go)', NULL, 'ram', '{"ramType":"DDR5","gb":32}'),
('ddr5-64', '64 Go DDR5 (2 × 32 Go)', NULL, 'ram', '{"ramType":"DDR5","gb":64}');

-- 8.5 Stockage : aucune spécification technique vérifiée dans le projet
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('ssd-500', 'SSD NVMe 500 Go', NULL, 'storage', NULL),
('ssd-1t',  'SSD NVMe 1 To',   NULL, 'storage', NULL),
('ssd-2t',  'SSD NVMe 2 To',   NULL, 'storage', NULL);

-- 8.6 Alimentations (psu) : seule la puissance nominale est connue
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('psu-550', 'Alimentation 550 W (modèle à préciser)', NULL, 'psu', '{"watts":550}'),
('psu-650', 'Alimentation 650 W (modèle à préciser)', NULL, 'psu', '{"watts":650}'),
('psu-750', 'Alimentation 750 W (modèle à préciser)', NULL, 'psu', '{"watts":750}'),
('psu-850', 'Alimentation 850 W (modèle à préciser)', NULL, 'psu', '{"watts":850}');

-- 8.7 Boîtiers et refroidissement : dimensions et compatibilités inconnues
INSERT IGNORE INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`) VALUES
('case-atx',    'Boîtier ATX (modèle à préciser)',           NULL, 'case',   NULL),
('case-matx',   'Boîtier micro-ATX (modèle à préciser)',     NULL, 'case',   NULL),
('cooler-air',  'Ventirad (compatibilité à vérifier)',       NULL, 'cooler', NULL),
('cooler-aio',  'Watercooling AIO (compatibilité à vérifier)', NULL, 'cooler', NULL);


-- =====================================================================
-- 9. DONNÉES DE DÉPART : les paires de compatibilité
-- =====================================================================
-- Ces lignes ne sont pas une invention : elles sont la traduction en SQL
-- de la règle déjà appliquee par le site depuis sa version JavaScript
-- (checkBuild() comparait déjà les champs `socket` et `ramType`).
-- Elles sont générées à partir des spécifications stockées dans
-- `components`, donc si tu corriges un socket plus tard, il suffit de
-- relancer ces deux INSERT pour recalculer les paires.
--
-- Rappel important, consigne du projet : égalité de socket ne vaut pas
-- validation definitive. La révision de BIOS, les dimensions, la RAM
-- maximale et les connecteurs restent à vérifier chez le fabricant ;
-- c'est écrit dans chaque note.
-- =====================================================================

-- 9.1 Processeur <-> carte mère : le socket doit être identique.
INSERT IGNORE INTO `compatibility`
  (`component_id`, `compatible_component_id`, `compatibility_status`, `notes`)
SELECT
  cpu.`id`,
  board.`id`,
  IF(cpu.`socket` = board.`socket`, 'compatible', 'incompatible'),
  CONCAT(
    'Socket CPU ', cpu.`socket`, ' / socket carte mère ', board.`socket`, '. ',
    IF(cpu.`socket` = board.`socket`,
       'Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.',
       'Le processeur ne peut pas être monté sur cette carte mère.')
  )
FROM
  (SELECT `id`, `socket` FROM (
     SELECT `id`, JSON_UNQUOTE(JSON_EXTRACT(`specifications`, '$.socket')) AS `socket`
     FROM `components` WHERE `category` = 'cpu'
   ) AS cpu_raw WHERE `socket` IS NOT NULL) AS cpu
CROSS JOIN
  (SELECT `id`, `socket` FROM (
     SELECT `id`, JSON_UNQUOTE(JSON_EXTRACT(`specifications`, '$.socket')) AS `socket`
     FROM `components` WHERE `category` = 'board'
   ) AS board_raw WHERE `socket` IS NOT NULL) AS board;

-- 9.2 RAM <-> carte mère : la génération DDR doit être identique.
INSERT IGNORE INTO `compatibility`
  (`component_id`, `compatible_component_id`, `compatibility_status`, `notes`)
SELECT
  ram.`id`,
  board.`id`,
  IF(ram.`ram_type` = board.`ram_type`, 'compatible', 'incompatible'),
  CONCAT(
    'RAM ', ram.`ram_type`, ' / carte mère ', board.`ram_type`, '. ',
    IF(ram.`ram_type` = board.`ram_type`,
       'Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.',
       'Génération différente : cette barrette ne convient pas aux ports de cette carte mère.')
  )
FROM
  (SELECT `id`, `ram_type` FROM (
     SELECT `id`, JSON_UNQUOTE(JSON_EXTRACT(`specifications`, '$.ramType')) AS `ram_type`
     FROM `components` WHERE `category` = 'ram'
   ) AS ram_raw WHERE `ram_type` IS NOT NULL) AS ram
CROSS JOIN
  (SELECT `id`, `ram_type` FROM (
     SELECT `id`, JSON_UNQUOTE(JSON_EXTRACT(`specifications`, '$.ramType')) AS `ram_type`
     FROM `components` WHERE `category` = 'board'
   ) AS board_raw WHERE `ram_type` IS NOT NULL) AS board;


-- =====================================================================
-- 10. Vérification rapide après import
-- =====================================================================
-- Débloque les lignes ci-dessous pour compter les enregistrements.
-- Tu peux aussi ouvrir backend/check.php dans ton navigateur : il fait
-- ce controle automatiquement et t'explique les erreurs en français.
-- =====================================================================
-- SELECT 'composants' AS table_, COUNT(*) AS lignes FROM `components`
-- UNION ALL SELECT 'prix',            COUNT(*) FROM `component_prices`
-- UNION ALL SELECT 'benchmarks',      COUNT(*) FROM `benchmarks`
-- UNION ALL SELECT 'configurations',  COUNT(*) FROM `configurations`
-- UNION ALL SELECT 'liens config',    COUNT(*) FROM `configuration_components`
-- UNION ALL SELECT 'compatibilites',  COUNT(*) FROM `compatibility`;


-- =====================================================================
-- 11. Remettre la base à zéro (OPTIONNEL, DANGEREUX)
-- =====================================================================
-- À ne décommenter QUE si tu veux tout reconstruire : cela supprime les
-- prix, benchmarks et configurations enregistrés. Les clauses ON DELETE
-- CASCADE font le ménage automatiquement dans les tables liées.
-- =====================================================================
-- SET FOREIGN_KEY_CHECKS = 0;
-- TRUNCATE TABLE `configuration_components`;
-- TRUNCATE TABLE `configurations`;
-- TRUNCATE TABLE `benchmarks`;
-- TRUNCATE TABLE `component_prices`;
-- TRUNCATE TABLE `compatibility`;
-- TRUNCATE TABLE `components`;
-- SET FOREIGN_KEY_CHECKS = 1;
