# BUILDWISE — Présentation du projet

*Document de présentation — projet web PHP / MySQL / JavaScript*

| | |
|---|---|
| **Nom du projet** | BuildWise 2.0 |
| **Type** | Plateforme web d'aide au choix et à l'amélioration de configurations informatiques |
| **Site en ligne** | https://buildwise.xo.je |
| **Code source** | https://github.com/mido007rk-0/buildwise- |
| **Version documentée** | commit `4034d38` — « BuildWise 2.0 — PHP + MySQL, version publiable » |

> **Note de méthode.** Tout ce qui est affirmé dans ce document a été relu dans le code du dépôt :
> les technologies, le nombre de pages, le nombre de tables et le contenu réel des données. Là où une
> fonctionnalité est présente mais en attente de données, cela est dit explicitement (section 5).

---

## 1. Introduction et présentation générale

**BuildWise** est une plateforme web destinée à aider les utilisateurs à **choisir, comparer et faire
évoluer leur configuration informatique**. Elle rassemble, dans une seule interface, un ensemble
d'outils d'aide à la décision : composition d'un PC, consultation des prix, estimation des
performances, vérification de compatibilité, diagnostic et recommandations d'évolution.

Le constat de départ est simple : le choix des composants d'un ordinateur est une opération technique
qui suppose de croiser beaucoup d'informations — socket d'un processeur, génération d'une carte
graphique, type de mémoire, capacité d'alimentation, encombrement du boîtier, prix constatés chez les
revendeurs, mesures de performances dans les jeux. Pour une personne qui ne possède pas de
connaissances approfondies en matériel, cette mise en relation est difficile, et elle est rarement
documentée de manière centralisée et à jour.

BuildWise répond à ce besoin en proposant une démarche **plus simple, plus claire et plus accessible**.
L'application compte **onze pages** : une page d'accueil et dix outils spécialisés, tous reliés à une
même base de données. Le design, la navigation et les formulaires ont été conservés dans leur forme
d'origine ; la version 2.0 apporte surtout le passage des données en base.

Une caractéristique distingue BuildWise d'un comparateur classique : **le projet s'interdit
d'inventer une donnée.** Un prix qui n'a pas été observé chez un revendeur n'est pas affiché, une
mesure de FPS qui n'a pas été relevée n'est pas estimée. Les pages concernées affichent alors la
mention « Prix non renseigné » ou « Estimation non disponible ». Cette règle est appliquée par le
backend et documentée dans le README du projet ; elle explique plusieurs états visibles sur le site,
que la section 5 décrit précisément.

---

## 2. Problématique

Lorsqu'une personne souhaite acheter ou améliorer un ordinateur, elle rencontre un ensemble de
difficultés qui, mises bout à bout, transforment un achat ordinaire en décision risquée :

| Difficulté | Conséquence si elle n'est pas traitée |
|---|---|
| Choisir des composants adaptés à son usage réel | Configuration surdimensionnée, ou insuffisante dès le premier mois |
| Vérifier la compatibilité matérielle : socket du processeur, type de mémoire, format et puissance de l'alimentation, encombrement du boîtier | Pièces achetées qui ne peuvent pas être assemblées ; retour, perte de temps et d'argent |
| Respecter un budget | Dépassement non anticipé, ou arbitrage fait sans connaître le coût réel |
| Estimer les performances possibles dans les jeux | Attentes déçues face à un chiffre de marketing non contextualisé |
| Savoir quels composants améliorer en priorité | Remplacement de la pièce la moins limitante, investissement mal employé |

Ces difficultés tiennent moins à l'absence d'information qu'à son **éparpillement** : les
caractéristiques techniques sont sur les fiches des fabricants, les prix sur les boutiques, les
mesures de performances sur des tests spécialisés, et la compatibilité dans des forums. L'utilisateur
doit lui-même croiser ces sources, alors que c'est précisément ce croisement qui est difficile.

**BuildWise cherche à répondre à ces problèmes en centralisant l'information dans une seule base, et
en rendant chaque calcul traçable jusqu'à sa source.**

---

## 3. Objectifs du projet

Les objectifs poursuivis, dans l'ordre donné par le cahier des charges :

1. **Faciliter la création d'une configuration PC** en proposant une sélection guidée, famille par
   famille de composants, avec un total recalculé à chaque modification.
