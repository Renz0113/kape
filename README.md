# Kape Store Project Guide

This document describes the KAPE storefront, PHP API, admin area, and database included in this project. The connected shopping pages are in `frontend/`, and Apache redirects the site root to that storefront.

## Project at a glance

Kape is a web store with a customer-facing storefront and an admin area. The frontend contains the pages customers use. The PHP backend provides the API, validates requests, applies business rules, and accesses the database. The admin pages use the same API with administrator-only permissions.

```text
kape/
├── frontend/             Customer storefront
├── backend/              PHP API and business logic
├── admin/                Store management interface
├── database/             Database schema, sample data, migrations
├── uploads/products/     Product images stored by the application
├── .env                  Local secrets and environment-specific settings
├── .gitignore            Files Git should not track
└── README.md             Project and setup guide (this file)
```

## Directory and file responsibilities

### `frontend/` — customer storefront

#### Pages

| File | Responsibility |
| --- | --- |
| `home.html` | Store homepage, featured products, promotions, and links into the menu. |
| `menu.html` | Browse, search, and filter the product catalog. |
| `product.html` | Show one product's image, description, price, and add-to-cart action. Read the product ID from the URL. |
| `cart.html` | Show cart contents, quantities, item totals, and order subtotal. |
| `checkout.html` | Collect delivery and contact details, validate the order, and submit checkout. |
| `order-success.html` | Confirm a completed order and show its reference. |
| `me.html` | Protected customer account with profile settings, active order progress, order history, and updates. |
| `login.html` | Sign in an existing customer. |
| `register.html` | Create a customer account. |
| `account.html`, `orders.html` | Legacy links that redirect to the protected Me account. |

#### `assets/`

- Product imagery and other static artwork live under `frontend/assets/` and the project-level image files used by seeded products.

#### `css/`

- `main.css` — global design tokens, typography, page layout, and base element styles.
- `components.css` — reusable components such as buttons, product cards, forms, navigation, and notices.
- `responsive.css` — tablet and mobile layout adjustments.
- `animations.css` — transitions and motion effects; respect reduced-motion preferences.
- `home.css`, `storefront.css`, `login.css`, `register.css`, `me.css`, and `checkout.css` — page-specific styles retained where page layouts differ substantially.

Each page links only the shared styles and page-specific styles it uses. Keep page styles separate when merging them would make the shared files harder to understand.

#### `js/`

- `config.js` — shared shop metadata, PHP currency formatting, and the API base URL.
- `api.js` — shared request helper, JSON handling, CSRF token handling, and consistent API errors.
- `auth.js` — login, registration, logout, and current-customer session behavior.
- `menu.js` — product catalog loading, search, filters, product rendering, and add-to-cart actions.
- `cart.js` — cart state and shared slide-out cart. The server recalculates prices and stock during checkout.
- `cart-page.js` — full cart page rendering and quantity/removal actions.
- `checkout.js` — checkout form validation and order submission.
- `me.js` — protected profile, order history, order progress, notifications, and reorder behavior.
- `orders.js` — order confirmation behavior.
- `animations.js` — optional UI animation behavior.

Keep page scripts focused on their page behavior and share common network behavior through `api.js`. Do not put database credentials or payment secrets in frontend JavaScript.

### `backend/` — PHP API

#### `config/`

- `database.php` — creates and returns the database connection using settings from the environment.
- `env.php` — reads environment configuration and provides safe defaults for non-secret settings. Do not commit real secrets.
- `payment.php` — server-side payment provider configuration and integration helpers. Keep secret keys on the server.

#### `controllers/`

Controllers accept HTTP requests, validate input, call models or services, and return consistent JSON responses. They should not contain raw SQL scattered through request handling.

- `AuthController.php` — registration, login, logout, and authentication endpoints.
- `ProductController.php` — product listing, product details, and product management endpoints.
- `CategoryController.php` — category listing and management endpoints.
- `CartController.php` — cart operations if carts are stored or validated through the API.
- `OrderController.php` — checkout, order lookup, customer order history, and order status operations.
- `PaymentController.php` — payment records and available payment endpoints; live provider processing is not configured.
- `CustomerController.php` — customer profile and customer management endpoints.
- `InventoryController.php` — stock levels and inventory adjustments.
- `DashboardController.php` — summary data for the admin dashboard.

