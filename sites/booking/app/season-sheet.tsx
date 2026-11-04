'use client';
import {Clock3} from 'lucide-react';
import type {Day} from './booking';
import {visibleMonths} from './calendar-window';

const types:Record<string,string>={school:'Школа',studio:'Студия',kindergarten:'Детский сад',other:'Другое'};
const statuses:Record<string,string>={free:'Свободно',pending:'На согласовании',booked:'Подтверждено',closed:'Запись закрыта'};
export function SeasonSheet({start,days,selected,busy,query,onlyPending,kind,onSelect}:{start:string;days:Day[];selected:string;busy:boolean;query:string;onlyPending:boolean;kind:string;onSelect:(date:string)=>void}){
 const seasonMonths=visibleMonths(start);
 const byDate=new Map(days.map(day=>[day.date,day]));const needle=query.toLocaleLowerCase('ru-RU').trim();
 return <section className="season-sheet" aria-label="Расписание на сезон"><div className="sheet-scroll"><table className="season-table"><caption className="sr-only">Все даты выбранных четырёх месяцев. Нажмите на день для просмотра и редактирования.</caption><thead><tr>{seasonMonths.map(month=><th key={month.value} scope="col">{month.label}<span>{month.year}</span></th>)}</tr></thead><tbody>{Array.from({length:31},(_,i)=><tr key={i}>{seasonMonths.map(month=>{
 if(i>=month.length)return <td key={month.value} className="no-date" aria-hidden="true"/>;
 const date=`${month.value}-${String(i+1).padStart(2,'0')}`,day=byDate.get(date),status=day?.status||'closed';
 const fullDate=new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
 const weekday=new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'short'});
 const matches=(!onlyPending||status==='pending')&&(!kind||day?.category===kind)&&(!needle||[date,fullDate,weekday,day?.name,day?.phone,day?.email,day?.details,day?.note,types[day?.category||''],statuses[status]].join(' ').toLocaleLowerCase('ru-RU').includes(needle));
 const color=status==='free'?'free':status==='closed'?'closed':day?.category||'other';
 const label=day?.name||(status==='free'?'Свободно':status==='closed'?'Закрыто':types[day?.category||'']||'Бронирование');
 const accessible=`${fullDate}: ${statuses[status]}${day?.category?', '+types[day.category]:''}${day?.name?', '+day.name:''}`;
 return <td key={month.value}><button className={`season-day ${color}${selected===date?' is-selected':''}${matches?'':' is-filtered'}`} disabled={busy||!matches} aria-label={accessible} aria-pressed={selected===date} title={[accessible,day?.details,day?.note].filter(Boolean).join('\n')} onClick={()=>onSelect(date)}><time dateTime={date}><b>{i+1}</b><small>{weekday}</small></time><span className="season-entry">{label}</span>{status==='pending'&&<Clock3 className="season-clock" size={12} aria-label="На согласовании"/>}{day?.note&&<span className="season-note-dot" aria-label="Есть примечание"/>}</button></td>;
 })}</tr>)}</tbody></table></div><div className="sheet-legend"><span><i className="free"/>Свободно</span>{Object.entries(types).map(([key,label])=><span key={key}><i className={key}/>{label}</span>)}<span><Clock3 className="season-clock" size={12}/>На согласовании</span><span className="sheet-total">Свободных дат: {days.filter(day=>day.status==='free').length}</span></div></section>;
}
