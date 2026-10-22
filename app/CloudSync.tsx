'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
const KEYS=['dj_units','dj_hardware','dj_labour','dj_electrics','dj_finishes','dj_door_rates','dj_quote','dj_saved_quotes','dj_quotation_tasks','dj_timesheets','dj_tool_addresses','dj_cutting_projects','dj_worktop_rates','dj_timber_rates','dj_fillers'];
type Profile={id:string;email?:string};
export const DeltaAccountContext=createContext<{email:string;message:string;signOut:()=>void;loadHours:()=>Promise<Record<string,unknown>|null>;saveHours:(hours:Record<string,unknown>)=>Promise<void>;saveTool:(key:'dj_tool_addresses'|'dj_cutting_projects',payload:unknown)=>Promise<void>}|null>(null);
export const useDeltaAccount=()=>useContext(DeltaAccountContext);
export default function CloudSync({children}:{children:React.ReactNode}){
 const [checking,setChecking]=useState(true);const [client,setClient]=useState<SupabaseClient|null>(null),[person,setPerson]=useState<Profile|null>(null),[open,setOpen]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('');
 const personRef=useRef<Profile|null>(null),clientRef=useRef<SupabaseClient|null>(null),pause=useRef(false),pending=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 useEffect(()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key){setMessage('Cloud connection is not configured');return}
  const supabase=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
  clientRef.current=supabase;setClient(supabase);
  const setUser=(p:Profile|null)=>{personRef.current=p;setPerson(p)};
  const pull=async(userId:string)=>{
   pause.current=true;
   try{
    // Migrate cutting lists saved with older, per-project local keys.
    try{
     const oldNames=JSON.parse(localStorage.getItem('dj_cutting_list_names')||'[]') as string[];
     const current=JSON.parse(localStorage.getItem('dj_cutting_projects')||'{}') as Record<string,unknown>;
     let changed=false;
     for(const name of oldNames){if(typeof name!=='string'||current[name])continue;const raw=localStorage.getItem('dj_cutting_list_'+name);if(raw){current[name]=JSON.parse(raw);changed=true}}
     if(changed)localStorage.setItem('dj_cutting_projects',JSON.stringify(current));
    }catch{}
    const {data,error}=await supabase.from('joinery_data').select('data_key,payload').eq('user_id',userId);
    if(error)throw error;
    const remote=new Map((data||[]).map(x=>[x.data_key,x.payload]));
    for(const k of KEYS){
     if(remote.has(k)){
      let payload=remote.get(k);
      // A previously offline desktop may hold addresses that never reached the cloud.
      // Merge by stable ID before displaying the cloud data, without losing either copy.
      if(k==='dj_tool_addresses'){
       const localText=localStorage.getItem(k);
       const localValue=localText?JSON.parse(localText):[];
       const cloudValue=Array.isArray(payload)?payload:[];
       if(Array.isArray(localValue)&&localValue.length){
        const merged=new Map<string,unknown>();
        for(const x of cloudValue){if(x&&typeof x==='object'&&typeof x.id==='string')merged.set(x.id,x)}
        for(const x of localValue){if(x&&typeof x==='object'&&typeof x.id==='string'&&!merged.has(x.id))merged.set(x.id,x)}
        if(merged.size>cloudValue.length){
         payload=Array.from(merged.values());
         const {error:mergeError}=await supabase.from('joinery_data').upsert({user_id:userId,data_key:k,payload},{onConflict:'user_id,data_key'});
         if(mergeError)throw mergeError;
        }
       }
      }
      const incoming=JSON.stringify(payload);
      if(localStorage.getItem(k)!==incoming){localStorage.setItem(k,incoming);window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:k}))}
     }else{
      const local=localStorage.getItem(k);
      if(local!==null){const {error:uploadError}=await supabase.from('joinery_data').upsert({user_id:userId,data_key:k,payload:JSON.parse(local)},{onConflict:'user_id,data_key'});if(uploadError)throw uploadError}
     }
    }
    setMessage('Cloud sync connected');
   }catch(e){setMessage('Could not load cloud data: '+(e instanceof Error?e.message:'Unknown error'))}
   finally{pause.current=false}
  };
  // Hydrate local storage before rendering quote pages; never reload on sync.
  let initialised=false;
  const activate=async(u:{id:string;email?:string})=>{
   if(personRef.current?.id===u.id)return;
   await pull(u.id);
   setUser({id:u.id,email:u.email});
  };
  supabase.auth.getUser().then(async({data})=>{
   if(data.user)await activate(data.user);
  }).catch(e=>setMessage('Sign-in check failed: '+String(e))).finally(()=>{initialised=true;setChecking(false)});
  const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
   const u=session?.user;
   if(event==='SIGNED_IN'&&u&&initialised){void activate(u)}
   else if(event==='SIGNED_OUT'){setUser(null);for(const k of KEYS)localStorage.removeItem(k)}
  });
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k:string,v:string){original.call(this,k,v);if(this===localStorage&&KEYS.includes(k))window.dispatchEvent(new CustomEvent('dj-cloud-change',{detail:k}))};
  const save=(event:Event)=>{
   const k=(event as CustomEvent<string>).detail;const user=personRef.current,sb=clientRef.current;
   if(!user||!sb||pause.current)return;
   if(pending.current[k])clearTimeout(pending.current[k]);
   pending.current[k]=setTimeout(async()=>{
    const val=localStorage.getItem(k);
    if(val===null){delete pending.current[k];return}
    try{const {error}=await sb.from('joinery_data').upsert({user_id:user.id,data_key:k,payload:JSON.parse(val)},{onConflict:'user_id,data_key'});if(error)throw error;setMessage('Saved to Supabase')}catch(e){setMessage('Cloud save failed: '+(e instanceof Error?e.message:'Unknown error'))}
    finally{delete pending.current[k]}
   },950);
  };
  // Receive timesheet updates from other devices signed in to this account.
  const timesheetChannel=supabase.channel('dj-timesheets-sync').on('postgres_changes',{
   event:'*',schema:'public',table:'joinery_data',filter:'data_key=eq.dj_timesheets'
  },payload=>{
   const row=payload.new as {user_id?:string;data_key?:string;payload?:unknown};
   if(!personRef.current||row.user_id!==personRef.current.id||row.data_key!=='dj_timesheets')return;
   const received=JSON.stringify(row.payload??{});
   if(localStorage.getItem('dj_timesheets')===received)return;
   pause.current=true;
   localStorage.setItem('dj_timesheets',received);
   pause.current=false;
   window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:'dj_timesheets'}));
  }).subscribe();
  // Keep addresses and cutting lists in sync across signed-in devices.
  const toolsKeys=['dj_tool_addresses','dj_cutting_projects'];
  const toolChannel=supabase.channel('dj-tools-sync').on('postgres_changes',{
   event:'*',schema:'public',table:'joinery_data'
  },payload=>{
   const row=payload.new as {user_id?:string;data_key?:string;payload?:unknown};
   if(!personRef.current||row.user_id!==personRef.current.id||!row.data_key||!toolsKeys.includes(row.data_key)||pending.current[row.data_key])return;
   const received=JSON.stringify(row.payload??(row.data_key==='dj_tool_addresses'?[]:{}));
   if(localStorage.getItem(row.data_key)===received)return;
   pause.current=true;
   try{localStorage.setItem(row.data_key,received)}finally{pause.current=false}
   window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:row.data_key}));
  }).subscribe();
  let refreshingTools=false;
  const refreshTools=async()=>{
   const user=personRef.current;
   if(!user||refreshingTools||pause.current)return;
   refreshingTools=true;
   try{
    const {data,error}=await supabase.from('joinery_data').select('data_key,payload').eq('user_id',user.id).in('data_key',toolsKeys);
    if(error)throw error;
    for(const row of data||[]){
     if(pending.current[row.data_key])continue;
     const incoming=JSON.stringify(row.payload);
     if(incoming===localStorage.getItem(row.data_key))continue;
     pause.current=true;
     try{localStorage.setItem(row.data_key,incoming)}finally{pause.current=false}
     window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:row.data_key}));
    }
   }catch(e){setMessage('Tools sync unavailable: '+(e instanceof Error?e.message:'Unknown error'))}
   finally{refreshingTools=false}
  };
  // Fetch fresh hours when switching devices, reopening the app or returning to its tab.
  // This also works when database realtime publication is not enabled.
  let refreshing=false;
  const refreshTimesheets=async()=>{
   const user=personRef.current;
   if(!user||refreshing||pause.current||pending.current['dj_timesheets'])return;
   refreshing=true;
   try{
    const {data,error}=await supabase.from('joinery_data').select('payload').eq('user_id',user.id).eq('data_key','dj_timesheets').maybeSingle();
    if(error)throw error;
    if(data&&data.payload&&typeof data.payload==='object'){
     const incoming=JSON.stringify(data.payload);
     if(incoming!==localStorage.getItem('dj_timesheets')){
      pause.current=true;
      try{localStorage.setItem('dj_timesheets',incoming)}finally{pause.current=false}
      window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:'dj_timesheets'}));
     }
    }
   }catch(e){setMessage('Hours sync unavailable: '+(e instanceof Error?e.message:'Unknown error'))}
   finally{refreshing=false}
  };
  const onReturn=()=>{if(document.visibilityState==='visible'){void refreshTimesheets();void refreshTools()}};
  window.addEventListener('focus',onReturn);
  document.addEventListener('visibilitychange',onReturn);
  const refreshTimer=window.setInterval(()=>{if(document.visibilityState==='visible'){void refreshTimesheets();void refreshTools()}},15000);
  window.addEventListener('dj-cloud-change',save);
  return ()=>{listener.subscription.unsubscribe();void supabase.removeChannel(timesheetChannel);void supabase.removeChannel(toolChannel);Storage.prototype.setItem=original;window.removeEventListener('dj-cloud-change',save);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);window.clearInterval(refreshTimer);Object.values(pending.current).forEach(clearTimeout)};
 },[]);
 async function loadHours():Promise<Record<string,unknown>|null>{
  const sb=clientRef.current,user=personRef.current;if(!sb||!user)throw new Error('Cloud account not ready');
  const {data,error}=await sb.from('joinery_data').select('payload').eq('user_id',user.id).eq('data_key','dj_timesheets').maybeSingle();
  if(error)throw error;
  const payload=data?.payload;
  return payload&&typeof payload==='object'&&!Array.isArray(payload)?payload as Record<string,unknown>:null;
 }
 async function saveHours(hours:Record<string,unknown>){
  const sb=clientRef.current,user=personRef.current;if(!sb||!user)throw new Error('Cloud account not ready');
  const {error}=await sb.from('joinery_data').upsert({user_id:user.id,data_key:'dj_timesheets',payload:hours},{onConflict:'user_id,data_key'});
  if(error)throw error;
  pause.current=true;
  try{localStorage.setItem('dj_timesheets',JSON.stringify(hours))}finally{pause.current=false}
 }
 async function saveTool(key:'dj_tool_addresses'|'dj_cutting_projects',payload:unknown){
  const sb=clientRef.current,user=personRef.current;
  if(!sb||!user)throw new Error('Cloud account not ready');
  const {data,error}=await sb.from('joinery_data').upsert({user_id:user.id,data_key:key,payload},{onConflict:'user_id,data_key'}).select('data_key,payload').single();
  if(error||!data){const reason=error?.message||'Cloud did not confirm the save';setMessage('Cloud save failed: '+reason);throw new Error(reason)}
  if(JSON.stringify(data.payload)!==JSON.stringify(payload))throw new Error('Cloud returned different data');
  pause.current=true;
  try{localStorage.setItem(key,JSON.stringify(payload))}finally{pause.current=false}
  window.dispatchEvent(new CustomEvent('dj-cloud-received',{detail:key}));
  setMessage('Saved to cloud');
 }
 async function login(create:boolean){
  if(!client)return;
  if(!email.trim()||password.length<6){setMessage('Enter an email and a password of at least 6 characters');return}
  setMessage('Connecting...');
  const res=create?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
  if(res.error){setMessage(res.error.message);return}
  setMessage(create&&!res.data.session?'Check your email to confirm your account.':'Signed in successfully');
  if(res.data.session)setOpen(false);
 }
 return <>{person? <DeltaAccountContext.Provider value={{email:person.email||'Signed in',message,signOut:()=>{void client?.auth.signOut()},loadHours,saveHours,saveTool}}>{children}</DeltaAccountContext.Provider>:<main className="dj-auth-screen"><div className="dj-auth-card"><div className="dj-auth-symbol">DJ</div><p className="dj-auth-eyebrow">DELTA JOINERY</p><h1>Quotation Workspace</h1><p>Sign in with your business email to access your quotations, prices and saved jobs on any device.</p>{checking?<p>Checking your account...</p>:<><form onSubmit={e=>{e.preventDefault();void login(false)}}><label>Business email<input type="email" required autoComplete="email" placeholder="you@yourbusiness.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required minLength={6} autoComplete="current-password" placeholder="Enter password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit">Sign in</button></form><button type="button" className="dj-auth-register" onClick={()=>void login(true)}>First time here? Create account</button><p role="status" className="dj-auth-message">{message}</p></>}</div></main>}</>;
}