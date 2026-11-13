<?php
/**
 * login.php — La porte d'entrée du mot de passe administrateur.
 *
 * Trois usages, un seul fichier :
 *   GET  backend/login.php   → est-ce que je suis connecté ? + mon jeton CSRF
 *   POST backend/login.php   → { action:'login',  password:'…' }
 *   POST backend/login.php   → { action:'logout' }
 *
 * Le mot de passe voyage en HTTPS uniquement vers ce fichier PHP : il n'est
 * jamais écrit dans le JavaScript, jamais stocké en clair, et la réponse ne
 * dit jamais si le mot de passe était « presque » correct.
 */

require_once __DIR__ . '/helpers.php';

handle(function (): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        send_ok([
            'signedIn'  => is_admin(),
            // Le jeton sert à prouver que c'est bien cette page qui écrit.
            'csrf'      => csrf_token(),
            'configured'=> admin_hash() !== '',
        ]);
    }

    require_method('POST');

    $body   = request_body();
    $action = $body['action'] ?? '';

    if ($action === 'logout') {
        admin_logout();
        send_ok(['signedIn' => false], ['message' => 'Déconnecté.']);
    }

    if ($action !== 'login') {
        send_error('Action inconnue.', 400, 'Utilise action = login ou logout.');
    }

    $password = (string) ($body['password'] ?? '');
    $waited   = 0;

    if (admin_login($password, $waited)) {
        send_ok([
            'signedIn' => true,
            'csrf'     => csrf_token(),
        ], ['message' => 'Bon retour dans ta base de données.']);
    }

    if ($waited > 0) {
        send_error(
            'Trop de tentatives : la porte est fermée ' . $waited . ' secondes.',
            429,
            'Attends la fin du compte à rebours, puis réessaie.',
            ['retryAfter' => $waited]
        );
    }

    // Message volontairement vague : on ne dit pas si un identifiant existe.
    send_error('Mot de passe incorrect.', 401, 'Le mot de passe est celui que tu as choisi pour l\'administration. Pour en changer : backend/new-password.php.');
});
