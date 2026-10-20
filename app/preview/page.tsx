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
 return <main className="dj-preview-desktop min-h-screen bg-gray-100 text-gray-900"><DesktopSidebar active="preview"/><div className="dj-preview-body">
 <div className="no-print mx-auto max-w-4xl p-4 flex flex-wrap justify-between items-center gap-3"><Link href="/quote" className="btn-outline">← Edit quotation</Link><button className="btn" onClick={()=>window.print()}>Print / Save as PDF</button></div>
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