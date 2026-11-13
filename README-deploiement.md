# Mettre BuildWise en ligne — guide pas à pas (hébergeur InfinityFree)

> **Ce que tu vas obtenir :** une adresse publique `https://tonnom.infinityfreeapp.com`,
> ouverte à ton professeur et à tes camarades depuis n'importe quel ordinateur ou téléphone,
> sans XAMPP. La base MySQL de ton ordinateur, elle, ne bouge pas : elle reste ta source.

Ce guide est écrit pour quelqu'un qui débute. Chaque étape dit **ce que tu fais**,
**ce que tu dois voir**, et **que faire si tu ne le vois pas**.

Le temps réel, une fois habitué : environ 40 minutes. La première fois : compte 1 h 30,
sans stress, et arrête-toi quand tu veux — rien n'est irréversible.

---

## 0. Ce que tu as dans les mains

Dans le dossier `deploiement-infinityfree/` :

| Fichier | À quoi il sert |
|---|---|
| **`ETAPES-FINALES.md`** | **Ce que tu suis aujourd'hui.** Les 7 étapes à plat, sans FileZilla et sans extraction. |
| **`A-TELEVER/`** | **Les 21 fichiers à déposer dans `htdocs`**, plus `.htaccess`, son jumeau `htaccess.txt` et les secours `si-filtre-refuse/`. Déjà réglés : identifiants MySQL (sauf le mot de passe), empreinte du nouveau mot de passe d'administration. |
| `SANS-DOSSIERS/` | Le même contenu, régénérable, sans aucune empreinte : la source de `A-TELEVER/`. |
| `CLES/` | Ton mot de passe d'administration en clair et son empreinte. **Jamais téléversé, jamais publié.** |
| `FINAL/` | Les 4 ZIP de la méthode du 13/11 après-midi. Périmées : ton panneau n'a pas d'« Extract ». |
| `buildwise-en-ligne.sql` | La base à importer dans phpMyAdmin : la structure des 6 tables, les 32 composants, les 44 constats de compatibilité et les 20 prix vérifiés. **Vide de toute donnée personnelle.** |
| `site/` | Le projet avec ses dossiers `assets/` et `backend/`, en clair, pour que tu vérifies toi-même. |

Ce qui reste **volontairement hors** de tout ce qui part sur le serveur (jamais dans un
dossier téléversable) : `backups/` (tes exports SQL, qui contiennent tes deux
configurations personnelles) et `_reference/` (la copie du BuildWise original).

Trois choses sont **volontairement absentes** de la ZIP :

- `backups/` — tes exports SQL, qui contiennent tes deux configurations personnelles ;
- `_reference/` — la copie du BuildWise original ;
- `backend/env.php` — tes identifiants MySQL en ligne : tu le créeras **sur l'hébergeur**,
  à la main, à l'étape 6. C'est ce qui garde les secrets hors du code public.

Un autre fichier, lui, est bien dans la ZIP mais **vidé** : `backend/admin-credentials.php`
ne contient aucune empreinte de mot de passe. Sans elle, l'administration en ligne reste
fermée pour tout le monde ; tu la remplis toi-même à l'**étape 6 bis**.

Un fichier est présent et travaille pour toi : **`.htaccess`** (tout au début de la liste,
avec un point devant). Il dit à Apache de refuser `/backups/`, `/database/`, `/_reference/`,
tous les `.sql`, `backend/env.php`, `backend/admin-credentials.php`, les éventuels
`install*.php` et ce guide-ci (`README-deploiement.md`) : il explique où sont les fichiers
sensibles, il n'a donc rien à faire lu par un visiteur.
Testé avant l'emballage : le site répond 200, ces adresses répondent 403.

---

## 0 bis. La fiche à remplir (papier ou fichier texte, jamais dans le site)

Prends-la avec toi pendant les étapes 1 à 6. Chaque ligne te sera demandée une fois,
et tu en auras besoin plus tard pour sauvegarder ou réparer.

