<?php
declare(strict_types=1);

final class Category
{
    public function __construct(private PDO $db) {}
    public function active(): array
    {
        return $this->db->query('SELECT id,name,slug,description FROM categories WHERE is_active=1 ORDER BY sort_order,name')->fetchAll();
    }
}
