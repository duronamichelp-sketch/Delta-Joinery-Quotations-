'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DesktopSidebar from '../DesktopSidebar';
import {useDeltaAccount} from '../CloudSync';
import {currency,read} from '../../lib/data';
import {savedQuoteDetails,type SavedQuotation,type SavedQuoteLine} from '../../lib/quotationTotals';

type PackageLine=SavedQuoteLine & {id:string};
type WorkPackage={id:string;name:string;sourceId?:string;sourceNumber?:string;sourceSavedAt?:string;origin:'saved'|'manual';lines:PackageLine[]};
type BulkQuotation={id:string;number:string;date:string;client:string;project:string;email:string;phone:string;address:string;notes:string;includeVat:boolean;works:WorkPackage[];updatedAt?:string};
const money=(n:number)=>Math.round((Number(n)||0)*100)/100;
const uid=()=>crypto.randomUUID();
const draft=():BulkQuotation=>({id:uid(),number:'DJ-BULK-'+Date.now(),date:new Date().toISOString().slice(0,10),client:'',project:'',email:'',phone:'',address:'',notes:'',includeVat:false,works:[]});
const packageSum=(work:WorkPackage)=>money(work.lines.reduce((sum,line)=>sum+(Number(line.amount)||0),0));
const validSaved=(item:SavedQuotation)=>Boolean(item.id||item.number);
function importSaved(item:SavedQuotation):WorkPackage{
 const snapshot=savedQuoteDetails(item);
 const lines=(item.costLines?.length?item.costLines:snapshot.lines).map((line)=>({
  id:uid(),category:line.category||'Other',description:line.description||'Item',
  qty:Number(line.qty)||0,rate:Number(line.rate)||0,amount:money(Number(line.amount)||0),unit:line.unit||'each'
 }));
 const subtotal=money(typeof item.subtotalAmount==='number'?item.subtotalAmount:snapshot.subtotal);
 const discrepancy=money(subtotal-lines.reduce((sum,line)=>sum+line.amount,0));
 if(Math.abs(discrepancy)>=.01){
  lines.push({id:uid(),category:'Adjustment',description:'Saved quotation subtotal reconciliation',qty:1,rate:discrepancy,amount:discrepancy,unit:'item'});
 }
 return {
  id:uid(),name:item.project||item.name||'Untitled work',sourceId:item.id,
  sourceNumber:item.number||item.id,sourceSavedAt:item.savedAt,
  origin:'saved',lines
 };
}
export default function BulkQuotationPage(){
 const account=useDeltaAccount();
 const [ready,setReady]=useState(false);
 const [quote,setQuote]=useState<BulkQuotation>(draft);
 const [saved,setSaved]=useState<SavedQuotation[]>([]);
 const [history,setHistory]=useState<BulkQuotation[]>([]);
 const [selected,setSelected]=useState('');
 const [manualName,setManualName]=useState('');
 const [openWork,setOpenWork]=useState<string[]>([]);
 const [editing,setEditing]=useState<string|null>(null);
 const [entry,setEntry]=useState({category:'Materials',description:'',qty:'1',rate:''});
 const [notice,setNotice]=useState('');
 const [saving,setSaving]=useState(false);
 const [printing,setPrinting]=useState(false);
 useEffect(()=>{
  const load=()=>{
   setSaved((read<SavedQuotation[]>('dj_saved_quotes',[])||[]).filter(validSaved));
   setHistory(read<BulkQuotation[]>('dj_bulk_quotes',[])||[]);
  };
  load();
  const active=read<BulkQuotation|null>('dj_bulk_draft',null);
  if(active&&Array.isArray(active.works))setQuote(active);
  setReady(true);
  const received=(ev:Event)=>{const k=(ev as CustomEvent<string>).detail;if(k==='dj_saved_quotes'||k==='dj_bulk_quotes')load()};
  const storage=(ev:StorageEvent)=>{if(ev.key==='dj_saved_quotes'||ev.key==='dj_bulk_quotes')load()};
  window.addEventListener('dj-cloud-received',received);window.addEventListener('storage',storage);
  return ()=>{window.removeEventListener('dj-cloud-received',received);window.removeEventListener('storage',storage)};
 },[]);
 useEffect(()=>{if(ready)localStorage.setItem('dj_bulk_draft',JSON.stringify(quote))},[quote,ready]);
 const subtotal=useMemo(()=>money(quote.works.reduce((sum,work)=>sum+packageSum(work),0)),[quote.works]);
 const vat=quote.includeVat?money(subtotal*.135):0;
 const grand=money(subtotal+vat);
 const setField=(key:keyof BulkQuotation,value:string|boolean)=>setQuote(q=>({...q,[key]:value}));
 const updateWork=(id:string,change:(work:WorkPackage)=>WorkPackage)=>setQuote(q=>({...q,works:q.works.map(w=>w.id===id?change(w):w)}));
 const addSaved=()=>{
  const choice=saved.find(x=>(x.id||x.number)===selected);
  if(!choice)return;
  const work=importSaved(choice);
  setQuote(q=>({...q,works:[...q.works,work]}));
  setOpenWork(p=>[...p,work.id]);
  setSelected('');
  setNotice('Imported '+work.name+' with '+work.lines.length+' breakdown lines. Original saved quotation unchanged.');
 };
 const addManual=()=>{
  const name=manualName.trim();if(!name)return;
  const work:WorkPackage={id:uid(),name,origin:'manual',lines:[]};
  setQuote(q=>({...q,works:[...q.works,work]}));setOpenWork(p=>[...p,work.id]);setEditing(work.id);
  setManualName('');setNotice('Work package added. Enter its individual cost lines below.');
 };
 const addLine=(id:string)=>{
  if(!entry.description.trim()||entry.rate.trim()===''||Number(entry.qty)<=0||!Number.isFinite(Number(entry.rate)))return;
  const qty=Math.max(0,Number(entry.qty)),rate=Number(entry.rate);
  const line:PackageLine={id:uid(),category:entry.category.trim()||'Other',description:entry.description.trim(),qty,rate,amount:money(qty*rate),unit:'item'};
  updateWork(id,w=>({...w,lines:[...w.lines,line]}));
  setEntry({category:'Materials',description:'',qty:'1',rate:''});setEditing(null);
 };
 const removePackage=(id:string)=>{setQuote(q=>({...q,works:q.works.filter(w=>w.id!==id)}));setNotice('Work package removed from this bulk quotation only.')};
 const newBulk=()=>{
  if(quote.works.length&&!window.confirm('Start a new bulk quotation? The current draft is kept in Saved Bulk Quotations only if it has been saved.'))return;
  setQuote(draft());setOpenWork([]);setNotice('New bulk quotation created.');
 };
 const saveBulk=async()=>{
  if(!account){setNotice('Cloud account is not ready. Draft is saved in this browser only.');return}
  if(!quote.works.length){setNotice('Add at least one work package before saving.');return}
  setSaving(true);setNotice('');
  try{
   const updated={...quote,updatedAt:new Date().toISOString()};
   const all=read<BulkQuotation[]>('dj_bulk_quotes',[])||[];
   const next=[updated,...all.filter(q=>q.id!==updated.id)];
   await account.saveTool('dj_bulk_quotes',next);
   setQuote(updated);setHistory(next);setNotice('Bulk quotation saved to cloud.');
  }catch(e){setNotice('Cloud save failed: '+(e instanceof Error?e.message:'Unknown error'))}
  finally{setSaving(false)}
 };
 const loadBulk=(id:string)=>{
  const q=history.find(x=>x.id===id);if(!q)return;
  setQuote(q);setOpenWork(q.works.map(w=>w.id));setNotice('Loaded saved bulk quotation '+q.number);
 };
 async function pdf(){
  if(!quote.works.length){setNotice('Add at least one work package to create the PDF.');return}
  setPrinting(true);
  try{
   const {jsPDF}=await import('jspdf');
   const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
   const left=17,right=193,maxWidth=right-left;
   const ink:[number,number,number]=[27,45,37],green:[number,number,number]=[22,82,54],muted:[number,number,number]=[89,103,96];
   let y=18;
   const write=(t:string,x:number,at:number,sz=9,bold=false,color=ink)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(sz);doc.setTextColor(...color);doc.text(t,x,at)};
   const rule=(at:number)=>{doc.setDrawColor(203,214,207);doc.setLineWidth(.25);doc.line(left,at,right,at)};
   const newPage=()=>{doc.addPage();y=19;write('DELTA JOINERY / BULK QUOTATION',left,y,9,true,green);write(quote.number,right,y,8,false,muted);y+=9;rule(y);y+=8};
   const needs=(h:number)=>{if(y+h>270)newPage()};
   const split=(value:string,width:number,fontSize=8)=>{
    doc.setFontSize(fontSize);return doc.splitTextToSize(value,width) as string[];
   };
   try{
    const resp=await fetch('/delta-logo.png');
    if(resp.ok){const blob=await resp.blob();const data=await new Promise<string>((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result));fr.onerror=reject;fr.readAsDataURL(blob)});doc.addImage(data,blob.type.includes('png')?'PNG':'JPEG',left,15,44,13)}
    else write('DELTA JOINERY',left,25,17,true,green);
   }catch{write('DELTA JOINERY',left,25,17,true,green)}
   doc.setFont('helvetica','bold');doc.setFontSize(18);doc.setTextColor(...ink);doc.text('BULK QUOTATION',right,23,{align:'right'});
   write('INTERNAL QUOTATION ONLY',right,29,7,true,[150,43,43]);
   y=39;rule(y);y+=9;
   write('PREPARED FOR',left,y,8,true,muted);write('QUOTATION DETAILS',111,y,8,true,muted);y+=7;
   write(quote.client||'Client not entered',left,y,11,true);
   write(quote.number,111,y,8,true);y+=6;
   for(const [label,value] of [['Project',quote.project],['Email',quote.email],['Phone',quote.phone],['Address',quote.address]]){
    if(!value?.trim())continue;
    const lines=split(label+': '+value.trim(),88,8);
    for(const v of lines){write(v,left,y,8);y+=4.5}
   }
   write('Date: '+quote.date,111,52,8);
   y+=9;rule(y);y+=10;
   write('WORK PACKAGES',left,y,12,true,green);y+=7;
   for(let i=0;i<quote.works.length;i++){
    const work=quote.works[i];
    needs(20);
    doc.setFillColor(236,244,239);doc.rect(left,y-4,maxWidth,11,'F');
    write(String(i+1).padStart(2,'0')+'  '+work.name,left+3,y+2,10,true,green);
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...green);
    doc.text(currency(packageSum(work)),right-3,y+2,{align:'right'});
    y+=13;
    if(work.sourceNumber){write('Source quotation: '+work.sourceNumber,left+3,y,7,false,muted);y+=5}
    if(!work.lines.length){write('No cost breakdown added',left+3,y,8,false,muted);y+=8;continue}
    needs(12);
    doc.setFillColor(247,249,247);doc.rect(left,y-3,maxWidth,8,'F');
    write('ITEM / DESCRIPTION',left+3,y+2,7,true,ink);
    write('QTY',135,y+2,7,true,ink);write('AMOUNT',right-3,y+2,7,true,ink);y+=9;
    for(const line of work.lines){
     const title=split(line.description,112,8);
     const sub=split(line.category+(line.unit?' / '+line.unit:''),112,7);
     const rowHeight=Math.max(10,5+title.length*4+sub.length*3.4);
     needs(rowHeight+1);
     let dy=y+4;
     for(const t of title){write(t,left+3,dy,8,true);dy+=4}
     for(const t of sub){write(t,left+3,dy,7,false,muted);dy+=3.4}
     write(String(line.qty),135,y+4,8);
     doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...ink);
     doc.text(currency(line.amount),right-3,y+4,{align:'right'});
     y+=rowHeight;rule(y);
    }
    y+=9;
   }
   needs(37);
   rule(y);y+=8;
   write('TOTAL EXCLUDING VAT',left,y,9,true,ink);
   doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...ink);doc.text(currency(subtotal),right,y,{align:'right'});y+=7;
   if(quote.includeVat){
    write('VAT (13.5%)',left,y,9,false,ink);
    doc.setFont('helvetica','normal');doc.text(currency(vat),right,y,{align:'right'});y+=8;
   }
   doc.setFillColor(236,244,239);doc.rect(left,y-5,maxWidth,14,'F');
   write(quote.includeVat?'TOTAL INCLUDING VAT':'GRAND TOTAL (EXCL. VAT)',left+3,y+4,10,true,green);
   doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...green);doc.text(currency(grand),right-3,y+4,{align:'right'});y+=17;
   if(quote.notes.trim()){
    needs(20);write('NOTES',left,y,9,true,green);y+=6;
    for(const t of split(quote.notes,168,8)){needs(6);write(t,left,y,8);y+=5}
   }
   const count=doc.getNumberOfPages();
   for(let p=1;p<=count;p++){doc.setPage(p);rule(283);write('Delta Joinery  |  '+quote.number,left,289,7,false,muted);doc.setFontSize(7);doc.setTextColor(...muted);doc.text(p+' / '+count,right,289,{align:'right'})}
   doc.save('Delta-Joinery-Bulk-'+quote.number.replace(/[^A-Za-z0-9_-]/g,'-')+'.pdf');
   setNotice('Bulk quotation PDF generated.');
  }catch(e){setNotice('PDF generation failed: '+(e instanceof Error?e.message:'Unknown error'))}
  finally{setPrinting(false)}
 }
 return <main className="dj-desktop dj-unified-page dj-bulk-page">
 <DesktopSidebar active="quote"/>
 <div className="dj-bulk-main">
  <header className="dj-bulk-top">
   <div><p className="dj-bulk-kicker">DELTA JOINERY / QUOTATIONS</p><h1>Bulk Quotation</h1><p>Combine multiple work packages into one document, including their individual cost breakdowns.</p></div>
   <div className="dj-bulk-actions"><Link href="/quote" className="dj-bulk-secondary">← Standard Quotation</Link><button type="button" className="dj-bulk-secondary" onClick={newBulk}>＋ New Bulk Quotation</button><button type="button" onClick={()=>void saveBulk()} disabled={saving||!quote.works.length}>{saving?'Saving...':'Save bulk quotation'}</button></div>
  </header>
  <div className="dj-bulk-layout">
   <section className="dj-bulk-work">
    <div className="dj-bulk-card">
     <div className="dj-bulk-card-header"><h2>01 / Project details</h2><span>{quote.number}</span></div>
     <div className="dj-bulk-fields">
      <label>Client<input value={quote.client} onChange={e=>setField('client',e.target.value)} placeholder="Client name"/></label>
      <label>Project<input value={quote.project} onChange={e=>setField('project',e.target.value)} placeholder="Overall project name"/></label>
      <label>Quotation date<input type="date" value={quote.date} onChange={e=>setField('date',e.target.value)}/></label>
      <label>Email<input value={quote.email} onChange={e=>setField('email',e.target.value)} placeholder="Email (optional)"/></label>
      <label>Phone<input value={quote.phone} onChange={e=>setField('phone',e.target.value)} placeholder="Phone (optional)"/></label>
      <label>Address<input value={quote.address} onChange={e=>setField('address',e.target.value)} placeholder="Project address"/></label>
     </div>
    </div>
    <div className="dj-bulk-card">
     <div className="dj-bulk-card-header"><h2>02 / Add work</h2><span>Saved or new</span></div>
     <div className="dj-bulk-import">
      <div><strong>Add from Saved Quotations</strong><p>Copies the saved work name, line-by-line breakdown and pre-VAT subtotal. The original stays unchanged.</p></div>
      <div className="dj-bulk-import-action"><select aria-label="Select saved quotation" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select saved quotation</option>{saved.map(item=><option key={item.id} value={item.id||item.number}>{item.project||item.name||'Unnamed work'} — {currency(typeof item.subtotalAmount==='number'?item.subtotalAmount:savedQuoteDetails(item).subtotal)}{item.finished?' (Finished)':''}</option>)}</select><button type="button" disabled={!selected} onClick={addSaved}>＋ Add from saved</button></div>
     </div>
     <div className="dj-bulk-import">
      <div><strong>Add a new work package</strong><p>Create a new wardrobe, room or other work and add its material, labour and production cost lines.</p></div>
      <div className="dj-bulk-import-action"><input aria-label="New work package name" placeholder="e.g. Wardrobe 3" value={manualName} onChange={e=>setManualName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addManual()}}/><button type="button" disabled={!manualName.trim()} onClick={addManual}>＋ Add work</button></div>
     </div>
    </div>
    <div className="dj-bulk-card">
     <div className="dj-bulk-card-header"><h2>03 / Included work packages</h2><span>{quote.works.length} works</span></div>
     {!quote.works.length&&<p className="dj-bulk-empty">No works added yet. Import a saved quotation or create a new work package above.</p>}
     {quote.works.map((work,index)=><div className="dj-bulk-package" key={work.id}>
      <div className="dj-bulk-package-head">
       <button className="dj-bulk-expand" type="button" aria-expanded={openWork.includes(work.id)} onClick={()=>setOpenWork(a=>a.includes(work.id)?a.filter(id=>id!==work.id):[...a,work.id])}>
        <span className="dj-bulk-index">{String(index+1).padStart(2,'0')}</span>
        <span><strong>{work.name}</strong><small>{work.origin==='saved'?'Imported from '+work.sourceNumber:'Manual work'} · {work.lines.length} cost lines</small></span>
        <span className="dj-bulk-chevron">{openWork.includes(work.id)?'⌃':'⌄'}</span>
       </button>
       <strong className="dj-bulk-package-price">{currency(packageSum(work))}</strong>
       <button type="button" className="dj-bulk-remove" aria-label={'Remove '+work.name} onClick={()=>removePackage(work.id)}>×</button>
      </div>
      {openWork.includes(work.id)&&<div className="dj-bulk-package-body">
       <label className="dj-bulk-rename">Work name<input value={work.name} onChange={e=>updateWork(work.id,w=>({...w,name:e.target.value}))}/></label>
       <div className="dj-bulk-line-table"><div className="dj-bulk-line-head"><span>DESCRIPTION</span><span>QTY</span><span>RATE</span><span>AMOUNT</span></div>
        {work.lines.map(line=><div className="dj-bulk-line" key={line.id}><div><b>{line.description}</b><small>{line.category}{line.unit?' · '+line.unit:''}</small></div><span>{line.qty}</span><span>{currency(line.rate)}</span><strong>{currency(line.amount)}</strong>{work.origin==='manual'&&<button type="button" aria-label="Remove cost line" onClick={()=>updateWork(work.id,w=>({...w,lines:w.lines.filter(l=>l.id!==line.id)}))}>×</button>}</div>)}
        {!work.lines.length&&<p className="dj-bulk-empty">No cost lines yet.</p>}
       </div>
       {work.origin==='manual'&&(editing===work.id?<div className="dj-bulk-line-form"><label>Category<input value={entry.category} onChange={e=>setEntry(a=>({...a,category:e.target.value}))}/></label><label>Description<input value={entry.description} onChange={e=>setEntry(a=>({...a,description:e.target.value}))}/></label><label>Quantity<input type="number" min="0.01" step="0.01" value={entry.qty} onChange={e=>setEntry(a=>({...a,qty:e.target.value}))}/></label><label>Unit price €<input type="number" min="0" step="0.01" value={entry.rate} onChange={e=>setEntry(a=>({...a,rate:e.target.value}))}/></label><button type="button" onClick={()=>addLine(work.id)} disabled={!entry.description.trim()||entry.rate===''||Number(entry.qty)<=0}>Add cost line</button><button className="dj-bulk-secondary" type="button" onClick={()=>setEditing(null)}>Cancel</button></div>:<button className="dj-bulk-secondary" type="button" onClick={()=>{setEditing(work.id);setEntry({category:'Materials',description:'',qty:'1',rate:''})}}>＋ Add cost line</button>)}
      </div>}
     </div>)}
    </div>
    <div className="dj-bulk-card"><div className="dj-bulk-card-header"><h2>04 / Notes</h2></div><textarea rows={3} value={quote.notes} onChange={e=>setField('notes',e.target.value)} placeholder="Quotation notes, exclusions or clarifications"/></div>
    <div className="dj-bulk-card"><div className="dj-bulk-card-header"><h2>Saved bulk quotations</h2><span>{history.length} saved</span></div>{history.length===0?<p className="dj-bulk-empty">No saved bulk quotations yet.</p>:<div className="dj-bulk-history">{history.map(item=><button type="button" key={item.id} onClick={()=>loadBulk(item.id)}><span><b>{item.project||item.number}</b><small>{item.client||'No client'} · {item.number} · {item.works.length} works</small></span><strong>{currency(money(item.works.reduce((sum,w)=>sum+packageSum(w),0)))}</strong></button>)}</div>}</div>
   </section>
   <aside className="dj-bulk-sidebar">
    <div className="dj-bulk-summary">
     <p>ESTIMATED BULK QUOTATION</p><strong className="dj-bulk-total">{currency(grand)}</strong>
     {quote.works.map((w,i)=><div className="dj-bulk-total-row" key={w.id}><span>{i+1}. {w.name}</span><strong>{currency(packageSum(w))}</strong></div>)}
     <div className="dj-bulk-total-row dj-bulk-divider"><span>Subtotal (excl. VAT)</span><strong>{currency(subtotal)}</strong></div>
     <label className="dj-bulk-vat"><input type="checkbox" checked={quote.includeVat} onChange={e=>setField('includeVat',e.target.checked)}/> Include VAT (13.5%)</label>
     {quote.includeVat&&<div className="dj-bulk-total-row"><span>VAT</span><strong>{currency(vat)}</strong></div>}
     <div className="dj-bulk-total-row dj-bulk-grand"><span>Grand total</span><strong>{currency(grand)}</strong></div>
     <button type="button" onClick={()=>void saveBulk()} disabled={saving||!quote.works.length}>{saving?'Saving...':'Save bulk quotation'}</button>
     <button type="button" onClick={()=>void pdf()} disabled={printing||!quote.works.length}>{printing?'Generating PDF...':'Download technical PDF →'}</button>
     <small>Imported saved work amounts are taken excluding their original VAT. VAT is applied only once to the combined quotation when selected.</small>
    </div>
    {notice&&<p role="status" className="dj-bulk-notice">{notice}</p>}
   </aside>
  </div>
 </div>
 </main>;
}
