<?php
declare(strict_types=1);

final class User
{
    public function __construct(private PDO $db) {}
    public function byEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT id,name,email,password_hash,role,phone FROM users WHERE email=:email LIMIT 1');
        $stmt->execute(['email' => mb_strtolower(trim($email))]);
        return $stmt->fetch() ?: null;
    }
    public function create(string $name, string $email, string $password, ?string $phone = null): int
    {
        $stmt = $this->db->prepare('INSERT INTO users (name,email,password_hash,phone) VALUES (:name,:email,:hash,:phone)');
        $stmt->execute(['name' => trim($name), 'email' => mb_strtolower(trim($email)), 'hash' => password_hash($password, PASSWORD_DEFAULT), 'phone' => $phone !== null ? trim($phone) : null]);
        return (int)$this->db->lastInsertId();
    }
}
