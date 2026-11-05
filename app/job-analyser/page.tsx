'use client';
import {useMemo,useRef,useState} from 'react';
import DesktopSidebar from '../DesktopSidebar';
import {jsPDF} from 'jspdf';

type ScopeItem={ref:string;item:string;location?:string;qty:number;measure:string;material:string;description:string;source?:string;confidence:'Confirmed'|'Calculated'|'Estimated'|'Missing';estimatedCost:number};
type Rfi={ref:string;item:string;question:string;source?:string};
type Analysis={project:{name:string;client:string;architect:string;contractor:string;location:string;revision:string;summary:string};scope:ScopeItem[];materials:{material:string;quantity:string;basis?:string}[];rfis:Rfi[];drawingReferences:{reference:string;description:string}[];costs:{materials:number;production:number;cnc:number;finishing:number;installation:number;transport:number;other:number;subtotal:number;margin:number;total:number};assumptions:string[]};

const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
const confidenceClass=(x:string)=>'dj-ja-confidence '+x.toLowerCase();

export default function JobAnalyser(){
 const input=useRef<HTMLInputElement>(null);
 const [files,setFiles]=useState<File[]>([]);
 const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [projectName,setProjectName]=useState('');
 const totalSize=useMemo(()=>files.reduce((n,f)=>n+f.size,0),[files]);

 function addFiles(list:FileList|null){
  if(!list)return;
  const next=Array.from(list);
  setFiles(old=>{
   const map=new Map(old.map(f=>[f.name+'-'+f.size,f]));
   next.forEach(f=>map.set(f.name+'-'+f.size,f));
   return Array.from(map.values()).slice(0,12);
  });
 }
 function priceLibrary(){
  const keys=['dj_units','dj_hardware','dj_labour','dj_electrics','dj_finishes','dj_door_rates','dj_worktop_rates','dj_timber_rates','dj_fillers','dj_cnc_production','dj_production_costs'];
  const result:Record<string,unknown>={};
  for(const k of keys){try{const v=localStorage.getItem(k);if(v)result[k]=JSON.parse(v)}catch{}}
  return result;
 }
 async function analyse(){
  if(!files.length){setError('Add at least one project file first.');return}
  if(totalSize>4_000_000){setError('This first live version accepts up to 4 MB per analysis. Split very large drawing packs into smaller batches.');return}
  setBusy(true);setError('');
  try{
   const form=new FormData();
   files.forEach(f=>form.append('files',f));
   form.append('projectName',projectName);
   form.append('priceLibrary',JSON.stringify(priceLibrary()));
   const res=await fetch('/api/job-analyser',{method:'POST',body:form});
   const body=await res.json();
   if(!res.ok)throw new Error(body?.error||'Analysis failed');
   setAnalysis(body.analysis);
   localStorage.setItem('dj_job_analyses',JSON.stringify([{id:crypto.randomUUID(),createdAt:new Date().toISOString(),analysis:body.analysis,files:files.map(f=>f.name)}]));
  }catch(e){setError(e instanceof Error?e.message:'Analysis failed')}
  finally{setBusy(false)}
 }
 function exportPdf(){
  if(!analysis)return;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const left=14,max=182;let y=16;
  const line=(t:string,size=9,bold=false)=>{doc.setFontSize(size);doc.setFont('helvetica',bold?'bold':'normal');const rows=doc.splitTextToSize(t,max);if(y+rows.length*5>282){doc.addPage();y=16}doc.text(rows,left,y);y+=rows.length*5+2};
  line('DELTA JOINERY',16,true);line('JOINERY WORKS ANALYSIS',12,true);line(analysis.project.name||'Project',14,true);
  line('Project summary',10,true);line(analysis.project.summary||'');
  line('Scope of works',10,true);
  analysis.scope.forEach(x=>line(`${x.ref} | ${x.item} | Qty ${x.qty} | ${x.measure} | ${x.material} | ${money(x.estimatedCost)} | ${x.confidence}\n${x.description}`,8));
  line('Materials',10,true);analysis.materials.forEach(x=>line(`${x.material}: ${x.quantity}${x.basis?' — '+x.basis:''}`,8));
  line('Outstanding questions / RFIs',10,true);analysis.rfis.forEach(x=>line(`${x.ref} — ${x.item}: ${x.question}`,8));
  line('Estimated cost',10,true);
  line(`Materials ${money(analysis.costs.materials)} | Production ${money(analysis.costs.production)} | CNC ${money(analysis.costs.cnc)} | Finishing ${money(analysis.costs.finishing)} | Installation ${money(analysis.costs.installation)}`,8);
  line(`Subtotal ${money(analysis.costs.subtotal)} | Margin ${money(analysis.costs.margin)} | Estimated project value ${money(analysis.costs.total)} + VAT`,10,true);
  line('Assumptions',10,true);analysis.assumptions.forEach(a=>line('• '+a,8));
  doc.save((analysis.project.name||'Delta-Joinery-Works-Analysis').replace(/[^a-z0-9]+/gi,'-')+'.pdf');
 }
 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-job-analyser-page">
  <DesktopSidebar active="analyser"/>
  <div className="rev-phone rev-inner">
   <header className="rev-screen-head dj-page-header dj-route-toolbar"><b>Job Plan Analyser</b><span className="rev-mint-pill">AI assisted</span></header>
   <section className="rev-screen-body dj-page-body">
    <p className="rev-kicker-light">DELTA JOINERY</p>
    <h1>Job Plan Analyser</h1>
    <p className="rev-sub">Upload plans, BOQs, specifications and schedules. Delta extracts the joinery scope, materials, measurements, estimate and outstanding questions.</p>
    <style>{`
      .dj-ja-grid{display:grid;grid-template-columns:320px minmax(0,1fr);gap:16px;align-items:start}.dj-ja-card{background:#fff;border:1px solid #dce7df;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(18,48,31,.045)}.dj-ja-card h2,.dj-ja-card h3{margin:0 0 10px}.dj-ja-drop{border:1.5px dashed #aebeb3;border-radius:12px;padding:22px;text-align:center;background:#f8faf8;cursor:pointer}.dj-ja-drop strong{display:block;color:#163e2a}.dj-ja-files{display:grid;gap:8px;margin-top:12px}.dj-ja-file{display:flex;justify-content:space-between;gap:10px;padding:10px;border:1px solid #e1e9e3;border-radius:10px;background:#fff}.dj-ja-file small{color:#68766d}.dj-ja-btn{border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer}.dj-ja-primary{background:#165c3a;color:white;width:100%;margin-top:12px}.dj-ja-primary:disabled{opacity:.5;cursor:not-allowed}.dj-ja-secondary{background:#eef4f0;color:#16482f}.dj-ja-input{width:100%;box-sizing:border-box;border:1px solid #cfddd3;border-radius:9px;padding:11px;background:white;margin:7px 0}.dj-ja-error{background:#fff2f0;color:#9a2e24;border:1px solid #f1c6c0;border-radius:10px;padding:10px;margin-top:10px}.dj-ja-empty{padding:54px 24px;text-align:center;color:#66756b}.dj-ja-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.dj-ja-stat{border:1px solid #dce7df;border-radius:11px;padding:12px;background:#f9fbf9}.dj-ja-stat b{display:block;font-size:18px;color:#173f2a}.dj-ja-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.dj-ja-table-wrap{overflow:auto}.dj-ja-table{width:100%;border-collapse:collapse;min-width:900px}.dj-ja-table th,.dj-ja-table td{border-bottom:1px solid #e4ebe6;padding:9px;text-align:left;font-size:12px;vertical-align:top}.dj-ja-confidence{display:inline-block;padding:3px 7px;border-radius:99px;font-size:10px;font-weight:800}.dj-ja-confidence.confirmed{background:#e3f4e9;color:#17613b}.dj-ja-confidence.calculated{background:#eaf0fb;color:#315894}.dj-ja-confidence.estimated{background:#fff4d8;color:#8a6515}.dj-ja-confidence.missing{background:#fde7e4;color:#9a3328}.dj-ja-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.dj-ja-list{display:grid;gap:8px}.dj-ja-row{border:1px solid #e0e8e2;border-radius:10px;padding:10px}.dj-ja-cost{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #e6ece8}.dj-ja-total{font-weight:900;font-size:17px;color:#17452d}.dj-ja-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      @media(max-width:1000px){.dj-ja-grid{grid-template-columns:1fr}.dj-ja-stats{grid-template-columns:1fr 1fr}.dj-ja-columns{grid-template-columns:1fr}}@media(max-width:620px){.dj-ja-stats{grid-template-columns:1fr 1fr}.dj-ja-card{padding:12px}}
    `}</style>
    <div className="dj-ja-grid">
     <aside className="dj-ja-card">
      <h2>Project package</h2>
      <label>Project name<input className="dj-ja-input" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="e.g. Riverside Office Fit-Out"/></label>
      <input ref={input} hidden multiple type="file" accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={e=>addFiles(e.target.files)}/>
      <div className="dj-ja-drop" onClick={()=>input.current?.click()}><strong>＋ Upload project files</strong><span>Plans · BOQ · Specs · Schedules</span><small style={{display:'block',marginTop:5}}>PDF, Office files, text and images</small></div>
      <div className="dj-ja-files">{files.map((f,i)=><div className="dj-ja-file" key={f.name+i}><span>{f.name}<small style={{display:'block'}}>{(f.size/1024/1024).toFixed(2)} MB</small></span><button className="dj-ja-secondary dj-ja-btn" onClick={()=>setFiles(x=>x.filter((_,n)=>n!==i))}>×</button></div>)}</div>
      <button className="dj-ja-btn dj-ja-primary" disabled={busy||!files.length} onClick={analyse}>{busy?'Analysing project…':'Analyse Project'}</button>
      {error&&<div className="dj-ja-error">{error}</div>}
      <p style={{fontSize:11,color:'#69776e',marginBottom:0}}>The analyser uses the current Delta Price Library where rates exist. Unproven information is marked Calculated, Estimated or Missing rather than treated as confirmed.</p>
     </aside>
     <section>
      {!analysis?<div className="dj-ja-card dj-ja-empty"><h2>No analysis yet</h2><p>Add the job package and select <b>Analyse Project</b>. The result will appear here for review before any PDF is generated.</p></div>:
      <>
       <div className="dj-ja-card">
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start',flexWrap:'wrap'}}><div><p className="rev-kicker-light">PROJECT</p><h2>{analysis.project.name}</h2><p>{analysis.project.summary}</p></div><button className="dj-ja-btn dj-ja-secondary" onClick={exportPdf}>Generate Works PDF</button></div>
        <div className="dj-ja-stats">
         <div className="dj-ja-stat"><small>Joinery items</small><b>{analysis.scope.length}</b></div>
         <div className="dj-ja-stat"><small>Materials</small><b>{analysis.materials.length}</b></div>
         <div className="dj-ja-stat"><small>Open RFIs</small><b>{analysis.rfis.length}</b></div>
         <div className="dj-ja-stat"><small>Estimated value</small><b>{money(analysis.costs.total)}</b></div>
        </div>
        <div className="dj-ja-table-wrap"><table className="dj-ja-table"><thead><tr><th>Ref</th><th>Joinery / Furniture</th><th>Qty</th><th>Measure</th><th>Material / Finish</th><th>Brief</th><th>Source</th><th>Status</th><th>Est. Cost</th></tr></thead><tbody>{analysis.scope.map((x,i)=><tr key={x.ref+i}><td><b>{x.ref}</b></td><td><b>{x.item}</b>{x.location&&<small style={{display:'block'}}>{x.location}</small>}</td><td>{x.qty}</td><td>{x.measure}</td><td>{x.material}</td><td>{x.description}</td><td>{x.source||'—'}</td><td><span className={confidenceClass(x.confidence)}>{x.confidence}</span></td><td>{money(x.estimatedCost)}</td></tr>)}</tbody></table></div>
       </div>
       <div className="dj-ja-columns">
        <div className="dj-ja-card"><h3>Materials schedule</h3><div className="dj-ja-list">{analysis.materials.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.material}</b><span style={{float:'right'}}>{x.quantity}</span>{x.basis&&<small style={{display:'block',marginTop:4,color:'#68766d'}}>{x.basis}</small>}</div>)}</div></div>
        <div className="dj-ja-card"><h3>Estimated price</h3>{[['Materials',analysis.costs.materials],['Production',analysis.costs.production],['CNC / Machining',analysis.costs.cnc],['Finishing',analysis.costs.finishing],['Installation',analysis.costs.installation],['Transport',analysis.costs.transport],['Other',analysis.costs.other]].map(([n,v])=><div className="dj-ja-cost" key={String(n)}><span>{n}</span><b>{money(Number(v))}</b></div>)}<div className="dj-ja-cost"><span>Subtotal</span><b>{money(analysis.costs.subtotal)}</b></div><div className="dj-ja-cost"><span>Margin</span><b>{money(analysis.costs.margin)}</b></div><div className="dj-ja-cost dj-ja-total"><span>Estimated Project Value</span><span>{money(analysis.costs.total)} + VAT</span></div></div>
       </div>
       <div className="dj-ja-columns">
        <div className="dj-ja-card"><h3>Outstanding Questions / RFIs</h3><div className="dj-ja-list">{analysis.rfis.length?analysis.rfis.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.ref} · {x.item}</b><p style={{margin:'5px 0 0'}}>{x.question}</p>{x.source&&<small>{x.source}</small>}</div>):<p>No outstanding questions identified.</p>}</div></div>
        <div className="dj-ja-card"><h3>Drawing / document references</h3><div className="dj-ja-list">{analysis.drawingReferences.map((x,i)=><div className="dj-ja-row" key={i}><b>{x.reference}</b><span style={{display:'block'}}>{x.description}</span></div>)}</div><h3 style={{marginTop:18}}>Assumptions</h3><div className="dj-ja-list">{analysis.assumptions.map((x,i)=><div className="dj-ja-row" key={i}>{x}</div>)}</div></div>
       </div>
      </>}
     </section>
    </div>
   </section>
  </div>
 </main>
}
