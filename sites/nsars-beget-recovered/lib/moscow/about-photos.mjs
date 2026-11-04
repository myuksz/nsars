// Owner-supplied originals; resized for the web with no crop, retouch or generated content.
export const aboutPhotos = [
 {src:'/moscow/media/team-together.webp',width:2048,height:1365,alt:'Наталия и Сергей Арсюткины',source:'ARS_6663.jpg'},
 {src:'/moscow/media/team-sergey-children.webp',width:2048,height:1365,alt:'Сергей показывает детям камеру',source:'1656103733172420-scaled.jpg'},
 {src:'/moscow/media/team-natalia-heart.webp',width:1638,height:2048,alt:'Наталия на прогулке',source:'ARS_5486.jpg'},
 {src:'/moscow/media/team-sergey-filming.webp',width:2048,height:1365,alt:'Сергей за видеокамерой на школьном празднике',source:'IMG_4237.JPG'},
 {src:'/moscow/media/team-sergey-balloon.webp',width:1280,height:1920,alt:'Сергей с воздушным шаром',source:'1.jpg'},
 {src:'/moscow/media/team-moscow.webp',width:2048,height:1365,alt:'Наталия и Сергей в Москве',source:'ARS_6921.jpg'},
 {src:'/moscow/media/team-embrace.webp',width:1365,height:2048,alt:'Наталия и Сергей на городской прогулке',source:'ARS_7446.jpg'},
 {src:'/moscow/media/team-walk.webp',width:2048,height:1365,alt:'Наталия и Сергей идут по городу, держась за руки',source:'ARS_7430.jpg'},
 {"src": "/moscow/media/team-natalia-color.webp", "width": 1003, "height": 1568, "alt": "Наталия с фотоаппаратом", "source": "01-IMG_1248.PNG"},
 {"src": "/moscow/media/team-natalia-bench.webp", "width": 855, "height": 1280, "alt": "Наталия с камерой на скамейке", "source": "02-IMG_1813.JPG"},
 {"src": "/moscow/media/team-natalia-street.webp", "width": 956, "height": 1155, "alt": "Наталия с камерой на улице", "source": "03-IMG_1817.JPG"},
 {"src": "/moscow/media/team-sergey-chess.webp", "width": 1364, "height": 2048, "alt": "Сергей за шахматной доской", "source": "04-162967B4-D7A5-4849-B867-4CA56271989F.webp"}
];
export const aboutPhotoDefaults = {
 portraitImage:aboutPhotos[0].src,
 collageTitle:'Семья. Команда. Общее дело.',
 collageText:'Обычно мы остаёмся за кадром. Здесь — мы сами: на прогулке, с камерой в руках, рядом с детьми. Для нас фотография начинается с доверия — и сохраняет то, что со временем становится особенно дорогим.'
};

// One-time editorial order. Later CMS reordering remains authoritative.
export const aboutCollageOrder = [
 'team-moscow','team-natalia-heart',
 'team-sergey-balloon','team-walk','team-embrace',
 'team-natalia-color','team-sergey-children','team-sergey-filming',
 'team-sergey-chess','team-natalia-bench','team-natalia-street'
].map(name=>'/moscow/media/'+name+'.webp');

export function aboutCollageRows(images){
 const rows=[];
 for(let offset=0;offset<images.length;){
  const count=offset===0?2:3,items=images.slice(offset,offset+count);
  const photos=items.map(src=>aboutPhotos.find(p=>p.src===src));
  const stack=offset===5&&items.length===3&&photos.every(Boolean)&&photos[0].width<photos[0].height&&photos.slice(1).every(p=>p.width>p.height);
  rows.push({items,stack});offset+=count;
 }
 return rows;
}
