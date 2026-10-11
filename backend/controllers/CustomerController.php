<?php
declare(strict_types=1);
require_once __DIR__.'/../middleware/AuthMiddleware.php';
require_once __DIR__.'/../models/Order.php';
require_once __DIR__.'/../models/OrderItem.php';

final class CustomerController
{
    public static function profile(PDO $db): never
    {
        $user=requireUser();$stmt=$db->prepare('SELECT id,name,email,phone,delivery_address,delivery_latitude,delivery_longitude,created_at FROM users WHERE id=:id LIMIT 1');$stmt->execute(['id'=>(int)$user['id']]);$profile=$stmt->fetch();
        if(!$profile)apiError('UNAUTHENTICATED','Please sign in again.',401);apiSuccess($profile);
    }

    public static function update(PDO $db): never
    {
        $user=requireUser();requireCsrf();$input=requestJson();
        $name=trim((string)($input['name']??''));$email=mb_strtolower(trim((string)($input['email']??'')));$phone=trim((string)($input['phone']??''));$address=trim((string)($input['delivery_address']??''));
        $coordinatesProvided=array_key_exists('delivery_latitude',$input)||array_key_exists('delivery_longitude',$input);
        $latitude=self::coordinate($input['delivery_latitude']??null,-90,90,'latitude');
        $longitude=self::coordinate($input['delivery_longitude']??null,-180,180,'longitude');
        if(($latitude===null)!==($longitude===null))apiError('VALIDATION_ERROR','Choose a complete map location or clear both coordinates.',422);
        if($name===''||mb_strlen($name)>120||!filter_var($email,FILTER_VALIDATE_EMAIL)||mb_strlen($email)>254||mb_strlen($phone)>32||mb_strlen($address)>500)apiError('VALIDATION_ERROR','Check your name, email, phone number, and delivery address.',422);
        $check=$db->prepare('SELECT id FROM users WHERE email=:email AND id<>:id LIMIT 1');$check->execute(['email'=>$email,'id'=>(int)$user['id']]);if($check->fetchColumn())apiError('EMAIL_EXISTS','That email is already used by another account.',409);
        try{
            $sql='UPDATE users SET name=:name,email=:email,phone=:phone,delivery_address=:address';
            $values=['name'=>$name,'email'=>$email,'phone'=>$phone?:null,'address'=>$address?:null,'id'=>(int)$user['id']];
            if($coordinatesProvided){$sql.=',delivery_latitude=:latitude,delivery_longitude=:longitude';$values['latitude']=$latitude;$values['longitude']=$longitude;}
            $sql.=' WHERE id=:id';$stmt=$db->prepare($sql);$stmt->execute($values);
        }
        catch(PDOException $error){if($error->getCode()==='23000')apiError('EMAIL_EXISTS','That email is already used by another account.',409);throw $error;}
        $_SESSION['user']['name']=$name;$_SESSION['user']['email']=$email;$_SESSION['user']['phone']=$phone?:null;
        apiSuccess(['name'=>$name,'email'=>$email,'phone'=>$phone?:null,'delivery_address'=>$address?:null,'delivery_latitude'=>$coordinatesProvided?$latitude:null,'delivery_longitude'=>$coordinatesProvided?$longitude:null]);
    }

    public static function changePassword(PDO $db): never
    {
        $user=requireUser();requireCsrf();$input=requestJson();$current=(string)($input['current_password']??'');$next=(string)($input['new_password']??'');
        if(strlen($next)<10||strlen($next)>200)apiError('VALIDATION_ERROR','Your new password must be at least 10 characters.',422);
        $stmt=$db->prepare('SELECT password_hash FROM users WHERE id=:id LIMIT 1');$stmt->execute(['id'=>(int)$user['id']]);$hash=$stmt->fetchColumn();
        if(!$hash||!password_verify($current,(string)$hash))apiError('INVALID_PASSWORD','Your current password is incorrect.',422);
        $update=$db->prepare('UPDATE users SET password_hash=:hash WHERE id=:id');$update->execute(['hash'=>password_hash($next,PASSWORD_DEFAULT),'id'=>(int)$user['id']]);apiSuccess(['updated'=>true]);
    }

    public static function dashboard(PDO $db): never
    {
        $user=requireUser();$orders=(new Order($db))->history((int)$user['id']);$items=new OrderItem($db);
        foreach($orders as &$order){$order['items']=$items->forOrder((int)$order['id']);}unset($order);
        $current=null;foreach($orders as $order){if(in_array($order['status'],['pending','confirmed','preparing','ready'],true)){$current=$order;break;}}
        apiSuccess(['profile'=>self::profileData($db,(int)$user['id']),'current_order'=>$current,'orders'=>$orders,'notifications'=>(new Order($db))->notifications((int)$user['id'])]);
    }

    private static function profileData(PDO $db,int $id): array
    {
        $stmt=$db->prepare('SELECT id,name,email,phone,delivery_address,delivery_latitude,delivery_longitude,created_at FROM users WHERE id=:id LIMIT 1');$stmt->execute(['id'=>$id]);$profile=$stmt->fetch();if(!$profile)apiError('UNAUTHENTICATED','Please sign in again.',401);return $profile;
    }

    public static function adminList(PDO $db): never
    {
        require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();apiSuccess($db->query("SELECT id,name,email,phone,created_at FROM users WHERE role='customer' ORDER BY created_at DESC LIMIT 500")->fetchAll());
    }

    private static function coordinate(mixed $value,float $minimum,float $maximum,string $name): ?float
    {
        if($value===null||$value==='')return null;
        if(!is_numeric($value))apiError('VALIDATION_ERROR','The selected map '.$name.' is invalid.',422);
        $coordinate=(float)$value;
        if(!is_finite($coordinate)||$coordinate<$minimum||$coordinate>$maximum)apiError('VALIDATION_ERROR','The selected map '.$name.' is outside its valid range.',422);
        return $coordinate;
    }
}
