-- =====================================================================
-- BuildWise — LA BASE EN LIGNE (version hébergeur)
-- Fabriquée le 2026-11-11 à 22:14 à partir de la base buildwise de ton XAMPP.
--
-- CE FICHIER NE CRÉE PAS LA BASE : sur un hébergeur gratuit, la base se
-- crée d'abord dans le panneau (rubrique « MySQL Databases »), sous un nom
-- imposé du type epiz_12345678_buildwise. Ensuite, dans phpMyAdmin :
-- onglet Import, choisis ce fichier, Exécute.
--
-- CE QUE CE FICHIER MET EN LIGNE :
--   • la structure des 6 tables ;
--   • les 32 composants du catalogue ;
--   • les 44 constats de compatibilité ;
--   • les 20 prix vérifiés en DZD, avec leur source et leur date.
-- CE QU IL NE MET PAS, VOLONTAIREMENT :
--   • tes 2 configurations personnelles (aucune donnée privée en ligne) ;
--   • les mesures de FPS : la table benchmarks est créée mais vide, le site
--     affiche donc « Aucune mesure enregistrée », jamais un chiffre inventé.
-- Version « hébergeur » : les lignes SET TIME_ZONE ont été neutralisées,
-- elles font échouer l'import sur un MySQL mutualisé sans tables de fuseaux.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
-- SET_TIME_ZONE_NEUTRALISE : @OLD_TIME_ZONE
-- SET_TIME_ZONE_NEUTRALISE : l'import ne change pas le fuseau du serveur
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `benchmarks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `benchmarks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `component_id` int(10) unsigned NOT NULL,
  `paired_component_id` int(10) unsigned DEFAULT NULL,
  `game` varchar(120) NOT NULL,
  `resolution` varchar(20) NOT NULL,
  `graphics_settings` varchar(60) NOT NULL,
  `fps` smallint(5) unsigned NOT NULL,
  `source` varchar(180) DEFAULT NULL,
  `source_url` varchar(300) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_benchmarks_component` (`component_id`),
  KEY `idx_benchmarks_game` (`game`,`resolution`),
  KEY `idx_benchmarks_paired` (`paired_component_id`),
  CONSTRAINT `fk_benchmarks_component` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_benchmarks_paired` FOREIGN KEY (`paired_component_id`) REFERENCES `components` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_benchmarks_fps` CHECK (`fps` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `compatibility`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `compatibility` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `component_id` int(10) unsigned NOT NULL,
  `compatible_component_id` int(10) unsigned NOT NULL,
  `compatibility_status` enum('compatible','incompatible','unknown') NOT NULL DEFAULT 'unknown',
  `notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_compat_pair` (`component_id`,`compatible_component_id`),
  KEY `idx_compat_other` (`compatible_component_id`),
  CONSTRAINT `fk_compat_component` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_compat_other_component` FOREIGN KEY (`compatible_component_id`) REFERENCES `components` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `component_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `component_prices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `component_id` int(10) unsigned NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'DZD',
  `source` varchar(180) NOT NULL,
  `source_url` varchar(300) DEFAULT NULL,
  `verified_at` date NOT NULL DEFAULT curdate(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_prices_component_date` (`component_id`,`updated_at`),
  CONSTRAINT `fk_prices_component` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_prices_positive` CHECK (`price` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `components` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(60) NOT NULL,
  `name` varchar(180) NOT NULL,
  `brand` varchar(60) DEFAULT NULL,
  `category` enum('cpu','gpu','board','ram','storage','psu','case','cooler') NOT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `specifications` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`specifications`)),
  `image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_components_slug` (`slug`),
  KEY `idx_components_category` (`category`),
  KEY `idx_components_brand` (`brand`),
  CONSTRAINT `chk_components_price` CHECK (`price` is null or `price` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `configuration_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `configuration_components` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `configuration_id` int(10) unsigned NOT NULL,
  `component_id` int(10) unsigned NOT NULL,
  `quantity` smallint(5) unsigned NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_config_component` (`configuration_id`,`component_id`),
  KEY `idx_link_component` (`component_id`),
  CONSTRAINT `fk_link_component` FOREIGN KEY (`component_id`) REFERENCES `components` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_link_configuration` FOREIGN KEY (`configuration_id`) REFERENCES `configurations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_link_quantity` CHECK (`quantity` >= 1)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `configurations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `budget` decimal(12,2) DEFAULT NULL,
  `usage` varchar(30) DEFAULT NULL,
  `resolution` varchar(20) DEFAULT NULL,
  `total_price` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_configurations_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
-- SET_TIME_ZONE_NEUTRALISE : restauration du fuseau annulée

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;



/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
-- SET_TIME_ZONE_NEUTRALISE : @OLD_TIME_ZONE
-- SET_TIME_ZONE_NEUTRALISE : l'import ne change pas le fuseau du serveur
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
INSERT INTO `components` (`id`, `slug`, `name`, `brand`, `category`, `price`, `specifications`, `image`, `created_at`) VALUES (1,'r5-5600','AMD Ryzen 5 5600','AMD','cpu',28900.00,'{\"socket\":\"AM4\",\"tier\":2}',NULL,'2026-11-10 18:50:41'),(2,'r5-7600','AMD Ryzen 5 7600','AMD','cpu',41900.00,'{\"socket\":\"AM5\",\"tier\":3}',NULL,'2026-11-10 18:50:41'),(3,'r7-7700','AMD Ryzen 7 7700','AMD','cpu',49900.00,'{\"socket\":\"AM5\",\"tier\":4}',NULL,'2026-11-10 18:50:41'),(4,'i5-12400f','Intel Core i5-12400F','Intel','cpu',32500.00,'{\"socket\":\"LGA1700\",\"tier\":2}',NULL,'2026-11-10 18:50:41'),(5,'i5-14400f','Intel Core i5-14400F','Intel','cpu',39500.00,'{\"socket\":\"LGA1700\",\"tier\":3}',NULL,'2026-11-10 18:50:41'),(6,'i7-14700','Intel Core i7-14700','Intel','cpu',79900.00,'{\"socket\":\"LGA1700\",\"tier\":4}',NULL,'2026-11-10 18:50:41'),(7,'b550-ddr4','Carte mère B550 / DDR4 (type)',NULL,'board',NULL,'{\"socket\":\"AM4\",\"ramType\":\"DDR4\"}',NULL,'2026-11-10 18:50:41'),(8,'b650-ddr5','Carte mère B650 / DDR5 (type)',NULL,'board',NULL,'{\"socket\":\"AM5\",\"ramType\":\"DDR5\"}',NULL,'2026-11-10 18:50:41'),(9,'b660-ddr4','Carte mère B660 / DDR4 (type)',NULL,'board',NULL,'{\"socket\":\"LGA1700\",\"ramType\":\"DDR4\"}',NULL,'2026-11-10 18:50:41'),(10,'b760-ddr5','Carte mère B760 / DDR5 (type)',NULL,'board',NULL,'{\"socket\":\"LGA1700\",\"ramType\":\"DDR5\"}',NULL,'2026-11-10 18:50:41'),(11,'rx6600','AMD Radeon RX 6600','AMD','gpu',68900.00,'{\"tier\":2}',NULL,'2026-11-10 18:50:41'),(12,'rx7600','AMD Radeon RX 7600','AMD','gpu',79900.00,'{\"tier\":3}',NULL,'2026-11-10 18:50:41'),(13,'rx7800xt','AMD Radeon RX 7800 XT','AMD','gpu',135000.00,'{\"tier\":4}',NULL,'2026-11-10 18:50:41'),(14,'rtx4060','NVIDIA GeForce RTX 4060','NVIDIA','gpu',79500.00,'{\"tier\":3}',NULL,'2026-11-10 18:50:41'),(15,'rtx4070s','NVIDIA GeForce RTX 4070 SUPER','NVIDIA','gpu',171900.00,'{\"tier\":4}',NULL,'2026-11-10 18:50:41'),(16,'rtx4080s','NVIDIA GeForce RTX 4080 SUPER','NVIDIA','gpu',299900.00,'{\"tier\":5}',NULL,'2026-11-10 18:50:41'),(17,'ddr4-16','16 Go DDR4 (2 × 8 Go)',NULL,'ram',NULL,'{\"ramType\":\"DDR4\",\"gb\":16}',NULL,'2026-11-10 18:50:41'),(18,'ddr4-32','32 Go DDR4 (2 × 16 Go)',NULL,'ram',NULL,'{\"ramType\":\"DDR4\",\"gb\":32}',NULL,'2026-11-10 18:50:41'),(19,'ddr5-16','16 Go DDR5 (2 × 8 Go)',NULL,'ram',NULL,'{\"ramType\":\"DDR5\",\"gb\":16}',NULL,'2026-11-10 18:50:41'),(20,'ddr5-32','32 Go DDR5 (2 × 16 Go)',NULL,'ram',NULL,'{\"ramType\":\"DDR5\",\"gb\":32}',NULL,'2026-11-10 18:50:41'),(21,'ddr5-64','64 Go DDR5 (2 × 32 Go)',NULL,'ram',NULL,'{\"ramType\":\"DDR5\",\"gb\":64}',NULL,'2026-11-10 18:50:41'),(22,'ssd-500','SSD NVMe 500 Go',NULL,'storage',NULL,NULL,NULL,'2026-11-10 18:50:41'),(23,'ssd-1t','SSD NVMe 1 To',NULL,'storage',NULL,NULL,NULL,'2026-11-10 18:50:41'),(24,'ssd-2t','SSD NVMe 2 To',NULL,'storage',NULL,NULL,NULL,'2026-11-10 18:50:41'),(25,'psu-550','Alimentation 550 W (modèle à préciser)',NULL,'psu',NULL,'{\"watts\":550}',NULL,'2026-11-10 18:50:41'),(26,'psu-650','Alimentation 650 W (modèle à préciser)',NULL,'psu',NULL,'{\"watts\":650}',NULL,'2026-11-10 18:50:41'),(27,'psu-750','Alimentation 750 W (modèle à préciser)',NULL,'psu',NULL,'{\"watts\":750}',NULL,'2026-11-10 18:50:41'),(28,'psu-850','Alimentation 850 W (modèle à préciser)',NULL,'psu',NULL,'{\"watts\":850}',NULL,'2026-11-10 18:50:41'),(29,'case-atx','Boîtier ATX (modèle à préciser)',NULL,'case',NULL,NULL,NULL,'2026-11-10 18:50:41'),(30,'case-matx','Boîtier micro-ATX (modèle à préciser)',NULL,'case',NULL,NULL,NULL,'2026-11-10 18:50:41'),(31,'cooler-air','Ventirad (compatibilité à vérifier)',NULL,'cooler',NULL,NULL,NULL,'2026-11-10 18:50:41'),(32,'cooler-aio','Watercooling AIO (compatibilité à vérifier)',NULL,'cooler',NULL,NULL,NULL,'2026-11-10 18:50:41');
/*!40000 ALTER TABLE `components` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `component_prices` WRITE;
/*!40000 ALTER TABLE `component_prices` DISABLE KEYS */;
INSERT INTO `component_prices` (`id`, `component_id`, `price`, `currency`, `source`, `source_url`, `verified_at`, `updated_at`) VALUES (37,1,27500.00,'DZD','KhabirTech — AMD RYZEN 5 5600 TRAY NEW','https://khabirtech.com/amd-ryzen-5-5600-tray/','2026-11-10','2026-11-10 22:36:54'),(38,1,27900.00,'DZD','iTHECDZ — CPU AMD Ryzen 5 5600 Tray','https://www.ithecdz.com/product/cpu-amd-ryzen-5-5600-tray/','2026-11-10','2026-11-10 22:36:54'),(39,1,28900.00,'DZD','BijouTech — AMD RYZEN 5 5600 TRAY','https://bijoutech.dz/amd-ryzen-5-5600-tray','2026-11-10','2026-11-10 22:36:54'),(40,2,41500.00,'DZD','Digitec Informatique — AMD Ryzen 5 7600 Wraith Stealth (4.0 GHz / 5.2 GHz)','https://www.digitecdz.com/product/amd-ryzen-5-7600-wraith-stealth-4-0-ghz-5-2-ghz/','2026-11-10','2026-11-10 22:36:54'),(41,2,41900.00,'DZD','Campus Informatique — AMD RYZEN 5 7600 (3.8 GHz / 5.1 GHz)','https://campusinformatique.com/shop/amd-ryzen-5-7600-3-8-ghz-5-1-ghz/','2026-11-10','2026-11-10 22:36:54'),(42,3,45900.00,'DZD','iTHECDZ — AMD Ryzen 7 7700 Gaming Processor TRAY','https://www.ithecdz.com/product/amd-ryzen-7-7700-gaming-processor/','2026-11-10','2026-11-10 22:36:54'),(43,3,49900.00,'DZD','KOTEK — AMD Ryzen 7 7700 TRAY, AM5 8 coeurs 16 threads','https://kotekdz.com/amd-ryzen-7-7700-algerie/','2026-11-10','2026-11-10 22:36:54'),(44,4,32000.00,'DZD','Gaming DZ — CPU INTEL I5 12400F TRAY','https://www.gamingdz.com/store/composants/processeurs-cpu/CPU-INTEL-I5-12400F-TRAY','2026-11-10','2026-11-10 22:36:54'),(45,4,32500.00,'DZD','Promotech IT — CPU INTEL CORE I5 12400F TRAY','https://promotech-it.com/product/cpu-intel-core-i5-12400f-tray/','2026-11-10','2026-11-10 22:36:54'),(46,5,37900.00,'DZD','KhabirTech — INTEL CORE I5-14400F TRAY','https://khabirtech.com/intel-core-i5-14400f-tray/','2026-11-10','2026-11-10 22:36:54'),(47,5,38500.00,'DZD','Promotech IT — CPU INTEL CORE I5 14400F TRAY','https://promotech-it.com/product/cpu-intel-core-i5-14400f-tray/','2026-11-10','2026-11-10 22:36:54'),(48,5,39500.00,'DZD','iTHECDZ — CPU Intel Core i5-14400F TRAY','https://www.ithecdz.com/product/cpu-intel-core-i5-14400f-tray/','2026-11-10','2026-11-10 22:36:55'),(49,6,79900.00,'DZD','El Assli Hi-Tech — CPU INTEL CORE I7 14700 TRAY','https://elasslihitech.com/produit/cpu-intel-core-i7-14700-tray','2026-11-10','2026-11-10 22:36:55'),(50,11,68900.00,'DZD','NG Hardware — XFX Speedster SWFT 210 AMD Radeon RX 6600 8GB Core Edition','https://nghardware17.com/product/xfx-speedster-swft-210-radeon-rx-6600-8gb/','2026-11-11','2026-11-10 23:08:59'),(51,12,79900.00,'DZD','Techmate — ASUS RX7600 DUAL OC / GPU / 8GB','https://techmatedz.com/en/products/799','2026-11-11','2026-11-10 23:08:59'),(52,13,135000.00,'DZD','Protech WD — XFX RADEON RX 7800 XT MAGNETIC WHITE 16GB GDDR6','https://www.protechwd.store/product/xfx-radeon-rx-7800-xt-magnetic-white-16gb-gddr6','2026-11-11','2026-11-10 23:08:59'),(53,14,79500.00,'DZD','Alphatech — GeForce RTX 4060 WINDFORCE OC 8G','https://alphatechdz.com/product/geforce-rtx-4060-windforce-oc-8g/','2026-11-11','2026-11-10 23:08:59'),(54,15,171900.00,'DZD','Chinformatique — CARTE GRAPHIQUE MSI RTX4070 SUPER 12G VENTUS 2X OC','https://www.chinformatique.dz/product/carte-graphique-msi-rtx4070-super-12g-ventus-2x-oc/','2026-11-11','2026-11-10 23:08:59'),(55,16,285000.00,'DZD','Chinformatique — ASUS TUF Gaming GeForce RTX 4080 SUPER OC Edition 16 GB','https://www.chinformatique.dz/product/asus-tuf-gaming-geforce-rtx-4080-super-oc-edition-16-gb/','2026-11-11','2026-11-10 23:08:59'),(56,16,299900.00,'DZD','NextGen.DZ — GPU RTX 4080 SUPER MSI GAMING X SLIM 16GB','https://nextgendz.com/gpu-rtx-4080-super-msi-gaming-x-slim-16gb/','2026-11-11','2026-11-10 23:08:59');
/*!40000 ALTER TABLE `component_prices` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `compatibility` WRITE;
/*!40000 ALTER TABLE `compatibility` DISABLE KEYS */;
INSERT INTO `compatibility` (`id`, `component_id`, `compatible_component_id`, `compatibility_status`, `notes`, `created_at`) VALUES (1,1,7,'compatible','Socket CPU AM4 / socket carte mère AM4. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(2,2,7,'incompatible','Socket CPU AM5 / socket carte mère AM4. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(3,3,7,'incompatible','Socket CPU AM5 / socket carte mère AM4. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(4,4,7,'incompatible','Socket CPU LGA1700 / socket carte mère AM4. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(5,5,7,'incompatible','Socket CPU LGA1700 / socket carte mère AM4. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(6,6,7,'incompatible','Socket CPU LGA1700 / socket carte mère AM4. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(7,1,8,'incompatible','Socket CPU AM4 / socket carte mère AM5. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(8,2,8,'compatible','Socket CPU AM5 / socket carte mère AM5. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(9,3,8,'compatible','Socket CPU AM5 / socket carte mère AM5. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(10,4,8,'incompatible','Socket CPU LGA1700 / socket carte mère AM5. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(11,5,8,'incompatible','Socket CPU LGA1700 / socket carte mère AM5. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(12,6,8,'incompatible','Socket CPU LGA1700 / socket carte mère AM5. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(13,1,9,'incompatible','Socket CPU AM4 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(14,2,9,'incompatible','Socket CPU AM5 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(15,3,9,'incompatible','Socket CPU AM5 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(16,4,9,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(17,5,9,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(18,6,9,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(19,1,10,'incompatible','Socket CPU AM4 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(20,2,10,'incompatible','Socket CPU AM5 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(21,3,10,'incompatible','Socket CPU AM5 / socket carte mère LGA1700. Le processeur ne peut pas être monté sur cette carte mère.','2026-11-10 18:50:41'),(22,4,10,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(23,5,10,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(24,6,10,'compatible','Socket CPU LGA1700 / socket carte mère LGA1700. Correspondance indicative : la révision de BIOS nécessaire reste à vérifier chez le fabricant.','2026-11-10 18:50:41'),(32,17,7,'compatible','RAM DDR4 / carte mère DDR4. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(33,18,7,'compatible','RAM DDR4 / carte mère DDR4. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(34,19,7,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(35,20,7,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(36,21,7,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(37,17,8,'incompatible','RAM DDR4 / carte mère DDR5. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(38,18,8,'incompatible','RAM DDR4 / carte mère DDR5. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(39,19,8,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(40,20,8,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(41,21,8,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(42,17,9,'compatible','RAM DDR4 / carte mère DDR4. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(43,18,9,'compatible','RAM DDR4 / carte mère DDR4. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(44,19,9,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(45,20,9,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(46,21,9,'incompatible','RAM DDR5 / carte mère DDR4. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(47,17,10,'incompatible','RAM DDR4 / carte mère DDR5. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(48,18,10,'incompatible','RAM DDR4 / carte mère DDR5. Génération différente : cette barrette ne convient pas aux ports de cette carte mère.','2026-11-10 18:50:41'),(49,19,10,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(50,20,10,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41'),(51,21,10,'compatible','RAM DDR5 / carte mère DDR5. Correspondance indicative : fréquence, capacité maximale et liste QVL non vérifiées.','2026-11-10 18:50:41');
/*!40000 ALTER TABLE `compatibility` ENABLE KEYS */;
UNLOCK TABLES;
-- SET_TIME_ZONE_NEUTRALISE : restauration du fuseau annulée

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


SET FOREIGN_KEY_CHECKS = 1;

-- Fin : rien d'autre n'est nécessaire. Le site fonctionne dès ici.
