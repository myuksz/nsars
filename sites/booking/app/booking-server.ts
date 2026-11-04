import {env} from 'cloudflare:workers';
import {getChatGPTUser} from './chatgpt-auth';
import seed from './data/booking-seed.json';
export async function database(){const db=env.DB!;if(!db)throw Error('DB unavailable');if(!await db.prepare("SELECT value FROM booking_settings WHERE key='seed_v1'").first()){const now=new Date().toISOString();await db.batch([...seed.records.map(r=>db.prepare('INSERT OR IGNORE INTO booking_days(date,status,category,note,version,updated) VALUES(?,?,?,?,1,?)').bind(r.date,r.status,r.category,r.note,now)),db.prepare("INSERT OR IGNORE INTO booking_settings(key,value) VALUES('seed_v1',?)").bind(seed.sourceSha256)]);}await db.prepare("INSERT OR IGNORE INTO booking_backup_state(id) VALUES(1)").run();return db;}
export async function owner(db:D1Database){const u=await getChatGPTUser();if(!u)return false;
// Initial enrollment is allowed only inside this owner-private Site.
await db.prepare("INSERT OR IGNORE INTO booking_settings(key,value) VALUES('owner_id',?)").bind(u.userId).run();const r=await db.prepare("SELECT value FROM booking_settings WHERE key='owner_id'").first<{value:string}>();return r?.value===u.userId;}
