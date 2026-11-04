export const windowMonthCount=4;
export function shiftMonth(month:string,offset:number){
 const [year,index]=month.split('-').map(Number),date=new Date(Date.UTC(year,index-1+offset,1));
 return date.toISOString().slice(0,7);
}
export function visibleMonths(start:string){
 return Array.from({length:windowMonthCount},(_,i)=>{const value=shiftMonth(start,i),date=new Date(value+'-01T12:00:00Z');return {value,label:date.toLocaleDateString('ru-RU',{month:'long',timeZone:'UTC'}),year:date.getUTCFullYear(),length:new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()};});
}

export function currentMoscowMonth(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
export function monthChoices(selected:string){
 return Array.from({length:19},(_,i)=>shiftMonth(selected,i-6)).filter(value=>value>='2000-01'&&value<='2099-12').map(value=>({value,label:new Date(value+'-01T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}));
}
