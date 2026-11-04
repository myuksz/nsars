import {sql} from './database.mjs';
import {seedMoscow,withCurrentContacts,validMoscow} from '../lib/moscow/data.mjs';
const state=withCurrentContacts(seedMoscow());if(!validMoscow(state))throw Error('Invalid release content');
const now=new Date().toISOString(),body=JSON.stringify(state);
sql.exec('BEGIN IMMEDIATE');
try{for(const id of ['moscow-draft','moscow-published'])sql.prepare('INSERT OR IGNORE INTO cms_content VALUES(?,?,1,?)').run(id,body,now);sql.prepare('INSERT OR IGNORE INTO migrations VALUES(?,?)').run('beget-initial-2026-09-29',now);sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
console.log(JSON.stringify({contentRows:sql.prepare('SELECT count(*) n FROM cms_content').get().n,orders:sql.prepare('SELECT count(*) n FROM moscow_orders').get().n,owners:sql.prepare('SELECT count(*) n FROM owner').get().n}));sql.close();
