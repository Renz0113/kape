<?php
declare(strict_types=1);

final class Product
{
    public function __construct(private PDO $db) {}

    public function list(string $search = '', ?int $categoryId = null, int $limit = 24, int $offset = 0, bool $includeInactive = false): array
    {
        $where = $includeInactive ? '1=1' : 'p.is_active = 1';
        $params = [];
        if ($search !== '') { $where .= ' AND (p.name LIKE :search_name OR p.description LIKE :search_description)'; $params['search_name'] = '%' . $search . '%'; $params['search_description'] = '%' . $search . '%'; }
        if ($categoryId !== null) { $where .= ' AND p.category_id = :category'; $params['category'] = $categoryId; }
        $stmt = $this->db->prepare("SELECT p.id,p.category_id,c.name AS category_name,p.name,p.slug,p.description,p.price,p.image_path,p.stock_quantity,(p.stock_quantity > 0 AND p.is_active = 1) AS available FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE $where ORDER BY p.id DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $key => $value) $stmt->bindValue(':' . $key, $value);
        $stmt->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
        $stmt->bindValue(':offset', max(0, $offset), PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();
        foreach ($items as &$item) {
            $item['available'] = (bool)$item['available'];
            $item['stock_quantity'] = (int)$item['stock_quantity'];
        }
        unset($item);
        return $items;
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT p.id,p.category_id,c.name AS category_name,p.name,p.slug,p.description,p.price,p.image_path,p.stock_quantity,(p.stock_quantity > 0 AND p.is_active = 1) AS available FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=:id AND p.is_active=1');
        $stmt->execute(['id' => $id]);
        $item = $stmt->fetch();
        if (!$item) return null;
        $item['available'] = (bool)$item['available'];
        $item['stock_quantity'] = (int)$item['stock_quantity'];
        return $item;
    }
}
