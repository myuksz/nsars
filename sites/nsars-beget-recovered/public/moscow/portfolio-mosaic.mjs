export function initPortfolioMosaic(bindGalleries){
 let root=document.querySelector('.portfolio');if(!root)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),modal=document.querySelector('.lightbox');
 let controller,request,revision=0,userPaused=false,navigating=false;
 const reducedData=()=>navigator.connection?.saveData===true;
 function mount(reveal=true){
  controller?.abort();controller=new AbortController();const {signal}=controller;
  const grid=root.querySelector('.portfolio-grid'),tiles=[...grid.querySelectorAll('.portfolio-shot')];
  const toggle=root.querySelector('.mosaic-toggle');
  let pool;try{pool=JSON.parse(root.querySelector('[data-mosaic-pool]').textContent);}catch{return;}
  let timer,busy=false,hovering=false,pauseUntil=0,cursor=0,poolCursor=0,swapAnimation;
  const visible=new Set();
  const canMove=()=>!signal.aborted&&!navigating&&!userPaused&&!reduced.matches&&!reducedData()&&!document.hidden&&!hovering&&!modal?.open&&!grid.contains(document.activeElement)&&Date.now()>=pauseUntil;
  const stop=()=>{clearTimeout(timer);swapAnimation?.cancel();swapAnimation=undefined;};
  const schedule=()=>{stop();if(!signal.aborted&&!document.hidden&&!userPaused&&!reduced.matches&&!reducedData())timer=setTimeout(cycle,6800);};
  const syncToggle=()=>{toggle.hidden=reduced.matches||reducedData();toggle.setAttribute('aria-pressed',String(userPaused));toggle.textContent=userPaused?'Продолжить движение':'Приостановить движение';};
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(entry.isIntersecting){visible.add(entry.target);if(entry.target.classList.contains('mosaic-await')){entry.target.classList.remove('mosaic-await');entry.target.classList.add('mosaic-enter');}}
    else visible.delete(entry.target);
   }
  },{threshold:.15});
  function observeTile(tile,i){
   tile.style.viewTransitionName=i<12?'work-'+i:'none';
   tile.style.setProperty('--delay',(i%3)*65+'ms');
   if((reveal||tile.getBoundingClientRect().top>innerHeight)&&!reduced.matches)tile.classList.add('mosaic-await');
   observer.observe(tile);
  }
  tiles.forEach(observeTile);
  let pages=root.querySelector('.portfolio-pages'),loadingMore=false;
  const sentinel=document.createElement('div');sentinel.className='mosaic-load-status';sentinel.setAttribute('role','status');
  grid.after(sentinel);
  const nextPage=()=>pages?.querySelector('a:last-child')?.textContent.includes('Следующие')?pages.querySelector('a:last-child').href:null;
  if(pages)pages.hidden=true;
  const moreObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))loadMore();},{rootMargin:'1600px 0px'});
  async function loadMore(){
   const href=nextPage();if(loadingMore||!href||signal.aborted)return;
   loadingMore=true;sentinel.textContent='Загружаем фотографии…';
   try{
    const response=await fetch(href,{signal,headers:{Accept:'text/html'}});if(!response.ok)throw Error('photos');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html');
    const nextGrid=doc.querySelector('.portfolio-grid');if(!nextGrid)throw Error('grid');
    if(signal.aborted)return;
    const morePool=JSON.parse(doc.querySelector('[data-mosaic-pool]').textContent),known=new Set(pool.map(p=>p.id));
    for(const photo of morePool)if(!known.has(photo.id)){pool.push(photo);known.add(photo.id);}
    const added=[...nextGrid.querySelectorAll('.portfolio-shot')];
    for(const row of [...nextGrid.children])grid.append(row);
    for(const tile of added){tiles.push(tile);observeTile(tile,tiles.length-1);}
    pages=doc.querySelector('.portfolio-pages');bindGalleries(root);sentinel.textContent='';
    if(!nextPage()){moreObserver.disconnect();sentinel.remove();}
    else {moreObserver.unobserve(sentinel);moreObserver.observe(sentinel);}
   }catch(error){
    if(error.name!=='AbortError'){sentinel.textContent='Не удалось загрузить фотографии. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Повторить';retry.onclick=loadMore;sentinel.append(retry);}
   }finally{loadingMore=false;}
  }
  if(nextPage())moreObserver.observe(sentinel);else sentinel.remove();
  async function cycle(){
   if(busy||!canMove()){schedule();return;}
   const candidates=tiles.filter(tile=>visible.has(tile)&&tile.querySelector('img').complete&&tile.querySelector('img').naturalWidth>0);
   if(!candidates.length){schedule();return;}
   const tile=candidates[cursor++%candidates.length],button=tile.querySelector('button'),old=button.querySelector('img');
   const ratio=Number(tile.style.getPropertyValue('--photo-ratio'));
   const matches=t=>t!==tile&&t.querySelector('img').complete&&t.querySelector('img').naturalWidth>0&&t.querySelector('button').dataset.photo!==button.dataset.photo&&Math.abs(Number(t.style.getPropertyValue('--photo-ratio'))-ratio)<.025;
   const visiblePartners=candidates.filter(matches),partners=visiblePartners.length?visiblePartners:tiles.filter(matches);
   if(!partners.length){schedule();return;}
   const partner=partners[poolCursor++%partners.length],otherButton=partner.querySelector('button'),otherImage=otherButton.querySelector('img');
   const changes=[{tile,button,old,source:otherImage,src:otherButton.dataset.photo,id:partner.dataset.mosaicId},{tile:partner,button:otherButton,old:otherImage,source:old,src:button.dataset.photo,id:tile.dataset.mosaicId}];
   for(const change of changes){const img=new Image();img.decoding='async';img.alt=change.source.alt;img.width=change.source.width;img.height=change.source.height;img.className='mosaic-incoming';img.src=change.src;change.img=img;}
   busy=true;
   let timeout;
   try{
    await Promise.race([Promise.all(changes.map(c=>c.img.decode())),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('image timeout')),15000);})]);
    if(!canMove()||!visible.has(tile))return;
    const animations=changes.map(c=>{c.button.append(c.img);return c.img.animate([{opacity:0},{opacity:1}],{duration:900,easing:'ease-in-out',fill:'forwards'});});
    swapAnimation={cancel:()=>animations.forEach(a=>a.cancel())};
    await Promise.all(animations.map(a=>a.finished));swapAnimation=undefined;
    if(signal.aborted)return;
    for(const c of changes){c.old.remove();c.img.classList.remove('mosaic-incoming');c.img.style.opacity='1';c.button.dataset.photo=c.src;c.button.setAttribute('aria-label','Увеличить: '+c.img.alt);c.tile.dataset.mosaicId=c.id;}
   }catch{}
   finally{clearTimeout(timeout);for(const c of changes)if(c.img.classList.contains('mosaic-incoming'))c.img.remove();busy=false;schedule();}
  }
  grid.addEventListener('mouseenter',()=>{hovering=true;stop();},{signal});
  grid.addEventListener('mouseleave',()=>{hovering=false;schedule();},{signal});
  grid.addEventListener('pointerdown',()=>{pauseUntil=Date.now()+10000;stop();},{signal,passive:true});
  grid.addEventListener('focusin',stop,{signal});grid.addEventListener('focusout',schedule,{signal});
  toggle.addEventListener('click',()=>{userPaused=!userPaused;syncToggle();schedule();},{signal});
  document.addEventListener('visibilitychange',schedule,{signal});modal?.addEventListener('close',schedule,{signal});
  reduced.addEventListener('change',()=>{if(reduced.matches)for(const tile of tiles)tile.classList.remove('mosaic-await','mosaic-enter');syncToggle();schedule();},{signal});
  signal.addEventListener('abort',()=>{stop();observer.disconnect();moreObserver.disconnect();},{once:true});
  syncToggle();schedule();
 }
 async function navigate(url,{historyMode='push',focusLink=false,scrollToGrid=false}={}){
  request?.abort();request=new AbortController();const serial=++revision;
  navigating=true;root.setAttribute('aria-busy','true');root.querySelector('.mosaic-status').textContent='Загружаем фотографии';
  try{
   const response=await fetch(url,{signal:request.signal,headers:{Accept:'text/html'}});if(!response.ok)throw Error('navigation');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html'),next=doc.querySelector('.portfolio');if(!next)throw Error('portfolio');
   if(serial!==revision)return;
   next.querySelectorAll('.portfolio-shot').forEach((tile,i)=>tile.style.viewTransitionName=i<12?'work-'+i:'none');
   const oldTop=root.getBoundingClientRect().top;
   const update=()=>{
    if(serial!==revision)return;
    controller?.abort();root.replaceWith(next);root=next;document.title=doc.title;
    if(historyMode==='push')history.pushState({},'',url);
    bindGalleries(root);navigating=false;mount(false);
    if(focusLink){const current=[...root.querySelectorAll('.portfolio-tab,.portfolio-sections .chip')].find(a=>a.href===url);current?.focus({preventScroll:true});}
    if(scrollToGrid)root.querySelector('.portfolio-grid').scrollIntoView({block:'start'});
    else if(oldTop<0&&root.querySelector('.portfolio-grid').getBoundingClientRect().bottom<0)root.querySelector('.portfolio-categories').scrollIntoView({block:'start'});
   };
   if(document.startViewTransition&&!reduced.matches){await document.startViewTransition(update).finished;}
   else{
    const previous=[...root.querySelectorAll('.portfolio-shot')].map(t=>t.getBoundingClientRect());update();
    if(!reduced.matches)root.querySelectorAll('.portfolio-shot').forEach((tile,i)=>{const before=previous[i],after=tile.getBoundingClientRect();if(before)tile.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`,opacity:.25},{transform:'translate(0,0)',opacity:1}],{duration:600,easing:'ease-out'});});
   }
  }catch(error){if(error.name!=='AbortError'&&serial===revision)location.assign(url);}
  finally{if(serial===revision){navigating=false;root.removeAttribute('aria-busy');root.querySelector('.mosaic-status').textContent='';}}
 }
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('.portfolio-categories a,.portfolio-sections a,.portfolio-pages a');
  if(!anchor||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(anchor.href);if(url.origin!==location.origin||url.pathname!=='/moscow/works')return;
  event.preventDefault();navigate(url.href,{focusLink:event.detail===0,scrollToGrid:!!anchor.closest('.portfolio-pages')});
 });
 window.addEventListener('popstate',()=>{if(location.pathname==='/moscow/works')navigate(location.href,{historyMode:'none'});});
 mount();
}
