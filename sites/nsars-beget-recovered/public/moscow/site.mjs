import './video.mjs?v=20261004-volume';
import './direction-slideshow.mjs?v=20261004';
import {initPortfolioMosaic} from './portfolio-mosaic.mjs?v=20261004-infinite2';
import {bindCheckout} from './checkout.mjs';
bindCheckout();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#navigation');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',open);nav.classList.toggle('is-open',open);});
for(const d of document.querySelectorAll('.nav-dropdown')){
 const b=d.querySelector('button');const set=v=>{b.setAttribute('aria-expanded',v);d.classList.toggle('open',v);};
 b.addEventListener('click',()=>set(b.getAttribute('aria-expanded')!=='true'));
 d.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)set(true);});d.addEventListener('mouseleave',()=>{if(matchMedia('(hover:hover)').matches)set(false);});
 d.addEventListener('focusout',e=>{if(!d.contains(e.relatedTarget))set(false);});
 document.addEventListener('click',e=>{if(!d.contains(e.target))set(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){set(false);if(d.contains(document.activeElement))b.focus();}});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('is-open')){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.focus();}});
const modal=document.querySelector('.lightbox');let returnFocus,viewItems=[],viewIndex=0;
function showLarge(index){viewIndex=(index+viewItems.length)%viewItems.length;modal.querySelector('img').src=viewItems[viewIndex];modal.querySelector('[data-lightbox-count]').textContent=(viewIndex+1)+' / '+viewItems.length;for(const b of modal.querySelectorAll('[data-lightbox-prev],[data-lightbox-next]'))b.disabled=viewItems.length<2;}
function zoom(src,button,items=[src]){if(!src)return;returnFocus=button;viewItems=items;showLarge(Math.max(0,items.indexOf(src)));modal.showModal();}
modal.querySelector('.lightbox-close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});modal.addEventListener('close',()=>returnFocus?.focus());
modal.querySelector('[data-lightbox-prev]').onclick=()=>showLarge(viewIndex-1);modal.querySelector('[data-lightbox-next]').onclick=()=>showLarge(viewIndex+1);
modal.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();showLarge(viewIndex+(e.key==='ArrowRight'?1:-1));}});
function bindGalleries(root=document){
const photographs=[...root.querySelectorAll('[data-photo]')];for(const b of photographs)b.onclick=()=>zoom(b.dataset.photo,b,photographs.map(x=>x.dataset.photo));
for(const slider of root.querySelectorAll('[data-slider]')){
 const slides=[...slider.querySelectorAll('.slide')];let index=Number(slider.dataset.start)||0,startX=0;
 const show=n=>{index=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.hidden=i!==index);const active=slides[index]?.querySelector('img[data-gallery-src]');if(active&&!active.getAttribute('src'))active.src=active.dataset.gallerySrc;const c=slider.querySelector('[data-counter]');if(c)c.textContent=(index+1)+' / '+slides.length;};
 slider.querySelector('[data-prev]')?.addEventListener('click',()=>show(index-1));slider.querySelector('[data-next]')?.addEventListener('click',()=>show(index+1));
 slider.querySelector('[data-zoom]')?.addEventListener('click',e=>zoom(slides[index]?.querySelector('img')?.src,e.currentTarget,slides.map(s=>{const img=s.querySelector('img');return img.dataset.gallerySrc||img.src;})));
 slider.addEventListener('touchstart',e=>startX=e.changedTouches[0].screenX,{passive:true});slider.addEventListener('touchend',e=>{if(slides.length>1&&Math.abs(e.changedTouches[0].screenX-startX)>60)show(index+(e.changedTouches[0].screenX<startX?1:-1));},{passive:true});
 if(slider.hasAttribute('data-random-autoplay')&&slides.length>1){
  let visible=false,timer,pausedUntil=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{clearTimeout(timer);timer=undefined;};
  const schedule=()=>{stop();if(!visible||document.hidden||reduced.matches||modal.open||slider.matches(':hover')||slider.contains(document.activeElement))return;
   timer=setTimeout(()=>{if(Date.now()<pausedUntil){schedule();return;}show((index+1+Math.floor(Math.random()*(slides.length-1)))%slides.length);schedule();},4600);
  };
  const pause=()=>{pausedUntil=Date.now()+10000;stop();};
  slider.addEventListener('pointerdown',pause);slider.addEventListener('touchstart',pause,{passive:true});
  slider.addEventListener('mouseenter',stop);slider.addEventListener('mouseleave',schedule);
  slider.addEventListener('focusin',stop);slider.addEventListener('focusout',()=>setTimeout(schedule,0));
  document.addEventListener('visibilitychange',schedule);modal.addEventListener('close',schedule);
  reduced.addEventListener('change',schedule);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visible?schedule():stop();},{threshold:.35});observer.observe(slider);
 }
}
}
bindGalleries();
initPortfolioMosaic(bindGalleries);
document.querySelector('[data-copy]')?.addEventListener('click',async()=>{const field=document.querySelector('#message'),status=document.querySelector('.copy-status');try{await navigator.clipboard.writeText(field.value);status.textContent='Скопировано. Можно отправить сообщение в ВКонтакте или Telegram.';}catch{field.focus();field.select();status.textContent='Выделили текст. Скопируйте его через меню устройства.';}});

