<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/Category.php';
final class CategoryController { public static function index(PDO $db): never { apiSuccess((new Category($db))->active()); } }
