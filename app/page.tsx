'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from './DesktopSidebar';
import Image from 'next/image';
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number};
const KEY='dj_quotation_tasks';
const dateToday=()=>new Date().toLocaleDateString('en-CA');
const formatDate=(v:string)=>v?new Date(v+'T12:00:00').toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'}):'No deadline';
export default function Home(){
 const [tasks,setTasks]=useState<Task[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [showForm,setShowForm]=useState(false);
 const [filter,setFilter]=useState<'upcoming'|'finished'>('upcoming');
 const [client,setClient]=useState(''),[project,setProject]=useState(''),[due,setDue]=useState(''),[notes,setNotes]=useState('');
 const [amount,setAmount]=useState('');
 const [editing,setEditing]=useState<string|null>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(Array.isArray(data))setTasks(data)}}catch{}setLoaded(true)},[]);
 useEffect(()=>{if(loaded)localStorage.setItem(KEY,JSON.stringify(tasks))},[tasks,loaded]);
 const upcoming=useMemo(()=>tasks.filter(t=>t.status==='upcoming').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')),[tasks]);
 const finished=useMemo(()=>tasks.filter(t=>t.status==='finished').sort((a,b)=>(b.finished||'').localeCompare(a.finished||'')),[tasks]);
 function reset(){setClient('');setProject('');setDue('');setNotes('');setAmount('');setEditing(null);setShowForm(false)}
 function save(e:React.FormEvent){e.preventDefault();if(!client.trim()||!project.trim())return;const now=dateToday();if(editing){setTasks(prev=>prev.map(t=>t.id===editing?{...t,client:client.trim(),project:project.trim(),due,notes,amount:Math.max(0,Number(amount)||0)}:t))}else{setTasks(prev=>[{id:crypto.randomUUID(),client:client.trim(),project:project.trim(),due,notes,amount:Math.max(0,Number(amount)||0),status:'upcoming',created:now},...prev])}reset();setFilter('upcoming')}
 function edit(t:Task){setClient(t.client);setProject(t.project);setDue(t.due);setNotes(t.notes);setAmount(String(t.amount??''));setEditing(t.id);setShowForm(true);window.scrollTo({top:0,behavior:'smooth'})}
 function status(id:string,done:boolean){
  const item=tasks.find(t=>t.id===id);if(!item)return;
  let quotationAmount=item.amount??0;
  if(done && !(quotationAmount>0)){const raw=window.prompt('Enter the finished quotation value in € (for example 1500.00):',quotationAmount?String(quotationAmount):'');if(raw===null)return;const entered=Number(raw.trim().replace(/[,€\s]/g,''));if(!Number.isFinite(entered)||entered<0){alert('Enter a valid quotation amount.');return}quotationAmount=entered}
  setTasks(prev=>prev.map(t=>t.id===id?{...t,amount:quotationAmount,status:done?'finished':'upcoming',finished:done?dateToday():undefined}:t));
 }
 function remove(id:string){if(window.confirm('Delete this quotation task?'))setTasks(prev=>prev.filter(t=>t.id!==id))}
 const finishedTotal=finished.reduce((sum,t)=>sum+(Number(t.amount)||0),0);
 const shown=filter==='upcoming'?upcoming:finished;
 return <main className="rev-shell dj-full-desktop"><DesktopSidebar active="home"/><div className="rev-phone">
 <section className="rev-hero dj-work-hero"><div className="rev-brand"><Image src="/delta-logo.png" alt="Delta Joinery" width={150} height={46}/><span className="rev-avatar">DJ</span></div><p className="rev-kicker">DELTA JOINERY · WORKSPACE</p><h1>Quotation<br/><em>dashboard.</em></h1><p className="rev-intro">Manage your jobs, deadlines and completed quotations.</p><Link href="/quote" className="rev-hero-button"><span className="dj-btn-plus">＋</span><span>New Quotation</span><b className="dj-chevron">→</b></Link><div className="rev-hero-glow"/></section>
 <section className="rev-home-area">
 <div className="rev-section-title"><div><p>OVERVIEW</p><h2>Your workspace</h2></div></div>
 <div className="dj-stats"><button type="button" onClick={()=>{setFilter('upcoming');document.getElementById('dj-jobs')?.scrollIntoView({behavior:'smooth'})}} className="dj-stat"><span>Upcoming</span><strong>{upcoming.length}</strong><small>Need quotations</small></button><button type="button" onClick={()=>{setFilter('finished');document.getElementById('dj-jobs')?.scrollIntoView({behavior:'smooth'})}} className="dj-stat"><span>Finished</span><strong>{finished.length}</strong><small>Completed quotations</small></button></div>
 <div className="dj-completed-value" style={{background:'#0d3b27',color:'#fff',padding:'22px 25px',borderRadius:15,margin:'18px 0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><span style={{display:'block',fontSize:12,letterSpacing:'0.12em',fontWeight:800,color:'#a9dbc0'}}>TOTAL VALUE OF FINISHED QUOTATIONS</span><strong style={{display:'block',fontSize:32,marginTop:8}}>{new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(finishedTotal)}</strong><small style={{color:'#cee4d5'}}>{finished.length} finished {finished.length===1?'quotation':'quotations'}</small></div><span style={{fontSize:27}}>€</span></div>
 <div className="dj-next-due"><span className="dj-small-icon">◷</span><div><small>NEXT QUOTATION DUE</small><b>{upcoming.length?formatDate(upcoming[0].due):'No upcoming deadlines'}</b></div></div>
 <div className="rev-section-title rev-recent-heading"><div><p>QUICK ACCESS</p><h2>Your tools</h2></div></div>
 <div className="rev-tiles"><Link href="/quote" className="rev-tile"><span className="rev-tile-icon">▤</span><h3>New quotation</h3><p>Build an estimate</p><span className="dj-tile-arrow">→</span></Link><Link href="/quotes" className="rev-tile"><span className="rev-tile-icon">▤</span><h3>Saved quotations</h3><p>View and reopen previous quotes</p><span className="dj-tile-arrow">→</span></Link><Link href="/units" className="rev-tile rev-tile-wide"><span className="rev-tile-icon">▦</span><h3>Price library</h3><p>Units, doors, hardware and labour</p><span className="dj-tile-arrow">→</span></Link></div>
 <div className="rev-section-title rev-recent-heading" id="dj-jobs"><div><p>QUOTATION TRACKER</p><h2>Your jobs</h2></div><button className="dj-create-task" onClick={()=>{reset();setShowForm(true)}}>＋ Add job</button></div>
 {showForm&&<form className="dj-task-form" onSubmit={save}><h3>{editing?'Edit quotation task':'Upcoming quotation'}</h3><label>Client name<input required value={client} onChange={e=>setClient(e.target.value)} placeholder="Client name"/></label><label>Project / job<input required value={project} onChange={e=>setProject(e.target.value)} placeholder="Kitchen, wardrobe, media wall..."/></label><label>Due date<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><label>Quotation value (€)<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 2500.00"/></label><label>Notes (optional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Site visit, measurements, details..."/></label><div className="dj-task-actions"><button type="submit" className="dj-action-primary">{editing?'Save changes':'Add quotation task'}</button><button type="button" className="dj-action-secondary" onClick={reset}>Cancel</button></div></form>}
 <div className="dj-filter"><button className={filter==='upcoming'?'active':''} onClick={()=>setFilter('upcoming')}>Upcoming <span>{upcoming.length}</span></button><button className={filter==='finished'?'active':''} onClick={()=>setFilter('finished')}>Finished <span>{finished.length}</span></button></div>
 <div className="dj-task-list">{shown.length===0?<div className="dj-empty-task"><span>{filter==='upcoming'?'◷':'✓'}</span><b>{filter==='upcoming'?'Nothing waiting for a quotation':'No finished quotations yet'}</b><p>{filter==='upcoming'?'Add a job and its due date to track your work.':'When you finish a job, it moves here automatically.'}</p></div>:shown.map(t=><article key={t.id} className="dj-job-card"><div className="dj-job-top"><span>{t.status==='finished'?'✓ Completed':'◷ Upcoming'}</span><small>{formatDate(t.due)}</small></div><h3>{t.project}</h3><p>{t.client}</p><p className="dj-job-notes"><b>Quotation value: {new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(Number(t.amount)||0)}</b></p>{t.notes&&<p className="dj-job-notes">{t.notes}</p>}<div className="dj-job-actions"><button className="dj-job-main" onClick={()=>status(t.id,t.status!=='finished')}>{t.status==='finished'?'↶ Reopen':'✓ Mark finished'}</button><button onClick={()=>edit(t)}>Edit</button><button className="dj-remove" onClick={()=>remove(t.id)} aria-label={'Delete '+t.project}>Delete</button></div></article>)}</div>
 <p className="dj-storage-hint">Jobs save automatically in this browser. Phone-to-desktop syncing will come when the database is connected.</p>
 </section><nav className="rev-nav"><Link href="/" className="rev-nav-current">⌂<small>Home</small></Link><Link href="/quote">▤<small>Quote</small></Link><Link href="/quotes">◷<small>Saved</small></Link><Link href="/units">▦<small>Library</small></Link></nav></div></main>
}