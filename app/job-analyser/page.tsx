'use client';
import {useMemo,useRef,useState} from 'react';
import DesktopSidebar from '../DesktopSidebar';
import {jsPDF} from 'jspdf';

type Confidence='Confirmed'|'Calculated'|'Estimated'|'Missing';
type ScopeItem={ref:string;item:string;location?:string;qty:number;measure:string;material:string;description:string;source?:string;confidence:Confidence;estimatedCost:number};
type Rfi={ref:string;item:string;question:string;source?:string};
type Analysis={project:{name:string;client:string;architect:string;contractor:string;location:string;revision:string;summary:string};scope:ScopeItem[];materials:{material:string;quantity:string;basis?:string}[];rfis:Rfi[];drawingReferences:{reference:string;description:string}[];costs:{materials:number;production:number;cnc:number;finishing:number;installation:number;transport:number;other:number;subtotal:number;margin:number;total:number};assumptions:string[]};
type Doc={name:string;text:string};

const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
const confidenceClass=(x:string)=>'dj-ja-confidence '+x.toLowerCase();
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9²]+/g,' ').replace(/\s+/g,' ').trim();

const JOINERY_WORDS=['reception desk','bench seating','bespoke furniture','fitted furniture','storage unit','wall panelling','wall paneling','slatted wall','timber screen','feature wall','tea station','printer unit','wall unit','base unit','tall unit','media unit','cabinetry','cabinet','wardrobe','banquette','bookcase','shelving','shelf','locker','vanity','kitchen','worktop','countertop','servery','counter','desk','bench','storage','panelling','paneling','slat','plinth','coving','skirting','door set','doors','timber trim','joinery','furniture'];
const MATERIALS=['oak veneer','oak','walnut','ash','beech','maple','sapele','mahogany','iroko','teak','cedar','mfc','mdf veneer','veneered mdf','painted mdf','mdf','plywood','birch ply','laminate','solid timber','corian','quartz','upholstery','acoustic panel'];

