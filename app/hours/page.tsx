'use client';
import {useEffect,useRef,useState} from 'react';
import DesktopSidebar from '../DesktopSidebar';
import {useDeltaAccount} from '../CloudSync';
import {entryHours,formatTime,localDateKey as iso,weekStart as weekOf,type TimeEntry as Entry} from '../../lib/workingHours';
import {useLiveNow} from '../useLiveNow';
import LiveHoursLabel from '../LiveHoursLabel';
type Records=Record<string,Entry>;
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function offset(d:Date,n:number){const v=new Date(d);v.setDate(v.getDate()+n);return v}
const blank=():Entry=>({start:'',finish:'',breakMinutes:''});
export default function HoursPage(){
 const account=useDeltaAccount();
 const now=useLiveNow();
 const loadedFromCloud=useRef(false);
 const [week,setWeek]=useState(()=>iso(weekOf(new Date())));
 const [records,setRecords]=useState<Records>({});
 const [ready,setReady]=useState(false);
 const [message,setMessage]=useState('');
 const dirty=useRef(false);
 useEffect(()=>{
  let cancelled=false;
  const local=()=>{try{const data=JSON.parse(localStorage.getItem('dj_timesheets')||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data as Records:{}}catch{return {} as Records}};
  const initialize=async()=>{
   const existing=local();
   setRecords(existing);
   if(!account){setReady(true);return}
   try{
    const remote=await account.loadHours() as Records|null;
    if(cancelled)return;
    const merged={...existing,...(remote||{})};
    setRecords(merged);
    if(!remote&&Object.keys(existing).length)await account.saveHours(merged);
    loadedFromCloud.current=true;setMessage('Cloud hours connected');
   }catch(e){if(!cancelled)setMessage('Cloud sync error: '+(e instanceof Error?e.message:'Unknown error'))}
   finally{if(!cancelled)setReady(true)}
  };
  void initialize();
  const onCloud=async(event:Event)=>{
   if((event as CustomEvent<string>).detail!=='dj_timesheets'||dirty.current||!account)return;
   try{const remote=await account.loadHours() as Records|null;if(remote&&!cancelled){setRecords(remote);loadedFromCloud.current=true}}catch{}
  };
  window.addEventListener('dj-cloud-received',onCloud);
  return ()=>{cancelled=true;window.removeEventListener('dj-cloud-received',onCloud)};
 },[account?.email]);
 useEffect(()=>{
  if(!ready||!dirty.current||!account)return;
  const timer=window.setTimeout(async()=>{
   try{await account.saveHours(records);dirty.current=false;setMessage('Saved to cloud')}
   catch(e){setMessage('Cloud save failed: '+(e instanceof Error?e.message:'Unknown error'))}
  },800);
  return ()=>window.clearTimeout(timer);
 },[records,ready,account?.email]);
 useEffect(()=>{
  if(!ready||!account)return;
  let cancelled=false;
  const refresh=async()=>{
   if(dirty.current)return;
   try{
    const remote=await account.loadHours() as Records|null;
    if(!cancelled&&remote&&JSON.stringify(remote)!==JSON.stringify(records)){setRecords(remote);setMessage('Updated from cloud')}
   }catch{}
  };
  const onFocus=()=>{if(document.visibilityState==='visible')void refresh()};
  window.addEventListener('focus',onFocus);
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);
  return ()=>{cancelled=true;window.removeEventListener('focus',onFocus);window.clearInterval(timer)}
 },[ready,account?.email,records]);
 const monday=weekOf(new Date(week+'T12:00:00'));
 const dates=weekdays.map((_,i)=>iso(offset(monday,i)));
 const entries=dates.map(date=>records[date]||blank());
 const daily=entries.map((entry,i)=>entryHours(entry,dates[i],now));
 const weekly=daily.reduce((a,b)=>a+b,0);
 const todayDate=iso(now);
 const todayEntry=records[todayDate];
 const today=entryHours(todayEntry,todayDate,now);
 const days=entries.filter(x=>!x.notWorked&&x.start&&x.finish).length;
 function change(date:string,field:keyof Entry,value:string){dirty.current=true;setRecords(old=>({...old,[date]:{...(old[date]||blank()),[field]:value}}));setMessage('Unsaved changes')}
 function toggleNA(date:string,checked:boolean){dirty.current=true;setRecords(old=>({...old,[date]:{...(old[date]||blank()),notWorked:checked,...(checked?{start:'',finish:''}:{})}}));setMessage('Unsaved changes')}
 function normalize(date:string,field:'start'|'finish'){const raw=records[date]?.[field];if(raw)change(date,field,formatTime(raw,field))}

 async function exportPDF(){
  try{
   const {jsPDF}=await import('jspdf');
   const pdf=new jsPDF({format:'a4',unit:'mm'});
   const left=19,right=191;
   pdf.setFillColor(12,70,42);pdf.rect(0,0,210,36,'F');
   pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(19);pdf.text('DELTA JOINERY',left,17);
   pdf.setFontSize(11);pdf.text('WEEKLY TIMESHEET',right,26,{align:'right'});
   pdf.setTextColor(30,52,39);pdf.setFontSize(11);pdf.text('Week of '+monday.toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'}),left,49);
   pdf.setFontSize(9);pdf.setTextColor(95,115,100);pdf.text('Start / finish times and hours worked',left,56);
   let y=66;pdf.setFillColor(232,242,235);pdf.rect(left,y,right-left,11,'F');
   pdf.setTextColor(18,70,44);pdf.setFont('helvetica','bold');pdf.setFontSize(9);
   pdf.text('DAY / DATE',left+4,y+7);pdf.text('START',86,y+7);pdf.text('FINISH',122,y+7);pdf.text('HOURS',right-4,y+7,{align:'right'});y+=11;
   weekdays.forEach((day,i)=>{
    const e=entries[i],na=!!e.notWorked;const date=offset(monday,i).toLocaleDateString('en-IE',{day:'numeric',month:'short'});
    if(i%2===1){pdf.setFillColor(248,251,249);pdf.rect(left,y,right-left,15,'F')}
    pdf.setFont('helvetica','normal');pdf.setTextColor(31,54,41);pdf.setFontSize(9);
    pdf.text(day+'  '+date,left+4,y+9);pdf.text(na?'N/A':e.start||'-',86,y+9);pdf.text(na?'N/A':e.finish||'-',122,y+9);
    pdf.setFont('helvetica','bold');pdf.text(na?'N/A':daily[i].toFixed(2)+' hrs',right-4,y+9,{align:'right'});
    y+=15;pdf.setDrawColor(224,233,226);pdf.line(left,y,right,y);
   });
   y+=12;pdf.setFillColor(12,86,51);pdf.roundedRect(left,y,right-left,19,2,2,'F');
   pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(12);
   pdf.text('WEEKLY TOTAL',left+5,y+12);pdf.text(weekly.toFixed(2)+' hrs',right-5,y+12,{align:'right'});
   pdf.setTextColor(113,129,116);pdf.setFontSize(8);pdf.text('Delta Joinery  |  Week of '+week,left,281);
   pdf.save('Delta-Joinery-Timesheet-'+week+'.pdf');
  }catch(error){console.error(error);setMessage('PDF export failed. Please try again.')}
 }
 const panel:React.CSSProperties={background:'rgba(7,28,45,.78)',border:'1px solid rgba(112,190,239,.30)',borderRadius:16,padding:22,boxShadow:'inset 0 1px 0 rgba(255,255,255,.06),0 16px 36px rgba(0,0,0,.22)',backdropFilter:'blur(18px)',color:'#f4f8fb'};
 const field:React.CSSProperties={border:'1px solid rgba(112,190,239,.28)',padding:'10px',borderRadius:9,background:'rgba(3,18,30,.72)',color:'#f4f8fb',width:'100%',boxSizing:'border-box'};
 return <main className="dj-desktop dj-unified-page dj-hours-page"><DesktopSidebar active="hours"/><div className="dj-unified-content" style={{minWidth:0,minHeight:"100vh",padding:"28px 18px",boxSizing:"border-box"}}><div className="dj-page-inner" style={{maxWidth:1200,margin:'0 auto'}}><header className="dj-page-header"><h1 style={{fontWeight:850,fontSize:34,margin:'4px 0 5px'}}>My Working Hours</h1><p style={{margin:'0',color:'#67796d'}}>Enter your start time to count live, then enter your finish time to stop.</p></header><section style={panel}><div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}><div style={{display:'flex',alignItems:'center',gap:12}}><strong>▦ &nbsp; Week of:</strong><input aria-label="Week of" type="date" value={week} onChange={e=>{if(e.target.value)setWeek(iso(weekOf(new Date(e.target.value+'T12:00:00'))))}} style={{...field,width:168}}/></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button type="button" aria-label="Previous week" style={{...field,width:'auto',minWidth:95,cursor:'pointer'}} onClick={()=>setWeek(iso(offset(monday,-7)))}>‹ Prev</button><button type="button" style={{...field,width:'auto',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>setWeek(iso(weekOf(new Date())))}>This Week</button><button type="button" aria-label="Next week" style={{...field,width:'auto',minWidth:95,cursor:'pointer'}} onClick={()=>setWeek(iso(offset(monday,7)))}>Next ›</button><button type="button" onClick={exportPDF} style={{...field,width:'auto',background:'#17613d',color:'#fff',borderColor:'#17613d',fontWeight:750,cursor:'pointer',whiteSpace:'nowrap'}}>↓ Download PDF</button></div></div><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:750,borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:'#f0f4f1'}}>{['Day','Date','Start','Finish','N/A','Total Hours'].map(s=><th key={s} style={{textAlign:'left',padding:12}}>{s}</th>)}</tr></thead><tbody>{weekdays.map((day,i)=><tr key={dates[i]} style={{borderBottom:'1px solid #e9efeb'}}><td style={{padding:9,fontWeight:700}}>{day}</td><td style={{padding:9}}>{offset(monday,i).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'})}</td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' start'} disabled={!!entries[i].notWorked} value={entries[i].start} onChange={e=>change(dates[i],'start',e.target.value)} onBlur={()=>normalize(dates[i],'start')} style={field}/></td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' finish'} disabled={!!entries[i].notWorked} value={entries[i].finish} onChange={e=>change(dates[i],'finish',e.target.value)} onBlur={()=>normalize(dates[i],'finish')} style={field}/></td><td style={{padding:8,textAlign:'center'}}><input type="checkbox" aria-label={day+' not worked'} checked={!!entries[i].notWorked} onChange={e=>toggleNA(dates[i],e.target.checked)} style={{width:18,height:18,accentColor:'#17613d',cursor:'pointer'}}/></td><td style={{padding:8}}><div style={{textAlign:'center',padding:11,background:'#edf5ee',borderRadius:9,fontWeight:800,color:'#145738',whiteSpace:'nowrap'}}>{entries[i].notWorked?'N/A':daily[i].toFixed(2)+' hrs'}<LiveHoursLabel entry={entries[i]} date={dates[i]} now={now} hours={daily[i]}/></div></td></tr>)}</tbody><tfoot><tr style={{background:'#f0f6f2'}}><td colSpan={5} style={{textAlign:'right',padding:18,fontWeight:800}}>Weekly Total</td><td style={{padding:8}}><div style={{padding:12,background:'#17613d',color:'#fff',borderRadius:9,textAlign:'center',fontWeight:800}}>{weekly.toFixed(2)} hrs</div></td></tr></tfoot></table></div></section><div style={{display:'grid',gridTemplateColumns:'1fr',gap:16,marginTop:18}}><section style={panel}><h2 style={{fontSize:19,margin:'0 0 18px'}}>Time Summary</h2><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9}}>{[['Today',today.toFixed(2)+' hrs'],['This Week',weekly.toFixed(2)+' hrs'],['Entries',days+' days']].map(([label,value])=><div key={label} style={{background:'#f1f7f2',padding:12,borderRadius:10,display:'grid',gap:10}}><span style={{fontSize:12}}>{label}</span><strong style={{fontSize:19,fontVariantNumeric:'tabular-nums'}}>{value}</strong>{(label==='Today'||(label==='This Week'&&dates.includes(todayDate)))&&<LiveHoursLabel entry={todayEntry} date={todayDate} now={now} hours={label==='Today'?today:weekly}/>}</div>)}</div>{message&&<p role="status" style={{fontSize:12,color:'#247447',marginTop:10}}>{message}</p>}</section></div></div></div></main>;
}