#### `models/`

Models own database reads and writes for their data. Use prepared statements and validate data at the controller or service boundary.

- `User.php` — customer and administrator records, including password hashes.
- `Product.php` — product data, price, availability, and product queries.
- `Category.php` — product category data.
- `Order.php` — order records, totals, customer association, and status.
- `OrderItem.php` — product snapshots and quantities belonging to an order.
- `Payment.php` — payment records and provider references.
- `Inventory.php` — stock counts and stock movements.
- `Coupon.php` — coupon data model retained for future coupon support; there is no active coupon workflow yet.

#### `routes/api.php`

Maps explicit `/api/v1/...` request paths to controller actions. It is the source of truth for active routes; consult it before adding or changing an endpoint.

#### `middleware/`

- `AuthMiddleware.php` — verifies a customer session or token before protected customer actions.
- `AdminMiddleware.php` — verifies the authenticated user has administrator privileges before admin actions.

Authorization must be checked on the server for every protected operation. Hiding an admin button in the browser is not access control.

### `admin/` — store management interface

| File | Responsibility |
| --- | --- |
| `index.html` | Admin dashboard with sales, order, and inventory summaries. |
| `login.html` | Dedicated administrator sign-in page. |
| `products.html` | Create, edit, archive, and review products. |
| `categories.html` | Manage product categories. |
| `orders.html` | Review orders and update allowed order statuses. |
| `customers.html` | View customer records with appropriate access controls. |
| `inventory.html` | Review stock and record inventory changes. |
| `payments.html` | Review payment status and provider references. |
| `reports.html` | View sales and operational reports. |
| `settings.html` | Manage non-secret store settings. |

`css/admin.css` contains admin-specific styling. The scripts in `js/` provide the page behavior: `dashboard.js` for summaries, `products.js` for products, `orders.js` for order management, `inventory.js` for stock, and `reports.js` for report views. Admin scripts should call the backend API and rely on server-side admin authorization.

### `database/` — data definitions

- `schema.sql` — initial table definitions, indexes, and constraints.
- `seed.sql` — optional development sample data. Never put real customer data or production passwords here.
- `kape.sql` — a safe, combined demo import containing the schema and sample catalog only; it does not contain customer accounts or orders.
- `migrations/` — incremental, ordered database changes after the initial schema. Apply and record migrations consistently across environments.

Typical relationships include products belonging to categories, orders belonging to customers, order items belonging to orders, and payment records referencing orders. Store a snapshot of item name and price on each order item so past orders remain accurate after a product changes.

### `uploads/products/`

Stores uploaded product images. Validate file type and size on the server, generate safe filenames, and prevent uploaded files from being executed as code. In production, consider object storage instead of the application server's local disk.

### Root configuration files

- `.env` — local database settings, API configuration, and secret keys. Keep it out of version control. Provide a `.env.example` containing placeholder values so developers know which settings are required.
- `.gitignore` — at minimum, ignore `.env`, local logs, temporary files, and generated or private uploads as appropriate for the project.
- `README.md` — this guide, plus setup and run instructions as the implementation becomes available.

## How a customer order flows

1. The menu page requests products from the API and renders the returned catalog.
2. The customer adds products to the cart. The browser may keep a temporary cart for convenience, but it is not a trusted source for prices or stock.
3. Checkout sends product identifiers, quantities, customer details, and delivery choices to the API.
4. The backend verifies the customer and request, reloads current product prices and stock, recalculates totals, and creates the order and order items in a database transaction.
5. The order is saved with pending payment status. No provider currently collects payment.
6. The success page displays the order reference. Signed-in customers can view order progress, history, and updates in Me.

## API overview

The following implemented endpoints are used by the current pages. `backend/routes/api.php` lists the complete route table.

