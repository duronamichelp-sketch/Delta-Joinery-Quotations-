'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../DesktopSidebar';
import Image from 'next/image';
import {Unit,Hardware,Labour,ExtraCost,QuoteUnit,QuoteHardware,DEFAULT_HARDWARE,currency,read} from '../../lib/data';
type Q={name?:string;number?:string;date?:string;client?:string;project?:string;chosenUnits?:QuoteUnit[];chosenHardware?:QuoteHardware[];chosenLabour?:{id:string;qty:number}[];chosenElectrics?:{id:string;qty:number}[];chosenFinishes?:{id:string;qty:number}[]};
export default function Preview(){
 const [q,setQ]=useState<Q>({});
 const [units,setUnits]=useState<Unit[]>([]);
 const [hardware,setHardware]=useState<Hardware[]>([]);
 const [labour,setLabour]=useState<Labour[]>([]);const [electrics,setElectrics]=useState<ExtraCost[]>([]),[finishes,setFinishes]=useState<ExtraCost[]>([]);
 useEffect(()=>{setQ(read<Q>('dj_quote',{}));setUnits(read<Unit[]>('dj_units',[]));setHardware(read<Hardware[]>('dj_hardware',DEFAULT_HARDWARE));setLabour(read<Labour[]>('dj_labour',[]));setElectrics(read<ExtraCost[]>('dj_electrics',[]));setFinishes(read<ExtraCost[]>('dj_finishes',[]));},[]);
 const rows=(q.chosenUnits||[]).flatMap(x=>{const u=units.find(z=>z.id===x.id);return u?[{label:u.name+(x.adc?' · With doors':' · Carcass only'),detail:`${u.width} × ${u.height} × ${u.depth} mm`,qty:x.qty,price:u.price+(x.adc?(u.doorCost||0)+(u.hingesPerUnit||0)*(u.hingePrice||0):0)}]:[]});
 const hw=(q.chosenHardware||[]).flatMap(x=>{const h=hardware.find(z=>z.id===x.id);return h?[{label:h.name,detail:'Hardware',qty:x.qty,price:h.price}]:[]});
 const work=(q.chosenLabour||[]).flatMap(x=>{const l=labour.find(z=>z.id===x.id);return l?[{label:l.name,detail:`Labour / ${l.unit}`,qty:x.qty,price:l.price}]:[]});
 const er=(q.chosenElectrics||[]).flatMap(x=>{const y=electrics.find(z=>z.id===x.id);return y?[{label:y.name,detail:'Electrics',qty:x.qty,price:y.price}]:[]});
 const fr=(q.chosenFinishes||[]).flatMap(x=>{const y=finishes.find(z=>z.id===x.id);return y?[{label:y.name,detail:'Finishes / fillers',qty:x.qty,price:y.price}]:[]});
 const all=[...rows,...hw,...work,...er,...fr];
 const total=all.reduce((sum,x)=>sum+x.qty*x.price,0);


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
   pdf.setDrawColor(...green);pdf.setLineWidth(.8);pdf.line(left,38,right,38);
   y=49;
   pdf.setFont('helvetica','bold');pdf.setTextColor(91,117,101);pdf.setFontSize(8);
   pdf.text('PREPARED FOR',left,y);pdf.text('QUOTATION DETAILS',113,y);
   y+=7;
   write(q.client||'Client not entered',left,y,12,'bold');
   write('No. '+(q.number||'-'),113,y,10,'bold');
   y+=7;
   write(q.project||'',left,y,10);
   write('Date: '+(q.date||'-'),113,y,10);
   y+=17;
   write('Quotation breakdown',left,y,15,'bold');
   y+=8;
   const header=()=>{pdf.setFillColor(...green);pdf.rect(left,y,pageWidth,11,'F');pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text('ITEM / DESCRIPTION',left+4,y+7);pdf.text('QTY',142,y+7,{align:'right'});pdf.text('AMOUNT',right-4,y+7,{align:'right'});y+=11};
   header();
   for(const item of all){
    pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
    const labelLines=pdf.splitTextToSize(item.label,102) as string[];
    const detailLines=pdf.splitTextToSize(item.detail||'',102) as string[];
    const rowHeight=Math.max(16,7+labelLines.length*4.5+detailLines.length*3.5);
    if(y+rowHeight>264){newPage();header()}
    pdf.setTextColor(...dark);pdf.setFont('helvetica','bold');pdf.setFontSize(10);
    pdf.text(labelLines,left+4,y+6);
    pdf.setTextColor(110,127,115);pdf.setFont('helvetica','normal');pdf.setFontSize(8);
    if(item.detail)pdf.text(detailLines,left+4,y+7+labelLines.length*4.5);
    pdf.setTextColor(...dark);pdf.setFontSize(10);
    pdf.text(String(item.qty),142,y+6,{align:'right'});
    pdf.setFont('helvetica','bold');pdf.text(money(item.qty*item.price),right-4,y+6,{align:'right'});
    y+=rowHeight;line(left,y,right);
   }
   if(all.length===0){y+=12;write('No items added to this quotation',left+4,y,10);y+=12;line(left,y,right)}
   if(y>254)newPage();
   y+=15;
   pdf.setDrawColor(...green);pdf.setLineWidth(.7);pdf.line(108,y-9,right,y-9);
   write('TOTAL QUOTATION',108,y,10,'bold');
   pdf.setTextColor(...green);pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text(money(total),right,y+1,{align:'right'});
   y+=28;
   if(y>264)newPage();
   line(left,y,right);y+=8;
   pdf.setTextColor(95,112,101);pdf.setFont('helvetica','normal');pdf.setFontSize(9);
   pdf.text('Thank you for considering Delta Joinery.',left,y);
   y+=6;pdf.setFontSize(8);
   const disclaimer=pdf.splitTextToSize('Quotation based on the selected specifications. VAT, where applicable, is not included unless stated in the rates.',pageWidth);
   pdf.text(disclaimer,left,y);
   for(let page=1;page<=pdf.getNumberOfPages();page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor(130,142,134);pdf.text('Delta Joinery  |  Quotation '+(q.number||''),left,287);pdf.text(page+' / '+pdf.getNumberOfPages(),right,287,{align:'right'})}
   pdf.save('Delta-Joinery-Quotation-'+(q.number||'draft').replace(/[^a-z0-9_-]/gi,'-')+'.pdf');
  }catch(error){console.error(error);alert('Unable to generate PDF. Please try again.')}
 }

 return <main className="dj-preview-desktop min-h-screen bg-gray-100 text-gray-900"><DesktopSidebar active="preview"/><div className="dj-preview-body">
 <div className="no-print mx-auto max-w-4xl p-4 flex flex-wrap justify-between items-center gap-3"><Link href="/quote" className="btn-outline">← Edit quotation</Link><button className="btn" onClick={printA4}>Download A4 PDF</button></div>
 <article id="dj-print-sheet" className="dj-quotation-paper mx-auto max-w-4xl bg-white p-7 md:p-12 shadow-sm print:shadow-none print:p-0" style={{minHeight:'90vh'}}>
 <header className="flex items-center justify-between gap-5 border-b-2 border-green-800 pb-7"><Image src="/delta-logo.png" alt="Delta Joinery" width={175} height={50} priority/><div className="text-right"><h1 className="text-xl md:text-2xl font-bold tracking-wide">QUOTATION</h1><p className="text-xs text-gray-500 mt-1">DELTA JOINERY</p></div></header>
 <div className="grid grid-cols-2 gap-5 my-8 text-sm">
 <div><p className="text-xs text-gray-500 uppercase tracking-wide">Prepared for</p><p className="font-semibold mt-2">{q.client||'Client not entered'}</p><p className="mt-1 text-gray-600">{q.project||''}</p></div>
 <div className="text-right"><p><span className="text-gray-500">Quotation No. </span><b>{q.number||'—'}</b></p><p className="mt-2"><span className="text-gray-500">Date </span>{q.date||'—'}</p>{q.name&&<p className="mt-2 text-gray-600">{q.name}</p>}</div>
 </div>
 <h2 className="font-semibold text-lg mb-3">Quotation breakdown</h2>
 <table className="w-full text-sm" style={{borderCollapse:'collapse'}}><thead><tr className="bg-green-900 text-white"><th className="text-left p-3">Description</th><th className="text-center p-3">Qty</th><th className="text-right p-3">Price</th><th className="text-right p-3">Total</th></tr></thead><tbody>{all.map((x,i)=><tr key={i} className="border-b border-gray-200"><td className="p-3"><strong>{x.label}</strong><div className="text-xs text-gray-500">{x.detail}</div></td><td className="text-center p-3">{x.qty}</td><td className="text-right p-3">{currency(x.price)}</td><td className="text-right p-3 font-medium">{currency(x.price*x.qty)}</td></tr>)}{all.length===0&&<tr><td colSpan={4} className="p-8 text-center text-gray-400">No items added to this quotation</td></tr>}</tbody></table>
 <div className="flex justify-end mt-8"><div className="w-full max-w-sm border-t-2 border-green-800 pt-5 flex justify-between gap-4"><strong>Total quotation</strong><strong className="text-xl text-green-800">{currency(total)}</strong></div></div>
 <div className="mt-16 border-t pt-5 text-xs text-gray-500"><p>Thank you for considering Delta Joinery.</p><p className="mt-1">Quotation based on the selected specifications. VAT, where applicable, is not included unless stated in the rates.</p></div>
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