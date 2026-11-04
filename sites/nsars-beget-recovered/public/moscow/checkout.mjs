import {money} from './shop-model.mjs';
export function bindCheckout(root=document){
const form=root.querySelector('#checkout-form');
if(form&&!form.dataset.bound){
 form.dataset.bound='true';
 const note=form.querySelector('.checkout-status'),button=form.querySelector('[type=submit]');
 let key=crypto.randomUUID(),lastPayload='',pending=false;
 form.addEventListener('input',()=>{const q=Number(form.elements.quantity?.value||1),price=form.dataset.price;form.querySelector('[data-order-total]').textContent=money(price===''?null:Number(price)*q);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(pending||!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));const quantity=Number(fields.quantity||1);delete fields.quantity;
  const data={productId:form.dataset.product,designId:form.dataset.design,variantId:form.dataset.variant,coverId:form.dataset.cover,mode:form.dataset.mode,quantity,fields};
  const payload=JSON.stringify(data);if(lastPayload&&payload!==lastPayload)key=crypto.randomUUID();lastPayload=payload;
  pending=true;button.disabled=true;note.textContent='Сохраняем заказ…';
  try{const r=await fetch('/api/moscow-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,key})});const out=await r.json();if(!r.ok)throw Error(out.error||'Не удалось сохранить заказ. Попробуйте ещё раз.');
   form.replaceChildren();const h=document.createElement('h2');h.textContent='Заказ получен';const p=document.createElement('p');p.textContent='Номер: '+out.number+'. Мы свяжемся с вами для согласования деталей. Сохраните номер заказа.';const total=document.createElement('p');total.textContent='Предварительная стоимость: '+money(out.total);form.append(h,p,total);h.tabIndex=-1;h.focus();
  }catch(e){note.textContent=e.message;button.disabled=false;}finally{pending=false;}
 });
}

}
