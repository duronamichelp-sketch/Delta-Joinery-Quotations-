import {entryTimerState,formatElapsed,parseTime,type TimeEntry} from '../lib/workingHours';

export default function LiveHoursLabel({entry,date,now,hours}:{entry:TimeEntry|undefined;date:string;now:Date;hours:number}){
 const state=entryTimerState(entry,date,now);
 if(!state)return null;
 const start=parseTime(entry?.start||'','start')!;
 const hour=Math.floor(start/60);
 const startsAt=(hour%12||12)+':'+String(start%60).padStart(2,'0')+(hour<12?' AM':' PM');
 return <span role={state==='running'?'timer':undefined} aria-live="off" style={{display:'block',marginTop:4,fontSize:11,lineHeight:1.4,fontWeight:600,color:'#17613d',fontVariantNumeric:'tabular-nums'}}>{state==='running'?'Live · '+formatElapsed(hours):'Starts at '+startsAt}</span>;
}
