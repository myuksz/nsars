// Shared public-page → editor mapping. Only local Moscow routes are accepted.
export function editorPage(value='/moscow') {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '/moscow';
 const url=new URL(value,'https://local.invalid');
 if(url.origin!=='https://local.invalid'||!/^\/moscow(?:\/|$)/.test(url.pathname))return '/moscow';
 const query=new URLSearchParams();
 for(const key of ['age','kind','category','section','design','designId','productId','variant','cover'])if(url.searchParams.has(key))query.set(key,url.searchParams.get(key));
 return url.pathname+(query.size?'?'+query:'');
}
export function editorTarget(value,state){
 const url=new URL(editorPage(value),'https://local.invalid'),path=url.pathname.replace(/^\/moscow\/?/,'').replace(/\/$/,''),[kind,slug]=path.split('/');
 const list=(section,items,id,key='slug')=>{const i=items?.findIndex(x=>x[key]===id)??-1;return {section,prefix:i>=0?`${section}.${i}.`:null};};
 if(!path)return {section:'home'};
 if(kind==='directions')return list('directions',state.directions,slug);
 if(kind==='designs'||kind==='build')return list('designs',state.designs,slug);
 if(kind==='packages'){const d=state.designs.find(d=>d.title===url.searchParams.get('design'));return d?list('designs',state.designs,d.slug):{section:'packages'};}
 if(kind==='photoshoots')return list('servicePages',state.servicePages,slug);
 if(kind==='shooting')return list('shooting',state.shooting,slug);
 if(kind==='preparation')return list('preparation',state.preparation,url.searchParams.get('kind'));
 if(kind==='product'||kind==='checkout'){const t=list('shop',state.shop.products,slug||url.searchParams.get('productId'),'id');if(t.prefix)t.prefix=t.prefix.replace('shop.','shop.products.');return t;}
 if(['works','about'].includes(path))return {section:path};
 if(path==='contacts')return {section:'settings'};
 if(path==='faq')return {section:'faqs'};
 if(state.contentSections.some(p=>p.slug===path))return list('contentSections',state.contentSections,path);
 return null;
}
export function revealEditorTarget(root,target){
 if(!target?.prefix)return;
 const field=[...root.querySelectorAll('[data-field]')].find(el=>el.dataset.field.startsWith(target.prefix));
 if(!field)return;
 for(let node=field.parentElement;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
 const card=field.closest('.edit-card');
 if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'start'});}
}
