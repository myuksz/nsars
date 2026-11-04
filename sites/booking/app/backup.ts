import {env} from 'cloudflare:workers';
import {makeWorkbook} from './booking-workbook';
type BackupState={revision:number;saved_revision:number;remote_sha:string;public_sha:string;last_success:string;last_error:string;manual_hold:number};
const api='https://cloud-api.yandex.net/v1/disk/resources';
const folder=env.YANDEX_BACKUP_FOLDER||'disk:/Дублирование с сайтов';
const current=folder+'/Запись на съёмки.xlsx';
const publicFile=folder+'/Свободные даты.xlsx';
export const backupConfigured=()=>!!env.YANDEX_DISK_OAUTH_TOKEN;
export async function backupStatus(db:D1Database){const r=await db.prepare('SELECT revision,saved_revision,last_success,last_error,manual_hold FROM booking_backup_state WHERE id=1').first<BackupState>();return {configured:backupConfigured(),pending:!!r&&r.revision>r.saved_revision,lastSuccess:r?.last_success||'',error:r?.last_error||'',manualHold:!!r?.manual_hold};}
export async function snapshot(db:D1Database){const r=await db.batch<Record<string,unknown>>([db.prepare('SELECT d.*,r.name,r.phone,r.email,r.details FROM booking_days d LEFT JOIN booking_requests r ON r.id=d.request_id ORDER BY d.date'),db.prepare('SELECT * FROM booking_requests ORDER BY created,id'),db.prepare('SELECT revision FROM booking_backup_state WHERE id=1')]);const revision=Number(r[2].results[0]?.revision||1),created=new Date().toISOString();return {bytes:makeWorkbook(r[0].results,r[1].results,revision,created),publicBytes:makeWorkbook(r[0].results,[],revision,created,true),revision,created};}
async function call(path:string,method='GET'){return fetch(path,{method,headers:{Authorization:'OAuth '+env.YANDEX_DISK_OAUTH_TOKEN},redirect:'error',signal:AbortSignal.timeout(6000)});}
async function metadata(path:string){const r=await call(api+'?'+new URLSearchParams({path,fields:'sha256,type'}));if(r.status===404)return null;if(!r.ok)throw Error('Недоступен Яндекс Диск');return await r.json() as {sha256?:string;type?:string};}
async function upload(path:string,bytes:Uint8Array){const r=await call(api+'/upload?'+new URLSearchParams({path,overwrite:'true'}));if(!r.ok)throw Error('Яндекс не разрешил загрузку');const link=await r.json() as {href:string;method:string};const url=new URL(link.href);if(url.protocol!=='https:'||link.method!=='PUT')throw Error('Некорректный ответ Яндекса');const put=await fetch(url,{method:'PUT',body:bytes as BodyInit,redirect:'error',signal:AbortSignal.timeout(6000)});if(!put.ok)throw Error('Не удалось загрузить файл');}
export async function syncBackup(db:D1Database,force=false){
 if(!backupConfigured())return;
 const now=Date.now(),lease=crypto.randomUUID();const lock=await db.prepare('UPDATE booking_backup_state SET lease_until=?,lease_id=? WHERE id=1 AND lease_until<? AND manual_hold=0 AND (?=1 OR next_try<?) AND revision>saved_revision').bind(now+90000,lease,now,force?1:0,now).run();if(!lock.meta.changes)return;
 try{
  const state=await db.prepare('SELECT * FROM booking_backup_state WHERE id=1').first<BackupState>();if(!state)throw Error('Нет данных резерва');
  const remote=await metadata(current),remotePublic=await metadata(publicFile);
  if(remote&&(remote.type!=='file'||!state.remote_sha||remote.sha256!==state.remote_sha)||remotePublic&&(remotePublic.type!=='file'||!state.public_sha||remotePublic.sha256!==state.public_sha)){
   await db.prepare("UPDATE booking_backup_state SET manual_hold=1,last_error='Таблица изменена на Диске. Автообновление остановлено, чтобы сохранить ручные правки.',lease_until=0 WHERE id=1 AND lease_id=?").bind(lease).run();return;
  }
  const made=await call(api+'?'+new URLSearchParams({path:folder}),'PUT');if(!made.ok&&made.status!==409)throw Error('Не удалось открыть папку резерва');
  const snap=await snapshot(db);const digest=await crypto.subtle.digest('SHA-256',snap.bytes as BufferSource),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const dated=folder+'/Запись-'+snap.created.replace(/[:.]/g,'-')+'-v'+snap.revision+'.xlsx';
  await upload(dated,snap.bytes);
  // Re-check before replacing the shared workbook: stop on any observed manual edit.
  const latest=await metadata(current);if((latest?.sha256||'')!==(remote?.sha256||'')){
   await db.prepare("UPDATE booking_backup_state SET manual_hold=1,last_error='Таблица изменена во время копирования. Автообновление остановлено.',lease_until=0 WHERE id=1 AND lease_id=?").bind(lease).run();return;
  }
  await upload(current,snap.bytes);
  const verify=await metadata(current);if(verify?.sha256!==hash)throw Error('Копия ещё не подтверждена Яндексом');
  await db.prepare('UPDATE booking_backup_state SET remote_sha=? WHERE id=1 AND lease_id=?').bind(hash,lease).run();
  const lastPublic=await metadata(publicFile);if((lastPublic?.sha256||'')!==(remotePublic?.sha256||'')){await db.prepare("UPDATE booking_backup_state SET manual_hold=1,last_error='Клиентская таблица изменена вручную. Автообновление остановлено.',lease_until=0 WHERE id=1 AND lease_id=?").bind(lease).run();return;}
  await upload(publicFile,snap.publicBytes);const publicHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',snap.publicBytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');
  const verifyPublic=await metadata(publicFile);if(verifyPublic?.sha256!==publicHash)throw Error('Клиентская копия ещё не подтверждена');
  await db.prepare("UPDATE booking_backup_state SET saved_revision=?,public_sha=?,last_success=?,last_error='',lease_until=0,next_try=0 WHERE id=1 AND lease_id=?").bind(snap.revision,publicHash,snap.created,lease).run();
 }catch{
  await db.prepare("UPDATE booking_backup_state SET last_error='Резервная копия не подтверждена. Следующая попытка — при обращении к расписанию.',lease_until=0,next_try=? WHERE id=1 AND lease_id=?").bind(Date.now()+60000,lease).run();
 }
}
