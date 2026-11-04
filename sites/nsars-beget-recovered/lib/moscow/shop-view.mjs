import {productPrice,money} from '../../public/moscow/shop-model.mjs';
export function shopView(s,url,{esc,link,btn,image}){
 const path=url.pathname.replace(/^\/moscow\/?/,'').replace(/\/$/,'');
 const draft=url.searchParams.get('mode')==='draft';
 const available=s.shop.products.filter(p=>p.available||draft);
 const productId=path.startsWith('product/')?path.slice(8):url.searchParams.get('productId');
 let p=available.find(p=>p.id===productId),m=null,d=null,v=null,c=null;
 const designId=url.searchParams.get('designId'),variantId=url.searchParams.get('variant');
 if(designId){
  m=s.shop.mappings.find(m=>m.designId===designId&&m.variantId===variantId);
  if(!m||(productId&&m.productId!==productId))return {status:404};
  p=available.find(p=>p.id===m.productId);
 }else if(p)m=s.shop.mappings.find(m=>m.productId===p.id&&s.designs.some(d=>d.slug===m.designId&&(!d.hidden||draft)));
 if(!p)return {status:404};
 if(m){
  d=s.designs.find(d=>d.slug===m.designId&&(!d.hidden||draft));v=d?.configuration.find(v=>v.id===m.variantId);
  c=v?.covers.find(c=>c.id===url.searchParams.get('cover'))||(!url.searchParams.has('cover')?v?.covers[0]:null);
  if(!d||!v||!c)return {status:404};
 }else if(p.priceMode==='album'||s.shop.mappings.some(m=>m.productId===p.id))return {status:404};
 const price=productPrice(s,p,m);
 const items=v?[{...c,label:'Выбранная обложка · '+c.label},...v.spreads]:p.images.map((src,i)=>({src,label:'Фотография '+(i+1)}));
 const gallery=items.length?`<section class="album-gallery product-gallery" aria-label="Просмотр товара"><div class="album-viewer" data-slider><div class="slides">${items.map((item,i)=>`<figure class="slide" ${i?'hidden':''}>${image(item.src,p.name+' · '+item.label,'',!i)}<figcaption>${esc(item.label)}</figcaption></figure>`).join('')}</div><div class="slider-controls"><button type="button" data-prev aria-label="Предыдущее изображение" ${items.length<2?'disabled':''}>←</button><span data-counter aria-live="polite">1 / ${items.length}</span><button type="button" data-next aria-label="Следующее изображение" ${items.length<2?'disabled':''}>→</button><button type="button" data-zoom aria-label="Увеличить изображение">⤢</button></div></div></section>`:'';
 const tariff=d?.age==='senior'?s.packages.find(x=>x.slug===v.id):null;
 const composition=(tariff?.features||'').split('\n').filter(Boolean);
 const formField=f=>`<label class="checkout-field"><span>${esc(f.label)}${f.required?' *':''}</span>${f.kind==='textarea'?`<textarea name="${esc(f.key)}" rows="3" maxlength="3000" ${f.required?'required':''}></textarea>`:f.kind==='select'?`<select name="${esc(f.key)}" ${f.required?'required':''}><option value="">Выберите</option>${f.options.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>`<option>${esc(x)}</option>`).join('')}</select>`:`<input name="${esc(f.key)}" type="${f.kind==='email'?'email':f.kind==='tel'?'tel':'text'}" maxlength="3000" ${f.key==='name'?'autocomplete="name"':f.kind==='email'?'autocomplete="email"':f.kind==='tel'?'autocomplete="tel"':''} ${f.required?'required':''}>`}</label>`;
 return {status:200,pageTitle:p.name,body:`<section class="wrap section product-card"><header class="product-card-title"><p class="eyebrow">${esc(d?s.directions.find(x=>x.slug===d.age)?.title||'Выбранный альбом':'Ваш заказ')}</p><h1>${esc(d?.title||p.name)}</h1></header><div class="product-card-grid"><div class="product-details">${gallery}${v?`<dl class="product-specs"><div><dt>Тариф</dt><dd>${esc(v.title)}</dd></div><div><dt>Обложка</dt><dd>${esc(c.label)}</dd></div><div><dt>Объём</dt><dd>${v.minimumPages?'от ':''}${v.pages} страниц</dd></div><div><dt>Формат</dt><dd>21 × 30 см</dd></div></dl>`:''}${p.description?`<p class="product-description">${esc(p.description).replaceAll('\n','<br>')}</p>`:''}${composition.length?`<h2>В составе</h2><ul class="product-includes">${composition.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${v?.minimumPages?'<p class="price-note">Показаны образцы разворотов. Итоговый объём зависит от количества учеников.</p>':''}${d?link('build/'+d.slug,'Изменить обложку или тариф','text-link',{variant:v.id,cover:c.id}):''}</div><form id="checkout-form" class="checkout-form" data-product="${esc(p.id)}" data-design="${esc(d?.slug||'')}" data-variant="${esc(v?.id||'')}" data-cover="${esc(c?.id||'')}" data-price="${price??''}" data-mode="${draft?'draft':'published'}"><h2>Оформить заказ</h2><div class="total-price"><span>${p.quantityEnabled?'Предварительная стоимость заказа':v?'Предварительная стоимость за один альбом':'Предварительная стоимость'}</span><strong data-order-total>${esc(money(price))}</strong></div><div class="checkout-fields">${p.fields.map(formField).join('')}</div>${p.quantityEnabled?'<label class="checkout-field"><span>Количество</span><input type="number" name="quantity" min="1" max="500" value="1" required></label>':''}<p class="price-note">Отправляя заказ, вы передаёте указанные данные команде «Дом детской фотографии» для обратной связи и обработки этого заказа.</p><button class="button" type="submit">Отправить заказ</button><p class="price-note">Мы свяжемся с вами для согласования деталей и итоговой стоимости. Оплата сейчас не требуется.</p><p class="checkout-status" role="status" aria-live="polite"></p></form></div></section>`};
}