function projectLibrary(){
 const keys=['dj_units','dj_hardware','dj_labour','dj_electrics','dj_finishes','dj_door_rates','dj_worktop_rates','dj_timber_rates','dj_fillers','dj_cnc_production','dj_production_costs'];
 const result:Record<string,unknown>={};
 for(const k of keys){try{const v=localStorage.getItem(k);if(v)result[k]=JSON.parse(v)}catch{}}
 return result;
}
function ratesFrom(value:unknown,path='',out:{name:string;rate:number;unit?:string}[]=[]){
 if(Array.isArray(value)){value.forEach((x,i)=>ratesFrom(x,path+' '+i,out));return out}
 if(!value||typeof value!=='object')return out;
 const o=value as Record<string,unknown>;
 const name=String(o.name||o.label||o.material||o.finish||path).trim();
 const raw=o.price??o.rate??o.cost??o.amount;
 if(raw!==undefined&&Number.isFinite(Number(raw))&&Number(raw)>0)out.push({name,rate:Number(raw),unit:String(o.unit||'')});
 for(const [k,v] of Object.entries(o)){
  if(typeof v==='number'&&v>0&&['price','rate','cost','amount'].indexOf(k)<0)out.push({name:(name+' '+k).trim(),rate:v});
  else if(typeof v==='object'&&v!==null)ratesFrom(v,(path+' '+k).trim(),out);
 }
 return out;
}
function bestRate(label:string,rates:{name:string;rate:number;unit?:string}[]){
 const words=new Set(norm(label).split(' ').filter(x=>x.length>2));
 let best:{name:string;rate:number;unit?:string}|undefined,score=0;
 for(const r of rates){
  const rn=norm(r.name);const rw=rn.split(' ').filter(x=>x.length>2);
  const s=rw.reduce((n,w)=>n+(words.has(w)?1:0),0);
  const exact=rn.length>2&&(norm(label).includes(rn)||rn.includes(norm(label)));
  if((exact?10:s)>score){score=exact?10:s;best=r}
 }
 return score>=2||score===10?best:undefined;
}
function compatibleRate(rate:{name:string;rate:number;unit?:string}|undefined,measure:{value:number;unit:string}|null){
 if(!rate||!measure)return false;
 const u=norm(rate.unit||'');
 if(measure.unit==='m²')return /m2|sqm|square metre|square meter/.test(u);
 if(measure.unit==='lm')return /lm|linear metre|linear meter|metre|meter/.test(u);
 return /unit|each|ea|item|set|no/.test(u);
}
function isScopeLine(line:string){
 const n=norm(line);
 return JOINERY_WORDS.some(k=>n.includes(norm(k)))||/\b(?:j|jn|joinery)[-_. ]?\d{1,3}[a-z]?\b/i.test(line)||/\b(?:item|type)\s+[a-z]?\d{1,3}\b/i.test(line);
}
function numberMeasure(line:string){
 const explicit=line.match(/(\d+(?:\.\d+)?)\s*(m²|m2|sqm|sq\.?\s*m|lm|lin(?:ear)?\.?\s*m|metres?|meters?|units?|pcs|pieces|nr|no\.?)/i);
 if(explicit){
  const n=Number(explicit[1]);let u=explicit[2].toLowerCase();
  if(/m²|m2|sqm|sq/.test(u))u='m²'; else if(/lm|lin|metre|meter/.test(u))u='lm'; else u='units';
  return {value:n,unit:u,label:`${Math.round(n*100)/100} ${u}`,calculated:false};
 }
 const dims=line.match(/(?:\b|[^\d])(\d{2,5})\s*(?:mm)?\s*[x×]\s*(\d{2,5})\s*(?:mm)?(?:\s*[x×]\s*\d{2,5}\s*(?:mm)?)?/i);
 if(dims){
  const a=Number(dims[1]),b=Number(dims[2]);
  if(a>=100&&b>=100){const sqm=Math.round((a*b/1000000)*1000)/1000;return {value:sqm,unit:'m²',label:`${sqm} m² (${a}×${b} mm)`,calculated:true}}
 }
 return null;
}
function quantityFrom(line:string){
 const q=line.match(/(?:qty|quantity|no\.?|nr|x)\s*[:.-]?\s*(\d+)/i)||line.match(/(\d+)\s*(?:no\.?|nr|units?|pcs|pieces)\b/i);
 return q?Math.max(1,Number(q[1])):1;
}
function materialFrom(line:string){
 const n=norm(line);return MATERIALS.find(x=>n.includes(norm(x)))||'Not specified';
}
function itemName(line:string){
 const n=norm(line);const hit=JOINERY_WORDS.find(x=>n.includes(norm(x)));
 if(hit)return hit.replace(/\b\w/g,c=>c.toUpperCase());
 return line.slice(0,70)||'Joinery item';
}
function unique<T>(arr:T[],key:(x:T)=>string){const m=new Map<string,T>();arr.forEach(x=>{const k=key(x);if(!m.has(k))m.set(k,x)});return Array.from(m.values())}
async function extractFile(file:File):Promise<Doc>{
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist/webpack.mjs');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjs.getDocument({data:bytes}).promise;const lines:string[]=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p);const tc=await page.getTextContent();
   const items=(tc.items as any[]).filter(x=>String(x?.str||'').trim());
   const rows:{y:number;parts:{x:number;text:string}[]}[]=[];
   items.forEach(item=>{
    const x=Number(item?.transform?.[4]||0),y=Number(item?.transform?.[5]||0),text=String(item.str||'').trim();
    let row=rows.find(r=>Math.abs(r.y-y)<=2.5);
    if(!row){row={y,parts:[]};rows.push(row)}
    row.parts.push({x,text});
   });
   rows.sort((a,b)=>b.y-a.y);
   rows.forEach(row=>{
    row.parts.sort((a,b)=>a.x-b.x);
    const text=row.parts.map(part=>part.text).join(' ').replace(/\s+/g,' ').trim();
    if(text)lines.push(`[Page ${p}] ${text}`);
   });
  }
  return {name:file.name,text:lines.join('\n')};
 }
 if(['xlsx','xls'].includes(ext)){
  const XLSX=await import('xlsx');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const lines:string[]=[];
  wb.SheetNames.forEach(sheetName=>{
   const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''}) as any[][];
   rows.forEach((row,rowIndex)=>{
    const text=row.map(cell=>String(cell??'').trim()).filter(Boolean).join(' | ').replace(/\s+/g,' ').trim();
    if(text)lines.push(`[Sheet ${sheetName} Row ${rowIndex+1}] ${text}`);
   });
  });
  return {name:file.name,text:lines.join('\n')};
 }
 if(ext==='docx'){
  const mammoth=await import('mammoth');const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return {name:file.name,text:r.value};
 }
 if(['txt','csv'].includes(ext))return {name:file.name,text:await file.text()};
 throw new Error(`${file.name}: this free analyser currently reads PDF, Excel, DOCX, CSV and TXT files.`);
}
function analyseDocs(docs:Doc[],projectName:string):Analysis{
 const rates=ratesFrom(projectLibrary());
 const raw:ScopeItem[]=[];const rfis:Rfi[]=[];const refs:{reference:string;description:string}[]=[];
 let idx=1;
 for(const doc of docs){
  const lines=doc.text.split(/\n|\r/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  refs.push({reference:doc.name,description:`Analysed locally in your browser · ${lines.length} logical text lines extracted`});
  lines.forEach((line,i)=>{
   if(!isScopeLine(line))return;
   const prefix=line.match(/^(\[Page \d+\]|\[Sheet [^\]]+\])/i)?.[1]||'';
   const nearby=lines.slice(Math.max(0,i-2),Math.min(lines.length,i+3)).filter(x=>!prefix||x.startsWith(prefix));
   const context=nearby.join(' · ').slice(0,700);
   const measure=numberMeasure(context);const qty=quantityFrom(context);const material=materialFrom(context);const name=itemName(line);
   const rate=bestRate(name+' '+material,rates);
   const priced=compatibleRate(rate,measure);
   const estimated=priced&&measure?Math.round(measure.value*Number(rate?.rate||0)*100)/100:0;
   const page=line.match(/\[Page\s+(\d+)\]/i)?.[1];
   const sheet=line.match(/\[Sheet\s+(.+?)\s+Row\s+(\d+)\]/i);
   const source=page?`${doc.name} · Page ${page}`:sheet?`${doc.name} · ${sheet[1]} row ${sheet[2]}`:doc.name;
   const confidence:Confidence=measure?.calculated?'Calculated':measure?'Confirmed':'Estimated';
   raw.push({ref:`J${String(idx++).padStart(2,'0')}`,item:name,qty,measure:measure?.label||`${qty} units`,material,description:context.replace(/^\[[^\]]+\]\s*/,'').slice(0,520),source,confidence,estimatedCost:estimated});
   if(material==='Not specified')rfis.push({ref:'',item:name,question:'Material / finish is not clearly identified. Confirm the specification before final pricing.',source});
   if(!measure)rfis.push({ref:'',item:name,question:'No reliable m², linear metre, unit quantity or calculable mm dimensions were found for this item. Confirm dimensions / quantity.',source});
   if(!priced)rfis.push({ref:'',item:name,question:'This item has not been priced automatically because no compatible rate and measurement basis were confirmed in the Delta Price Library.',source});
  });
 }
 const scope=unique(raw,x=>norm(x.item+' '+x.measure+' '+x.material+' '+x.source+' '+x.description.slice(0,80))).map((x,i)=>({...x,ref:`J${String(i+1).padStart(2,'0')}`}));
 const matMap=new Map<string,{qty:number;units:Set<string>}>();
 scope.forEach(x=>{if(x.material==='Not specified')return;const m=numberMeasure(x.measure);const v=matMap.get(x.material)||{qty:0,units:new Set<string>()};v.qty+=m?.value||x.qty;v.units.add(m?.unit||'units');matMap.set(x.material,v)});
 const materials=Array.from(matMap.entries()).map(([material,v])=>({material,quantity:`${Math.round(v.qty*1000)/1000} ${Array.from(v.units)[0]||'units'}`,basis:'Extracted / calculated from identified joinery scope'}));
 const materialsCost=scope.reduce((s,x)=>s+x.estimatedCost,0);
 const subtotal=materialsCost;const margin=Math.round(subtotal*.15*100)/100;
 const uniqueRfis=unique(rfis,x=>norm(x.item+' '+x.question+' '+x.source)).map((x,i)=>({...x,ref:`RFI-${String(i+1).padStart(2,'0')}`}));
 const assumptions=[
  'Free Local Mode: project files are processed in this browser. No paid AI Gateway or external AI model is called.',
  'PDF text is reconstructed into logical drawing rows using its page coordinates. Excel BOQs are read row-by-row.',
  'Dimensions written as width × height in millimetres can be converted to m². Calculated values are marked Calculated.',
  'Only items with a compatible measurement basis and matching Delta Price Library rate are auto-priced. Unconfirmed CNC, production, finishing and installation charges are not invented.',
  '15% margin is applied only to the automatically priced subtotal.'
 ];
 if(!scope.length)uniqueRfis.push({ref:`RFI-${String(uniqueRfis.length+1).padStart(2,'0')}`,item:'Project package',question:'No joinery/furniture scope could be reliably extracted from the readable document text. The drawings may be image-only or may require manual review.',source:docs.map(d=>d.name).join(', ')});
 return {project:{name:projectName||'Project Analysis',client:'',architect:'',contractor:'',location:'',revision:'',summary:scope.length?`Local analysis identified ${scope.length} possible joinery / custom furniture scope items across ${docs.length} file(s). Review RFIs before treating quantities or pricing as final.`:`No reliable joinery scope was extracted from ${docs.length} file(s).`},scope,materials,rfis:uniqueRfis,drawingReferences:refs,costs:{materials:materialsCost,production:0,cnc:0,finishing:0,installation:0,transport:0,other:0,subtotal,margin,total:subtotal+margin},assumptions};
}