2. **Aider au choix de composants adaptés à l'utilisation** visée — jeu, bureautique, création de
   contenu — plutôt qu'au meilleur composant pris isolément.
3. **Donner des indications sur la compatibilité matérielle**, en combinant des règles techniques
   recalculées à partir des fiches et des constats d'expérience enregistrés en base.
4. **Aider à mieux gérer le budget**, en affichant un prix sourcé — boutique, lien, date de
   vérification — et un historique qui permet de suivre l'évolution d'un tarif.
5. **Fournir des estimations de performances** à partir de mesures réellement relevées, et non d'un
   modèle théorique.
6. **Accompagner l'évolution d'une machine existante**, en identifiant les composants dont le
   remplacement améliore le plus la configuration.

Un objectif transversal mérite d'être isolé parce qu'il structure une partie du code :
**garantir l'honnêteté de l'information affichée.** Concrètement, le backend refuse toute saisie de
prix ou de mesure sans source (erreur HTTP 422), refuse une date de vérification future, et le total
d'une configuration reste vide dès qu'une pièce n'a pas de prix en base.

---

## 4. Public cible

BuildWise s'adresse à des publics dont le niveau technique est très variable, ce qui impose une
interface compréhensible sans documentation :

| Public | Besoin principal | Réponse apportée |
|---|---|---|
| **Joueurs** construisant un PC gaming | Savoir quelle carte graphique et quel processeur choisir pour une résolution et une fluidité cibles | PC Builder, FPS Range, Resolution Advisor |
| **Étudiants en informatique** | Comprendre les contraintes matérielles et disposer d'un support concret | Catalogue technique, vérification de compatibilité, Bottleneck Explainer |
| **Acheteurs d'un premier ordinateur** | Ne pas se tromper et ne pas payer trop cher | SmartPrice, GoalMatch |
| **Créateurs de contenu** | Dimensionner mémoire et stockage au-delà du seul cas du jeu | Objectifs par usage, fiches de composants |
| **Utilisateurs faisant évoluer leur machine** | Améliorer la pièce qui limite réellement la configuration | Upgrade Path, PC Doctor |
| **Passionnés de matériel** | Disposer de données sourcées et consultables | Historique des prix, mesures et constats en base |

---

## 5. Fonctionnalités principales

Les dix outils décrits ci-dessous correspondent aux dix pages fonctionnelles du site, la onzième
étant la page d'accueil. Cette liste reprend exactement les routes déclarées dans le code, aux lignes
17 à 29 de `assets/js/app.js`.

Un **tableau de synthèse en fin de section** indique, pour chacune, ce qui fonctionne et ce qui reste
en attente de données. Cette précision est volontaire : plusieurs outils affichent aujourd'hui un état
vide, non pas à cause d'un défaut d'affichage, mais parce que la table qui les alimente ne contient
encore aucune mesure.

### 5.1 PC Builder

Permet de construire une configuration en sélectionnant, pour chaque famille, un composant du
catalogue : processeur, carte mère, carte graphique, mémoire, stockage, alimentation, boîtier et
refroidissement. Le total est recalculé à chaque changement.

Les composants et les prix proviennent de la base MySQL. Un composant dont le prix n'a pas été
constaté affiche la mention « Prix non renseigné » au lieu d'une valeur estimée ; le total peut rester
partiel, et le code distingue alors les lignes issues de la base de celles saisies manuellement par
l'utilisateur. Une configuration peut être enregistrée, sur le poste local et en base — le total
calculé par le serveur restant vide si une pièce manque de prix.

**État :** opérationnel pour le catalogue, la sélection et le calcul du total.

### 5.2 SmartPrice

Permet de consulter les prix des composants afin de préparer un budget. Chaque ligne indique le
montant, la devise, la boutique ou la source, le lien de la fiche produit et la date à laquelle le
prix a été constaté. L'historique des relevés reste consultable, et le prix de référence affiché est
celui dont la date de vérification est la plus récente.

**État :** opérationnel, avec une couverture partielle et assumée. La base contient **20 prix
vérifiés**, portant sur les 6 processeurs et les 6 cartes graphiques du catalogue. Les vingt lignes
génériques restantes — carte mère, mémoire, stockage, alimentation, boîtier, refroidissement, qui
n'ont pas de marque ni de modèle précis — affichent volontairement « Prix non renseigné ».

