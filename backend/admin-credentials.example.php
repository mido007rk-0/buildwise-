<?php
/**
 * admin-credentials.example.php — MODELE, sans empreinte.
 * Copie-le en admin-credentials.php (le .gitignore empeche de le publier)
 * et colle-y ta propre empreinte : c'est backend/new-password.php qui la fabrique.
 *
 * CE FICHIER NE CONTIENT JAMAIS LE MOT DE PASSE, seulement son empreinte
 * (un « hash » bcrypt). Personne ne peut retrouver le mot de passe en lisant
 * ces 60 caractères, pas même moi.
 *
 * POUR CHANGER TON MOT DE PASSE :
 *   1. Ouvre cette adresse dans ton navigateur (chez toi, dans XAMPP) :
 *        http://localhost/BuildWise-MySQL/backend/new-password.php
 *   2. Tape le nouveau mot de passe, copie la ligne qu'il te donne.
 *   3. Remplace la valeur de BUILDWISE_ADMIN_HASH ci-dessous.
 *
 * AVANCÉ : la variable d'environnement BUILDWISE_ADMIN_HASH écrase cette
 * valeur, ce qui permet de ne jamais écrire l'empreinte dans un fichier
 * quand l'hébergeur sait fournir des variables d'environnement.
 */

define('BUILDWISE_ADMIN_HASH', '');
