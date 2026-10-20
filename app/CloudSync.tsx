'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
const KEYS=['dj_units','dj_hardware','dj_labour','dj_electrics','dj_finishes','dj_door_rates','dj_quote','dj_saved_quotes','dj_quotation_tasks'];
type Profile={id:string;email?:string};
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
    const {data,error}=await supabase.from('joinery_data').select('data_key,payload').eq('user_id',userId);
    if(error)throw error;
    const remote=new Map((data||[]).map(x=>[x.data_key,x.payload]));
    for(const k of KEYS){
     if(remote.has(k)){
      const incoming=JSON.stringify(remote.get(k));
      if(localStorage.getItem(k)!==incoming){localStorage.setItem(k,incoming)}
     }else{
      const local=localStorage.getItem(k);
      if(local!==null){try{await supabase.from('joinery_data').upsert({user_id:userId,data_key:k,payload:JSON.parse(local)},{onConflict:'user_id,data_key'})}catch{}}
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
    const val=localStorage.getItem(k);if(val===null)return;
    try{const {error}=await sb.from('joinery_data').upsert({user_id:user.id,data_key:k,payload:JSON.parse(val)},{onConflict:'user_id,data_key'});if(error)throw error;setMessage('Saved to Supabase')}catch(e){setMessage('Cloud save failed: '+(e instanceof Error?e.message:'Unknown error'))}
   },950);
  };
  window.addEventListener('dj-cloud-change',save);
  return ()=>{listener.subscription.unsubscribe();Storage.prototype.setItem=original;window.removeEventListener('dj-cloud-change',save);Object.values(pending.current).forEach(clearTimeout)};
 },[]);
 async function login(create:boolean){
  if(!client)return;
  if(!email.trim()||password.length<6){setMessage('Enter an email and a password of at least 6 characters');return}
  setMessage('Connecting...');
  const res=create?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
  if(res.error){setMessage(res.error.message);return}
  setMessage(create&&!res.data.session?'Check your email to confirm your account.':'Signed in successfully');
  if(res.data.session)setOpen(false);
 }
 return <>{person? <>{children}<button type="button" className="dj-account-link" onClick={()=>setOpen(v=>!v)}>Account · {person.email||'Signed in'}</button>{open&&<div className="dj-cloud-panel dj-account-panel"><strong>Delta Joinery account</strong><p>{person.email}</p><p>{message}</p><button onClick={async()=>{await client?.auth.signOut()}}>Sign out</button></div>}</>:<main className="dj-auth-screen"><div className="dj-auth-card"><div className="dj-auth-symbol">DJ</div><p className="dj-auth-eyebrow">DELTA JOINERY</p><h1>Quotation Workspace</h1><p>Sign in with your business email to access your quotations, prices and saved jobs on any device.</p>{checking?<p>Checking your account...</p>:<><form onSubmit={e=>{e.preventDefault();void login(false)}}><label>Business email<input type="email" required autoComplete="email" placeholder="you@yourbusiness.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" required minLength={6} autoComplete="current-password" placeholder="Enter password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="submit">Sign in</button></form><button type="button" className="dj-auth-register" onClick={()=>void login(true)}>First time here? Create account</button><p role="status" className="dj-auth-message">{message}</p></>}</div></main>}</>;
}