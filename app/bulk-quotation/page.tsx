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
   const left=18,right=192,width=right-left;
   const ink:[number,number,number]=[31,43,41];
   const green:[number,number,number]=[25,88,60];
   const muted:[number,number,number]=[103,119,113];
   const border:[number,number,number]=[205,218,210];
   const wash:[number,number,number]=[246,249,247];
   const euro=(value:number)=>currency(value);
   const write=(text:string,x:number,y:number,size=9,bold=false,color=ink)=>{
    doc.setFont('helvetica',bold?'bold':'normal');
    doc.setFontSize(size);doc.setTextColor(...color);doc.text(text,x,y);
   };
   const rightWrite=(text:string,x:number,y:number,size=9,bold=false,color=ink)=>{
    doc.setFont('helvetica',bold?'bold':'normal');
    doc.setFontSize(size);doc.setTextColor(...color);doc.text(text,x,y,{align:'right'});
   };
   const line=(y:number)=>{doc.setDrawColor(...border);doc.setLineWidth(.3);doc.line(left,y,right,y)};
   const split=(value:string,measure:number,size=9)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(size);
    return doc.splitTextToSize(value||'-',measure) as string[];
   };
   let y=20;
   const runningHead=()=>{
    write('DELTA JOINERY',left,18,11,true,green);
    rightWrite('BULK QUOTATION  /  CONTINUED',right,18,8,true,muted);
    line(23);y=34;
   };
   const newPage=()=>{doc.addPage();runningHead()};
   const ensure=(height:number)=>{if(y+height>267)newPage()};
   const moneyLine=(label:string,amount:number,at:number,emphasise=false)=>{
    write(label,left+4,at,emphasise?9.3:8.8,emphasise,emphasise?green:ink);
    rightWrite(euro(amount),right-4,at,emphasise?12:9.5,true,emphasise?green:ink);
   };

   // Header: logo, title and document classification align inside the printable area.
   try{
    const response=await fetch('/delta-logo.png');
    if(response.ok){
     const blob=await response.blob();
     const data=await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result));
      reader.onerror=()=>reject(new Error('Logo load failed'));
      reader.readAsDataURL(blob);
     });
     doc.addImage(data,blob.type.includes('png')?'PNG':'JPEG',left,17,45,15,undefined,'FAST');
    }else write('DELTA JOINERY',left,26,17,true,green);
   }catch{write('DELTA JOINERY',left,26,17,true,green)}
   rightWrite('BULK QUOTATION',right,25,17,true,ink);
   rightWrite('INTERNAL QUOTATION ONLY',right,32,7.4,true,[152,54,47]);
   doc.setDrawColor(...green);doc.setLineWidth(.65);doc.line(left,41,right,41);
   y=52;

   // Client and document identification sit in two aligned technical panels.
   const clientRows=[
    ['CLIENT',quote.client.trim()||'Not specified'],
    ['PROJECT',quote.project.trim()||'Not specified'],
    ['EMAIL',quote.email.trim()||'N/A'],
    ['PHONE',quote.phone.trim()||'N/A'],
    ['ADDRESS',quote.address.trim()||'N/A']
   ];
   const detailsRows=[
    ['QUOTATION NUMBER',quote.number],
    ['ISSUE DATE',quote.date],
    ['WORK PACKAGES',String(quote.works.length)],
    ['DOCUMENT', 'Bulk cost schedule']
   ];
   const drawPanel=(x:number,panelWidth:number,title:string,rows:string[][])=>{
    const innerWidth=panelWidth-10;
    let yy=y+12;
    const titleSize=8.2;
    write(title,x+5,yy,titleSize,true,green);yy+=8;
    for(const [label,value] of rows){
     write(label,x+5,yy,6.8,true,muted);yy+=4.5;
     for(const t of split(value,innerWidth,8.5)){write(t,x+5,yy,8.5,label==='CLIENT',ink);yy+=4.7}
     yy+=3.1;
    }
    return yy+4;
   };
   const panelGap=8,panelWidth=(width-panelGap)/2;
   const firstX=left,secondX=left+panelWidth+panelGap;
   const bottom1=drawPanel(firstX,panelWidth,'01  /  CLIENT & PROJECT',clientRows);
   const bottom2=drawPanel(secondX,panelWidth,'02  /  DOCUMENT CONTROL',detailsRows);
   const panelBottom=Math.max(bottom1,bottom2);
   doc.setDrawColor(...border);doc.setLineWidth(.3);
   doc.roundedRect(firstX,y,panelWidth,panelBottom-y,2,2,'S');
   doc.roundedRect(secondX,y,panelWidth,panelBottom-y,2,2,'S');
   y=panelBottom+15;

   // Work schedule deliberately shows just the name and quoted cost.
   ensure(23);
   write('03  /  SCHEDULE OF WORKS',left,y,11.5,true,green);
   rightWrite(quote.works.length+' WORK'+(quote.works.length===1?'':'S'),right,y,7.5,true,muted);
   y+=8;
   doc.setFillColor(235,242,237);doc.rect(left,y,width,10,'F');
   write('REF',left+4,y+6.8,7.5,true,green);
   write('WORK DESCRIPTION',left+18,y+6.8,7.5,true,green);
   rightWrite('QUOTED PRICE',right-4,y+6.8,7.5,true,green);
   y+=10;
   for(let index=0;index<quote.works.length;index++){
    const work=quote.works[index];
    const title=split(work.name.trim()||'Unnamed work',110,9.2);
    const height=Math.max(13,7+title.length*4.8);
    ensure(height+2);
    if(index%2===0){doc.setFillColor(...wash);doc.rect(left,y,width,height,'F')}
    write(String(index+1).padStart(2,'0'),left+4,y+8.2,8,true,muted);
    let textY=y+8.2;
    for(const t of title){write(t,left+18,textY,9.2,true,ink);textY+=4.8}
    rightWrite(euro(packageSum(work)),right-4,y+8.2,10,true,ink);
    y+=height;line(y);
   }
   y+=13;

   // Summary is kept together and uses the same figures as the editor.
   ensure(48+(quote.includeVat?8:0));
   const summaryTop=y;
   doc.setDrawColor(...border);doc.setLineWidth(.3);
   doc.roundedRect(left,summaryTop,width,quote.includeVat?45:37,2,2,'S');
   write('COST SUMMARY',left+4,summaryTop+7.5,8,true,green);
   y=summaryTop+16;
   moneyLine('SUBTOTAL  /  EXCLUDING VAT',subtotal,y);y+=8;
   if(quote.includeVat){moneyLine('VAT  /  13.5%',vat,y);y+=8}
   doc.setFillColor(231,241,234);doc.rect(left+1,y-4,width-2,13,'F');
   moneyLine(quote.includeVat?'TOTAL  /  INCLUDING VAT':'TOTAL  /  EXCLUDING VAT',grand,y+4.4,true);
   y=summaryTop+(quote.includeVat?45:37)+11;

   if(quote.notes.trim()){
    ensure(20);
    write('04  /  NOTES',left,y,9,true,green);y+=8;
    for(const t of split(quote.notes.trim(),width-8,8.5)){
     ensure(6);write(t,left+4,y,8.5,false,ink);y+=5.5;
    }
   }
   const totalPages=doc.getNumberOfPages();
   for(let p=1;p<=totalPages;p++){
    doc.setPage(p);
    doc.setDrawColor(...border);doc.line(left,279,right,279);
    write('DELTA JOINERY  /  INTERNAL COST DOCUMENT',left,286,7,true,muted);
    rightWrite('PAGE '+p+' OF '+totalPages,right,286,7,true,muted);
   }
   doc.save('Delta-Joinery-Bulk-'+quote.number.replace(/[^A-Za-z0-9_-]/g,'-')+'.pdf');
   setNotice('Technical bulk quotation PDF generated.');
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
