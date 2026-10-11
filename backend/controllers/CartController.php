<?php
declare(strict_types=1);
final class CartController
{
    // Cart contents are kept in the browser. Checkout always reloads prices and stock on the server.
    public static function validate(PDO $db): never
    {
        $items=requestJson()['items']??[];if(!is_array($items)||count($items)>50)apiError('VALIDATION_ERROR','Cart must contain at most 50 items.',422);$ids=[];foreach($items as $row){$id=(int)($row['product_id']??0);$qty=(int)($row['quantity']??0);if($id<1||$qty<1||$qty>50)apiError('VALIDATION_ERROR','Cart item is invalid.',422);$ids[$id]=$qty;}
        if(!$ids){apiSuccess(['items'=>[],'subtotal'=>'0.00']);}$marks=implode(',',array_fill(0,count($ids),'?'));$stmt=$db->prepare("SELECT id,name,price,image_path,stock_quantity FROM products WHERE is_active=1 AND id IN ($marks)");$stmt->execute(array_keys($ids));$products=$stmt->fetchAll();if(count($products)!==count($ids))apiError('CART_CHANGED','One or more drinks are no longer available. Update your cart and try again.',409);$out=[];$subtotal=0.0;foreach($products as $p){$qty=$ids[(int)$p['id']];$line=round((float)$p['price']*$qty,2);$subtotal+=$line;$out[]=['product_id'=>(int)$p['id'],'name'=>$p['name'],'image_path'=>$p['image_path'],'unit_price'=>$p['price'],'quantity'=>$qty,'available'=>(int)$p['stock_quantity'] >= $qty,'line_total'=>number_format($line,2,'.','')];}apiSuccess(['items'=>$out,'subtotal'=>number_format($subtotal,2,'.','')]);
    }
}
