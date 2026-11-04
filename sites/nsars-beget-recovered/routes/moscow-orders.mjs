import {orderAccess,authorize,db,failure,read} from '../runtime/cms.mjs';
import {seedMoscow,withCurrentContacts} from '../lib/moscow/data.mjs';
import {normalizeOrder,prepareOrder,orderStatuses} from '../public/moscow/shop-model.mjs';
import {emailConfigured,notifyOrder} from '../lib/moscow/order-email.mjs';
const headers={'Cache-Control':'no-store'};
const json=(body        ,status=200)=>Response.json(body,{status,headers});
const hash=async(v       )=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,'0')).join('');
                                                                      
function receipt(row       ){const body=JSON.parse(row.body);return json({id:row.id,number:row.number,total:body.total,received:true});}
export async function GET(request        ){try{
 await authorize(request);
 const value=Number(new URL(request.url).searchParams.get('offset')||0),offset=Number.isSafeInteger(value)&&value>=0?Math.min(value,100000):0;
 const {results}=await db().prepare('SELECT o.*,n.state AS notification,n.updated AS notificationUpdated FROM moscow_orders o LEFT JOIN moscow_order_notifications n ON n.order_id=o.id ORDER BY o.created DESC,o.id DESC LIMIT 51 OFFSET ?').bind(offset).all();
 return json({items:results.slice(0,50).map(row=>({id:row.id,number:row.number,body:JSON.parse(String(row.body)),status:row.status,created:row.created,notification:row.notification==='sending'&&Date.parse(String(row.notificationUpdated))<Date.now()-120000?'failed':row.notification})),nextOffset:results.length>50?offset+50:null,offset,emailConfigured:emailConfigured()});
}catch(e){return failure(e);}}
export async function POST(request        ){try{
 await orderAccess(request);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Ожидается JSON.'},415);
 const raw=await request.text();if(raw.length>30000)return json({error:'Слишком большой заказ.'},413);
 let input,mode;try{const parsed=JSON.parse(raw);input=normalizeOrder(parsed);mode=parsed.mode==='draft'?'draft':'published';}catch(e){return json({error:e instanceof Error?e.message:'Проверьте заказ.'},400);}
 const requestHash=await hash(JSON.stringify({...input,mode}));
 const prior=await db().prepare('SELECT * FROM moscow_orders WHERE id=?').bind(input.key).first        ();
 if(prior)return prior.request_hash===requestHash?receipt(prior):json({error:'Изменился состав заказа. Обновите страницу перед повторной отправкой.'},409);
 const row=await read('moscow-'+mode),state=withCurrentContacts(row?JSON.parse(row.body):seedMoscow());
 let body;try{body={...prepareOrder(state,input,{draft:mode==='draft'}),mode,catalogVersion:row?.version||0};}catch(e){return json({error:e instanceof Error?e.message:'Проверьте выбранный товар.'},400);}
 const now=new Date().toISOString(),minute=new Date(Date.now()-60000).toISOString(),number='MSK-'+input.key.replaceAll('-','').slice(0,12).toUpperCase();
 const [inserted]=await db().batch([
  db().prepare("INSERT OR IGNORE INTO moscow_orders(id,number,request_hash,body,status,created,updated) SELECT ?,?,?,?,'new',?,? WHERE (SELECT count(*) FROM moscow_orders WHERE created>?)<50").bind(input.key,number,requestHash,JSON.stringify(body),now,now,minute),
  db().prepare('INSERT OR IGNORE INTO moscow_order_notifications(order_id,state,attempts,updated,last_error,provider_id) SELECT id,?,0,?,\'\',\'\' FROM moscow_orders WHERE id=? AND request_hash=?').bind(mode==='draft'?'disabled':'pending',now,input.key,requestHash)
 ]);
 if(!inserted.meta.changes){const retry=await db().prepare('SELECT * FROM moscow_orders WHERE id=?').bind(input.key).first        ();if(retry)return retry.request_hash===requestHash?receipt(retry):json({error:'Повторный ключ другого заказа.'},409);return json({error:'Слишком много запросов. Попробуйте через минуту.'},429);}
 // Order durability is independent of the email provider. Failed delivery remains retryable.
 if(mode!=='draft')try{await notifyOrder(input.key);}catch{/* the committed outbox row remains visible */}
 return json({id:input.key,number,total:body.total,received:true});
}catch(e){return failure(e);}}
export async function PATCH(request        ){try{
 await authorize(request);const raw=await request.text();if(raw.length>1000)return json({error:'Слишком большой запрос.'},413);
 let input;try{input=JSON.parse(raw);}catch{return json({error:'Проверьте запрос.'},400);}
 if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/.test(input.id))return json({error:'Заказ не найден.'},404);
 const row=await db().prepare('SELECT id FROM moscow_orders WHERE id=?').bind(input.id).first();if(!row)return json({error:'Заказ не найден.'},404);
 if(input.action==='retryEmail'){if(!emailConfigured())return json({error:'Сначала подключите почтовый сервис.'},409);await notifyOrder(input.id);return json({ok:true});}
 if(input.action!=='status'||!Object.hasOwn(orderStatuses,input.status))return json({error:'Неизвестный статус.'},400);
 await db().prepare('UPDATE moscow_orders SET status=?,updated=? WHERE id=?').bind(input.status,new Date().toISOString(),input.id).run();return json({ok:true});
}catch(e){return failure(e);}}
