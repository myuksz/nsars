import {localVideoView} from './video-view.mjs';
const routeMap={'/muzyka':'muzyka','/faq-1':'faq','/dopolnennaya-realnost':'dopolnennaya-realnost','/stoimost':'stoimost','/dopolnennaya-realnost-iz-vashego-video':'dopolnennaya-realnost-iz-vashego-video','/ar-dlya-naruzhnoy-reklamy2':'ar-dlya-naruzhnoy-reklamy2'};
export const sectionRoutes=['muzyka','dopolnennaya-realnost','stoimost','dopolnennaya-realnost-iz-vashego-video','ar-dlya-naruzhnoy-reklamy2'];
export function safeContentLink(value){try{const u=new URL(value,'https://ns-ars-production.ru');return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export const safeLocalVideo=value=>typeof value==='string'&&/^\/moscow\/media\/videos\/[a-z0-9-]+\.mp4$/.test(value);
export function safeEmbed(value){if(safeLocalVideo(value))return true;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&((u.hostname==='rutube.ru'&&/^\/play\/embed\/[a-f0-9]+\/?$/.test(u.pathname))||(u.hostname==='vk.com'&&u.pathname==='/video_ext.php')||(u.hostname==='music.yandex.ru'&&/^\/iframe\/album\/\d+$/.test(u.pathname))||(u.hostname==='vp.wfolio.ru'&&u.pathname.endsWith('.mp4')));}catch{return false;}}
export const safeAudio=value=>typeof value==='string'&&(/^\/moscow\/audio\/[a-z0-9-]+\.mp3$/.test(value)||/^\/api\/media\?id=[a-f0-9-]{36}$/.test(value));
export function sectionsView(s,page,{esc,link,btn,image}){
 const anchor=(href,text,cls='text-link')=>{
  if(!safeContentLink(href))return esc(text);
  const u=new URL(href,'https://ns-ars-production.ru');
  if(href.startsWith('/moscow/'))return link(href.slice(8),esc(text),cls);
  if(u.hostname==='ns-ars-production.ru'&&routeMap[u.pathname])return link(routeMap[u.pathname],esc(text),cls);
  return `<a class="${cls}" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
 };
 const rich=b=>{
  let text=esc(b.text);
  for(const strike of b.strikes||[])text=text.replace(esc(strike),'<del>'+esc(strike)+'</del>');
  // Preserve inline source links without importing executable markup.
  for(const a of b.links||[])if(a.text.trim()&&text.includes(esc(a.text)))text=text.replace(esc(a.text),anchor(a.href,a.text,''));
  return text.replaceAll('\n','<br>');
 };
 let output='',photos=[];
 const flush=()=>{if(!photos.length)return;output+=`<div class="source-photo-grid ${photos.length===1?'single':''}">${photos.map(b=>`<figure>${page.slug==='muzyka'?image(b.src,b.text):`<button type="button" data-photo="${esc(b.src)}" aria-label="Увеличить изображение">${image(b.src,b.text)}</button>`}</figure>`).join('')}</div>`;photos=[];};
 let heading=page.title;
 for(const b of page.blocks){
  if(b.type==='image'){photos.push(b);continue;}flush();
  if(b.type==='heading'){heading=b.text;output+=`<h2>${rich(b)}</h2>`;}
  if(b.type==='text')output+=`<p>${rich(b)}</p>`;
  if(b.type==='audio'&&safeAudio(b.src))output+=`<figure class="release-player" data-release><button class="release-cover" type="button" data-play-release aria-label="Слушать: ${esc(b.text)}" aria-pressed="false">${image(b.cover,b.text)}<span class="release-glass" aria-hidden="true"><svg class="release-play-icon" width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12.5"/><path class="play-symbol" d="M11 8.5 19 14l-8 5.5Z"/><path class="pause-symbol" d="M11 9v10M17 9v10"/></svg><span data-play-label>Слушать</span></span></button><figcaption><h3>${esc(b.text)}</h3><audio controls preload="none" src="${esc(b.src)}" aria-label="${esc(b.text)}"></audio><p class="release-status" role="status"></p>${anchor(b.href,'Открыть в Яндекс Музыке')}</figcaption></figure>`;
  if(b.type==='link')output+=`<div class="source-action">${anchor(b.href,b.text)}</div>`;
  if(b.type==='order'){
   const product=s.shop.products.find(p=>p.id===b.productId&&p.available);
   if(product)output+=`<div class="source-action">${btn('product/'+product.id,b.text).replace('<a ','<a data-order-card ')}</div>`;
   else output+='<p>Заказ этой услуги через сайт временно недоступен.</p>';
  }
  if(b.type==='embed'&&safeLocalVideo(b.src)){output+=localVideoView(b,heading,esc);continue;}
  if(b.type==='embed'&&safeEmbed(b.src)){
   const mp4=new URL(b.src).pathname.endsWith('.mp4'),music=b.src.includes('music.yandex.ru');
   const embedURL=new URL(b.src);embedURL.searchParams.delete('autoplay');
   const player=mp4?`<video controls playsinline preload="none" src="${esc(b.src)}" aria-label="${esc(heading)}" tabindex="0"></video>`:`<iframe src="${esc(embedURL.href)}" title="${esc(heading+' — '+b.text)}" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" tabindex="0"></iframe>`;
   const poster=b.poster?`<img class="video-poster-blur" src="${esc(b.poster)}" alt="" aria-hidden="true"><img class="video-poster-photo" src="${esc(b.poster)}" alt="">`:'';
   output+=`<figure class="source-media ${music?'music-player':''}">${music?player:`<div class="video-stage"><button class="video-poster ${b.poster?'has-photo':''}" type="button" data-load-video aria-label="Смотреть: ${esc(heading)}">${poster}<span class="video-poster-copy"><span class="video-poster-kicker">NS-ARS Production · Видеопример</span><span class="video-poster-title">${esc(heading.replaceAll('\u00a0',' ').replace(/\.\s*$/,''))}</span><span class="video-play"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>Смотреть</span></span></button><template data-video-player>${player}</template></div>`}<figcaption>${anchor(music?b.src.replace('/iframe/','/'):b.src,music?'Открыть в Яндекс Музыке':'Открыть видео отдельно')}</figcaption></figure>`;
  }
 }
 flush();
 const ar=page.slug!=='muzyka';
 return `<section class="wrap section source-page"><header class="page-title"><p class="eyebrow">NS-ARS Production</p><h1>${esc(page.title)}</h1></header>${ar?`<div class="source-section-nav" aria-label="Дополненная реальность">${[['dopolnennaya-realnost','Обзор и примеры'],['stoimost','Стоимость'],['dopolnennaya-realnost-iz-vashego-video','Из вашего видео'],['ar-dlya-naruzhnoy-reklamy2','Для рекламы']].map(([p,t])=>link(p,t,'chip'+(p===page.slug?' active':''))).join('')}</div>`:''}<div class="source-content">${output}</div></section>`;
}
