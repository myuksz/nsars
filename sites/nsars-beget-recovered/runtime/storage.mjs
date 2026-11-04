import {mkdir,writeFile,readFile,stat,unlink,rename,open,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {randomUUID,createHash} from 'node:crypto';
import {dataDir} from './database.mjs';
const root=dataDir+'/media';
await mkdir(root,{recursive:true,mode:0o700});
function path(key){if(!/^(?:media-upload\/)?[a-f0-9-]{36}$/.test(key))throw Error('INVALID_KEY');return root+'/'+key;}
async function put(key,value,options={}){const p=path(key);await mkdir(dirname(p),{recursive:true,mode:0o700});const temporary=p+'.'+randomUUID();await writeFile(temporary,Buffer.from(typeof value==='string'?value:await new Response(value).arrayBuffer()),{mode:0o600});await rename(temporary,p);if(options.httpMetadata)await writeFile(p+'.meta',JSON.stringify(options.httpMetadata),{mode:0o600});}
async function get(key){const p=path(key);try{const s=await stat(p);let meta={};try{meta=JSON.parse(await readFile(p+'.meta','utf8'));}catch{}return {size:s.size,body:Readable.toWeb(createReadStream(p)),httpMetadata:meta,json:async()=>JSON.parse(await readFile(p,'utf8'))};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function remove(key){await unlink(path(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});await unlink(path(key)+'.meta').catch(()=>{});}
function multipart(key,uploadId){if(!/^[a-f0-9-]{36}$/.test(uploadId))throw Error('INVALID_UPLOAD');const dir=root+'/parts/'+uploadId;return {
 uploadId,
 async uploadPart(partNumber,bytes){if(!Number.isInteger(partNumber)||partNumber<1||partNumber>64)throw Error('INVALID_PART');await mkdir(dir,{recursive:true,mode:0o700});const data=Buffer.from(bytes),etag=createHash('sha256').update(data).digest('hex');await writeFile(dir+'/'+partNumber,data,{mode:0o600});return {partNumber,etag};},
 async complete(parts){const temp=path(key)+'.partial',f=await open(temp,'w',0o600);try{for(const p of parts){const bytes=await readFile(dir+'/'+p.partNumber);if(createHash('sha256').update(bytes).digest('hex')!==p.etag)throw Error('PART_HASH');await f.write(bytes);}await f.sync();}finally{await f.close();}await rename(temp,path(key));await rm(dir,{recursive:true,force:true});},
 async abort(){await rm(dir,{recursive:true,force:true});}
};}
export const env={...process.env,BUCKET:{get,head:get,put,delete:remove,async createMultipartUpload(key,options){const id=randomUUID();await writeFile(path(key)+'.meta',JSON.stringify(options.httpMetadata),{mode:0o600});return multipart(key,id);},resumeMultipartUpload:multipart}};
