-- Apply once to existing KAPE databases before using the Me account dashboard.
ALTER TABLE users ADD COLUMN delivery_address VARCHAR(500) NULL AFTER phone;

UPDATE payments SET status='pending' WHERE status='authorized';
ALTER TABLE payments MODIFY status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending';

CREATE TABLE order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL,
    message VARCHAR(180) NOT NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_status_history_order_date (order_id, created_at),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_status_history_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO order_status_history(order_id,status,message,created_at)
SELECT id,status,CASE status
    WHEN 'pending' THEN 'Order received'
    WHEN 'confirmed' THEN 'Order confirmed'
    WHEN 'preparing' THEN 'Your order is being prepared'
    WHEN 'ready' THEN 'Your order is ready'
    WHEN 'completed' THEN 'Order completed'
    WHEN 'cancelled' THEN 'Order cancelled'
END,updated_at FROM orders;