### 5.3 Upgrade Path

Aide l'utilisateur à réfléchir aux améliorations possibles de sa configuration actuelle, en
présentant les options existant en base pour une même famille de composants.

**État :** la partie « prix des options » est alimentée par MySQL, et une famille sans prix enregistré
affiche une carte « Aucun prix en base ». Les cartes de conseil de cette page sont en revanche des
**recommandations qualitatives écrites dans le JavaScript** : elles orientent le raisonnement mais ne
sont pas le résultat d'un calcul sur les données. Le volet chiffré — le gain de performance attendu
d'une amélioration — dépend des mesures de FPS et reste donc non calculable, comme en 5.4.

### 5.4 FPS Range

Propose une estimation des performances en images par seconde selon la configuration retenue, pour un
jeu, une résolution et un niveau de détails graphiques donnés.

**État :** la fonctionnalité est **entièrement développée, côté interface et côté serveur**, mais
**aucun chiffre de FPS ne s'affiche aujourd'hui**, et c'est conforme à la règle du projet. Le calcul
lit la table `benchmarks`, qui contient **0 ligne** : aucune mesure de FPS n'a encore été relevée avec
une source. La page affiche donc le message « Estimation non disponible » renvoyé par le backend, et
il n'existe aucun mécanisme d'estimation de repli dans le JavaScript. Elle redeviendra chiffrée dès
que des mesures sourcées auront été saisies dans l'onglet « Mesures FPS » de l'interface
d'administration.

### 5.5 Vérification de compatibilité

Permet de vérifier la compatibilité entre les composants d'une configuration. Le mécanisme combine
deux sources distinctes :

* des **règles techniques recalculées** à partir des caractéristiques stockées en base — socket du
  processeur, type de mémoire, format des composants — lues dans le champ `specifications` de type
  JSON de la table `components` ;
* des **constats d'expérience** enregistrés dans la table `compatibility`, qui signalent par exemple
  un BIOS à mettre à jour, une carte graphique trop longue ou un ventilateur de processeur gênant.

**État :** opérationnel. La base contient **44 constats de compatibilité**. Plusieurs contrôles
affichés retournent volontairement l'état « inconnu » tant qu'aucune observation humaine n'a été
enregistrée pour la paire concernée : le projet préfère ne pas se prononcer plutôt que déduire une
compatibilité non documentée.

### 5.6 Bottleneck Explainer

Aide à comprendre les déséquilibres possibles de performances entre un processeur et une carte
graphique : quand l'un des deux composants bride le potentiel de l'autre, le système est limité par le
plus faible.

**État :** **fonctionnalité explicative, en attente de données.** Les deux sélecteurs de composants
lisent bien le catalogue MySQL, mais l'analyse affichée est un **texte pédagogique descriptif écrit
dans l'interface** : elle n'appelle pas le backend et ne produit pas de pourcentage de bridage
chiffré. Cette page doit donc être présentée comme une explication du phénomène, et non comme une
mesure.

### 5.7 PC Doctor

Propose une aide à l'analyse d'une configuration et à l'identification des points à améliorer, sous
forme de questions successives qui orientent le diagnostic.

**État :** la fonctionnalité est **entièrement locale et indépendante de la base de données**.
L'arbre de questions est défini dans le JavaScript (`assets/js/catalog.js`, lignes 36 à 44) et la
progression est conservée dans le stockage local du navigateur. Elle fonctionne donc aussi sans accès
à MySQL, mais elle ne tire pas parti, aujourd'hui, des données du catalogue : c'est un point identifié
pour les évolutions futures.

### 5.8 GoalMatch

Aide à orienter le choix d'une configuration selon l'utilisation souhaitée, en associant un usage —
jeu, bureautique, création — à une famille de composants et à une enveloppe budgétaire.

**État :** mixte, et à signaler comme tel. Les textes d'orientation sont **écrits dans l'interface**,
non calculés. Les deux parties qui touchent aux données sont, elles, honnêtes : la section budgétaire
vérifie si des prix existent en base et affiche « Aucun prix en base » sinon, et la mention relative
aux performances vérifie le nombre réel de mesures enregistrées avant de se montrer affirmative.

### 5.9 Deux pages complémentaires

Le site expose en outre deux pages qui ne figuraient pas dans la liste demandée, et qui font partie
des onze pages annoncées :

