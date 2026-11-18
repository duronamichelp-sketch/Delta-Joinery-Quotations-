'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DesktopSidebar from '../DesktopSidebar';
import {useDeltaAccount} from '../CloudSync';
import {currency,read} from '../../lib/data';
import {savedQuoteDetails,type SavedQuotation,type SavedQuoteLine} from '../../lib/quotationTotals';

type PackageLine=SavedQuoteLine & {id:string};
type WorkPackage={id:string;name:string;sourceId?:string;sourceNumber?:string;sourceSavedAt?:string;origin:'saved'|'manual';lines:PackageLine[];totalPrice?:number};
type BulkQuotation={id:string;number:string;date:string;client:string;project:string;email:string;phone:string;address:string;notes:string;includeVat:boolean;works:WorkPackage[];updatedAt?:string};
const money=(n:number)=>Math.round((Number(n)||0)*100)/100;
const uid=()=>crypto.randomUUID();
const draft=():BulkQuotation=>({id:uid(),number:'DJ-BULK-'+Date.now(),date:new Date().toISOString().slice(0,10),client:'',project:'',email:'',phone:'',address:'',notes:'',includeVat:false,works:[]});
const packageSum=(work:WorkPackage)=>money(typeof work.totalPrice==='number'&&Number.isFinite(work.totalPrice)?work.totalPrice:work.lines.reduce((sum,line)=>sum+(Number(line.amount)||0),0));
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
 const [manualPrice,setManualPrice]=useState('');
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
  setSelected('');
  setNotice('Imported '+work.name+' at '+currency(packageSum(work))+'. Original saved quotation unchanged.');
 };
 const addManual=()=>{
  const name=manualName.trim(),cost=Number(manualPrice);
  if(!name||manualPrice.trim()===''||!Number.isFinite(cost)||cost<0)return;
  const work:WorkPackage={id:uid(),name,origin:'manual',lines:[],totalPrice:money(cost)};
  setQuote(q=>({...q,works:[...q.works,work]}));
  setManualName('');setManualPrice('');setNotice('Work added to the bulk quotation.');
 };
 const removePackage=(id:string)=>{setQuote(q=>({...q,works:q.works.filter(w=>w.id!==id)}));setNotice('Work package removed from this bulk quotation only.')};
 const newBulk=()=>{
  if(quote.works.length&&!window.confirm('Start a new bulk quotation? The current draft is kept in Saved Bulk Quotations only if it has been saved.'))return;
  setQuote(draft());setNotice('New bulk quotation created.');
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
  setQuote(q);setNotice('Loaded saved bulk quotation '+q.number);
 };
 async function pdf(){
  if(!quote.works.length){setNotice('Add at least one work package to create the PDF.');return}
  setPrinting(true);
  try{
   const {jsPDF}=await import('jspdf');
   const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
   const L=19,R=191,W=R-L;
   const charcoal:[number,number,number]=[29,38,37];
   const forest:[number,number,number]=[27,80,54];
   const slate:[number,number,number]=[94,105,101];
   const ruleColor:[number,number,number]=[207,215,211];
   const light:[number,number,number]=[247,248,247];
   let y=18;
   const font=(size:number,bold=false,color=charcoal)=>{
    doc.setFont('helvetica',bold?'bold':'normal');
    doc.setFontSize(size);doc.setTextColor(...color);
   };
   const label=(value:string,x:number,at:number,size=8,bold=false,color=charcoal)=>{
    font(size,bold,color);doc.text(value,x,at);
   };
   const alignRight=(value:string,x:number,at:number,size=8,bold=false,color=charcoal)=>{
    font(size,bold,color);doc.text(value,x,at,{align:'right'});
   };
   const stroke=(at:number,color=ruleColor,width=.3)=>{
    doc.setDrawColor(...color);doc.setLineWidth(width);doc.line(L,at,R,at);
   };
   const wrap=(value:string,width:number,size=8)=>{
    font(size);return doc.splitTextToSize(value||'—',width) as string[];
   };
   const safeText=(value:string)=>String(value||'').trim()||'—';
   const topOfPage=()=>{
    label('DELTA JOINERY',L,17,10,true,forest);
    alignRight('QUOTATION / CONTINUED',R,17,8,true,slate);
    stroke(23);y=32;
   };
   const newPage=()=>{doc.addPage();topOfPage()};
   const ensure=(space:number)=>{if(y+space>268)newPage()};

   // Editorial header: logo on left, document identity right, no ornamental boxes.
   try{
    const response=await fetch('/delta-logo.png');
    if(!response.ok)throw new Error('Logo unavailable');
    const blob=await response.blob();
    const base64=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(String(reader.result));
     reader.onerror=()=>reject(new Error('Logo load failed'));
     reader.readAsDataURL(blob);
    });
    doc.addImage(base64,blob.type.includes('png')?'PNG':'JPEG',L,17,45,15,undefined,'FAST');
   }catch{label('DELTA JOINERY',L,26,17,true,forest)}
   alignRight('QUOTATION',R,25,20,true,charcoal);
   alignRight('CONSOLIDATED WORKS',R,32,8.2,true,forest);
   doc.setDrawColor(...forest);doc.setLineWidth(.8);doc.line(L,41,R,41);
   y=51;

   // Clean metadata grid with aligned labels and values; no large green cards.
   label('PREPARED FOR',L,y,7.1,true,slate);
   label('DOCUMENT INFORMATION',110,y,7.1,true,slate);
   y+=8;
   const client=wrap(safeText(quote.client),76,12);
   let clientY=y;
   for(const text of client){label(text,L,clientY,12,true,charcoal);clientY+=5.5}
   const numberLines=wrap(safeText(quote.number),78,8.3);
   let refY=y;
   for(const text of numberLines){label(text,110,refY,8.3,true,charcoal);refY+=4.4}
   const upperBottom=Math.max(clientY,refY)+2;
   const clientFields:[string,string][]=[
    ['PROJECT',safeText(quote.project)],
    ['EMAIL',safeText(quote.email)],
    ['PHONE',safeText(quote.phone)],
    ['ADDRESS',safeText(quote.address)]
   ];
   let leftY=upperBottom;
   for(const [key,value] of clientFields){
    label(key,L,leftY,7,true,slate);
    const valueLines=wrap(value,75,8.4);
    let valueY=leftY+5;
    for(const text of valueLines){label(text,L,valueY,8.4,false,charcoal);valueY+=4.5}
    leftY=valueY+4;
   }
   label('ISSUED',110,upperBottom,7,true,slate);
   label(safeText(quote.date),110,upperBottom+5.3,8.5);
   label('WORK PACKAGES',110,upperBottom+18,7,true,slate);
   label(String(quote.works.length).padStart(2,'0'),110,upperBottom+23.3,8.5,true,charcoal);
   y=Math.max(leftY,upperBottom+30)+6;
   stroke(y);y+=12;

   // Schedule: one row per work, nothing about materials or labour.
   ensure(24);
   label('SCHEDULE OF WORKS',L,y,12,true,charcoal);
   alignRight('EUR  /  EXCL. VAT',R,y,7.5,true,slate);
   y+=9;
   doc.setFillColor(...charcoal);doc.rect(L,y,W,11,'F');
   font(7.6,true,[255,255,255]);
   doc.text('REF',L+4,y+7.1);
   doc.text('DESCRIPTION',L+18,y+7.1);
   doc.text('AMOUNT',R-4,y+7.1,{align:'right'});
   y+=11;
   for(let i=0;i<quote.works.length;i++){
    const work=quote.works[i];
    const description=wrap(safeText(work.name),112,9);
    const rowHeight=Math.max(14,8+description.length*4.6);
    ensure(rowHeight+1);
    label(String(i+1).padStart(2,'0'),L+4,y+8.4,8,true,slate);
    let lineY=y+8.4;
    for(const text of description){label(text,L+18,lineY,9,i===0,charcoal);lineY+=4.6}
    alignRight(currency(packageSum(work)),R-4,y+8.4,9.7,true,charcoal);
    y+=rowHeight;
    stroke(y);
   }
   y+=13;

   // Recessed right-aligned cost ledger with restrained final total.
   ensure(51);
   const sumX=98;
   doc.setDrawColor(...ruleColor);doc.setLineWidth(.35);doc.line(sumX,y,R,y);
   y+=9;
   label('Subtotal',sumX+3,y,9,false,slate);
   alignRight(currency(subtotal),R,y,10,true,charcoal);
   y+=9;
   if(quote.includeVat){
    label('VAT (13.5%)',sumX+3,y,9,false,slate);
    alignRight(currency(vat),R,y,9.7,false,charcoal);
    y+=9;
   }
   doc.setDrawColor(...forest);doc.setLineWidth(.65);
   doc.line(sumX,y,R,y);y+=9;
   label(quote.includeVat?'TOTAL INCLUDING VAT':'TOTAL EXCLUDING VAT',sumX+3,y,8.2,true,forest);
   alignRight(currency(grand),R,y+1,14,true,forest);
   y+=15;

   if(quote.notes.trim()){
    ensure(22);
    stroke(y);y+=9;
    label('NOTES',L,y,8,true,forest);y+=8;
    for(const text of wrap(quote.notes.trim(),W-4,8.3)){
     ensure(6);label(text,L,y,8.3);y+=5.5;
    }
   }

   // Uniform minimal footer on each sheet.
   const totalPages=doc.getNumberOfPages();
   for(let page=1;page<=totalPages;page++){
    doc.setPage(page);
    doc.setDrawColor(...ruleColor);doc.setLineWidth(.25);doc.line(L,281,R,281);
    label('DELTA JOINERY    /    INTERNAL QUOTATION',L,287,7,true,slate);
    alignRight('PAGE '+page+' / '+totalPages,R,287,7,true,slate);
   }
   doc.save('Delta-Joinery-Bulk-'+quote.number.replace(/[^A-Za-z0-9_-]/g,'-')+'.pdf');
   setNotice('Premium bulk quotation PDF generated.');
  }catch(error){setNotice('PDF generation failed: '+(error instanceof Error?error.message:'Unknown error'))}
  finally{setPrinting(false)}
 }
 return <main className="dj-desktop dj-unified-page dj-bulk-page">
 <DesktopSidebar active="quote"/>
 <div className="dj-bulk-main">
  <header className="dj-bulk-top">
   <div><p className="dj-bulk-kicker">DELTA JOINERY / QUOTATIONS</p><h1>Bulk Quotation</h1><p>Combine multiple works into one quotation, showing each work name and price.</p></div>
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
      <div><strong>Add from Saved Quotations</strong><p>Automatically adds the saved work name and total cost. The original quotation stays unchanged.</p></div>
      <div className="dj-bulk-import-action"><select aria-label="Select saved quotation" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select saved quotation</option>{saved.map(item=><option key={item.id} value={item.id||item.number}>{item.project||item.name||'Unnamed work'} — {currency(typeof item.subtotalAmount==='number'?item.subtotalAmount:savedQuoteDetails(item).subtotal)}{item.finished?' (Finished)':''}</option>)}</select><button type="button" disabled={!selected} onClick={addSaved}>＋ Add from saved</button></div>
     </div>
     <div className="dj-bulk-import">
      <div><strong>Add a new work</strong><p>Enter the work name and its total cost.</p></div>
      <div className="dj-bulk-import-action"><input aria-label="New work name" placeholder="e.g. Wardrobe 3" value={manualName} onChange={e=>setManualName(e.target.value)}/><input aria-label="Work cost in euro" type="number" min="0" step="0.01" placeholder="Total cost (€)" value={manualPrice} onChange={e=>setManualPrice(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addManual()}}/><button type="button" disabled={!manualName.trim()||manualPrice.trim()===''||!Number.isFinite(Number(manualPrice))||Number(manualPrice)<0} onClick={addManual}>＋ Add work</button></div>
     </div>
    </div>
    <div className="dj-bulk-card">
     <div className="dj-bulk-card-header"><h2>03 / Included work packages</h2><span>{quote.works.length} works</span></div>
     {!quote.works.length&&<p className="dj-bulk-empty">No works added yet. Import a saved quotation or create a new work package above.</p>}
     {quote.works.map((work,index)=><div className="dj-bulk-package" key={work.id}>
      <div className="dj-bulk-package-head">
       <span className="dj-bulk-index">{String(index+1).padStart(2,'0')}</span>
       <input className="dj-bulk-work-name" aria-label={'Work name '+(index+1)} value={work.name} onChange={e=>updateWork(work.id,w=>({...w,name:e.target.value}))}/>
       {work.origin==='manual'?<input className="dj-bulk-work-cost" aria-label={'Work cost '+(index+1)} type="number" min="0" step="0.01" value={work.totalPrice??packageSum(work)} onChange={e=>{const val=Number(e.target.value);updateWork(work.id,w=>({...w,totalPrice:Number.isFinite(val)?money(Math.max(0,val)):0}))}}/>:<strong className="dj-bulk-package-price">{currency(packageSum(work))}</strong>}
       <button type="button" className="dj-bulk-remove" aria-label={'Remove '+work.name} onClick={()=>removePackage(work.id)}>×</button>
      </div>
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
     <small>Only work names and costs appear in the bulk quotation and PDF. VAT is applied once to the combined subtotal when selected.</small>
    </div>
    {notice&&<p role="status" className="dj-bulk-notice">{notice}</p>}
   </aside>
  </div>
 </div>
 </main>;
}
