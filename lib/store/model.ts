export const STORE_ORG_ID='demo-org-powerhouse';
export const STORE_BRANCHES=[{id:'demo-location-kediri',name:'Kediri'},{id:'demo-location-surabaya',name:'Surabaya'},{id:'demo-location-malang',name:'Malang'}];
export const STORE_CATEGORIES=['Beverages','Supplements','Gym Accessories','Merchandise','Snacks','Other'];
export const RESERVATION_MS=15*60*1000;
export interface StoreActor {role:string;organizationId:string;branchIds:string[];memberId?:string;name:string}
export interface StoreProduct {id:string;organizationId:string;name:string;sku:string;barcode:string;category:string;description:string;images:string[];price:number;costPrice:number;stock:Record<string,number>;minimumStock:number;status:'active'|'archived';memberSale:boolean;cashierSale:boolean;featured:boolean}
export interface CartLine {productId:string;quantity:number}
export type PaymentStatus='unpaid'|'pending'|'paid'|'failed'|'refunded';
export type FulfillmentStatus='awaiting_payment'|'preparing'|'ready_for_pickup'|'picked_up'|'cancelled';
export type PaymentMethod='Cash'|'QRIS'|'Bank Transfer'|'Other';
export interface OrderLine {productId:string;name:string;sku:string;price:number;quantity:number}
export interface StoreOrder {id:string;organizationId:string;branchId:string;memberId:string|null;customerName:string;source:'member'|'cashier';lines:OrderLine[];subtotal:number;discount:number;tax:number;total:number;paymentStatus:PaymentStatus;fulfillmentStatus:FulfillmentStatus;paymentMethod:PaymentMethod|null;createdAt:number;expiresAt:number|null;paidAt:number|null;pickedUpAt:number|null;pickupToken:string;requestId:string;requestKey?:string;cancelReason?:string;cashierName?:string;refundedAmount?:number}
export interface InventoryEntry {id:string;productId:string;branchId:string;quantity:number;reason:string;at:number;actor:string}
export interface StoreState {products:StoreProduct[];orders:StoreOrder[];inventory:InventoryEntry[];serial:number;taxRate:number}
export interface StoreResult {state:StoreState;error?:string;orderId?:string}
type WithActor={actor:StoreActor;now?:number};
export type StoreAction=WithActor&(
 | {type:'save-product';product:StoreProduct}
 | {type:'archive-product';productId:string}
 | {type:'adjust-stock';productId:string;branchId:string;quantity:number;reason:string}
 | {type:'create-order';source:'member'|'cashier';branchId:string;lines:CartLine[];memberId?:string|null;customerName:string;discount:number;paymentMethod?:PaymentMethod;requestId:string;pickupToken:string}
 | {type:'pay-order';orderId:string;paymentMethod:PaymentMethod}
 | {type:'ready-order';orderId:string}
 | {type:'pickup-order';orderId:string;token:string;branchId:string}
 | {type:'cancel-order';orderId:string}
 | {type:'tick'}
);
export const storeMoney=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
export function canManageProducts(actor:StoreActor){return ['OWNER','ADMIN','MANAGER'].includes(actor.role);}
export function canViewCost(actor:StoreActor){return ['OWNER','ADMIN'].includes(actor.role);}
export function canSell(actor:StoreActor){return ['OWNER','ADMIN','MANAGER','CASHIER'].includes(actor.role);}
export function canDiscount(actor:StoreActor){return ['OWNER','ADMIN','MANAGER'].includes(actor.role);}
export function memberStoreActor(id:string,name:string):StoreActor{return {role:'MEMBER',organizationId:STORE_ORG_ID,branchIds:STORE_BRANCHES.map(b=>b.id),memberId:id,name};}
export function reservedStock(state:StoreState,productId:string,branchId:string,now=Date.now()):number{return state.orders.filter(o=>o.branchId===branchId&&['unpaid','pending','failed'].includes(o.paymentStatus)&&o.fulfillmentStatus!=='cancelled'&&o.expiresAt!==null&&o.expiresAt>now).reduce((total,o)=>total+o.lines.filter(l=>l.productId===productId).reduce((sum,l)=>sum+l.quantity,0),0);}
export function availableStock(state:StoreState,productId:string,branchId:string,now=Date.now()):number{const product=state.products.find(p=>p.id===productId);return Math.max(0,(product?.stock[branchId]||0)-reservedStock(state,productId,branchId,now));}
export function visibleProducts(state:StoreState,actor:StoreActor,channel:'member'|'cashier'):StoreProduct[]{return state.products.filter(p=>p.organizationId===actor.organizationId&&p.status==='active'&&(channel==='member'?p.memberSale:p.cashierSale));}
export function visibleOrders(state:StoreState,actor:StoreActor):StoreOrder[]{return state.orders.filter(o=>o.organizationId===actor.organizationId&&(actor.role==='MEMBER'?o.memberId===actor.memberId:canSell(actor)&&actor.branchIds.includes(o.branchId)));}
export function createStoreState():StoreState{
 const items=[['water','Mineral Water','Beverages',5000,2500,40],['protein','Protein Shake','Supplements',25000,14000,18],['shaker','Gym Shaker','Gym Accessories',45000,25000,12],['towel','Gym Towel','Merchandise',35000,18000,9],['energy','Energy Drink','Beverages',15000,8000,0],['snack','Protein Bar','Snacks',20000,11000,4]] as const;
 return {products:items.map(([id,name,category,price,costPrice,stock],index)=>({id,organizationId:STORE_ORG_ID,name,sku:`RUP-${id.toUpperCase()}`,barcode:`89900000000${index+1}`,category,description:`${name} for your next workout. Available for pickup at the gym.`,images:[`/store/${id}.svg`],price,costPrice,stock:Object.fromEntries(STORE_BRANCHES.map((b,i)=>[b.id,stock===0?0:stock+i*2])),minimumStock:5,status:'active',memberSale:true,cashierSale:true,featured:index<3})),orders:[],inventory:[],serial:1,taxRate:0};
}
export function expireStoreOrders(state:StoreState,now:number):StoreState{
 let changed=false;const orders=state.orders.map(o=>{if(o.expiresAt!==null&&o.expiresAt<=now&&o.paymentStatus!=='paid'&&o.fulfillmentStatus!=='cancelled'){changed=true;return {...o,fulfillmentStatus:'cancelled' as const,cancelReason:'Stock reservation expired'};}return o;});return changed?{...state,orders}:state;
}

