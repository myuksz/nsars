import {mediaTestHandle} from './media-test.mjs';
import {featureHandle,featureContent} from './legal-reviews.mjs';
import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {createReadStream} from 'node:fs';
import {renderMoscow,esc} from '../lib/moscow/render.mjs';
import {seedMoscow,withCurrentContacts} from '../lib/moscow/data.mjs';
import {authorize,read,owner,failure} from './cms.mjs';
import {login,logout,loginPage} from './auth.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=root+'/public';
const origin=process.env.NSARS_ORIGIN||'https://ns-ars.ru';
const routes={};for(const name of ['moscow','moscow-orders','moscow-catalog','media','media-upload'])routes['/api/'+name]=await import('../routes/'+name+'.mjs');
const mime={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.mov':'video/quicktime'};
function html(value,status=200){return new Response(value,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
async function asset(path,request){let file;try{file=await realpath(publicRoot+path);if(!file.startsWith(publicRoot+'/'))return new Response(null,{status:404});}catch{return new Response(null,{status:404});}const info=await stat(file);if(!info.isFile())return new Response(null,{status:404});const headers={'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':String(info.size),'Accept-Ranges':'bytes','Cache-Control':'public,max-age=3600'};const range=request.headers.get('range');let start=0,end=info.size-1,status=200;if(range){const match=range.match(/^bytes=(\d+)-(\d*)$/);if(!match)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+info.size}});start=Number(match[1]);end=match[2]?Number(match[2]):end;if(start>end||end>=info.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+info.size}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;headers['Content-Length']=String(end-start+1);}return new Response(request.method==='HEAD'?null:Readable.toWeb(createReadStream(file,{start,end})),{status,headers});}
export async function handle(request){try{const u=new URL(request.url),p=u.pathname;
 const signedIn=!!owner(request);
 if(p==='/moscow/media-test'||p.startsWith('/api/media-test/'))authorize(request);
 const mediaResponse=await mediaTestHandle(request);if(mediaResponse)return mediaResponse;
 const featureResponse=await featureHandle(request);if(featureResponse)return featureResponse;
 if(['/moscow/legal-terms','/moscow/legal-privacy','/moscow/review-consent'].includes(p))return new Response(null,{status:303,headers:{Location:p.replace('/moscow','')+u.search}});
 if(p==='/admin/login')return request.method==='POST'?await login(request):html(loginPage);
 if(p==='/admin/logout'&&request.method==='POST')return logout(request);
 if(['/admin','/moscow-edit','/moscow-edit.html'].includes(p)){if(!owner(request))return new Response(null,{status:303,headers:{Location:'/admin/login'}});return html(await readFile(root+'/runtime/editor.html','utf8'));}
 if(routes[p]){const method=routes[p][request.method];return method?await method(request):new Response(null,{status:405});}
 if(p==='/robots.txt')return new Response('User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /*mode=draft\nSitemap: '+origin+'/sitemap.xml\n');
 if(p==='/sitemap.xml'){const row=await read('moscow-published'),s=withCurrentContacts(row?JSON.parse(row.body):seedMoscow());const paths=['/','/legal-terms','/legal-privacy','/moscow/comments','/moscow/directions','/moscow/designs','/moscow/works','/moscow/about','/moscow/contacts','/moscow/faq','/moscow/preparation','/moscow/photoshoots',...s.directions.map(d=>'/moscow/directions/'+d.slug),...s.designs.filter(d=>!d.hidden).map(d=>'/moscow/designs/'+d.slug)];return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(p=>'<url><loc>'+esc(origin+p)+'</loc></url>').join('')+'</urlset>',{headers:{'Content-Type':'application/xml'}});}
 if(p.startsWith('/moscow/media/')||p.startsWith('/moscow/audio/')||p.startsWith('/moscow/fonts/')||(/^\/moscow\/[^/]+\.(css|mjs|svg)$/.test(p))||p==='/upload-media.mjs')return await asset(decodeURIComponent(p),request);
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(p!=='/'&&p!=='/moscow'&&!p.startsWith('/moscow/')&&!['/legal-terms','/legal-privacy','/review-consent'].includes(p))return html('Страница не найдена',404);
 const draft=u.searchParams.get('mode')==='draft';if(draft)authorize(request);
 const row=await read(draft?'moscow-draft':'moscow-published'),s=row?JSON.parse(row.body):seedMoscow();if(p==='/')u.pathname='/moscow';if(['/legal-terms','/legal-privacy','/review-consent'].includes(p))u.pathname='/moscow'+p;featureContent(request,u,s);
 const rendered=renderMoscow(s,u,{canEdit:!!owner(request)});let result=rendered.html;
 if(!draft&&!signedIn&&rendered.status===200)result=result.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow"><link rel="canonical" href="'+esc(origin+(p==='/moscow'?'/':p))+'">');
 return html(result,rendered.status);
 }catch(e){return failure(e);}}
export const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(url.origin!==origin){res.writeHead(400).end();return;}const host=req.headers.host?.split(':')[0];if(!process.env.NSARS_TEST&&host!==new URL(origin).hostname){res.writeHead(400).end();return;}const chunks=[];let size=0;const max=req.url.startsWith('/api/media')?32*1024*1024:1100000;for await(const b of req){size+=b.length;if(size>max){res.writeHead(413).end();return;}chunks.push(b);}const headers=new Headers(req.headers);headers.delete('x-nsars-client');headers.set('x-nsars-client',req.socket.remoteAddress||'unknown');const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});let response=await handle(request);if(!owner(request)&&response.status===200&&(response.headers.get("content-type")||"").includes("text/html")&&!url.searchParams.has("mode")&&(url.pathname==="/"||url.pathname==="/moscow"||url.pathname.startsWith("/moscow/")||["/legal-terms","/legal-privacy","/review-consent"].includes(url.pathname))){const page=await response.text();response=new Response(page.replace("</head>","<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,\"script\",\"https://mc.yandex.ru/metrika/tag.js\",\"ym\");ym(113248497,\"init\",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});</script><".slice(0,-1)+"</head>"),{status:response.status,headers:response.headers});}response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy',(url.pathname==='/moscow/media-test'||url.pathname.startsWith('/api/media-test/'))?'no-referrer':'strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','SAMEORIGIN');if(url.pathname.startsWith('/admin')||url.pathname.startsWith('/api/')||url.searchParams.get('mode')==='draft')response.headers.set('X-Robots-Tag','noindex, nofollow');res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD'||!response.body)res.end();else Readable.fromWeb(response.body).pipe(res);}catch{if(!res.headersSent)res.writeHead(500);res.end('Ошибка сервера.');}});
if(process.env.NSARS_TEST!=='1')server.listen(process.env.PORT||3000);
