import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exported,Intl,Date});
const {createStoreState,storeTransition,availableStock,reservedStock,visibleOrders,visibleProducts,memberStoreActor,STORE_BRANCHES,STORE_ORG_ID,RESERVATION_MS}=exported;
const now=Date.parse('2026-11-18T09:00:00+07:00');const branch=STORE_BRANCHES[0].id;
const member=memberStoreActor('member-1','Demo Member');const cashier={role:'CASHIER',organizationId:STORE_ORG_ID,branchIds:[branch],name:'Cashier'};const owner={...cashier,role:'OWNER'};
const token='store-demo:11111111-1111-4111-8111-111111111111';
function order(state=createStoreState(),extra={}){return storeTransition(state,{type:'create-order',actor:member,source:'member',branchId:branch,lines:[{productId:'water',quantity:2}],customerName:'Demo Member',discount:0,requestId:'request-1',pickupToken:token,now,...extra});}
function act(state,type,extra={}){return storeTransition(state,{type,actor:cashier,orderId:state.orders[0].id,paymentMethod:'Cash',now,...extra});}
test('member checkout reserves inventory but never marks payment paid',()=>{
 const state=createStoreState();const created=order(state);assert.equal(created.error,undefined);const result=created.state;assert.equal(result.products[0].stock[branch],40);assert.equal(availableStock(result,'water',branch,now),38);assert.equal(reservedStock(result,'water',branch,now),2);assert.equal(result.orders[0].paymentStatus,'unpaid');assert.equal(result.orders[0].fulfillmentStatus,'awaiting_payment');assert.equal(result.orders[0].expiresAt,now+RESERVATION_MS);assert.equal(state.orders.length,0);
});
test('payment deducts reserved stock once; preparation and pickup require correct paid order token',()=>{
 const created=order().state;assert.match(act(created,'ready-order').error,/paid/);assert.match(act(created,'pickup-order',{token,branchId:branch}).error,/paid/);
 const paid=act(created,'pay-order').state;assert.equal(paid.products[0].stock[branch],38);assert.equal(availableStock(paid,'water',branch,now),38);assert.equal(act(paid,'pay-order').state.products[0].stock[branch],38);
 const ready=act(paid,'ready-order').state;assert.match(act(ready,'pickup-order',{token:'pt-demo:invalid',branchId:branch}).error,/Invalid/);assert.match(act(ready,'pickup-order',{token,branchId:STORE_BRANCHES[1].id}).error,/branch/);
 const picked=act(ready,'pickup-order',{token,branchId:branch}).state;assert.equal(picked.orders[0].fulfillmentStatus,'picked_up');assert.match(act(picked,'pickup-order',{token,branchId:branch}).error,/Duplicate/);assert.match(act(picked,'cancel-order').error,/Picked-up/);
});
test('expiry and cancellation release unpaid reservations; late payment fails',()=>{
 const state=order().state;const expired=exported.expireStoreOrders(state,now+RESERVATION_MS);assert.equal(expired.orders[0].fulfillmentStatus,'cancelled');assert.equal(availableStock(expired,'water',branch,now+RESERVATION_MS),40);assert.match(act(state,'pay-order',{now:now+RESERVATION_MS}).error,/expired/);
 const cancelled=act(state,'cancel-order',{actor:member}).state;assert.equal(availableStock(cancelled,'water',branch,now),40);assert.equal(act(cancelled,'cancel-order',{actor:member}).state.products[0].stock[branch],40);
});
test('paid cancellation returns physical stock and records simulated refund exactly once',()=>{
 const state=act(order().state,'pay-order').state;assert.match(act(state,'cancel-order',{actor:member}).error,/cashier/);
 const cancelled=act(state,'cancel-order').state;assert.equal(cancelled.products[0].stock[branch],40);assert.equal(cancelled.orders[0].paymentStatus,'refunded');assert.equal(act(cancelled,'cancel-order').state.products[0].stock[branch],40);
});
test('direct sale has one inventory source and idempotency rejects duplicate writes',()=>{
 const state=createStoreState();const action={source:'cashier',actor:cashier,paymentMethod:'Cash',memberId:null,customerName:'Walk-in'};
 const sale=order(state,action);assert.equal(sale.state.orders[0].paymentStatus,'paid');assert.equal(sale.state.orders[0].fulfillmentStatus,'picked_up');assert.equal(sale.state.products[0].stock[branch],38);
 const repeated=order(sale.state,action);assert.equal(repeated.state.orders.length,1);assert.equal(repeated.state.products[0].stock[branch],38);assert.equal(repeated.orderId,sale.orderId);
 assert.match(order(sale.state,{...action,lines:[{productId:'water',quantity:3}]}).error,/different order/);
});
test('reserved units cannot be oversold by member or cashier; zero stock and invalid quantities rejected',()=>{
 const state=order(createStoreState(),{lines:[{productId:'water',quantity:39}]}).state;
 assert.match(order(state,{requestId:'second'}).error,/Insufficient/);assert.match(order(state,{requestId:'cashier',source:'cashier',actor:cashier,paymentMethod:'Cash'}).error,/Insufficient/);
 for(const quantity of [0,-1,1.5,1000])assert.match(order(createStoreState(),{lines:[{productId:'water',quantity}]}).error,/Quantity/);
 assert.match(order(createStoreState(),{lines:[{productId:'energy',quantity:1}]}).error,/Insufficient/);
});
test('role, branch, tenant and member ownership are enforced',()=>{
 const state=order().state;
 assert.match(act(state,'pay-order',{actor:member}).error,/Only/);assert.match(act(state,'pay-order',{actor:{...cashier,branchIds:[STORE_BRANCHES[1].id]}}).error,/access/);assert.match(act(state,'pay-order',{actor:{...cashier,organizationId:'foreign'}}).error,/not found/);
 assert.equal(visibleOrders(state,memberStoreActor('other','Other')).length,0);assert.match(act(state,'cancel-order',{actor:memberStoreActor('other','Other')}).error,/access/);
 assert.equal(visibleProducts(state,{...member,organizationId:'foreign'},'member').length,0);
 assert.match(order(createStoreState(),{actor:member,source:'cashier',paymentMethod:'Cash'}).error,/cannot create/);
});
test('cashier discounts forbidden, admin discount boundaries enforced',()=>{
 assert.match(order(createStoreState(),{source:'cashier',actor:cashier,paymentMethod:'Cash',discount:1000}).error,/Discount/);
 assert.match(order(createStoreState(),{source:'cashier',actor:owner,paymentMethod:'Cash',discount:10001}).error,/subtotal/);
 const discounted=order(createStoreState(),{source:'cashier',actor:owner,paymentMethod:'Cash',discount:1000}).state.orders[0];assert.equal(discounted.total,9000);
});
test('inventory and product management respect reserved stock, costs and channel publication',()=>{
 const state=order().state;const adjust={type:'adjust-stock',actor:owner,productId:'water',branchId:branch,quantity:1,reason:'Count',now};assert.match(storeTransition(state,adjust).error,/reservations/);assert.match(storeTransition(state,{...adjust,actor:cashier,quantity:50}).error,/access/);
 const changed=storeTransition(state,{...adjust,quantity:50}).state;assert.equal(changed.inventory[0].quantity,10);assert.equal(availableStock(changed,'water',branch,now),48);
 const product={...state.products[0],memberSale:false};const unpublished=storeTransition(state,{type:'save-product',actor:owner,product,now}).state;assert.match(order(unpublished,{requestId:'new-request'}).error,/unavailable/);assert.equal(visibleProducts(unpublished,member,'member').some(p=>p.id==='water'),false);
 assert.match(storeTransition(state,{type:'save-product',actor:{...owner,role:'MANAGER'},product:{...product,costPrice:1},now}).error,/cost price/);
 const archived=storeTransition(state,{type:'archive-product',actor:owner,productId:'water',now}).state;assert.match(order(archived,{requestId:'new-request'}).error,/unavailable/);assert.equal(act(archived,'pay-order').error,undefined);
});
test('duplicate cart lines aggregate stock checks and product identifiers remain unique',()=>{
 assert.match(order(createStoreState(),{lines:[{productId:'water',quantity:25},{productId:'water',quantity:25}]}).error,/Insufficient/);
 const state=createStoreState();const product={...state.products[0],id:'another'};assert.match(storeTransition(state,{type:'save-product',actor:owner,product,now}).error,/already exists/);
});