export default function JobAnalyser(){
 const input=useRef<HTMLInputElement>(null);const [files,setFiles]=useState<File[]>([]);const [analysis,setAnalysis]=useState<Analysis|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [projectName,setProjectName]=useState('');const totalSize=useMemo(()=>files.reduce((n,f)=>n+f.size,0),[files]);
 function addFiles(list:FileList|null){if(!list)return;setFiles(old=>{const m=new Map(old.map(f=>[f.name+'-'+f.size,f]));Array.from(list).forEach(f=>m.set(f.name+'-'+f.size,f));return Array.from(m.values()).slice(0,20)})}
 async function run(){if(!files.length){setError('Add at least one project file first.');return}setBusy(true);setError('');try{const docs=[] as Doc[];for(const f of files)docs.push(await extractFile(f));const a=analyseDocs(docs,projectName);setAnalysis(a);localStorage.setItem('dj_job_analyses',JSON.stringify([{id:crypto.randomUUID(),createdAt:new Date().toISOString(),analysis:a,files:files.map(f=>f.name)}]))}catch(e){setError(e instanceof Error?e.message:'Local analysis failed')}finally{setBusy(false)}}
 function exportPdf(){if(!analysis)return;const doc=new jsPDF({unit:'mm',format:'a4'});const left=14,max=182;let y=16;const line=(t:string,size=9,b=false)=>{doc.setFontSize(size);doc.setFont('helvetica',b?'bold':'normal');const rows=doc.splitTextToSize(t,max);if(y+rows.length*5>282){doc.addPage();y=16}doc.text(rows,left,y);y+=rows.length*5+2};line('DELTA JOINERY',16,true);line('JOINERY WORKS ANALYSIS',12,true);line(analysis.project.name||'Project',14,true);line(analysis.project.summary,9);line('Scope of works',10,true);analysis.scope.forEach(x=>line(`${x.ref} | ${x.item} | ${x.measure} | ${x.material} | ${money(x.estimatedCost)} | ${x.confidence}\n${x.description}`,8));line('Materials',10,true);analysis.materials.forEach(x=>line(`${x.material}: ${x.quantity}`,8));line('Outstanding questions / RFIs',10,true);analysis.rfis.forEach(x=>line(`${x.ref} — ${x.item}: ${x.question}`,8));line('Estimated cost',10,true);line(`Materials ${money(analysis.costs.materials)} | Production ${money(analysis.costs.production)} | CNC ${money(analysis.costs.cnc)} | Finishing ${money(analysis.costs.finishing)} | Installation ${money(analysis.costs.installation)}`,8);line(`Subtotal ${money(analysis.costs.subtotal)} | Margin ${money(analysis.costs.margin)} | Estimated project value ${money(analysis.costs.total)} + VAT`,10,true);line('Assumptions',10,true);analysis.assumptions.forEach(a=>line('• '+a,8));doc.save((analysis.project.name||'Delta-Joinery-Works-Analysis').replace(/[^a-z0-9]+/gi,'-')+'.pdf')}
 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-job-analyser-page"><DesktopSidebar active="analyser"/><div className="rev-phone rev-inner"><header className="rev-screen-head dj-page-header dj-route-toolbar"><b>Job Plan Analyser</b><span className="rev-mint-pill">Free local mode</span></header><section className="rev-screen-body dj-page-body"><p className="rev-kicker-light">DELTA JOINERY</p><h1>Job Plan Analyser</h1><p className="rev-sub">Upload plans, BOQs, specifications and schedules. Files are analysed locally in this browser — no paid AI Gateway is used.</p>
 <style>{`.dj-ja-grid{display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px;align-items:start}.dj-ja-card{background:#fff;border:1px solid #dce7df;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(18,48,31,.045)}.dj-ja-card h2,.dj-ja-card h3{margin:0 0 10px}.dj-ja-drop{border:1.5px dashed #aebeb3;border-radius:12px;padding:22px;text-align:center;background:#f8faf8;cursor:pointer}.dj-ja-drop strong{display:block;color:#163e2a}.dj-ja-files{display:grid;gap:8px;margin-top:12px}.dj-ja-file{display:flex;justify-content:space-between;gap:10px;padding:10px;border:1px solid #e1e9e3;border-radius:10px;background:#fff}.dj-ja-file small{color:#68766d}.dj-ja-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}.dj-ja-primary{background:#165c3a;color:white;width:100%;margin-top:12px}.dj-ja-primary:disabled{opacity:.5}.dj-ja-secondary{background:#eef4f0;color:#16482f}.dj-ja-input{width:100%;box-sizing:border-box;border:1px solid #cfddd3;border-radius:9px;padding:11px;background:white;margin:7px 0}.dj-ja-error{background:#fff2f0;color:#9a2e24;border:1px solid #f1c6c0;border-radius:10px;padding:10px;margin-top:10px}.dj-ja-note{background:#eef7f1;color:#21553a;border:1px solid #cfe2d5;border-radius:10px;padding:10px;margin-top:10px;font-size:11px}.dj-ja-empty{padding:54px 24px;text-align:center;color:#66756b}.dj-ja-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.dj-ja-stat{border:1px solid #dce7df;border-radius:11px;padding:12px;background:#f9fbf9}.dj-ja-stat b{display:block;font-size:18px;color:#173f2a}.dj-ja-table-wrap{overflow:auto}.dj-ja-table{width:100%;border-collapse:collapse;min-width:900px}.dj-ja-table th,.dj-ja-table td{border-bottom:1px solid #e4ebe6;padding:9px;text-align:left;font-size:12px;vertical-align:top}.dj-ja-confidence{display:inline-block;padding:3px 7px;border-radius:99px;font-size:10px;font-weight:800}.dj-ja-confidence.confirmed{background:#e3f4e9;color:#17613b}.dj-ja-confidence.calculated{background:#eaf0fb;color:#315894}.dj-ja-confidence.estimated{background:#fff4d8;color:#8a6515}.dj-ja-confidence.missing{background:#fde7e4;color:#9a3328}.dj-ja-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.dj-ja-list{display:grid;gap:8px}.dj-ja-row{border:1px solid #e0e8e2;border-radius:10px;padding:10px}.dj-ja-cost{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #e6ece8}.dj-ja-total{font-weight:900;font-size:17px;color:#17452d}@media(max-width:1000px){.dj-ja-grid{grid-template-columns:1fr}.dj-ja-stats{grid-template-columns:1fr 1fr}.dj-ja-columns{grid-template-columns:1fr}}@media(max-width:620px){.dj-ja-card{padding:12px}}`}</style>
 <div className="dj-ja-grid"><aside className="dj-ja-card"><h2>Project package</h2><label>Project name<input className="dj-ja-input" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="e.g. Riverside Office Fit-Out"/></label><input ref={input} hidden multiple type="file" accept=".pdf,.txt,.csv,.docx,.xls,.xlsx" onChange={e=>addFiles(e.target.files)}/><div className="dj-ja-drop" onClick={()=>input.current?.click()}><strong>＋ Upload project files</strong><span>Plans · BOQ · Specs · Schedules</span><small style={{display:'block',marginTop:5}}>PDF, Excel, DOCX, CSV and TXT</small></div><div className="dj-ja-files">{files.map((f,i)=><div className="dj-ja-file" key={f.name+i}><span>{f.name}<small style={{display:'block'}}>{(f.size/1024/1024).toFixed(2)} MB</small></span><button className="dj-ja-secondary dj-ja-btn" onClick={()=>setFiles(x=>x.filter((_,n)=>n!==i))}>×</button></div>)}</div><button className="dj-ja-btn dj-ja-primary" disabled={busy||!files.length} onClick={run}>{busy?'Reading project files…':'Analyse Project — Free'}</button>{error&&<div className="dj-ja-error">{error}</div>}<div className="dj-ja-note"><b>No usage charge.</b><br/>Documents stay in your browser for analysis. Text-bearing plans and BOQs work best. Scanned/image-only drawings are flagged for manual review instead of guessed.</div></aside>
 <section>{!analysis?<div className="dj-ja-card dj-ja-empty"><h2>No analysis yet</h2><p>Add the job package and select <b>Analyse Project — Free</b>.</p></div>:<><div className="dj-ja-card"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start',flexWrap:'wrap'}}><div><p className="rev-kicker-light">PROJECT</p><h2>{analysis.project.name}</h2><p>{analysis.project.summary}</p></div><button className="dj-ja-btn dj-ja-secondary" onClick={exportPdf}>Generate Works PDF</button></div><div className="dj-ja-stats"><div className="dj-ja-stat"><small>Joinery items</small><b>{analysis.scope.length}</b></div><div className="dj-ja-stat"><small>Materials</small><b>{analysis.materials.length}</b></div><div className="dj-ja-stat"><small>Open RFIs</small><b>{analysis.rfis.length}</b></div><div className="dj-ja-stat"><small>Priced value</small><b>{money(analysis.costs.total)}</b></div></div><div className="dj-ja-table-wrap"><table className="dj-ja-table"><thead><tr><th>Ref</th><th>Joinery / Furniture</th><th>Qty</th><th>Measure</th><th>Material / Finish</th><th>Brief</th><th>Source</th><th>Status</th><th>Est. Cost</th></tr></thead><tbody>{analysis.scope.map((x,i)=><tr key={x.ref+i}><td><b>{x.ref}</b></td><td><b>{x.item}</b></td><td>{x.qty}</td><td>{x.measure}</td><td>{x.material}</td><td>{x.description}</td><td>{x.source||'—'}</td><td><span className={confidenceClass(x.confidence)}>{x.confidence}</span></td><td>{money(x.estimatedCost)}</td></tr>)}</tbody></table></div></div>
 <div className="dj-ja-columns"><div className="dj-ja-card"><h3>Materials schedule</h3><div className="dj-ja-list">{analysis.materials.length?analysis.materials.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.material}</b><span style={{float:'right'}}>{x.quantity}</span>{x.basis&&<small style={{display:'block',marginTop:4,color:'#68766d'}}>{x.basis}</small>}</div>):<p>No materials could be confirmed from readable text.</p>}</div></div><div className="dj-ja-card"><h3>Estimated price</h3>{[['Materials',analysis.costs.materials],['Production',analysis.costs.production],['CNC / Machining',analysis.costs.cnc],['Finishing',analysis.costs.finishing],['Installation',analysis.costs.installation]].map(([n,v])=><div className="dj-ja-cost" key={String(n)}><span>{n}</span><b>{money(Number(v))}</b></div>)}<div className="dj-ja-cost"><span>Subtotal</span><b>{money(analysis.costs.subtotal)}</b></div><div className="dj-ja-cost"><span>Margin</span><b>{money(analysis.costs.margin)}</b></div><div className="dj-ja-cost dj-ja-total"><span>Estimated Project Value</span><span>{money(analysis.costs.total)} + VAT</span></div></div></div>
 <div className="dj-ja-columns"><div className="dj-ja-card"><h3>Outstanding Questions / RFIs</h3><div className="dj-ja-list">{analysis.rfis.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.ref} · {x.item}</b><p style={{margin:'5px 0 0'}}>{x.question}</p>{x.source&&<small>{x.source}</small>}</div>)}</div></div><div className="dj-ja-card"><h3>Documents analysed</h3><div className="dj-ja-list">{analysis.drawingReferences.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.reference}</b><span style={{display:'block'}}>{x.description}</span></div>)}</div><h3 style={{marginTop:18}}>Assumptions</h3><div className="dj-ja-list">{analysis.assumptions.map((x,i)=><div className="dj-ja-row" key={i}>{x}</div>)}</div></div></div></>}</section></div></section></div></main>
}