const orderDialog=document.querySelector('.order-card-dialog');
const orderContent=orderDialog.querySelector('[data-order-content]');
let orderOpener,orderURL='',orderRequest;
orderDialog.querySelector('[data-close-order]').onclick=()=>orderDialog.close();
orderDialog.addEventListener('click',event=>{if(event.target===orderDialog)orderDialog.close();});
orderDialog.addEventListener('close',()=>{orderRequest?.abort();document.body.classList.remove('order-card-open');orderOpener?.focus();});
document.addEventListener('click',async event=>{
 const anchor=event.target.closest('a[data-order-card]');
 if(!anchor||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button)return;
 const url=new URL(anchor.href);if(url.origin!==location.origin)return;
 event.preventDefault();orderOpener=anchor;
 orderDialog.showModal();document.body.classList.add('order-card-open');
 if(orderURL===url.href&&orderContent.querySelector('.product-card'))return;
 orderRequest?.abort();orderRequest=new AbortController();const request=orderRequest;
 orderContent.textContent='Открываем выбранный альбом…';orderContent.setAttribute('aria-busy','true');
 try{
  const response=await fetch(url,{signal:request.signal});if(!response.ok)throw Error('Карточка временно недоступна.');
  const page=new DOMParser().parseFromString(await response.text(),'text/html'),card=page.querySelector('.product-card');
  if(!card)throw Error('Не удалось открыть карточку.');
  if(request.signal.aborted)return;
  orderContent.replaceChildren(document.importNode(card,true));orderURL=url.href;
  bindCheckout(orderContent);bindGalleries(orderContent);orderDialog.scrollTop=0;
  const heading=orderContent.querySelector('h1');heading.tabIndex=-1;heading.focus({preventScroll:true});
 }catch(error){
  if(request.signal.aborted)return;
  orderURL='';const message=document.createElement('p');message.textContent=error.message;
  const fallback=document.createElement('a');fallback.href=url.href;fallback.className='button';fallback.textContent='Открыть карточку отдельной страницей';
  orderContent.replaceChildren(message,fallback);
 }finally{if(orderRequest===request)orderContent.removeAttribute('aria-busy');}
});

for(const card of document.querySelectorAll('[data-release]')){
 const audio=card.querySelector('audio'),button=card.querySelector('[data-play-release]'),label=card.querySelector('[data-play-label]'),status=card.querySelector('.release-status');
 const update=()=>{const playing=!audio.paused&&!audio.ended;button.setAttribute('aria-pressed',String(playing));button.setAttribute('aria-label',(playing?'Пауза: ':'Слушать: ')+audio.getAttribute('aria-label'));label.textContent=playing?'Пауза':'Слушать';};
 button.addEventListener('click',async()=>{if(!audio.paused){audio.pause();return;}status.textContent='';try{await audio.play();}catch{status.textContent='Не удалось запустить запись. Попробуйте ещё раз или откройте релиз на музыкальной площадке.';update();}});
 audio.addEventListener('play',()=>{for(const other of document.querySelectorAll('[data-release] audio'))if(other!==audio)other.pause();status.textContent='';update();});
 audio.addEventListener('pause',update);audio.addEventListener('ended',update);
 audio.addEventListener('error',()=>{status.textContent='Запись временно недоступна. Попробуйте ещё раз или откройте релиз на музыкальной площадке.';update();});
}

// Keep editorial row proportions correct for owner-uploaded photographs as well.
for(const img of document.querySelectorAll('.portfolio-shot img')){
 const size=()=>{if(img.naturalWidth&&img.naturalHeight)img.closest('.portfolio-shot').style.setProperty('--photo-ratio',img.naturalWidth/img.naturalHeight);};
 if(img.complete)size();else img.addEventListener('load',size,{once:true});
}

// Do not load third-party thumbnails before the viewer opens the example.
for(const button of document.querySelectorAll('[data-load-video]'))button.addEventListener('click',()=>{
 const stage=button.closest('.video-stage'),template=stage.querySelector('[data-video-player]');
 if(!template)return;
 stage.replaceChildren(template.content.cloneNode(true));
 const player=stage.querySelector('video,iframe');player?.focus();
 if(player?.tagName==='VIDEO')player.play().catch(()=>{});
});
