import {authorize,read,failure} from '../runtime/cms.mjs';
import {withCurrentContacts,seedMoscow} from '../lib/moscow/data.mjs';
import {productPrice} from '../public/moscow/shop-model.mjs';
export async function GET(request        ){try{
 const row=await read('moscow-published'),s=withCurrentContacts(row?JSON.parse(row.body):seedMoscow());
 const designs=s.designs.filter(d=>!d.hidden),mappings=s.shop.mappings.filter(m=>designs.some(d=>d.slug===m.designId));
 const products=s.shop.products.filter(p=>p.available&&!s.shop.mappings.some(m=>m.productId===p.id&&!designs.some(d=>d.slug===m.designId))).map(p=>({id:p.id,name:p.name,description:p.description,images:p.images,fields:p.fields,quantityEnabled:p.quantityEnabled,price:productPrice(s,p),priceMode:p.priceMode}));
 return Response.json({version:row?.version||0,currency:'RUB',region:s.settings.region,products,designs,mappings:mappings.filter(m=>products.some(p=>p.id===m.productId))},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
