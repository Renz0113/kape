<?php
declare(strict_types=1);
final class AdminCatalogController
{
    public static function categories(PDO $db): never { require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();apiSuccess($db->query('SELECT id,name,slug,description,is_active,sort_order FROM categories ORDER BY sort_order,name')->fetchAll()); }
    public static function saveCategory(PDO $db,?int $id=null): never
    {
        require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();requireCsrf();$in=requestJson();$name=trim((string)($in['name']??''));$slug=strtolower(trim((string)($in['slug']??'')));$description=trim((string)($in['description']??''));$sort=(int)($in['sort_order']??0);
        if($name===''||mb_strlen($name)>100||!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/',$slug)||mb_strlen($description)>500)apiError('VALIDATION_ERROR','Provide a category name and URL-safe slug.',422);
        if($id===null){$s=$db->prepare('INSERT INTO categories(name,slug,description,sort_order) VALUES(:name,:slug,:description,:sort)');$s->execute(['name'=>$name,'slug'=>$slug,'description'=>$description,'sort'=>$sort]);apiSuccess(['id'=>(int)$db->lastInsertId()],201);}
        $exists=$db->prepare('SELECT id FROM categories WHERE id=:id');$exists->execute(['id'=>$id]);if(!$exists->fetchColumn())apiError('NOT_FOUND','Category not found.',404);$s=$db->prepare('UPDATE categories SET name=:name,slug=:slug,description=:description,sort_order=:sort WHERE id=:id');$s->execute(['name'=>$name,'slug'=>$slug,'description'=>$description,'sort'=>$sort,'id'=>$id]);apiSuccess(['updated'=>true]);
    }
    public static function archiveCategory(PDO $db,int $id): never { require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();requireCsrf();$s=$db->prepare('UPDATE categories SET is_active=0 WHERE id=:id');$s->execute(['id'=>$id]);if(!$s->rowCount())apiError('NOT_FOUND','Category not found or already archived.',404);apiSuccess(['archived'=>true]); }
}
