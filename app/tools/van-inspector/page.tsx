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
 const [view,setView]=useState<'list'|'form'|'vehicles'>('list');
 const [draft,setDraft]=useState<Inspection|null>(null);
 const [reg,setReg]=useState('');const [make,setMake]=useState('');const [model,setModel]=useState('');
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);
 const [photoURLs,setPhotoURLs]=useState<Record<string,string>>({});
 useEffect(()=>{setStore(readStore());setReady(true);const sync=(e:Event)=>{if((e as CustomEvent<string>).detail===KEY)setStore(readStore())};window.addEventListener('dj-cloud-received',sync);return()=>window.removeEventListener('dj-cloud-received',sync)},[]);
 useEffect(()=>{const photos=Object.values(draft?.photos||{}).flat();if(!account||!photos.length)return;let live=true;Promise.all(photos.map(async p=>{try{return [p.path,await account.getQuotationImageUrl(p.path)] as const}catch{return [p.path,''] as const}})).then(values=>{if(live)setPhotoURLs(Object.fromEntries(values))});return()=>{live=false}},[account?.email,draft?.id,draft?.photos]);
 async function saveStore(next:Store){if(!account)throw new Error('Sign in to save inspections');await account.saveTool(KEY,next);setStore(next);setStatus('Saved to cloud');}
 function edit(patch:Partial<Inspection>){setDraft(d=>d?{...d,...patch}:d)}
 function start(vehicleId=''){setDraft(newInspection(vehicleId));setPhotoURLs({});setStatus('');setView('form')}
 async function addVehicle(){if(!reg.trim()){setStatus('Enter a registration');return}if(store.vehicles.some(v=>v.registration.toUpperCase()===reg.trim().toUpperCase())){setStatus('This registration already exists');return}setBusy(true);try{await saveStore({...store,vehicles:[...store.vehicles,{id:crypto.randomUUID(),registration:reg.trim().toUpperCase(),make:make.trim(),model:model.trim()}]});setReg('');setMake('');setModel('')}catch(e){setStatus(String(e))}finally{setBusy(false)}}
 async function saveInspection(){if(!draft||!draft.vehicleId||!draft.inspector.trim()||!draft.lastDriver.trim()||!draft.km||Number(draft.km)<0){setStatus('Select a van and enter inspector, last driver and mileage');return}setBusy(true);try{const exists=store.inspections.some(i=>i.id===draft.id);await saveStore({...store,inspections:exists?store.inspections.map(i=>i.id===draft.id?draft:i):[draft,...store.inspections]});setView('list');setDraft(null)}catch(e){setStatus('Save failed: '+String(e))}finally{setBusy(false)}}
 async function upload(section:string,files:FileList|null){if(!files?.length||!draft||!account)return;setBusy(true);setStatus('Uploading images...');try{const picked=Array.from(files).filter(f=>f.type.startsWith('image/'));if(!picked.length)throw new Error('Select JPG, PNG, WEBP or another image format');const added=await account.uploadQuotationImages('van-inspection-'+draft.id,picked);const next={...draft,photos:{...draft.photos,[section]:[...(draft.photos[section]||[]),...added]}};setDraft(next);setStatus('Images uploaded. Save inspection to keep them in its record.');const urls=await Promise.all(added.map(async p=>[p.path,await account.getQuotationImageUrl(p.path)] as const));setPhotoURLs(x=>({...x,...Object.fromEntries(urls)}))}catch(e){setStatus('Upload failed: '+String(e))}finally{setBusy(false)}}
 async function removePhoto(section:string,p:Photo){if(!draft||!account)return;setBusy(true);try{await account.removeQuotationImages([p.path]);edit({photos:{...draft.photos,[section]:(draft.photos[section]||[]).filter(x=>x.path!==p.path)}});setStatus('Photo removed; save the inspection to confirm')}catch(e){setStatus('Could not remove photo: '+String(e))}finally{setBusy(false)}}
 async function pdf(i:Inspection){
  setBusy(true);setStatus('Preparing technical inspection PDF...');
  try{
   const {jsPDF}=await import('jspdf');
   const doc=new jsPDF({format:'a4',unit:'mm',compress:true});
   const van=store.vehicles.find(v=>v.id===i.vehicleId);
   const vehicle=van?[van.registration,van.make,van.model].filter(Boolean).join(' / '):i.vehicleId;
   const reportId=i.id.slice(0,8).toUpperCase();
   const issues=fault(i);
   const left=16,right=194,width=178;
   const navy:[number,number,number]=[12,32,49],blue:[number,number,number]=[36,105,143];
   const grey:[number,number,number]=[92,108,119],ink:[number,number,number]=[25,42,53];
   const pale:[number,number,number]=[239,245,248];
   let y=43;
   const header=()=>{
    doc.setFillColor(...navy);doc.rect(0,0,210,30,'F');
    doc.setDrawColor(57,138,173);doc.setLineWidth(.8);doc.line(16,30,194,30);
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('DELTA JOINERY',16,14);
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text('BESPOKE INTERIORS  /  FLEET MANAGEMENT',16,22);
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('VEHICLE INSPECTION REPORT',194,14,{align:'right'});
    doc.setFont('helvetica','normal');doc.text('REF: '+reportId,194,21,{align:'right'});
   };
   const page=()=>{doc.addPage();header();y=40};
   const space=(height:number)=>{if(y+height>270)page()};
   const title=(num:string,text:string)=>{
    space(19);
    doc.setFillColor(...navy);doc.roundedRect(left,y,width,10,1.5,1.5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(255,255,255);
    doc.text(num+'  '+text.toUpperCase(),left+4,y+6.6);y+=15;
   };
   const row=(label:string,value:string,status=false)=>{
    const data=doc.splitTextToSize(String(value||'Not recorded'),106) as string[];
    const h=Math.max(10,data.length*4.4+5);space(h);
    doc.setFillColor(...pale);doc.rect(left,y,58,h,'F');
    doc.setDrawColor(218,229,235);doc.setLineWidth(.15);doc.line(left,y+h,right,y+h);
    doc.setTextColor(...grey);doc.setFont('helvetica','bold');doc.setFontSize(8);
    doc.text(label,left+3,y+6.1);
    doc.setTextColor(...(status&&(value==='Good'||value==='Excellent')?([27,112,81] as [number,number,number]):ink));
    doc.setFont('helvetica','normal');doc.text(data,left+62,y+6.1);
    y+=h;
   };
   const textNote=(label:string,value:string)=>{
    if(!value.trim())return;
    const lines=doc.splitTextToSize(value,169) as string[];
    const h=lines.length*4.5+11;space(h);
    doc.setFillColor(248,250,251);doc.roundedRect(left,y,width,h,1.4,1.4,'F');
    doc.setFont('helvetica','bold');doc.setTextColor(...blue);doc.setFontSize(7.5);doc.text(label.toUpperCase(),left+4,y+5);
    doc.setFont('helvetica','normal');doc.setTextColor(...ink);doc.setFontSize(8);doc.text(lines,left+4,y+11);
    y+=h+4;
   };
   header();
   doc.setTextColor(...grey);doc.setFont('helvetica','bold');doc.setFontSize(8);
   doc.text('INSPECTION DATE',left,y);doc.text('VEHICLE REGISTRATION',82,y);doc.text('REPORT STATUS',146,y);
   y+=6;doc.setFontSize(11);doc.setTextColor(...ink);
   doc.text(i.date,left,y);doc.text(van?.registration||'N/A',82,y);
   doc.setTextColor(...(issues?([161,81,31] as [number,number,number]):([30,115,82] as [number,number,number])));
   doc.text(issues?'ATTENTION REQUIRED':'NO DEFECTS REPORTED',146,y,{maxWidth:48});y+=13;
   title('01','Vehicle and inspection details');
   row('Vehicle',vehicle);row('Inspected by',i.inspector);row('Last driver',i.lastDriver);row('Odometer',i.km+' km');row('Inspection date',i.date);
   title('02','Oil and mechanical checks');
   row('Engine oil',i.oil,true);textNote('Oil observations',i.oilNotes);
   title('03','Tyre condition');
   for(const wheel of wheels)row(wheel,i.tyres[wheel]||'Not checked',true);
   textNote('Tyre observations',i.tyreNotes);
   title('04','Dashboard warning indicators');
   if(!i.warningLights.length)row('Warning lights','None reported');
   else for(const light of i.warningLights)row('Warning recorded',light);
   textNote('Warning light observations',i.warningNotes);
   title('05','Bodywork and cabin condition');
   row('Interior grade',i.insideGrade,true);textNote('Interior observations',i.insideNotes);
   row('Exterior grade',i.outsideGrade,true);textNote('Exterior observations',i.outsideNotes);
   title('06','Safety and equipment checklist');
   for(const check of standardChecks)row(check,i.checks[check]||'Not checked',true);
   title('07','Inspector notes and report conclusion');
   textNote('Additional observations',i.notes);
   row('Overall result',issues?'Issues identified - review defects and arrange corrective action':'No defects reported in completed fields');
   row('Inspection reference',reportId);
   const photoGroups:[string,string][]=[['vehicle','Vehicle overview'],['dashboard','Dashboard and odometer'],['tyres','Tyre condition'],['inside','Interior condition'],['outside','Exterior and bodywork']];
   const photos=photoGroups.flatMap(([key,label])=>(i.photos?.[key]||[]).map(p=>({p,label})));
   if(photos.length){
    page();title('08','Photographic evidence');
    let imageIndex=0;
    for(const item of photos){
     imageIndex++;
     let jpeg:string|undefined;
     let ratio=1;
     try{
      const url=await account?.getQuotationImageUrl(item.p.path);
      if(!url)throw new Error('Missing image URL');
      const response=await fetch(url);
      if(!response.ok)throw new Error('Image unavailable');
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      try{
       const img=new Image();img.src=objectUrl;await img.decode();
       ratio=img.naturalWidth/img.naturalHeight;
       const canvas=document.createElement('canvas');
       const scale=Math.min(1,1500/Math.max(img.naturalWidth,img.naturalHeight));
       canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
       canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
       const ctx=canvas.getContext('2d');
       if(!ctx)throw new Error('Canvas unavailable');
       ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
       ctx.drawImage(img,0,0,canvas.width,canvas.height);
       jpeg=canvas.toDataURL('image/jpeg',.79);
      }finally{URL.revokeObjectURL(objectUrl)}
     }catch{jpeg=undefined}
     const panelW=85, panelH=72;
     const slot=(imageIndex-1)%2;
     if(slot===0){space(panelH+9)}
     const x=left+slot*93,top=y;
     doc.setDrawColor(215,229,235);doc.setFillColor(248,250,251);
     doc.roundedRect(x,top,panelW,panelH,2,2,'FD');
     doc.setTextColor(...blue);doc.setFont('helvetica','bold');doc.setFontSize(8);
     doc.text(String(imageIndex).padStart(2,'0')+'  '+item.label.toUpperCase(),x+3,top+6,{maxWidth:panelW-6});
     if(jpeg){
      const maxW=panelW-6,maxH=panelH-20;
      const fitW=Math.min(maxW,maxH*ratio),fitH=fitW/ratio;
      doc.addImage(jpeg,'JPEG',x+(panelW-fitW)/2,top+9+(maxH-fitH)/2,fitW,fitH);
     }else{
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...grey);
      doc.text('Image unavailable',x+4,top+31);
     }
     doc.setTextColor(...grey);doc.setFont('helvetica','normal');doc.setFontSize(7);
     doc.text(item.p.name.length>32?item.p.name.slice(0,29)+'...':item.p.name,x+3,top+panelH-4);
     if(slot===1||imageIndex===photos.length)y+=panelH+9;
    }
   }
   const pages=doc.getNumberOfPages();
   for(let p=1;p<=pages;p++){
    doc.setPage(p);doc.setDrawColor(207,219,227);doc.line(left,282,right,282);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...grey);
    doc.text('DELTA JOINERY  |  VEHICLE INSPECTION RECORD  |  '+(van?.registration||'UNKNOWN'),left,288);
    doc.text('PAGE '+p+' / '+pages,right,288,{align:'right'});
   }
   doc.save('Delta-Joinery-Technical-Van-Inspection-'+(van?.registration||'vehicle')+'-'+i.date+'.pdf');
   setStatus('Technical PDF downloaded');
  }catch(error){setStatus('PDF export failed: '+String(error))}
  finally{setBusy(false)}
 }
 const selectVan=store.vehicles.find(v=>v.id===draft?.vehicleId);
 const photoSection=(section:string,title:string)=><div style={{...box,marginTop:12}}><b>{title}</b><p style={{fontSize:12,opacity:.7,margin:'5px 0 12px'}}>Upload photos to keep with this inspection and include in the PDF.</p><input type="file" accept="image/*" multiple disabled={busy} onChange={e=>{void upload(section,e.target.files);e.currentTarget.value=''}} style={{...input,fontSize:12}}/><div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:10}}>{(draft?.photos[section]||[]).map(p=><div key={p.path} style={{width:112}}>{photoURLs[p.path]?<img src={photoURLs[p.path]} alt={p.name} style={{width:110,height:85,objectFit:'cover',borderRadius:6}}/>:<div style={{height:85,background:'#17344b',fontSize:11,padding:8}}>Loading image...</div>}<button disabled={busy} onClick={()=>void removePhoto(section,p)} style={{fontSize:11,color:'#ffbe95'}}>Remove</button></div>)}</div></div>;
 return <main className="dj-desktop dj-unified-page"><DesktopSidebar active="tools"/><div className="dj-unified-content" style={{minWidth:0,minHeight:'100vh',padding:'28px 18px'}}><div className="dj-page-inner" style={{maxWidth:1250,margin:'0 auto',color:'#f2f8ff'}}><header style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:14,alignItems:'center',marginBottom:18}}><div><div style={{color:'#ffc861',fontSize:12,fontWeight:800,letterSpacing:1}}>DELTA JOINERY / TOOLS</div><h1 style={{fontSize:31,fontWeight:850,margin:'4px 0'}}>Van Inspector</h1><p style={{margin:0,color:'#d5e3ef',fontSize:13}}>Vehicle condition checks, photographs and inspection records</p></div><button style={btn} onClick={()=>{setStatus('');setView('vehicles')}}>Manage Vans</button></header>
 {status&&<div role="status" style={{...box,padding:10,marginBottom:14,color:'#ffcb75'}}>{status}</div>}
 {!ready?<p>Loading inspections...</p>:view==='vehicles'?<section style={box}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontSize:20,fontWeight:800}}>Registered Vans</h2><button style={btn} onClick={()=>setView('list')}>Back</button></div><div className="dj-van-grid">{[['Registration',reg,setReg],['Make',make,setMake],['Model',model,setModel]].map(([label,value,setter])=><label key={label as string}><span style={tag}>{label as string}</span><input style={input} value={value as string} onChange={e=>(setter as (s:string)=>void)(e.target.value)} placeholder={label as string}/></label>)}</div><button style={{...btn,margin:'14px 0'}} disabled={busy} onClick={()=>void addVehicle()}>+ Add Van</button>{store.vehicles.map(v=><div key={v.id} style={{padding:12,borderTop:'1px solid #42637b'}}><b>{v.registration}</b> &nbsp; {v.make} {v.model} <button style={{float:'right',color:'#b6eaff'}} onClick={()=>start(v.id)}>Inspect</button></div>)}</section>:view==='list'?<><div className="dj-van-stats">{[['Registered Vans',store.vehicles.length],['Completed Inspections',store.inspections.length],['Inspections with Issues',store.inspections.filter(fault).length]].map(([title,count])=><div key={title} style={box}><span style={{fontSize:12,color:'#b2d6e9'}}>{title}</span><b style={{display:'block',fontSize:29,marginTop:8}}>{count}</b></div>)}</div><section style={box}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:12}}><h2 style={{fontSize:20,fontWeight:800}}>Inspection History</h2><button style={btn} onClick={()=>start(store.vehicles[0]?.id||'')}>+ New Inspection</button></div>{store.vehicles.length===0&&<p style={{fontSize:13}}>No vans registered. Select Manage Vans to add your first vehicle.</p>}<div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:680,borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Date','Vehicle','Inspector','Mileage','Result','Actions'].map(h=><th key={h} style={{padding:11,textAlign:'left',borderBottom:'1px solid #4b6c83'}}>{h}</th>)}</tr></thead><tbody>{store.inspections.map(i=><tr key={i.id} style={{borderBottom:'1px solid #304b61'}}><td style={{padding:11}}>{i.date}</td><td>{store.vehicles.find(v=>v.id===i.vehicleId)?.registration||'Unknown van'}</td><td>{i.inspector}</td><td>{i.km} km</td><td style={{color:fault(i)?'#ffc46f':'#89e9b9'}}>{fault(i)?'Issues found':'No defects reported'}</td><td><button style={{color:'#8cdbff',marginRight:12}} onClick={()=>{setDraft(i);setView('form')}}>Inspect / Edit</button><button disabled={busy} style={{color:'#8cdbff'}} onClick={()=>void pdf(i)}>PDF</button></td></tr>)}</tbody></table></div></section></>:draft?<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12}}><h2 style={{fontSize:20,fontWeight:800}}>Vehicle Inspection Form</h2><button style={btn} onClick={()=>{setView('list');setDraft(null)}}>Back to inspections</button></div><section style={box}><h3 style={{fontWeight:800,marginBottom:15}}>1. Vehicle & Driver Details</h3><div className="dj-van-grid"><label><span style={tag}>Select van *</span><select style={input} value={draft.vehicleId} onChange={e=>edit({vehicleId:e.target.value})}><option value="">Choose registered van</option>{store.vehicles.map(v=><option key={v.id} value={v.id}>{v.registration} — {v.make} {v.model}</option>)}</select></label><label><span style={tag}>Inspection date *</span><input type="date" style={input} value={draft.date} onChange={e=>edit({date:e.target.value})}/></label><label><span style={tag}>Inspector *</span><input style={input} value={draft.inspector} onChange={e=>edit({inspector:e.target.value})}/></label><label><span style={tag}>Last driver *</span><input style={input} value={draft.lastDriver} onChange={e=>edit({lastDriver:e.target.value})}/></label><label><span style={tag}>Kilometres on dashboard *</span><input type="number" min="0" style={input} value={draft.km} onChange={e=>edit({km:e.target.value})} placeholder="e.g. 85320"/></label></div>{selectVan&&<p style={{marginTop:10,fontSize:12,color:'#ffc861'}}>Selected: {selectVan.registration}</p>}{photoSection('dashboard','Dashboard / mileage photograph')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>2. Engine Oil</h3><Control label="Oil condition" value={draft.oil} onChange={oil=>edit({oil:oil as Check})} values={['Not checked','Good','Needs attention','Replace / repair']}/><textarea style={{...input,marginTop:12}} placeholder="Oil level, colour, last change or required work" value={draft.oilNotes} onChange={e=>edit({oilNotes:e.target.value})}/></section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>3. Tyres</h3><div className="dj-van-grid">{wheels.map(w=><Control key={w} label={w} value={draft.tyres[w]||'Not checked'} onChange={v=>edit({tyres:{...draft.tyres,[w]:v as Check}})} values={['Not checked','Good','Flat / low pressure','Damaged','Worn / replacement needed','Needs attention','Replace / repair']}/>)}</div><textarea style={{...input,marginTop:12}} placeholder="Pressure, tread, punctures or damage notes" value={draft.tyreNotes} onChange={e=>edit({tyreNotes:e.target.value})}/>{photoSection('tyres','Tyre photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>4. Dashboard Warning Lights</h3><p style={{fontSize:12,marginBottom:12}}>Select all illuminated warning lights. Leave all unchecked if none are on.</p><details style={{...box,padding:10}}><summary style={{cursor:"pointer",fontWeight:700,color:"#b8e6ff"}}>{draft.warningLights.length?draft.warningLights.length+" warning light(s) selected":"Choose warning lights from dropdown"}</summary><div className="dj-van-grid" style={{marginTop:12}}>{warningOptions.map(w=><label key={w} style={{fontSize:12,display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={draft.warningLights.includes(w)} onChange={e=>edit({warningLights:e.target.checked?[...draft.warningLights,w]:draft.warningLights.filter(x=>x!==w)})}/>{w}</label>)}</div></details><textarea style={{...input,marginTop:14}} placeholder="Describe the warning light or fault" value={draft.warningNotes} onChange={e=>edit({warningNotes:e.target.value})}/></section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>5. Interior Condition</h3><Control label="Grade the inside of the van" value={draft.insideGrade} onChange={insideGrade=>edit({insideGrade})} values={['Not graded','Excellent','Good','Fair','Poor']}/><textarea style={{...input,marginTop:12}} value={draft.insideNotes} onChange={e=>edit({insideNotes:e.target.value})} placeholder="Seats, dashboard, storage, cleanliness or damage"/>{photoSection('inside','Interior photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>6. Exterior Condition</h3><Control label="Grade the outside of the van" value={draft.outsideGrade} onChange={outsideGrade=>edit({outsideGrade})} values={['Not graded','Excellent','Good','Fair','Poor']}/><textarea style={{...input,marginTop:12}} value={draft.outsideNotes} onChange={e=>edit({outsideNotes:e.target.value})} placeholder="Body panels, scratches, dents, glass or damage"/>{photoSection('outside','Exterior photographs')}</section>
 <section style={{...box,marginTop:14}}><h3 style={{fontWeight:800,marginBottom:15}}>7. General Safety Checklist</h3><div className="dj-van-grid">{standardChecks.map(c=><Control key={c} label={c} value={draft.checks[c]||'Not checked'} onChange={v=>edit({checks:{...draft.checks,[c]:v as Check}})}/>)}</div><textarea style={{...input,marginTop:12}} value={draft.notes} onChange={e=>edit({notes:e.target.value})} placeholder="Other inspection comments / work required"/></section>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'20px 0 50px'}}><button disabled={busy} style={{...btn,background:'#12638e',padding:'13px 20px'}} onClick={()=>void saveInspection()}>{busy?'Working...':'Save Inspection to Cloud'}</button><button disabled={busy} style={btn} onClick={()=>void pdf(draft)}>Download Inspection PDF</button></div></>:null}
 <style jsx global>{'.dj-van-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dj-van-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}@media(max-width:680px){.dj-van-grid{grid-template-columns:1fr}.dj-van-stats{grid-template-columns:1fr 1fr}}'}</style>
 </div></div></main>;
}