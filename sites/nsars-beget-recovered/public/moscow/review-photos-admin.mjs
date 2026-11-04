import {uploadMediaFiles} from '/upload-media.mjs';
for(const editor of document.querySelectorAll('[data-review-photos]')){
 const field=editor.querySelector('[name=photos]'),list=editor.querySelector('[data-photo-list]'),add=editor.querySelector('[data-add-review-photos]'),status=editor.querySelector('[data-photo-status]');
 let ids;try{ids=JSON.parse(field.value);}catch{ids=[];}
 const note=text=>status.textContent=text;
 function paint(){
  field.value=JSON.stringify(ids);list.replaceChildren();
  for(const id of ids){const figure=document.createElement('figure'),image=document.createElement('img'),remove=document.createElement('button');image.src='/api/media?id='+encodeURIComponent(id);image.alt='Фотография со съёмки';remove.type='button';remove.textContent='Убрать';remove.setAttribute('aria-label','Убрать фотографию из отзыва');remove.onclick=()=>{ids=ids.filter(x=>x!==id);paint();note('Фотография убрана из отзыва. Сохраните изменения.');};figure.append(image,remove);list.append(figure);}
  add.disabled=ids.length>=12;
 }
 add.onclick=async()=>{
  const form=editor.closest('form'),buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{await uploadMediaFiles({kind:'image',multiple:true,note,onUploaded:media=>{if(ids.length>=12){note('В отзыве уже 12 фотографий.');return;}ids.push(media.id);paint();note('Фотография добавлена. Сохраните отзыв, чтобы закрепить её.');}});}finally{buttons.forEach(b=>b.disabled=false);paint();}
 };
 paint();
}
