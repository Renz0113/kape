-- Apply once to existing KAPE databases after migrations 001 and 002.
-- Coordinates are optional so existing saved addresses remain valid.
ALTER TABLE users
    ADD COLUMN delivery_latitude DECIMAL(10,7) NULL AFTER delivery_address,
    ADD COLUMN delivery_longitude DECIMAL(10,7) NULL AFTER delivery_latitude;

ALTER TABLE orders
    ADD COLUMN delivery_latitude DECIMAL(10,7) NULL AFTER delivery_address,
    ADD COLUMN delivery_longitude DECIMAL(10,7) NULL AFTER delivery_latitude;
