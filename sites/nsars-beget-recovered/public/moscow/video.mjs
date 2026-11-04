const time=value=>{if(!Number.isFinite(value))return '—';const seconds=Math.max(0,Math.floor(value));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
for(const root of document.querySelectorAll('[data-local-video]')){
 const video=root.querySelector('video'),seek=root.querySelector('[data-video-seek]'),status=root.querySelector('.local-video-status'),mute=root.querySelector('[data-video-mute]'),pip=root.querySelector('[data-video-pip]'),fullscreen=root.querySelector('[data-video-fullscreen]');
 const volume=root.querySelector('[data-video-volume]');let lastVolume=video.volume||1;
 const toggles=[...root.querySelectorAll('[data-video-toggle]')];let dragging=false;
 const playing=()=>!video.paused&&!video.ended;
 function update(){
  root.classList.toggle('is-playing',playing());
  for(const b of toggles){b.setAttribute('aria-label',playing()?'Пауза':'Воспроизвести');b.setAttribute('aria-pressed',String(playing()));}
  root.querySelector('[data-video-play]').hidden=playing();root.querySelector('[data-video-pause]').hidden=!playing();
  root.querySelector('[data-video-time]').textContent=time(video.currentTime);root.querySelector('[data-video-duration]').textContent=time(video.duration);
  if(Number.isFinite(video.duration)){seek.disabled=false;seek.max=String(video.duration);if(!dragging)seek.value=String(video.currentTime);seek.setAttribute('aria-valuetext',time(Number(seek.value))+' из '+time(video.duration));}
 }
 async function toggle(){status.textContent='';if(playing()){video.pause();return;}try{await video.play();}catch{status.textContent='Не удалось запустить видео. Повторите попытку или откройте его по ссылке ниже.';update();}}
 toggles.forEach(b=>b.addEventListener('click',toggle));video.addEventListener('click',toggle);
 for(const name of ['loadedmetadata','durationchange','timeupdate','pause','ended'])video.addEventListener(name,update);
 video.addEventListener('play',()=>{document.querySelectorAll('video,audio').forEach(other=>{if(other!==video)other.pause();});status.textContent='';update();});
 video.addEventListener('error',()=>{status.textContent='Видео временно недоступно. Попробуйте ещё раз или откройте его по ссылке ниже.';update();});
 seek.addEventListener('input',()=>{dragging=true;root.querySelector('[data-video-time]').textContent=time(Number(seek.value));});
 seek.addEventListener('change',()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value);dragging=false;update();});
 for(const b of root.querySelectorAll('[data-video-skip]'))b.addEventListener('click',()=>{if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+Number(b.dataset.videoSkip)));});
 function syncVolume(){const silent=video.muted||video.volume===0;const level=video.muted?0:video.volume;volume.value=String(level);volume.setAttribute('aria-valuetext',Math.round(level*100)+'%');mute.setAttribute('aria-pressed',String(silent));mute.setAttribute('aria-label',silent?'Включить звук':'Выключить звук');root.querySelector('[data-sound-waves]').style.opacity=silent?'0':'1';}
 volume.addEventListener('input',()=>{const level=Number(volume.value);video.volume=level;video.muted=level===0;if(level>0)lastVolume=level;syncVolume();});
 mute.addEventListener('click',()=>{if(video.muted||video.volume===0){video.muted=false;if(video.volume===0)video.volume=lastVolume;}else{lastVolume=video.volume;video.muted=true;}syncVolume();});
 video.addEventListener('volumechange',syncVolume);syncVolume();
 if(document.pictureInPictureEnabled&&video.requestPictureInPicture){pip.hidden=false;pip.onclick=async()=>{try{if(document.pictureInPictureElement===video)await document.exitPictureInPicture();else await video.requestPictureInPicture();}catch{status.textContent='Запустите видео, чтобы открыть его в отдельном окне.';}};}
 if(root.requestFullscreen||video.webkitEnterFullscreen){fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else video.webkitEnterFullscreen();}catch{status.textContent='Полноэкранный просмотр недоступен в этом браузере.';}};}else fullscreen.hidden=true;
 video.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();toggle();}if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();if(Number.isFinite(video.duration))video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+(event.key==='ArrowRight'?5:-5)));}});
 root.classList.add('is-enhanced');video.controls=false;update();
}
