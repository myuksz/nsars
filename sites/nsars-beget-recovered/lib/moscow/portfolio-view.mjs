import localSizes from './portfolio-local-sizes.json' with {type:'json'};
import sourcePortfolio from './portfolio.mjs';
import {portfolioHighlights} from './featured-photos.mjs';
const labels={kindergarten:'Съёмки в детских садах',school:'Школьная фотография',events:'Разные съёмки',
 's-emka-utrennikov':'Съемка утренников','dlya-vypusknyh-albomov':'Для выпускных альбомов',
 's-yomki-v-studiyah':'Студии',shkola:'Школы',ulitsa:'Улица','gotvye-albomy':'Готовые фотоальбомы',
 'otchyotnye-kontserty-studii-sovremennoy-horeografii-prostrannye-tantsy':'Концерты студии современной хореографии Пространные танцы',
 'kontserty-teatralnye-predstavleniya':'Театральные представления',sorevnovaniya:'Соревнования'};
const portfolio=sourcePortfolio.map(c=>({...c,title:labels[c.id]||c.title,sections:c.sections.map(g=>({...g,title:labels[g.id]||g.title}))}));
export const portfolioCount=portfolio.reduce((n,c)=>n+c.sections.reduce((m,g)=>m+g.images.length,0),0);
export function portfolioView(s,url,{esc,link}){
 const selected=portfolio.find(c=>c.id===url.searchParams.get('category'))||portfolio[0];
 const section=selected?.sections.find(c=>c.id===url.searchParams.get('section'))||selected?.sections[0];
 const selection=[...portfolioHighlights,...s.works.images.filter(src=>src&&src!==s.directions[0]?.image&&src!==s.home.image&&src!=='/moscow/media/photo-5.webp'&&!portfolioHighlights.includes(src))];
 const all=section?section.images.map(p=>({...p,section:section.title})):[];
 const perPage=36,totalPages=Math.max(1,Math.ceil(all.length/perPage));
 const page=Math.min(totalPages,Math.max(1,Number.parseInt(url.searchParams.get('page'),10)||1));
 const items=all.slice((page-1)*perPage,page*perPage);
 const pool=[...items,...all.filter(p=>!items.includes(p)).slice(0,24)].map(p=>({id:p.id,src:p.full||p.src,width:p.width,height:p.height,alt:p.section+' · '+s.settings.brand}));
 const rows=[];
 for(let offset=0,row=0;offset<items.length;row++){
  let count=[2,3,2][row%3];if(items.length-offset===count+1)count++;
  const photos=items.slice(offset,offset+count);
  rows.push(`<div class="portfolio-row">${photos.map((p,j)=>{const i=offset+j;return `<figure class="portfolio-shot" data-mosaic-id="${esc(p.id)}" style="--photo-ratio:${p.width/p.height};--delay:${Math.min(i,8)*25}ms" ${i%7===0||i%7===6?'data-featured':''}><button type="button" data-photo="${esc(p.full||p.src)}" aria-label="Увеличить: ${esc(p.section)}, фотография ${(page-1)*perPage+i+1}"><img src="${esc(p.full||p.src)}" alt="${esc(p.section)} · ${esc(s.settings.brand)}" width="${p.width}" height="${p.height}" loading="${i<6?'eager':'lazy'}" decoding="async"></button></figure>`;}).join('')}</div>`);
  offset+=count;
 }
 const query={...(selected?{category:selected.id}:{}),...(section?{section:section.id}:{})};
 return `<section class="wrap portfolio"><header class="portfolio-title"><p class="eyebrow">Дом детской фотографии</p><h1>${esc(s.works.title)}</h1><p>${esc(s.works.description)}</p>${s.settings.instagram?`<a class="portfolio-instagram" href="${esc(s.settings.instagram)}" target="_blank" rel="noopener noreferrer">@natalia_ars_ph ↗</a>`:''}</header><nav class="portfolio-categories" aria-label="Разделы портфолио">${portfolio.map(c=>link('works',esc(c.title),'portfolio-tab'+(selected?.id===c.id?' active':''),{category:c.id})).join('')}</nav>${selected&&selected.sections.length>1?`<div class="portfolio-sections" aria-label="Виды съёмок">${selected.sections.map(g=>link('works',esc(g.title),'chip'+(g.id===section?.id?' active':''),{category:selected.id,section:g.id})).join('')}</div>`:''}<div class="mosaic-toolbar"><button type="button" class="mosaic-toggle" aria-pressed="false" hidden>Приостановить движение</button><span class="mosaic-status" role="status"></span></div><script type="application/json" data-mosaic-pool>${JSON.stringify(pool).replaceAll('<','\\u003c')}</script><div class="portfolio-grid">${rows.join('')}</div>${totalPages>1?`<nav class="portfolio-pages" aria-label="Страницы фотографий">${page>1?link('works','← Предыдущие фотографии','button secondary',{...query,page:page-1}):'<span></span>'}<span>${page} / ${totalPages}</span>${page<totalPages?link('works','Следующие фотографии →','button',{...query,page:page+1}):'<span></span>'}</nav>`:''}</section>`;
}
