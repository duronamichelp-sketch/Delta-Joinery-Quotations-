'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
const KEYS=['dj_units','dj_hardware','dj_labour','dj_electrics','dj_finishes','dj_door_rates','dj_quote','dj_saved_quotes','dj_quotation_tasks'];
type Profile={id:string;email?:string};
export default function CloudSync(){
 const [client,setClient]=useState<SupabaseClient|null>(null),[person,setPerson]=useState<Profile|null>(null),[open,setOpen]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState('');
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
    let changed=false;
    for(const k of KEYS){
     if(remote.has(k)){
      const incoming=JSON.stringify(remote.get(k));
      if(localStorage.getItem(k)!==incoming){localStorage.setItem(k,incoming);changed=true}
     }else{
      const local=localStorage.getItem(k);
      if(local!==null){try{await supabase.from('joinery_data').upsert({user_id:userId,data_key:k,payload:JSON.parse(local)},{onConflict:'user_id,data_key'})}catch{}}
     }
    }
    setMessage('Cloud sync connected');
    if(changed)window.location.reload();
   }catch(e){setMessage('Could not load cloud data: '+(e instanceof Error?e.message:'Unknown error'))}
   finally{pause.current=false}
  };
  supabase.auth.getUser().then(({data})=>{const u=data.user;if(u){setUser({id:u.id,email:u.email});void pull(u.id)}});
  const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{const u=session?.user;if(event==='SIGNED_IN'&&u){if(personRef.current?.id!==u.id){setUser({id:u.id,email:u.email});setTimeout(()=>void pull(u.id),0)}}else if(event==='SIGNED_OUT')setUser(null)});
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
 return <div className="dj-cloud-widget">
  <button type="button" className="dj-cloud-button" onClick={()=>setOpen(v=>!v)}>{person?'☁ Cloud connected':'☁ Cloud sign in'}</button>
  {open&&<div className="dj-cloud-panel"><strong>Delta Joinery Cloud</strong>{person?<><p>Signed in as {person.email||'team member'}</p><p>{message}</p><button onClick={async()=>{await client?.auth.signOut();setOpen(false)}}>Sign out</button></>:<><p>Sign in to save quotations and price lists across your devices.</p><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Password (min. 6 characters)" value={password} onChange={e=>setPassword(e.target.value)}/><div className="dj-cloud-actions"><button onClick={()=>void login(false)}>Sign in</button><button onClick={()=>void login(true)}>Create account</button></div><p>{message}</p></>}</div>}
 </div>
}