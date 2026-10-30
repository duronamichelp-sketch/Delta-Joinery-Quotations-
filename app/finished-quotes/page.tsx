'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import DesktopSidebar from '../DesktopSidebar';
import {currency,read} from '../../lib/data';
import {savedQuoteDetails,type SavedQuotation} from '../../lib/quotationTotals';

type SiteImage={path:string;name:string};
type Q=SavedQuotation & {id:string;siteImages?:SiteImage[]};
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number;siteImages?:SiteImage[]};
type Selected={kind:'saved';quote:Q}|{kind:'manual';task:Task};
const clean=(v?:string)=>String(v||'').trim().toLowerCase();

export default function FinishedQuotes(){
 const [quotes,setQuotes]=useState<Q[]>([]),[tasks,setTasks]=useState<Task[]>([]),[search,setSearch]=useState('');
 const [selected,setSelected]=useState<Selected|null>(null);
 const [imageUrls,setImageUrls]=useState<Record<string,string>>({});
 const [storageClient]=useState<SupabaseClient|null>(()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}}):null});

 useEffect(()=>{
  const load=()=>{setQuotes(read('dj_saved_quotes',[]));setTasks(read('dj_quotation_tasks',[]))};
  load();
  const onQuoteSync=(e:Event)=>{const key=(e as CustomEvent<string>).detail;if(key==='dj_saved_quotes'||key==='dj_quotation_tasks')load()};
  const onStorage=(e:StorageEvent)=>{if(e.key==='dj_saved_quotes'||e.key==='dj_quotation_tasks')load()};
  window.addEventListener('dj-cloud-received',onQuoteSync);
  window.addEventListener('dj-cloud-change',onQuoteSync);
  window.addEventListener('storage',onStorage);
  window.addEventListener('focus',load);
  return()=>{window.removeEventListener('dj-cloud-received',onQuoteSync);window.removeEventListener('dj-cloud-change',onQuoteSync);window.removeEventListener('storage',onStorage);window.removeEventListener('focus',load)};
 },[]);

 useEffect(()=>{
  if(!storageClient||!selected||selected.kind!=='saved'||!(selected.quote.siteImages||[]).length){setImageUrls({});return}
  let cancelled=false;
  (async()=>{
   const entries=await Promise.all((selected.quote.siteImages||[]).map(async img=>{
    const {data}=await storageClient.storage.from('quotation-site-images').createSignedUrl(img.path,60*60);
    return [img.path,data?.signedUrl||''] as const;
   }));
   if(!cancelled)setImageUrls(Object.fromEntries(entries));
  })();
  return()=>{cancelled=true};
 },[storageClient,selected]);

 const finishedSaved=quotes.filter(q=>q.finished).sort((a,b)=>String(b.finishedAt||b.savedAt||'').localeCompare(String(a.finishedAt||a.savedAt||'')));
 const legacy=useMemo(()=>tasks.filter(t=>t.status==='finished'&&!finishedSaved.some(q=>clean(q.project)===clean(t.project)&&clean(q.client)===clean(t.client))).sort((a,b)=>String(b.finished||b.created||'').localeCompare(String(a.finished||a.created||''))),[tasks,quotes]);
 const filteredSaved=finishedSaved.filter(q=>[q.number,q.client,q.project].join(' ').toLowerCase().includes(search.toLowerCase()));
 const filteredLegacy=legacy.filter(t=>[t.client,t.project,t.notes].join(' ').toLowerCase().includes(search.toLowerCase()));
 const total=finishedSaved.reduce((s,q)=>s+savedQuoteDetails(q).total,0)+legacy.reduce((s,t)=>s+(Number(t.amount)||0),0);

 function reopen(q:Q){
  const next=quotes.map(x=>x.id===q.id?{...x,finished:false,finishedAt:undefined}:x);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
  const updated=tasks.map(t=>clean(t.project)===clean(q.project)&&clean(t.client)===clean(q.client)?{...t,status:'upcoming' as const,finished:undefined}:t);
  setTasks(updated);localStorage.setItem('dj_quotation_tasks',JSON.stringify(updated));setSelected(null);
 }

 if(selected){
  const isSaved=selected.kind==='saved';
  const q=isSaved?selected.quote:null;
  const t=!isSaved?selected.task:null;
  const details=q?savedQuoteDetails(q):null;
  const title=q?.project||t?.project||'Finished quotation';
  const client=q?.client||t?.client||'No client';
  const amount=q?details!.total:Number(t?.amount)||0;
  return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-finished-page"><DesktopSidebar active="finished"/><div className="rev-phone rev-inner">
   <header className="rev-screen-head dj-page-header dj-route-toolbar"><button type="button" className="rev-back-link" onClick={()=>setSelected(null)}>‹</button><b>Finished Quotation</b><div className="dj-header-actions"><button type="button" className="dj-primary-action" onClick={()=>window.print()}>🖨 Print Quotation</button>{q&&<button className="dj-secondary-action" onClick={()=>reopen(q)}>↶ Reopen to Saved</button>}</div></header>
   <section className="rev-screen-body dj-page-body">
    <div className="dj-print-tech-title">
     <div className="brand"><strong>DELTA JOINERY</strong><span>FINISHED QUOTATION RECORD</span></div>
     <div className="project"><span>PROJECT</span><strong>{title}</strong><small>{client}</small></div>
     <div className="doc"><span>DOCUMENT</span><strong>{q?.number||'MANUAL ENTRY'}</strong><small>{q?.date||t?.created||'—'}</small></div>
     <div className="status"><span>STATUS</span><strong>FINISHED</strong><small>{q?.finishedAt?.slice(0,10)||t?.finished||'—'}</small></div>
     <div className="value"><span>TOTAL</span><strong>{currency(amount)}</strong></div>
    </div>
    <div className="dj-finished-original-head">
     <div><p className="rev-kicker-light">{isSaved?'ORIGINAL QUOTATION':'MANUAL / HISTORICAL ENTRY'}</p><h1>{title}</h1><p>{client}</p></div>
     <strong>{currency(amount)}</strong>
    </div>

    <div className="dj-finished-original-meta">
     <span><b>Client</b>{client}</span>
     <span><b>Project</b>{title}</span>
     <span><b>Quotation No.</b>{q?.number||'—'}</span>
     <span><b>Quote Date</b>{q?.date||t?.created||'—'}</span>
     <span><b>Finished</b>{q?.finishedAt?.slice(0,10)||t?.finished||'—'}</span>
     <span><b>Total</b>{currency(amount)}</span>
    </div>

    {q&&(q.email||q.phone||q.address||q.notes)&&<section className="dj-finished-original-card dj-print-details-card"><h2>Original Details</h2><div className="dj-finished-contact">
     {q.email&&<span><b>Email</b>{q.email}</span>}{q.phone&&<span><b>Phone</b>{q.phone}</span>}{q.address&&<span><b>Address</b>{q.address}</span>}{q.notes&&<span className="wide"><b>Notes</b>{q.notes}</span>}
    </div></section>}
    {t?.notes&&<section className="dj-finished-original-card dj-print-details-card"><h2>Notes</h2><p>{t.notes}</p></section>}

    <section className="dj-finished-original-card dj-print-lines-card">
     <h2>Original Quotation</h2>
     {q&&details&&details.lines.length>0?<div className="dj-finished-lines">
      <div className="head"><span>Category</span><span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
      {details.lines.map((line,i)=><div className="row" key={i}><span>{line.category}</span><span>{line.description}</span><span>{line.qty}{line.unit?' '+line.unit:''}</span><span>{currency(line.rate)}</span><strong>{currency(line.amount)}</strong></div>)}
     </div>:<div className="dj-finished-blank"></div>}
    </section>

    <section className="dj-finished-original-card dj-print-breakdown-card">
     <h2>Cost Breakdown</h2>
     {q&&details?<div className="dj-finished-breakdown">
      {details.breakdown.filter(x=>x.amount>0).map(x=><div key={x.key}><span>{x.label}</span><strong>{currency(x.amount)}</strong></div>)}
      <div className="subtotal"><span>Subtotal</span><strong>{currency(details.subtotal)}</strong></div>
      {details.vat>0&&<div><span>VAT 13.5%</span><strong>{currency(details.vat)}</strong></div>}
      <div className="total"><span>Total</span><strong>{currency(details.total)}</strong></div>
     </div>:<div className="dj-finished-blank"></div>}
    </section>

    {q&&(q.siteImages||[]).length>0&&<section className="dj-finished-original-card dj-print-photos-card"><h2>Site Photos</h2><div className="dj-finished-readonly-gallery">{(q.siteImages||[]).map(img=><figure key={img.path}>{imageUrls[img.path]?<img src={imageUrls[img.path]} alt={img.name}/>:<div>Loading…</div>}<figcaption>{img.name}</figcaption></figure>)}</div></section>}
   </section>
  </div></main>
 }

 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-finished-page"><DesktopSidebar active="finished"/><div className="rev-phone rev-inner">
  <header className="rev-screen-head dj-page-header dj-route-toolbar"><Link href="/" className="rev-back-link">‹</Link><b>Finished Quotations</b><div className="dj-header-actions"><Link href="/quotes" className="dj-secondary-action">Saved Quotations</Link><Link href="/quote?new=1" className="rev-mint-pill">＋ New</Link></div></header>
  <section className="rev-screen-body dj-page-body">
   <p className="rev-kicker-light">COMPLETED HISTORY</p><h1>Finished quotations</h1><p className="rev-sub">Open a quotation to see the original quote and its full cost breakdown.</p>
   <div className="dj-finished-summary"><div><span>Finished Quotations</span><strong>{finishedSaved.length+legacy.length}</strong></div><div><span>Total Finished Value</span><strong>{currency(total)}</strong></div></div>
   <input className="rev-select-row rev-search rev-search-input" aria-label="Search finished quotations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client or project..."/>

   {filteredSaved.map(q=><button type="button" className="rev-saved-row dj-finished-list-button" key={'saved-'+q.id} onClick={()=>setSelected({kind:'saved',quote:q})}>
    <div className="rev-saved-top"><span>{q.number||'Quotation'}</span><small>Finished · Full quotation</small></div>
    <h2>{q.project||'Untitled project'}</h2>
    <p>{q.client||'No client'} · {currency(savedQuoteDetails(q).total)}</p>
    <div className="dj-finished-open">View original quotation →</div>
   </button>)}

   {filteredLegacy.map(t=><button type="button" className="rev-saved-row dj-legacy-finished dj-finished-list-button" key={'legacy-'+t.id} onClick={()=>setSelected({kind:'manual',task:t})}>
    <div className="rev-saved-top"><span>Historical quotation</span><small>{t.finished||t.created||'Finished'}</small></div>
    <h2>{t.project||'Finished quotation'}</h2>
    <p>{t.client||'No client'} · {currency(Number(t.amount)||0)}</p>
    <div className="dj-finished-open">View quotation →</div>
   </button>)}

   {filteredSaved.length===0&&filteredLegacy.length===0&&<div className="rev-white-panel"><p>No finished quotations match your search.</p></div>}
  </section>
 </div></main>
}
