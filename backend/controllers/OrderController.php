<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/Order.php';
require_once __DIR__ . '/../models/OrderItem.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../config/order_status.php';
final class OrderController
{
    public static function create(PDO $db): never
    {
        $user=requireUser();requireCsrf(); $input=requestJson(); $items=$input['items']??[]; $name=trim((string)($input['name']??'')); $email=trim((string)($input['email']??'')); $phone=trim((string)($input['phone']??'')); $fulfillment=$input['fulfillment']??'pickup'; $address=trim((string)($input['address']??'')); $orderNotes=trim((string)($input['order_notes']??''));
        $latitude=self::coordinate($input['delivery_latitude']??null,-90,90,'latitude');$longitude=self::coordinate($input['delivery_longitude']??null,-180,180,'longitude');
        if(($latitude===null)!==($longitude===null))apiError('VALIDATION_ERROR','The delivery location must include both coordinates.',422);
        if (!is_array($items)||count($items)<1||count($items)>50||$name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||$phone===''||mb_strlen($orderNotes)>1000||!in_array($fulfillment,['pickup','delivery'],true)||($fulfillment==='delivery'&&$address==='')) apiError('VALIDATION_ERROR','Complete your contact and fulfillment details and include at least one item.',422);
        $merged=[];foreach($items as $item){$id=(int)($item['product_id']??0);$qty=(int)($item['quantity']??0);if($id<1||$qty<1||$qty>50)apiError('VALIDATION_ERROR','Each item must have a valid product and quantity.',422);$merged[$id]=($merged[$id]??0)+$qty;if($merged[$id]>50)apiError('VALIDATION_ERROR','Maximum quantity per product is 50.',422);}ksort($merged,SORT_NUMERIC);$items=[];foreach($merged as $id=>$qty)$items[]=['product_id'=>$id,'quantity'=>$qty];
        $db->beginTransaction();
        try {
            $subtotal=0.0; $lines=[];
            $find=$db->prepare('SELECT id,name,price,stock_quantity FROM products WHERE id=:id AND is_active=1 FOR UPDATE');
            foreach($items as $item){ $id=(int)$item['product_id']; $qty=(int)$item['quantity']; $find->execute(['id'=>$id]); $p=$find->fetch(); if(!$p||$p['stock_quantity']<$qty) throw new DomainException('A selected drink is unavailable or has insufficient stock.'); $unit=(float)$p['price']; $line=round($unit*$qty,2); $subtotal+=$line; $lines[]=[$p,$qty,$unit,$line]; }
            $fee=$fulfillment==='delivery'?0.0:0.0; $total=round($subtotal+$fee,2); $reference='KP'.strtoupper(bin2hex(random_bytes(5))); $initialStatus=KAPE_ORDER_STATUSES[0];
            $order=$db->prepare('INSERT INTO orders(reference,user_id,customer_name,customer_email,customer_phone,fulfillment,delivery_address,delivery_latitude,delivery_longitude,order_notes,status,subtotal,delivery_fee,total) VALUES(:ref,:uid,:name,:email,:phone,:fulfillment,:address,:latitude,:longitude,:notes,:status,:subtotal,:fee,:total)');
            $order->execute(['ref'=>$reference,'uid'=>$user['id']??null,'name'=>$name,'email'=>mb_strtolower($email),'phone'=>$phone,'fulfillment'=>$fulfillment,'address'=>$fulfillment==='delivery'?$address:null,'latitude'=>$fulfillment==='delivery'?$latitude:null,'longitude'=>$fulfillment==='delivery'?$longitude:null,'notes'=>$orderNotes!==''?$orderNotes:null,'status'=>$initialStatus,'subtotal'=>$subtotal,'fee'=>$fee,'total'=>$total]); $orderId=(int)$db->lastInsertId();
            $db->prepare("INSERT INTO payments(order_id,provider,amount,status) VALUES(:order_id,'not_configured',:amount,'pending')")->execute(['order_id'=>$orderId,'amount'=>$total]);
            $db->prepare('INSERT INTO order_status_history(order_id,status,message) VALUES(:order_id,:status,:message)')->execute(['order_id'=>$orderId,'status'=>$initialStatus,'message'=>KAPE_ORDER_STATUS_MESSAGES[$initialStatus]]);
            $insert=$db->prepare('INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES(:oid,:pid,:name,:price,:qty,:line)'); $stock=$db->prepare('UPDATE products SET stock_quantity=stock_quantity-:qty WHERE id=:id'); $movement=$db->prepare('INSERT INTO inventory_movements(product_id,quantity_change,reason,order_id) VALUES(:pid,:change,\'Order placed\',:oid)');
            foreach($lines as [$p,$qty,$unit,$line]){ $insert->execute(['oid'=>$orderId,'pid'=>$p['id'],'name'=>$p['name'],'price'=>$unit,'qty'=>$qty,'line'=>$line]); $stock->execute(['qty'=>$qty,'id'=>$p['id']]); $movement->execute(['pid'=>$p['id'],'change'=>-$qty,'oid'=>$orderId]); }
            $db->commit(); apiSuccess(['reference'=>$reference,'status'=>$initialStatus,'subtotal'=>number_format($subtotal,2,'.',''),'delivery_fee'=>number_format($fee,2,'.',''),'total'=>number_format($total,2,'.','')],201);
        } catch(DomainException $e){ if($db->inTransaction())$db->rollBack(); apiError('ORDER_INVALID',$e->getMessage(),422); }
          catch(Throwable $e){ if($db->inTransaction())$db->rollBack(); throw $e; }
    }
    public static function history(PDO $db): never { $user=requireUser();$orders=(new Order($db))->history((int)$user['id']);$items=new OrderItem($db);foreach($orders as &$order)$order['items']=$items->forOrder((int)$order['id']);unset($order);apiSuccess($orders); }
    public static function adminList(PDO $db): never { require_once __DIR__.'/../middleware/AdminMiddleware.php';requireAdmin();apiSuccess($db->query('SELECT id,reference,customer_name,customer_email,status,fulfillment,delivery_address,delivery_latitude,delivery_longitude,order_notes,total,created_at FROM orders ORDER BY created_at DESC LIMIT 200')->fetchAll()); }
    public static function updateStatus(PDO $db,int $id): never
    {
        require_once __DIR__.'/../middleware/AdminMiddleware.php';$admin=requireAdmin($db);requireCsrf();$input=requestJson();$status=$input['status']??'';
        if(!is_string($status)||!in_array($status,KAPE_ORDER_STATUSES,true))apiError('VALIDATION_ERROR','Invalid order status.',422);
        $db->beginTransaction();
        try{$q=$db->prepare('SELECT status FROM orders WHERE id=:id FOR UPDATE');$q->execute(['id'=>$id]);$order=$q->fetch();if(!$order)throw new DomainException('Order not found.');$current=$order['status'];if(!kape_order_can_transition($current,$status))throw new DomainException('This order status transition is not allowed.');
            if($status==='cancelled'){$items=$db->prepare('SELECT product_id,quantity FROM order_items WHERE order_id=:id AND product_id IS NOT NULL');$items->execute(['id'=>$id]);$restore=$db->prepare('UPDATE products SET stock_quantity=stock_quantity+:qty WHERE id=:pid');$movement=$db->prepare("INSERT INTO inventory_movements(product_id,quantity_change,reason,order_id,created_by) VALUES(:pid,:qty,'Order cancelled',:oid,:admin_id)");foreach($items->fetchAll() as $item){$restore->execute(['qty'=>$item['quantity'],'pid'=>$item['product_id']]);$movement->execute(['pid'=>$item['product_id'],'qty'=>$item['quantity'],'oid'=>$id,'admin_id'=>(int)$admin['id']]);}}
            $db->prepare('UPDATE orders SET status=:status WHERE id=:id')->execute(['status'=>$status,'id'=>$id]);$db->prepare('INSERT INTO order_status_history(order_id,status,message,created_by) VALUES(:order_id,:status,:message,:admin_id)')->execute(['order_id'=>$id,'status'=>$status,'message'=>KAPE_ORDER_STATUS_MESSAGES[$status],'admin_id'=>(int)$admin['id']]);$db->commit();apiSuccess(['updated'=>true,'status'=>$status]);
        }catch(DomainException $e){if($db->inTransaction())$db->rollBack();apiError('ORDER_STATUS_INVALID',$e->getMessage(),422);}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    }

    private static function coordinate(mixed $value,float $minimum,float $maximum,string $name): ?float
    {
        if($value===null||$value==='')return null;
        if(!is_numeric($value))apiError('VALIDATION_ERROR','The delivery '.$name.' is invalid.',422);
        $coordinate=(float)$value;
        if(!is_finite($coordinate)||$coordinate<$minimum||$coordinate>$maximum)apiError('VALIDATION_ERROR','The delivery '.$name.' is outside its valid range.',422);
        return $coordinate;
    }
}
