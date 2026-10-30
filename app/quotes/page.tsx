'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../DesktopSidebar';
import {currency,read} from '../../lib/data';
import {savedQuoteTotal,type SavedQuotation} from '../../lib/quotationTotals';

type Q=SavedQuotation & {id:string};
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number};

const clean=(v?:string)=>String(v||'').trim().toLowerCase();

export default function SavedQuotes(){
 const [quotes,setQuotes]=useState<Q[]>([]),[search,setSearch]=useState('');
 useEffect(()=>{setQuotes(read('dj_saved_quotes',[]))},[]);
 function open(q:Q){localStorage.setItem('dj_quote',JSON.stringify(q));window.location.href='/quote'}
 function remove(id:string){if(!confirm('Delete saved quotation?'))return;const next=quotes.filter(q=>q.id!==id);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next))}
 function markFinished(q:Q){
  const total=savedQuoteTotal(q);
  const next=quotes.map(x=>x.id===q.id?{...x,finished:true,finishedAt:new Date().toISOString(),totalAmount:total}:x);
  setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
  const tasks=read<Task[]>('dj_quotation_tasks',[]);
  let matched=false;
  const updated=tasks.map(t=>{
   const same=clean(t.project)===clean(q.project)&&clean(t.client)===clean(q.client);
   if(!matched&&same&&t.status==='upcoming'){matched=true;return {...t,status:'finished' as const,finished:new Date().toLocaleDateString('en-CA'),amount:total}}
   return t;
  });
  if(!matched)updated.unshift({id:crypto.randomUUID(),client:q.client||'',project:q.project||q.name||'Finished quotation',due:'',notes:'Finished from saved quotation',status:'finished',created:new Date().toLocaleDateString('en-CA'),finished:new Date().toLocaleDateString('en-CA'),amount:total});
  localStorage.setItem('dj_quotation_tasks',JSON.stringify(updated));
 }
 const visible=quotes.filter(q=>!q.finished&&[q.number,q.client,q.project].join(' ').toLowerCase().includes(search.toLowerCase()));
 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-saved-page"><DesktopSidebar active="quotes"/><div className="rev-phone rev-inner">
  <header className="rev-screen-head dj-page-header dj-route-toolbar"><Link href="/" className="rev-back-link">‹</Link><b>Saved Quotations</b><div className="dj-header-actions"><Link href="/finished-quotes" className="dj-secondary-action">Finished Quotations</Link><Link href="/quote" className="rev-mint-pill">＋ New</Link></div></header>
  <section className="rev-screen-body dj-page-body"><p className="rev-kicker-light">WORK IN PROGRESS</p><h1>Saved quotations</h1><p className="rev-sub">Every saved item and price stays here so you can continue exactly where you left off.</p>
   <input className="rev-select-row rev-search rev-search-input" aria-label="Search quotations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client, project or number..."/>
   {visible.length===0?<div className="rev-white-panel"><p className="dj-empty-caption">No saved quotation drafts. Start a quotation and press Save Quotation to keep your progress here.</p><Link className="dj-primary-btn dj-total-action" href="/quote">Create quotation</Link></div>:visible.map(q=><div className="rev-saved-row" key={q.id}>
    <div className="rev-saved-top"><span>{q.number||'Quotation'}</span><small>Saved Draft</small></div>
    <h2>{q.project||'Untitled project'}</h2>
    <p>{q.client||'No client'} · {q.date||'No date'} · {currency(savedQuoteTotal(q))}{q.siteImages?.length?' · '+q.siteImages.length+' site photo'+(q.siteImages.length===1?'':'s'):''}</p>
    <div className="rev-saved-bottom"><button className="dj-primary-action" onClick={()=>open(q)}>Continue quotation →</button><button type="button" className="dj-secondary-action" onClick={()=>markFinished(q)}>✓ Finish</button><button className="dj-danger-action" onClick={()=>remove(q.id)}>Delete</button></div>
   </div>)}
   <p className="dj-storage-hint">Finish moves the quotation to Finished Quotations and adds its final value to the dashboard total.</p>
  </section>
  <nav className="rev-nav"><Link href="/">⌂<small>Home</small></Link><Link href="/quote">▤<small>Quote</small></Link><Link href="/quotes" className="rev-nav-current">◷<small>Saved</small></Link><Link href="/units">▦<small>Library</small></Link></nav>
 </div></main>
}
