import {env} from 'cloudflare:workers';
const types:Record<string,string>={school:'Школьная съёмка',studio:'Съёмка в студии',kindergarten:'В детском саду',other:'Другое'};
export const notificationConfigured=()=>Boolean(env.BOOKING_NOTIFY_ENDPOINT&&env.BOOKING_NOTIFY_TOKEN&&env.BOOKING_TELEGRAM_CHAT_ID);
export async function enqueueNotification(db:D1Database,id:string){await db.prepare('INSERT OR IGNORE INTO booking_notification_outbox(id,updated) VALUES(?,?)').bind(id,new Date().toISOString()).run();}
export async function deliverNotification(db:D1Database,id:string){
 const row=await db.prepare('SELECT * FROM booking_requests WHERE id=?').bind(id).first<Record<string,string>>();if(!row)return;
 await enqueueNotification(db,id);
 if(!notificationConfigured()){await db.prepare("UPDATE booking_notification_outbox SET last_error='Каналы уведомлений ещё не подключены',updated=? WHERE id=? AND busy=0 AND (email_state!='sent' OR telegram_state!='sent')").bind(new Date().toISOString(),id).run();return;}
 await db.prepare("UPDATE booking_notification_outbox SET busy=0,last_error='Предыдущая попытка не подтверждена' WHERE id=? AND busy=1 AND updated<?").bind(id,new Date(Date.now()-120000).toISOString()).run();
 const job=await db.prepare('SELECT * FROM booking_notification_outbox WHERE id=?').bind(id).first<{email_state:string,telegram_state:string,busy:number}>();if(!job||job.busy||job.email_state==='sent'&&job.telegram_state==='sent')return;
 const lease=await db.prepare('UPDATE booking_notification_outbox SET busy=1,attempts=attempts+1,updated=? WHERE id=? AND busy=0').bind(new Date().toISOString(),id).run();if(!lease.meta.changes)return;
 try{
  const url=new URL(env.BOOKING_NOTIFY_ENDPOINT!);if(url.protocol!=='https:')throw Error('Invalid endpoint');
  const result=await fetch(url.toString(),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.BOOKING_NOTIFY_TOKEN,'Idempotency-Key':'booking-'+id},body:JSON.stringify({event:'booking.requested',notification_id:id,recipient_email:'notifications@example.invalid',recipient_telegram_chat_id:env.BOOKING_TELEGRAM_CHAT_ID,channels:{email:job.email_state!=='sent',telegram:job.telegram_state!=='sent'},booking:{date:row.date,type:types[row.category],name:row.name,phone:row.phone,email:row.email||'',details:row.details,status:'На согласовании'},text:['Новое бронирование съёмки — на согласовании','Дата: '+row.date,'Тип: '+types[row.category],'Имя: '+row.name,'Телефон: '+row.phone,'Email: '+(row.email||'не указан'),'Детали: '+(row.details||'не указаны')].join('\n')}),signal:AbortSignal.timeout(8000)});
  const outcome=await result.json() as {email?:{status?:string},telegram?:{status?:string}};
  if(!result.ok)throw Error('Delivery failed');const es=job.email_state==='sent'||outcome.email?.status==='sent'?'sent':'unknown',ts=job.telegram_state==='sent'||outcome.telegram?.status==='sent'?'sent':'unknown';
  await db.prepare('UPDATE booking_notification_outbox SET email_state=?,telegram_state=?,busy=0,last_error=?,updated=? WHERE id=?').bind(es,ts,es==='sent'&&ts==='sent'?'':'Доставка подтверждена не для всех каналов',new Date().toISOString(),id).run();
 }catch{await db.prepare("UPDATE booking_notification_outbox SET busy=0,email_state=CASE WHEN email_state='sent' THEN 'sent' ELSE 'unknown' END,telegram_state=CASE WHEN telegram_state='sent' THEN 'sent' ELSE 'unknown' END,last_error='Результат отправки не подтверждён. Проверьте каналы перед повтором.',updated=? WHERE id=?").bind(new Date().toISOString(),id).run();}
}
