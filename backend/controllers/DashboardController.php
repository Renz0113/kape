<?php
declare(strict_types=1);

final class DashboardController
{
    public static function summary(PDO $db): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        requireAdmin();

        [$start, $end, $range] = self::dateRange();

        $period = $db->prepare("SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS sales, COALESCE(AVG(total), 0) AS average_order FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status <> 'cancelled'");
        $period->execute([$start, $end]);
        $summary = $period->fetch();

        $today = $db->query("SELECT COUNT(*) AS orders_today, COALESCE(SUM(total), 0) AS sales_today, COALESCE(SUM(status IN ('pending','confirmed','preparing','ready')), 0) AS open_orders FROM orders WHERE DATE(created_at) = UTC_DATE() AND status <> 'cancelled'")->fetch();
        $summary['orders_today'] = (int)$today['orders_today'];
        $summary['sales_today'] = (float)$today['sales_today'];
        $summary['pending_orders'] = (int)$db->query("SELECT COUNT(*) FROM orders WHERE status = 'pending'")->fetchColumn();
        $summary['open_orders'] = (int)$today['open_orders'];
        $summary['low_stock'] = (int)$db->query('SELECT COUNT(*) FROM products WHERE is_active = 1 AND stock_quantity > 0 AND stock_quantity < 5')->fetchColumn();
        $summary['order_count'] = (int)$summary['order_count'];
        $summary['sales'] = (float)$summary['sales'];
        $summary['average_order'] = (float)$summary['average_order'];

        $topProduct = $db->prepare("SELECT oi.product_name AS name, SUM(oi.quantity) AS quantity FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status <> 'cancelled' GROUP BY oi.product_id, oi.product_name ORDER BY SUM(oi.quantity) DESC, SUM(oi.line_total) DESC, oi.product_name ASC LIMIT 1");
        $topProduct->execute([$start, $end]);
        $summary['top_selling'] = $topProduct->fetch() ?: null;
        if ($summary['top_selling']) $summary['top_selling']['quantity'] = (int)$summary['top_selling']['quantity'];

        $sales = $db->prepare("SELECT DATE(created_at) AS sales_date, COALESCE(SUM(total), 0) AS sales FROM orders WHERE DATE(created_at) BETWEEN ? AND ? AND status <> 'cancelled' GROUP BY DATE(created_at) ORDER BY DATE(created_at)");
        $sales->execute([$start, $end]);
        $summary['sales_series'] = array_map(static fn(array $row): array => [
            'date' => $row['sales_date'],
            'sales' => (float)$row['sales'],
        ], $sales->fetchAll());
        $summary['range'] = ['type' => $range, 'start' => $start, 'end' => $end];

        apiSuccess($summary);
    }

    /** @return array{string,string,string} */
    private static function dateRange(): array
    {
        $range = (string)($_GET['range'] ?? '7d');
        $today = new DateTimeImmutable('today', new DateTimeZone('UTC'));

        if ($range === 'today') {
            return [$today->format('Y-m-d'), $today->format('Y-m-d'), 'today'];
        }
        if ($range === '7d' || $range === '30d') {
            $days = $range === '7d' ? 7 : 30;
            return [$today->modify('-' . ($days - 1) . ' days')->format('Y-m-d'), $today->format('Y-m-d'), $range];
        }
        if ($range !== 'custom') {
            apiError('INVALID_DATE_RANGE', 'Choose Today, 7 Days, 30 Days, or a custom date range.', 400);
        }

        $start = self::validDate($_GET['start'] ?? null);
        $end = self::validDate($_GET['end'] ?? null);
        if (!$start || !$end || $start > $end) {
            apiError('INVALID_DATE_RANGE', 'Enter a valid start and end date for the custom range.', 400);
        }
        $days = (int)$start->diff($end)->format('%a') + 1;
        if ($days > 366) {
            apiError('INVALID_DATE_RANGE', 'Custom dashboard ranges can cover up to 366 days.', 400);
        }

        return [$start->format('Y-m-d'), $end->format('Y-m-d'), 'custom'];
    }

    private static function validDate(mixed $value): ?DateTimeImmutable
    {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return null;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        return $date && $date->format('Y-m-d') === $value ? $date : null;
    }
}



