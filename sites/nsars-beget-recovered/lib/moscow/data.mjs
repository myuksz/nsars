import {safeContentLink,safeEmbed,safeAudio,sectionRoutes} from './sections-view.mjs';
import {upgradeMoscow} from './configuration.mjs';
import {validShop} from '../../public/moscow/shop-model.mjs';
import {contentPages} from '../moscow-content.mjs';
const photo=n=>'/moscow/media/photo-'+n+'.webp';
const paragraph=(id)=>contentPages.find(p=>p.id===id)?.blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n\n')||'';
const names=['AIR','POP ART','RED LINE','RETRO','STORIES','URBAN','MONOCHROM','TRAJECTORY'];
export function seedMoscow(){return {
 settings:{brand:'Дом детской фотографии',author:'Арсюткиной Наталии',phone:'+7 000 000 00 00',vk:'https://vk.ru/club34631432',telegram:'',instagram:'',region:'Москва и Московская область',accent:'#245B5D',paper:'#E6DDC7'},
 home:{eyebrow:'Детские сады и школы',title:'Детство, которое\nостаётся с нами.',description:'Первые друзья, большие открытия и школьные истории. Сохраним их в фотографиях и выпускных альбомах, к которым захочется возвращаться.',image:photo(6),imageAlt:'Подруги на осенней школьной фотосъёмке',note:'Живые фотографии. Альбомы с характером.'},
 about:{title:'Сначала человек.\nПотом — фотография.',text:'Дом детской фотографии — семейное дело Сергея и Наталии Арсюткиных. Наталия — фотограф и автор проектов.\n\nНам важно, чтобы ребёнок чувствовал себя спокойно и оставался собой. Помогаем с позированием, замечаем дружбу и маленькие привычки, собираем историю класса из разных характеров.\n\nОт идеи съёмки до готовой книги следим за тем, чтобы фотографии и оформление складывались в единое целое.',image:photo(5)},
 directions:[
 {slug:'kindergarten',title:'Детский сад',caption:'Самая первая глава',intro:'Друзья, любимые игры и первые открытия. Альбом о том, каким было детство до школы.',body:'Снимаем портреты, друзей, воспитателей и привычную жизнь группы: занятия, игры и прогулку. Заранее обсуждаем одежду и распорядок дня, чтобы съёмка была комфортной для детей.',designNames:'Здесь хранится детство\nОднажды в детском саду\nПервые открытия\nРисуем детство\nСкоро в школу\nДо свидания детский сад',image:'/moscow/media/garden-photo-1.webp',price:'6 страниц · 21 × 30 см · 3 500 ₽'},
 {slug:'grade-4',title:'4 класс',caption:'Впереди — целый мир',intro:'Первая учительница, свои компании и четыре года вместе. Сохраним начало большой школьной истории.',body:'В альбоме — портрет ребёнка, классный руководитель с пожеланиями, одноклассники и групповые фотографии. В стоимость входят основной съёмочный день и отдельная досъёмка отсутствовавших детей.',designNames:'Pop art\nSix seven\nГлава IV\nКинопленка\nНаш класс\nНовый этап\nЛучший класс\nЯркий',image:'/moscow/media/primary-0.webp',price:'6 страниц · 21 × 30 см · 3 500 ₽'},
 {slug:'senior',title:'9–11 классы',caption:'Остаться собой',intro:'Альбом про вас сегодняшних. С вашей дружбой, музыкой, увлечениями и взглядами на мир.',body:'Выбираем место и настроение съёмки вместе с классом. В школе, студии или на прогулке снимаем портреты, друзей, небольшие компании и весь класс. Дизайн объединяет альбомы, личные развороты сохраняют индивидуальность.',designNames:names.join('\n'),image:photo(3),price:'XS / M / Premium · от 3 500 ₽'}
 ],
 designs:[
 ...['Здесь хранится детство','Однажды в детском саду','Первые открытия','Рисуем детство','Скоро в школу','До свидания детский сад'].map((name,i)=>({slug:['zdes-hranitsya-detstvo','odnazhdy-v-detskom-sadu','pervye-otkrytiya','risuem-detstvo','skoro-v-shkolu','do-svidaniya-detskiy-sad'][i],title:name,age:'kindergarten',description:'Портреты, друзья и жизнь группы в цельном выпускном альбоме.',images:[[1,2,3,4],[5,6,7,8],[9,10,11,12,13,14],[15,16,17,18,19],[20,21,22,23],[24,25,26,27]][i].map(n=>'/moscow/media/kinder-'+n+'.webp'),hidden:false})),
 ...['Pop art','Six seven','Глава IV','Кинопленка','Наш класс','Новый этап','Лучший класс','Яркий'].map((name,i)=>({slug:['grade4-pop-art','six-seven','glava-iv','kinoplenka','nash-klass','novyy-etap','luchshiy-klass','yarkiy'][i],title:name,age:'grade-4',description:'Альбом о первой учительнице, одноклассниках и четырёх годах вместе.',images:[[1,4],[7,10],[11,14],[16,19],[20,23],[24,27],[29,32],[33,36]][i].map(n=>'/moscow/media/primary-'+n+'.webp'),hidden:false})),
 ...names.map((name,i)=>({slug:name.toLowerCase().replaceAll(' ','-'),title:name,age:'senior',description:['Светлая композиция и внимание к фотографии.','Цвет и выразительный графический ритм.','Контрастная графика с красным акцентом.','Тёплое настроение школьной истории.','Место для каждой истории класса.','Городской ритм и характерные детали.','Сдержанная композиция и выразительные портреты.','Индивидуальные истории, собранные вместе.'][i],images:['/moscow/media/album-'+i+'.webp'],hidden:false}))
 ],
 packages:[
 {slug:'xs',title:'XS',price:'3 500 ₽',size:'6 страниц',description:'Самое важное — в одной книге.',features:'Личный разворот: портрет и фотография учителя\nРазворот с одноклассниками\n2 страницы с групповыми фотографиями'},
 {slug:'m',title:'M',price:'4 690 ₽',size:'14 страниц',description:'Больше друзей, событий и общих кадров.',features:'Личный разворот: портрет и фотография с друзьями\nОдноклассники — 4 страницы\nОбщая фотография — 2 страницы\nГрупповые кадры — 4 страницы\nУчителя — 2 страницы\nОбложка на выбор'},
 {slug:'premium',title:'Premium',price:'6 790 ₽',size:'От 30 страниц',description:'Подробная история всего класса.',features:'Личный разворот\nКаждый одноклассник — на отдельной странице\nОбщая фотография — 2 страницы\nГрупповые кадры — 6 страниц\nУчителя — 2 страницы\nАрхив класса и пожелания\nОбложка на выбор'}
 ],
 works:{title:'Такими мы\nзапомним эти дни.',description:'Первые друзья в детском саду и школьные компании. Портреты, игры, прогулки и общие истории из наших съёмок.',images:['/moscow/media/garden-photo-0.webp',photo(7),'/moscow/media/garden-photo-1.webp',photo(0),'/moscow/media/garden-photo-2.webp',photo(3),'/moscow/media/garden-photo-3.webp',photo(5),'/moscow/media/garden-photo-4.webp',photo(4),'/moscow/media/garden-photo-5.webp',photo(2)]},
 preparation:[{slug:'school',title:'Школа и студия',text:paragraph(1016)},{slug:'kindergarten',title:'Детский сад',text:paragraph(1017)}],
 photoshoots:{title:'Фотографии вне\nшкольного расписания.',text:'Личные и семейные фотосессии, съёмка событий и рекламные проекты. Обсуждаем задачу, настроение и площадку, затем подбираем подходящий формат.\n\nДля записи расскажите, кого или что предстоит снимать, где и когда планируется съёмка и для чего нужны фотографии.'},
 faqs:[
 {question:'С чего начинается заказ?',answer:'С обсуждения класса или группы: сколько участников, где и когда вы хотите сниматься. Затем выбираем оформление, состав альбома и согласуем условия заказа.'},
 {question:'Можно ли добавить фотографии и развороты?',answer:'Да. Дополнительный личный разворот — 1 000 ₽ за 2 страницы. Общий разворот — 500 ₽ за каждую фотокнигу заказа. Состав и количество согласуем до вёрстки.'},
 {question:'Что делать, если ребёнок пропустил съёмку?',answer:'Для отсутствовавших детей предусмотрен отдельный съёмочный день. Время согласуем с представителем класса.'},
 {question:'Как подготовиться к съёмке?',answer:'Заранее обсуждаем одежду, обувь и аксессуары. Не нужно учить позы: фотограф подскажет. Подробные рекомендации собраны в разделе «Подготовка».'},
 {question:'Как получить цифровые фотографии?',answer:'После полной оплаты вы получаете ссылку на отобранные JPEG. Скачивание доступно 30 календарных дней. Рабочие файлы, RAW, дубли и тестовые кадры не передаются.'}
 ]
};}

