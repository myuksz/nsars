const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
for(const slider of document.querySelectorAll('[data-direction-slideshow]')){
 const frames=[...slider.querySelectorAll('img')];
 let index=0,timer,visible=false,paused=false,busy=false;
 const stop=()=>{clearTimeout(timer);timer=undefined;};
 const active=()=>visible&&!document.hidden&&!paused&&!reducedMotion.matches;
 const schedule=()=>{stop();if(active()&&frames.length>1)timer=setTimeout(advance,5200);};
 async function advance(){
  if(busy||!active())return;
  busy=true;const next=(index+1)%frames.length,img=frames[next];
  try{
   if(!img.getAttribute('src'))img.src=img.dataset.src;
   await img.decode();
   if(active()){
    frames[index].classList.remove('is-current');frames[index].setAttribute('aria-hidden','true');
    img.classList.add('is-current');img.removeAttribute('aria-hidden');index=next;
   }
  }catch{}
  finally{busy=false;schedule();}
 }
 const updateLabel=()=>{
  slider.setAttribute('aria-pressed',String(paused));
  slider.setAttribute('aria-label',paused?'Продолжить смену фотографий':'Приостановить смену фотографий');
 };
 slider.addEventListener('click',()=>{paused=!paused;updateLabel();schedule();});
 document.addEventListener('visibilitychange',schedule);
 reducedMotion.addEventListener('change',schedule);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.2}).observe(slider);
 updateLabel();
}
