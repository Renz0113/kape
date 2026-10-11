<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

final class AuthController
{
    public static function csrf(): never
    {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        apiSuccess(['csrf_token' => $_SESSION['csrf'], 'user' => $_SESSION['user'] ?? null]);
    }
    public static function current(PDO $db): never
    {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        if (!isset($_SESSION['user']['id'])) apiSuccess(['user' => null]);
        $stmt = $db->prepare('SELECT id,name,email,role,phone FROM users WHERE id=:id LIMIT 1');
        $stmt->execute(['id' => (int)$_SESSION['user']['id']]);
        $user = $stmt->fetch();
        if (!$user) { unset($_SESSION['user']); apiSuccess(['user' => null]); }
        $_SESSION['user'] = $user;
        apiSuccess(['user' => $user]);
    }
    public static function register(PDO $db): never
    {
        requireCsrf();
        $input = requestJson(); $name = trim((string)($input['name'] ?? '')); $email = trim((string)($input['email'] ?? '')); $phone = trim((string)($input['phone'] ?? '')); $password = (string)($input['password'] ?? '');
        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254 || $phone === '' || mb_strlen($phone) > 32) apiError('VALIDATION_ERROR', 'Enter your name, a valid email address, and a phone number.', 422);
        if (strlen($password) < 10 || strlen($password) > 200 || !preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) apiError('PASSWORD_WEAK', 'Use at least 10 characters, including one uppercase letter and one number.', 422);
        $users = new User($db);
        if ($users->byEmail($email)) apiError('EMAIL_EXISTS', 'An account with this email already exists.', 409);
        try { $id = $users->create($name, $email, $password, $phone); }
        catch (PDOException $e) { if ($e->getCode() === '23000') apiError('EMAIL_EXISTS', 'An account with this email already exists.', 409); throw $e; }
        self::startSession(); session_regenerate_id(true); $_SESSION['user'] = ['id' => $id, 'name' => $name, 'email' => mb_strtolower($email), 'role' => 'customer', 'phone' => $phone]; $_SESSION['csrf'] = bin2hex(random_bytes(32));
        apiSuccess(['user' => $_SESSION['user'], 'csrf_token' => $_SESSION['csrf']], 201);
    }
    public static function login(PDO $db): never
    {
        requireCsrf();
        $input = requestJson(); $user = (new User($db))->byEmail((string)($input['email'] ?? ''));
        if (!$user || !password_verify((string)($input['password'] ?? ''), $user['password_hash'])) apiError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
        self::startSession(); session_regenerate_id(true); unset($user['password_hash']); $_SESSION['user'] = $user; $_SESSION['csrf'] = bin2hex(random_bytes(32));
        apiSuccess(['user' => $user, 'csrf_token' => $_SESSION['csrf']]);
    }
    public static function logout(): never
    {
        requireCsrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', ['expires'=>time()-42000,'path'=>$params['path'],'domain'=>$params['domain'],'secure'=>$params['secure'],'httponly'=>$params['httponly'],'samesite'=>$params['samesite'] ?? 'Lax']);
        }
        session_destroy();
        apiSuccess(['logged_out' => true]);
    }
    private static function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) { session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','samesite'=>'Lax','path'=>'/']); session_start(); }
    }
}
