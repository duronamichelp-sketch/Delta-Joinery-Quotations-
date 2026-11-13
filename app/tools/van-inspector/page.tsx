'use client';
import {useEffect,useState} from 'react';
import DesktopSidebar from '../../DesktopSidebar';
import {useDeltaAccount} from '../../CloudSync';
type Photo={path:string;name:string};
type Check='Good'|'Needs attention'|'Replace / repair'|'Not checked';
type Inspection={id:string;vehicleId:string;date:string;inspector:string;lastDriver:string;km:string;oil:Check;oilNotes:string;tyres:Record<string,Check>;tyreNotes:string;warningLights:string[];warningNotes:string;insideGrade:string;outsideGrade:string;insideNotes:string;outsideNotes:string;checks:Record<string,Check>;photos:Record<string,Photo[]>;notes:string;createdAt:string};
type Vehicle={id:string;registration:string;make:string;model:string};
type Store={vehicles:Vehicle[];inspections:Inspection[]};
const KEY='dj_van_inspections';
const DRAFT_KEY='dj_van_inspection_unsaved_draft';
const isComplete=(i:Inspection)=>!!(i.vehicleId&&i.inspector.trim()&&i.lastDriver.trim()&&i.km.trim()&&Number(i.km)>=0);
const warningOptions=['Check engine / engine management','Oil pressure','Oil level / service oil','Battery / charging system','Brake system','ABS','Airbag / SRS','Tyre pressure (TPMS)','Coolant temperature','Low coolant','Diesel particulate filter (DPF)','AdBlue / DEF','Glow plug','Electronic stability control / traction','Power steering','Transmission / gearbox','Fuel warning','Seat belt','Door or bonnet open','Service / maintenance due','Exterior bulb failure','Parking brake','Other warning'];
const standardChecks=['Headlights / indicators / brake lights','Brakes / handbrake','Windscreen / wipers','Mirrors','Coolant level','Washer fluid','Horn','Seatbelts','Load area / securing','Leaks under vehicle'];
const wheels=['Front left','Front right','Rear left','Rear right','Spare wheel'];
const emptyStore=():Store=>({vehicles:[],inspections:[]});
const today=()=>new Date().toLocaleDateString('en-CA');
const newInspection=(vehicleId=''):Inspection=>({id:crypto.randomUUID(),vehicleId,date:today(),inspector:'',lastDriver:'',km:'',oil:'Not checked',oilNotes:'',tyres:Object.fromEntries(wheels.map(x=>[x,'Not checked'])),tyreNotes:'',warningLights:[],warningNotes:'',insideGrade:'Not graded',outsideGrade:'Not graded',insideNotes:'',outsideNotes:'',checks:Object.fromEntries(standardChecks.map(x=>[x,'Not checked'])),photos:{vehicle:[],inside:[],outside:[],tyres:[],dashboard:[]},notes:'',createdAt:new Date().toISOString()});
const box:React.CSSProperties={background:'rgba(7,28,45,.82)',border:'1px solid rgba(80,165,216,.36)',borderRadius:13,padding:17,backdropFilter:'blur(14px)',color:'#edf7ff'};
const input:React.CSSProperties={width:'100%',minHeight:39,padding:'9px 10px',border:'1px solid rgba(92,175,225,.38)',background:'rgba(4,21,36,.92)',color:'#fff',borderRadius:8,colorScheme:'dark'};
const btn:React.CSSProperties={...input,width:'auto',background:'#103b57',borderColor:'#2480a6',fontWeight:700,cursor:'pointer'};
const tag:React.CSSProperties={color:'#d2e5f0',fontSize:12,fontWeight:700,display:'block',marginBottom:6};
function readStore():Store{try{const parsed=JSON.parse(localStorage.getItem(KEY)||'null');return parsed&&Array.isArray(parsed.vehicles)&&Array.isArray(parsed.inspections)?parsed:emptyStore()}catch{return emptyStore()}}
function fault(i:Inspection){return i.oil==='Needs attention'||i.oil==='Replace / repair'||Object.values(i.tyres).some(x=>x!=='Good'&&x!=='Not checked')||Object.values(i.checks).some(x=>x==='Needs attention'||x==='Replace / repair')||i.warningLights.length>0||i.insideGrade==='Poor'||i.outsideGrade==='Poor'}
function Control({label,value,onChange,values=['Good','Needs attention','Replace / repair','Not checked']}:{label:string;value:string;onChange:(s:string)=>void;values?:string[]}){return <label><span style={tag}>{label}</span><select style={input} value={value} onChange={e=>onChange(e.target.value)}>{values.map(x=><option key={x}>{x}</option>)}</select></label>}
export default function VanInspector(){
 const account=useDeltaAccount();
 const [store,setStore]=useState<Store>(emptyStore());
 const [ready,setReady]=useState(false);
 const [view,setView]=useState<'list'|'saved'|'form'|'vehicles'>('list');
 const [draft,setDraft]=useState<Inspection|null>(null);
 const [reg,setReg]=useState('');const [make,setMake]=useState('');const [model,setModel]=useState('');
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 const [photoURLs,setPhotoURLs]=useState<Record<string,string>>({});
 const [pendingDraft,setPendingDraft]=useState<Inspection|null>(null);
 useEffect(()=>{try{const saved=localStorage.getItem(DRAFT_KEY);if(saved){const parsed=JSON.parse(saved);if(parsed&&typeof parsed.id==='string')setPendingDraft(parsed as Inspection)}}catch{}setStore(readStore());setReady(true);const sync=(e:Event)=>{if((e as CustomEvent<string>).detail===KEY)setStore(readStore())};window.addEventListener('dj-cloud-received',sync);return()=>window.removeEventListener('dj-cloud-received',sync)},[]);
 useEffect(()=>{if(!ready)return;try{if(draft){localStorage.setItem(DRAFT_KEY,JSON.stringify(draft))}else if(!pendingDraft)localStorage.removeItem(DRAFT_KEY)}catch{}},[draft,ready,pendingDraft]);
 useEffect(()=>{const photos=Object.values(draft?.photos||{}).flat();if(!account||!photos.length)return;let live=true;Promise.all(photos.map(async p=>{try{return [p.path,await account.getQuotationImageUrl(p.path)] as const}catch{return [p.path,''] as const}})).then(values=>{if(live)setPhotoURLs(Object.fromEntries(values))});return()=>{live=false}},[account?.email,draft?.id,draft?.photos]);
 async function saveStore(next:Store){if(!account)throw new Error('Sign in to save inspections');await account.saveTool(KEY,next);setStore(next);setStatus('Saved to cloud');}
 function edit(patch:Partial<Inspection>){setDraft(d=>d?{...d,...patch}:d)}
 function start(vehicleId=''){if(pendingDraft&&window.confirm('Resume the unfinished inspection? Press Cancel to start a new inspection.')){setDraft(pendingDraft);setStatus('Unsaved inspection restored');}else{setDraft(newInspection(vehicleId));setStatus('New inspection started. You can save it before all checks are complete.')}setPendingDraft(null);setPhotoURLs({});setView('form')}
 async function addVehicle(){if(!reg.trim()){setStatus('Enter a registration');return}if(store.vehicles.some(v=>v.registration.toUpperCase()===reg.trim().toUpperCase())){setStatus('This registration already exists');return}setBusy(true);try{await saveStore({...store,vehicles:[...store.vehicles,{id:crypto.randomUUID(),registration:reg.trim().toUpperCase(),make:make.trim(),model:model.trim()}]});setReg('');setMake('');setModel('')}catch(e){setStatus(String(e))}finally{setBusy(false)}}
 async function saveInspection(){if(!draft)return;if(!draft.vehicleId){setStatus('Save not completed: choose a registered van first. The inspection remains open.');return}if(draft.km&&(!Number.isFinite(Number(draft.km))||Number(draft.km)<0)){setStatus('Save not completed: enter a valid non-negative mileage or leave it blank for a draft.');return}setBusy(true);setStatus('Saving inspection to cloud...');try{const exists=store.inspections.some(i=>i.id===draft.id);const next={...store,inspections:exists?store.inspections.map(i=>i.id===draft.id?draft:i):[draft,...store.inspections]};await saveStore(next);const persisted=readStore();if(!persisted.inspections.some(i=>i.id===draft.id))throw new Error('Inspection was not confirmed in local saved records');localStorage.removeItem(DRAFT_KEY);setPendingDraft(null);setView('saved');setDraft(null);setStatus(isComplete(draft)?'Inspection saved to cloud and added to Saved Inspections.':'Incomplete inspection saved as a draft. You can reopen and finish it.')}catch(e){setStatus('Inspection NOT saved: '+(e instanceof Error?e.message:String(e)))}finally{setBusy(false)}}
 async function upload(section:string,files:FileList|null){if(!files?.length||!draft||!account)return;setBusy(true);setStatus('Uploading images...');try{const picked=Array.from(files).filter(f=>f.type.startsWith('image/'));if(!picked.length)throw new Error('Select JPG, PNG, WEBP or another image format');const added=await account.uploadQuotationImages('van-inspection-'+draft.id,picked);const next={...draft,photos:{...draft.photos,[section]:[...(draft.photos[section]||[]),...added]}};setDraft(next);setStatus('Images uploaded. Save inspection to keep them in its record.');const urls=await Promise.all(added.map(async p=>[p.path,await account.getQuotationImageUrl(p.path)] as const));setPhotoURLs(x=>({...x,...Object.fromEntries(urls)}))}catch(e){setStatus('Upload failed: '+String(e))}finally{setBusy(false)}}
 async function removePhoto(section:string,p:Photo){if(!draft||!account)return;setBusy(true);try{await account.removeQuotationImages([p.path]);edit({photos:{...draft.photos,[section]:(draft.photos[section]||[]).filter(x=>x.path!==p.path)}});setStatus('Photo removed; save the inspection to confirm')}catch(e){setStatus('Could not remove photo: '+String(e))}finally{setBusy(false)}}
 async function pdf(i:Inspection){
  setBusy(true);setStatus('Preparing technical inspection report...');
  try{
   const {jsPDF}=await import('jspdf');
   const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
   const van=store.vehicles.find(v=>v.id===i.vehicleId);
   const registration=van?.registration||'NOT RECORDED';
   const reportRef=i.id.slice(0,8).toUpperCase();
   const dark:[number,number,number]=[23,44,59];
   const accent:[number,number,number]=[33,99,133];
   const secondary:[number,number,number]=[95,108,117];
   const rule:[number,number,number]=[199,211,219];
   const paperText:[number,number,number]=[36,49,57];
   const margin=16,pageRight=281,contentBottom=192;
   const colWidth=128,colX=[16,153];
   const state=[{page:1,y:77},{page:1,y:77}];
   const status=!isComplete(i)?'INCOMPLETE - FURTHER CHECKS REQUIRED':fault(i)?'DEFECTS RECORDED - ACTION REQUIRED':'NO DEFECTS REPORTED IN CHECKED ITEMS';
   const drawHeader=()=>{
    doc.setTextColor(...dark);doc.setFont('helvetica','bold');doc.setFontSize(16);
    doc.text('DELTA JOINERY',margin,15);
    doc.setTextColor(...secondary);doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.text('BESPOKE INTERIORS  /  VEHICLE CONDITION RECORD',margin,21);
    doc.setTextColor(...dark);doc.setFont('helvetica','bold');doc.setFontSize(11);
    doc.text('VAN INSPECTION',pageRight,15,{align:'right'});
    doc.setTextColor(...secondary);doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.text('REPORT REF  '+reportRef,pageRight,21,{align:'right'});
    doc.setDrawColor(...accent);doc.setLineWidth(.42);doc.line(margin,26,pageRight,26);
   };
   drawHeader();
   const meta=(x:number,y:number,w:number,label:string,value:string)=>{
    doc.setFont('helvetica','bold');doc.setFontSize(7.4);doc.setTextColor(...secondary);
    doc.text(label.toUpperCase(),x,y+3.6);
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...dark);
    const display=doc.splitTextToSize(value||'-',w-4) as string[];
    doc.text(display.slice(0,1),x,y+11);
    doc.setDrawColor(...rule);doc.setLineWidth(.14);doc.line(x,y+14,x+w-4,y+14);
   };
   meta(16,31,75,'Registration',registration);
   meta(95,31,110,'Vehicle',[van?.make,van?.model].filter(Boolean).join(' / ')||'Not recorded');
   meta(209,31,72,'Odometer',i.km?i.km+' km':'Not recorded');
   meta(16,48,75,'Inspection date',i.date);
   meta(95,48,110,'Inspected by',i.inspector||'Not recorded');
   meta(209,48,72,'Last driver',i.lastDriver||'Not recorded');
   doc.setFont('helvetica','bold');doc.setFontSize(7.7);doc.setTextColor(...secondary);
   doc.text('RECORDED ASSESSMENT',margin,73);
   doc.setFontSize(9);doc.setTextColor(...(fault(i)?([150,73,45] as [number,number,number]):dark));
   doc.text(status,71,73,{maxWidth:210});
   const makePage=(n:number)=>{
    while(doc.getNumberOfPages()<n){doc.addPage('a4','landscape');drawHeader()}
    doc.setPage(n);
   };
   const nextPage=(col:number,heading:string)=>{
    state[col].page+=1;state[col].y=38;
    makePage(state[col].page);
    if(heading){
     const x=colX[col];
     doc.setFont('helvetica','bold');doc.setFontSize(8.3);doc.setTextColor(...accent);
     doc.text(heading.toUpperCase()+'  /  CONTINUED',x,state[col].y+4);
     doc.setDrawColor(...rule);doc.setLineWidth(.18);doc.line(x,state[col].y+7,x+colWidth,state[col].y+7);
     state[col].y+=11;
    }
   };
   const ensure=(col:number,height:number,heading:string)=>{
    if(state[col].y+height>contentBottom)nextPage(col,heading);
    makePage(state[col].page);
   };
   const heading=(col:number,number:string,text:string)=>{
    ensure(col,24,'');
    const x=colX[col],y=state[col].y;
    doc.setTextColor(...accent);doc.setFont('helvetica','bold');doc.setFontSize(9.5);
    doc.text(number+'  '+text.toUpperCase(),x,y+4.8);
    doc.setDrawColor(...rule);doc.setLineWidth(.25);doc.line(x,y+7.2,x+colWidth,y+7.2);
    state[col].y+=10.6;
   };
   const entry=(col:number,label:string,value:string,continued:string)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(8.3);
    const labels=doc.splitTextToSize(label,73) as string[];
    doc.setFont('helvetica','bold');doc.setFontSize(8.3);
    const values=doc.splitTextToSize(value||'Not checked',48) as string[];
    const rowHeight=Math.max(6.4,2.6+Math.max(labels.length,values.length)*3.8);
    ensure(col,rowHeight,continued);
    const x=colX[col],y=state[col].y;
    doc.setTextColor(...secondary);doc.setFont('helvetica','normal');doc.setFontSize(8.3);
    doc.text(labels,x+1.4,y+4.35,{lineHeightFactor:1.28});
    doc.setTextColor(...paperText);doc.setFont('helvetica','bold');doc.setFontSize(8.3);
    doc.text(values,x+79,y+4.35,{lineHeightFactor:1.28});
    doc.setDrawColor(...rule);doc.setLineWidth(.12);
    doc.line(x,y+rowHeight,x+colWidth,y+rowHeight);
    state[col].y+=rowHeight;
   };
   const observation=(col:number,label:string,value:string,continued:string)=>{
    if(!value||!value.trim())return;
    doc.setFont('helvetica','normal');doc.setFontSize(8.2);
    const lines=doc.splitTextToSize(value,121) as string[];
    let at=0;
    while(at<lines.length){
     if(state[col].y+15>contentBottom)nextPage(col,continued);
     makePage(state[col].page);
     const remaining=contentBottom-state[col].y;
     const take=Math.min(lines.length-at,Math.max(1,Math.floor((remaining-10)/4.25)));
     const x=colX[col],y=state[col].y;
     doc.setFont('helvetica','bold');doc.setFontSize(7.4);doc.setTextColor(...accent);
     doc.text((at?'CONTINUED / ':'')+label.toUpperCase(),x+1.4,y+5);
     doc.setFont('helvetica','normal');doc.setFontSize(8.2);doc.setTextColor(...paperText);
     doc.text(lines.slice(at,at+take),x+1.4,y+11,{lineHeightFactor:1.48});
     const h=10+take*4.25;
     doc.setDrawColor(...rule);doc.setLineWidth(.12);doc.line(x,y+h,x+colWidth,y+h);
     state[col].y+=h+2.2;at+=take;
    }
   };
   // Left column: mechanical checks, tyre observations and the inspector's decision.
   heading(0,'01','Oil and dashboard');
   entry(0,'Engine oil condition',i.oil||'Not checked','01 / OIL AND DASHBOARD');
   entry(0,'Warning indicators',i.warningLights?.length?i.warningLights.join(', '):'None reported','01 / OIL AND DASHBOARD');
   observation(0,'Oil observations',i.oilNotes||'','01 / OIL AND DASHBOARD');
   observation(0,'Warning light notes',i.warningNotes||'','01 / OIL AND DASHBOARD');
   heading(0,'02','Tyre condition');
   for(const wheel of wheels)entry(0,wheel,i.tyres?.[wheel]||'Not checked','02 / TYRE CONDITION');
   observation(0,'Tyre observations',i.tyreNotes||'','02 / TYRE CONDITION');
   if(i.notes?.trim()){
    heading(0,'05','Additional observations');
    observation(0,'Inspector notes',i.notes,'05 / ADDITIONAL OBSERVATIONS');
   }
   // Right column: cabin/exterior grading and the complete safety checklist.
   heading(1,'03','Interior and exterior');
   entry(1,'Interior grade',i.insideGrade||'Not graded','03 / INTERIOR AND EXTERIOR');
   entry(1,'Exterior grade',i.outsideGrade||'Not graded','03 / INTERIOR AND EXTERIOR');
   observation(1,'Interior observations',i.insideNotes||'','03 / INTERIOR AND EXTERIOR');
   observation(1,'Exterior observations',i.outsideNotes||'','03 / INTERIOR AND EXTERIOR');
   heading(1,'04','Safety and equipment');
   for(const item of standardChecks)entry(1,item,i.checks?.[item]||'Not checked','04 / SAFETY AND EQUIPMENT');
   // Photographs, if present, follow on a clean image-evidence page.
   const photoGroups:[string,string][]=[['dashboard','Dashboard / odometer'],['tyres','Tyre condition'],['inside','Interior'],['outside','Exterior / bodywork'],['vehicle','Vehicle overview']];
   const photos=photoGroups.flatMap(([key,label])=>(i.photos?.[key]||[]).map(p=>({p,label})));
   if(photos.length){
    doc.addPage('a4','landscape');drawHeader();
    let photoIndex=0;
    const newPhotosPage=()=>{
     if(photoIndex>0){doc.addPage('a4','landscape');drawHeader()}
     doc.setTextColor(...accent);doc.setFont('helvetica','bold');doc.setFontSize(9.5);
     doc.text('06  PHOTOGRAPHIC EVIDENCE',margin,40);
     doc.setDrawColor(...rule);doc.setLineWidth(.25);doc.line(margin,43,pageRight,43);
    };
    newPhotosPage();
    for(const item of photos){
     const slot=photoIndex%6;
     if(photoIndex>0&&slot===0)newPhotosPage();
     const x=16+(slot%3)*91.5,y=50+Math.floor(slot/3)*69;
     const tileW=82,tileH=62;
     doc.setDrawColor(...rule);doc.setLineWidth(.18);doc.rect(x,y,tileW,tileH);
     doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...accent);
     doc.text('PHOTO '+String(photoIndex+1).padStart(2,'0')+'  /  '+item.label.toUpperCase(),x+3,y+7,{maxWidth:tileW-6});
     try{
      const url=await account?.getQuotationImageUrl(item.p.path);
      if(!url)throw new Error('Image URL unavailable');
      const response=await fetch(url);
      if(!response.ok)throw new Error('Image unavailable');
      const blob=await response.blob();
      const blobUrl=URL.createObjectURL(blob);
      try{
       const image=new Image();image.src=blobUrl;await image.decode();
       const canvas=document.createElement('canvas');
       const scale=Math.min(1,1300/Math.max(image.naturalWidth,image.naturalHeight));
       canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
       canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
       const context=canvas.getContext('2d');
       if(!context)throw new Error('Canvas unavailable');
       context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
       context.drawImage(image,0,0,canvas.width,canvas.height);
       const maxW=75,maxH=48,ratio=image.naturalWidth/image.naturalHeight;
       const imageW=Math.min(maxW,maxH*ratio),imageH=imageW/ratio;
       doc.addImage(canvas.toDataURL('image/jpeg',.76),'JPEG',x+(tileW-imageW)/2,y+11+(maxH-imageH)/2,imageW,imageH);
      }finally{URL.revokeObjectURL(blobUrl)}
     }catch{
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...secondary);
      doc.text('Image unavailable',x+5,y+35);
     }
     photoIndex++;
    }
   }
   const pageCount=doc.getNumberOfPages();
   for(let n=1;n<=pageCount;n++){
    doc.setPage(n);
    doc.setDrawColor(...rule);doc.setLineWidth(.18);doc.line(margin,198,pageRight,198);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...secondary);
    doc.text('DELTA JOINERY   /   '+registration+'   /   REPORT '+reportRef,margin,204);
    doc.text('VISUAL CONDITION RECORD - NOT A ROADWORTHINESS CERTIFICATE',148,204,{align:'center'});
    doc.text('PAGE '+n+' / '+pageCount,pageRight,204,{align:'right'});
   }
   doc.save('Delta-Joinery-Van-Inspection-'+registration+'-'+i.date+'-Landscape.pdf');
   setStatus('Clean technical inspection PDF downloaded');
  }catch(error){setStatus('PDF export failed: '+(error instanceof Error?error.message:String(error)))}
  finally{setBusy(false)}
 }
 const selectVan=store.vehicles.find(v=>v.id===draft?.vehicleId);
 const photoSection=(section:string,title:string)=><div style={{...box,marginTop:12}}><b>{title}</b><p style={{fontSize:12,opacity:.7,margin:'5px 0 12px'}}>Upload photos to keep with this inspection and include in the PDF.</p><input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{void upload(section,e.target.files);e.currentTarget.value=''}} style={{...input,fontSize:12}}/><div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}>{(draft?.photos[section]||[]).map(p=><div key={p.path} style={{width:112}}>{photoURLs[p.path]?<img src={photoURLs[p.path]} alt={p.name} style={{width:110,height:85,objectFit:'cover',borderRadius:6}}/>:<div style={{height:85,background:'#17344b',fontSize:11,padding:8}}>Loading image...</div>}<button disabled={busy} onClick={()=>void removePhoto(section,p)} style={{fontSize:11,color:'#ffbe95'}}>Remove</button></div>)}</div></div>;
 return <main className="dj-desktop dj-unified-page"><DesktopSidebar active="tools"/><div className="dj-unified-content" style={{minWidth:0,minHeight:'100vh',padding:'28px 18px'}}><div className="dj-page-inner" style={{maxWidth:1250,margin:'0 auto',color:'#f2f8ff'}}><header style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:14,alignItems:'center',marginBottom:18}}><div><div style={{color:'#ffc861',fontSize:12,fontWeight:800,letterSpacing:1}}>DELTA JOINERY / TOOLS</div><h1 style={{fontSize:31,fontWeight:850,margin:'4px 0'}}>Van Inspector</h1><p style={{margin:0,color:'#d5e3ef',fontSize:13}}>Vehicle condition checks, photographs and inspection records</p></div><button style={btn} onClick={()=>{setStatus('');setView('vehicles')}}>Manage Vans</button></header>
 {status&&<div role="status" style={{...box,padding:10,marginBottom:14,color:'#ffcb75'}}>{status}</div>}
 {(view==='list'||view==='saved')&&<nav aria-label="Van inspection tabs" style={{display:'flex',flexWrap:'wrap',gap:9,marginBottom:15}}><button type="button" style={{...btn,...(view==='list'?{background:'#c99a45',color:'#091b2a',borderColor:'#e3b65d'}:{})}} onClick={()=>setView('list')}>Overview</button><button type="button" style={{...btn,...(view==='saved'?{background:'#c99a45',color:'#091b2a',borderColor:'#e3b65d'}:{})}} onClick={()=>setView('saved')}>Saved Inspections ({store.inspections.length})</button><button type="button" style={btn} onClick={()=>start(store.vehicles[0]?.id||'')}>+ New Inspection</button></nav>}
 {!ready?<p>Loading inspections...</p>:view==='vehicles'?<section style={box}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:20,fontWeight:800}}>Registered Vans</h2><button style={btn} onClick={()=>setView('list')}>Back</button></div><div className="dj-van-grid">{[['Registration',reg,setReg],['Make',make,setMake],['Model',model,setModel]].map(([label,value,setter])=><label key={label as string}><span style={tag}>{label as string}</span><input style={input} value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)} placeholder={label as string}/></label>)}</div><button style={{...btn,margin:'14px 0'}} disabled={busy} onClick={()=>void addVehicle()}>+ Add Van</button>{store.vehicles.map(v=><div key={v.id} style={{padding:12,borderTop:'1px solid #42637b'}}><b>{v.registration}</b> &nbsp; {v.make} {v.model} <button style={{float:'right',color:'#b6eaff'}} onClick={()=>start(v.id)}>Inspect</button></div>)}</section>:(view==='list'||view==='saved')?<><div className="dj-van-stats">{[['Registered Vans',store.vehicles.length],['Completed Inspections',store.inspections.length],['Inspections with Issues',store.inspections.filter(fault).length]].map(([title,count])=><div key={title} style={box}><span style={{fontSize:12,color:'#b2d6e9'}}>{title}</span><b style={{display:'block',fontSize:29,marginTop:8}}>{count}</b></div>)}</div><section style={box}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:12}}><h2 style={{fontSize:20,fontWeight:800}}>{view==='saved'?'Saved Inspections':'Recent Inspections'}</h2><button style={btn} onClick={()=>start(store.vehicles[0]?.id||'')}>+ New Inspection</button></div>{store.vehicles.length===0&&<p style={{fontSize:13}}>No vans registered. Select Manage Vans to add your first vehicle.</p>}<div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:680,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Date','Vehicle','Inspector','Mileage','Result','Actions'].map(h=><th key={h} style={{padding:11,textAlign:'left',borderBottom:'1px solid #4b6c83'}}>{h}</th>)}</tr></thead><tbody>{(view==='saved'?[...store.inspections].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):[...store.inspections].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5)).map(i=><tr key={i.id} style={{borderBottom:'1px solid #304b61'}}><td style={{padding:11}}>{i.date}</td><td>{store.vehicles.find(v=>v.id===i.vehicleId)?.registration||'Unknown van'}</td><td>{i.inspector}</td><td>{i.km} km</td><td style={{color:fault(i)?'#ffc46f':'#89e9b9'}}>{!isComplete(i)?'Saved draft':fault(i)?'Issues found':'No defects reported'}</td><td><button style={{color:'#8cdbff',marginRight:12}} onClick={()=>{setDraft(i);setView('form')}}>Inspect / Edit</button><button disabled={busy} style={{color:'#8cdbff'}} onClick={()=>void pdf(i)}>PDF</button></td></tr>)}</tbody></table></div>{view==='saved'&&store.inspections.length===0&&<p style={{padding:16,fontSize:13,color:'#c7d9e6'}}>No saved inspections yet. Complete an inspection and press Save Inspection to see it here.</p>}</section></>:draft?<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}><h2 style={{fontSize:20,fontWeight:800}}>Vehicle Inspection Form</h2><div style={{display:'flex',gap:8}}><button disabled={busy} style={{...btn,background:'#12638e'}} onClick={()=>void saveInspection()}>Save Inspection</button><button style={btn} onClick={()=>{setPendingDraft(draft);setView('saved');setDraft(null)}}>Back to inspections</button></div></div><section style={box}><h3 style={{fontWeight:800,marginBottom:15}}>1. Vehicle & Driver Details</h3><div className="dj-van-grid"><label><span style={tag}>Select van *</span><select style={input} value={draft.vehicleId} onChange={e=>edit({vehicleId:e.target.value})}><option value="">Choose registered van</option>{store.vehicles.map(v=><option key={v.id} value={v.id}>{v.registration} — {v.make} {v.model}</option>)}</select></label><label><span style={tag}>Inspection date *</span><input type="date" style={input} value={draft.date} onChange={e=>edit({date:e.target.value})}/></label><label><span style={tag}>Inspector *</span><input style={input} value={draft.inspector} onChange={e=>edit({inspector:e.target.value})}/></label><label><span style={tag}>Last driver *</span><input style={input} value={draft.lastDriver} onChange={e=>edit({lastDriver:e.target.value})}/></label><label><span style={tag}>Kilometres on dashboard *</span><input type="number" min="0" style={input} value={draft.km} onChange={e=>edit({km:e.target.value})} placeholder="e.g. 85320"/></label></div>{selectVan&&<p style={{marginTop:10,fontSize:12,color:'#ffc861'}}>Selected: {selectVan.registration}</p>}{photoSection('dashboard','Dashboard / mileage photograph')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>2. Engine Oil</h3><Control label="Oil condition" value={draft.oil} onChange={oil=>edit({oil:oil as Check})} values={['Not checked','Good','Needs attention','Replace / repair']}/><textarea style={{...input,marginTop:12}} placeholder="Oil level, colour, last change or required work" value={draft.oilNotes} onChange={e=>edit({oilNotes:e.target.value})}/></section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>3. Tyres</h3><div className="dj-van-grid">{wheels.map(w=><Control key={w} label={w} value={draft.tyres[w]||'Not checked'} onChange={v=>edit({tyres:{...draft.tyres,[w]:v as Check}})} values={['Not checked','Good','Flat / low pressure','Damaged','Worn / replacement needed','Needs attention','Replace / repair']}/>)}</div><textarea style={{...input,marginTop:12}} placeholder="Pressure, tread, punctures or damage notes" value={draft.tyreNotes} onChange={e=>edit({tyreNotes:e.target.value})}/>{photoSection('tyres','Tyre photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>4. Dashboard Warning Lights</h3><p style={{fontSize:12,marginBottom:12}}>Select all illuminated warning lights. Leave all unchecked if none are on.</p><details style={{...box,padding:10}}><summary style={{cursor:"pointer",fontWeight:700,color:"#b8e6ff"}}>{draft.warningLights.length?draft.warningLights.length+" warning light(s) selected":"Choose warning lights from dropdown"}</summary><div className="dj-van-grid" style={{marginTop:12}}>{warningOptions.map(w=><label key={w} style={{fontSize:12,display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={draft.warningLights.includes(w)} onChange={e=>edit({warningLights:e.target.checked?[...draft.warningLights,w]:draft.warningLights.filter(x=>x!==w)})}/>{w}</label>)}</div></details><textarea style={{...input,marginTop:14}} placeholder="Describe the warning light or fault" value={draft.warningNotes} onChange={e=>edit({warningNotes:e.target.value})}/></section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>5. Interior Condition</h3><Control label="Grade the inside of the van" value={draft.insideGrade} onChange={insideGrade=>edit({insideGrade})} values={['Not graded','Excellent','Good','Fair','Poor']}/><textarea style={{...input,marginTop:12}} value={draft.insideNotes} onChange={e=>edit({insideNotes:e.target.value})} placeholder="Seats, dashboard, storage, cleanliness or damage"/>{photoSection('inside','Interior photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>6. Exterior Condition</h3><Control label="Grade the outside of the van" value={draft.outsideGrade} onChange={outsideGrade=>edit({outsideGrade})} values={['Not graded','Excellent','Good','Fair','Poor']}/><textarea style={{...input,marginTop:12}} value={draft.outsideNotes} onChange={e=>edit({outsideNotes:e.target.value})} placeholder="Body panels, scratches, dents, glass or damage"/>{photoSection('outside','Exterior photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>7. General Safety Checklist</h3><div className="dj-van-grid">{standardChecks.map(c=><Control key={c} label={c} value={draft.checks[c]||'Not checked'} onChange={v=>edit({checks:{...draft.checks,[c]:v as Check}})}/>)}</div><textarea style={{...input,marginTop:12}} value={draft.notes} onChange={e=>edit({notes:e.target.value})} placeholder="Other inspection comments / work required"/></section>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0 50px'}}><button disabled={busy} style={{...btn,background:'#12638e',padding:'13px 20px'}} onClick={()=>void saveInspection()}>{busy?'Saving...':'Save Inspection / Save Draft'}</button><button disabled={busy} style={btn} onClick={()=>void pdf(draft)}>Download Inspection PDF</button></div></>:null}
 <style jsx global>{'.dj-van-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dj-van-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}@media(max-width:680px){.dj-van-grid{grid-template-columns:1fr}.dj-van-stats{grid-template-columns:1fr 1fr}}'}</style>
 </div></div></main>;
}