* **Resolution Advisor** — compare le rendu et la charge graphique selon la carte graphique, le jeu,
  la résolution de l'écran et une fluidité cible de 60, 120, 144 ou 240 images par seconde. Les
  sélecteurs lisent le catalogue ; les cartes de résultat sont descriptives.
* **Game Settings** — propose des points de départ de réglages graphiques (textures, ombres,
  anti-aliasing, ray tracing, technique d'upsampling) selon la priorité retenue : fluidité, équilibre
  ou qualité visuelle, en tenant compte de la mémoire vidéo disponible. Les profils sont écrits dans
  l'interface, et la page indique elle-même qu'il s'agit de réglages à tester et non de gains garantis.

### 5.10 Synthèse de l'état réel des fonctionnalités

| Page | Alimentation en données | État relevé dans le code |
|---|---|---|
| Accueil | MySQL (compteurs) | opérationnel, affiche des compteurs réels |
| PC Builder | MySQL + calcul local | opérationnel |
| SmartPrice | MySQL | opérationnel, 20 prix sourcés sur 32 composants |
| Upgrade Path | MySQL + texte local | partiellement chiffré : prix réels, conseils qualitatifs |
| FPS Range | MySQL, table `benchmarks` | **développé, aucun chiffre** : 0 mesure relevée |
| Vérification de compatibilité | MySQL + règles locales | opérationnel, 44 constats en base |
| Bottleneck Explainer | catalogue MySQL, texte local | **explicatif, non chiffré** |
| PC Doctor | local uniquement | opérationnel, hors base |
| GoalMatch | texte local, contrôles MySQL | **orientations écrites**, données vérifiées |
| Resolution Advisor | catalogue MySQL, cartes locales | descriptif |
| Game Settings | catalogue MySQL, profils locaux | descriptif, gains non garantis |

Une lecture verticale de ce tableau donne le véritable équilibre du projet : **la chaîne de données est
en place et fonctionne ; ce qui manque aujourd'hui est l'alimentation en mesures réelles, non le
code.**

---

## 6. Technologies utilisées

Le développement de BuildWise repose sur les technologies suivantes, toutes vérifiables dans le dépôt :

| Technologie | Utilisation | Preuve dans le dépôt |
|---|---|---|
| **HTML** | Structure des pages web | `index.html` (coquille et navigation), `admin.html` (interface d'administration) |
| **CSS** | Mise en forme et design | `assets/css/styles.css` (site), `assets/css/admin.css` (administration) |
| **JavaScript** | Interactions et fonctionnalités côté utilisateur | 5 fichiers dans `assets/js/` : `api.js`, `catalog.js`, `views.js`, `app.js`, `admin.js` |
| **PHP** | Traitement des données côté serveur | 13 fichiers dans `backend/`, en PHP procédural avec l'extension PDO |
| **MySQL / MariaDB** | Stockage et gestion des données | `database/buildwise.sql`, 6 tables en InnoDB / utf8mb4 |
| **Apache** | Serveur web qui exécute le PHP | `.htaccess` à la racine et ses règles de protection |
| **Git** | Gestion des versions du projet | historique du dépôt |
| **GitHub** | Hébergement du code source | https://github.com/mido007rk-0/buildwise- |

Trois précisions techniques, qui ont un poids dans une soutenance :

* **Version minimale réelle : PHP 8.0.** Ce n'est pas une intuition : le diagnostic
  `backend/check.php`, ligne 53, teste explicitement cette version, et le code emploie la syntaxe
  `match`, apparue en PHP 8.0. L'environnement de développement est PHP 8.2.12 avec MariaDB 10.4.32.
* **Extensions PHP obligatoires :** `pdo_mysql` pour l'accès à la base et `mbstring` pour le comptage
  des caractères accentués (`backend/check.php`, lignes 54 à 56).
* **Aucun framework, aucune bibliothèque externe.** Il n'y a ni `composer.json`, ni dossier `vendor/`,
  ni dépendance JavaScript : l'application est écrite en code direct. Le dépôt contient bien
  `environment.yml` et `requirements.txt`, mais ils ne listent **aucune** bibliothèque Python, parce
  qu'aucun fichier Python n'existe dans le projet.

Le point technique le plus structurant reste la sécurité d'accès aux données. **Toutes les requêtes
passent par des requêtes préparées** (`prepare()` puis `execute()` avec la valeur passée à part), avec
l'option `ATTR_EMULATE_PREPARES => false`, ce qui utilise les vraies requêtes préparées de MySQL et non
une imitation par PHP. Le diagnostic du projet teste d'ailleurs qu'une tentative d'injection SQL est
neutralisée. Les identifiants de base ne figurent dans aucun fichier accessible au navigateur : le
JavaScript ne fait qu'appeler des URL du backend.

---

## 7. Architecture et fonctionnement du système

BuildWise suit une architecture web classique à trois étages, dans laquelle chaque étage a une
responsabilité délimitée.

```
ton navigateur  →  assets/js/api.js  →  backend/*.php  →  config.php (PDO)  →  MySQL
                                                                      ↓
ton navigateur  ←  JSON {ok,data,meta}  ←  helpers.php  ←  la ligne demandée
```

### 7.1 Interface utilisateur (HTML, CSS, JavaScript)

Elle présente les onze pages, recueille les sélections et affiche le résultat des requêtes. Elle ne
contient **aucune donnée de référence en dur** : le catalogue est demandé au serveur. Toutes les
requêtes passent par un fichier unique, `assets/js/api.js`, qui expose les fonctions `API.get`,
`API.post` et `API.del`. Cette concentration est un choix : elle empêche qu'un fichier d'affichage
accède directement à la base, ce que le navigateur de toute façon ne sait pas faire.

### 7.2 Partie serveur (PHP)

Les points d'entrée exposent les fonctions du site, chacun sur son domaine : le catalogue et les
compteurs (`components.php`), l'historique des prix (`prices.php`), les mesures de FPS
(`benchmarks.php`), la compatibilité (`compatibility.php`), l'enregistrement des configurations
(`configurations.php`), plus l'authentification (`login.php`, `auth.php`, `new-password.php`) et le
diagnostic (`check.php`). Une bibliothèque commune, `helpers.php`, centralise la lecture du JSON reçu,
la normalisation des réponses, les requêtes préparées et la validation des saisies.

Les réponses ont toutes la même forme, ce qui simplifie le traitement côté client :

```json
{ "ok": true,  "data": { … }, "meta": { "message": "…" } }
{ "ok": false, "error": { "message": "ce qui ne va pas", "hint": "ce qu'il faut faire" } }
```

Les écritures sont protégées : session PHP, mot de passe vérifié par empreinte bcrypt, jeton CSRF, et
blocage temporaire de 300 secondes après cinq tentatives ratées. Seule une écriture reste publique,
volontairement : l'enregistrement d'une configuration depuis le site.

### 7.3 Base de données (MySQL)

Six tables, toutes en InnoDB et en jeu de caractères `utf8mb4_unicode_ci` :

| Table | Contenu |
|---|---|
| `components` | le catalogue, table centrale : identifiant technique, nom, marque, famille, prix de référence et caractéristiques en JSON |
| `component_prices` | les prix **observés** avec leur source et leur date de vérification ; plusieurs lignes par composant forment l'historique |
| `benchmarks` | les mesures de FPS avec le contexte du test — la pièce associée est obligatoire pour un processeur ou une carte graphique |
| `configurations` | les PC enregistrés, avec un total calculé par le serveur |
| `configuration_components` | table de liaison entre un PC et ses pièces |
| `compatibility` | les constats humains sur une paire de composants |

Les relations sont garanties par **7 clés étrangères**. Six sont en `ON DELETE CASCADE` : supprimer un
composant range automatiquement ses prix, ses mesures et ses liens, ce qui rend une ligne orpheline
impossible. La septième, `benchmarks.paired_component_id`, est en `ON DELETE SET NULL` pour une raison
qui mérite d'être signalée comme un choix de conception : retirer une pièce du catalogue ne doit
jamais effacer une mesure de FPS déjà prouvée ; la mesure conserve sa valeur et perd seulement la
mention de son contexte.

Le diagnostic `backend/check.php` contrôle l'installation : version de PHP, extensions, connexion,
existence des six tables, nombre minimal de lignes, clés étrangères, puis un vrai cycle
écriture-lecture-modification-suppression exécuté dans une transaction annulée à la fin, donc sans
laisser de trace en base. Le README d'installation du projet en annonce **31 points** contrôlés.

---

## 8. Outils de développement

| Outil | Rôle dans le projet |
|---|---|
| **Qoder** | assistance au développement, à la génération et à la modification du code |
| **Visual Studio Code** | environnement de travail sur les fichiers du projet |
| **XAMPP** | environnement local exécutant Apache, PHP et MySQL |
| **phpMyAdmin** | interface de gestion et d'import de la base de données |
| **Git / GitHub** | gestion des versions et publication du code source |

L'environnement local de référence est un XAMPP avec PHP 8.2.12 et MariaDB 10.4.32, Apache sur le port
80 et MySQL sur le port 3306. La base de développement est importée depuis `database/buildwise.sql`,
qui recrée les tables et le catalogue de façon ré-exécutable sans risque : les insertions sont
protégées, une ligne déjà présente est ignorée, et aucune donnée saisie localement n'est écrasée.

**Assistance par intelligence artificielle.** Le projet a été développé avec l'aide d'outils
d'assistance à la programmation, pour la génération de code, la relecture et la compréhension de
certains mécanismes. Cette aide a notamment servi à écrire la couche PHP d'accès aux données, le
dispositif d'authentification et la page de diagnostic. Elle est signalée ici explicitement, parce
qu'elle fait partie de la méthode de travail et des compétences mises en pratique.

*Complément, pour mémoire :* le dépôt contient aussi `environment.yml` et `requirements.txt`, qui
documentent un environnement virtuel **Conda** nommé `buildwise`. Son rôle est strictement limité à
l'outillage Python de développement ; il n'intervient ni dans l'exécution du site, ni dans PHP, Apache
ou MySQL.

---

## 9. Hébergement et diffusion

### 9.1 Site web — https://buildwise.xo.je

Le projet est en ligne sur un hébergement mutualisé PHP / MySQL. L'hébergeur place sur les pages une
vérification JavaScript destinée à filtrer les robots : un navigateur ordinaire la franchit
automatiquement et affiche l'application, alors qu'un outil de ligne de commande sans en-tête de
navigateur est interrompu par le serveur avant d'avoir reçu la page. Le site répond bien en HTTP 200 à
une requête de navigateur réel.

Le fichier `database/buildwise-en-ligne.sql` est la version préparée pour l'hébergement : deux lignes
`SET TIME_ZONE`, incompatibles avec les MySQL mutualisés, y sont neutralisées, et la base en ligne est
volontairement **sans aucune donnée personnelle** — les configurations enregistrées sur le poste local
n'ont pas été publiées.

Deux réglages distinguent l'environnement en ligne de l'environnement local. Les identifiants MySQL
réels ne sont pas dans le code public : ils sont lus depuis un fichier `backend/env.php` créé sur
l'hébergeur, absent du dépôt et refusé par Apache ; sans lui, `config.php` conserve les valeurs par
défaut de XAMPP, et l'installation locale continue de fonctionner à l'identique. Le mot de passe
d'administration en ligne est, lui, réglé par son **empreinte bcrypt** — le mot de passe lui-même
n'est écrit dans aucun fichier publié. Un fichier `.htaccess` ferme enfin l'accès aux répertoires
`backups/`, `database/` et `_reference/`, à tous les fichiers `.sql` et aux fichiers
`backend/env.php` et `backend/admin-credentials.php`.

### 9.2 Code source — https://github.com/mido007rk-0/buildwise-

Le dépôt est public. Il contient l'intégralité du code, les scripts SQL d'installation, le README
d'installation et le présent document. Les fichiers d'identifiants réels en sont exclus par
`.gitignore`.

### 9.3 Réseau social — Instagram

Une présence sur Instagram est **envisagée** comme canal de communication, pour présenter le projet et
ses fonctionnalités au public intéressé par l'informatique et le matériel PC. Ce canal fait partie des
intentions de diffusion et n'est pas présenté ici comme un acquis.

---

## 10. Perspectives d'évolution et améliorations futures

Les évolutions possibles se répartissent en deux groupes : celles qui relèvent de la **donnée**, et
celles qui relèvent du **périmètre fonctionnel**. Cette distinction reprend directement l'état mesuré
en section 5.10.

### 10.1 Priorité : alimenter ce qui est déjà programmé

C'est le point le plus rentable, parce que le code existe déjà et n'attend que des données :

1. **Relever des mesures de FPS sourcées** pour remplir la table `benchmarks`, aujourd'hui vide. Cette
   seule action fait passer FPS Range, le volet chiffré d'Upgrade Path, le ratio de performances du
   comparateur et la mention de GoalMatch de l'état « non disponible » à un résultat réel.
2. **Étoffer les prix vérifiés** au-delà des 12 composants actuellement couverts, puis traiter les
   lignes génériques, ce qui demande un relevé à l'unité chez un revendeur.
3. **Enregistrer les constats de compatibilité** qui manquent pour les paires laissées en état
   « inconnu ».

### 10.2 Évolutions fonctionnelles

* **Rendre le Bottleneck Explainer calculé** plutôt que descriptif, en déterminant un indicateur de
  bridage à partir de mesures réelles plutôt qu'un texte d'explication.
* **Brancher PC Doctor sur la base de données**, afin que ses questions s'appuient sur les
  caractéristiques réelles des composants au lieu d'un arbre figé dans le JavaScript.
* **Faire de même pour GoalMatch, Resolution Advisor et Game Settings**, dont les recommandations sont
  pour l'instant écrites dans l'interface.
* **Enrichir le catalogue de composants** et actualiser régulièrement les prix, avec une alerte sur les
  relevés trop anciens.
* **Améliorer la précision des estimations** à mesure que les mesures deviennent suffisantes pour
  dégager des moyennes plutôt qu'un point isolé.
* **Ajouter de nouveaux outils de comparaison** entre configurations, en profitant de l'historique des
  prix déjà stocké.
* **Étendre les fonctionnalités d'aide à l'évolution** d'une machine existante, à partir des données
  d'upgrade et de compatibilité.
* **Améliorer l'expérience utilisateur** : navigation, clarté des messages, reprise plus souple d'une
  configuration enregistrée sur un autre poste.

### 10.3 Contraintes à garder en tête

L'hébergement utilisé est gratuit : le serveur peut suspendre temporairement un site qui reçoit une
pointe de trafic, et l'envoi de messagerie sortante, l'accès en ligne de commande ainsi que la
sauvegarde automatique de la base y sont indisponibles. Les sauvegardes sont donc faites à la main
depuis phpMyAdmin, et la source de vérité demeure la base locale sous XAMPP. Ces limites connues
expliquent aussi le rythme de mise à jour des prix, qui reste manuel.

---

## 11. Conclusion

BuildWise est un projet dont l'objectif est de **simplifier le choix et l'amélioration des
configurations informatiques**. En réunissant dix outils dans une seule plateforme, reliés à une base
MySQL commune et à un backend PHP, il permet à l'utilisateur de mieux comprendre ses besoins, de
comparer des composants sur des critères techniques et financiers, et de prendre des décisions plus
réfléchies avant un achat.

Le projet présente un intérêt particulier par sa **règle de non-invention**. Un prix non observé n'est
pas affiché, une mesure absente n'est pas simulée, un total incomplet reste vide. Ce choix a un coût
visible : plusieurs pages affichent aujourd'hui la mention « non renseigné » ou « estimation non
disponible ». Il a aussi un bénéfice, plus important dans un travail académique — chaque chiffre que
BuildWise montre peut être rattaché à une source, une boutique et une date, et le tableau de la
section 5.10 permet de distinguer précisément ce qui est en place, ce qui est écrit mais descriptif,
et ce qui attend uniquement d'être alimenté.

Sur le plan de la formation, ce projet a permis de mettre en pratique des compétences dans plusieurs
domaines complémentaires : le **développement web** avec HTML, CSS et JavaScript, la **programmation
côté serveur** en PHP avec PDO et des requêtes préparées, la **conception de bases de données**
relationnelles avec ses clés étrangères, ses transactions et ses règles d'intégrité, la **sécurité**
avec l'authentification, la protection contre l'injection SQL et la séparation des identifiants, la
**gestion de versions** avec Git et GitHub, et enfin la **mise en ligne** sur un hébergement mutualisé,
avec tout ce que cela suppose de différences à traiter entre un environnement local et un serveur
distant.

L'utilisation d'outils de développement assistés par intelligence artificielle a facilité certaines
étapes de production et de compréhension du code ; elle n'a pas dispensé de la vérification, puisque
chaque affirmation de ce document correspond à un fichier et à un état de base contrôlés dans le dépôt.
