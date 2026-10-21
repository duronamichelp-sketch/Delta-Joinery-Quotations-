'use client';
import {useEffect,useRef,useState} from 'react';
import DesktopSidebar from '../DesktopSidebar';
type Entry={start:string;finish:string;breakMinutes:string;notWorked?:boolean};
type Records=Record<string,Entry>;
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function iso(d:Date){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function weekOf(d:Date){const v=new Date(d);v.setHours(12,0,0,0);v.setDate(v.getDate()-(v.getDay()+6)%7);return v}
function offset(d:Date,n:number){const v=new Date(d);v.setDate(v.getDate()+n);return v}
function parseTime(raw:string,kind:'start'|'finish'):number|null{
 const text=raw.trim().toUpperCase();if(!text)return null;
 const suffix=text.match(/(AM|PM)$/)?.[1];
 const value=text.replace(/\s*(AM|PM)$/,'').trim();
 const digits=value.replace(/:/g,'');
 if(!/^\d{1,4}$/.test(digits))return null;
 const parts=value.includes(':')?value.split(':'):digits.length<=2?[digits,'0']:[digits.slice(0,-2),digits.slice(-2)];
 if(parts.length!==2)return null;
 let hour=Number(parts[0]);const min=Number(parts[1]);
 if(hour>23||min>59)return null;
 if(suffix&&hour<=12)hour=hour%12+(suffix==='PM'?12:0);
 else if(!suffix&&kind==='finish'&&hour>0&&hour<12)hour+=12;
 return hour*60+min;
}
function formatTime(value:string,kind:'start'|'finish'){
 const n=parseTime(value,kind);if(n===null)return value;
 const h=Math.floor(n/60);
 return h+':'+String(n%60).padStart(2,'0')+(h<12?' AM':' PM');
}
function duration(e:Entry){
 if(e.notWorked)return 0;
 const start=parseTime(e.start,'start'),finish=parseTime(e.finish,'finish');
 if(start===null||finish===null)return 0;
 return Math.max(0,((finish<start?finish+1440:finish)-start)/60);
}
const blank=():Entry=>({start:'',finish:'',breakMinutes:''});
export default function HoursPage(){
 const [week,setWeek]=useState(()=>iso(weekOf(new Date())));
 const [records,setRecords]=useState<Records>({});
 const [ready,setReady]=useState(false);
 const [message,setMessage]=useState('');
 const dirty=useRef(false);
 useEffect(()=>{
  const load=()=>{try{const value=JSON.parse(localStorage.getItem('dj_timesheets')||'{}');setRecords(value&&typeof value==='object'&&!Array.isArray(value)?value:{})}catch{}};
  load();setReady(true);
  const onCloud=(event:Event)=>{if((event as CustomEvent<string>).detail==='dj_timesheets')load()};
  const onStorage=(event:StorageEvent)=>{if(event.key==='dj_timesheets')load()};
  window.addEventListener('dj-cloud-received',onCloud);
  window.addEventListener('storage',onStorage);
  return ()=>{window.removeEventListener('dj-cloud-received',onCloud);window.removeEventListener('storage',onStorage)};
 },[]);
 useEffect(()=>{
  if(!ready||!dirty.current)return;
  const timeout=window.setTimeout(()=>{try{localStorage.setItem('dj_timesheets',JSON.stringify(records));dirty.current=false;setMessage('Saved automatically')}catch{setMessage('Could not save hours')}},500);
  return ()=>window.clearTimeout(timeout);
 },[records,ready]);
 const monday=weekOf(new Date(week+'T12:00:00'));
 const dates=weekdays.map((_,i)=>iso(offset(monday,i)));
 const entries=dates.map(date=>records[date]||blank());
 const daily=entries.map(duration);
 const weekly=daily.reduce((a,b)=>a+b,0);
 const today=duration(records[iso(new Date())]||blank());
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
 const panel:React.CSSProperties={background:'#fff',border:'1px solid #e2eae5',borderRadius:16,padding:22,boxShadow:'0 5px 25px #193f2010'};
 const field:React.CSSProperties={border:'1px solid #d8e4da',padding:'10px',borderRadius:9,background:'#fff',color:'#173d29',width:'100%',boxSizing:'border-box'};
 return <main className="dj-desktop" style={{display:"flex",alignItems:"stretch",minHeight:"100vh",width:"100%"}}><DesktopSidebar active="hours"/><div style={{flex:"1 1 0%",minWidth:0,minHeight:"100vh",background:"#f4f7f5",padding:"28px 18px",boxSizing:"border-box"}}><div style={{maxWidth:1200,margin:'0 auto',color:'#123a26'}}><h1 style={{fontWeight:850,fontSize:34,margin:'4px 0 5px'}}>My Working Hours</h1><p style={{margin:'0 0 25px',color:'#67796d'}}>Track your time manually and total your hours automatically.</p><section style={panel}><div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}><div style={{display:'flex',alignItems:'center',gap:12}}><strong>▦ &nbsp; Week of:</strong><input aria-label="Week of" type="date" value={week} onChange={e=>{if(e.target.value)setWeek(iso(weekOf(new Date(e.target.value+'T12:00:00'))))}} style={{...field,width:168}}/></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button type="button" aria-label="Previous week" style={{...field,width:'auto',minWidth:95,cursor:'pointer'}} onClick={()=>setWeek(iso(offset(monday,-7)))}>‹ Prev</button><button type="button" style={{...field,width:'auto',cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>setWeek(iso(weekOf(new Date())))}>This Week</button><button type="button" aria-label="Next week" style={{...field,width:'auto',minWidth:95,cursor:'pointer'}} onClick={()=>setWeek(iso(offset(monday,7)))}>Next ›</button><button type="button" onClick={exportPDF} style={{...field,width:'auto',background:'#17613d',color:'#fff',borderColor:'#17613d',fontWeight:750,cursor:'pointer',whiteSpace:'nowrap'}}>↓ Download PDF</button></div></div><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:750,borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:'#f0f4f1'}}>{['Day','Date','Start','Finish','N/A','Total Hours'].map(s=><th key={s} style={{textAlign:'left',padding:12}}>{s}</th>)}</tr></thead><tbody>{weekdays.map((day,i)=><tr key={dates[i]} style={{borderBottom:'1px solid #e9efeb'}}><td style={{padding:9,fontWeight:700}}>{day}</td><td style={{padding:9}}>{offset(monday,i).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'})}</td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' start'} disabled={!!entries[i].notWorked} value={entries[i].start} onChange={e=>change(dates[i],'start',e.target.value)} onBlur={()=>normalize(dates[i],'start')} style={field}/></td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' finish'} disabled={!!entries[i].notWorked} value={entries[i].finish} onChange={e=>change(dates[i],'finish',e.target.value)} onBlur={()=>normalize(dates[i],'finish')} style={field}/></td><td style={{padding:8,textAlign:'center'}}><input type="checkbox" aria-label={day+' not worked'} checked={!!entries[i].notWorked} onChange={e=>toggleNA(dates[i],e.target.checked)} style={{width:18,height:18,accentColor:'#17613d',cursor:'pointer'}}/></td><td style={{padding:8}}><div style={{textAlign:'center',padding:11,background:'#edf5ee',borderRadius:9,fontWeight:800,color:'#145738',whiteSpace:'nowrap'}}>{entries[i].notWorked?'N/A':daily[i].toFixed(2)+' hrs'}</div></td></tr>)}</tbody><tfoot><tr style={{background:'#f0f6f2'}}><td colSpan={5} style={{textAlign:'right',padding:18,fontWeight:800}}>Weekly Total</td><td style={{padding:8}}><div style={{padding:12,background:'#17613d',color:'#fff',borderRadius:9,textAlign:'center',fontWeight:800}}>{weekly.toFixed(2)} hrs</div></td></tr></tfoot></table></div></section><div style={{display:'grid',gridTemplateColumns:'1fr',gap:16,marginTop:18}}><section style={panel}><h2 style={{fontSize:19,margin:'0 0 18px'}}>Time Summary</h2><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9}}>{[['Today',today.toFixed(2)+' hrs'],['This Week',weekly.toFixed(2)+' hrs'],['Entries',days+' days']].map(([label,value])=><div key={label} style={{background:'#f1f7f2',padding:12,borderRadius:10,display:'grid',gap:10}}><span style={{fontSize:12}}>{label}</span><strong style={{fontSize:19}}>{value}</strong></div>)}</div>{message&&<p role="status" style={{fontSize:12,color:'#247447',marginTop:10}}>{message}</p>}</section></div></div></div></main>;
}