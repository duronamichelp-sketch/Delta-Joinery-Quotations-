'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from './DesktopSidebar';
import {useDeltaAccount} from './CloudSync';
import {read} from '../lib/data';
import {savedQuoteTotal,type SavedQuotation} from '../lib/quotationTotals';
import {localDateKey,weekHours as calculateWeekHours,type TimeRecords} from '../lib/workingHours';
import {useLiveNow} from './useLiveNow';
import LiveHoursLabel from './LiveHoursLabel';
type Task={id:string;client:string;project:string;due:string;notes:string;status:'upcoming'|'finished';created:string;finished?:string;amount?:number};
// Dashboard includes manual finished quotation entries.
const KEY='dj_quotation_tasks';
const dateToday=()=>new Date().toLocaleDateString('en-CA');
const formatDate=(v:string)=>v?new Date(v+'T12:00:00').toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'}):'No deadline';
export default function Home(){
 const account=useDeltaAccount();
 const [tasks,setTasks]=useState<Task[]>([]);
 const [savedQuotes,setSavedQuotes]=useState<SavedQuotation[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [timeRecords,setTimeRecords]=useState<TimeRecords|null>(null);
 const [addressCount,setAddressCount]=useState(0);
 const now=useLiveNow();
 const weekHours=timeRecords===null?null:calculateWeekHours(timeRecords,now);
 const todayDate=localDateKey(now);
 const todayEntry=timeRecords?.[todayDate];
 const [showForm,setShowForm]=useState(false);
 const [showManual,setShowManual]=useState(false);
 const [manualClient,setManualClient]=useState('');
 const [manualProject,setManualProject]=useState('');
 const [manualAmount,setManualAmount]=useState('');
 const [filter,setFilter]=useState<'upcoming'|'finished'>('upcoming');
 const [client,setClient]=useState(''),[project,setProject]=useState(''),[due,setDue]=useState(''),[notes,setNotes]=useState('');
 const [amount,setAmount]=useState('');
 const [editing,setEditing]=useState<string|null>(null);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(Array.isArray(data))setTasks(data)}const addr=JSON.parse(localStorage.getItem('dj_tool_addresses')||'[]');setAddressCount(Array.isArray(addr)?addr.length:0)}catch{}setSavedQuotes(read<SavedQuotation[]>('dj_saved_quotes',[]));setLoaded(true)},[]);
 useEffect(()=>{if(loaded)localStorage.setItem(KEY,JSON.stringify(tasks))},[tasks,loaded]);
 useEffect(()=>{
  let cancelled=false;
  const calculate=(all:TimeRecords)=>{if(!cancelled)setTimeRecords(all)};
  const readLocal=()=>{try{const value=JSON.parse(localStorage.getItem('dj_timesheets')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value as TimeRecords:{} }catch{return {} as TimeRecords}};
  const refresh=async()=>{
   const local=readLocal();
   if(!account){calculate(local);return}
   try{
    const remote=await account.loadHours() as TimeRecords|null;
    if(cancelled)return;
    calculate(remote?{...local,...remote}:local);
   }catch{if(!cancelled)calculate(local)}
  };
  void refresh();
  const onCloud=(e:Event)=>{if((e as CustomEvent<string>).detail==='dj_timesheets')void refresh()};
  const onLocal=(e:Event)=>{if((e as CustomEvent<string>).detail==='dj_timesheets')calculate(readLocal())};
  const onFocus=()=>void refresh();
  const onVisibility=()=>{if(document.visibilityState==='visible')void refresh()};
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);
  window.addEventListener('dj-cloud-received',onCloud);
  window.addEventListener('dj-cloud-change',onLocal);
  window.addEventListener('storage',onFocus);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('dj-cloud-received',onCloud);window.removeEventListener('dj-cloud-change',onLocal);window.removeEventListener('storage',onFocus);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility)};
 },[account?.email]);
 const upcoming=useMemo(()=>tasks.filter(t=>t.status==='upcoming').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')),[tasks]);
 const finished=useMemo(()=>tasks.filter(t=>t.status==='finished').sort((a,b)=>(b.finished||'').localeCompare(a.finished||'')),[tasks]);
 function addManual(e:React.FormEvent){e.preventDefault();const value=Number(manualAmount);if(!manualClient.trim()||!manualProject.trim()||!Number.isFinite(value)||value<0)return;setTasks(prev=>[{id:crypto.randomUUID(),client:manualClient.trim(),project:manualProject.trim(),due:'',notes:'Manually entered finished quotation',status:'finished',created:dateToday(),finished:dateToday(),amount:Math.round(value*100)/100},...prev]);setManualClient('');setManualProject('');setManualAmount('');setShowManual(false);setFilter('finished')}
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
 const finishedSaved=savedQuotes.filter(q=>q.finished);
 const finishedTotal=finished.reduce((sum,t)=>sum+(Number(t.amount)||0),0)+finishedSaved.reduce((sum,q)=>sum+savedQuoteTotal(q),0);
 const finishedCount=finished.length+finishedSaved.length;
 const shown=filter==='upcoming'?upcoming:finished;
 return <main className="dj-glass-home">
 <DesktopSidebar active="home"/>
 <div className="dj-glass-stage">
  <header className="dj-glass-top"><div className="dj-glass-search">⌕ <span>Search...</span></div><div className="dj-glass-date">{now.toLocaleDateString('en-IE',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</div><span className="dj-glass-bell">♧</span><span className="dj-glass-avatar">SD</span></header>
  <section className="dj-glass-welcome"><h1>Good Morning<br/><em>Shane</em></h1><p>Here’s an overview of your projects.</p></section>
  <section className="dj-glass-cards">
   <Link href="/quotes"><span className="blue">▤</span><b>Quotations</b><small>{savedQuotes.filter(q=>!q.finished).length+upcoming.length} Open</small><i>→</i></Link>
   <Link href="/hours"><span className="gold">◷</span><b>My Hours</b><small>{weekHours===null?'—':weekHours.toFixed(1)+' hrs'}</small><i>→</i></Link>
   <Link href="/units"><span className="cyan">⬡</span><b>Price Library</b><small>Materials & Units</small><i>→</i></Link>
   <Link href="/tools/addresses"><span>⌖</span><b>Addresses</b><small>{addressCount} Locations</small><i>→</i></Link>
  </section>
  <section className="dj-glass-grid">
   <div className="dj-glass-panel hours"><h2>Today’s Hours</h2><div className="hours-ring"><strong>{weekHours===null?'—':weekHours.toFixed(1)}</strong><small>Hours</small></div><div className="hours-meta"><span>Start<br/><b>{todayEntry?.start||'--'}</b></span><span>Finish<br/><b>{todayEntry?.finish||'--'}</b></span></div><Link href="/hours">⊕ &nbsp; Add Entry</Link></div>
   <div className="dj-glass-panel quick"><div className="head"><h2>Quick Tools</h2></div><div className="quick4"><Link href="/tools/measurements">▱<b>Slat Wall<br/>Calculator</b></Link><Link href="/tools/measurements">▦<b>Floor<br/>Coverage</b></Link><Link href="/tools/measurements">◺<b>Angle<br/>Finder</b></Link><Link href="/tools/cutting-list">▤<b>Cutting<br/>List</b></Link></div></div>
   <div className="dj-glass-panel jobs"><div className="head"><h2>Upcoming / Active Jobs</h2><Link href="/quotes">View All →</Link></div>{upcoming.slice(0,4).map(t=><div className="job-row" key={t.id}><span className="thumb">▤</span><div><b>{t.project}</b><small>{t.client}</small></div><time>{formatDate(t.due)}</time></div>)}</div>
   <div className="dj-glass-panel library"><div className="head"><h2>Price Library</h2><Link href="/units">Open →</Link></div><div className="library-tabs"><span>Units</span><span>Doors</span><span>Worktops</span><span>Timber</span><span>Sheet Materials</span><span>Hardware</span></div><Link className="big-action" href="/units">Browse materials & unit rates <span>→</span></Link></div>
   <div className="dj-glass-panel skoda"><div className="head"><h2>Skoda Installation List</h2><Link href="/tools/skoda">View All →</Link></div><div className="skoda-tabs"><span>Coffee Unit</span><span>Wall Slats</span><span>Free Standing Walls</span><span>Floor Mounted Walls</span></div><Link className="big-action" href="/tools/skoda">Open installation list <span>→</span></Link></div>
  </section>
 </div>
 </main>
}
