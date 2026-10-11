<?php
declare(strict_types=1);

require_once __DIR__ . '/env.php';

/** Payment remains disabled until a provider adapter and webhook verification are configured. */
function paymentConfiguration(): array
{
    return [
        'provider' => envValue('PAYMENT_PROVIDER', ''),
        'secret_key' => envValue('PAYMENT_SECRET_KEY', ''),
        'enabled' => envValue('PAYMENT_PROVIDER', '') !== '' && envValue('PAYMENT_SECRET_KEY', '') !== '',
    ];
}
