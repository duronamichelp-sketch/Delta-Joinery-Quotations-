'use client';
import {useEffect,useRef,useState,type FormEvent,type DragEvent} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../../DesktopSidebar';
import {useDeltaAccount} from '../../CloudSync';
import {
 MATERIALS_KEY,NO_SHOP,UNITS,createCollection,shopIds,normalizedStopOrder,
 moveBefore,moveBy,moveItemWithinShop,kmBetween,validKm,distanceForStop,farthestFirst,
 addressForStop,itemDescription,
 type MaterialKind,type MaterialItem,type MaterialCollection,type SavedAddress,
 type Coordinates,type CachedLocation
} from '../../../lib/materialCollections';
import './material-list.css';
import {sheetNameGroups,sheetNameOptions,filterSheetGroups} from '../../../lib/sheetFinishOptions';

type Draft={
 id?:string;kind:MaterialKind;name:string;quantity:string;unit:string;shopId:string;
 length:string;height:string;width:string;thickness:string;rollLength:string;notes:string;customSheetName:boolean;
};
const defaultUnit=(kind:MaterialKind)=>kind==='sheet'?'sheets':kind==='timber'?'lengths':kind==='edging'?'rolls':kind==='product'?'boxes':'pcs';
const blank=(kind:MaterialKind='sheet',shopId=''):Draft=>({kind,name:'',quantity:'1',unit:defaultUnit(kind),shopId,length:'',height:'',width:'',thickness:'',rollLength:'',notes:'',customSheetName:false});
const kindLabel:Record<MaterialKind,string>={sheet:'Sheets',timber:'Timber',edging:'Edging',product:'Products',general:'Products'};
const kindOptions:MaterialKind[]=['sheet','timber','edging','product'];
const unitLabels:Record<string,string>={pcs:'Pieces',boxes:'Boxes',packs:'Packs',sets:'Sets',bottles:'Bottles',tubes:'Tubes',tubs:'Tubs',rolls:'Rolls',bags:'Bags',sheets:'Sheets',lengths:'Lengths',metres:'Metres',litres:'Litres',kg:'Kilograms'};

/** Sheet material names/codes drawn from Finsa Ireland distributor catalogues.
 * These are identifiers, not a live inventory or a guarantee of availability.
 */