// Defaults verified against the owner's public contacts page on 2026-09-28.
// Upgrade only the former seed link; retain explicitly edited contact settings.
export function withCurrentContacts(s){
 s=upgradeMoscow(s);
 return {...s,settings:{...s.settings,
  headerCity:s.settings.headerCity??"Москва",
  vk:s.settings.vk==='https://vk.ru/ns_ars'?'https://vk.ru/club34631432':s.settings.vk,
  instagram:s.settings.instagram===undefined?'':s.settings.instagram,
  telegram:s.settings.telegram===undefined?'':s.settings.telegram}};
}
export function validMoscow(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 if(s.shop!==undefined&&!validShop(s.shop,s))return false;
 const string=v=>typeof v==='string'&&v.length<=20000;
 const obj=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&keys.every(k=>string(o[k]));
 const list=(a,limit,test)=>Array.isArray(a)&&a.length<=limit&&a.every(test);
 const slug=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)&&v.length<80;
 const media=v=>string(v)&&(/^\/moscow\/media\/imported\/[a-f0-9]{64}\.(?:webp|png|jpe?g)$/.test(v)||!v||/^\/moscow\/media\/[a-z0-9-]+\.webp$/.test(v)||/^\/api\/media\?id=[a-f0-9-]{36}$/.test(v));
 const serviceMedia=v=>media(v)||(string(v)&&/^https:\/\/i\.wfolio\.ru\/x\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g)$/.test(v));
 if(s.servicePages!==undefined&&!list(s.servicePages,2,p=>['photo-services','certificates'].includes(p.slug)&&obj(p,['title','intro'])&&(p.outro===undefined||string(p.outro))&&list(p.items,15,i=>obj(i,['title','text','productId'])&&(!i.productId||/^wf-\d+$/.test(i.productId)||slug(i.productId))&&list(i.images,250,serviceMedia))))return false;
 if(s.shooting!==undefined&&!list(s.shooting,2,p=>slug(p.slug)&&string(p.title)&&list(p.copy,100,string)))return false;
 if(s.contentSections!==undefined&&(!Array.isArray(s.contentSections)||new Set(s.contentSections.map(p=>p.slug)).size!==s.contentSections.length))return false;
 if(s.contentSections!==undefined&&!list(s.contentSections,5,p=>sectionRoutes.includes(p.slug)&&string(p.title)&&list(p.blocks,250,b=>{
  if(!string(b.text))return false;
  if(['heading','text'].includes(b.type))return (b.links===undefined||list(b.links,20,a=>string(a.text)&&string(a.href)&&safeContentLink(a.href)))&&(b.strikes===undefined||list(b.strikes,10,string));
  if(b.type==='image')return media(b.src);
  if(b.type==='audio')return media(b.cover)&&safeAudio(b.src)&&string(b.href)&&safeContentLink(b.href);
  if(b.type==='embed')return string(b.src)&&safeEmbed(b.src)&&(b.poster===undefined||media(b.poster));
  if(b.type==='link')return string(b.href)&&safeContentLink(b.href);
  if(b.type==='order')return string(b.productId)&&/^[a-z0-9-]+$/.test(b.productId);
  return false;
 })))return false;
 if(s.settings.headerCity!==undefined&&!(string(s.settings.headerCity)&&s.settings.headerCity.length<=80))return false;
 if(!obj(s.settings,['brand','author','phone','vk','region','accent','paper'])||!/^#[a-f\d]{6}$/i.test(s.settings.accent)||!/^#[a-f\d]{6}$/i.test(s.settings.paper)||!/^https:\/\/(?:vk\.ru|vk\.com)\/[a-zA-Z0-9_.-]+$/.test(s.settings.vk))return false;
 if(s.settings.telegram!==undefined&&!(string(s.settings.telegram)&&(!s.settings.telegram||/^https:\/\/t\.me\/(?:[a-zA-Z][a-zA-Z0-9_]{3,31}|\+[0-9]{10,15})$/.test(s.settings.telegram))))return false;
 if(s.settings.instagram!==undefined&&!(string(s.settings.instagram)&&(!s.settings.instagram||/^https:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(s.settings.instagram))))return false;
 if(!/^\+?[0-9 ()-]{10,25}$/.test(s.settings.phone))return false;
 if(s.settings.kindergartenPrice!==undefined&&s.settings.kindergartenPrice!==null&&!(Number.isSafeInteger(s.settings.kindergartenPrice)&&s.settings.kindergartenPrice>0&&s.settings.kindergartenPrice<=1000000))return false;
 if(s.about?.technologyTitle!==undefined&&!string(s.about.technologyTitle))return false;
 if(s.about?.workImages!==undefined&&!list(s.about.workImages,20,media))return false;
 if(s.about?.portraitImage!==undefined&&!media(s.about.portraitImage))return false;
 if(s.about?.photoStoryVersion!==undefined&&![1,2,3,4,5].includes(s.about.photoStoryVersion))return false;
 for(const key of ['collageTitle','collageText','nataliaRole','sergeyRole','nataliaExpertise'])if(s.about?.[key]!==undefined&&!string(s.about[key]))return false;
 if(!obj(s.home,['eyebrow','title','description','imageAlt','note'])||!media(s.home.image)||!obj(s.about,['title','text'])||!media(s.about.image)||!obj(s.photoshoots,['title','text']))return false;
 if(!s.directions?.every(d=>d.slides===undefined||list(d.slides,20,media)))return false;
 if(!list(s.directions,3,x=>obj(x,['title','caption','intro','body','designNames','price'])&&['kindergarten','grade-4','senior'].includes(x.slug)&&media(x.image))||s.directions.length!==3||new Set(s.directions.map(x=>x.slug)).size!==3)return false;
 if(!list(s.designs,80,x=>slug(x.slug)&&obj(x,['title','description'])&&['kindergarten','grade-4','senior'].includes(x.age)&&typeof x.hidden==='boolean'&&list(x.images,40,media))||new Set(s.designs.map(x=>x.slug)).size!==s.designs.length)return false;
 for(const d of s.designs){
  if(d.configuration!==undefined&&Array.isArray(d.configuration)&&new Set(d.configuration.map(v=>v.id)).size!==d.configuration.length)return false;
  if(d.configuration!==undefined&&!list(d.configuration,6,v=>slug(v.id)&&string(v.title)&&(v.price===null||(Number.isSafeInteger(v.price)&&v.price>0&&v.price<=1000000))&&Number.isSafeInteger(v.pages)&&v.pages>=2&&v.pages<=140&&typeof v.minimumPages==='boolean'&&Array.isArray(v.covers)&&Array.isArray(v.spreads)&&new Set(v.covers.map(x=>x.id)).size===v.covers.length&&new Set(v.spreads.map(x=>x.id)).size===v.spreads.length&&list(v.covers,30,x=>slug(x.id)&&string(x.label)&&media(x.src))&&list(v.spreads,80,x=>slug(x.id)&&string(x.label)&&media(x.src))))return false;
 }
 return list(s.packages,10,x=>slug(x.slug)&&obj(x,['title','price','size','description','features']))&&obj(s.works,['title','description'])&&list(s.works.images,100,media)&&list(s.preparation,10,x=>slug(x.slug)&&obj(x,['title','text'])&&(x.copy===undefined||list(x.copy,100,string)))&&list(s.faqs,40,x=>obj(x,['question','answer']));
}
