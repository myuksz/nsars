import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Бронирование даты съёмки — Дом детской фотографии',description:'Выберите свободную дату и оформите предварительное бронирование съёмки.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
