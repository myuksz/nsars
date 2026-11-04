import {readReviewCopy,reviewConsent,reviewCopyHandle} from './review-copy.mjs';
import {reviewCopyDefaults} from '../lib/moscow/review-copy-data.mjs';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from './database.mjs';
import {authorize,owner,sameOrigin,limited,hash} from './cms.mjs';
import {markdown,escapeText as esc} from '../lib/moscow/legal-reviews-view.mjs';
const documents=JSON.parse(readFileSync(new URL('./legal-documents.json',import.meta.url),'utf8'));
const consent=documents['review-consent'];
export const consentVersion=reviewConsent(consent,reviewCopyDefaults).version;
const migration=`CREATE TABLE IF NOT EXISTS site_reviews(id TEXT PRIMARY KEY,nonce TEXT NOT NULL UNIQUE,body_hash TEXT NOT NULL,raw_text TEXT NOT NULL,public_text TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','rejected','removed')),created TEXT NOT NULL,updated TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,consent_version TEXT NOT NULL,consent_snapshot TEXT NOT NULL,processing INTEGER NOT NULL CHECK(processing=1),publication INTEGER NOT NULL CHECK(publication=1));CREATE INDEX IF NOT EXISTS site_reviews_status ON site_reviews(status,created);CREATE TABLE IF NOT EXISTS legal_history(id TEXT PRIMARY KEY,document TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL,owner_id TEXT);`;
const checksum=hash(migration),migrationId='legal-reviews-20260930-v1';
sql.exec('CREATE TABLE IF NOT EXISTS feature_migrations(id TEXT PRIMARY KEY,checksum TEXT NOT NULL,applied TEXT NOT NULL)');
const applied=sql.prepare('SELECT checksum FROM feature_migrations WHERE id=?').get(migrationId);
if(applied&&applied.checksum!==checksum)throw Error('MIGRATION_CHECKSUM');
if(!applied){sql.exec('BEGIN IMMEDIATE');try{const current=sql.prepare('SELECT checksum FROM feature_migrations WHERE id=?').get(migrationId);if(current&&current.checksum!==checksum)throw Error('MIGRATION_CHECKSUM');if(!current){sql.exec(migration);sql.prepare('INSERT INTO feature_migrations VALUES(?,?,?)').run(migrationId,checksum,new Date().toISOString());}sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}
const photoMigration='CREATE TABLE IF NOT EXISTS site_review_photos(review_id TEXT NOT NULL REFERENCES site_reviews(id),media_id TEXT NOT NULL REFERENCES cms_media(id),position INTEGER NOT NULL,PRIMARY KEY(review_id,media_id));CREATE INDEX IF NOT EXISTS site_review_photos_media ON site_review_photos(media_id)',photoMigrationId='review-photos-20261004-v1',photoChecksum=hash(photoMigration);
const photoApplied=sql.prepare('SELECT checksum FROM feature_migrations WHERE id=?').get(photoMigrationId);
if(photoApplied&&photoApplied.checksum!==photoChecksum)throw Error('MIGRATION_CHECKSUM');
if(!photoApplied){sql.exec('BEGIN IMMEDIATE');try{sql.exec(photoMigration);sql.prepare('INSERT INTO feature_migrations VALUES(?,?,?)').run(photoMigrationId,photoChecksum,new Date().toISOString());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}}
for(const name of ['legal-terms','legal-privacy'])for(const kind of ['published','draft'])sql.prepare('INSERT OR IGNORE INTO cms_content(id,body,version,updated) VALUES(?,?,1,?)').run(name+'-'+kind,documents[name],new Date().toISOString());
const row=(name,kind)=>sql.prepare('SELECT * FROM cms_content WHERE id=?').get(name+'-'+kind);
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
const redirect=to=>new Response(null,{status:303,headers:{location:to,'cache-control':'no-store'}});
function shell(title,body){return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)} — NS—ARS</title><link rel="stylesheet" href="/moscow/site.css"><link rel="stylesheet" href="/moscow/legal-reviews.css?v=20261004-photos"></head><body><main class="feature-admin"><nav><a href="/admin">Содержимое сайта</a><a href="/admin/reviews">Отзывы</a><a href="/admin/legal">Документы</a><a href="/admin/review-texts">Надписи раздела «Отзывы»</a><a href="/moscow/comments">Открыть сайт ↗</a></nav><h1>${esc(title)}</h1>${body}</main></body></html>`;}
function error(message,status=400,json=false){return json?Response.json({error:message},{status,headers:{'cache-control':'no-store'}}):html(shell('Не удалось выполнить действие',`<p>${esc(message)}</p><p><a href="/moscow/comments">Вернуться к отзывам</a> · <a href="/admin">Админка</a></p>`),status);}
async function formBody(request){const text=await request.text();if(Buffer.byteLength(text)>100000)return null;return new URLSearchParams(text);}
const transaction=fn=>{sql.exec('BEGIN IMMEDIATE');try{const result=fn();sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}};
export function featureContent(request,url,s){
 const path=url.pathname.replace(/^\/moscow\/?/,'').replace(/\/$/,'');
 if(['legal-terms','legal-privacy','review-consent'].includes(path)){const draft=url.searchParams.get('mode')==='draft';if(draft)authorize(request);s.__legal=path==='review-consent'?consent:row(path,draft?'draft':'published')?.body;s.__legalDraft=draft;}
 if(path==='comments'){s.__reviews=sql.prepare("SELECT id,public_text,created FROM site_reviews WHERE status='published' ORDER BY created DESC LIMIT 200").all();for(const r of s.__reviews)r.photos=sql.prepare('SELECT media_id FROM site_review_photos WHERE review_id=? ORDER BY position').all(r.id).map(x=>x.media_id);s.__reviewNonce=randomUUID();s.__reviewCopyDraft=url.searchParams.get('mode')==='draft';if(s.__reviewCopyDraft)authorize(request);s.__reviewCopy=readReviewCopy(s.__reviewCopyDraft?'draft':'published').copy;s.__consentVersion=reviewConsent(consent,s.__reviewCopy).version;}
 return s;
}
function legalAdmin(url){const name=url.searchParams.get('doc')==='legal-privacy'?'legal-privacy':'legal-terms',draft=row(name,'draft'),published=row(name,'published');const history=sql.prepare('SELECT id,created FROM legal_history WHERE document=? ORDER BY created DESC LIMIT 30').all(name);return shell('Документы сайта',`<p><a href="/admin/legal?doc=legal-terms">Оферта</a> · <a href="/admin/legal?doc=legal-privacy">Политика конфиденциальности</a></p>${url.searchParams.has('done')?'<p class="notice" role="status">Изменения сохранены.</p>':''}<p>Черновик сохраняется отдельно. Предпросмотр требует входа. Публикация обновляет страницу сразу; новая загрузка сайта не нужна.</p><form method="post" action="/admin/legal"><input type="hidden" name="document" value="${name}"><input type="hidden" name="draftVersion" value="${draft.version}"><input type="hidden" name="publishedVersion" value="${published.version}"><label for="legal-body">Текст ${name==='legal-terms'?'оферты':'политики'} (заголовки: # и ##; абзацы разделяйте пустой строкой)</label><textarea id="legal-body" name="body" class="legal-editor" required maxlength="60000">${esc(draft.body)}</textarea><button name="action" value="save">Сохранить черновик</button><button name="action" value="publish">Сохранить и опубликовать</button><a href="/${name}?mode=draft" target="_blank" rel="noopener">Предпросмотр сохранённого черновика ↗</a></form><p>Последняя публикация: ${esc(published.updated)}. Редакция ${published.version}.</p>${history.length?`<form method="post" action="/admin/legal"><input type="hidden" name="document" value="${name}"><input type="hidden" name="draftVersion" value="${draft.version}"><input type="hidden" name="publishedVersion" value="${published.version}"><label>Ранее опубликованная редакция<select name="revision">${history.map(x=>`<option value="${esc(x.id)}">${esc(x.created)}</option>`).join('')}</select></label><button name="action" value="restore">Восстановить в черновик</button><p>После восстановления проверьте предпросмотр и опубликуйте отдельно.</p></form>`:''}`);}
function reviewsAdmin(url){const state=['pending','published','rejected','removed'].includes(url.searchParams.get('state'))?url.searchParams.get('state'):'pending';const rows=sql.prepare('SELECT * FROM site_reviews WHERE status=? ORDER BY created DESC LIMIT 200').all(state);return shell('Отзывы клиентов',`<p><a href="/admin/reviews">На проверке</a> · <a href="/admin/reviews?state=published">Опубликованы</a> · <a href="/admin/reviews?state=rejected">Отклонены</a> · <a href="/admin/reviews?state=removed">Сняты</a></p>${url.searchParams.has('done')?'<p class="notice" role="status">Изменения сохранены.</p>':''}<p>Проверьте текст и сохраните смысл отзыва. Имя и контакты можно публиковать, если автор разрешил это при отправке. Для старых отзывов учитывайте сохранённые условия согласия. Отрицательная оценка сама по себе не причина отклонения.</p>${rows.length?rows.map(r=>`<article><h2>Отзыв от ${esc(r.created.slice(0,10))}</h2><p>Номер: ${esc(r.id)}. Состояние: ${esc({pending:'на проверке',published:'опубликован',rejected:'отклонён',removed:'снят'}[r.status])}.</p><details><summary>Исходный текст и подтверждения</summary><pre>${esc(r.raw_text)}</pre><p>Согласие на обработку и разрешение на публикацию получены. Версия: ${esc(r.consent_version)}.</p><details><summary>Текст согласия при отправке</summary>${markdown(r.consent_snapshot)}</details></details><form method="post" action="/admin/reviews"><input type="hidden" name="id" value="${esc(r.id)}"><input type="hidden" name="version" value="${r.version}"><label>Текст для публикации<textarea name="text" maxlength="3000" rows="6">${esc(r.public_text||r.raw_text)}</textarea></label><div class="review-photo-editor" data-review-photos><label>Фотографии со съёмки<input type="hidden" name="photos" value="${esc(JSON.stringify(sql.prepare('SELECT media_id FROM site_review_photos WHERE review_id=? ORDER BY position').all(r.id).map(x=>x.media_id)))}"></label><div data-photo-list class="review-photo-list"></div><button type="button" data-add-review-photos>Добавить фотографии</button><p data-photo-status role="status" aria-live="polite"></p></div><label><input type="checkbox" name="anonymous" value="yes"> Проверил: публикация соответствует разрешению автора, смысл отзыва сохранён.</label><button name="action" value="save">Сохранить</button><button name="action" value="publish">Опубликовать</button><button name="action" value="reject">Отклонить</button><button name="action" value="remove">Снять с публикации</button></form></article>`).join(''):'<p>В этом списке пока нет отзывов.</p>'}<script type="module" src="/moscow/review-photos-admin.mjs"></script>`);}
export async function featureHandle(request){
 const copyResponse=await reviewCopyHandle(request);if(copyResponse)return copyResponse;
 const url=new URL(request.url),path=url.pathname,json=request.headers.get('accept')?.includes('application/json');
 if(path==='/api/reviews'){
  const activeConsent=reviewConsent(consent,readReviewCopy().copy),activeConsentVersion=activeConsent.version;
  if(request.method!=='POST')return error('Метод не поддерживается.',405,true);
  try{sameOrigin(request);}catch{return error('Отправьте отзыв через форму на этом сайте.',403,json);}
  const body=await formBody(request);if(!body)return error('Слишком большой запрос.',413,json);
  if(body.get('mode')==='draft')return error('В предпросмотре отправка отзывов отключена.',400,json);
  const author=String(body.get('author')||'').trim().normalize('NFC'),contact=String(body.get('contact')||'').trim().normalize('NFC'),message=String(body.get('text')||'').trim().normalize('NFC');
  if(author.length>120||contact.length>300||message.length<10)return error('Проверьте имя, контакты и текст отзыва (не менее 10 символов).',400,json);
  const text=[author,contact,message].filter(Boolean).join('\n\n'),nonce=body.get('nonce')||'';
  if(body.get('website'))return error('Не удалось отправить отзыв.',400,json);
  if(text.length<10||text.length>3000||!/^[a-f0-9-]{36}$/.test(nonce))return error('Введите отзыв от 10 до 3000 символов.',400,json);
  if(body.get('processing')!=='yes'||body.get('publication')!=='yes')return error('Для отправки нужны отдельные отметки согласия и разрешения.',400,json);
  if(body.get('consentVersion')!==activeConsentVersion)return error('Документ согласия обновлён. Откройте страницу заново и прочитайте его.',409,json);
  const bodyHash=hash(JSON.stringify([text,activeConsentVersion]));
  const prior=sql.prepare('SELECT id,body_hash FROM site_reviews WHERE nonce=?').get(nonce);
  if(prior){if(prior.body_hash!==bodyHash)return error('Эта отправка уже сохранена с другим текстом. Обновите страницу.',409,json);return receipt(prior.id,json);}
  if(limited('reviews:'+hash(request.headers.get('x-nsars-client')||'unknown'),5,10*60*1000))return error('Слишком много отправок. Попробуйте позже.',429,json);
  const id=randomUUID(),now=new Date().toISOString();
  let saved;try{saved=transaction(()=>{if(reviewConsent(consent,readReviewCopy().copy).version!==activeConsentVersion)throw Error('CONSENT_CHANGED');const duplicate=sql.prepare('SELECT id,body_hash FROM site_reviews WHERE nonce=?').get(nonce);if(duplicate){if(duplicate.body_hash!==bodyHash)throw Error('CONFLICT');return duplicate.id;}sql.prepare('INSERT INTO site_reviews(id,nonce,body_hash,raw_text,created,updated,consent_version,consent_snapshot,processing,publication) VALUES(?,?,?,?,?,?,?,?,1,1)').run(id,nonce,bodyHash,text,now,now,activeConsentVersion,activeConsent.snapshot);return id;});}catch(e){if(e.message==='CONSENT_CHANGED')return error('Надписи формы обновлены. Откройте страницу заново.',409,json);throw e;}
  return receipt(saved,json);
 }
 if(!['/admin/legal','/admin/reviews'].includes(path))return null;
 if(!owner(request))return request.method==='GET'?redirect('/admin/login'):error('Требуется вход.',401,json);
 if(request.method==='GET'||request.method==='HEAD')return html(path==='/admin/legal'?legalAdmin(url):reviewsAdmin(url));
 if(request.method!=='POST')return error('Метод не поддерживается.',405,json);
 try{authorize(request);}catch{return error('Проверка доступа не пройдена. Откройте админку заново.',403,json);}
 const body=await formBody(request);if(!body)return error('Слишком большой запрос.',413,json);
 if(path==='/admin/reviews'){
  const action=body.get('action'),text=String(body.get('text')||'').trim(),state={publish:'published',reject:'rejected',remove:'removed'}[action];
  if(!state&&action!=='save')return error('Неизвестное действие.');
  if(text.length>3000||(action==='publish'&&(body.get('anonymous')!=='yes'||text.length<10)))return error('Подтвердите проверку разрешения автора и длины текста перед публикацией.');
  let photos;try{photos=JSON.parse(body.get('photos')||'[]');}catch{return error('Не удалось прочитать список фотографий.');}
  if(!Array.isArray(photos)||photos.length>12||new Set(photos).size!==photos.length||photos.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)))return error('Можно прикрепить до 12 фотографий.');
  if(photos.some(id=>!sql.prepare("SELECT id FROM cms_media WHERE id=? AND type IN ('image/jpeg','image/png','image/webp','image/gif')").get(id)))return error('Одна из фотографий недоступна. Загрузите её заново.');
  let savedState;try{savedState=transaction(()=>{
   const current=sql.prepare('SELECT status,version FROM site_reviews WHERE id=?').get(body.get('id'));
   if(!current||current.version!==Number(body.get('version')))throw Error('CONFLICT');
   if(action==='save'&&current.status==='published'&&(body.get('anonymous')!=='yes'||text.length<10))throw Error('PUBLIC_CHECK');
   const target=state||current.status;
   sql.prepare('UPDATE site_reviews SET status=?,public_text=?,updated=?,version=version+1 WHERE id=? AND version=?').run(target,text,new Date().toISOString(),body.get('id'),current.version);
   sql.prepare('DELETE FROM site_review_photos WHERE review_id=?').run(body.get('id'));
   photos.forEach((id,i)=>sql.prepare('INSERT INTO site_review_photos(review_id,media_id,position) VALUES(?,?,?)').run(body.get('id'),id,i));
   return target;
  });}catch(e){if(e.message==='CONFLICT')return error('Отзыв изменён в другом окне. Обновите список и повторите.',409);if(e.message==='PUBLIC_CHECK')return error('Перед сохранением опубликованного отзыва подтвердите проверку текста.');throw e;}
  return redirect('/admin/reviews?done=1&state='+savedState);
 }
 const name=body.get('document'),action=body.get('action');if(!['legal-terms','legal-privacy'].includes(name)||!['save','publish','restore'].includes(action))return error('Неизвестный документ или действие.');
 let text=String(body.get('body')||'').replace(/\r\n/g,'\n').trim();
 if(action==='restore'){const old=sql.prepare('SELECT body FROM legal_history WHERE id=? AND document=?').get(body.get('revision'),name);if(!old)return error('Редакция не найдена.',404);text=old.body;}
 if(text.length<100||text.length>60000)return error('Текст документа должен содержать от 100 до 60000 символов.');
 try{transaction(()=>{const draft=row(name,'draft'),published=row(name,'published');if(draft.version!==Number(body.get('draftVersion'))||published.version!==Number(body.get('publishedVersion')))throw Error('CONFLICT');const now=new Date().toISOString();sql.prepare('UPDATE cms_content SET body=?,version=version+1,updated=? WHERE id=?').run(text,now,name+'-draft');if(action==='publish'){sql.prepare('INSERT INTO legal_history VALUES(?,?,?,?,?)').run(randomUUID(),name,published.body,now,owner(request).owner_id);sql.prepare('UPDATE cms_content SET body=?,version=version+1,updated=? WHERE id=?').run(text,now,name+'-published');}});}catch(e){if(e.message==='CONFLICT')return error('Документ изменён в другом окне. Обновите страницу; изменения не перезаписаны.',409);throw e;}
 return redirect('/admin/legal?done=1&doc='+name);
}
function receipt(id,json){return json?Response.json({id,status:'pending'},{status:201,headers:{'cache-control':'no-store'}}):html(shell('Отзыв сохранён',`<p>Спасибо! Отзыв передан на проверку. Он появится на странице после публикации владельцем.</p><p>Номер отправки: ${esc(id)}. Сохраните его для обращения об изменении или удалении.</p><p><a href="/moscow/comments">Вернуться к отзывам</a></p>`),201);}
