'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../DesktopSidebar';
import Image from 'next/image';
import {Unit,Hardware,Labour,ExtraCost,QuoteUnit,QuoteHardware,DEFAULT_HARDWARE,DEFAULT_FINISH_RATES,pricedDoor,doorSqm,currency,read} from '../../lib/data';
type CostItem={id:string;name:string;price:number;unit:string};
const DEFAULT_CNC:CostItem[]=[{"id":"cnc-0","name":"MDF 22 Strada Handle","price":10,"unit":"door"},{"id":"cnc-1","name":"Frame Door","price":10,"unit":"door"},{"id":"cnc-2","name":"Shaker Door","price":25,"unit":"door"},{"id":"cnc-3","name":"Grooving","price":50,"unit":"m²"},{"id":"cnc-4","name":"Decor Pieces - High Complexity","price":45,"unit":"each"},{"id":"cnc-5","name":"Decor Pieces - Medium Complexity","price":30,"unit":"each"},{"id":"cnc-6","name":"Decor Pieces - Low Complexity","price":15,"unit":"each"},{"id":"cnc-7","name":"Bent Panel","price":120,"unit":"each"},{"id":"cnc-8","name":"Bent Panel - Shaker Door","price":170,"unit":"each"},{"id":"cnc-9","name":"Bent Panel - Big Piece","price":190,"unit":"each"},{"id":"cnc-10","name":"Bent Panel - Big Piece Shaker Door","price":240,"unit":"each"},{"id":"cnc-11","name":"Built-in Handle","price":20,"unit":"door"},{"id":"cnc-12","name":"PVC Film Covering","price":20,"unit":"piece"}];
type Q={includeVat?:boolean;name?:string;number?:string;date?:string;client?:string;project?:string;email?:string;phone?:string;address?:string;chosenUnits?:QuoteUnit[];chosenHardware?:QuoteHardware[];chosenLabour?:{id:string;qty:number}[];chosenElectrics?:{id:string;qty:number}[];chosenFinishes?:{id:string;qty:number}[];chosenFillers?:{id:string;qty:number}[];chosenTimber?:{id:string;qty:number}[];chosenCnc?:{id:string;qty:number}[];chosenProduction?:{id:string;qty:number}[];chosenWorktops?:{id:string;name:string;qty:number;rate:number;unit:string}[]};
export default function Preview(){
 const [q,setQ]=useState<Q>({});
 const [timberRates,setTimberRates]=useState<Record<string,number>>({});
 const [cnc,setCnc]=useState<CostItem[]>(DEFAULT_CNC),[production,setProduction]=useState<CostItem[]>([]);
const [doorRates,setDoorRates]=useState<Record<string,number>>(DEFAULT_FINISH_RATES);
 const [units,setUnits]=useState<Unit[]>([]);
 const [hardware,setHardware]=useState<Hardware[]>([]);
 const [labour,setLabour]=useState<Labour[]>([]);const [electrics,setElectrics]=useState<ExtraCost[]>([]),[finishes,setFinishes]=useState<ExtraCost[]>([]),[fillers,setFillers]=useState<ExtraCost[]>([]);
 useEffect(()=>{setCnc(read<CostItem[]>('dj_cnc_production',DEFAULT_CNC));setProduction(read<CostItem[]>('dj_production_costs',[]));setDoorRates({...DEFAULT_FINISH_RATES,...read<Record<string,number>>('dj_door_rates',{})});setTimberRates(read<Record<string,number>>('dj_timber_rates',{}));setQ(read<Q>('dj_quote',{}));setUnits(read<Unit[]>('dj_units',[]));setHardware(read<Hardware[]>('dj_hardware',DEFAULT_HARDWARE));setLabour(read<Labour[]>('dj_labour',[]));setElectrics(read<ExtraCost[]>('dj_electrics',[]));setFinishes(read<ExtraCost[]>('dj_finishes',[]));setFillers(read<ExtraCost[]>('dj_fillers',[]));},[]);
 const rows=(q.chosenUnits||[]).flatMap(x=>{const u=units.find(z=>z.id===x.id);return u?[{label:u.name+(x.adc?' · With doors':' · Carcass only'),detail:`${u.width} × ${u.height} × ${u.depth} mm${x.adc?` · ${x.doorFinish||'MFC'} · ${doorSqm(x).toFixed(3)} m² · Doors included`:''}`,qty:x.qty,price:u.price+(x.adc?pricedDoor(x,doorRates,u):0)}]:[]});
 const hw=(q.chosenHardware||[]).flatMap(x=>{const h=hardware.find(z=>z.id===x.id);return h?[{label:h.name,detail:'Hardware',qty:x.qty,price:h.price}]:[]});
 const work=(q.chosenLabour||[]).flatMap(x=>{const l=labour.find(z=>z.id===x.id);return l?[{label:l.name,detail:`Labour / ${l.unit}`,qty:x.qty,price:l.price}]:[]});
 const er=(q.chosenElectrics||[]).flatMap(x=>{const y=electrics.find(z=>z.id===x.id);return y?[{label:y.name,detail:'Electrics',qty:x.qty,price:y.price}]:[]});
 const fr=(q.chosenFinishes||[]).flatMap(x=>{const y=finishes.find(z=>z.id===x.id);return y?[{label:y.name,detail:'Finishes / fillers',qty:x.qty,price:y.price}]:[]});
 const pr=(q.chosenFillers||[]).flatMap(x=>{const y=fillers.find(z=>z.id===x.id);return y?[{label:y.name,detail:'Filler / Plinths & Coving',qty:x.qty,price:y.price}]:[]});
 const timber=(q.chosenTimber||[]).map(x=>({label:x.id,detail:'Timber · linear feet',qty:x.qty,price:timberRates[x.id]||0}));
 const cncRows=(q.chosenCnc||[]).flatMap(x=>{const c=cnc.find(z=>z.id===x.id);return c?[{label:c.name,detail:`CNC Production / ${c.unit}`,qty:x.qty,price:c.price}]:[]});
 const productionRows=(q.chosenProduction||[]).flatMap(x=>{const c=production.find(z=>z.id===x.id);return c?[{label:c.name,detail:`Production Costs / ${c.unit}`,qty:x.qty,price:c.price}]:[]});
 const worktops=(q.chosenWorktops||[]).map(x=>({label:x.name,detail:`Worktops / ${x.unit}`,qty:x.qty,price:x.rate}));
 const all=[...rows,...hw,...work,...er,...fr,...pr,...timber,...worktops,...cncRows,...productionRows];
 const subtotal=all.reduce((sum,x)=>sum+x.qty*x.price,0);
 const vatAmount=q.includeVat?Math.round(subtotal*0.135*100)/100:0;
 const total=subtotal+vatAmount;


 async function printA4(){
  try{
   const {jsPDF}=await import('jspdf');
   const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
   const money=(n:number)=>'EUR '+(Number(n)||0).toLocaleString('en-IE',{minimumFractionDigits:2,maximumFractionDigits:2});
   const green:[number,number,number]=[16,80,45];
   const dark:[number,number,number]=[25,38,30];
   const left=18,right=192,pageWidth=174;
   let y=19;
   const newPage=()=>{pdf.addPage();y=22;};
   const line=(x1:number,yy:number,x2:number)=>{pdf.setDrawColor(210,222,213);pdf.setLineWidth(.3);pdf.line(x1,yy,x2,yy)};
   const write=(t:string,x:number,yy:number,sz=10,style:'normal'|'bold'='normal')=>{pdf.setFont('helvetica',style);pdf.setFontSize(sz);pdf.setTextColor(...dark);pdf.text(t,x,yy)};
   try{
    const response=await fetch('/delta-logo.png');
    if(response.ok){
     const blob=await response.blob();
     const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Image load failed'));r.readAsDataURL(blob)});
     pdf.addImage(data,blob.type.includes('png')?'PNG':'JPEG',left,19,46,14,undefined,'FAST');
    }else{write('DELTA JOINERY',left,29,17,'bold')}
   }catch{write('DELTA JOINERY',left,29,17,'bold')}
   pdf.setTextColor(...green);pdf.setFont('helvetica','bold');pdf.setFontSize(22);pdf.text('QUOTATION',right,27,{align:'right'});
   pdf.setTextColor(160,47,40);pdf.setFontSize(8);pdf.text('INTERNAL QUOTATION ONLY',right,33,{align:'right'});
   pdf.setDrawColor(...green);pdf.setLineWidth(.8);pdf.line(left,38,right,38);
   y=49;
   pdf.setFont('helvetica','bold');pdf.setTextColor(91,117,101);pdf.setFontSize(8);
   pdf.text('PREPARED FOR',left,y);pdf.text('QUOTATION DETAILS',113,y);
   y+=7;
   write(q.client||'Client not entered',left,y,12,'bold');
   write('No. '+(q.number||'-'),113,y,10,'bold');
   y+=7;
   if(q.project){write('Project: '+q.project,left,y,10)}
   write('Date: '+(q.date||'-'),113,y,10);
   for(const [label,value] of [['Email',q.email],['Phone',q.phone],['Address',q.address]]){
    if(value?.trim()){
     y+=7;
     const lines=pdf.splitTextToSize(label+': '+value.trim(),85) as string[];
     pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(...dark);pdf.text(lines,left,y);
     y+=(lines.length-1)*4.5;
    }
   }
   y+=17;
   write('Quotation breakdown',left,y,15,'bold');
   y+=8;
   // Compact, dynamically scaled layout: all quotation lines and totals stay on one A4 page.
   const unitRows=(q.chosenUnits||[]).flatMap(x=>{const u=units.find(z=>z.id===x.id);return u?[{x,u}]:[]});
   const prepared=all.map((item,index)=>{
    const unit=unitRows[index];
    const details:string[]=[];
    if(unit){
     const {x,u}=unit;
     details.push('Dimensions: '+u.width+' x '+u.height+' x '+u.depth+' mm  |  Carcass: '+money(u.price));
     if(x.adc){
      const finish=x.doorFinish||'MFC';
      const sqm=doorSqm(x);
      const rate=Number(u.doorPrices?.[finish]??doorRates[finish]??0);
      details.push('Door: '+finish+'  |  '+sqm.toFixed(3)+' m2 x '+money(rate)+'/m2');
      details.push('Door cost: '+money(pricedDoor(x,doorRates,u)));
     }else{details.push('Carcass only')}
    }else if(item.detail){details.push(item.detail)}
    pdf.setFont('helvetica','bold');pdf.setFontSize(8.5);
    const titleLines=pdf.splitTextToSize(item.label,95) as string[];
    pdf.setFont('helvetica','normal');pdf.setFontSize(7);
    const detailLines=details.flatMap(v=>pdf.splitTextToSize(v,102) as string[]);
    return {item,titleLines,detailLines};
   });
   const tableTop=y;
   const reservedBottom=q.includeVat?60:51;
   const availableRows=Math.max(45,263-tableTop-10-reservedBottom);
   const nominal=prepared.reduce((sum,r)=>sum+6+r.titleLines.length*4.2+r.detailLines.length*3.6,0);
   const scale=Math.min(1,availableRows/Math.max(1,nominal));
   const titleFont=Math.max(4.5,9*scale),detailFont=Math.max(4,7.5*scale);
   const titleStep=4.2*scale,detailStep=3.6*scale;
   const headerH=Math.max(6.2,9*scale);
   const paddingH=5*scale;
   pdf.setFillColor(...green);pdf.rect(left,y,pageWidth,headerH,'F');
   pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(Math.max(5.5,8*scale));
   pdf.text('ITEM / DESCRIPTION',left+4,y+headerH*.68);
   pdf.text('QTY',142,y+headerH*.68,{align:'right'});
   pdf.text('AMOUNT',right-4,y+headerH*.68,{align:'right'});
   y+=headerH;
   for(let index=0;index<prepared.length;index++){
    const {item,titleLines,detailLines}=prepared[index];
    const h=paddingH+titleLines.length*titleStep+detailLines.length*detailStep;
    if(index%2===1){pdf.setFillColor(248,251,249);pdf.rect(left,y,pageWidth,h,'F')}
    pdf.setFont('helvetica','bold');pdf.setFontSize(titleFont);pdf.setTextColor(...dark);
    pdf.text(titleLines,left+4,y+titleStep);
    pdf.setFont('helvetica','normal');pdf.setFontSize(detailFont);pdf.setTextColor(91,111,99);
    let dy=y+titleStep*titleLines.length+detailStep;
    for(const detail of detailLines){pdf.text(detail,left+4,dy);dy+=detailStep}
    pdf.setFont('helvetica','bold');pdf.setFontSize(titleFont);pdf.setTextColor(...dark);
    pdf.text(String(item.qty),142,y+titleStep,{align:'right'});
    pdf.text(money(item.qty*item.price),right-4,y+titleStep,{align:'right'});
    y+=h;line(left,y,right);
   }
   if(prepared.length===0){y+=9;write('No items added to this quotation',left+4,y,8)}
   y+=9;
   const summaryLeft=113;
   const summaryFont=8.3;
   if(q.includeVat){
    pdf.setFont('helvetica','normal');pdf.setFontSize(summaryFont);pdf.setTextColor(...dark);
    pdf.text('Subtotal (excl. VAT)',summaryLeft,y);pdf.text(money(subtotal),right,y,{align:'right'});y+=7;
    pdf.text('VAT (13.5%)',summaryLeft,y);pdf.text(money(vatAmount),right,y,{align:'right'});y+=9;
   }
   pdf.setDrawColor(...green);pdf.setLineWidth(.5);pdf.line(summaryLeft,y-5,right,y-5);
   pdf.setFillColor(238,246,240);pdf.roundedRect(left,y,pageWidth,15,2,2,'F');
   pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(...dark);
   pdf.text(q.includeVat?'TOTAL INCLUDING VAT':'TOTAL EXCLUDING VAT',left+5,y+9.5);
   pdf.setFontSize(14);pdf.setTextColor(...green);
   pdf.text(money(total),right-4,y+10,{align:'right'});
   y+=21;
   line(left,y,right);y+=6;
   pdf.setTextColor(95,112,101);pdf.setFont('helvetica','normal');pdf.setFontSize(8);

   y+=5;pdf.setFontSize(7);
   pdf.text(q.includeVat?'INTERNAL QUOTATION ONLY. VAT at 13.5% included.':'INTERNAL QUOTATION ONLY. VAT excluded.',left,y);
   pdf.setFontSize(7);pdf.setTextColor(130,142,134);
   pdf.text('Delta Joinery  |  Quotation '+(q.number||''),left,287);
   pdf.text('1 / 1',right,287,{align:'right'});
   pdf.save('Delta-Joinery-Quotation-'+(q.number||'draft').replace(/[^a-z0-9_-]/gi,'-')+'.pdf');
  }catch(error){console.error(error);alert('Unable to generate PDF. Please try again.')}
 }

 return <main className="dj-preview-desktop min-h-screen bg-gray-100 text-gray-900"><DesktopSidebar active="preview"/><div className="dj-preview-body">
 <div className="no-print mx-auto max-w-4xl p-4 flex flex-wrap justify-between items-center gap-3"><Link href="/quote" className="btn-outline">← Edit quotation</Link><button className="btn" onClick={printA4}>Download A4 PDF</button></div>
 <article id="dj-print-sheet" className="dj-quotation-paper mx-auto max-w-4xl bg-white p-7 md:p-12 shadow-sm print:shadow-none print:p-0" style={{minHeight:'90vh'}}>
 <header className="flex items-center justify-between gap-5 border-b-2 border-green-800 pb-7"><Image src="/delta-logo.png" alt="Delta Joinery" width={175} height={50} priority/><div className="text-right"><h1 className="text-xl md:text-2xl font-bold tracking-wide">QUOTATION</h1><p className="text-xs text-gray-500 mt-1">DELTA JOINERY</p><p className="text-xs font-bold text-red-700 mt-2">INTERNAL QUOTATION ONLY</p></div></header>
 <div className="grid grid-cols-2 gap-5 my-8 text-sm">
 <div><p className="text-xs text-gray-500 uppercase tracking-wide">Prepared for</p><p className="font-semibold mt-2">{q.client||'Client not entered'}</p>{q.project&&<p className="mt-1 text-gray-600">Project: {q.project}</p>}{q.email?.trim()&&<p className="mt-2 text-gray-600 break-words"><strong>Email:</strong> {q.email.trim()}</p>}{q.phone?.trim()&&<p className="mt-1 text-gray-600"><strong>Phone:</strong> {q.phone.trim()}</p>}{q.address?.trim()&&<p className="mt-1 text-gray-600 whitespace-pre-wrap break-words"><strong>Address:</strong> {q.address.trim()}</p>}</div>
 <div className="text-right"><p><span className="text-gray-500">Quotation No. </span><b>{q.number||'—'}</b></p><p className="mt-2"><span className="text-gray-500">Date </span>{q.date||'—'}</p>{q.name&&<p className="mt-2 text-gray-600">{q.name}</p>}</div>
 </div>
 <h2 className="font-semibold text-lg mb-3">Quotation breakdown</h2>
 <table className="w-full text-sm" style={{borderCollapse:'collapse'}}><thead><tr className="bg-green-900 text-white"><th className="text-left p-3">Description</th><th className="text-center p-3">Qty</th><th className="text-right p-3">Price</th><th className="text-right p-3">Total</th></tr></thead><tbody>{all.map((x,i)=><tr key={i} className="border-b border-gray-200"><td className="p-3"><strong>{x.label}</strong><div className="text-xs text-gray-500">{x.detail}</div></td><td className="text-center p-3">{x.qty}</td><td className="text-right p-3">{currency(x.price)}</td><td className="text-right p-3 font-medium">{currency(x.price*x.qty)}</td></tr>)}{all.length===0&&<tr><td colSpan={4} className="p-8 text-center text-gray-400">No items added to this quotation</td></tr>}</tbody></table>
 <div className="flex justify-end mt-8"><div className="w-full max-w-sm border-t-2 border-green-800 pt-5">{q.includeVat&&<><div className="flex justify-between gap-4 mb-3"><span>Subtotal (excl. VAT)</span><strong>{currency(subtotal)}</strong></div><div className="flex justify-between gap-4 mb-3"><span>VAT (13.5%)</span><strong>{currency(vatAmount)}</strong></div></>}<div className="flex justify-between gap-4"><strong>Total {q.includeVat?'(VAT included)':'(excl. VAT)'}</strong><strong className="text-xl text-green-800">{currency(total)}</strong></div></div></div>
 <div className="mt-16 border-t pt-5 text-xs text-gray-500"><p className="mt-1">{q.includeVat?'INTERNAL QUOTATION ONLY. VAT at 13.5% has been included in the final total.':'INTERNAL QUOTATION ONLY. VAT has not been included in the final total.'}</p></div>
 </article>
 <style jsx global>{`
@page { size: A4 portrait; margin: 0; }
@media screen { 
 #dj-print-sheet { max-width: 900px; width: 100%; min-height: 1050px !important; padding: 54px 58px 70px !important; box-shadow: 0 12px 35px rgba(12,38,21,.1) !important; }
 #dj-print-sheet header { padding-bottom: 24px; margin-bottom: 22px; }
 #dj-print-sheet header h1 { letter-spacing: .065em; font-size: 29px; }
 #dj-print-sheet table { width: 100%; }
 #dj-print-sheet thead th { background-color: #14532d; color: white; }
 #dj-print-sheet td { padding-top: 16px; padding-bottom: 16px; }
 @media (max-width: 700px) { #dj-print-sheet { padding: 24px 18px !important; min-height: 800px !important; } }
}
@media print {
 html,body { margin:0!important;padding:0!important;width:210mm!important;min-width:0!important;max-width:none!important;height:auto!important;overflow:visible!important;background:#fff!important; }
 .dj-preview-desktop { display:block!important;position:static!important;width:210mm!important;min-width:0!important;min-height:0!important;height:auto!important;overflow:visible!important;padding:0!important;margin:0!important;background:#fff!important; }
 .dj-preview-desktop > .dj-shared-sidebar,.dj-preview-body > .no-print,.no-print { display:none!important; }
 .dj-preview-desktop > .dj-preview-body { display:block!important;position:static!important;width:210mm!important;max-width:none!important;min-width:0!important;height:auto!important;min-height:0!important;overflow:visible!important;margin:0!important;padding:0!important;background:white!important; }
 #dj-print-sheet { position:static!important;display:block!important;box-sizing:border-box!important;width:210mm!important;max-width:none!important;min-width:0!important;min-height:0!important;height:auto!important;margin:0!important;padding:18mm 15mm 16mm!important;box-shadow:none!important;transform:none!important;zoom:1!important;color:#17221c!important;font-size:11pt!important;background:#fff!important; }
 #dj-print-sheet header {display:flex!important;align-items:center!important;justify-content:space-between!important;border-bottom:2px solid #166534!important;padding-bottom:16px!important;break-inside:avoid!important}
 #dj-print-sheet h1 {font-size:21pt!important} #dj-print-sheet h2 {font-size:14pt!important}
 #dj-print-sheet table {width:100%!important;border-collapse:collapse!important;table-layout:auto!important;font-size:10.5pt!important}
 #dj-print-sheet th,#dj-print-sheet td {padding:10px 9px!important}
 #dj-print-sheet thead {display:table-header-group!important}
 #dj-print-sheet tr {break-inside:avoid!important;page-break-inside:avoid!important}
 #dj-print-sheet th {background:#14532d!important;color:white!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
 #dj-print-sheet .border-t-2 {break-inside:avoid!important}
}
`}</style>
 </div></main>
}