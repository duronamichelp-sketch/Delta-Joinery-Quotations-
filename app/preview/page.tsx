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

 function printA4(){
  const safe=(v:unknown)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
  const items=all.map(item=>'<tr><td><strong>'+safe(item.label)+'</strong><small>'+safe(item.detail)+'</small></td><td class="center">'+item.qty+'</td><td class="right">'+currency(item.price)+'</td><td class="right"><b>'+currency(item.qty*item.price)+'</b></td></tr>').join('');
  const css='@page{size:A4 portrait;margin:15mm 14mm}*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:12pt;color:#182a20;background:#fff}.sheet{width:100%;margin:0;padding:0}header{display:flex;justify-content:space-between;align-items:center;padding:0 0 19px;border-bottom:2px solid #14532d}header img{width:175px;height:auto;max-height:65px;object-fit:contain}h1{font-size:21pt;margin:0;text-align:right;letter-spacing:1px}header p{text-align:right;margin:5px 0 0;color:#637367;font-size:9pt}.meta{display:flex;justify-content:space-between;gap:30px;margin:30px 0 34px}.meta>div{width:50%}.meta .right{text-align:right}.kicker{font-size:9pt;text-transform:uppercase;color:#698074;letter-spacing:.7px}.meta b{display:block;margin:9px 0;font-size:12pt}.meta p{margin:6px 0}h2{font-size:15pt;margin:0 0 14px}table{width:100%;border-collapse:collapse;font-size:10.5pt}thead{display:table-header-group}th{background:#14532d;color:white;text-align:left;padding:12px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}td{padding:12px 10px;border-bottom:1px solid #e2e9e3;vertical-align:top}td small{display:block;color:#6b7e71;margin-top:5px;font-size:9pt}.right{text-align:right}.center{text-align:center}tr{break-inside:avoid;page-break-inside:avoid}.total{display:flex;justify-content:space-between;gap:35px;border-top:2px solid #14532d;padding-top:15px;margin:35px 0 0 auto;width:50%;font-size:13pt;break-inside:avoid}.total b:last-child{color:#14532d;font-size:17pt}footer{border-top:1px solid #dde5dd;margin-top:65px;padding-top:15px;color:#64766a;font-size:9.5pt;line-height:1.5}footer p{margin:3px 0}@media screen{body{background:#e9eeea;padding:28px}.sheet{max-width:210mm;min-height:297mm;margin:auto;background:white;box-shadow:0 12px 40px #0002;padding:15mm 14mm}}@media print{body{background:white!important;padding:0!important}.sheet{width:100%!important;max-width:none!important;min-height:0!important;padding:0!important;margin:0!important;box-shadow:none!important}}';
  const markup='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Delta Joinery Quotation '+safe(q.number)+'</title><style>'+css+'</style></head><body><article class="sheet"><header><img src="'+window.location.origin+'/delta-logo.png" alt="Delta Joinery"><div><h1>QUOTATION</h1><p>DELTA JOINERY</p></div></header><section class="meta"><div><span class="kicker">Prepared for</span><b>'+safe(q.client||'Client not entered')+'</b><p>'+safe(q.project||'')+'</p></div><div class="right"><p>Quotation No. <strong>'+safe(q.number||'-')+'</strong></p><p>Date '+safe(q.date||'-')+'</p></div></section><h2>Quotation details</h2><table><thead><tr><th>Description</th><th class="center">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>'+(items||'<tr><td colspan="4" class="center">No items added to this quotation</td></tr>')+'</tbody></table><div class="total"><b>Total quotation</b><b>'+currency(total)+'</b></div><footer><p>Thank you for considering Delta Joinery.</p><p>Quotation based on the selected specifications. VAT, where applicable, is not included unless stated in the rates.</p></footer></article></body></html>';
  const printWindow=window.open('','_blank');
  if(!printWindow){alert('Please allow pop-ups for this website to print your quotation.');return}
  printWindow.document.open();printWindow.document.write(markup);printWindow.document.close();
  printWindow.onload=()=>{printWindow.focus();printWindow.print()};
 }

 return <main className="dj-preview-desktop min-h-screen bg-gray-100 text-gray-900"><DesktopSidebar active="preview"/><div className="dj-preview-body">
 <div className="no-print mx-auto max-w-4xl p-4 flex flex-wrap justify-between items-center gap-3"><Link href="/quote" className="btn-outline">← Edit quotation</Link><button className="btn" onClick={printA4}>Print / Save as PDF</button></div>
 <article id="dj-print-sheet" className="mx-auto max-w-4xl bg-white p-7 md:p-12 shadow-sm print:shadow-none print:p-0" style={{minHeight:'90vh'}}>
 <header className="flex items-center justify-between gap-5 border-b-2 border-green-800 pb-7"><Image src="/delta-logo.png" alt="Delta Joinery" width={175} height={50} priority/><div className="text-right"><h1 className="text-xl md:text-2xl font-bold tracking-wide">QUOTATION</h1><p className="text-xs text-gray-500 mt-1">DELTA JOINERY</p></div></header>
 <div className="grid grid-cols-2 gap-5 my-8 text-sm">
 <div><p className="text-xs text-gray-500 uppercase tracking-wide">Prepared for</p><p className="font-semibold mt-2">{q.client||'Client not entered'}</p><p className="mt-1 text-gray-600">{q.project||''}</p></div>
 <div className="text-right"><p><span className="text-gray-500">Quotation No. </span><b>{q.number||'—'}</b></p><p className="mt-2"><span className="text-gray-500">Date </span>{q.date||'—'}</p>{q.name&&<p className="mt-2 text-gray-600">{q.name}</p>}</div>
 </div>
 <h2 className="font-semibold text-lg mb-3">Quotation details</h2>
 <table className="w-full text-sm" style={{borderCollapse:'collapse'}}><thead><tr className="bg-green-900 text-white"><th className="text-left p-3">Description</th><th className="text-center p-3">Qty</th><th className="text-right p-3">Price</th><th className="text-right p-3">Total</th></tr></thead><tbody>{all.map((x,i)=><tr key={i} className="border-b border-gray-200"><td className="p-3"><strong>{x.label}</strong><div className="text-xs text-gray-500">{x.detail}</div></td><td className="text-center p-3">{x.qty}</td><td className="text-right p-3">{currency(x.price)}</td><td className="text-right p-3 font-medium">{currency(x.price*x.qty)}</td></tr>)}{all.length===0&&<tr><td colSpan={4} className="p-8 text-center text-gray-400">No items added to this quotation</td></tr>}</tbody></table>
 <div className="flex justify-end mt-8"><div className="w-full max-w-xs border-t-2 border-green-800 pt-4 flex justify-between gap-4"><strong>Total quotation</strong><strong className="text-xl text-green-800">{currency(total)}</strong></div></div>
 <div className="mt-16 border-t pt-5 text-xs text-gray-500"><p>Thank you for considering Delta Joinery.</p><p className="mt-1">Quotation based on the selected specifications. VAT, where applicable, is not included unless stated in the rates.</p></div>
 </article>
 <style jsx global>{`
@page { size: A4 portrait; margin: 0; }
@media screen { #dj-print-sheet { max-width: 900px; width: 100%; } }
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