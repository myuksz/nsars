import servicesSeed from './services-seed.json' with {type:'json'};
import shootingSeed from './shooting-seed.json' with {type:'json'};
import preparationSeed from './preparation-seed.json' with {type:'json'};
import releases from './releases-seed.json' with {type:'json'};
import sectionSeed from './sections-seed.json' with {type:'json'};
import faqSeed from './faq-seed.json' with {type:'json'};
import faqMoscow from './faq-moscow.json' with {type:'json'};
import catalog from './catalog.json' with {type:'json'};
import directionSlides from './direction-slides.json' with {type:'json'};
import shopSeed from './shop-seed.json' with {type:'json'};
import {mappingFor,productPrice} from '../../public/moscow/shop-model.mjs';
import {aboutPhotos,aboutPhotoDefaults,aboutCollageOrder} from './about-photos.mjs';

export const money=value=>value==null?'':new Intl.NumberFormat('ru-RU').format(value)+' ₽';
export function albumOptions(design){return (design.configuration||catalog[design.slug]?.variants||[]).map(v=>({...v,covers:v.covers.filter(x=>x.src),spreads:v.spreads.filter(x=>x.src)}));}
export function chooseAlbum(state,design,url){
 const options=albumOptions(design),variant=options.find(v=>v.id===url.searchParams.get('variant'))||options[0];
 if(!variant)return null;
 const cover=variant.covers.find(c=>c.id===url.searchParams.get('cover'))||variant.covers[0]||null;
 let price=variant.price;
 if(design.age==='kindergarten')price=state.settings.kindergartenPrice??3500;
 if(design.age==='senior'){
  const tariff=state.packages.find(p=>p.slug===variant.id);
  if(tariff&&/^\d[\d\s\u00a0\u202f]*\s*₽$/.test(tariff.price))price=Number(tariff.price.replace(/\D/g,''));
 }
 const mapping=mappingFor(state,design.slug,variant.id),product=state.shop?.products.find(p=>p.id===mapping?.productId);
 if(product)price=productPrice(state,product,mapping);
 return {options,variant,cover,price,ready:!!cover&&variant.spreads.length>0};
}
export function configurationSummary(state,design,choice){
 return [state.directions.find(d=>d.slug===design.age)?.title,design.title,choice.variant.title,choice.cover?.label,
  (choice.variant.minimumPages?'от ':'')+choice.variant.pages+' страниц','21 × 30 см',money(choice.price)].filter(Boolean).join(' · ');
}
export function upgradeMoscow(state){
 const s=structuredClone(state);
 for(const d of s.directions)if(d.slides===undefined)d.slides=[...(directionSlides[d.slug]||[])];
 if(s.servicePages===undefined)s.servicePages=structuredClone(servicesSeed);
 if(s.shooting===undefined)s.shooting=shootingSeed.map(({template,...p})=>p);
 if(s.preparationVersion!==1){s.preparation=preparationSeed.map(p=>({slug:p.slug,title:p.title,text:p.copy.join('\n\n'),copy:[...p.copy]}));s.preparationVersion=1;}
 if(s.contentSections===undefined)s.contentSections=structuredClone(sectionSeed);
 if(s.musicPlayersVersion!==1){
  const page=s.contentSections.find(p=>p.slug==='muzyka');
  if(page){
   const linked=releases.filter(r=>page.blocks.some(b=>b.type==='embed'&&b.src===r.sourceEmbed));
   const covered=new Set();
   page.blocks=page.blocks.flatMap((b,i,blocks)=>{
    if(b.type==='text'){
     const previous=blocks[i-1],earlier=blocks[i-2];
     const r=linked.find(r=>previous?.type==='image'&&previous.src===r.cover||earlier?.type==='image'&&earlier.src===r.cover&&previous?.type==='text');
     const normalize=t=>t.replaceAll('\u00a0',' ').toLowerCase().trim();
     if(r&&[normalize(r.text),'вне расписания','(выпускная версия)'].includes(normalize(b.text)))return [];
    }
    const cover=linked.find(r=>b.type==='image'&&b.src===r.cover);
    if(cover){covered.add(cover.src);const {sourceEmbed,...audio}=cover;return [audio];}
    const embed=linked.find(r=>b.type==='embed'&&b.src===r.sourceEmbed);
    if(embed){if(covered.has(embed.src))return [];const {sourceEmbed,...audio}=embed;return [audio];}
    return [b];
   });
  }
  s.musicPlayersVersion=1;
 }
 if(s.faqSourceVersion!==1){s.faqs=structuredClone(faqSeed);s.faqSourceVersion=1;}
 if(s.faqMoscowVersion!==1){s.faqs=structuredClone(faqMoscow);s.faqMoscowVersion=1;}
 const oldDesignAnswer='Для всего класса или группы выбирается единый дизайн. Если нужен другой вариант, заранее обсудите его с нами.';
 for(const item of s.faqs||[])if(item.answer===oldDesignAnswer)item.answer='Для всего класса или группы выбирается единый дизайн. Индивидуальные дизайны — отдельный проект, стоимость и условия которого согласовываются заранее.';
 if(s.works.title==='Такими мы\nзапомним эти дни.')s.works.title='Наши работы';
 const size=t=>typeof t==='string'?t.replace(/20\s*[×xх*]\s*30/gi,'21 × 30'):t;
 for(const d of s.directions){d.price=size(d.price);d.body=size(d.body);}
 if(s.settings.kindergartenPrice==null)s.settings.kindergartenPrice=3500;
 const garden=s.directions.find(d=>d.slug==='kindergarten');if(garden)garden.price='6 страниц · 21 × 30 см · '+money(s.settings.kindergartenPrice);
 if(s.about.photoStoryVersion===undefined){
  if(!s.about.workImages?.length)s.about.workImages=aboutPhotos.slice(1).map(p=>p.src);
  s.about.photoStoryVersion=1;
 }
 if(s.about.photoStoryVersion<2){
  s.about.workImages=(s.about.workImages||[]).filter(src=>src!=='/moscow/media/team-natalia-camera.webp');
  for(const p of aboutPhotos.slice(-4))if(!s.about.workImages.includes(p.src))s.about.workImages.push(p.src);
  s.about.photoStoryVersion=2;
 }
 if(s.about.photoStoryVersion<3){
  const rank=src=>{const i=aboutCollageOrder.indexOf(src);return i<0?aboutCollageOrder.length:i;};
  s.about.workImages.sort((a,b)=>rank(a)-rank(b));
  s.about.photoStoryVersion=3;
 }
 if(s.about.photoStoryVersion<4){
  const removed=['team-natalia-bench','team-natalia-color','team-natalia-street'].map(n=>'/moscow/media/'+n+'.webp');
  s.about.workImages=s.about.workImages.filter(src=>!removed.includes(src));
  if(s.about.portraitImage===undefined||s.about.portraitImage==='/moscow/media/team-together.webp')s.about.portraitImage='';
  s.about.photoStoryVersion=4;
 }
 if(s.about.photoStoryVersion<5){
  s.about.portraitImage='/moscow/media/team-together.webp';
  s.about.workImages=['team-sergey-children','team-natalia-heart','team-sergey-filming','team-sergey-balloon','team-moscow','team-embrace','team-walk'].map(n=>'/moscow/media/'+n+'.webp');
  s.about.photoStoryVersion=5;
 }
 for(const [key,value] of Object.entries(aboutPhotoDefaults))if(s.about[key]===undefined)s.about[key]=value;
 if(s.about.teamNamesVersion!==1){s.about.text=s.about.text.replace('семейное дело Сергея и Наталии Арсюткиных.','семейное дело Наталии и Сергея.');s.about.teamNamesVersion=1;}
 if(s.about.nataliaRole===undefined)s.about.nataliaRole='Фотография, дизайн и работа с детьми. Наталия придумывает визуальную историю, помогает детям чувствовать себя свободно перед камерой и создаёт оформление альбомов. В центре её работы — живые эмоции и внимание к каждому ребёнку.';
 if(s.about.sergeyRole===undefined)s.about.sergeyRole='Сергей отвечает за техническую сторону проектов: видеопроизводство, дополненную реальность, искусственный интеллект и автоматизацию. Соединяет творческий замысел с технологиями и выстраивает технические процессы.';
 if(s.about.nataliaExpertise===undefined)s.about.nataliaExpertise='Фотография · Дизайн альбомов · Работа с детьми';
 if(s.about.technologyTitle===undefined)s.about.technologyTitle='Искусственный интеллект и автоматизация · Дополненная реальность · Видеопроизводство';
 if(s.settings.instagram===undefined)s.settings.instagram='';
 for(const d of s.designs){
  if(d.configuration===undefined&&catalog[d.slug])d.configuration=structuredClone(catalog[d.slug].variants);
 }
 if(s.shop===undefined)s.shop=structuredClone(shopSeed);
 if(s.photoServicesVersion!==1){
  const prices={'wf-51128':7000,'wf-67703':5000,'wf-51129':8000,'wf-51130':30000,'wf-51131':15000,'wf-51127':10000};
  for(const page of servicesSeed)for(const item of page.items){
   const product=s.shop.products.find(p=>p.id===item.productId);if(!product)continue;
   product.description=item.text+(product.id==='wf-51128'?'\n\nАренда студии оплачивается отдельно.':'')+(['wf-51131','wf-51127'].includes(product.id)?'\n\nУказана начальная стоимость. Итоговая стоимость зависит от задачи и согласовывается перед съёмкой.':'');
   if(Object.hasOwn(prices,product.id)){product.available=true;product.priceMode='fixed';product.price=prices[product.id];}
  }
  s.photoServicesVersion=1;
 }
 return s;
}
