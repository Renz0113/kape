<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/Product.php';

final class ProductController
{
    private const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    public static function index(PDO $db): never
    {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 24)));
        $items = (new Product($db))->list(
            trim((string)($_GET['search'] ?? '')),
            isset($_GET['category']) ? max(1, (int)$_GET['category']) : null,
            $limit,
            ($page - 1) * $limit
        );
        apiSuccess(['items' => $items, 'page' => $page, 'limit' => $limit]);
    }

    public static function show(PDO $db, int $id): never
    {
        $item = (new Product($db))->find($id);
        if (!$item) apiError('NOT_FOUND', 'Product not found.', 404);
        apiSuccess($item);
    }

    public static function adminIndex(PDO $db): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        requireAdmin();
        apiSuccess((new Product($db))->list('', null, 100, 0, true));
    }

    public static function save(PDO $db, ?int $id = null): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        $admin = requireAdmin();
        requireCsrf();

        if (str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data')) {
            $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
            if ($contentLength > self::MAX_IMAGE_BYTES + 65536) {
                apiError('IMAGE_TOO_LARGE', 'Choose an image smaller than 5 MB.', 413);
            }
            $input = $_POST;
        } else {
            $input = requestJson();
        }

        $name = trim((string)($input['name'] ?? ''));
        $slug = strtolower(trim((string)($input['slug'] ?? '')));
        $price = $input['price'] ?? null;
        $category = isset($input['category_id']) ? (int)$input['category_id'] : null;
        $stock = (int)($input['stock_quantity'] ?? 0);
        $description = trim((string)($input['description'] ?? ''));
        if ($name === '' || mb_strlen($name) > 160 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)
            || !is_numeric($price) || (float)$price < 0 || $stock < 0 || $stock > 1000000) {
            apiError('VALIDATION_ERROR', 'Provide a name, URL-safe slug, non-negative price, and valid stock count.', 422);
        }

        $existing = null;
        if ($id !== null) {
            $find = $db->prepare('SELECT id,image_path,stock_quantity FROM products WHERE id=:id LIMIT 1');
            $find->execute(['id' => $id]);
            $existing = $find->fetch();
            if (!$existing) apiError('NOT_FOUND', 'Product not found.', 404);
        }

        $oldImage = $existing['image_path'] ?? null;
        $newImage = null;
        $imageAction = $input['image_action'] ?? null;
        if ($imageAction !== null) {
            if (!in_array($imageAction, ['keep', 'replace', 'remove'], true)) {
                apiError('VALIDATION_ERROR', 'Choose a valid product image action.', 422);
            }
            if ($imageAction === 'keep') {
                if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
                    apiError('VALIDATION_ERROR', 'Choose Replace image or remove the selected file.', 422);
                }
                $newImage = $oldImage;
            } elseif ($imageAction === 'remove') {
                $newImage = null;
            } else {
                $newImage = self::storeUploadedImage($_FILES['image'] ?? null);
            }
        } elseif (array_key_exists('image_path', $input)) {
            $newImage = trim((string)$input['image_path']) ?: null;
            if ($newImage !== null && !self::isSafeRelativeImagePath($newImage)) {
                apiError('VALIDATION_ERROR', 'Image path must be a safe relative JPG, PNG, or WebP file path.', 422);
            }
        } else {
            $newImage = $oldImage;
        }

        $values = [
            'category' => $category ?: null,
            'name' => $name,
            'slug' => $slug,
            'description' => $description,
            'price' => number_format((float)$price, 2, '.', ''),
            'image' => $newImage,
            'stock' => $stock,
        ];

        try {
            $db->beginTransaction();
            if ($id === null) {
                $statement = $db->prepare('INSERT INTO products(category_id,name,slug,description,price,image_path,stock_quantity) VALUES(:category,:name,:slug,:description,:price,:image,:stock)');
                $statement->execute($values);
                $newId = (int)$db->lastInsertId();
                if ($stock > 0) {
                    $db->prepare('INSERT INTO inventory_movements(product_id,quantity_change,reason,created_by) VALUES(:product_id,:quantity,:reason,:admin_id)')->execute([
                        'product_id' => $newId,
                        'quantity' => $stock,
                        'reason' => 'Initial product stock',
                        'admin_id' => (int)$admin['id'],
                    ]);
                }
                $db->commit();
                apiSuccess(['id' => $newId], 201);
            }

            $lock = $db->prepare('SELECT stock_quantity FROM products WHERE id=:id FOR UPDATE');
            $lock->execute(['id' => $id]);
            $currentProduct = $lock->fetch();
            if (!$currentProduct) throw new DomainException('Product not found.');
            $stockChange = $stock - (int)$currentProduct['stock_quantity'];

            $values['id'] = $id;
            $statement = $db->prepare('UPDATE products SET category_id=:category,name=:name,slug=:slug,description=:description,price=:price,image_path=:image,stock_quantity=:stock WHERE id=:id');
            $statement->execute($values);
            if ($stockChange !== 0) {
                $db->prepare('INSERT INTO inventory_movements(product_id,quantity_change,reason,created_by) VALUES(:product_id,:quantity,:reason,:admin_id)')->execute([
                    'product_id' => $id,
                    'quantity' => $stockChange,
                    'reason' => 'Stock adjusted from Products page',
                    'admin_id' => (int)$admin['id'],
                ]);
            }
            $db->commit();
            if ($oldImage !== $newImage) self::removeUnusedUploadedImage($db, $oldImage);
            apiSuccess(['updated' => true]);
        } catch (DomainException $error) {
            if ($db->inTransaction()) $db->rollBack();
            if ($newImage !== $oldImage) self::removeUnusedUploadedImage($db, $newImage);
            apiError('NOT_FOUND', $error->getMessage(), 404);
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            if ($newImage !== $oldImage) self::removeUnusedUploadedImage($db, $newImage);
            throw $error;
        }
    }

    public static function archive(PDO $db, int $id): never
    {
        require_once __DIR__ . '/../middleware/AdminMiddleware.php';
        requireAdmin();
        requireCsrf();
        $statement = $db->prepare('UPDATE products SET is_active=0 WHERE id=:id');
        $statement->execute(['id' => $id]);
        if (!$statement->rowCount()) apiError('NOT_FOUND', 'Product not found or already archived.', 404);
        apiSuccess(['archived' => true]);
    }

    private static function storeUploadedImage(?array $file): string
    {
        if ($file === null || !isset($file['error'])) {
            apiError('IMAGE_REQUIRED', 'Choose an image to upload.', 422);
        }
        if ($file['error'] === UPLOAD_ERR_NO_FILE) {
            apiError('IMAGE_REQUIRED', 'Choose an image to upload.', 422);
        }
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE || ($file['size'] ?? 0) > self::MAX_IMAGE_BYTES) {
            apiError('IMAGE_TOO_LARGE', 'Choose an image smaller than 5 MB.', 413);
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'] ?? '')) {
            apiError('INVALID_IMAGE_UPLOAD', 'The image could not be uploaded. Choose it again and retry.', 422);
        }

        $imageInfo = @getimagesize($file['tmp_name']);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!$imageInfo || !isset($extensions[$mime]) || ($imageInfo['mime'] ?? '') !== $mime
            || $imageInfo[0] > 8000 || $imageInfo[1] > 8000 || ($imageInfo[0] * $imageInfo[1]) > 40000000) {
            apiError('INVALID_IMAGE_TYPE', 'Use a valid JPG, JPEG, PNG, or WEBP image.', 422);
        }

        $directory = dirname(__DIR__, 2) . '/uploads/products';
        if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
            apiError('IMAGE_STORAGE_UNAVAILABLE', 'Product image storage is unavailable. Contact the site administrator.', 500);
        }
        $filename = 'kape_' . bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
        if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
            apiError('IMAGE_STORAGE_FAILED', 'The product image could not be saved. Check uploads/products folder permissions.', 500);
        }
        return '../uploads/products/' . $filename;
    }

    private static function isSafeRelativeImagePath(string $path): bool
    {
        return mb_strlen($path) <= 500
            && !str_contains($path, "\0")
            && !str_starts_with($path, '/')
            && !preg_match('~(?:^|/)\.\.(?:/|$)~', $path)
            && (bool)preg_match('~^(?:\.\./)?[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)$~i', $path);
    }

    private static function removeUnusedUploadedImage(PDO $db, ?string $path): void
    {
        if (!$path || !preg_match('~^\.\./uploads/products/(kape_[a-f0-9]{32}\.(?:jpg|png|webp))$~i', $path, $matches)) return;
        $references = $db->prepare('SELECT COUNT(*) FROM products WHERE image_path=:path');
        $references->execute(['path' => $path]);
        if ((int)$references->fetchColumn() > 0) return;

        $directory = realpath(dirname(__DIR__, 2) . '/uploads/products');
        if ($directory === false) return;
        $file = realpath($directory . DIRECTORY_SEPARATOR . $matches[1]);
        if ($file !== false && dirname($file) === $directory && is_file($file)) @unlink($file);
    }
}
