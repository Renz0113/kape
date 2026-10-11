<?php
declare(strict_types=1);

const KAPE_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const KAPE_ORDER_TRANSITIONS = [
    'pending' => ['confirmed', 'cancelled'],
    'confirmed' => ['preparing', 'cancelled'],
    'preparing' => ['ready', 'cancelled'],
    'ready' => ['completed'],
    'completed' => [],
    'cancelled' => [],
];
const KAPE_ORDER_STATUS_MESSAGES = [
    'pending' => 'Order received',
    'confirmed' => 'Order confirmed',
    'preparing' => 'Your order is being prepared',
    'ready' => 'Your order is ready',
    'completed' => 'Order completed',
    'cancelled' => 'Order cancelled',
];

function kape_order_can_transition(string $current, string $next): bool
{
    return in_array($next, KAPE_ORDER_TRANSITIONS[$current] ?? [], true);
}
