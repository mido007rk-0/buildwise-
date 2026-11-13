<?php
/**
 * new-password.php — Fabrique la ligne à coller dans admin-credentials.php.
 *
 * Usage (chez toi, dans XAMPP) :
 *   1. Ouvre http://localhost/BuildWise-MySQL/backend/new-password.php
 *   2. Tape le nouveau mot de passe deux fois.
 *   3. Copie la ligne `define('BUILDWISE_ADMIN_HASH', '…');` qu'il affiche
 *      et remplace celle de backend/admin-credentials.php.
 *
 * Le mot de passe lui-même n'est jamais écrit sur le disque : le fichier ne
 * reçoit que son empreinte. La page n'accepte que ton ordinateur local ou une
 * session déjà connectée, sinon n'importe qui pourrait s'en servir.
 */

require_once __DIR__ . '/helpers.php';

guard_local_diagnostic();

$proposed = $_POST['password'] ?? null;
$error    = '';
$hash     = '';

if (is_string($proposed) && $proposed !== '') {
    if (mb_strlen($proposed) < 10) {
        $error = 'Choisis au moins 10 caractères : la page est publique, le mot de passe est ta seule porte.';
    } else {
        $hash = password_hash($proposed, PASSWORD_DEFAULT);
    }
}

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, nofollow">
  <title>Changer le mot de passe — BuildWise</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#10141c; color:#e8ecf4; max-width:44rem; margin:3rem auto; padding:0 1.2rem; line-height:1.55; }
    h1 { font-size:1.35rem; letter-spacing:-.01em; }
    label { display:block; margin:1rem 0 .3rem; font-size:.85rem; color:#9aa6bd; }
    input { width:100%; padding:.6rem .7rem; border-radius:.5rem; border:1px solid #2b3548; background:#161c28; color:#e8ecf4; font-size:1rem; }
    button { margin-top:1.2rem; padding:.6rem 1.1rem; border-radius:.5rem; border:0; background:#4f7cff; color:#fff; font-size:.95rem; cursor:pointer; }
    code { display:block; background:#161c28; border:1px solid #2b3548; border-radius:.5rem; padding:.8rem; word-break:break-all; font-size:.82rem; }
    .warn { color:#ffb3b3; } .ok { color:#8ff0b5; } .hint { color:#9aa6bd; font-size:.85rem; }
  </style>
</head>
<body>
  <h1>Changer le mot de passe de l'administration</h1>
  <p class="hint">Cette page ne change rien toute seule : elle te donne la ligne à coller dans
    <code style="display:inline;padding:.1rem .35rem">backend/admin-credentials.php</code>.
    <a href="../admin.html" style="color:#9ab4ff">Retour à l'administration</a>.</p>

  <form method="post">
    <label for="password">Nouveau mot de passe (10 caractères minimum)</label>
    <input id="password" name="password" type="password" autocomplete="new-password" required>
    <button type="submit">Fabriquer l'empreinte</button>
  </form>

  <?php if ($error !== ''): ?>
    <p class="warn"><?= htmlspecialchars($error, ENT_QUOTES) ?></p>
  <?php endif; ?>

  <?php if ($hash !== ''): ?>
    <p class="ok">Copie exactement cette ligne et remplace celle du fichier :</p>
    <code>define('BUILDWISE_ADMIN_HASH', '<?= htmlspecialchars($hash, ENT_QUOTES) ?>');</code>
    <p class="hint">Tu peux fermer cette page : le mot de passe n'y reste pas. Note-le ailleurs,
      PHP ne peut pas le retrouver à partir de l'empreinte.</p>
  <?php endif; ?>
</body>
</html>
