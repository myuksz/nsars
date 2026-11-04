import {env} from '../runtime/storage.mjs';
import {authorize,db,failure} from '../runtime/cms.mjs';
const CHUNK=8*1024*1024;
const TYPES=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','audio/mpeg','audio/mp4'];
const bad=(error       ,status=400)=>Response.json({error},{status});
async function session(id       ){if(!/^[a-f0-9-]{36}$/.test(id))return null;const object=await env.BUCKET.get('media-upload/'+id);if(!object)return null;const data=await object.json()                                                                                  ;return data.created>Date.now()-86400000?data:null;}
export async function POST(request        ){try{
 await authorize(request);const id=new URL(request.url).searchParams.get('id');
 if(!id){const body=await request.json()                                         ;const max=body.type?.startsWith('video/')?500:30;if(typeof body.name!=='string'||body.name.length>300||!TYPES.includes(body.type)||!Number.isSafeInteger(body.size)||body.size<1||body.size>max*1024*1024)return bad('Проверьте формат и размер файла.');const key=crypto.randomUUID(),upload=await env.BUCKET.createMultipartUpload(key,{httpMetadata:{contentType:body.type}});await env.BUCKET.put('media-upload/'+key,JSON.stringify({...body,id:key,uploadId:upload.uploadId,created:Date.now()}));return Response.json({id:key,chunkSize:CHUNK});}
 const data=await session(id);if(!data)return bad('Загрузка истекла. Выберите файл ещё раз.',404);
 const body=await request.json()                                             ;const count=Math.ceil(data.size/CHUNK);
 if(!Array.isArray(body.parts)||body.parts.length!==count||body.parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'||p.etag.length>200))return bad('Файл загружен не полностью.');
 await env.BUCKET.resumeMultipartUpload(id,data.uploadId).complete(body.parts);const object=await env.BUCKET.head(id);if(!object||object.size!==data.size){await env.BUCKET.delete(id);return bad('Размер загруженного файла не совпадает с исходным.');}
 try{await db().prepare('INSERT INTO cms_media(id,name,type,size,created) VALUES (?,?,?,?,?)').bind(id,data.name,data.type,data.size,new Date().toISOString()).run();}catch(e){await env.BUCKET.delete(id);throw e;}await env.BUCKET.delete('media-upload/'+id);
 return Response.json({id,name:data.name,type:data.type,size:data.size});
 }catch(e){return failure(e);}}
export async function PUT(request        ){try{await authorize(request);const q=new URL(request.url).searchParams,id=q.get('id')||'',part=Number(q.get('part')),data=await session(id);if(!data)return bad('Загрузка не найдена.',404);const count=Math.ceil(data.size/CHUNK);if(!Number.isInteger(part)||part<1||part>count)return bad('Недопустимая часть файла.');const expected=part===count?data.size-(count-1)*CHUNK:CHUNK;if(Number(request.headers.get('content-length'))>CHUNK)return bad('Часть файла слишком большая.',413);const bytes=await request.arrayBuffer();if(bytes.byteLength!==expected)return bad('Неполная часть файла.');const result=await env.BUCKET.resumeMultipartUpload(id,data.uploadId).uploadPart(part,bytes);return Response.json(result);}catch(e){return failure(e);}}
export async function DELETE(request        ){try{await authorize(request);const id=new URL(request.url).searchParams.get('id')||'',data=await session(id);if(data){await env.BUCKET.resumeMultipartUpload(id,data.uploadId).abort();await env.BUCKET.delete('media-upload/'+id);}return Response.json({ok:true});}catch(e){return failure(e);}}
