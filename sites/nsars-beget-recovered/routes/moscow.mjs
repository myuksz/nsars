import {authorize,db,failure,read} from '../runtime/cms.mjs';
import {seedMoscow,validMoscow,withCurrentContacts} from '../lib/moscow/data.mjs';
export async function GET(request        ){try{
 await authorize(request);const row=await read('moscow-draft');const history=await db().prepare("SELECT id,updated FROM cms_content WHERE id LIKE 'moscow-revision-%' ORDER BY updated DESC LIMIT 20").all();
 return Response.json({state:withCurrentContacts(row?JSON.parse(row.body):seedMoscow()),version:row?.version||0,history:history.results},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
export async function POST(request        ){try{
 await authorize(request);const raw=await request.text();if(raw.length>1000000)return Response.json({error:'Слишком большой объём содержимого.'},{status:413});const input=JSON.parse(raw);
 if(input.action==='restore'){
  if(typeof input.id!=='string'||!/^moscow-revision-[a-f0-9-]+$/.test(input.id))return Response.json({error:'Версия не найдена.'},{status:404});
  const row=await read(input.id);return row?Response.json({state:withCurrentContacts(JSON.parse(row.body))}):Response.json({error:'Версия не найдена.'},{status:404});
 }
 const {state,version,action}=input;
 if(!['save','publish'].includes(action)||!Number.isSafeInteger(version)||version<0||!validMoscow(state))return Response.json({error:'Проверьте заполнение полей и адреса изображений.'},{status:400});
 const now=new Date().toISOString(),body=JSON.stringify(state),revision='moscow-revision-'+crypto.randomUUID();
 const commands=[version===0?db().prepare('INSERT OR IGNORE INTO cms_content(id,body,version,updated) VALUES(?,?,1,?)').bind('moscow-draft',body,now):db().prepare('UPDATE cms_content SET body=?,version=version+1,updated=? WHERE id=? AND version=?').bind(body,now,'moscow-draft',version)];
 if(action==='publish'){
 commands.push(db().prepare('INSERT INTO cms_content(id,body,version,updated) SELECT ?,body,version,updated FROM cms_content WHERE id=? AND version=? AND changes()>0').bind(revision,'moscow-draft',version+1));
 commands.push(db().prepare('INSERT INTO cms_content(id,body,version,updated) SELECT ?,body,version,updated FROM cms_content WHERE id=? ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=excluded.version,updated=excluded.updated').bind('moscow-published',revision));
 }
 const [saved]=await db().batch(commands);if(!saved.meta.changes)return Response.json({error:'Содержимое изменилось в другой вкладке. Скачайте резервную копию своих правок перед обновлением страницы.'},{status:409});
 return Response.json({version:version+1});
}catch(e){return failure(e);}}
