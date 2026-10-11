<?php
declare(strict_types=1);

require_once __DIR__ . '/../http/response.php';

function requireUser(): array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        apiError('UNAUTHENTICATED', 'Please sign in to continue.', 401);
    }
    return $_SESSION['user'];
}

function requireCsrf(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf']) || !is_string($provided) || !hash_equals($_SESSION['csrf'], $provided)) {
        apiError('CSRF_FAILED', 'The request could not be verified. Refresh and try again.', 403);
    }
}
