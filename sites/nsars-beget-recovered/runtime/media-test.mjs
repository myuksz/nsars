import {readFile} from 'node:fs/promises';
const base=new URL('../public/moscow/media-test/',import.meta.url);
const samples=JSON.parse(await readFile(new URL('samples.json',base),'utf8'));
const cache=new Map();
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}})}
async function resolveLink(s,preview){
 const k=s.id+preview,old=cache.get(k);if(old&&old.until>Date.now())return {url:old.url,cached:true};
 if(old?.pending)return old.pending;
 const pending=(async()=>{const u=new URL('https://cloud-api.yandex.net/v1/disk/public/resources'+(preview?'':'/download'));u.searchParams.set('public_key',s.key);u.searchParams.set('path',s.path);if(preview){u.searchParams.set('preview_size','1280x1280');u.searchParams.set('preview_crop','false');u.searchParams.set('fields','preview');}
 const r=await fetch(u,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Yandex API '+r.status);const d=await r.json();const link=preview?d.preview:d.href;const t=new URL(link);if(t.protocol!=='https:'||!/(^|\.)(yandex\.(ru|net|com)|yandexcloud\.net)$/.test(t.hostname))throw new Error('Unexpected media host');cache.set(k,{url:link,until:Date.now()+240000});return {url:link,cached:false};})();cache.set(k,{pending});try{return await pending}catch(e){cache.delete(k);throw e;}
}
export async function mediaTestHandle(request){const u=new URL(request.url),p=u.pathname;if(!['/moscow/media-test','/api/media-test/config','/api/media-test/resolve','/api/media-test/file','/api/media-test/stream'].includes(p))return null;
 if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
 if(p==='/moscow/media-test')return new Response(await readFile(new URL('index.html',base)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
 if(p==='/api/media-test/config')return json(samples);
 const s=samples.find(x=>x.id===u.searchParams.get('id'));if(!s)return json({error:'Unknown sample'},404);const preview=u.searchParams.get('mode')==='preview';if(preview&&s.kind!=='image')return json({error:'No preview'},400);
 try{const start=performance.now(),r=await resolveLink(s,preview);if(p.endsWith('/stream')){const headers={};const range=request.headers.get('range');if(range){if(!/^bytes=\d+-\d*$/.test(range))return json({error:'Invalid range'},416);headers.Range=range;}const upstream=await fetch(r.url,{headers,signal:AbortSignal.timeout(120000)});if(![200,206].includes(upstream.status)){await upstream.body?.cancel();return json({error:'Upstream media error'},502)}const h={'Content-Type':s.kind==='video'?'video/mp4':'image/jpeg','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};for(const key of ['Content-Length','Content-Range','Accept-Ranges'])if(upstream.headers.has(key))h[key]=upstream.headers.get(key);if(request.method==='HEAD'){await upstream.body?.cancel();return new Response(null,{status:upstream.status,headers:h})}return new Response(upstream.body,{status:upstream.status,headers:h})}if(p.endsWith('/file'))return new Response(null,{status:302,headers:{Location:r.url,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});return json({...r,apiMs:Math.round(performance.now()-start)});}catch{return json({error:'Яндекс Диск временно недоступен'},502);}
}
