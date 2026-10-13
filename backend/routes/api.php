<?php
declare(strict_types=1);

require_once __DIR__ . '/../http/response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/ProductController.php';
require_once __DIR__ . '/../controllers/CategoryController.php';
require_once __DIR__ . '/../controllers/CartController.php';
require_once __DIR__ . '/../controllers/OrderController.php';
require_once __DIR__ . '/../controllers/PaymentController.php';
require_once __DIR__ . '/../controllers/CustomerController.php';
require_once __DIR__ . '/../controllers/InventoryController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/AdminCatalogController.php';
require_once __DIR__ . '/../controllers/AdminUserController.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    $forwardedProtocol = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0]));
    $isSecureRequest = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $forwardedProtocol === 'https';
    session_set_cookie_params(['httponly'=>true, 'secure'=>$isSecureRequest, 'samesite'=>'Lax', 'path'=>'/']);
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = $_SERVER['HTTP_X_KAPE_ORIGINAL_URI'] ?? $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH) ?: '/';
$apiPosition = strpos($requestPath, '/api/v1');
$path = $apiPosition === false ? '/' : substr($requestPath, $apiPosition + strlen('/api/v1'));
$path = '/' . trim($path, '/');
try {
$db = databaseConnection();

if ($path === '/' && $method === 'GET') apiSuccess(['name'=>'KAPE API','version'=>'v1','csrf_token'=>($_SESSION['csrf'] ??= bin2hex(random_bytes(32)))]);
if ($path === '/csrf' && $method === 'GET') AuthController::csrf();
if ($path === '/auth/session' && $method === 'GET') AuthController::current($db);
if ($path === '/products' && $method === 'GET') ProductController::index($db);
if ($method === 'GET' && preg_match('~^/products/(\d+)$~', $path, $m)) ProductController::show($db,(int)$m[1]);
if ($path === '/categories' && $method === 'GET') CategoryController::index($db);
if ($path === '/cart/validate' && $method === 'POST') CartController::validate($db);
if ($path === '/auth/register' && $method === 'POST') AuthController::register($db);
if ($path === '/auth/login' && $method === 'POST') AuthController::login($db);
if ($path === '/auth/logout' && $method === 'POST') AuthController::logout();
if ($path === '/account' && $method === 'GET') CustomerController::profile($db);
if ($path === '/account' && $method === 'PATCH') CustomerController::update($db);
if ($path === '/account/password' && $method === 'POST') CustomerController::changePassword($db);
if ($path === '/account/dashboard' && $method === 'GET') CustomerController::dashboard($db);
if ($path === '/account/orders' && $method === 'GET') OrderController::history($db);
if ($path === '/orders' && $method === 'POST') OrderController::create($db);
if ($path === '/payments/webhook' && $method === 'POST') PaymentController::webhook($db);
if ($path === '/admin/dashboard' && $method === 'GET') DashboardController::summary($db);
if ($path === '/admin/products' && $method === 'GET') ProductController::adminIndex($db);
if ($path === '/admin/products' && $method === 'POST') ProductController::save($db);
if ($method === 'PATCH' && preg_match('~^/admin/products/(\d+)$~',$path,$m)) ProductController::save($db,(int)$m[1]);
if ($method === 'DELETE' && preg_match('~^/admin/products/(\d+)$~',$path,$m)) ProductController::archive($db,(int)$m[1]);
if ($path === '/admin/categories' && $method === 'GET') AdminCatalogController::categories($db);
if ($path === '/admin/categories' && $method === 'POST') AdminCatalogController::saveCategory($db);
if ($method === 'PATCH' && preg_match('~^/admin/categories/(\d+)$~',$path,$m)) AdminCatalogController::saveCategory($db,(int)$m[1]);
if ($method === 'DELETE' && preg_match('~^/admin/categories/(\d+)$~',$path,$m)) AdminCatalogController::archiveCategory($db,(int)$m[1]);
if ($path === '/admin/orders' && $method === 'GET') OrderController::adminList($db);
if ($method === 'PATCH' && preg_match('~^/admin/orders/(\d+)$~',$path,$m)) OrderController::updateStatus($db,(int)$m[1]);
if ($path === '/admin/customers' && $method === 'GET') CustomerController::adminList($db);
if ($path === '/admin/users' && $method === 'GET') AdminUserController::index($db);
if ($path === '/admin/users' && $method === 'POST') AdminUserController::create($db);
if ($path === '/admin/inventory' && $method === 'GET') InventoryController::index($db);
if ($path === '/admin/inventory' && $method === 'POST') InventoryController::adjust($db);
if ($path === '/admin/payments' && $method === 'GET') PaymentController::adminList($db);

if ($method === 'OPTIONS') { http_response_code(204); exit; }
apiError('NOT_FOUND', 'The requested API route was not found.', 404);
} catch (Throwable $error) {
    error_log('[KAPE API] ' . $error->getMessage());
    apiError('SERVER_ERROR', 'The server could not complete this request.', 500);
}
