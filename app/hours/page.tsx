'use client';
import {useEffect,useState} from 'react';
import DesktopSidebar from '../DesktopSidebar';
type Entry={start:string;finish:string;breakMinutes:string};
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
 useEffect(()=>{try{setRecords(JSON.parse(localStorage.getItem('dj_timesheets')||'{}'))}catch{}setReady(true)},[]);
 const monday=weekOf(new Date(week+'T12:00:00'));
 const dates=weekdays.map((_,i)=>iso(offset(monday,i)));
 const entries=dates.map(date=>records[date]||blank());
 const daily=entries.map(duration);
 const weekly=daily.reduce((a,b)=>a+b,0);
 const today=duration(records[iso(new Date())]||blank());
 const days=entries.filter(x=>x.start&&x.finish).length;
 function change(date:string,field:keyof Entry,value:string){setRecords(old=>({...old,[date]:{...(old[date]||blank()),[field]:value}}));setMessage('Unsaved changes')}
 function normalize(date:string,field:'start'|'finish'){const raw=records[date]?.[field];if(raw)change(date,field,formatTime(raw,field))}
 function save(){try{localStorage.setItem('dj_timesheets',JSON.stringify(records));setMessage('Hours saved')}catch{setMessage('Unable to save hours')}}
 function exportTimesheet(){const lines=['Day,Date,Start,Finish,Total Hours'];weekdays.forEach((day,i)=>lines.push([day,dates[i],entries[i].start,entries[i].finish,daily[i].toFixed(2)].join(',')));lines.push('Weekly Total,,,,'+weekly.toFixed(2));const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv'}));const link=document.createElement('a');link.href=url;link.download='Delta-Joinery-Hours-'+week+'.csv';link.click();URL.revokeObjectURL(url)}
 const panel:React.CSSProperties={background:'#fff',border:'1px solid #e2eae5',borderRadius:16,padding:22,boxShadow:'0 5px 25px #193f2010'};
 const field:React.CSSProperties={border:'1px solid #d8e4da',padding:'10px',borderRadius:9,background:'#fff',color:'#173d29',width:'100%',boxSizing:'border-box'};
 return <main className="dj-desktop" style={{display:"flex",alignItems:"stretch",minHeight:"100vh",width:"100%"}}><DesktopSidebar active="hours"/><div style={{flex:"1 1 0%",minWidth:0,minHeight:"100vh",background:"#f4f7f5",padding:"28px 18px",boxSizing:"border-box"}}><div style={{maxWidth:1200,margin:'0 auto',color:'#123a26'}}><h1 style={{fontWeight:850,fontSize:34,margin:'4px 0 5px'}}>My Working Hours</h1><p style={{margin:'0 0 25px',color:'#67796d'}}>Track your time manually and total your hours automatically.</p><section style={panel}><div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:20}}><div style={{display:'flex',alignItems:'center',gap:12}}><strong>▦ &nbsp; Week of:</strong><input aria-label="Week of" type="date" value={week} onChange={e=>{if(e.target.value)setWeek(iso(weekOf(new Date(e.target.value+'T12:00:00'))))}} style={{...field,width:168}}/></div><div style={{display:'flex',gap:7}}><button type="button" style={field} onClick={()=>setWeek(iso(offset(monday,-7)))}>‹</button><button type="button" style={{...field,width:110}} onClick={()=>setWeek(iso(weekOf(new Date())))}>This Week</button><button type="button" style={field} onClick={()=>setWeek(iso(offset(monday,7)))}>›</button></div></div><div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:650,borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:'#f0f4f1'}}>{['Day','Date','Start','Finish','Total Hours'].map(s=><th key={s} style={{textAlign:'left',padding:12}}>{s}</th>)}</tr></thead><tbody>{weekdays.map((day,i)=><tr key={dates[i]} style={{borderBottom:'1px solid #e9efeb'}}><td style={{padding:9,fontWeight:700}}>{day}</td><td style={{padding:9}}>{offset(monday,i).toLocaleDateString('en-IE',{day:'numeric',month:'short',year:'numeric'})}</td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' start'} value={entries[i].start} onChange={e=>change(dates[i],'start',e.target.value)} onBlur={()=>normalize(dates[i],'start')} style={field}/></td><td style={{padding:8}}><input type="text" inputMode="numeric" placeholder="HH:MM" aria-label={day+' finish'} value={entries[i].finish} onChange={e=>change(dates[i],'finish',e.target.value)} onBlur={()=>normalize(dates[i],'finish')} style={field}/></td><td style={{padding:8}}><div style={{textAlign:'center',padding:11,background:'#edf5ee',borderRadius:9,fontWeight:800,color:'#145738',whiteSpace:'nowrap'}}>{daily[i].toFixed(2)} hrs</div></td></tr>)}</tbody><tfoot><tr style={{background:'#f0f6f2'}}><td colSpan={4} style={{textAlign:'right',padding:18,fontWeight:800}}>Weekly Total</td><td style={{padding:8}}><div style={{padding:12,background:'#17613d',color:'#fff',borderRadius:9,textAlign:'center',fontWeight:800}}>{weekly.toFixed(2)} hrs</div></td></tr></tfoot></table></div></section><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',gap:16,marginTop:18}}><section style={panel}><h2 style={{fontSize:19,margin:'0 0 18px'}}>Time Summary</h2><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9}}>{[['Today',today.toFixed(2)+' hrs'],['This Week',weekly.toFixed(2)+' hrs'],['Entries',days+' days']].map(([label,value])=><div key={label} style={{background:'#f1f7f2',padding:12,borderRadius:10,display:'grid',gap:10}}><span style={{fontSize:12}}>{label}</span><strong style={{fontSize:19}}>{value}</strong></div>)}</div></section><section style={panel}><h2 style={{fontSize:19,margin:'0 0 18px'}}>Actions</h2><button disabled={!ready} onClick={save} style={{display:'block',width:'100%',background:'#17613d',color:'#fff',border:0,borderRadius:9,padding:13,fontWeight:800,cursor:'pointer'}}>Save Hours</button><button onClick={exportTimesheet} style={{display:'block',marginTop:8,width:'100%',background:'#fff',border:'1px solid #d6e6da',borderRadius:9,padding:12,fontWeight:700,cursor:'pointer'}}>Export Timesheet</button>{message&&<p role="status" style={{color:'#17613d',fontSize:12}}>{message}</p>}</section></div></div></div></main>;
}