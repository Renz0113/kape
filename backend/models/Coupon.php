<?php
declare(strict_types=1);

final class Coupon
{
    public function __construct(private PDO $db) {}
    public function findValid(string $code): ?array
    {
        $stmt = $this->db->prepare("SELECT id,code,discount_type,discount_value FROM coupons WHERE code=:code AND is_active=1 AND (starts_at IS NULL OR starts_at<=UTC_TIMESTAMP()) AND (ends_at IS NULL OR ends_at>=UTC_TIMESTAMP()) AND (usage_limit IS NULL OR usage_count<usage_limit) LIMIT 1");
        $stmt->execute(['code' => strtoupper(trim($code))]); return $stmt->fetch() ?: null;
    }
}
