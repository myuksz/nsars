import {database,sql} from './database.mjs';
import {createHash} from 'node:crypto';
export const db=()=>database;
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function owner(request){const cookie=request.headers.get('cookie')||'',token=cookie.match(/(?:^|;\s*)__Host-nsars=([a-f0-9]{64})(?:;|$)/)?.[1];return token?sql.prepare('SELECT owner_id FROM sessions WHERE hash=? AND expires>?').get(hash(token),Date.now()):null;}
export function sameOrigin(request){if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('AUTH');}
export function authorize(request){sameOrigin(request);if(!owner(request))throw Error('AUTH');}
export async function read(id){return database.prepare('SELECT * FROM cms_content WHERE id=?').bind(id).first();}
export function limited(key,maximum,ms){const now=Date.now();sql.prepare('DELETE FROM limits WHERE expires<?').run(now);const row=sql.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(key,now+ms);return row.count>maximum;}
export async function orderAccess(request){sameOrigin(request);const body=await request.clone().json();if(body.mode==='draft')authorize(request);if(limited('orders:'+hash(request.headers.get('x-nsars-client')||'unknown'),10,60000))throw Error('RATE');}
export async function mediaAccess(request,id){if(owner(request))return;const published=await read('moscow-published');if(published?.body.includes('/api/media?id='+id))return;const used=sql.prepare("SELECT p.media_id FROM site_review_photos p JOIN site_reviews r ON r.id=p.review_id WHERE p.media_id=? AND r.status='published' LIMIT 1").get(id);if(!used)throw Error('NOT_FOUND');}
export function failure(e){const code=e?.message;const status=code==='AUTH'?401:code==='RATE'?429:code==='NOT_FOUND'?404:500;return Response.json({error:status===401?'Требуется вход.':status===429?'Слишком много запросов. Попробуйте позже.':status===404?'Не найдено.':'Не удалось выполнить операцию.'},{status});}