| Method | Example path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/products` | List active products with optional search and category filters. |
| `GET` | `/api/v1/products/{id}` | Get one product. |
| `GET` | `/api/v1/categories` | List active categories. |
| `POST` | `/api/v1/auth/register` | Register a customer. |
| `POST` | `/api/v1/auth/login` | Sign in a customer. |
| `POST` | `/api/v1/orders` | Validate checkout and create an order. |
| `GET` | `/api/v1/account/dashboard` | Return the authenticated customer's profile, orders, and notifications. |
| `PATCH` | `/api/v1/account` | Update the authenticated customer's profile and delivery address. |
| `POST` | `/api/v1/account/password` | Change the authenticated customer's password. |
| `GET` | `/api/v1/admin/dashboard` | Return admin dashboard metrics (admin session required). |

Admin endpoints require server-side authentication and admin authorization middleware. Payment provider webhooks are not implemented; checkout records pending payment without collecting it.

## Local setup with XAMPP

The current project can run from XAMPP's Apache and MySQL services:

1. Place the project folder at `C:\xampp\htdocs\kape` (or use the equivalent `htdocs` path on your machine).
2. Open the XAMPP Control Panel and start **Apache** and **MySQL**.
3. Open `http://localhost/phpmyadmin`, create a database named `kape` using `utf8mb4_unicode_ci`, then import `database/kape.sql` for the schema and sample catalog. For an existing KAPE database, back it up and apply only the migrations it still needs, in order, as described in `database/migrations/README.md`.
4. Copy `.env.example` to `.env`. The defaults use XAMPP's usual local MySQL settings (`127.0.0.1`, port `3306`, user `root`, and a blank password). Update them if your MySQL credentials differ. Keep `.env` private and out of version control.
5. Open the connected storefront at `http://localhost/kape/` (or directly at `http://localhost/kape/frontend/home.html`) and the admin sign-in page at `http://localhost/kape/admin/login.html`. The API entry point is `http://localhost/kape/api/v1`.
6. Create a customer account at `http://localhost/kape/frontend/register.html`. To grant it administrator access for local development, run this in phpMyAdmin after replacing the email with that account's email:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
   ```

   Admin APIs verify this role against MySQL on every protected request. Then open `http://localhost/kape/admin/login.html` and sign in with that account. There is no public admin registration form.

The root `.htaccess` sends `/api/...` requests to the PHP front controller and leaves static files accessible. If Apache does not apply the rewrite, confirm that `mod_rewrite` is enabled in `C:\xampp\apache\conf\httpd.conf` and that the Apache directory configuration permits `.htaccess` overrides (`AllowOverride All`), then restart Apache. Checkout creates pending orders; it does not charge customers because a payment provider adapter and verified webhook are not implemented.

### Implemented flows and current limits

- Customers can browse active products and categories, keep a browser cart, open a slide-out cart with a live item count, validate current prices and stock, sign in before checkout (returning to checkout afterward), place orders, and view order progress from Me.
- Customers can register, sign in, and use the protected Me account for their profile, address, optional OpenStreetMap pin, password, current order progress, order history, reorder, and order notifications. Delivery coordinates are validated on the server, stored with the account, and copied to delivery orders. Protected account and order APIs derive the customer ID from the server session. State-changing requests use a session CSRF token.
- Admin API routes enforce the `admin` role. Admin pages show dashboard summaries, manage products and categories, update order status, adjust inventory, and view customer/payment records and a recent-order report.
- Product image paths can be entered in product management. Upload handling is not implemented yet; the upload directory blocks script execution.
- Payment processing is disabled until a provider adapter and signature-verified webhook are configured. Store settings currently live in server configuration rather than an editable admin API.
- There is no automated migration runner. Apply `database/schema.sql` to a new database before importing sample data. Existing databases should apply applicable numbered migrations once in order; see `database/migrations/README.md`.

## Adding a feature

Start with the relevant page in `frontend/` or `admin/`, then find its page script and styles. Add or update the endpoint in `backend/routes/api.php`, put request handling in the appropriate controller, and keep database reads and writes in its model where practical. Add schema changes as a new numbered migration and document it in `database/migrations/README.md`. Update `docs/architecture.md` when dependencies or routes change.

## Important implementation rules

- Hash passwords with PHP's password hashing functions; never store plain-text passwords.
- Use prepared SQL statements, validate input on the server, and return only the data each caller is allowed to see.
- Recalculate prices, discounts, tax, delivery fees, and stock on the server during checkout.
- Use database transactions for order creation and related stock/payment records.
- Protect state-changing requests against CSRF when using cookie-based sessions; configure cookies securely.
- Do not expose secrets, payment credentials, or private customer data in frontend files or logs.
- Provide clear loading, success, and error messages, and make forms usable by keyboard and assistive technology.
