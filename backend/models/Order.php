<?php
declare(strict_types=1);

final class Order
{
    public function __construct(private PDO $db) {}
    public function history(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT o.id,o.reference,o.status,o.fulfillment,o.delivery_address,o.delivery_latitude,o.delivery_longitude,o.subtotal,o.delivery_fee,o.total,o.created_at,COALESCE(p.status,'pending') AS payment_status FROM orders o LEFT JOIN payments p ON p.id=(SELECT p2.id FROM payments p2 WHERE p2.order_id=o.id ORDER BY p2.id DESC LIMIT 1) WHERE o.user_id=:id ORDER BY o.created_at DESC LIMIT 100");
        $stmt->execute(['id' => $userId]); return $stmt->fetchAll();
    }
    public function notifications(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT h.status,h.message,h.created_at,o.reference,'order' AS kind FROM order_status_history h JOIN orders o ON o.id=h.order_id WHERE o.user_id=:user_id UNION ALL SELECT p.status,CASE p.status WHEN 'paid' THEN 'Payment confirmed' WHEN 'failed' THEN 'Payment failed' WHEN 'refunded' THEN 'Payment refunded' END,p.updated_at,o.reference,'payment' AS kind FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.user_id=:payment_user AND p.status IN ('paid','failed','refunded') ORDER BY created_at DESC LIMIT 30");
        $stmt->execute(['user_id'=>$userId,'payment_user'=>$userId]); return $stmt->fetchAll();
    }
}
