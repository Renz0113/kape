<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/AdminMiddleware.php';

final class AdminUserController
{
    public static function index(PDO $db): never
    {
        requireAdmin($db);
        try {
            $rows = $db->query("SELECT id,name,email,created_at FROM users WHERE role='admin' ORDER BY created_at DESC")->fetchAll();
        } catch (PDOException $error) {
            // Older local databases may not have the optional users.created_at column.
            if ($error->getCode() !== '42S22') throw $error;
            $rows = $db->query("SELECT id,name,email,NULL AS created_at FROM users WHERE role='admin' ORDER BY id DESC")->fetchAll();
        }
        apiSuccess($rows);
    }

    public static function create(PDO $db): never
    {
        requireAdmin($db);
        requireCsrf();
        $input = requestJson();
        $name = trim((string)($input['name'] ?? ''));
        $email = mb_strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        if ($name === '' || mb_strlen($name) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254 || strlen($password) < 10 || strlen($password) > 200) {
            apiError('VALIDATION_ERROR', 'Enter a name, valid email, and password between 10 and 200 characters.', 422);
        }

        try {
            $stmt = $db->prepare("INSERT INTO users (name,email,password_hash,role) VALUES (:name,:email,:hash,'admin')");
            $stmt->execute(['name' => $name, 'email' => $email, 'hash' => password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') apiError('EMAIL_EXISTS', 'An account already uses that email address.', 409);
            throw $error;
        }

        apiSuccess(['id' => (int)$db->lastInsertId(), 'name' => $name, 'email' => $email], 201);
    }
}
