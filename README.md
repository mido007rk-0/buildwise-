# BuildWise 2.0 — avec une vraie base MySQL et un backend PHP

Ce dossier contient le site BuildWise **tel qu'il était** (même design, mêmes pages, mêmes
calculateurs), relié cette fois à une vraie base de données MySQL et à un backend PHP.

Aucune fonctionnalité n'a été supprimée : les 11 pages du site (Accueil, PC Builder, SmartPrice,
Upgrade Path, FPS Range, Bottleneck, PC Doctor, GoalMatch, Compatibility, Resolution Advisor, Game
Settings) sont toutes là, mais elles lisent maintenant leurs données dans MySQL.

**Ce README t'explique tout, étape par étape, même si tu n'as jamais installé de serveur.**

---

## Table des matières

* [État de TON installation](#état-de-ton-installation-vérifié-le-10-novembre-2026) — ce qui est déjà fait sur ce poste
1. [Ce dont tu as besoin](#1-ce-dont-tu-as-besoin)
2. [Installer et démarrer XAMPP](#2-installer-et-démarrer-xampp)
3. [Placer le projet au bon endroit](#3-placer-le-projet-au-bon-endroit)
4. [Créer la base de données](#4-créer-la-base-de-données)
5. [Configurer la connexion PHP](#5-configurer-la-connexion-php)
6. [Ouvrir le site](#6-ouvrir-le-site)
7. [Vérifier que tout fonctionne](#7-vérifier-que-tout-fonctionne)
8. [Saisir tes vrais prix et tes vrais FPS](#8-saisir-tes-vrais-prix-et-tes-vrais-fps)
9. [Rôle de chaque fichier](#9-rôle-de-chaque-fichier)
10. [Les 6 tables de la base](#10-les-6-tables-de-la-base)
11. [Les URL de l'API PHP](#11-les-url-de-lapi-php)
12. [Les deux règles du projet](#12-les-deux-règles-du-projet)
13. [Dépannage](#13-dépannage)
14. [Et l'ancienne version hors ligne ?](#14-et-lancienne-version-hors-ligne-)

---

## État de TON installation (vérifié le 10 novembre 2026)

Ce qui est déjà fait et contrôlé sur ce poste, tu n'as pas à le refaire :

| Vérification | Résultat |
|---|---|
| XAMPP | installé dans `C:\xampp`, PHP **8.2.12**, MariaDB **10.4.32** |
| Apache | démarré, écoute sur le port **80** |
| MySQL | démarré, écoute sur le port **3306** (celui que lit `backend/config.php`) |
| Base de données | **`buildwise`** créée et peuplée : 32 composants, 44 constats de compatibilité |
| Tables | 6 tables en InnoDB / utf8mb4, 6 clés primaires, 3 clés uniques et **7 clés étrangères** : 6 `ON DELETE CASCADE` + `fk_benchmarks_paired` en `ON DELETE SET NULL` (voir [section 10](#10-les-6-tables-de-la-base)) |
| Extensions PHP | `pdo_mysql` et `mbstring` chargées |
| Diagnostic | `http://localhost/BuildWise-MySQL/backend/check.php` → **31 tests sur 31 réussis** |
| Sauvegarde | dossier `backups/` : dump SQL complet, **restauré et vérifié** sur un serveur de test séparé |
| Site | les 11 pages s'affichent avec les données de MySQL, aucune erreur console |
| Prix et FPS | **20 prix vérifiés, 0 mesure de FPS** : les prix viennent de boutiques algériennes contrôlées à la main (13 pour les 6 processeurs, 7 pour les 6 cartes graphiques) ; les FPS restent à saisir (voir [section 8](#8-saisir-tes-vrais-prix-et-tes-vrais-fps)) |
| Lignes sans prix | les **20 lignes génériques** du catalogue (carte mère, RAM, SSD, alimentation, boîtier, refroidissement) n'ont ni marque ni modèle exacts : elles affichent volontairement « Prix non renseigné » |

Ton site est donc déjà utilisable ici : **<http://localhost/BuildWise-MySQL/>**
et ton outil de saisie : **<http://localhost/BuildWise-MySQL/admin.html>**.

> Détail sans danger : phpMyAdmin affiche aussi une base nommée `buildwise.` (avec un point final).
> Elle est **vide** (aucune table) et n'est utilisée nulle part — c'est le résultat d'une commande
> `CREATE DATABASE` tapée avec le point. Elle ne gêne en rien le site. Pour la faire disparaître :
> `C:\xampp\mysql\bin\mysql.exe -u root -e "DROP DATABASE \`buildwise.\`;"`

Le reste de ce README explique comment reproduire l'installation sur une autre machine.

---

## 1. Ce dont tu as besoin

| Outil | Pourquoi | Où le prendre |
|---|---|---|
| **XAMPP** (PHP + MySQL + Apache) | fait tourner les 3 logiciels d'un seul clic | <https://www.apachefriends.org/> |

C'est tout. XAMPP installe PHP, MySQL (ou MariaDB, c'est compatible) et Apache ensemble, sans
droits administrateur compliqués et sans connexion Internet ensuite. Prends la version **8.1 ou
plus récente** : le projet demande PHP 8.0 minimum.

---

## 2. Installer et démarrer XAMPP

1. Lance l'installateur téléchargé, garde les réglages par défaut.
2. Ouvre **XAMPP Control Panel**.
3. Clique sur **Start** en face de **Apache**. La ligne devient orange « Running ».
4. Clique sur **Start** en face de **MySQL**. Attends 2-3 secondes.

Deux fenêtres noires s'ouvrent : **ne les ferme pas**, elles sont le serveur. Une icône dans la
barre des tâches te rappelle qu'ils tournent.

Vérification rapide : ouvre <http://localhost> dans ton navigateur. Tu dois voir la page d'accueil
de XAMPP.

> Si Apache ne démarre pas, c'est presque toujours un autre logiciel qui occupe le port 80
> (Skype, IIS, un autre serveur). Le dépannage complet est à la [section 13](#13-dépannage).

---

## 3. Placer le projet au bon endroit

Apache ne sert des fichiers que depuis un dossier précis, appelé **htdocs**.

1. Dans le panneau XAMPP, clique sur **Explorer** → cela ouvre le dossier d'installation.
2. Entre dans `htdocs`.
3. Copie le dossier `BuildWise-MySQL` **à l'intérieur** de `htdocs`, sans le renommer.

Tu dois obtenir cette arborescence :

```
C:\xampp\htdocs\BuildWise-MySQL\
├── index.html          ← le site
├── admin.html          ← la page de saisie des données
├── README.md           ← ce fichier
├── assets\
├── backend\            ← les fichiers PHP
└── database\           ← le fichier SQL
```

Le nom du dossier devient le début de l'adresse : `htdocs\BuildWise-MySQL` donne
`http://localhost/BuildWise-MySQL/`.

> Tu peux renommer le dossier (en `buildwise` par exemple) : il faut alors changer l'URL en
> conséquence. Rien d'autre n'est à modifier, toutes les adresses du site sont relatives.

---

## 4. Créer la base de données

Le fichier `database/buildwise.sql` fait **tout** en une seule fois : il crée la base `buildwise`,
les 6 tables avec leurs clés et leurs relations, puis il remplit le catalogue de 32 composants et
les 44 règles de compatibilité.

### Méthode A — avec phpMyAdmin (la plus simple)

1. Avec MySQL démarré, ouvre <http://localhost/phpmyadmin>.
2. Clique sur l'onglet **Importer** (tout en haut).
3. **Choisir un fichier** → sélectionne `BuildWise-MySQL\database\buildwise.sql`.
4. Clique sur **Exécuter** en bas de page.

Si aucune erreur rouge n'apparaît, la base est créée. Tu la vois dans la colonne de gauche sous le
nom `buildwise`.

### Méthode B — en ligne de commande

Ouvre une fenêtre commande (cmd), puis :

```
cd C:\xampp\mysql\bin
mysql.exe -u root < ..\..\htdocs\BuildWise-MySQL\database\buildwise.sql
```

Aucun message = succès. (`root` sans mot de passe est le réglage par défaut de XAMPP.)

### Tu peux relancer ce fichier autant de fois que tu veux

Toutes les écritures du catalogue sont protégées : si la ligne existe déjà, elle est **ignorée**.
Importer une deuxième fois n'écrase donc **jamais** les prix que tu as saisis entre-temps.

### Ce que le fichier ne remplit PAS, volontairement

* `component_prices` reste **vide** → pas un seul prix inventé ;
* `benchmarks` reste **vide** → pas un seul FPS inventé.

Le site affichera donc « Non renseigné » et « Estimation non disponible » tant que tu n'auras rien
saisi toi-même. C'est normal et c'est voulu ([section 12](#12-les-deux-règles-du-projet)).

> Sur ta machine, `component_prices` n'est plus vide aujourd'hui : les 20 prix que tu as enregistrés
> via `admin.html` y sont, et **aucun fichier SQL du projet ne les contient**. Ils ne peuvent donc pas
> être effacés par une ré-importation du catalogue — mais ils ne peuvent pas non plus être restaurés
> par elle. C'est pour ça que `backups/` existe.

### Sauvegarder d'abord, toujours

Règle du projet : **aucune structure de base ne change sans sauvegarde préalable**. Le dossier
`backups/` contient déjà une copie complète et horodatée de ta base (`buildwise_20261110_203438.sql`),
contrôlée : elle a été restaurée sur un serveur MySQL de test séparé, et les 32 composants + 44
constats sont bien repartis comme avant.

La commande pour en prendre une nouvelle, à lancer avant chaque modification de structure :

```
"C:\xampp\mysql\bin\mysqldump.exe" -u root --default-character-set=utf8mb4 buildwise > "C:\xampp\htdocs\BuildWise-MySQL\backups\buildwise_YYYYMMDD_HHMMSS.sql"
```

Et si tu avais importé la base **avant** le 10 novembre 2026, lance une fois
`database\update-2026-11-10.sql` (après sauvegarde) pour ajouter la date de vérification des prix et
la pièce associée aux mesures de FPS. Ce script ne supprime rien : il ajoute deux colonnes.
Tout est expliqué dans `backups\README.md`.

> Attention : la sauvegarde `buildwise_20261110_203438.sql` a été prise **avant** ces deux colonnes.
> En la restaurant telle quelle, tu reviens à l'ancienne structure ; relance ensuite
> `database\update-2026-11-10.sql` pour la remettre à jour.

---

## 5. Configurer la connexion PHP

Ouvre `backend\config.php` avec le Bloc-notes (ou VS Code). Tu vois 5 lignes à ajuster :

```php
define('DB_HOST',     env('BUILDWISE_DB_HOST', '127.0.0.1'));  // l'adresse du serveur MySQL
define('DB_PORT',     env('BUILDWISE_DB_PORT', '3306'));       // le port MySQL
define('DB_NAME',     env('BUILDWISE_DB_NAME', 'buildwise'));  // le nom de la base
define('DB_USER',     env('BUILDWISE_DB_USER', 'root'));       // ton utilisateur MySQL
define('DB_PASSWORD', env('BUILDWISE_DB_PASSWORD', ''));       // son mot de passe
```

**Avec un XAMPP tout neuf, tu n'as rien à changer** : ces valeurs sont exactement les réglages par
défaut de XAMPP (`root`, mot de passe vide, port 3306).

Change-les seulement si :

* tu as défini un mot de passe pour `root` dans XAMPP → écris-le entre les guillemets de
  `DB_PASSWORD` ;
* ton MySQL tourne sur un autre port (MySQL tout seul utilise parfois 3307) → change `DB_PORT` ;
* tu as créé la base sous un autre nom → change `DB_NAME`.

Une sixième ligne règle la monnaie :

```php
define('DB_CURRENCY', env('BUILDWISE_CURRENCY', 'DZD'));
```

Le dinar algérien est la devise principale du projet. Mets `'EUR'` ici si tu travailles en euros :
tous les formulaires et tous les affichages suivront.

### Où est le mot de passe, et le navigateur peut-il le lire ?

Il est **uniquement** dans `backend/config.php`. Les fichiers de `assets/js/` ne le contiennent
pas, et un navigateur ne peut pas lire un fichier PHP : Apache **exécute** le PHP et ne renvoie que
le résultat. C'est pour ça que le JavaScript passe toujours par `backend/` pour avoir une
information — jamais directement à MySQL, qu'il ne sait pas interroger.

> Astuce avancée : chaque valeur peut aussi venir d'une variable d'environnement
> (`BUILDWISE_DB_PASSWORD`, etc.) sans toucher au fichier. Utile si tu ne veux pas enregistrer un
> mot de passe dans le code.

---

## 6. Ouvrir le site

Dans ton navigateur, tape l'adresse — **surtout pas un double-clic sur le fichier** :

```
http://localhost/BuildWise-MySQL/
```

C'est la différence entre « un fichier HTML » et « un site avec une base de données » :

* `file:///C:/xampp/htdocs/BuildWise-MySQL/index.html` → PHP ne tourne pas, le site t'explique lui-même
  qu'il ne peut pas joindre la base ;
* `http://localhost/BuildWise-MySQL/` → Apache exécute PHP, PHP interroge MySQL, les pages sont remplies.

Pour la page de saisie des données : `http://localhost/BuildWise-MySQL/admin.html`.

---

## 7. Vérifier que tout fonctionne

### Le test automatique intégré

Ouvre cette adresse, c'est la page de diagnostic du projet :

```
http://localhost/BuildWise-MySQL/backend/check.php
```

Elle vérifie **31 points** et te les affiche en vert ou en rouge : version de PHP, extensions
`pdo_mysql` et `mbstring`, connexion MySQL, existence des 6 tables, nombre de lignes, la présence
des deux colonnes ajoutées le 10/11/2026 (`component_prices.verified_at` et
`benchmarks.paired_component_id`), puis un vrai cycle INSERT → SELECT → UPDATE → DELETE, le tout
**dans une transaction annulée à la fin** (rien ne reste dans ta base, même pas en cas de plantage).
Elle teste aussi qu'une référence inexistante est refusée par les clés étrangères et qu'une tentative
d'injection SQL est neutralisée.

Chaque ligne en rouge donne **ce qu'il faut corriger**, en français.

Tu veux le même bilan en JSON (pour un script) :

```
http://localhost/BuildWise-MySQL/backend/check.php?format=json
```

### Les 4 vérifications manuelles

1. `http://localhost/BuildWise-MySQL/backend/components.php` → une longue réponse JSON avec les 32
   composants. Si tu vois du JSON, PHP et MySQL parlent bien ensemble.
2. Ouvre le site, page **Accueil** : le compteur « COMPOSANTS EN BASE » affiche 32. Cette valeur
   vient de MySQL, plus du JavaScript.
3. Page **SmartPrice** : chaque ligne sans prix vérifié affiche « Prix non renseigné », et la puce du
   haut annonce « aucun prix saisi » tant que la table `component_prices` est vide.
4. Page **FPS Range** : « Estimation non disponible ».

Les points 3 et 4 **doivent** afficher ces messages tant que `component_prices` et `benchmarks` sont
vides. Un montant qui apparaîtrait sans qu'un relevé sourcé existe en base serait un bug. Dès que
tu enregistres un prix vérifié, la ligne concernée affiche le montant, le magasin, le lien et la date
de vérification à la place de ce message.

---

## 8. Saisir tes vrais prix et tes vrais FPS

C'est l'étape qui rend le site utile. Ouvre :

```
http://localhost/BuildWise-MySQL/admin.html
```

La page est organisée en 5 onglets. À chaque fois, la source est **obligatoire** : PHP refuse une
donnée sans provenance (erreur 422) et le site n'invente rien.

Tout en haut, une barre te demande ton **mot de passe d'administration**. Sans lui, la page reste
en lecture : tu vois les compteurs et toutes les lignes, tu n'écris rien. Le mot de passe est réglé
par l'empreinte de `backend/admin-credentials.php` et se change avec `backend/new-password.php`.

| Onglet | Ce que tu y saisis | Ce que ça change sur le site |
|---|---|---|
| **Composants** | un composant qui manque au catalogue + ses spécifications techniques (socket, VRAM, watts…) selon sa famille | il apparaît dans tous les sélecteurs |
| **Prix** | un composant, un montant, une devise, la **source** (boutique, lien) et la **date de vérification** — le jour où tu as réellement vu ce prix | SmartPrice affiche le montant avec sa provenance et « vérifié le … » ; l'historique complet reste consultable et chaque relevé reste modifiable |
| **Mesures FPS** | la pièce mesurée **et l'autre pièce du test** (un processeur avec une carte graphique, obligatoirement), un jeu, une résolution, des détails graphiques, des FPS mesurés et leur **source** | FPS Range, Game Settings et Upgrade Path sortent de « non disponible » ; la page indique si une moyenne mélange plusieurs processeurs |
| **Compatibilité** | un constat humain entre deux pièces (BIOS à mettre à jour, GPU trop long, ventirad qui gêne) | Compatibility Checker affiche tes remarques en plus des règles techniques |
| **PC enregistrés** | consultation et suppression des PC enregistrés depuis le site | rien : cet onglet sert à relire et ranger tes sauvegardes |

Trois choses à savoir :

* **Supprimer** un prix, une mesure, un constat ou un PC demande toujours une confirmation. Si tu
  retires un **composant** (ça se fait dans phpMyAdmin, table `components`), la clé étrangère en
  `CASCADE` emporte automatiquement ses prix, ses mesures et ses liens : aucune ligne orpheline ne
  peut traîner. La pièce *associée* d'une mesure, elle, est en `SET NULL` : retirer le composant
  efface la mention, mais la mesure de FPS reste en base.
* Enregistrer un **nouveau prix** sur un composant ne remplace pas l'ancien : il s'ajoute à
  l'historique, et `components.price` est resynchronisé sur le relevé dont la **date de
  vérification est la plus récente**. Tu peux donc suivre l'évolution d'un tarif.
* Le bouton **Modifier** d'une ligne (prix ou mesure) recharge cette ligne dans le formulaire de
  gauche et **remplace** sa valeur au lieu d'en ajouter une nouvelle : c'est là que tu corriges une
  faute de frappe, un mauvais lien ou une pièce mal choisie, sans dupliquer la donnée.

### Exemple complet : ajouter un composant, puis son prix

Situation : tu as trouvé une **RTX 5070** à 189 000 DZD chez un vendeur d'Alger.

**Étape 1 — le composant.** Onglet **Composants** de `admin.html` :

1. Famille : `gpu` (les champs techniques changent selon la famille choisie)
2. Nom : `NVIDIA GeForce RTX 5070`
3. Marque : `NVIDIA`
4. Slug : `rtx5070` (identifiant court, sans espace ni accent — il ne doit déjà pas exister)
5. Champs apparus pour un GPU : `tier` (1 à 5) et `vram` (Go) → par exemple `4` et `12`
6. **Enregistrer**

Le composant est écrit dans `components`, sans prix. Le site te le dit : « Composant ajouté sans
prix : saisis maintenant un prix sourcé dans l'onglet Prix. »

**Étape 2 — le prix.** Onglet **Prix** :

1. Composant : `NVIDIA GeForce RTX 5070` (la liste est groupée par famille)
2. Prix : `189000` · Devise : `DZD`
3. Source : `Nom de la boutique` — **obligatoire**, c'est ce qui prouve que le montant est réel
4. Lien de la fiche : l'URL du produit, si tu l'as
5. **Enregistrer**

**Étape 3 — vérifier.** Recharge `http://localhost/BuildWise-MySQL/` : la puce du bandeau indique
désormais « 1 prix sourcé », et SmartPrice affiche `189 000 DZD · Nom de la boutique · 10 nov. 2026`.
Le compteur « MESURES DE FPS » reste à 0 tant que tu n'as rien mesuré : c'est voulu.

**Le même résultat en SQL**, si tu préfères phpMyAdmin (onglet SQL de la base `buildwise`) :

```sql
-- 1. Le composant (le prix reste NULL : aucune donnée inventée)
INSERT INTO `components` (`slug`, `name`, `brand`, `category`, `specifications`)
VALUES ('rtx5070', 'NVIDIA GeForce RTX 5070', 'NVIDIA', 'gpu',
        JSON_OBJECT('tier', 4, 'vram', 12));

-- 2. Son prix, avec la source qui le rend crédible et le jour où tu l'as vu
INSERT INTO `component_prices` (`component_id`, `price`, `currency`, `source`, `source_url`, `verified_at`)
VALUES ((SELECT `id` FROM `components` WHERE `slug` = 'rtx5070'),
        189000, 'DZD', 'Nom de la boutique', 'https://exemple.dz/produit', '2026-11-10');

-- 3. Le prix de référence affiché par le site
UPDATE `components` SET `price` = 189000 WHERE `slug` = 'rtx5070';
```

En saisissant toi-même, tu n'as pas besoin de l'étape 3 : `admin.html` synchronise
`components.price` tout seul.

> Une saisie par SQL ne passe pas par les contrôles du backend. Si tu te trompes de `category`
> (`gpuu` au lieu de `gpu`) ou de nom de champ, MySQL acceptera la ligne mais le site ne la verra
> pas. `admin.html` reste la méthode recommandée.

---

## 9. Rôle de chaque fichier

### Le site (ce que voit le navigateur)

| Fichier | Rôle |
|---|---|
| `index.html` | la coquille du site : barre de navigation, conteneur, puis charge les scripts |
| `admin.html` | la page de saisie des prix / FPS / constats de compatibilité |
| `assets/css/styles.css` | le design d'origine, inchangé |
| `assets/css/admin.css` | la mise en forme de `admin.html` uniquement (le site ne la charge pas) |
| `assets/js/api.js` | **le seul fichier JavaScript qui parle au backend** : `API.get`, `API.post`, `API.del`. Toutes les requêtes passent par là |
| `assets/js/catalog.js` | les catégories de pièces et les filtres ; reçoit maintenant les composants venus de MySQL |
| `assets/js/views.js` | le dessin de chaque page (Builder, SmartPrice, FPS Range, Upgrade Path, Compatibility) |
| `assets/js/app.js` | le cœur : état de l'application, calculs, localStorage, et le chargement des données PHP au démarrage |
| `assets/js/admin.js` | toute la logique de la page d'administration |
| `_reference/BuildWise-original.html` | l'ancienne version, conservée pour comparaison. Le site ne l'utilise pas |

### Le backend PHP (sur le serveur uniquement)

| Fichier | Rôle |
|---|---|
| `backend/config.php` | les identifiants MySQL, la devise, et la fonction `db()` qui ouvre la connexion. Chez toi le mot de passe y est en clair (XAMPP : root, vide) ; **dès que `backend/env.php` existe, c'est lui qui fournit les vraies valeurs** |
| `backend/env.example.php` | le modèle à copier en `backend/env.php` sur un hébergeur : les identifiants MySQL restent ainsi séparés du code public. Apache refuse de le servir, et il ne part dans aucune ZIP |
| `backend/auth.php` | le verrou des écritures : session PHP, empreinte du mot de passe, jeton CSRF, et pause de 300 secondes après 5 erreurs |
| `backend/login.php` | la porte du mot de passe : `GET` = « suis-je connecté ? », `POST` = se connecter ou se déconnecter. La réponse ne dit jamais si le mot de passe était « presque » juste |
| `backend/admin-credentials.php` | **l'empreinte bcrypt du mot de passe d'administration, jamais le mot de passe lui-même** |
| `backend/new-password.php` | la page qui fabrique une empreinte neuve à coller dans le fichier ci-dessus ; elle ne s'ouvre que depuis ton ordinateur ou une session déjà connectée |
| `backend/helpers.php` | les outils communs : lecture du JSON reçu, réponse normalisée, requêtes préparées, validation des saisies, et la liste des spécifications autorisées par famille |
| `backend/components.php` | lit le catalogue (filtres par famille, marque, recherche, `id`, `slug`) et ajoute un composant ; l'action `summary` donne les compteurs affichés en haut du site |
| `backend/prices.php` | l'historique des prix : nouvel enregistrement (POST), **correction d'un relevé (PUT)**, liste par composant, suppression |
| `backend/benchmarks.php` | les mesures de FPS avec leur pièce associée, l'action `games` (jeux déjà mesurés) et l'action `stats` (moyenne/min/max par composant, plus le nombre de pièces associées différentes derrière la moyenne) |
| `backend/compatibility.php` | les règles techniques recalculées depuis les spécifications **+** les constats humains de la table `compatibility` |
| `backend/configurations.php` | enregistre un PC complet (plusieurs tables dans une transaction), liste les PC sauvegardés, en supprime un |
| `backend/check.php` | la page de diagnostic décrite à la [section 7](#7-vérifier-que-tout-fonctionne) |

### La base

| Fichier | Rôle |
|---|---|
| `database/buildwise.sql` | la structure complète (6 tables, clés, relations) + le catalogue de 32 composants + 44 règles de compatibilité. Ré-importable sans risque : il ne touche jamais aux prix ni aux mesures déjà saisis |
| `database/update-2026-11-10.sql` | la mise à jour du 10/11/2026 pour les bases importées **avant** cette date : ajoute `component_prices.verified_at` et `benchmarks.paired_component_id`. Que des `ADD COLUMN` : il ne supprime rien |
| `backups/buildwise_*.sql` | les sauvegardes complètes de ta base, horodatées. Voir `backups/README.md` pour la commande et la restauration |

Le chemin parcouru par une donnée, dans le sens de la lecture :

```
ton navigateur  →  assets/js/api.js  →  backend/*.php  →  config.php (PDO)  →  MySQL
                                                                        ↓
ton navigateur  ←  JSON {ok,data,meta}  ←  helpers.php  ←  la ligne demandée
```

---

## 10. Les 6 tables de la base

```
components ──1:N──> component_prices      (prix sourcés, avec historique)
components ──1:N──> benchmarks            (mesures de FPS)
components ──1:N──> benchmarks            (la pièce ASSOCIÉE du même test)
components ──N:M──> configurations        via configuration_components
components ──N:N──> components            via compatibility (les paires)
```

| Table | Colonnes principales | Ce qu'elle contient |
|---|---|---|
| `components` | `id`, `slug` (unique), `name`, `brand`, `category` (ENUM : cpu, board, gpu, ram, storage, psu, case, cooler), `price`, `specifications` (JSON), `image`, `created_at` | le catalogue, la table centrale |
| `component_prices` | `id`, `component_id` → `components.id`, `price`, `currency`, `source`, `source_url`, `verified_at` (le jour où le prix a été constaté), `updated_at` (le jour de la saisie) | un prix **observé** et d'où il vient. Plusieurs lignes par composant = l'historique |
| `benchmarks` | `id`, `component_id` → `components.id`, `paired_component_id` → `components.id` (l'autre pièce du test), `game`, `resolution`, `graphics_settings`, `fps`, `source`, `created_at` | une mesure réelle de FPS, avec son contexte processeur / carte graphique |
| `configurations` | `id`, `name`, `budget`, `usage`, `resolution`, `total_price`, `created_at` | un PC enregistré. `total_price` est calculé **par le serveur** |
| `configuration_components` | `id`, `configuration_id`, `component_id`, `quantity` (clé unique du couple) | quelles pièces sont dans quel PC |
| `compatibility` | `id`, `component_id`, `compatible_component_id`, `compatibility_status` (`compatible` / `incompatible` / `unknown`), `notes` | un constat humain sur une paire de pièces |

Détails importants :

* Toutes les tables sont en **InnoDB** et en **utf8mb4_unicode_ci** (accents et émojis compris).
* Chaque `component_id` est une **clé étrangère** avec `ON DELETE CASCADE` : impossible d'enregistrer
  un prix pour un composant qui n'existe pas, et supprimer un composant range automatiquement tout
  ce qui pointe vers lui. Seule exception : `benchmarks.paired_component_id` est en `ON DELETE
  SET NULL`, parce que retirer une pièce du catalogue ne doit jamais effacer une mesure de FPS déjà
  prouvée — la mesure garde sa valeur et perd seulement la mention de son contexte.
* L'autre règle d'une mesure (processeur ↔ carte graphique, jamais l'inverse, jamais la même pièce)
  est contrôlée dans `backend/benchmarks.php`, pas dans MySQL : une contrainte de « famille » ne
  s'écrit pas en SQL. Passer directement par phpMyAdmin pour saisir une mesure peut donc créer une
  ligne sans pièce associée ; le site l'affiche alors honnêtement comme un contexte manquant.
* `configurations.total_price` est **NULL** dès qu'une pièce du PC n'a pas de prix en base. Le site
  affiche alors « Total non calculé : une pièce n'a pas de prix en base » au lieu d'inventer un
  montant.

---

## 11. Les URL de l'API PHP

Tu peux tester n'importe laquelle directement dans la barre d'adresse du navigateur (GET).

**Lire est ouvert à tout le monde ; écrire demande le mot de passe.** Les lignes `POST`,
`PUT` et `DELETE` ci-dessous renvoient « Mot de passe administrateur demandé. » (HTTP 401)
à qui ne s'est pas connecté dans `admin.html`, puis « Jeton de sécurité absent ou périmé. »
(403) à une session sans jeton. Une seule écriture reste publique, volontairement :
`POST backend/configurations.php`, le bouton « Enregistrer mon PC » du visiteur.

```
GET    backend/components.php                        les 32 composants, avec leurs prix
GET    backend/components.php?category=gpu           filtré par famille
GET    backend/components.php?category=gpu&brand=NVIDIA   deux filtres à la fois
GET    backend/components.php?q=ryzen                recherche dans les noms
GET    backend/components.php?id=14                  un composant précis
GET    backend/components.php?slug=rtx4060           par son identifiant technique
GET    backend/components.php?action=summary         les compteurs du bandeau
POST   backend/components.php                        ajouter un composant

GET    backend/prices.php?component_id=14            tout l'historique d'un composant
POST   backend/prices.php                            nouveau prix (source + date de vérification obligatoires)
PUT    backend/prices.php                            rectifier un relevé (`{"id":3, …}`, sans dupliquer la ligne)
DELETE backend/prices.php?id=3                       supprimer un relevé

GET    backend/benchmarks.php?component_id=14        les mesures d'une pièce (avec leur pièce associée)
GET    backend/benchmarks.php?action=games           les jeux déjà mesurés
GET    backend/benchmarks.php?action=stats&game=Cyberpunk%202077&resolution=1080p&graphics_settings=high&category=gpu
                                                     moyenne / min / max par composant + nombre de pièces associées différentes
POST   backend/benchmarks.php                        ajouter une mesure (source obligatoire, et la pièce associée pour un CPU ou un GPU)
PUT    backend/benchmarks.php                        rectifier une mesure (`{"id":2, …}`)
DELETE backend/benchmarks.php?id=2                   supprimer une mesure

GET    backend/compatibility.php                     les derniers constats
GET    backend/compatibility.php?component_id=18     tout ce qui concerne une pièce
GET    backend/compatibility.php?a=1&b=9             l'état d'une paire
GET    backend/compatibility.php?ids=1,9,14,22       toutes les paires d'un PC
POST   backend/compatibility.php                     enregistrer ou corriger un constat
DELETE backend/compatibility.php?id=7                supprimer un constat

GET    backend/configurations.php                    les PC enregistrés
POST   backend/configurations.php                    sauvegarder un PC complet
DELETE backend/configurations.php?id=3               supprimer un PC
```

Toutes les réponses ont la même forme, ce qui simplifie le JavaScript :

```json
{ "ok": true,  "data": { … }, "meta": { "message": "…" } }
{ "ok": false, "error": { "message": "ce qui ne va pas", "hint": "ce qu'il faut faire" } }
```

---

## 12. Les deux règles du projet

Elles ne sont pas décoratives : le code les applique, et les tests les vérifient.

### Règle 1 — jamais de prix ni de FPS inventé

* Le fichier SQL laisse `component_prices` et `benchmarks` **vides**.
* `prices.php` et `benchmarks.php` **refusent** (HTTP 422) une saisie sans `source`.
* Une **date de vérification** dans le futur est refusée elle aussi : on ne constate un prix que le
  jour où on le voit.
* Une mesure de **processeur** ou de **carte graphique** sans l'autre pièce du test est refusée : un
  chiffre de FPS tout seul ne prouve rien.
* Une estimation impossible renvoie un message explicite ; les pages affichent « Non renseigné » ou
  « Estimation non disponible » — jamais un chiffre au hasard.
* Le total d'une configuration est calculé par le serveur et laissé **NULL** s'il manque un prix.
* Chaque montant affiché est accompagné de sa provenance (boutique, lien, date).

### Règle 2 — des requêtes préparées partout, et pas d'identifiants dans le JavaScript

* Chaque accès à MySQL passe par `prepare()` puis `execute([$valeur])` : la valeur n'est **jamais**
  collée dans le texte de la requête. C'est ce qui bloque les injections SQL — et le test
  `cyberpunk'; DROP TABLE components; --` est justement vérifié par `check.php`.
* `ATTR_EMULATE_PREPARES => false` : ce sont les **vraies** requêtes préparées de MySQL, pas une
  imitation de PHP.
* Les mots de passe, eux, restent dans `backend/config.php` — ou dans `backend/env.php` dès que
  le projet est hébergé — des fichiers que le navigateur ne peut pas lire. `check.php` le
  confirme, et `api.js` n'envoie que des URLs.
* Le mot de passe d'administration lui-même n'est écrit nulle part : seul son empreinte bcrypt
  vit dans `backend/admin-credentials.php`, et `admin.js` ne fait que le demander à l'écran pour
  le transmettre à `backend/login.php`.
* Le `.htaccess` de la racine ferme `/backups/`, `/database/`, `/_reference/`, tous les `.sql`,
  `backend/env.php` et `backend/admin-credentials.php`, et il désactive les listes de fichiers.
* Les noms de colonnes et de tables ne viennent jamais du navigateur : ils sont choisis dans le
  code PHP à partir de listes fixes.

---

## 13. Dépannage

### « Le site est ouvert en fichier local, sans serveur PHP »

Tu as ouvert `index.html` par double-clic. L'adresse commence par `file:///`, donc PHP ne tourne pas.
→ Ouvre `http://localhost/BuildWise-MySQL/` (il faut qu'Apache et MySQL soient démarrés).

### Apache ne démarre pas dans XAMPP

Un autre logiciel occupe le port 80. Dans le panneau XAMPP : **Config** (ligne Apache) →
`httpd.conf`, cherche `Listen 80` et remplace par `Listen 8080`, redémarre, puis utilise
`http://localhost:8080/buildwise/`. Rien d'autre à changer : toutes les URLs du site sont
relatives, elles suivent automatiquement le nouveau port.

### « Connexion à MySQL impossible » dans check.php

| Message affiché | Cause et solution |
|---|---|
| `Connection refused` / `Unknown server host` | MySQL n'est pas démarré → **Start** dans le panneau XAMPP |
| `Access denied for user 'root'` | le mot de passe de `root` n'est pas vide → écris-le dans `DB_PASSWORD` (`backend/config.php`) |
| `Unknown database 'buildwise'` | la base n'existe pas encore → importe `database/buildwise.sql` ([section 4](#4-créer-la-base-de-données)) |
| port différent | change `DB_PORT` (XAMPP : 3306 ; une installation MySQL séparée : souvent 3307) |

### « Extension pdo_mysql absente »

Ouvre `C:\xampp\php\php.ini`, cherche `;extension=pdo_mysql`, **enlève le `;`**, enregistre, puis
redémarre Apache. Fais pareil pour `;extension=mbstring` (le backend s'en sert pour compter les
caractères accentués de tes saisies).

### Le site affiche « Impossible de joindre la base » mais check.php est vert

Vide le cache du navigateur, puis recharge. Sinon, le dossier s'appelle peut-être autrement que
`BuildWise-MySQL` dans `htdocs` : l'URL `http://localhost/BuildWise-MySQL/backend/components.php`
doit renvoyer du JSON — c'est le test à faire en premier.

### Une réponse JSON « vide » ou illisible dans le navigateur

PHP a affiché un avertissement avant le JSON. Les messages d'erreur PHP ne s'affichent plus dans la
réponse (c'est réglé dans `config.php`) : ils partent dans le journal.
→ Panneau XAMPP → **Logs** → `php_error.log`, ou `C:\xampp\apache\logs\error.log`.

### « slug déjà utilisé » en ajoutant un composant

L'identifiant technique (`slug`) doit être unique : c'est ce qui protège le catalogue contre les
doublons à la ré-importation du SQL. Change le slug, ou modifie le composant existant à la place.

### Je veux repartir de zéro

Dans phpMyAdmin : sélectionne la base `buildwise` → **Opérations** → **Supprimer** la base, puis
réimporte `database/buildwise.sql`. Tes prix et tes FPS saisis seront perdus : recopie-les d'abord
depuis les onglets **Prix** et **Mesures FPS** de `admin.html`.

### Alternative sans XAMPP : le serveur PHP intégré

Depuis le dossier `BuildWise-MySQL`, une seule commande suffit si PHP est installé et MySQL tourne
déjà :

```
php -S 127.0.0.1:8000 -t .
```

Puis ouvre `http://127.0.0.1:8000/`. C'est pratique pour un essai rapide, mais c'est un serveur de
développement : pour travailler, garde XAMPP.

---

## 14. Et l'ancienne version hors ligne ?

Le dossier `BuildWise-Windows` (celui du ZIP d'origine, avec `BuildWise.html` et le lanceur
`Open BuildWise.cmd`) n'a **pas été modifié**. Il fonctionne toujours exactement comme avant, en
double-clic, sans PHP, sans MySQL et sans connexion.

Deux versions, deux usages :

| | `BuildWise-Windows` | `BuildWise-MySQL` (ce dossier) |
|---|---|---|
| Installation | aucune | XAMPP |
| Données | figées dans le JavaScript | base MySQL, modifiable via `admin.html` |
| Prix | aucun prix réel | les prix que tu as observés et sourcés |
| Usage | consultation rapide hors ligne | outil de travail, avec historique |

---

## Démarrage rapide (récapitulatif en 6 lignes)

1. Installe **XAMPP**, démarre **Apache** et **MySQL**.
2. Copie le dossier dans `C:\xampp\htdocs\BuildWise-MySQL`.
3. Importe `database/buildwise.sql` dans phpMyAdmin.
4. Vérifie les 5 lignes de `backend/config.php` (par défaut : rien à changer).
5. Ouvre `http://localhost/BuildWise-MySQL/backend/check.php` → tout doit être vert.
6. Ouvre `http://localhost/BuildWise-MySQL/admin.html` et saisis tes premiers prix et FPS sourcés.
