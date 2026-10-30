'use client';
import React,{useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../../DesktopSidebar';
type Part={id:string;name:string;length:string;width:string;qty:string;grain:boolean;rotate:boolean};
type Settings={project:string;material:string;length:string;width:string;kerf:string;trim:string};
type Placement={name:string;x:number;y:number;w:number;h:number;sheet:number};
const T=20; // 0.05 mm exact integer ticks
const ticks=(x:string)=>Math.round(Number(x)*T);
const fmt=(x:number)=>(x/T).toFixed(2);
const initial:Settings={project:'New Project',material:'18mm MFC',length:'2440',width:'1220',kerf:'3.20',trim:'5'};
function optimize(settings:Settings,parts:Part[]){
 const L=ticks(settings.length),W=ticks(settings.width),K=ticks(settings.kerf),trim=ticks(settings.trim);
 if(!Number.isSafeInteger(L)||!Number.isSafeInteger(W)||!Number.isSafeInteger(K)||!Number.isSafeInteger(trim)||L<=0||W<=0||K<0||trim<0||trim*2>=Math.min(L,W))return {sheets:[] as Placement[][],missing:['Invalid sheet dimensions, blade kerf or edge trim'],usableL:0,usableW:0};
 const usableL=L-2*trim,usableW=W-2*trim;
 const expanded:{name:string;w:number;h:number;rotate:boolean}[]=[];const missing:string[]=[];
 for(const p of parts){const w=ticks(p.length),h=ticks(p.width),q=Number(p.qty);if(!(w>0&&h>0&&Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&Number.isInteger(q)&&q>0&&q<=1000)){missing.push(p.name+': invalid size or quantity');continue}if(expanded.length+q>3000){missing.push('Maximum 3000 pieces per project');break}for(let i=0;i<q;i++)expanded.push({name:p.name||'Unnamed',w,h,rotate:p.rotate&&!p.grain})}
 expanded.sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h);
 type Shelf={y:number;height:number;nextX:number;items:Placement[]};
 const pages:{shelves:Shelf[];nextY:number}[]=[];
 for(const p of expanded){
  let found=false;
  for(let z=0;z<=pages.length;z++){if(z===pages.length)pages.push({shelves:[],nextY:0});const page=pages[z];
   const rotations:[number,number][]=[[p.w,p.h]];if(p.rotate&&p.w!==p.h)rotations.push([p.h,p.w]);
   for(const [w,h] of rotations){
    const shelf=page.shelves.find(s=>h<=s.height&&s.nextX+(s.nextX?K:0)+w<=usableL);
    if(shelf){const x=shelf.nextX+(shelf.nextX?K:0);shelf.items.push({name:p.name,x,y:shelf.y,w,h,sheet:z});shelf.nextX=x+w;found=true;break}
    if(w<=usableL&&page.nextY+(page.shelves.length?K:0)+h<=usableW){const y=page.nextY+(page.shelves.length?K:0);page.shelves.push({y,height:h,nextX:w,items:[{name:p.name,x:0,y,w,h,sheet:z}]});page.nextY=y+h;found=true;break}
   }
   if(found)break;
   if(z===pages.length-1&&page.shelves.length===0){pages.pop();missing.push(p.name+' ('+fmt(p.w)+' × '+fmt(p.h)+' mm): too large for usable sheet');break}
  }
 }
 return {sheets:pages.map(p=>p.shelves.flatMap(s=>s.items)),missing,usableL,usableW};
}
const inputStyle:React.CSSProperties={width:'100%',boxSizing:'border-box',border:'1px solid rgba(112,190,239,.28)',background:'rgba(3,18,30,.72)',borderRadius:9,padding:'10px',fontSize:14,color:'#f4f8fb'};
const panel:React.CSSProperties={background:'rgba(7,28,45,.78)',border:'1px solid rgba(112,190,239,.30)',borderRadius:14,padding:18,boxShadow:'inset 0 1px 0 rgba(255,255,255,.06),0 16px 36px rgba(0,0,0,.20)',backdropFilter:'blur(18px)',color:'#f4f8fb'};
const btn:React.CSSProperties={padding:'10px 14px',border:'1px solid rgba(112,190,239,.35)',borderRadius:9,background:'#0c70b8',color:'#fff',cursor:'pointer',boxShadow:'0 8px 20px rgba(0,76,128,.24)'};
export default function CuttingList(){
 const [settings,setSettings]=useState<Settings>(initial);
 const [parts,setParts]=useState<Part[]>([{id:'starter',name:'Side panel',length:'720',width:'550',qty:'2',grain:true,rotate:false}]);
 const [selected,setSelected]=useState(0);
 const [saved,setSaved]=useState<string[]>([]);
 const [notice,setNotice]=useState('');
 useEffect(()=>{const refresh=()=>{try{const all=JSON.parse(localStorage.getItem('dj_cutting_projects')||'{}');setSaved(Object.keys(all));}catch{setSaved([])}};refresh();const onSync=(e:Event)=>{if((e as CustomEvent).detail==='dj_cutting_projects')refresh()};window.addEventListener('dj-cloud-received',onSync);return()=>window.removeEventListener('dj-cloud-received',onSync)},[]);
 const data=useMemo(()=>optimize(settings,parts),[settings,parts]);
 const changeSetting=(key:keyof Settings,value:string)=>setSettings(s=>({...s,[key]:value}));
 const changePart=(id:string,key:keyof Part,value:string|boolean)=>setParts(ps=>ps.map(p=>p.id===id?{...p,[key]:value}:p));
 const save=()=>{const n=settings.project.trim();if(!n){setNotice('Enter a project name');return}try{const all=JSON.parse(localStorage.getItem('dj_cutting_projects')||'{}');all[n]={settings,parts};localStorage.setItem('dj_cutting_projects',JSON.stringify(all));setSaved(Object.keys(all));setNotice('Saved — syncing with your cloud account')}catch{setNotice('Unable to save project')}};
 const load=(name:string)=>{try{const all=JSON.parse(localStorage.getItem('dj_cutting_projects')||'{}');const obj=all[name];if(obj?.settings&&Array.isArray(obj.parts)){setSettings(obj.settings);setParts(obj.parts);setSelected(0);setNotice('Loaded '+name)}}catch{setNotice('Unable to load project')}};
 const count=parts.reduce((a,p)=>a+(Number(p.qty)||0),0);
 const actual=data.sheets.flat().reduce((a,p)=>a+p.w*p.h,0);
 const sheetArea=ticks(settings.length)*ticks(settings.width);
 const waste=data.sheets.length*sheetArea?100*(1-actual/(data.sheets.length*sheetArea)):0;
 const field=(title:string,key:keyof Settings)=><label style={{display:'grid',gap:5,fontSize:12,fontWeight:600}}>{title}<input style={inputStyle} type={key==='project'||key==='material'?'text':'number'} step={key==='project'||key==='material'?undefined:'0.05'} min={key==='project'||key==='material'?undefined:'0'} value={settings[key]} onChange={e=>changeSetting(key,e.target.value)}/></label>;
 return <main className="rev-shell dj-full-desktop dj-functional dj-cutting-page dj-unified-page"><DesktopSidebar active="tools"/><div className="rev-phone rev-inner dj-unified-content" style={{padding:20,width:'100%',maxWidth:1500}}>
 <div className="dj-page-header" style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}><div><small style={{color:'#27724a'}}>DELTA JOINERY · TOOLS</small><h1 style={{fontSize:29,margin:'4px 0'}}>Cutting List</h1><p style={{margin:0,color:'#667a70'}}>Measured in 0.05 mm increments · guillotine-style shelf layout</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={btn} onClick={save}>Save project</button><button style={{...btn,background:'#f0f5f1',color:'#153f2e'}} onClick={()=>window.print()}>Print / PDF</button><Link style={{...btn,textDecoration:'none'}} href="/tools/measurements">Measurements</Link></div></div>
 <section style={{...panel,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:15}}>{field('Project name','project')}{field('Material','material')}{field('Sheet length (mm)','length')}{field('Sheet width (mm)','width')}{field('Blade kerf (mm)','kerf')}{field('Trim from EACH edge (mm)','trim')}</section>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,440px),1fr))',gap:15}}>
 <section style={panel}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><h2 style={{fontSize:19}}>Cutting list items</h2><button style={btn} onClick={()=>setParts(ps=>[...ps,{id:crypto.randomUUID(),name:'New piece',length:'500',width:'300',qty:'1',grain:false,rotate:true}])}>+ Add piece</button></div><p style={{fontSize:12,color:'#61766c'}}>Dimensions are finished cut sizes; rotation is disabled for grain-locked pieces.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'separate',borderSpacing:'0 10px',minWidth:570,fontSize:12}}><thead><tr>{['Part name','Length mm','Width mm','Qty','Grain lock','Rotate',''].map(h=><th key={h} style={{textAlign:'left'}}>{h}</th>)}</tr></thead><tbody>{parts.map(p=><tr key={p.id}>{(['name','length','width','qty'] as const).map(k=><td key={k} style={{paddingRight:4}}><input aria-label={k} style={{...inputStyle,padding:7,minWidth:k==='name'?95:65}} value={p[k]} type={k==='name'?'text':'number'} step={k==='qty'?'1':'0.05'} onChange={e=>changePart(p.id,k,e.target.value)}/></td>)}<td><input aria-label="Lock grain direction" type="checkbox" checked={p.grain} onChange={e=>changePart(p.id,'grain',e.target.checked)}/></td><td><input aria-label="Allow rotation" type="checkbox" checked={p.rotate} disabled={p.grain} onChange={e=>changePart(p.id,'rotate',e.target.checked)}/></td><td><button onClick={()=>setParts(ps=>ps.filter(x=>x.id!==p.id))} title="Delete part">×</button></td></tr>)}</tbody></table></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:10}}>{[['Sheets required',data.sheets.length],['Parts requested',count],['Estimated waste',waste.toFixed(1)+'%']].map(([k,v])=><div key={String(k)} style={{background:'#eef5ef',padding:12,borderRadius:9}}><small>{k}</small><h2 style={{margin:'6px 0'}}>{v}</h2></div>)}</div>
 {data.missing.length>0&&<div style={{marginTop:12,color:'#9b3927'}}><strong>Unplaced / invalid pieces:</strong> {data.missing.join('; ')}</div>}
 <p style={{fontSize:12,color:'#61766c'}}>This is a practical placement heuristic, not a globally optimal cutting solution. Review kerf, grain and saw cutting order before production.</p></section>
 <section style={panel}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><h2 style={{fontSize:19}}>Sheet layout</h2><select style={{...inputStyle,width:'auto'}} value={Math.min(selected,Math.max(0,data.sheets.length-1))} onChange={e=>setSelected(Number(e.target.value))}>{data.sheets.map((_,i)=><option value={i} key={i}>Sheet {i+1} of {data.sheets.length}</option>)}</select></div>
 {data.sheets.length>0?<svg viewBox="0 0 600 360" width="100%" role="img" aria-label="Cutting plan for selected sheet"><rect x="20" y="18" width="560" height="310" fill="#d9d7cf" stroke="#263d2e" strokeWidth="2"/><rect x={20+560*ticks(settings.trim)/ticks(settings.length)} y={18+310*ticks(settings.trim)/ticks(settings.width)} width={560*data.usableL/ticks(settings.length)} height={310*data.usableW/ticks(settings.width)} fill="#f0e9dd"/>{data.sheets[Math.min(selected,data.sheets.length-1)]?.map((p,i)=>{const x=20+560*(ticks(settings.trim)+p.x)/ticks(settings.length),y=18+310*(ticks(settings.trim)+p.y)/ticks(settings.width),w=560*p.w/ticks(settings.length),h=310*p.h/ticks(settings.width);return <g key={i}><rect x={x} y={y} width={w} height={h} fill={i%2?'#d9af7b':'#b98c57'} stroke="#423a31" strokeWidth="1"/>{w>38&&h>24&&<text x={x+w/2} y={y+h/2} textAnchor="middle" fontSize="11" fill="#1b241a">{p.name.slice(0,16)}</text>}</g>})}<text x="300" y="349" textAnchor="middle" fontSize="14" fill="#173d2b">{settings.length} × {settings.width} mm</text></svg>:<p>No pieces have been placed yet.</p>}
 <h3>Sheet breakdown</h3><div style={{display:'grid',gap:6}}>{data.sheets[Math.min(selected,Math.max(0,data.sheets.length-1))]?.map((p,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px solid #e2e9e3',padding:7,fontSize:13}}><span>{p.name}</span><strong>{fmt(p.w)} × {fmt(p.h)} mm</strong></div>)}</div>
 <p style={{fontSize:12,color:'#61766c'}}>Hatched/offcut areas and trim zones are not counted as usable material. Verify any required sequence of straight-through cuts.</p></section></div>
 <section style={{...panel,marginTop:15}}><h3>Saved cutting lists</h3><div style={{display:'flex',flexWrap:'wrap',gap:9}}>{saved.map(n=><button key={n} onClick={()=>load(n)} style={{...btn,background:'#edf4ef',color:'#163e2b'}}>{n}</button>)}{saved.length===0&&<span>No saved projects yet.</span>}</div>{notice&&<p role="status">{notice}</p>}</section>
 <div className="dj-cut-print">
 <div className="dj-print-head"><div><strong>DELTA JOINERY</strong><small>BESPOKE INTERIORS · WORKSHOP CUTTING PLAN</small></div><div>Project: <b>{settings.project}</b></div></div>
 <h1>Cutting List</h1>
 <div className="dj-print-metrics"><span>Material <b>{settings.material}</b></span><span>Sheet <b>{settings.length} × {settings.width} mm</b></span><span>Blade kerf <b>{settings.kerf} mm</b></span><span>Trim per edge <b>{settings.trim} mm</b></span><span>Sheets <b>{data.sheets.length}</b></span><span>Pieces <b>{count}</b></span></div>
 <h2>Parts schedule</h2>
 <table className="dj-print-table"><thead><tr><th>Part</th><th>Length (mm)</th><th>Width (mm)</th><th>Qty</th><th>Grain fixed</th></tr></thead><tbody>{parts.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.length}</td><td>{p.width}</td><td>{p.qty}</td><td>{p.grain?'Yes':'No'}</td></tr>)}</tbody></table>
 {data.missing.length>0&&<p style={{color:'#963d25'}}>Unplaced pieces: {data.missing.join('; ')}</p>}
 <div className="dj-print-note">Measurements calculated in 0.05 mm increments. Confirm actual saw kerf, material size, grain direction and cutting order before machining.</div>
 {data.sheets.map((sheet,index)=><section className={index===0&&parts.length<=6&&sheet.length<=8?"dj-print-sheet dj-first-sheet":"dj-print-sheet"} key={index}><div className="dj-print-sheet-header"><b>Sheet {index+1} of {data.sheets.length}</b><span>{settings.length} × {settings.width} mm · {settings.material}</span></div>
 <svg viewBox="0 0 600 360" width="100%" role="img" aria-label={'Sheet '+(index+1)+' cutting layout'}><rect x="20" y="18" width="560" height="310" fill="#ddd9d0" stroke="#263d2e" strokeWidth="2"/><rect x={20+560*ticks(settings.trim)/ticks(settings.length)} y={18+310*ticks(settings.trim)/ticks(settings.width)} width={560*data.usableL/ticks(settings.length)} height={310*data.usableW/ticks(settings.width)} fill="#f4ede0"/>{sheet.map((p,i)=>{const x=20+560*(ticks(settings.trim)+p.x)/ticks(settings.length),y=18+310*(ticks(settings.trim)+p.y)/ticks(settings.width),w=560*p.w/ticks(settings.length),h=310*p.h/ticks(settings.width);return <g key={i}><rect x={x} y={y} width={w} height={h} fill={i%2?'#d6ae7b':'#bc925e'} stroke="#3a382f" strokeWidth="1"/>{w>40&&h>18&&<text x={x+w/2} y={y+h/2} textAnchor="middle" fontSize="10" fill="#20231e">{p.name.slice(0,18)}</text>}</g>})}<text x="300" y="349" textAnchor="middle" fontSize="13" fill="#173d2b">{settings.length} × {settings.width} mm</text></svg>
 <table className="dj-print-table"><thead><tr><th>Piece</th><th>Cut length</th><th>Cut width</th></tr></thead><tbody>{sheet.map((p,i)=><tr key={i}><td>{p.name}</td><td>{fmt(p.w)} mm</td><td>{fmt(p.h)} mm</td></tr>)}</tbody></table>
 </section>)}
 </div>
 </div></main>
}
