// Shared by the website, its editor and the order API. Prices are always resolved on the server.
export const orderStatuses={new:'Получен',confirmed:'Подтверждён',in_progress:'В работе',completed:'Завершён',cancelled:'Отменён'};
export const money=n=>n==null?'По запросу':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n);
export function newProduct(){return {id:'product-'+crypto.randomUUID(),name:'Новый товар',description:'',available:false,images:[],priceMode:'fixed',price:0,quantityEnabled:false,fields:[{key:'name',label:'Ваше имя',kind:'text',required:true,options:''},{key:'phone',label:'Телефон',kind:'tel',required:true,options:''}]};}
export function mappingFor(s,designId,variantId){return s.shop?.mappings.find(m=>m.designId===designId&&m.variantId===variantId);}
export function albumPrice(s,d,v){
 if(d.age==='kindergarten')return s.settings.kindergartenPrice??3500;
 if(d.age==='senior'){const p=s.packages.find(p=>p.slug===v.id);if(p&&/^\d[\d\s\u00a0\u202f]*\s*₽$/.test(p.price))return Number(p.price.replace(/\D/g,''));}
 return v.price;
}
export function productPrice(s,p,mapping){
 if(p.priceMode==='request')return null;
 if(p.priceMode==='fixed')return p.price;
 const m=mapping||s.shop.mappings.find(m=>m.productId===p.id),d=s.designs.find(d=>d.slug===m?.designId),v=d?.configuration?.find(v=>v.id===m?.variantId);
 return d&&v?albumPrice(s,d,v):null;
}
export function validShop(shop,s){
 if(!Array.isArray(s.designs))return false;
 if(!shop||shop.version!==1||!Array.isArray(shop.products)||shop.products.length>300||!Array.isArray(shop.mappings)||shop.mappings.length>480)return false;
 const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
 const id=v=>text(v,100)&&/^[a-z0-9-]+$/.test(v);
 const unique=a=>new Set(a).size===a.length;
 if(!unique(shop.products.map(p=>p.id)))return false;
 for(const p of shop.products){
  if(!id(p.id)||!text(p.name)||!p.name.trim()||!text(p.description,20000)||typeof p.available!=='boolean'||!['album','fixed','request'].includes(p.priceMode)||!Number.isFinite(p.price)||p.price<0||p.price>10000000||typeof p.quantityEnabled!=='boolean')return false;
  if(!Array.isArray(p.images)||p.images.length>20||!p.images.every(src=>text(src,200)&&(/^\/moscow\/media\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/.test(src)||/^\/api\/media\?id=[a-f0-9-]{36}$/.test(src))))return false;
  if(!Array.isArray(p.fields)||!p.fields.length||p.fields.length>20||!unique(p.fields.map(f=>f.key)))return false;
  if(p.available&&p.priceMode==='album'&&!shop.mappings.some(m=>m.productId===p.id))return false;
  if(!p.fields.some(f=>f.required&&['tel','email'].includes(f.kind)))return false;
  for(const f of p.fields)if(!text(f.key,40)||!/^[a-z][a-z0-9_]*$/.test(f.key)||['__proto__','constructor','prototype'].includes(f.key)||!text(f.label)||!f.label.trim()||!['text','email','tel','textarea','select'].includes(f.kind)||typeof f.required!=='boolean'||!text(f.options,3000)||(f.kind==='select'&&!f.options.trim()))return false;
 }
 if(!unique(shop.mappings.map(m=>m.designId+'/'+m.variantId)))return false;
 return shop.mappings.every(m=>s.designs.some(d=>d.slug===m.designId&&d.configuration?.some(v=>v.id===m.variantId))&&shop.products.some(p=>p.id===m.productId));
}
export function normalizeOrder(input){
 if(!input||typeof input!=='object'||typeof input.key!=='string'||!/^[0-9a-f-]{36}$/.test(input.key)||typeof input.productId!=='string'||input.productId.length>100)throw Error('Обновите страницу и повторите заказ.');
 const quantity=input.quantity??1;if(!Number.isSafeInteger(quantity)||quantity<1||quantity>500)throw Error('Укажите количество от 1 до 500.');
 if(!input.fields||typeof input.fields!=='object'||Array.isArray(input.fields)||Object.keys(input.fields).length>20)throw Error('Проверьте поля заказа.');
 const fields={};for(const k of Object.keys(input.fields).sort()){const v=input.fields[k];if(!/^[a-z][a-z0-9_]*$/.test(k)||['__proto__','constructor','prototype'].includes(k)||typeof v!=='string'||v.length>3000)throw Error('Проверьте поля заказа.');fields[k]=v.trim();}
 for(const k of ['designId','variantId','coverId'])if(input[k]!=null&&(typeof input[k]!=='string'||input[k].length>100))throw Error('Проверьте выбранный альбом.');
 return {key:input.key,productId:input.productId,designId:input.designId||'',variantId:input.variantId||'',coverId:input.coverId||'',quantity,fields};
}
export function prepareOrder(s,input,{draft=false}={}){
 const p=s.shop.products.find(p=>p.id===input.productId&&(p.available||draft));if(!p)throw Error('Товар сейчас недоступен.');
 let mapping=null,design=null,variant=null,cover=null;
 if(input.designId){mapping=mappingFor(s,input.designId,input.variantId);design=s.designs.find(d=>d.slug===input.designId&&(!d.hidden||draft));variant=design?.configuration?.find(v=>v.id===input.variantId);cover=variant?.covers.find(c=>c.id===input.coverId&&c.src);if(mapping?.productId!==p.id||!design||!variant||!cover||!variant.spreads.length)throw Error('Выберите доступные комплектацию и обложку.');}
 else if(p.priceMode==='album'||s.shop.mappings.some(m=>m.productId===p.id)||input.variantId||input.coverId)throw Error('Сначала выберите комплектацию и обложку альбома.');
 if(!p.quantityEnabled&&input.quantity!==1)throw Error('Для этого товара количество не изменяется.');
 const fields=[];
 for(const f of p.fields){const value=input.fields[f.key]||'';if(f.required&&!value)throw Error('Заполните поле «'+f.label+'».');if(value&&f.kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('Проверьте email.');if(value&&f.kind==='tel'&&!/^\+?[\d ()-]{7,25}$/.test(value))throw Error('Проверьте телефон.');if(value&&f.kind==='select'&&!f.options.split('\n').map(x=>x.trim()).includes(value))throw Error('Выберите вариант из списка.');fields.push({key:f.key,label:f.label,value});}
 const unitPrice=productPrice(s,p,mapping);
 return {productId:p.id,productName:p.name,designId:design?.slug||'',design:design?.title||'',variantId:variant?.id||'',variant:variant?.title||'',coverId:cover?.id||'',cover:cover?.label||'',coverImage:cover?.src||'',pages:variant?.pages||null,minimumPages:variant?.minimumPages||false,format:design?'21 × 30 см':'',quantity:input.quantity,unitPrice,total:unitPrice==null?null:Math.round(unitPrice*input.quantity*100)/100,fields,source:'website'};
}
