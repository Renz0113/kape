# Database migrations

A fresh database should import `../schema.sql`. Existing databases should apply numbered migration files once, in order, using phpMyAdmin's SQL tab or the MySQL client. Back up the database first and record which migration files have been applied. This project has no automated migration runner.

## Existing KAPE databases

For a database created before the customer Me account work, select the `kape` database in phpMyAdmin and run `001_customer_me.sql` once. It adds the saved delivery address, aligns payment statuses, creates order status history, and backfills each existing order's current status as an account notification. Do not run this migration on a fresh database imported from the current `schema.sql`, because those changes are already included there.

For an existing database that predates checkout order notes, run `002_order_notes.sql` once after migration 001. It adds the optional `orders.order_notes` column used by checkout and admin order details. Fresh installs already include the column in `schema.sql` and should not run this migration.

For saved map pins and order location snapshots, run `003_delivery_location.sql` once after migrations 001 and 002. It adds nullable latitude and longitude fields to customers and orders. Existing address-only records remain usable. Fresh installs already include these fields in `schema.sql` and should not run this migration.
