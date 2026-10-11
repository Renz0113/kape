<?php
declare(strict_types=1);

require_once __DIR__ . '/AuthMiddleware.php';

function requireAdmin(?PDO $db = null): array
{
    $user = requireUser();
    $db ??= databaseConnection();
    $stmt = $db->prepare('SELECT role FROM users WHERE id=:id LIMIT 1');
    $stmt->execute(['id' => (int)$user['id']]);
    $role = $stmt->fetchColumn();
    if ($role === false) {
        unset($_SESSION['user']);
        apiError('UNAUTHENTICATED', 'Your account is no longer available. Please sign in again.', 401);
    }
    $user['role'] = $role;
    $_SESSION['user']['role'] = $role;
    if (($user['role'] ?? '') !== 'admin') {
        apiError('FORBIDDEN', 'Administrator access is required.', 403);
    }
    return $user;
}
