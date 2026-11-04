import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
export const dataDir=resolve(process.env.NSARS_DATA_DIR||'../data');
mkdirSync(dataDir,{recursive:true,mode:0o700});
export const sql=new DatabaseSync(dataDir+'/site.sqlite');
chmodSync(dataDir+'/site.sqlite',0o600);
sql.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS cms_content(id TEXT PRIMARY KEY,body TEXT NOT NULL,version INTEGER NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cms_media(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS moscow_orders(id TEXT PRIMARY KEY,number TEXT NOT NULL,request_hash TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS moscow_order_notifications(order_id TEXT PRIMARY KEY,state TEXT NOT NULL,attempts INTEGER NOT NULL,updated TEXT NOT NULL,last_error TEXT NOT NULL,provider_id TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_moscow_orders_created ON moscow_orders(created);
CREATE TABLE IF NOT EXISTS owner(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,verifier TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES owner(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY,applied TEXT NOT NULL);`);
class Statement{
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Statement(this.query,args);}
 first(){return sql.prepare(this.query).get(...this.args)||null;}
 all(){return {results:sql.prepare(this.query).all(...this.args)};}
 run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
}
export const database={prepare:q=>new Statement(q),batch:commands=>{sql.exec('BEGIN IMMEDIATE');try{const results=commands.map(x=>x.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