| # | Ce que c'est | Où tu le trouves | Valeur |
|---|---|---|---|
| 1 | identifiant de connexion InfinityFree | étape 1 | ____________________ |
| 2 | mot de passe du compte InfinityFree | étape 1 | ____________________ |
| 3 | e-mail du compte | étape 1 | ____________________ |
| 4 | adresse de ton site | étape 2 | `____________________.infinityfreeapp.com` |
| 5 | identifiant FTP (= du compte d'hébergement) | étape 2 | ____________________ |
| 6 | mot de passe FTP | étape 2 | ____________________ |
| 7 | nom complet de la base MySQL | étape 3 | `epiz___________` |
| 8 | utilisateur MySQL | étape 3 | ____________________ |
| 9 | mot de passe MySQL | étape 3 | ____________________ |
| 10 | **MySQL Host** (`sql_____.epizy.com`) | étape 3 | ____________________ |
| 11 | mot de passe de l'administration BuildWise | étape 6 bis | ____________________ |

Les lignes 8, 9 et 10 sont exactement les valeurs que tu colleras dans `env.php`
(étape 6). La ligne 11 ne va **jamais** dans un fichier du site : seul son empreinte
est collée dans `admin-credentials.php`.

---

## 1. Créer le compte (5 min) — **c'est toi qui le fais, pas moi**

1. Va sur **https://www.infinityfree.com** et clique sur **« Sign Up »** (en haut à droite).
2. Choisis un **nom d'utilisateur** et un **e-mail** que tu utilises vraiment : le lien
   d'activation y part.
3. Coche la case « I'm not a robot », valide. Va dans ta boîte mail, clique sur le lien.
4. Choisis un mot de passe fort et note-le **sur papier ou dans un gestionnaire de mots
   de passe**, à côté du mot de passe de l'administration de BuildWise (étape 6 bis).

**Ce que tu dois voir :** le « Client Area » (le tableau de bord), avec une demande
d'activation de compte parfois envoyée par e-mail. Chez eux, l'activation est automatique ;
si tu attends plus de 15 minutes, regarde dans tes indésirables.

**Limites à connaître dès maintenant :** l'offre est gratuite pour toujours, sans carte
bancaire, sans publicité sur ton site, avec 5 Go de disque et PHP 8.4. En contrepartie, le
serveur peut suspendre automatiquement un site pendant ~19 à 24 h s'il reçoit une pointe de
trafic anormale, et il n'y a **ni accès SSH, ni envoi d'e-mail (SMTP), ni sauvegarde
automatique de la base**. Pour un projet d'étudiant, c'est sans conséquence — mais garde
toujours ton XAMPP et ton dossier `backups/` allumés : ce sont eux la vraie copie.

> **Alternative équivalente, si InfinityFree ne t'ouvre pas le compte :**
> **ByetHost** (`https://byet.host/free-hosting`) — même infrastructure, 5 Go NVMe,
> PHP 8.3, MySQL 8 / MariaDB 11.4, inscription instantanée. Les étapes 2 à 8 sont
> les mêmes ; seule la tête du panneau change.

---

## 2. Créer le site (1 min)

1. Dans le tableau de bord : **« New Account »** (ou « Create Account »).
2. Domaine : choisis **« Free subdomain »** et tape `buildwise` → tu obtiendras quelque chose
   comme `buildwise.infinityfreeapp.com`. Les autres extensions proposées sont équivalentes.
3. Laisse la case « PHP » activée. Le mot de passe du compte FTP : **mémorise-le**, il sert
   aussi au gestionnaire de fichiers.
4. Valide. L'attente réelle varie de 1 minute à ~1 heure : la page de ton compte affiche
   **« Activated »** quand c'est prêt. Ne téléverse rien avant ce mot-là.

**Ce que tu dois voir :** dans le compte, un onglet **« Control Panel »** (cPanel ou
DirectAdmin, au choix — les deux marchent ; garde **DirectAdmin**, plus aéré).

---

## 3. Créer la base de données en ligne (3 min)

1. Control Panel → rubrique **« MySQL® Databases »** (ou « MySQL Management »).
2. **Create New Database** : tape `buildwise`. Le panneau préfixe ton identifiant :
   tu obtiens une base nommée **`epiz_12345678_buildwise`**. **Note le numéro `epiz_12345678`.**
3. **Create New User** : utilisateur = souvent le même `epiz_12345678`, mot de passe =
   **invente-en un fort et note-le** (il n'a rien à voir avec ton mot de passe de compte).
4. **« Add User To Database »** : sélectionne les deux, coche **ALL PRIVILEGES**, valide.
5. Regarde la page : une ligne affiche **MySQL Host / Server**, du genre
   **`sql123.epizy.com`**. **Note-la.** Ce n'est presque jamais `localhost` :
   c'est l'erreur numéro 1 des débutants sur cet hébergeur.

**Ce que tu dois voir :** la base `epiz_12345678_buildwise` dans la liste, avec l'utilisateur
collé dessous.

> ⚠️ Ne cherche pas à créer la base avec `CREATE DATABASE` dans phpMyAdmin : ce fichier SQL
> ne le fait pas, justement pour ça. La base se crée **uniquement** à l'étape 3.

---

## 4. Importer la structure et les données (3 min)

1. Control Panel → **« phpMyAdmin »** (identifiant = `epiz_12345678`, mot de passe = celui de
   **l'utilisateur MySQL** de l'étape 3, pas celui du compte).
2. Colonne de gauche : clique sur **`epiz_12345678_buildwise`** pour la sélectionner.
   **Cette étape est indispensable** : sans base sélectionnée, l'import part dans le vide.
3. Onglet **« Import »** → **« Choose File »** →
   `buildwise-en-ligne.sql` (le fichier du dossier `deploiement-infinityfree/`).
4. Format : **SQL** (déjà coché) → bouton **« Importer »** / **« Go »** tout en bas.

**Ce que tu dois voir :** « Votre import a été exécuté avec succès », puis 6 tables dans la
colonne de gauche : `benchmarks`, `compatibility`, `component_prices`, `components`,
`configurations`, `configuration_components`.

**Vérifie les chiffres, c'est notre contrôle qualité :** clique `components` → l'onglet
« Structure » doit afficher **32 lignes**, `compatibility` **44 lignes**,
`component_prices` **20 lignes**, `configurations` **0 ligne** (tes deux PC restent chez toi,
volontairement), `benchmarks` **0 ligne** (aucune mesure de FPS n'a encore été relevée).

**Attention, à lire avant de cliquer :** le fichier commence par `DROP TABLE IF EXISTS`
sur les 6 tables. Importé dans une base qui contient déjà des prix saisis en ligne, **il
les efface** pour les remplacer par le catalogue de référence. Ne relance donc cet import
que si tu veux repartir de zéro ; pour ajouter un prix, passe par `admin.html`.

**Si ça échoue :** copie le message exact. Deux causes connues, toutes deux déjà
traitées dans ce fichier :

- « ERROR 1449 … time zone » → les lignes `SET TIME_ZONE` du dump ont été neutralisées
  à la préparation ; si tu les vois revenir, ton fichier n'est pas celui du paquet ;
- « Aucune base sélectionnée » → c'est le point 2 ci-dessus, l'oubli numéro un.

Le fichier a été importé chez toi, ce soir, dans une base séparée
(`buildwise_hote_test`) : 32 composants, 20 prix, 44 constats, 7 clés étrangères,
les deux colonnes récentes (`verified_at`, `paired_component_id`) présentes, puis
la base de test supprimée. Ta base `buildwise` n'a jamais été touchée par cet import.

---

## 5. Téléverser les fichiers (5 min)

> **Depuis le 13/11 au soir, on ne téléverse plus aucune ZIP.** Le panneau
> `ton-domaine` n'a pas de bouton « Extract », et son éditeur refuse de créer ou
> d'enregistrer un fichier `.php` : la méthode des quatre ZIP de `FINAL/` est donc
> morte à son tour. La méthode en vigueur tient dans **un seul dossier,
> `A-TELEVER/`** : 21 fichiers à déposer à la racine de `htdocs`, plus un `.htaccess`
> qui fabrique les dossiers `/assets/…` et `/backend/…` par redirection.
> → **`ETAPES-FINALES.md`**, à côté de ce fichier : c'est la suite d'opérations à jour,
> testée en local le 13/11 (alias, 11 écrans, 40 contrôles du verrou, 403, HTTPS).
> Tout ce qui suit, y compris les méthodes A et B, garde la valeur du journal de bord.

Deux méthodes, choisis-en une.

### Méthode A — le gestionnaire de fichiers du panneau (rien à installer)

1. Control Panel → **« Online File Manager »** (ou « File Manager »).
2. Ouvre le dossier **`htdocs`**. C'est **lui** la racine publique de ton site — pas
   `public_html`, pas le dossier parent.
3. Supprime le `index.html` de bienvenue qu'ils posent (il ne contient rien d'utile).
4. Bouton **« Upload »** → sélectionne **`buildwise-en-ligne.zip`** → attends la fin du
   pourcentage.
5. Dans la liste, clic droit sur `buildwise-en-ligne.zip` → **« Extract »** →
   **décoche** « Delete original file after extracting » si tu veux garder la trace, sinon
   laisse. Valide.
6. Rafraîchis : tu dois voir `index.html`, `admin.html`, `.htaccess`, `assets/`, `backend/`
   **directement dans `htdocs`** — et surtout pas une nouvelle fois un dossier
   `site/` ou `buildwise-en-ligne/`.
7. Si tout est bien en place, **supprime la ZIP** du serveur : elle ne sert plus à rien,
   et elle prend de la place.

**Si « Extract » donne un dossier vide ou ne donne rien :** c'est que la ZIP téléversée
n'est pas celle du paquet (une archive dont les entrées commencent par `./` se lit bien
sous Linux mais pas avec l'Explorateur Windows ni avec certains extracteurs de panneau).
Vérifie en double-cliquant sur le fichier chez toi : tu dois voir **6 éléments** à la
racine — `.htaccess`, `README.md`, `admin.html`, `index.html`, `assets`, `backend`.
Si tu ne vois rien, re-téléverse `buildwise-en-ligne.zip` depuis
`deploiement-infinityfree\` (refaite le 13 novembre pour cette raison) et refais l'étape 5.

### Méthode B — FileZilla (mieux si tu dois souvent modifier des fichiers)

1. Télécharge **FileZilla Client** (gratuit) et installe-le.
2. Renseigne en haut :
   - **Hôte** : l'adresse FTP du panneau (rubrique « FTP Details », souvent
     `ftp.infinityfree.com`) ;
   - **Utilisateur** / **Mot de passe** : ceux de l'étape 2, pas ceux de MySQL ;
   - **Port** : **21** (ou 22 si le panneau propose du SFTP — évite, il est souvent fermé
     sur les comptes gratuits).
3. **Connexion**, puis glisse le **contenu** de `htdocs` local du paquet vers le dossier
   `htdocs` distant — le contenu, pas le dossier `site` lui-même.
4. Vérifie que `.htaccess` est bien arrivé (dans FileZilla : menu **Serveur →
   Forcer à afficher les fichiers cachés**). Sans lui, tes exports resteraient lisibles
   par n'importe qui.

**Ce que tu dois voir à la fin :** environ 320 Ko sur le disque, 24 fichiers.

---

## 5 ter. Dépannage constaté le 13/11 sur `ton-domaine` (lis ceci si ton site affiche une page vide)

Trois caprices du nouveau panneau InfinityFree, vérifiés en ligne fichier par fichier :

1. **« Extract » ignore les dossiers.** La ZIP contient bien `assets/` et `backend/`
   (contrôlé : 28 entrées, 4 dossiers), mais l'extracteur du panneau écrit le **nom du
   fichier** dans le dossier ouvert et **jette le chemin**. Résultat : les 13 PHP et les
   5 JS atterrissent à la racine de `htdocs`, et `assets`/`backend` ne sont jamais créés.
   `index.html` cherche alors `assets/css/styles.css` et `backend/components.php` → 404
   partout, page blanche. (Le panneau appelle ça un succès, ne le crois pas.)
2. **« New File » refuse un `.php`.** Le gestionnaire de fichiers valide les scripts à
   l'enregistrement (`Script file validation failed: potentially dangerous code pattern
   detected in php file`) et rejette la création de `env.php`. Le personnel de
   l'hébergeur admet que cet outil est buggy et renvoie vers FTP.
3. **Et surtout : ce compte n'a aucun bouton « Extract ».** ni sur le fichier, ni dans la
   barre d'outils. Les ZIP sont donc inutilisables, même plates.

**La parade en vigueur (13/11 au soir) : déposer les fichiers à plat et laisser le
`.htaccess` fabriquer les dossiers.** Aucun dossier à créer, aucune extraction, aucun
fichier à créer dans le panneau : les 21 fichiers de `A-TELEVER/` vont à la racine de
`htdocs`, et deux règles de réécriture rendent valables `/assets/css/…`, `/assets/js/…`
et `/backend/…`. Le refus d'enregistrement des `.php` ne gêne plus non plus, puisque
`env.php` et `admin-credentials.php` sont téléversés tout écrits depuis ton PC.

→ **Suis `ETAPES-FINALES.md`**, à côté de ce fichier : c'est la liste à jour, ordre
compris, avec le nom et la taille exacts des fichiers, et le contrôle à faire après
chaque étape. Les ZIP de `FINAL/` (méthode du 13/11 après-midi) ne servent plus.

Si un fichier est refusé au téléversement **et** au renommage, reste la voie FTP, qui
n'a aucun de ces problèmes (elle crée les dossiers et n'analyse pas le code) :

1. Panneau → rubrique **FTP** : note l'**hôte FTP** (`ftpupload.net` en général), ton
   **identifiant FTP** (celui du compte, pas de MySQL) et, si ce n'est jamais fait,
   **définit le mot de passe FTP** (Client Area → Account Details → *FTP Password*).
2. FileZilla → hôte + identifiant + mot de passe + **port 21** → Connecter →
   va dans `htdocs`.
3. Glisse **les deux dossiers** `_versions-depassees\methode-ftp\assets` et
   `...\methode-ftp\backend` dans `htdocs` côté droit.
4. Clic droit sur `backend/env.php` → **View/Edit** → tape le mot de passe MySQL par-
   dessus `REMPLACER-ICI-DANS-FILE-MANAGER` → enregistre → FileZilla demande
   « Upload file? » → **Oui**. Le mot de passe n'est écrit que sur le serveur.
5. Contrôle : `https://ton-domaine/backend/components.php?category=gpu` doit répondre
   du JSON, plus du 404.

### Fichiers à supprimer de `htdocs` (et d'ailleurs sur le serveur)

**Depuis la méthode à plat, ces noms à la racine de `htdocs` sont LE SITE : il ne faut
plus les supprimer.** Ce qui doit partir, une fois `ETAPES-FINALES.md` étape 4 réussi :

- `README.md` — il est aujourd'hui **public** (`https://ton-domaine/README.md`
  répond 200 et décrit ton projet) ;
- les ZIP que tu aurais laissées (`FINAL/*.zip` téléversées, `buildwise-en-ligne.zip`) ;
- les `nom.php.txt` / `nom.js.txt` que tu aurais renommés, et `htaccess.txt` si tu l'as
  renommé en `.htaccess`.

Garde `index2.html` et le fichier-marker `files for your website…` s'ils sont revenus :
ils sont inoffensifs et appartiennent à l'hébergeur. Les anciens dossiers vides
`backend/` et `assets/` sont sans effet (l'alias du `.htaccess` emporte toujours la
réponse) — mais **s'ils contiennent encore une vieille copie d'un fichier**, tu ne sauras
plus lequel sert : vide-les puis supprime-les.

---

## 6. Donner au site ses identifiants en ligne (4 min)

C'est l'étape qui remplace « root / mot de passe vide » de XAMPP par les vrais
identifiants, **sans toucher au code public**.

1. **Ne crée pas `env.php` et ne l'édite pas dans le panneau** : il refuse « New File »
   sur un `.php` comme d'en enregistrer un, et le fichier arrive déjà tout écrit dans
   `A-TELEVER\env.php` (méthode à plat) ou `FINAL/2-backend.zip` (méthode des ZIP,
   périmée) — à la place qui lui revient.
2. **Che toi**, clic droit sur `A-TELEVER\env.php` → **Ouvrir avec → Bloc-notes** : les
   quatre premières valeurs sont déjà celles de ton compte ; il ne reste qu'à taper le
   mot de passe MySQL sur la cinquième ligne, puis **Ctrl+S** et téléverser le fichier.

```php
define('BUILDWISE_DB_HOST',     'sqlNNN.infinityfree.com');   // ← le « MySQL Host » du panneau
define('BUILDWISE_DB_PORT',     '3306');                      // ← laisse 3306
define('BUILDWISE_DB_NAME',     'epiz_00000000_buildwise');    // ← le nom complet de la base
define('BUILDWISE_DB_USER',     'epiz_00000000');              // ← l'utilisateur MySQL
define('BUILDWISE_DB_PASSWORD', 'celui que tu as inventé');   // ← entre guillemets
```

3. C'est tout : `config.php` (à la racine, ou `backend/config.php` dans l'arborescence
   d'origine) lit ce fichier s'il existe, sinon il
   garde les valeurs XAMPP. C'est pour ça que ton installation locale continue de marcher
   exactement comme avant.

   *Pourquoi des `define()` et pas des `putenv()` : InfinityFree met `putenv` dans sa
   liste des fonctions interdites (`disable_functions`). Un `env.php` écrit avec
   `putenv()` ferait planter tout le site dès la première page. Le modèle livré dans
   `A-TELEVER\` utilise donc des constantes — vérifié chez toi par une répétition complète.*

**Ce que tu dois voir, dans l'ordre :**

- ouvre `https://ton-domaine/backend/login.php` → un JSON qui commence par
  `{"ok":true,"data":{"signedIn":false,...}` — PHP fonctionne, le fichier est lisible ;
- ouvre `https://ton-domaine/backend/env.php` → **« 403 Forbidden »**. Si tu vois du code
  PHP à l'écran, le `.htaccess` n'est pas arrivé : recommence la fin de l'étape 5,
  **c'est bloquant**, ne passe pas à la suite.

**Si la page d'accueil affiche « La base de données a refusé la requête » :** l'un des 5
values est fausse. Les trois coupables habituels : le host (`sql123.epizy.com`, et non
`localhost`), le préfixe `epiz_12345678_` oublié devant `buildwise`, ou le mot de passe du
compte InfinityFree employé à la place de celui de l'utilisateur MySQL.

---

## 6 bis. Choisir TON mot de passe d'administration (3 min) — **obligatoire**

Dans la ZIP, `backend/admin-credentials.php` est **vide** : c'est voulu. Tant qu'il ne
contient pas d'empreinte, **personne ne peut se connecter à l'administration en ligne**,
moi compris — la page `admin.html` affiche un bandeau rouge « aucun mot de passe n'est
encore réglé » et toutes les écritures restent refusées. Le site public, lui, fonctionne
déjà normalement : les visiteurs lisent, ils n'écrivent pas.

1. **Chez toi**, XAMPP allumé, ouvre :
   `http://localhost/BuildWise-MySQL/backend/new-password.php`
2. Tape le mot de passe que tu veux (10 caractères minimum), valide.
   La page affiche une ligne `define('BUILDWISE_ADMIN_HASH', '$2y$10$…');`.
   **Le mot de passe reste chez toi** : seul son empreinte part sur le serveur.
3. **Sur l'hébergeur**, File Manager → `htdocs/backend/` → clic droit sur
   `admin-credentials.php` → **Edit** → remplace la valeur vide entre les guillemets par
   l'empreinte, **enregistre**.
4. Ouvre `https://ton-domaine/admin.html` → le bandeau rouge a disparu → tape ton mot de
   passe dans le champ → **« Se connecter »**.

**Ce que tu dois voir :** « Bon retour dans ta base de données. » puis les 5 onglets
utilisables. Si le message reste rouge, l'empreinte n'a pas été enregistrée (répétition
d'accent ou guillemet mangé : recolle-la entière).

**Pourquoi cette page refuse les visiteurs :** `new-password.php` et `check.php` ne
répondent qu'en local (127.0.0.1) ou à une session déjà connectée. Depuis Internet sans
être connecté, ils renvoient « 403 » — c'est la bonne réponse.

---

## 7. Activer HTTPS et régler le compte (5 min)

1. Control Panel → rubrique **« SSL »** ou **« Security »** → **« Enable SSL »** /
   « Let's Encrypt » sur ton sous-domaine. La mise en route prend de quelques minutes à
   une heure ; le certificat se renouvelle tout seul.
2. Cherche **« Force HTTPS »** (ou « Always use HTTPS ») et active-le :
   `http://` redirigera désormais vers `https://`.
3. Ouvre `https://ton-domaine/` — le cadenas doit apparaître dans la barre d'adresse.

**Note : InfinityFree place parfois une page d'attente « coming soon » sur les nouveaux
comptes.** Si ton site affiche ce message au lieu de BuildWise, cherche
« Website > Coming Soon » (ou supprime `incoming.cgi`) et désactive-la. Le contenu de
`htdocs` n'est pas en cause.

**Ton lien public est alors celui-ci :** `https://ton-domaine/` — c'est celui que tu donnes
au professeur. L'administration, elle, reste `https://ton-domaine/admin.html`.

---

## 8. Les tests obligatoires, dans l'ordre (10 min)

Fais-les depuis ton ordinateur, puis **une dernière fois depuis un téléphone connecté au
4G** (pas au Wi-Fi de la maison : c'est ce qui prouve que le site est réellement public).

### 8.1 Le site public, sans rien taper

| # | Ce que tu ouvres | Ce que tu dois voir |
|---|---|---|
| 1 | `https://ton-domaine/` | L'accueil BuildWise, design habituel, prix affichés pour les pièces connues |
| 2 | PC Builder | Les 6 processeurs et les 6 cartes graphiques avec leur prix DZD réel |
| 3 | SmartPrice | Le comparateur, avec les prix sourcés et leur date de vérification |
| 4 | Upgrade Path / FPS Range / Bottleneck / Doctor / Goal / Compatibility / Resolution / Settings | Chaque page s'affiche ; les cases sans donnée disent **« Prix non renseigné »** ou **« Estimation non disponible »** — ce n'est pas une panne, c'est la règle du projet |
| 5 | Une ligne générique (carte mère « type », RAM « type »…) | Toujours « non renseigné » : aucune valeur n'a été inventée |
| 6 | PC Builder → « Enregistrer mon PC » | Le message de succès s'affiche : cette écriture-là reste ouverte aux visiteurs, c'est voulu |

Ouvre la console du navigateur (F12 → Console) : **aucune ligne rouge** n'est acceptée.

### 8.2 L'administration, avec mot de passe

| # | Ce que tu fais | Ce que tu dois voir |
|---|---|---|
| 7 | `https://ton-domaine/admin.html` | La barre « Mot de passe administrateur » apparaît, avec les compteurs de la base (32 composants, 20 prix…) |
| 8 | Tape une erreur volontaire, puis « Se connecter » | « Mot de passe incorrect. » |
| 9 | Tape le vrai mot de passe | « **Connecté. Tu peux enregistrer, corriger et supprimer.** » |
| 10 | Onglet **Prix** → enregistre un prix d'essai bien identifié (source « TEST — à supprimer »), puis « Modifier » sur la ligne, puis « Supprimer » | Les trois opérations réussissent et la liste revient à 20 prix |
| 11 | Onglet **Composants** → ajoute un composant « TEST — à supprimer » | Ajout réussi. **Attention :** aucun bouton de suppression n'existe pour un composant ; retire-le ensuite dans phpMyAdmin, table `components`, en ne cochant que cette ligne |
| 12 | Onglet **PC enregistrés** | La liste est **vide** : c'est normal et voulu, tes deux configurations personnelles ne sont pas en ligne |
| 13 | « Se déconnecter », puis essaie l'étape 10 | Retour du message « Mot de passe administrateur demandé. » |

### 8.3 Ce que les visiteurs ne doivent pas pouvoir voir

| # | Adresse à tester | Résultat attendu |
|---|---|---|
| 14 | `https://ton-domaine/backups/` | 403 |
| 15 | `https://ton-domaine/database/buildwise.sql` | 403 (le dossier n'est même pas téléversé) |
| 16 | `https://ton-domaine/backend/env.php` | 403 |
| 17 | `https://ton-domaine/backend/admin-credentials.php` | 403 |
| 18 | `https://ton-domaine/backend/check.php`, **déconnecté** | « Diagnostic réservé à l'ordinateur de l'administrateur. » |
| 19 | la même, **connecté** à l'étape 9 | Le tableau de diagnostic, qui doit dire « Connexion MySQL : OK » |

---

## 9. Le mot de passe de l'administration

**En ligne, le mot de passe, c'est toi qui le choisis** (étape 6 bis). La ZIP part avec
`backend/admin-credentials.php` **vide** : aucun mot de passe, même le tien, ne fonctionne
tant que tu n'y as pas collé une empreinte. C'est la garantie que ce paquet ne publie
aucun identifiant.

Chez toi, en local, le fichier `backend/admin-credentials.php` du projet XAMPP contient en
revanche l'empreinte du mot de passe que je t'ai écrit dans notre conversation. Ce mot de
passe a circulé dans une conversation : **ne l'utilise jamais en ligne**, et change-le
aussi chez toi si tu veux être tranquille.

Pour fabriquer une empreinte (même mode d'emploi en local et en ligne, à ceci près
qu'en ligne la page n'est accessible qu'une fois connecté) :

1. Ouvre `http://localhost/BuildWise-MySQL/backend/new-password.php` chez toi, ou
   `https://ton-domaine/backend/new-password.php` après t'être connecté dans `admin.html`.
2. Tape le nouveau mot de passe (10 caractères minimum), clique « Fabriquer l'empreinte ».
3. Copie la ligne `define('BUILDWISE_ADMIN_HASH', '…');` affichée et remplace-la dans le
   `backend/admin-credentials.php` concerné (File Manager → Edit pour la version en ligne).
   *Variante :* décommente la dernière ligne de `backend/env.php` et colle-y la même
   empreinte — le code préfère `env.php`, et ton fichier de hachage ne bouge pas.
4. « Se déconnecter » puis se reconnecter avec le nouveau mot de passe pour vérifier.

Après cinq erreurs consécutives, la porte se ferme 300 secondes : c'est voulu, ça rend le
devinage de mot de passe inutile.

---

## 10. Sauvegarder et faire évoluer la version en ligne

**Rien n'est automatique sur un hébergeur gratuit.** Voici le rythme simple à garder :

- **Avant** de toucher à la base en ligne : phpMyAdmin → base sélectionnée → onglet
  **« Exporter »** → méthode **Rapide**, format **SQL** → « Exécuter ». Tu obtiens un
  `.sql` que tu ranges dans `backups/` de ton ordinateur, avec la date dans le nom.
  Ne l'envoie **jamais** sur le serveur.
- **Synchroniser** local → en ligne : si tes prix ont changé dans XAMPP,
  redemande-moi `buildwise-en-ligne.sql` (il est fabriqué depuis ta base du moment), puis
  dans phpMyAdmin : **« Vider »** (Drop) les 6 tables, puis réimporte le fichier.
- **Synchroniser** en ligne → local (si tu as saisi des prix en ligne) : Exporter depuis
  phpMyAdmin, puis chez toi `mysql -u root buildwise < export.sql`.
- **Une règle qui protège ton travail** : la base en ligne ne contient pas tes
  configurations personnelles, et ne doit jamais les contenir. Si un jour tu veux les
  publier, dis-le-moi et on le fera avec un tri explicite.

---

## 11. Les limites, écrites à l'avance pour que tu ne sois jamais surpris

1. **Le site peut être suspendu** s'il reçoit trop de requêtes d'un coup (le chiffre
   circulant est de l'ordre de 50 000 hits/jour, sans qu'il soit affiché noir sur blanc
   dans leurs conditions ; les CGU, elles, disent clairement qu'ils peuvent suspendre à
   leur discrétion). Une suspension est automatique et temporaire : elle se lève seule,
   ou sur demande au forum d'entraide.
2. **Pas d'e-mail sortant (SMTP)** : BuildWise n'envoie aucun message, donc ce n'est pas
   un problème ici — mais si tu ajoutais une « demande de contact », il te faudrait un
   service externe.
3. **Pas de SSH, pas de ligne de commande, pas de cron** : tout passe par le panneau.
4. **Leur PHP interdit plusieurs fonctions** (`exec`, `system`, `passthru`, `php_uname`,
   `chmod`, et surtout `putenv`). J'ai vérifié fichier par fichier : BuildWise n'en appelle
   aucune. C'est pour ça que `env.php` utilise des `define()` et non des `putenv()`, et
   qu'il faut garder le `.htaccess` : sans lui, aucune de ces protections ne sert.
5. **Les sessions PHP** (le « connecté » de l'administration) dépendent d'un dossier
   temporaire du serveur. Si un jour, après une suspension, tu te retrouves déconnecté en
   boucle, désactive puis réactive le PHP dans le panneau : c'est le réglage qui remet la
   session en marche.
6. **PHP 8.4 en ligne contre 8.2 chez toi** : BuildWise n'utilise aucune fonction
   spécifique à une version ; tous les fichiers ont été passés à `php -l`. Le risque est
   donc très faible, mais c'est la seule différence technique entre les deux mondes.
7. **Un hébergeur gratuit peut disparaître ou changer ses règles.** Ton projet tient dans
   24 fichiers et un fichier SQL : si un jour il faut déménager, on remet la même ZIP chez
   un autre hébergeur PHP+MySQL en une après-midi. Les étapes 3 à 7 sont les mêmes
   partout.

---

## 12. Ce que j'ai fait, ce que je n'ai pas fait

**Fait, chez toi, réversible et testé :**

- `backend/auth.php`, `backend/login.php`, `backend/new-password.php` :
  le verrou des écritures, son mot de passe haché et son fabriqueur d'empreinte ;
- `require_admin_write()` dans les cinq endpoints d'écriture, et
  `guard_local_diagnostic()` dans `check.php` ;
- le champ mot de passe et les boutons de la page `admin.html`, sans toucher au design ;
- `.htaccess` à la racine, `backend/env.example.php`, et le crochet dans
  `backend/config.php` qui lit `backend/env.php` s'il existe — en **constantes**
  (`define`), parce qu'InfinityFree interdit la fonction `putenv` ;
- `buildwise-en-ligne.sql` rendu compatible d'un MySQL mutualisé : les lignes
  `SET TIME_ZONE`, qui font échouer l'import chez ce type d'hébergeur, sont
  neutralisées ;
- les 40 contrôles du test de verrou contre **ta** base, tous passés, avec nettoyage
  complet de leurs lignes d'essai (base revenue à 32 composants / 20 prix /
  44 constats / 2 configurations) ;
- **une répétition générale du déploiement** : le contenu exact de la ZIP copié dans
  `htdocs/_bwtest`, avec un `env.php` qui pointe sur une base de test séparée
  (`buildwise_hote_test`, importée du SQL de la ZIP) — les 40 contrôles y sont tous
  passés aussi, preuves que le site fonctionne avec des identifiants d'hébergeur et
  sans aucune de tes données personnelles ; puis copie et base de test supprimées ;
- le paquet `deploiement-infinityfree/` et la vérification du ZIP (24 fichiers, décompressé
  à l'identique, `.htaccess` inclus, `admin-credentials.php` vidé, aucun mot de passe en
  clair) ; la ZIP a aussi été testée servie dans `htdocs` : lectures 200, écritures 401,
  connexion refusée tant que l'empreinte est vide.

**Pas fait — parce que tu ne me l'as pas demandé et parce que ça t'appartient :**

- aucun compte créé, aucun achat, **rien publié** ;
- ta base locale n'a pas été remplacée, tes deux configurations personnelles sont
  intactes, aucune donnée n'a été supprimée ;
- les fichiers `backups/`, `_reference/` et `database/` sont restés chez toi, ils ne sont
  pas dans la ZIP.

**Ce qui reste à confirmer par un humain :** les tests 8.1, 8.2 et 8.3 ci-dessus, faits
**dans le navigateur**, après la publication. Le verrou et les API ont été prouvés par des
requêtes HTTP réelles, mais l'affichage visuel des pages en ligne — lui — ne peut être
vérifié que depuis le lien public.
