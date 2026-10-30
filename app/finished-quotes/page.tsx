'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../DesktopSidebar';
import {currency,read} from '../../lib/data';
import {savedQuoteTotal,type SavedQuotation} from '../../lib/quotationTotals';

type Q=SavedQuotation & {id:string};
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number};
const clean=(v?:string)=>String(v||'').trim().toLowerCase();

export default function FinishedQuotes(){
 const [quotes,setQuotes]=useState<Q[]>([]),[tasks,setTasks]=useState<Task[]>([]),[search,setSearch]=useState('');
 useEffect(()=>{setQuotes(read('dj_saved_quotes',[]));setTasks(read('dj_quotation_tasks',[]))},[]);
 const finishedSaved=quotes.filter(q=>q.finished);
 const legacy=useMemo(()=>tasks.filter(t=>t.status==='finished'&&!finishedSaved.some(q=>clean(q.project)===clean(t.project)&&clean(q.client)===clean(t.client))),[tasks,quotes]);
 const filteredSaved=finishedSaved.filter(q=>[q.number,q.client,q.project].join(' ').toLowerCase().includes(search.toLowerCase()));
 const filteredLegacy=legacy.filter(t=>[t.client,t.project,t.notes].join(' ').toLowerCase().includes(search.toLowerCase()));
 const total=finishedSaved.reduce((s,q)=>s+savedQuoteTotal(q),0)+legacy.reduce((s,t)=>s+(Number(t.amount)||0),0);
 function open(q:Q){localStorage.setItem('dj_quote',JSON.stringify(q));window.location.href='/quote'}
 function reopen(q:Q){
  const next=quotes.map(x=>x.id===q.id?{...x,finished:false,finishedAt:undefined}:x);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
  const updated=tasks.map(t=>clean(t.project)===clean(q.project)&&clean(t.client)===clean(q.client)?{...t,status:'upcoming' as const,finished:undefined}:t);
  setTasks(updated);localStorage.setItem('dj_quotation_tasks',JSON.stringify(updated));
 }
 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-finished-page"><DesktopSidebar active="finished"/><div className="rev-phone rev-inner">
  <header className="rev-screen-head dj-page-header dj-route-toolbar"><Link href="/" className="rev-back-link">‹</Link><b>Finished Quotations</b><div className="dj-header-actions"><Link href="/quotes" className="dj-secondary-action">Saved Quotations</Link><Link href="/quote?new=1" className="rev-mint-pill">＋ New</Link></div></header>
  <section className="rev-screen-body dj-page-body">
   <p className="rev-kicker-light">COMPLETED HISTORY</p><h1>Finished quotations</h1><p className="rev-sub">Your completed quotation history, including the older records from the previous dashboard.</p>
   <div className="dj-finished-summary"><div><span>Finished Quotations</span><strong>{finishedSaved.length+legacy.length}</strong></div><div><span>Total Finished Value</span><strong>{currency(total)}</strong></div></div>
   <input className="rev-select-row rev-search rev-search-input" aria-label="Search finished quotations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client or project..."/>
   {filteredSaved.map(q=><div className="rev-saved-row" key={'saved-'+q.id}><div className="rev-saved-top"><span>{q.number||'Quotation'}</span><small>Finished · Full quotation</small></div><h2>{q.project||'Untitled project'}</h2><p>{q.client||'No client'} · {currency(savedQuoteTotal(q))}{q.siteImages?.length?' · '+q.siteImages.length+' site photo'+(q.siteImages.length===1?'':'s'):''}</p><div className="rev-saved-bottom"><button className="dj-primary-action" onClick={()=>open(q)}>View quotation →</button><button className="dj-secondary-action" onClick={()=>reopen(q)}>↶ Reopen to Saved</button></div></div>)}
   {filteredLegacy.map(t=><div className="rev-saved-row dj-legacy-finished" key={'legacy-'+t.id}><div className="rev-saved-top"><span>Historical quotation</span><small>{t.finished||t.created||'Finished'}</small></div><h2>{t.project||'Finished quotation'}</h2><p>{t.client||'No client'} · {currency(Number(t.amount)||0)}</p>{t.notes&&<small>{t.notes}</small>}</div>)}
   {filteredSaved.length===0&&filteredLegacy.length===0&&<div className="rev-white-panel"><p>No finished quotations match your search.</p></div>}
  </section>
 </div></main>
}
