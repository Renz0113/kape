<?php
declare(strict_types=1);

final class Payment
{
    public function __construct(private PDO $db) {}
    public function forOrder(int $orderId): array
    {
        $stmt = $this->db->prepare('SELECT provider,provider_reference,amount,status,created_at FROM payments WHERE order_id=:id ORDER BY id DESC');
        $stmt->execute(['id' => $orderId]); return $stmt->fetchAll();
    }
}
