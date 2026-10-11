<?php
declare(strict_types=1);

final class OrderItem
{
    public function __construct(private PDO $db) {}
    public function forOrder(int $orderId): array
    {
        $stmt = $this->db->prepare('SELECT oi.product_id,oi.product_name,oi.unit_price,oi.quantity,oi.line_total,p.image_path FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=:id ORDER BY oi.id');
        $stmt->execute(['id' => $orderId]); return $stmt->fetchAll();
    }
}
