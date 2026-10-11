<?php
declare(strict_types=1);

final class Inventory
{
    public function __construct(private PDO $db) {}

    public function movementPage(array $filters): array
    {
        $where = [];
        $values = [];

        if (($filters['search'] ?? '') !== '') {
            $where[] = '(p.name LIKE ? OR m.reason LIKE ? OR o.reference LIKE ? OR u.name LIKE ?)';
            $needle = '%' . $filters['search'] . '%';
            array_push($values, $needle, $needle, $needle, $needle);
        }
        if (!empty($filters['product_id'])) {
            $where[] = 'm.product_id = ?';
            $values[] = (int)$filters['product_id'];
        }
        switch ($filters['type'] ?? 'all') {
            case 'added': $where[] = 'm.quantity_change > 0'; break;
            case 'removed': $where[] = 'm.quantity_change < 0'; break;
            case 'automatic': $where[] = 'm.order_id IS NOT NULL'; break;
            case 'manual': $where[] = 'm.order_id IS NULL'; break;
        }
        if (!empty($filters['date_from'])) {
            $where[] = 'DATE(m.created_at) >= ?';
            $values[] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[] = 'DATE(m.created_at) <= ?';
            $values[] = $filters['date_to'];
        }

        $joins = ' FROM inventory_movements m LEFT JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.created_by LEFT JOIN orders o ON o.id = m.order_id';
        $clause = $where ? ' WHERE ' . implode(' AND ', $where) : '';
        $count = $this->db->prepare('SELECT COUNT(*)' . $joins . $clause);
        $count->execute($values);
        $total = (int)$count->fetchColumn();

        $query = $this->db->prepare("SELECT m.id,m.product_id,p.name AS product_name,m.quantity_change,m.reason,m.order_id,o.reference AS order_reference,m.created_by,u.name AS admin_name,m.created_at,CASE WHEN m.order_id IS NULL THEN 'manual' ELSE 'automatic' END AS movement_source" . $joins . $clause . ' ORDER BY m.created_at DESC,m.id DESC LIMIT ? OFFSET ?');
        foreach ($values as $index => $value) $query->bindValue($index + 1, $value);
        $query->bindValue(count($values) + 1, (int)$filters['limit'], PDO::PARAM_INT);
        $query->bindValue(count($values) + 2, (int)$filters['offset'], PDO::PARAM_INT);
        $query->execute();

        return ['items' => $query->fetchAll(), 'total' => $total];
    }
}