const customSheetValue='__custom_sheet_name__';
const sortAddresses=(all:SavedAddress[])=>[...all].sort((a,b)=>a.name.localeCompare(b.name));
let previousGeoRequest=0;
const lookupEircode=async(address:SavedAddress,cache:Record<string,CachedLocation>):Promise<Coordinates|null>=>{
 const code=address.eircode.trim().toUpperCase();
 if(!code)return null;
 const remembered=cache[address.id];
 if(remembered&&remembered.eircode===code)return {lat:remembered.lat,lng:remembered.lng};
 const delay=Math.max(0,1250-(Date.now()-previousGeoRequest));
 if(delay)await new Promise<void>(resolve=>setTimeout(resolve,delay));
 previousGeoRequest=Date.now();
 try{
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ie&q='+encodeURIComponent(code+', Ireland');
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  if(!response.ok)return null;
  const result=await response.json() as {lat:string;lon:string}[];
  if(!Array.isArray(result)||!result[0])return null;
  const lat=Number(result[0].lat),lng=Number(result[0].lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<51||lat>56||lng< -11||lng> -5)return null;
  cache[address.id]={lat,lng,eircode:code};
  return {lat,lng};
 }catch{return null}
};
const deviceCoordinates=():Promise<Coordinates>=>new Promise((resolve,reject)=>{
 if(!navigator.geolocation){reject(new Error('Location is not supported by this device'));return}
 navigator.geolocation.getCurrentPosition(
  p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
  e=>reject(new Error(e.message||'Location permission was not granted')),
  {enableHighAccuracy:false,timeout:12000,maximumAge:60000}
 );
});
const formatWhen=(date:string)=>{try{return new Date(date).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'numeric'})}catch{return date}};
const safeFilename=(text:string)=>text.replace(/[^a-z0-9-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase().slice(0,60);

export default function MaterialList(){
 const account=useDeltaAccount();
 const [collections,setCollections]=useState<MaterialCollection[]>([]);
 const listRef=useRef<MaterialCollection[]>([]);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [addresses,setAddresses]=useState<SavedAddress[]>([]);
 const [newTitle,setNewTitle]=useState('');
 const [newOpen,setNewOpen]=useState(false);
 const [draft,setDraft]=useState<Draft>(()=>blank());
 const [sheetSearch,setSheetSearch]=useState('');
 const [notice,setNotice]=useState('');
 const [sorting,setSorting]=useState(false);
 const draggedStop=useRef<string|null>(null);
 const draggedItem=useRef<string|null>(null);
 const editorRef=useRef<HTMLDivElement|null>(null);
 const active=collections.find(c=>c.id===activeId)||null;
 const orderedAddresses=sortAddresses(addresses);
 const visibleSheetGroups=filterSheetGroups(sheetSearch,draft.name);

 useEffect(()=>{
  const load=()=>{
   try{
    const stored=JSON.parse(localStorage.getItem(MATERIALS_KEY)||'[]') as MaterialCollection[];
    const safe=Array.isArray(stored)?stored:[];
    listRef.current=safe;setCollections(safe);
    setActiveId(old=>old&&safe.some(x=>x.id===old)?old:(safe[0]?.id||null));
   }catch{setNotice('Could not read your collection lists');}
  };
  const loadAddresses=()=>{
   try{
    const stored=JSON.parse(localStorage.getItem('dj_tool_addresses')||'[]') as SavedAddress[];
    setAddresses(Array.isArray(stored)?stored:[]);
   }catch{setAddresses([])}
  };
  load();loadAddresses();
  const cloud=(event:Event)=>{
   const key=(event as CustomEvent<string>).detail;
   if(key===MATERIALS_KEY)load();
   if(key==='dj_tool_addresses')loadAddresses();
  };
  const storage=(event:StorageEvent)=>{
   if(event.key===MATERIALS_KEY)load();
   if(event.key==='dj_tool_addresses')loadAddresses();
  };
  window.addEventListener('dj-cloud-received',cloud);
  window.addEventListener('storage',storage);
  return()=>{
   window.removeEventListener('dj-cloud-received',cloud);
   window.removeEventListener('storage',storage);
  };
 },[]);

 function commit(update:(previous:MaterialCollection[])=>MaterialCollection[]){
  const next=update(listRef.current);
  try{
   localStorage.setItem(MATERIALS_KEY,JSON.stringify(next));
   listRef.current=next;setCollections(next);
  }catch{
   setNotice('Unable to save this change locally. Check available browser storage.');
  }
 }
 function patch(id:string,update:(existing:MaterialCollection)=>MaterialCollection){
  commit(old=>old.map(collection=>collection.id===id?
   {...update(collection),updatedAt:new Date().toISOString()}:collection));
 }
 function create(e:FormEvent){
  e.preventDefault();
  if(!newTitle.trim())return;
  const c=createCollection(newTitle);
  commit(old=>[c,...old]);setActiveId(c.id);setDraft(blank());
  setNewTitle('');setNewOpen(false);setNotice('Collection created. Add your first material.');
 }
 function deleteCollection(){
  if(!active||!window.confirm('Delete the entire collection "'+active.title+'" and all its materials?'))return;
  const remaining=listRef.current.filter(x=>x.id!==active.id);
  commit(()=>remaining);setActiveId(remaining[0]?.id||null);setDraft(blank());setNotice('Collection deleted.');
 }
 function renameCollection(){
  if(!active)return;
  const title=window.prompt('Collection name',active.title)?.trim();
  if(!title)return;
  patch(active.id,c=>({...c,title}));
 }
 function selectCollection(id:string){
  setActiveId(id);setDraft(blank());setSheetSearch('');setNotice('');
 }
 function kindChange(kind:MaterialKind){
  setSheetSearch('');
  setDraft(prev=>({...prev,kind,unit:defaultUnit(kind),customSheetName:kind==='sheet'&&Boolean(prev.name)&&!sheetNameOptions.has(prev.name)}));
 }
 function saveItem(e:FormEvent){
  e.preventDefault();
  if(!active)return;
  const name=draft.name.trim(),quantity=Number(draft.quantity);
  if(!name||draft.quantity.trim()===''||!Number.isFinite(quantity)||quantity<=0){setNotice('Enter a name and a quantity greater than zero.');return}
  const required=draft.kind==='sheet'?[draft.height,draft.width,draft.thickness]:
   draft.kind==='timber'?[draft.thickness,draft.length]:
   draft.kind==='edging'?[draft.thickness,draft.width,draft.rollLength]:[];
  if(required.some(v=>v.trim()===''||!Number.isFinite(Number(v))||Number(v)<=0)){
   setNotice(draft.kind==='sheet'?'Sheets require height, width and thickness in mm.':
    draft.kind==='timber'?'Timber requires thickness in inches and length in feet.':
    'Edging requires thickness and width in mm plus roll length in metres.');return;
  }
  const supplier=addresses.find(a=>a.id===draft.shopId),existing=active.items.find(i=>i.id===draft.id);
  const item:MaterialItem={
   ...(existing&&existing.kind===draft.kind?existing:{}),
   id:draft.id||crypto.randomUUID(),kind:draft.kind,name,quantity,
   unit:draft.kind==='product'?(draft.unit.trim()||'pcs'):defaultUnit(draft.kind),
   shopId:draft.shopId||NO_SHOP,shopName:supplier?.name||existing?.shopName||'',
   shopEircode:supplier?.eircode||existing?.shopEircode||'',
   ...(draft.kind==='sheet'?{height:draft.height,width:draft.width,thickness:draft.thickness,thicknessUnit:'mm' as const}:{}),
   ...(draft.kind==='timber'?{length:draft.length,lengthUnit:'ft' as const,thickness:draft.thickness,thicknessUnit:'in' as const}:{}),
   ...(draft.kind==='edging'?{thickness:draft.thickness,thicknessUnit:'mm' as const,width:draft.width,rollLength:draft.rollLength,rollLengthUnit:'m' as const}:{}),
   notes:draft.notes.trim(),collected:existing?.collected||false
  };
  patch(active.id,c=>({...c,items:draft.id?c.items.map(i=>i.id===item.id?item:i):[...c.items,item]}));
  setDraft(blank(draft.kind,draft.shopId));setSheetSearch('');
  setNotice(draft.id?'Material updated.':'Material added to the collection.');
 }
 function editItem(item:MaterialItem){
  // Older timber measurements are converted only for editing, never relabelled in saved lists.
  const oldTimber=item.kind==='timber';
  const length=oldTimber&&item.length&&item.lengthUnit==='mm'?String(Number((Number(item.length)/304.8).toFixed(4))):item.length||'';
  const thickness=oldTimber&&item.thickness&&item.thicknessUnit!=='in'?String(Number((Number(item.thickness)/25.4).toFixed(4))):item.thickness||'';
  const kind=item.kind==='general'?'product':item.kind;
  setDraft({id:item.id,kind,name:item.name,quantity:String(item.quantity),unit:item.unit||defaultUnit(kind),
   shopId:item.shopId===NO_SHOP?'':item.shopId,length,height:item.height||'',width:item.width||'',thickness,rollLength:item.rollLength||'',notes:item.notes||'',customSheetName:kind==='sheet'&&!sheetNameOptions.has(item.name)});
  setSheetSearch('');
  editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function removeItem(item:MaterialItem){
  if(!active||!window.confirm('Remove "'+item.name+'" from this collection?'))return;
  patch(active.id,c=>({...c,items:c.items.filter(x=>x.id!==item.id)}));
  if(draft.id===item.id)setDraft(blank());
 }
 function toggleItem(itemId:string,checked:boolean){
  if(!active)return;
  patch(active.id,c=>({...c,items:c.items.map(i=>i.id===itemId?{...i,collected:checked}:i)}));
 }
 function updateStopOrder(order:string[]){
  if(!active)return;
  patch(active.id,c=>({...c,stopOrder:order}));
 }
 function dropStop(event:DragEvent,onto:string){
  event.preventDefault();
  const from=draggedStop.current;draggedStop.current=null;
  if(!active||!from)return;
  updateStopOrder(moveBefore(normalizedStopOrder(active),from,onto));
 }
 function dropItem(event:DragEvent,toId:string){
  event.preventDefault();event.stopPropagation();
  const from=draggedItem.current;draggedItem.current=null;
  if(!active||!from)return;
  patch(active.id,c=>({...c,items:moveItemWithinShop(c.items,from,toId)}));
 }
 function moveItem(item:MaterialItem,direction:-1|1){
  if(!active)return;
  const shop=item.shopId||NO_SHOP;
  patch(active.id,c=>{
   const indexes=c.items.map((i,n)=>(i.shopId||NO_SHOP)===shop?n:-1).filter(n=>n>=0);
   const group=indexes.map(n=>c.items[n]);
   const newIds=moveBy(group.map(i=>i.id),item.id,direction);
   const byId=new Map(group.map(i=>[i.id,i]));
   const next=[...c.items];
   indexes.forEach((n,k)=>{next[n]=byId.get(newIds[k])!});
   return {...c,items:next};
  });
 }
 async function sortByDistance(){
  if(!active||sorting)return;
  const collectionId=active.id;
  const assigned=shopIds(active.items).filter(id=>id!==NO_SHOP);
  if(assigned.length===0){setNotice('Assign at least one supplier from Addresses first.');return}
  const hasManual=assigned.some(id=>validKm(active.manualKm?.[id])!==null);
  if(!active.originId&&!hasManual){setNotice('Choose a starting location or enter distances from your starting point.');return}
  setSorting(true);
  const geo={...(active.geoCache||{})};
  const distances:Record<string,number>={};
  let origin:Coordinates|null=null;
  let failed=0;
  try{
   if(active.originId==='__current'){
    setNotice('Requesting your device location…');
    try{origin=await deviceCoordinates()}catch(e){setNotice('Location unavailable: '+(e instanceof Error?e.message:'Permission denied')+'. Manual distances still work.')}
   }else if(active.originId){
    const startAddress=addresses.find(a=>a.id===active.originId);
    if(startAddress){
     setNotice('Looking up your starting Eircode…');
     origin=await lookupEircode(startAddress,geo);
    }
   }
   if(origin){
    for(let index=0;index<assigned.length;index++){
     const id=assigned[index];
     if(validKm(active.manualKm?.[id])!==null)continue;
     const address=addressForStop(id,active.items,addresses);
     if(!address?.eircode){failed++;continue}
     setNotice('Estimating distance for '+address.name+' ('+(index+1)+'/'+assigned.length+')…');
     const position=await lookupEircode(address,geo);
     if(position)distances[id]=Math.round(kmBetween(origin,position)*10)/10;
     else failed++;
    }
   }else if(assigned.some(id=>validKm(active.manualKm?.[id])===null)){
    failed=assigned.filter(id=>validKm(active.manualKm?.[id])===null).length;
   }
   const combined:MaterialCollection={...active,geoCache:geo,calculatedKm:distances,
    lastSortLabel:origin?'Approximate straight-line distance from selected start':'Manual distances'};
   const sorted=farthestFirst(combined);
   const known=assigned.filter(id=>distanceForStop(combined,id)!==null).length;
   if(!known){setNotice('No distances available. Enter the kilometres from your starting point beside each shop, then sort again.');return}
   patch(collectionId,c=>({...c,geoCache:geo,calculatedKm:distances,lastSortLabel:combined.lastSortLabel,stopOrder:sorted}));
   setNotice('Ordered '+known+' supplier'+(known===1?'':'s')+' furthest → nearest.'+
    (failed?' '+failed+' unresolved: add their distance (km) manually and sort again.':'')+
    ' You can drag stops or use the arrows to change the print order.');
  }finally{setSorting(false)}
 }
 const stops=active?normalizedStopOrder(active):[];
 const nCollected=active?active.items.filter(i=>i.collected).length:0;
 const totalStops=active?shopIds(active.items).filter(id=>id!==NO_SHOP).length:0;
 const startLabel=active?.originId==='__current'?'Device location':
  addresses.find(x=>x.id===active?.originId)?.name||'Not specified';
 const collectionTitle=active?.title||'';

 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-tools-page dj-ml-page">
  <DesktopSidebar active="tools"/>
  <div className="rev-phone rev-inner dj-unified-content dj-ml-wrap" style={{maxWidth:1600,width:'100%'}}>
   <header className="dj-ml-top">
    <div><p className="dj-ml-eyebrow">DELTA JOINERY / TOOLS</p><h1>Material List</h1>
     <p>Build collection lists, assign suppliers and organise pickup stops before printing.</p></div>
    <button type="button" className="dj-ml-btn dj-ml-primary" onClick={()=>setNewOpen(true)}>＋ New collection</button>
   </header>
   <div className="dj-ml-main">
    <aside className="dj-ml-panel dj-ml-collections">
     <div className="dj-ml-panel-title"><h2>Collections</h2><small className="dj-ml-muted">{collections.length} saved</small></div>
     <p className="dj-ml-panel-sub">A separate collection list for every job or supplier run. Changes save to your account.</p>
     {(newOpen||collections.length===0)&&<form className="dj-ml-create" onSubmit={create}>
      <label className="dj-ml-field">Collection name
       <input autoFocus placeholder="e.g. Friday collections / Project" value={newTitle}
        onChange={e=>setNewTitle(e.target.value)} maxLength={100} required/></label>
      <div className="dj-ml-actions"><button type="submit" className="dj-ml-btn dj-ml-primary">Create collection</button>
       {collections.length>0&&<button type="button" className="dj-ml-btn dj-ml-ghost" onClick={()=>setNewOpen(false)}>Cancel</button>}</div>
     </form>}
     <div className="dj-ml-list">{collections.map(c=><button type="button" className={activeId===c.id?'active':''}
      key={c.id} onClick={()=>selectCollection(c.id)}>
      <strong>{c.title}</strong><small>{c.items.length} items · {formatWhen(c.createdAt)}</small>
     </button>)}</div>
    </aside>
    <div className="dj-ml-stack">
     {!active?<section className="dj-ml-panel dj-ml-fallback"><h2>Start a collection list</h2>
      <p className="dj-ml-panel-sub">Create your first collection to add sheets, timber, edging and products. No example items will be inserted into your saved data.</p></section>:<>
      <section className="dj-ml-panel">
       <div className="dj-ml-heading"><div>
        <h2>{active.title}</h2><small>Created {formatWhen(active.createdAt)} · Auto-saved to Delta Joinery</small>
       </div><div className="dj-ml-actions">
        <button type="button" className="dj-ml-btn dj-ml-ghost" onClick={renameCollection}>✎ Rename</button>
        <button type="button" className="dj-ml-btn dj-ml-primary" disabled={active.items.length===0}
         onClick={()=>window.print()}>▤ Print / Save PDF</button>
        <button type="button" className="dj-ml-btn dj-ml-danger" onClick={deleteCollection}>Delete</button>
       </div></div>
       <div className="dj-ml-metrics">
        <span className="dj-ml-metric"><b>{active.items.length}</b> material{active.items.length===1?'':'s'}</span>
        <span className="dj-ml-metric"><b>{totalStops}</b> supplier stop{totalStops===1?'':'s'}</span>
        <span className="dj-ml-metric"><b>{nCollected}/{active.items.length}</b> collected</span>
       </div>
      </section>
      <div className="dj-ml-editor">
       <section className="dj-ml-panel" ref={editorRef} id="dj-ml-material-editor">
        <div className="dj-ml-panel-title"><h2>{draft.id?'Edit material':'Add material'}</h2></div>
        <p className="dj-ml-panel-sub">Choose Sheets, Timber, Edging or Products. Each has its own measurements.</p>
        <form onSubmit={saveItem}>
         <div className="dj-ml-kind">{kindOptions.map(kind=>
          <button key={kind} type="button" className={draft.kind===kind?'active':''} onClick={()=>kindChange(kind)}>{kindLabel[kind]}</button>)}</div>
         <div className="dj-ml-grid">
          <label className="dj-ml-field dj-ml-full">Name
           {draft.kind==='sheet'?<>
            <input type="search" aria-label="Search Finsa sheet finishes by name or code"
             placeholder="Search Finsa finishes (e.g. Olmo Sabi or 4AR)"
             value={sheetSearch} onChange={e=>setSheetSearch(e.target.value)}/>
            <select aria-label="Sheet material or finish" required
             value={draft.customSheetName?customSheetValue:draft.name}
             onChange={e=>{const chosen=e.target.value;setSheetSearch('');setDraft(d=>({...d,customSheetName:chosen===customSheetValue,name:chosen===customSheetValue?'':chosen}))}}>
             <option value="" disabled>Select a sheet material / finish</option>
             {visibleSheetGroups.map(group=><optgroup key={group.label} label={group.label}>
              {group.names.map(name=><option key={name} value={name}>{name}</option>)}
             </optgroup>)}
             <option value={customSheetValue}>Other / Custom name...</option>
            </select>
            <small className="dj-ml-helper">{visibleSheetGroups.reduce((n,g)=>n+g.names.length,0)} matching finishes from {sheetNameOptions.size} options. Select a finish or choose Other / Custom.</small>
            {draft.customSheetName&&<input required maxLength={160} autoFocus
             aria-label="Custom sheet material name" placeholder="Enter sheet material or finish"
             value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/>}
           </>:<input required maxLength={160}
            placeholder={draft.kind==='timber'?'e.g. American White Oak':draft.kind==='edging'?'e.g. Oak veneer edging':'e.g. Cabinet legs or wood glue'}
            value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/>}</label>
          <label className="dj-ml-field">Quantity {draft.kind==='product'?'':('('+defaultUnit(draft.kind)+')')}
           <input type="number" min=".01" step="any" required value={draft.quantity}
            onChange={e=>setDraft(d=>({...d,quantity:e.target.value}))}/></label>
          {draft.kind==='product'&&<label className="dj-ml-field">Unit
           <select value={draft.unit} onChange={e=>setDraft(d=>({...d,unit:e.target.value}))}>
            {UNITS.map(u=><option key={u} value={u}>{unitLabels[u]||u}</option>)}</select></label>}
          {draft.kind==='sheet'&&<>
           <label className="dj-ml-field">Height (mm)
            <input type="number" min=".01" step="any" required placeholder="2440" value={draft.height}
             onChange={e=>setDraft(d=>({...d,height:e.target.value}))}/></label>
           <label className="dj-ml-field">Width (mm)
            <input type="number" min=".01" step="any" required placeholder="1220" value={draft.width}
             onChange={e=>setDraft(d=>({...d,width:e.target.value}))}/></label>
           <label className="dj-ml-field">Thickness (mm)
            <input type="number" min=".01" step="any" required placeholder="18" value={draft.thickness}
             onChange={e=>setDraft(d=>({...d,thickness:e.target.value}))}/></label>
          </>}
          {draft.kind==='timber'&&<>
           <label className="dj-ml-field">Thickness (inches)
            <input type="number" min=".01" step="any" required placeholder="1" value={draft.thickness}
             onChange={e=>setDraft(d=>({...d,thickness:e.target.value}))}/></label>
           <label className="dj-ml-field">Length (feet)
            <input type="number" min=".01" step="any" required placeholder="12" value={draft.length}
             onChange={e=>setDraft(d=>({...d,length:e.target.value}))}/></label>
          </>}
          {draft.kind==='edging'&&<>
           <label className="dj-ml-field">Thickness (mm)
            <input type="number" min=".01" step="any" required placeholder="0.6" value={draft.thickness}
             onChange={e=>setDraft(d=>({...d,thickness:e.target.value}))}/></label>
           <label className="dj-ml-field">Width (mm)
            <input type="number" min=".01" step="any" required placeholder="22" value={draft.width}
             onChange={e=>setDraft(d=>({...d,width:e.target.value}))}/></label>
           <label className="dj-ml-field">Roll length (metres)
            <input type="number" min=".01" step="any" required placeholder="50" value={draft.rollLength}
             onChange={e=>setDraft(d=>({...d,rollLength:e.target.value}))}/></label>
          </>}
          <label className="dj-ml-field dj-ml-full">Collect from · saved Addresses
           <select value={draft.shopId} onChange={e=>setDraft(d=>({...d,shopId:e.target.value}))}>
            <option value="">No shop assigned yet</option>
            {orderedAddresses.map(a=><option key={a.id} value={a.id}>{a.name} — {a.eircode}</option>)}
           </select></label>
          {addresses.length===0&&<p className="dj-ml-helper dj-ml-full">
           No shops saved. <Link href="/tools/addresses" style={{color:'#9bd5ff'}}>Add a shop in Addresses</Link> to select it here.</p>}
          <label className="dj-ml-field dj-ml-full">Notes (optional)
           <textarea maxLength={450} placeholder="Finish, size, brand or collection instructions…"
            value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label>
         </div>
         <div className="dj-ml-actions" style={{marginTop:14}}>
          <button type="submit" className="dj-ml-btn dj-ml-primary">{draft.id?'Save material':'＋ Add to list'}</button>
          {draft.id&&<button type="button" className="dj-ml-btn dj-ml-ghost" onClick={()=>setDraft(blank())}>Cancel edit</button>}
         </div>
        </form>
       </section>
       <section className="dj-ml-panel">
        <div className="dj-ml-panel-title"><h2>Collection order</h2></div>
        <p className="dj-ml-panel-sub">Sort suppliers furthest from your starting point, or drag the stops into your preferred collection order. Materials at each shop stay together.</p>
        <div className="dj-ml-toolbar">
         <label className="dj-ml-field">Starting from
          <select value={active.originId||''}
           onChange={e=>patch(active.id,c=>({...c,originId:e.target.value,calculatedKm:{},lastSortLabel:undefined}))}>
           <option value="">Choose a starting location</option>
           <option value="__current">Current device location (permission required)</option>
           {orderedAddresses.map(a=><option key={a.id} value={a.id}>{a.name} — {a.eircode}</option>)}
          </select></label>
         <button type="button" className="dj-ml-btn dj-ml-primary" disabled={sorting||totalStops===0} onClick={()=>void sortByDistance()}>
          {sorting?'Checking distances…':'⇵ Furthest → nearest'}</button>
        </div>
        <p className="dj-ml-helper">Auto-sort uses approximate <b>straight-line distance</b> where an Eircode can be located, not driving distance or a guaranteed fastest route. Enter manual kilometres for any unresolved stop.</p>
        <p className="dj-ml-helper">Your saved collection order is what prints. Drag stops or use ↑ ↓ (mobile) to rearrange them at any time.</p>
        {notice&&<p role="status" className={'dj-ml-message '+(/unable|unavailable|could not|no distances|requires/i.test(notice)?'dj-ml-warning':'')}>{notice}</p>}
        <div className="dj-ml-actions" style={{marginTop:16}}>
         <Link className="dj-ml-btn dj-ml-ghost" href="/tools/addresses">⌖ Manage Addresses</Link>
        </div>
        <p className="dj-ml-brand-footer">Optional Eircode lookup: © OpenStreetMap contributors. Unresolved addresses require manual distance.</p>
       </section>
      </div>
      <div className="dj-ml-sheet">
       <header className="dj-ml-print-head"><h1>DELTA JOINERY · MATERIAL COLLECTIONS</h1>
        <p><b>{collectionTitle}</b> · {new Date().toLocaleDateString('en-IE')} · Starting point: {startLabel}</p>
        <p>{active.items.length} materials · {totalStops} supplier stops · Order: {active.lastSortLabel||'Manually arranged'}</p>
       </header>
       <div className="dj-ml-route-head dj-ml-no-print"><strong>Collection schedule · {stops.length} stops</strong>
        <span className="dj-ml-muted">Drag to reorder · Print follows this order</span></div>
       {stops.length===0?<div className="dj-ml-empty">Your collection list is empty. Add a material above to start building your route.</div>:stops.map((stopId,index)=>{
        const address=addressForStop(stopId,active.items,addresses);
        const rows=active.items.filter(i=>(i.shopId||NO_SHOP)===stopId);
        const km=distanceForStop(active,stopId);
        return <section className="dj-ml-stop" key={stopId}>
         <div className="dj-ml-stop-head" draggable={!sorting}
          onDragStart={e=>{draggedStop.current=stopId;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',stopId)}}
          onDragOver={e=>e.preventDefault()} onDrop={e=>dropStop(e,stopId)} onDragEnd={()=>{draggedStop.current=null}}>
          <div className="dj-ml-stop-title"><span className="dj-ml-number">{index+1}</span>
           <div><strong>{address?.name||'Shop not assigned'}</strong>
            <small>{address?.eircode||'Allocate a supplier to these materials'}{km!==null?' · '+km.toFixed(1)+' km from start':''} · {rows.length} item{rows.length===1?'':'s'}</small>
           </div></div>
          <div className="dj-ml-stop-actions dj-ml-no-print">
           <span className="dj-ml-grip" title="Drag to reorder supplier stops" aria-label="Drag stop">⠿</span>
           {address?.eircode&&<a className="dj-ml-mini" href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(address.eircode+', Ireland')+'&travelmode=driving'} target="_blank" rel="noopener noreferrer" title="Directions to this supplier">Go ↗</a>}
           <button type="button" className="dj-ml-mini" title="Move supplier earlier" disabled={index===0}
            onClick={()=>updateStopOrder(moveBy(stops,stopId,-1))}>↑</button>
           <button type="button" className="dj-ml-mini" title="Move supplier later" disabled={index===stops.length-1}
            onClick={()=>updateStopOrder(moveBy(stops,stopId,1))}>↓</button>
          </div>
         </div>
         {stopId!==NO_SHOP&&<div className="dj-ml-dist dj-ml-no-print">
          <span>Distance from start (km):</span>
          <input type="number" aria-label={'Manual distance to '+(address?.name||'supplier')} min="0" step=".1"
           placeholder={active.calculatedKm?.[stopId]!==undefined?String(active.calculatedKm[stopId]):'Optional'}
           value={active.manualKm?.[stopId]??''}
           onChange={e=>patch(active.id,c=>({...c,manualKm:{...(c.manualKm||{}),[stopId]:e.target.value}}))}/>
          <span>{validKm(active.manualKm?.[stopId])!==null?'Manual distance':km!==null?'Estimated straight-line distance':'Not located · enter manual distance'}</span>
         </div>}
         <ul className="dj-ml-items">{rows.map((item,j)=><li className={'dj-ml-item '+(item.collected?'is-collected':'')} key={item.id}
          draggable onDragStart={e=>{e.stopPropagation();draggedItem.current=item.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.id)}}
          onDragOver={e=>{e.preventDefault();e.stopPropagation()}} onDrop={e=>dropItem(e,item.id)} onDragEnd={()=>{draggedItem.current=null}}>
          <input className="dj-ml-check" type="checkbox" aria-label={'Collected '+item.name}
           checked={!!item.collected} onChange={e=>toggleItem(item.id,e.target.checked)}/>
          <div className="dj-ml-item-copy"><strong>{item.name}</strong>
           <small>{kindLabel[item.kind]} · {itemDescription(item)}</small>
           {item.notes&&<small>Note: {item.notes}</small>}
          </div>
          <div className="dj-ml-item-buttons dj-ml-no-print">
           <button className="dj-ml-mini" type="button" title="Move material up" disabled={j===0}
            onClick={()=>moveItem(item,-1)}>↑</button>
           <button className="dj-ml-mini" type="button" title="Move material down" disabled={j===rows.length-1}
            onClick={()=>moveItem(item,1)}>↓</button>
           <button className="dj-ml-mini" type="button" onClick={()=>editItem(item)}>Edit</button>
           <button className="dj-ml-mini" type="button" title="Remove material" onClick={()=>removeItem(item)}>✕</button>
          </div>
         </li>)}</ul>
        </section>;
       })}
       <p className="dj-ml-brand-footer dj-ml-no-print">Saved to Delta Joinery Cloud when connected. Manual order changes are reflected immediately in the print layout.</p>
      </div>
     </>}
    </div>
   </div>
  </div>
 </main>;
}