export function storeTransition(input:StoreState,action:StoreAction):StoreResult{
 const now=action.now??Date.now();const state=expireStoreOrders(input,now);const actor=action.actor;
 const fail=(error:string):StoreResult=>({state,error});
 const validBranch=(id:string)=>STORE_BRANCHES.some(b=>b.id===id)&&actor.branchIds.includes(id);
 const integer=(value:number,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
 const owned=(id:string)=>state.products.find(p=>p.id===id&&p.organizationId===actor.organizationId);
 if(action.type==='tick')return {state};
 if(action.type==='save-product'){
  if(!canManageProducts(actor))return fail('Product management permission required.');
  const item=action.product;const existing=state.products.find(p=>p.id===item.id);
  if(item.organizationId!==actor.organizationId||(existing&&existing.organizationId!==actor.organizationId))return fail('Product belongs to another organization.');
  if(!item.id||!item.name.trim()||item.name.length>100||!item.sku.trim()||item.sku.length>60||item.barcode.length>80||!STORE_CATEGORIES.includes(item.category)||!['active','archived'].includes(item.status))return fail('Check product name, SKU, category and status.');
  if(!integer(item.price,1000000000)||!integer(item.costPrice,1000000000)||!integer(item.minimumStock))return fail('Prices and stock limits must be valid nonnegative whole numbers.');
  if(!canViewCost(actor)&&item.costPrice!==(existing?.costPrice||0))return fail('Only an admin can change cost price.');
  if(state.products.some(p=>p.id!==item.id&&p.organizationId===actor.organizationId&&(p.sku.toLowerCase()===item.sku.trim().toLowerCase()||!!item.barcode&&p.barcode===item.barcode)))return fail('SKU or barcode already exists.');
  if(item.images.length>5||item.images.some(image=>image.length>3000000||!(/^(data:image\/(png|jpeg|webp);base64,|https:\/\/|\/store\/)/.test(image))))return fail('Use a supported product image (up to 2 MB, maximum 5 images).');
  if(!existing&&Object.entries(item.stock).some(([branch,quantity])=>!validBranch(branch)||!integer(quantity)))return fail('Initial stock must use an authorized branch and a valid quantity.');
  const product={...item,name:item.name.trim(),sku:item.sku.trim(),barcode:item.barcode.trim(),stock:existing?existing.stock:{...item.stock}};
  return {state:{...state,products:existing?state.products.map(p=>p.id===product.id?product:p):[...state.products,product]}};
 }
 if(action.type==='archive-product'){
  if(!canManageProducts(actor))return fail('Product management permission required.');
  if(!owned(action.productId))return fail('Product not found in this organization.');
  return {state:{...state,products:state.products.map(p=>p.id===action.productId?{...p,status:'archived'}:p)}};
 }
 if(action.type==='adjust-stock'){
  if(!canManageProducts(actor)||!validBranch(action.branchId))return fail('Inventory access denied for this branch.');
  const product=owned(action.productId);if(!product)return fail('Product not found.');
  if(!integer(action.quantity)||!action.reason.trim()||action.reason.length>200)return fail('Enter a nonnegative stock count and a reason (up to 200 characters).');
  if(action.quantity<reservedStock(state,product.id,action.branchId,now))return fail('Physical stock cannot be below active reservations.');
  const delta=action.quantity-(product.stock[action.branchId]||0);
  if(!delta)return {state};
  return {state:{...state,serial:state.serial+1,products:state.products.map(p=>p.id===product.id?{...p,stock:{...p.stock,[action.branchId]:action.quantity}}:p),inventory:[...state.inventory,{id:`INV-${state.serial}`,productId:product.id,branchId:action.branchId,quantity:delta,reason:action.reason.trim(),at:now,actor:actor.name}]}};
 }
 if(action.type==='create-order'){
  if(!validBranch(action.branchId))return fail('Choose an authorized pickup branch.');
  if(action.source==='member'?actor.role!=='MEMBER'||!actor.memberId:!canSell(actor))return fail('You cannot create this type of order.');
  if(!action.requestId||!/^store-demo:[a-f0-9-]{36}$/.test(action.pickupToken))return fail('Generate a valid demo order and pickup token.');
  if(!integer(action.discount,1000000000)||action.discount>0&&(!canDiscount(actor)||action.source==='member'))return fail('Discount is not allowed for this role.');
  if(!action.customerName.trim()||action.customerName.length>100)return fail('Enter a customer name.');
  if(action.source==='cashier'&&!['Cash','QRIS','Bank Transfer','Other'].includes(action.paymentMethod||''))return fail('Choose a payment method.');
  const memberId=action.source==='member'?actor.memberId!:action.memberId||null;
  const requestKey=JSON.stringify([action.source,action.branchId,memberId,action.customerName.trim(),action.lines,action.discount,action.paymentMethod||null]);
  const previous=state.orders.find(o=>o.organizationId===actor.organizationId&&o.requestId===action.requestId);
  if(previous){if(previous.requestKey!==requestKey)return fail('This request was already used for a different order.');return {state,orderId:previous.id};}
  if(!action.lines.length||action.lines.length>100)return fail('Add products to your cart first.');
  const quantities=new Map<string,number>();
  for(const line of action.lines){if(!integer(line.quantity,999)||line.quantity<1)return fail('Quantity must be between 1 and 999.');quantities.set(line.productId,(quantities.get(line.productId)||0)+line.quantity);}
  const lines:OrderLine[]=[];
  for(const [id,quantity] of quantities){const product=owned(id);if(!product||product.status!=='active'||!(action.source==='member'?product.memberSale:product.cashierSale))return fail('A product is unavailable for this channel. Refresh your cart.');if(quantity>999||quantity>availableStock(state,id,action.branchId,now))return fail(`Insufficient stock for ${product.name} at this branch.`);lines.push({productId:id,name:product.name,sku:product.sku,price:product.price,quantity});}
  const subtotal=lines.reduce((sum,l)=>sum+l.price*l.quantity,0);if(action.discount>subtotal)return fail('Discount cannot exceed subtotal.');
  const tax=Math.round((subtotal-action.discount)*state.taxRate);const total=subtotal-action.discount+tax;
  const direct=action.source==='cashier';const id=`SO-${String(state.serial).padStart(6,'0')}`;
  const order:StoreOrder={id,organizationId:actor.organizationId,branchId:action.branchId,memberId,customerName:action.customerName.trim(),source:action.source,lines,subtotal,discount:action.discount,tax,total,paymentStatus:direct?'paid':'unpaid',fulfillmentStatus:direct?'picked_up':'awaiting_payment',paymentMethod:action.paymentMethod||null,createdAt:now,expiresAt:direct?null:now+RESERVATION_MS,paidAt:direct?now:null,pickedUpAt:direct?now:null,pickupToken:action.pickupToken,requestId:action.requestId,requestKey,cashierName:direct?actor.name:undefined};
  const products=direct?state.products.map(p=>{const line=lines.find(l=>l.productId===p.id);return line?{...p,stock:{...p.stock,[action.branchId]:p.stock[action.branchId]-line.quantity}}:p;}):state.products;
  return {state:{...state,products,orders:[...state.orders,order],serial:state.serial+1},orderId:id};
 }
 const order=state.orders.find(o=>o.id===action.orderId&&o.organizationId===actor.organizationId);
 if(!order)return fail('Order not found in this organization.');
 const member=actor.role==='MEMBER';
 if(member?order.memberId!==actor.memberId:!canSell(actor)||!validBranch(order.branchId))return fail('You cannot access this order.');
 if(action.type==='cancel-order'){
  if(order.fulfillmentStatus==='cancelled')return {state,orderId:order.id};
  if(order.fulfillmentStatus==='picked_up')return fail('Picked-up orders cannot be cancelled.');
  if(member&&order.paymentStatus==='paid')return fail('Contact the cashier to cancel a paid order.');
  const paid=order.paymentStatus==='paid';
  const products=paid?state.products.map(p=>{const line=order.lines.find(l=>l.productId===p.id);return line?{...p,stock:{...p.stock,[order.branchId]:(p.stock[order.branchId]||0)+line.quantity}}:p;}):state.products;
  return {state:{...state,products,orders:state.orders.map(o=>o.id===order.id?{...o,fulfillmentStatus:'cancelled',paymentStatus:paid?'refunded':o.paymentStatus,expiresAt:null,cancelReason:paid?'Cancelled with simulated refund':'Cancelled by customer or cashier'}:o)},orderId:order.id};
 }
 if(member)return fail('Only an authorized cashier can confirm payment or pickup.');
 if(order.fulfillmentStatus==='cancelled')return fail('Order cancelled or reservation expired.');
 if(action.type==='pay-order'){
  if(order.paymentStatus==='paid')return {state,orderId:order.id};
  if(!['Cash','QRIS','Bank Transfer','Other'].includes(action.paymentMethod))return fail('Choose a payment method.');
  for(const line of order.lines){const product=owned(line.productId);if(!product||(product.stock[order.branchId]||0)<line.quantity)return fail('Stock changed. Contact the inventory manager.');}
  const products=state.products.map(p=>{const line=order.lines.find(l=>l.productId===p.id);return line?{...p,stock:{...p.stock,[order.branchId]:p.stock[order.branchId]-line.quantity}}:p;});
  return {state:{...state,products,orders:state.orders.map(o=>o.id===order.id?{...o,paymentStatus:'paid',paymentMethod:action.paymentMethod,fulfillmentStatus:'preparing',paidAt:now,expiresAt:null}:o)},orderId:order.id};
 }
 if(action.type==='ready-order'){
  if(order.paymentStatus!=='paid'||order.fulfillmentStatus==='picked_up')return fail('Only a paid, uncollected order can be prepared.');
  return {state:{...state,orders:state.orders.map(o=>o.id===order.id?{...o,fulfillmentStatus:'ready_for_pickup'}:o)},orderId:order.id};
 }
 if(action.type==='pickup-order'){
  if(action.branchId!==order.branchId||!validBranch(action.branchId))return fail('Pickup branch does not match.');
  if(action.token!==order.pickupToken||!action.token.startsWith('store-demo:'))return fail('Invalid pickup QR. Gym and PT QR codes cannot collect a Store order.');
  if(order.paymentStatus!=='paid'||order.fulfillmentStatus!=='ready_for_pickup')return fail('Order must be paid and ready. Duplicate pickup is not allowed.');
  return {state:{...state,orders:state.orders.map(o=>o.id===order.id?{...o,fulfillmentStatus:'picked_up',pickedUpAt:now}:o)},orderId:order.id};
 }
 return fail('Unknown store action.');
}
