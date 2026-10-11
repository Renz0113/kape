<?php
declare(strict_types=1);
require_once __DIR__.'/../config/payment.php';
final class PaymentController
{
    public static function webhook(PDO $db): never
    {
        // No provider is integrated yet; never accept unauthenticated payment state changes.
        if (!paymentConfiguration()['enabled']) apiError('PAYMENTS_DISABLED','Payment processing is not configured.',503);
        apiError('PAYMENT_ADAPTER_MISSING','A verified provider webhook adapter must be implemented before payments can be accepted.',501);
    }
    public static function adminList(PDO $db): never { require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();apiSuccess($db->query('SELECT id,order_id,provider,provider_reference,amount,status,created_at FROM payments ORDER BY created_at DESC LIMIT 200')->fetchAll()); }
}
