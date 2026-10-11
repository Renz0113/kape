# KAPE reference map

This map was checked against the current HTML script/style references, PHP includes, API routes, and application code. Update it when page dependencies or routes change.

## Request flow

```text
Browser page
  -> frontend/js/config.js (API URL and shared shop values)
  -> frontend/js/api.js (shared API client)
  -> /api/v1/* (.htaccess rewrite)
  -> backend/routes/api.php
  -> controller
  -> model or controller-owned SQL
  -> MySQL tables in database/schema.sql plus applied migrations
```

Admin pages load the same configuration and API client, with `admin/js/common.js` adding `adminRequest`, navigation, session UI, and error helpers. Authorization remains enforced by PHP middleware.

## Customer pages and dependencies

| Page | Styles | Scripts and behavior |
| --- | --- | --- |
| `frontend/home.html` | `main.css`, `components.css`, `responsive.css`, `animations.css`, `home.css` | `api.js`, `cart.js`, `menu.js`, `animations.js` |
| `frontend/menu.html` | shared styles, `animations.css`, `storefront.css` | `api.js`, `cart.js`, `menu.js` |
| `frontend/product.html` | shared styles, `storefront.css` | `api.js`, `cart.js`, inline product loading and add-to-cart behavior |
| `frontend/cart.html` | shared styles, `storefront.css` | `api.js`, `cart.js`, `cart-page.js` |
| `frontend/checkout.html` | shared styles, `checkout.css` | `api.js`, `cart.js`, `checkout.js` |
| `frontend/login.html` | shared styles, `login.css` | `api.js`, `cart.js`, `auth.js` |
| `frontend/register.html` | shared styles, `login.css`, `register.css` | `api.js`, `cart.js`, `auth.js` |
| `frontend/me.html` | shared styles, `me.css` | `api.js`, `cart.js`, `me.js` |
| `frontend/order-success.html` | shared styles | `api.js`, `cart.js`, `orders.js` |
| `frontend/privacy.html`, `frontend/terms.html` | `main.css`, `components.css`, `login.css` | Static policy content |
| `frontend/account.html`, `frontend/orders.html` | none | Compatibility redirects to `me.html` |

`main.css`, `components.css`, and `responsive.css` form the shared customer UI foundation. Page styles remain separate where the home, authentication, account, checkout, and storefront layouts have distinct needs.

`frontend/js/config.js` provides the shared PHP currency formatter and derives the API base from its own script URL. The common request client in `api.js` handles same-origin credentials and CSRF token refresh/retry. `cart.js` owns browser cart state and the shared slide-out cart; `cart-page.js` renders the full cart page.

## Admin pages and dependencies

All admin pages load `admin/css/admin.css` and `admin/js/common.js`. The common script provides `adminRequest`, `showError`, `escAdmin`, and admin session/navigation handling. Page scripts are:

| Page | Page script |
| --- | --- |
| `admin/index.html` | `dashboard.js` |
| `admin/login.html` | `login.js` |
| `admin/products.html` | `products.js` |
| `admin/categories.html` | `categories.js` |
| `admin/orders.html` | `orders.js` |
| `admin/inventory.html` | `inventory.js` |
| `admin/users.html` | `users.js` |
| `admin/reports.html` | `reports.js` |
| `admin/customers.html`, `admin/payments.html` | Small inline API renderers |
| `admin/settings.html` | Static settings guidance |

## Backend route map

`backend/routes/api.php` is the only HTTP route table. It loads the response/config files and controllers, then routes:

- `/csrf`, `/auth/*` -> `AuthController` (users via `User` model)
- `/products*` -> `ProductController` (`Product` model)
- `/categories` -> `CategoryController` (`Category` model)
- `/cart/validate` -> `CartController`
- `/account*` -> `CustomerController` (`Order`, `OrderItem` models)
- `/orders*` -> `OrderController` (`Order`, `OrderItem` models)
- `/payments/*` -> `PaymentController` and `config/payment.php`
- `/admin/inventory` -> `InventoryController` (`Inventory` model)
- `/admin/dashboard` -> `DashboardController`
- `/admin/categories*` -> `AdminCatalogController`
- `/admin/users*` -> `AdminUserController`

`AuthMiddleware.php` checks signed-in sessions and CSRF tokens; `AdminMiddleware.php` also checks the administrator role. Database connection and environment parsing stay under `backend/config/`.

## Database and asset references

- `database/schema.sql` defines the fresh-install schema; `database/seed.sql` supplies development data.
- `database/migrations/` contains ordered changes for existing databases; see its README before applying them.
- Product images are referenced by product `image_path` values and served from the project assets/uploads. `uploads/products/.htaccess` blocks script execution in that directory.
- Root `.htaccess` redirects the site root to the storefront and rewrites `/api/*` to the API front controller.

## Verified legacy files

Root `app.js` and `styles.css` belonged to an older layout: no current page referenced them, and their selectors (such as `.menu-toggle`, `.main-nav`, and `.splash-video`) are absent from active pages. They are removed after this map was recorded. No other files were removed as part of the reference audit.

The unused `admin/css/admin-actions.css` rules were merged into `admin/css/admin.css`, which now contains the admin styles in one linked stylesheet. That source stylesheet was removed after checking its sole import.
