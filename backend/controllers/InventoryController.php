<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/Inventory.php';

final class InventoryController
{
    private const LOW_STOCK_THRESHOLD = 5;
    private const MOVEMENT_PAGE_SIZE = 100;

    public static function index(PDO $db): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        requireAdmin();

        $products = $db->query('SELECT p.id,p.category_id,c.name AS category_name,p.name,p.stock_quantity,p.is_active FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.name')->fetchAll();
        $summary = $db->query('SELECT COUNT(*) AS total_products,COALESCE(SUM(is_active=1),0) AS active_products,COALESCE(SUM(is_active=1 AND stock_quantity>0 AND stock_quantity<' . self::LOW_STOCK_THRESHOLD . '),0) AS low_stock,COALESCE(SUM(is_active=1 AND stock_quantity=0),0) AS out_of_stock FROM products')->fetch();
        $summary['total_products'] = (int)$summary['total_products'];
        $summary['active_products'] = (int)$summary['active_products'];
        $summary['low_stock'] = (int)$summary['low_stock'];
        $summary['out_of_stock'] = (int)$summary['out_of_stock'];
        $summary['movements_last_7_days'] = (int)$db->query('SELECT COUNT(*) FROM inventory_movements WHERE DATE(created_at) >= UTC_DATE() - INTERVAL 6 DAY')->fetchColumn();

        $type = $_GET['type'] ?? 'all';
        if (!is_string($type) || !in_array($type, ['all', 'added', 'removed', 'automatic', 'manual'], true)) {
            apiError('VALIDATION_ERROR', 'Choose a valid inventory activity filter.', 400);
        }
        $productId = filter_var($_GET['product_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (isset($_GET['product_id']) && $_GET['product_id'] !== '' && $productId === false) {
            apiError('VALIDATION_ERROR', 'Choose a valid product filter.', 400);
        }
        $search = $_GET['search'] ?? '';
        if (!is_string($search)) apiError('VALIDATION_ERROR', 'Search text must be plain text.', 400);
        $search = trim($search);
        if (mb_strlen($search) > 100) apiError('VALIDATION_ERROR', 'Search text must be 100 characters or fewer.', 400);
        $dateFrom = self::validDate($_GET['date_from'] ?? null);
        $dateTo = self::validDate($_GET['date_to'] ?? null);
        if ((isset($_GET['date_from']) && $_GET['date_from'] !== '' && !$dateFrom)
            || (isset($_GET['date_to']) && $_GET['date_to'] !== '' && !$dateTo)
            || ($dateFrom && $dateTo && $dateFrom > $dateTo)) {
            apiError('INVALID_DATE_RANGE', 'Choose valid activity dates with the start date on or before the end date.', 400);
        }
        $offset = max(0, min(1000000, (int)($_GET['offset'] ?? 0)));
        $page = (new Inventory($db))->movementPage([
            'search' => $search,
            'product_id' => $productId ?: null,
            'type' => $type,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'limit' => self::MOVEMENT_PAGE_SIZE,
            'offset' => $offset,
        ]);

        apiSuccess([
            'products' => $products,
            'summary' => $summary,
            'movements' => $page['items'],
            'movement_total' => $page['total'],
            'movement_offset' => $offset,
            'movement_limit' => self::MOVEMENT_PAGE_SIZE,
        ]);
    }

    public static function adjust(PDO $db): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        $admin = requireAdmin();
        requireCsrf();
        $input = requestJson();
        $id = filter_var($input['product_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $change = filter_var($input['quantity_change'] ?? null, FILTER_VALIDATE_INT);
        $reason = trim((string)($input['reason'] ?? ''));
        if ($id === false || $change === false || $change === 0 || abs((int)$change) > 10000 || $reason === '' || mb_strlen($reason) > 160) {
            apiError('VALIDATION_ERROR', 'Choose a product, enter a non-zero adjustment of up to 10,000 units, and provide a reason of 160 characters or fewer.', 422);
        }

        $db->beginTransaction();
        try {
            $statement = $db->prepare('SELECT stock_quantity FROM products WHERE id=:id FOR UPDATE');
            $statement->execute(['id' => (int)$id]);
            $product = $statement->fetch();
            if (!$product) throw new DomainException('Product not found.');
            $newStock = (int)$product['stock_quantity'] + (int)$change;
            if ($newStock < 0) throw new DomainException('Stock cannot be negative.');

            $db->prepare('UPDATE products SET stock_quantity=:quantity WHERE id=:id')->execute(['quantity' => $newStock, 'id' => (int)$id]);
            $db->prepare('INSERT INTO inventory_movements(product_id,quantity_change,reason,created_by) VALUES(:product_id,:change,:reason,:admin_id)')->execute([
                'product_id' => (int)$id,
                'change' => (int)$change,
                'reason' => $reason,
                'admin_id' => (int)$admin['id'],
            ]);
            $db->commit();
            apiSuccess(['stock_quantity' => $newStock]);
        } catch (DomainException $error) {
            if ($db->inTransaction()) $db->rollBack();
            apiError('INVENTORY_INVALID', $error->getMessage(), 422);
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
    }

    private static function validDate(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') return null;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return null;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        return $date && $date->format('Y-m-d') === $value ? $value : null;
    }
}