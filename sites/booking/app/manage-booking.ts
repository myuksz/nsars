type Customer={name:string;phone:string;email:string;details:string};
type Change={date:string;status:string;category:string;note:string;version:number;customer?:Customer};
// The caller authenticates the owner and validates date/status/category/version.
// All record writes depend on the same successful date/version mutation.
export async function manageBooking(db:D1Database,d:Change){
 const note=String(d.note||'').trim();
 if(note.length>3000)return {error:'Заметка слишком длинная',status:400};
 const old=await db.prepare('SELECT request_id,version FROM booking_days WHERE date=?').bind(d.date).first<{request_id:string|null;version:number}>();
 if((old&&old.version!==d.version)||(!old&&d.version!==0))return {error:'Дата уже изменена. Проверьте обновлённое расписание.',status:409};
 const customer=d.customer===undefined?undefined:{name:String(d.customer?.name||'').trim(),phone:String(d.customer?.phone||'').trim(),email:String(d.customer?.email||'').trim(),details:String(d.customer?.details||'').trim()};
 if(customer){const {name,phone,email,details}=customer,hasData=!!(name||phone||email||details||old?.request_id);
  if(name.length>100||phone.length>40||email.length>254||details.length>1500||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(hasData&&(name.length<2||phone.replace(/\D/g,'').length<10)))return {error:'Для данных клиента укажите имя и телефон; проверьте email и длину полей.',status:400};
  if(!old?.request_id&&hasData&&!['pending','booked'].includes(d.status))return {error:'Чтобы сохранить данные клиента, выберите согласование или подтверждённую съёмку.',status:400};
 }
 const now=new Date().toISOString(),mutation=now+'|'+crypto.randomUUID(),category=d.status==='free'?null:d.category;
 const newRequest=!old?.request_id&&customer?.name?crypto.randomUUID():null,requestId=old?.request_id||newRequest;
 const statements=old?[db.prepare("UPDATE booking_days SET status=?,category=?,note=?,request_id=CASE WHEN ?='free' THEN NULL ELSE ? END,version=version+1,updated=? WHERE date=? AND version=?").bind(d.status,category,note,d.status,requestId,mutation,d.date,d.version)]:[db.prepare('INSERT OR IGNORE INTO booking_days(date,status,category,request_id,note,version,updated) VALUES(?,?,?,?,?,1,?)').bind(d.date,d.status,category,requestId,note,mutation)];
 const condition='EXISTS(SELECT 1 FROM booking_days WHERE date=? AND version=? AND updated=?)';
 if(newRequest&&customer)statements.push(db.prepare(`INSERT INTO booking_requests(id,date,category,name,phone,email,details,state,created) SELECT ?,?,?,?,?,?,?,?,? WHERE ${condition}`).bind(newRequest,d.date,d.category,customer.name,customer.phone,customer.email,customer.details,d.status,now,d.date,d.version+1,mutation));
 else if(requestId){
  const state=d.status==='free'?'declined':d.status;
  statements.push(customer?db.prepare(`UPDATE booking_requests SET state=?,category=?,name=?,phone=?,email=?,details=? WHERE id=? AND ${condition}`).bind(state,d.category,customer.name,customer.phone,customer.email,customer.details,requestId,d.date,d.version+1,mutation):db.prepare(`UPDATE booking_requests SET state=?,category=? WHERE id=? AND ${condition}`).bind(state,d.category,requestId,d.date,d.version+1,mutation));
 }
 statements.push(db.prepare(`UPDATE booking_backup_state SET revision=revision+1 WHERE id=1 AND ${condition}`).bind(d.date,d.version+1,mutation));
 const result=await db.batch(statements);
 if(!result[0].meta.changes)return {error:'Дата уже изменена. Обновите расписание.',status:409};
 return {ok:true,status:200};
}
