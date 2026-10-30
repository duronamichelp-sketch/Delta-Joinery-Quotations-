'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import DesktopSidebar from '../DesktopSidebar';
import {currency,read} from '../../lib/data';
import {savedQuoteTotal,type SavedQuotation} from '../../lib/quotationTotals';

type SiteImage={path:string;name:string};
type Q=SavedQuotation & {id:string;siteImages?:SiteImage[]};
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number;siteImages?:SiteImage[]};
const clean=(v?:string)=>String(v||'').trim().toLowerCase();

export default function FinishedQuotes(){
 const [quotes,setQuotes]=useState<Q[]>([]),[tasks,setTasks]=useState<Task[]>([]),[search,setSearch]=useState('');
 const [openId,setOpenId]=useState<string|null>(null),[uploading,setUploading]=useState<string|null>(null),[notice,setNotice]=useState('');
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
  if(!storageClient)return;
  let cancelled=false;
  const images=[...quotes.flatMap(q=>q.siteImages||[]),...tasks.flatMap(t=>t.siteImages||[])];
  if(!images.length){setImageUrls({});return}
  (async()=>{
   const unique=Array.from(new Map(images.map(img=>[img.path,img])).values());
   const entries=await Promise.all(unique.map(async img=>{const {data}=await storageClient.storage.from('quotation-site-images').createSignedUrl(img.path,60*60);return [img.path,data?.signedUrl||''] as const}));
   if(!cancelled)setImageUrls(Object.fromEntries(entries));
  })();
  return()=>{cancelled=true};
 },[storageClient,quotes,tasks]);

 const finishedSaved=quotes.filter(q=>q.finished).sort((a,b)=>String(b.finishedAt||b.savedAt||'').localeCompare(String(a.finishedAt||a.savedAt||'')));
 const legacy=useMemo(()=>tasks.filter(t=>t.status==='finished'&&!finishedSaved.some(q=>clean(q.project)===clean(t.project)&&clean(q.client)===clean(t.client))).sort((a,b)=>String(b.finished||b.created||'').localeCompare(String(a.finished||a.created||''))),[tasks,quotes]);
 const filteredSaved=finishedSaved.filter(q=>[q.number,q.client,q.project].join(' ').toLowerCase().includes(search.toLowerCase()));
 const filteredLegacy=legacy.filter(t=>[t.client,t.project,t.notes].join(' ').toLowerCase().includes(search.toLowerCase()));
 const total=finishedSaved.reduce((s,q)=>s+savedQuoteTotal(q),0)+legacy.reduce((s,t)=>s+(Number(t.amount)||0),0);

 function open(q:Q){localStorage.setItem('dj_quote',JSON.stringify(q));window.location.href='/quote'}
 function reopen(q:Q){
  const next=quotes.map(x=>x.id===q.id?{...x,finished:false,finishedAt:undefined}:x);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
  const updated=tasks.map(t=>clean(t.project)===clean(q.project)&&clean(t.client)===clean(q.client)?{...t,status:'upcoming' as const,finished:undefined}:t);
  setTasks(updated);localStorage.setItem('dj_quotation_tasks',JSON.stringify(updated));
 }

 async function uploadImages(kind:'saved'|'task',id:string,files:FileList|null){
  if(!files?.length||!storageClient)return;
  setUploading(kind+':'+id);setNotice('');
  try{
   const {data:{user}}=await storageClient.auth.getUser();
   if(!user)throw new Error('Sign in to upload images');
   const added:SiteImage[]=[];
   for(const file of Array.from(files)){
    if(!file.type.startsWith('image/'))continue;
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-');
    const objectPath=`${user.id}/finished/${id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
    const {error}=await storageClient.storage.from('quotation-site-images').upload(objectPath,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
    if(error)throw error;
    added.push({path:objectPath,name:file.name});
   }
   if(kind==='saved'){
    const next=quotes.map(q=>q.id===id?{...q,siteImages:[...(q.siteImages||[]),...added]}:q);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
   }else{
    const next=tasks.map(t=>t.id===id?{...t,siteImages:[...(t.siteImages||[]),...added]}:t);setTasks(next);localStorage.setItem('dj_quotation_tasks',JSON.stringify(next));
   }
   setNotice(added.length?`${added.length} image${added.length===1?'':'s'} uploaded`:'No images selected');
   setOpenId(id);
  }catch(e){setNotice('Upload failed: '+(e instanceof Error?e.message:'Unknown error'))}
  finally{setUploading(null)}
 }

 async function removeImage(kind:'saved'|'task',id:string,img:SiteImage){
  try{await storageClient?.storage.from('quotation-site-images').remove([img.path])}catch{}
  if(kind==='saved'){
   const next=quotes.map(q=>q.id===id?{...q,siteImages:(q.siteImages||[]).filter(x=>x.path!==img.path)}:q);setQuotes(next);localStorage.setItem('dj_saved_quotes',JSON.stringify(next));
  }else{
   const next=tasks.map(t=>t.id===id?{...t,siteImages:(t.siteImages||[]).filter(x=>x.path!==img.path)}:t);setTasks(next);localStorage.setItem('dj_quotation_tasks',JSON.stringify(next));
  }
 }

 const gallery=(kind:'saved'|'task',id:string,images:SiteImage[]|undefined)=><div className="dj-finished-gallery">
  {(images||[]).length===0?<p>No site images uploaded yet.</p>:(images||[]).map(img=><figure key={img.path}><div>{imageUrls[img.path]?<img src={imageUrls[img.path]} alt={img.name}/>:<span>Loading…</span>}</div><figcaption>{img.name}</figcaption><button type="button" onClick={()=>void removeImage(kind,id,img)}>Remove</button></figure>)}
 </div>;

 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-finished-page"><DesktopSidebar active="finished"/><div className="rev-phone rev-inner">
  <header className="rev-screen-head dj-page-header dj-route-toolbar"><Link href="/" className="rev-back-link">‹</Link><b>Finished Quotations</b><div className="dj-header-actions"><Link href="/quotes" className="dj-secondary-action">Saved Quotations</Link><Link href="/quote?new=1" className="rev-mint-pill">＋ New</Link></div></header>
  <section className="rev-screen-body dj-page-body">
   <p className="rev-kicker-light">COMPLETED HISTORY</p><h1>Finished quotations</h1><p className="rev-sub">View every completed quotation and attach site images to old or new records.</p>
   <div className="dj-finished-summary"><div><span>Finished Quotations</span><strong>{finishedSaved.length+legacy.length}</strong></div><div><span>Total Finished Value</span><strong>{currency(total)}</strong></div></div>
   {notice&&<div className="dj-finished-notice">{notice}</div>}
   <input className="rev-select-row rev-search rev-search-input" aria-label="Search finished quotations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client or project..."/>

   {filteredSaved.map(q=><div className="rev-saved-row dj-finished-card" key={'saved-'+q.id}>
    <div className="rev-saved-top"><span>{q.number||'Quotation'}</span><small>Finished · Full quotation</small></div>
    <h2>{q.project||'Untitled project'}</h2>
    <p>{q.client||'No client'} · {currency(savedQuoteTotal(q))}{q.siteImages?.length?' · '+q.siteImages.length+' image'+(q.siteImages.length===1?'':'s'):''}</p>
    <div className="rev-saved-bottom">
     <button className="dj-primary-action" onClick={()=>open(q)}>View quotation →</button>
     <label className="dj-secondary-action dj-finished-upload">＋ {uploading==='saved:'+q.id?'Uploading...':'Upload Images'}<input type="file" accept="image/*" multiple disabled={!!uploading} onChange={e=>{void uploadImages('saved',q.id,e.target.files);e.currentTarget.value=''}}/></label>
     <button className="dj-secondary-action" onClick={()=>setOpenId(openId===q.id?null:q.id)}>{openId===q.id?'Hide Details':'View Details'}</button>
     <button className="dj-secondary-action" onClick={()=>reopen(q)}>↶ Reopen to Saved</button>
    </div>
    {openId===q.id&&<div className="dj-finished-detail"><div className="dj-finished-detail-grid"><span><b>Client</b>{q.client||'No client'}</span><span><b>Project</b>{q.project||'Untitled'}</span><span><b>Quotation</b>{q.number||'—'}</span><span><b>Finished Value</b>{currency(savedQuoteTotal(q))}</span></div>{gallery('saved',q.id,q.siteImages)}</div>}
   </div>)}

   {filteredLegacy.map(t=><div className="rev-saved-row dj-legacy-finished dj-finished-card" key={'legacy-'+t.id}>
    <div className="rev-saved-top"><span>Historical quotation</span><small>{t.finished||t.created||'Finished'}</small></div>
    <h2>{t.project||'Finished quotation'}</h2>
    <p>{t.client||'No client'} · {currency(Number(t.amount)||0)}{t.siteImages?.length?' · '+t.siteImages.length+' image'+(t.siteImages.length===1?'':'s'):''}</p>
    <div className="rev-saved-bottom">
     <button className="dj-primary-action" onClick={()=>setOpenId(openId===t.id?null:t.id)}>{openId===t.id?'Hide quotation':'View quotation →'}</button>
     <label className="dj-secondary-action dj-finished-upload">＋ {uploading==='task:'+t.id?'Uploading...':'Upload Images'}<input type="file" accept="image/*" multiple disabled={!!uploading} onChange={e=>{void uploadImages('task',t.id,e.target.files);e.currentTarget.value=''}}/></label>
    </div>
    {openId===t.id&&<div className="dj-finished-detail"><div className="dj-finished-detail-grid"><span><b>Client</b>{t.client||'No client'}</span><span><b>Project</b>{t.project||'Historical quotation'}</span><span><b>Finished</b>{t.finished||t.created||'—'}</span><span><b>Amount</b>{currency(Number(t.amount)||0)}</span></div>{t.notes&&<div className="dj-finished-notes"><b>Quotation notes</b><p>{t.notes}</p></div>}{gallery('task',t.id,t.siteImages)}</div>}
   </div>)}

   {filteredSaved.length===0&&filteredLegacy.length===0&&<div className="rev-white-panel"><p>No finished quotations match your search.</p></div>}
  </section>
 </div></main>
}
