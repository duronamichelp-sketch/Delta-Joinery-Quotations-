'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import DesktopSidebar from '../DesktopSidebar';
import {useDeltaAccount} from '../CloudSync';
import {jsPDF} from 'jspdf';
type Address={id:string;name:string;eircode:string};
const addressSupplier=(name:string)=>{
 const withoutLocation=name.replace(/\s*\([^)]*\)\s*$/,'').trim();
 return withoutLocation.replace(/\bmain\s+office\b/ig,'').replace(/\bhigher\b/ig,'Hire').replace(/\s+/g,' ').trim();
};
const addressLocation=(name:string)=>{
 const match=name.match(/\(([^)]+)\)\s*$/);
 return match?.[1]?.trim()||name.trim();
};
const supplierKey=(name:string)=>addressSupplier(name).toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=(v:string)=>Math.max(0,Number(v)||0);
const box:React.CSSProperties={background:'rgba(7,28,45,.78)',border:'1px solid rgba(112,190,239,.30)',borderRadius:15,padding:20,boxShadow:'inset 0 1px 0 rgba(255,255,255,.06),0 16px 36px rgba(0,0,0,.20)',backdropFilter:'blur(18px)'};
const field:React.CSSProperties={width:'100%',padding:'12px',borderRadius:9,border:'1px solid rgba(112,190,239,.28)',fontSize:16,color:'#f4f8fb',background:'rgba(3,18,30,.72)'};
const label:React.CSSProperties={display:'grid',gap:6,fontWeight:600,fontSize:13};
const primary:React.CSSProperties={background:'#0c70b8',color:'white',border:'1px solid rgba(101,196,255,.45)',borderRadius:9,padding:'12px 17px',cursor:'pointer',boxShadow:'0 8px 20px rgba(0,76,128,.24)'};
export default function Tools({section=''}:{section?:string}){
const account=useDeltaAccount();
const [saveStatus,setSaveStatus]=useState('');
const [savingAddress,setSavingAddress]=useState(false);
const [mode,setMode]=useState('slats');
const [width,setWidth]=useState('1800'),[height,setHeight]=useState('2400'),[slat,setSlat]=useState('40'),[slatCount,setSlatCount]=useState('30'),[gapOverride,setGapOverride]=useState('');
const [floorL,setFloorL]=useState('4.2'),[floorW,setFloorW]=useState('3.6');
const [sideA,setSideA]=useState('1000'),[sideB,setSideB]=useState('1000'),[diagonal,setDiagonal]=useState('1414.21');
const [name,setName]=useState(''),[eircode,setEircode]=useState(''),[addresses,setAddresses]=useState<Address[]>([]),[editing,setEditing]=useState<string|null>(null);
const [addressSearch,setAddressSearch]=useState('');
const [openSupplier,setOpenSupplier]=useState<string|null>(null);
const [addingSupplier,setAddingSupplier]=useState<string|null>(null);
const [newLocation,setNewLocation]=useState('');
const [newLocationEircode,setNewLocationEircode]=useState('');
const matchingAddresses=addresses.filter(x=>`${x.name} ${x.eircode} ${addressSupplier(x.name)}`.toLocaleLowerCase().includes(addressSearch.trim().toLocaleLowerCase()));
const groupedAddresses=Object.values(matchingAddresses.reduce<Record<string,{key:string;label:string;items:Address[]}>>((groups,item)=>{
 const key=supplierKey(item.name)||item.id;
 if(!groups[key])groups[key]={key,label:addressSupplier(item.name),items:[]};
 groups[key].items.push(item);
 return groups;
},{}));
useEffect(()=>{const refresh=()=>{try{setAddresses(JSON.parse(localStorage.getItem('dj_tool_addresses')||'[]'))}catch{}};refresh();const onCloud=(e:Event)=>{if((e as CustomEvent).detail==='dj_tool_addresses')refresh()};window.addEventListener('dj-cloud-received',onCloud);return ()=>window.removeEventListener('dj-cloud-received',onCloud)},[]);
const save=async(next:Address[])=>{
 setSavingAddress(true);setSaveStatus('Saving to cloud…');
 try{
  if(!account)throw new Error('Please sign in to your cloud account');
  await account.saveTool('dj_tool_addresses',next);
  setAddresses(next);setSaveStatus('Saved to cloud — available on desktop and mobile');return true;
 }catch(e){setSaveStatus('Not saved to cloud: '+(e instanceof Error?e.message:'Unknown error'));return false}
 finally{setSavingAddress(false)}
};
const W=num(width),H=num(height),S=Math.max(.1,num(slat));
const qty=Math.max(0,Math.min(500,Math.floor(num(slatCount))));
const autoGap=qty>1?(W-qty*S)/(qty-1):0;
const hasGapOverride=gapOverride.trim()!=='';
const actualGap=hasGapOverride?num(gapOverride):Math.max(0,autoGap);
const usedWidth=qty>0?qty*S+Math.max(0,qty-1)*actualGap:0;
const remainingWidth=W-usedWidth;
const sideMargin=hasGapOverride?remainingWidth/2:0;
const slatTotal=qty*S;
const slatLayoutValid=qty>=2&&W>0&&H>0&&W>=qty*S&&(!hasGapOverride||usedWidth<=W);
const A=num(sideA),B=num(sideB),C=num(diagonal);const validTriangle=A>0&&B>0&&C>0&&C<A+B&&C>Math.abs(A-B);const angleDeg=validTriangle?Math.acos(Math.max(-1,Math.min(1,(A*A+B*B-C*C)/(2*A*B))))*180/Math.PI:0;const sawAngle=(180-angleDeg)/2;
const area=num(floorL)*num(floorW);
const downloadSlatDrawing=()=>{
 if(!slatLayoutValid)return;
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 const pageW=297,pageH=210;
 doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text('DELTA JOINERY',14,14);
 doc.setFontSize(13);doc.text('Slatted Wall Technical Drawing',14,22);
 doc.setFont('helvetica','normal');doc.setFontSize(8);
 doc.text('All dimensions in millimetres. Verify site dimensions before manufacture.',14,28);
 const x=34,y=47,maxW=226,maxH=112;
 const scale=Math.min(maxW/Math.max(W,1),maxH/Math.max(H,1));
 const drawW=W*scale,drawH=H*scale;
 const left=x+(maxW-drawW)/2,top=y+(maxH-drawH)/2;
 doc.setDrawColor(40);doc.setLineWidth(.35);doc.rect(left,top,drawW,drawH);
 const startMm=Math.max(0,sideMargin);
 const capped=Math.min(qty,500);
 doc.setFillColor(170,125,78);
 for(let i=0;i<capped;i++){
  const sx=left+(startMm+i*(S+actualGap))*scale;
  doc.rect(sx,top,Math.max(.2,S*scale),drawH,'F');
 }
 const dimY=top+drawH+12;
 doc.setDrawColor(70);doc.line(left,dimY,left+drawW,dimY);doc.line(left,dimY-2,left,dimY+2);doc.line(left+drawW,dimY-2,left+drawW,dimY+2);
 doc.setFontSize(8);doc.text(`WALL WIDTH ${W.toFixed(1)} mm`,left+drawW/2,dimY-2,{align:'center'});
 const dimX=left-12;doc.line(dimX,top,dimX,top+drawH);doc.line(dimX-2,top,dimX+2,top);doc.line(dimX-2,top+drawH,dimX+2,top+drawH);
 doc.text(`WALL HEIGHT ${H.toFixed(1)} mm`,dimX-3,top+drawH/2,{angle:90,align:'center'});
 const detailY=174;
 doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('SETTING OUT',14,detailY);
 doc.setFont('helvetica','normal');doc.setFontSize(8);
 doc.text(`Slats: ${qty}`,14,detailY+7);
 doc.text(`Slat width: ${S.toFixed(2)} mm`,54,detailY+7);
 doc.text(`Equal gap: ${actualGap.toFixed(2)} mm${hasGapOverride?' (manual)':' (automatic)'}`,104,detailY+7);
 doc.text(`Wall: ${W.toFixed(1)} × ${H.toFixed(1)} mm`,174,detailY+7);
 if(hasGapOverride)doc.text(`Side margins: ${Math.max(0,sideMargin).toFixed(2)} mm each`,14,detailY+14);
 doc.text(`Total slat face width: ${slatTotal.toFixed(1)} mm`,104,detailY+14);
 doc.text(`Slat face area: ${(slatTotal*H/1000000).toFixed(3)} m²`,174,detailY+14);
 if(qty>=2){
  const sx=left+(Math.max(0,sideMargin))*scale;
  const firstEnd=sx+S*scale;
  const secondStart=sx+(S+actualGap)*scale;
  const localY=top+Math.min(drawH+5,18);
  doc.setDrawColor(85);doc.line(sx,top-7,firstEnd,top-7);doc.line(sx,top-9,sx,top-5);doc.line(firstEnd,top-9,firstEnd,top-5);
  doc.text(`${S.toFixed(2)} slat`,(sx+firstEnd)/2,top-9,{align:'center'});
  if(actualGap>0){doc.line(firstEnd,top-15,secondStart,top-15);doc.line(firstEnd,top-17,firstEnd,top-13);doc.line(secondStart,top-17,secondStart,top-13);doc.text(`${actualGap.toFixed(2)} gap`,(firstEnd+secondStart)/2,top-17,{align:'center'});}
 }
 doc.setFontSize(7);doc.text('Technical setting-out drawing generated by Delta Joinery Tools',14,pageH-8);
 doc.save(`delta-joinery-slatted-wall-${Math.round(W)}x${Math.round(H)}.pdf`);
};
const link=(dest:string,text:string)=><Link href={dest} className="dj-tool-home-card" style={{display:'block',...box,textDecoration:'none',fontWeight:700}}>{text} →</Link>;
const input=(title:string,value:string,set:(v:string)=>void,unit='mm')=><label style={label}>{title} ({unit})<input style={field} inputMode="decimal" type="number" min="0" step="any" value={value} onChange={e=>set(e.target.value)}/></label>;
const pageTitle=section==='addresses'?'Addresses':section==='measurements'?'Measurements':'Tools';
const pageDescription=section==='addresses'?'Manage saved client, supplier and site locations.':section==='measurements'?'Site calculators for slats, floors and angles.':'Practical calculators and site information for joinery work.';
return <main className={'rev-shell dj-full-desktop dj-functional dj-unified-page dj-tools-page dj-tools-'+(section||'home')}><DesktopSidebar active="tools"/><div className="rev-phone rev-inner dj-unified-content" style={{padding:24,maxWidth:1400,width:'100%'}}><header className="dj-page-header"><p className="rev-kicker-light">{section?'DELTA JOINERY / TOOLS':'DELTA JOINERY'}</p><h1>{pageTitle}</h1><p>{pageDescription}</p></header>
{section===''&&<div className="dj-mobile-tools-hub"><div className="dj-mobile-tools-banner"><h2>Everything you need,<br/>in one place.</h2><p>The same tools on your phone and desktop.</p></div><div className="dj-mobile-tools-grid">{[['/units','⬡','Price Library','Materials and rates'],['/quotes','▤','Saved Quotations','Review and manage'],['/preview','▣','Preview / PDF','Export and share'],['/hours','◷','My Hours','Workshop timesheets'],['/tools/skoda','▣','Škoda Installations','Material collection planner'],['/tools/addresses','⌖','Addresses','Locations and Eircodes'],['/tools/measurements','◺','Measurements','Jobsite calculators'],['/tools/cutting-list','☷','Cutting List','Sheets, kerf and cutting layouts']].map(([href,ic,title,description])=><Link key={href} href={href} className="dj-mobile-tools-card"><span>{ic}</span><b>{title}</b><small>{description}</small></Link>)}</div></div>}
{section===''&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>{link('/tools/skoda','▣  Škoda Installations')}{link('/tools/addresses','⌖  Addresses')}{link('/tools/measurements','▱  Measurements')}{link('/tools/cutting-list','▤  Cutting List')}</div>}
{section==='addresses'&&<div className="dj-tools-stack dj-address-page" style={{display:'grid',gap:16}}><div className="dj-glass-card dj-address-form" style={box}><form onSubmit={async e=>{e.preventDefault();if(!name.trim()||!eircode.trim())return;const next=editing?addresses.map(x=>x.id===editing?{...x,name:name.trim(),eircode:eircode.trim().toUpperCase()}:x):[{id:crypto.randomUUID(),name:name.trim(),eircode:eircode.trim().toUpperCase()},...addresses];if(await save(next)){setName('');setEircode('');setEditing(null)}}} style={{display:'grid',gap:12,maxWidth:600}}><label style={label}>Location name<input style={field} required placeholder="Client – Lucan" value={name} onChange={e=>setName(e.target.value)}/></label><label style={label}>Eircode<input style={field} required placeholder="K78 XXXX" value={eircode} onChange={e=>setEircode(e.target.value)}/></label><div style={{display:'flex',gap:10}}><button disabled={savingAddress} style={primary} type="submit">{editing?'Save changes':'Save address'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setName('');setEircode('')}}>Cancel</button>}</div><p role="status" style={{fontSize:13,color:saveStatus.startsWith("Not saved")?"#9a332c":"#276044"}}>{saveStatus}</p></form></div><div className="dj-glass-card dj-address-list" style={box}><h3>Saved destinations</h3><div style={{position:'relative',marginTop:14}}><input type="search" aria-label="Search saved addresses" placeholder="Search by client, location or Eircode…" value={addressSearch} onChange={e=>setAddressSearch(e.target.value)} style={{...field,paddingRight:44}}/></div><p style={{color:'#6b7b72',fontSize:12,marginTop:8}}>{addressSearch.trim()?`${matchingAddresses.length} matching address${matchingAddresses.length===1?'':'es'}`:`${addresses.length} saved address${addresses.length===1?'':'es'}`}</p><div style={{display:'grid',gap:10,marginTop:18}}>{groupedAddresses.map(group=>{
 const multiple=group.items.length>1; // retained for saved data compatibility
 const isOpen=openSupplier===group.key;
 return <div key={group.key} className="dj-address-group" style={{border:'1px solid #e2ebe5',borderRadius:16,background:'#fff',boxShadow:'0 8px 24px rgba(20,55,41,.05)',overflow:'hidden',marginBottom:2}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',alignItems:'center',padding:'16px 16px 14px'}}>
   <button type="button" onClick={()=>{setOpenSupplier(isOpen?null:group.key);setAddingSupplier(null)}} aria-expanded={isOpen} style={{background:'transparent',border:0,padding:0,textAlign:'left',cursor:'pointer',color:'inherit',flex:'1 1 260px',display:'flex',alignItems:'center',gap:12}}><span aria-hidden="true" style={{width:38,height:38,borderRadius:10,background:'#eef4f0',display:'grid',placeItems:'center',fontSize:18}}>⌖</span><span>
    <strong style={{fontSize:16,display:'block'}}>{group.label}</strong>
    <span style={{display:'block',fontSize:13,color:'#6b7b72',marginTop:3}}>{group.items.length} saved location{group.items.length===1?'':'s'}</span></span>
   </button>
   <button type="button" onClick={()=>{setOpenSupplier(isOpen?null:group.key);setAddingSupplier(null)}} style={{...primary,background:'#edf5f0',color:'#173e2e',padding:'10px 14px',fontWeight:700}}>{group.items.length} Location{group.items.length===1?'':'s'} {isOpen?'↑':'↓'}</button>
  </div>
  {isOpen&&<div className="dj-address-group-body" style={{borderTop:'1px solid #edf1ee',padding:'4px 14px 14px',background:'#fff',display:'grid',gap:0}}>
   {group.items.map(x=><div key={x.id} className="dj-address-row" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'13px 2px',borderBottom:'1px solid #edf1ee'}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}><span aria-hidden="true">📍</span><div><strong style={{fontSize:14}}>{addressLocation(x.name)}</strong><div style={{fontSize:13,color:'#6b7b72'}}>{x.eircode}</div></div></div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}><button className="dj-icon-action" title="Edit" type="button" onClick={()=>{setEditing(x.id);setName(x.name);setEircode(x.eircode);window.scrollTo({top:0,behavior:'smooth'})}} style={{width:40,height:40,cursor:'pointer',fontSize:17}}>✎</button><a className="dj-primary-action" style={{textDecoration:'none',padding:'10px 14px',fontWeight:700}} href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(x.eircode+', Ireland')+'&travelmode=driving'} target="_blank" rel="noopener noreferrer">Go Now ↗</a></div>
   </div>)}
   {addingSupplier===group.key?<form onSubmit={async e=>{e.preventDefault();if(!newLocation.trim()||!newLocationEircode.trim())return;const item:Address={id:crypto.randomUUID(),name:`${group.label} (${newLocation.trim()})`,eircode:newLocationEircode.trim().toUpperCase()};if(await save([item,...addresses])){setNewLocation('');setNewLocationEircode('');setAddingSupplier(null)}}} style={{display:'grid',gridTemplateColumns:'minmax(180px,1fr) minmax(140px,.6fr) auto',gap:8,marginTop:6}}>
    <input aria-label="Location name" placeholder="Location e.g. Blanchardstown" value={newLocation} onChange={e=>setNewLocation(e.target.value)} style={{...field,padding:'10px'}} required/>
    <input aria-label="Location Eircode" placeholder="Eircode / postcode" value={newLocationEircode} onChange={e=>setNewLocationEircode(e.target.value)} style={{...field,padding:'10px'}} required/>
    <button disabled={savingAddress} style={{...primary,padding:'10px 14px'}} type="submit">Add</button>
   </form>:<button className="dj-secondary-action" type="button" onClick={()=>{setAddingSupplier(group.key);setNewLocation('');setNewLocationEircode('')}} style={{marginTop:10,width:'100%',borderRadius:12,padding:'12px 14px',cursor:'pointer',fontWeight:700}}>＋ Add another location</button>}
  </div>}
 </div>
})}{addresses.length===0?<p>No addresses saved yet.</p>:matchingAddresses.length===0?<p>No matches found. Try a different name or Eircode.</p>:null}</div></div></div>}
{section==='measurements'&&<><div className="dj-segmented-control" style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:18}}>{[['slats','Slatted Wall'],['floor','Floor Coverage'],['angle','Angle Finder']].map(([id,title])=><button type="button" key={id} className={'dj-segment-btn '+(mode===id?'active':'')} style={{...primary}} onClick={()=>setMode(id)}>{title}</button>)}</div>
{mode==='slats'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,350px),1fr))',gap:18}}><div className="dj-glass-card" style={box}><h2>Slatted wall calculator</h2><p>Enter the wall size, slat width and exact number of slats. The equal gap is calculated automatically.</p><div style={{display:'grid',gap:12}}>{input('Wall width',width,setWidth)}{input('Wall height',height,setHeight)}{input('Slat width',slat,setSlat)}<label style={label}>Number of slats<input style={field} inputMode="numeric" type="number" min="2" max="500" step="1" value={slatCount} onChange={e=>setSlatCount(e.target.value)}/></label><label style={label}>Gap override (mm) <span style={{fontWeight:400,opacity:.72}}>Leave blank for perfect equal spacing</span><input style={field} inputMode="decimal" type="number" min="0" step="0.01" placeholder={autoGap>=0?autoGap.toFixed(2):'Not enough wall width'} value={gapOverride} onChange={e=>setGapOverride(e.target.value)}/></label>{hasGapOverride&&<button type="button" onClick={()=>setGapOverride('')} style={{...primary,background:'rgba(255,255,255,.08)',width:'fit-content'}}>Use automatic gap</button>}</div><div style={{marginTop:18,background:'#eaf4ec',padding:15,borderRadius:12,color:'#173e2e'}}>{slatLayoutValid?<><strong>Perfect equal gap: {Math.max(0,autoGap).toFixed(2)} mm</strong><p>Using gap: <b>{actualGap.toFixed(2)} mm</b>{hasGapOverride?' (manual override)':' (automatic)'}</p><p>Slats: <b>{qty}</b> · Gaps: <b>{Math.max(0,qty-1)}</b></p>{hasGapOverride&&<p>Side margins after centring: <b>{Math.max(0,sideMargin).toFixed(2)} mm each</b></p>}<p>Total slat face width: {(slatTotal/1000).toFixed(3)} m</p><p>Slat face area: {(slatTotal*H/1000000).toFixed(3)} m²</p></>:<><strong>Layout cannot fit.</strong><p>Reduce the number/width of slats or increase the wall width{hasGapOverride?' / reduce the manual gap':''}.</p></>}</div><button type="button" disabled={!slatLayoutValid} onClick={downloadSlatDrawing} style={{...primary,marginTop:14,opacity:slatLayoutValid?1:.45,cursor:slatLayoutValid?'pointer':'not-allowed'}}>Download technical drawing (PDF)</button></div><div className="dj-glass-card" style={box}><h2>Dimensioned wall elevation</h2><svg width="100%" viewBox="0 0 620 390" role="img" aria-label="Dimensioned slatted wall technical elevation"><defs><marker id="dj-dim-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M6 0 L0 3 L6 6" fill="none" stroke="#9fb6a8" strokeWidth="1"/></marker></defs><rect x="72" y="48" width="500" height="270" fill="#26382e" stroke="#a6b9ad" strokeWidth="1"/>{slatLayoutValid&&Array.from({length:Math.min(qty,250)},(_,i)=>{const start=Math.max(0,sideMargin);return <rect key={i} x={72+((start+i*(S+actualGap))/Math.max(W,1))*500} y="48" width={Math.max(.65,S/Math.max(W,1)*500)} height="270" fill="#b98d5b"/>})}<path d="M72 332 V344 M572 332 V344 M72 339 H572" stroke="#9fb6a8"/><text x="322" y="360" textAnchor="middle" fill="#dce8e1" fontSize="14">WALL WIDTH {W.toFixed(1)} mm</text><path d="M56 48 H44 M56 318 H44 M49 48 V318" stroke="#9fb6a8"/><text x="27" y="183" textAnchor="middle" fill="#dce8e1" fontSize="13" transform="rotate(-90 27 183)">WALL HEIGHT {H.toFixed(1)} mm</text>{slatLayoutValid&&qty>=2&&<><path d={'M72 34 H'+(72+(S/Math.max(W,1))*500)} stroke="#9fb6a8"/><text x={72+(S/Math.max(W,1))*250} y="28" textAnchor="middle" fill="#dce8e1" fontSize="11">{S.toFixed(2)} mm slat</text>{actualGap>0&&<><path d={'M'+(72+(S/Math.max(W,1))*500)+' 18 H'+(72+((S+actualGap)/Math.max(W,1))*500)} stroke="#9fb6a8"/><text x={72+((S+actualGap/2)/Math.max(W,1))*500} y="13" textAnchor="middle" fill="#dce8e1" fontSize="10">{actualGap.toFixed(2)} mm gap</text></>}</>}<text x="72" y="380" fill="#aabfb3" fontSize="11">{qty} slats · {Math.max(0,qty-1)} equal gaps{hasGapOverride?' · manual gap override':''}</text></svg><p style={{color:'#9fb6a8',fontSize:13}}>Drawing dimensions update live. Automatic mode fits the first and last slat exactly to the wall edges. If you override the gap, the slat field is centred and the remaining side margins are shown in the calculation.</p></div></div>}
{mode==='floor'&&<div className="dj-glass-card" style={box}><h2>Floor coverage</h2><p>Enter the length and width of your space to calculate the floor area.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14,maxWidth:650}}>{input('Length',floorL,setFloorL,'m')}{input('Width',floorW,setFloorW,'m')}</div><div style={{marginTop:20,background:'#eaf4ec',padding:22,borderRadius:12}}><span style={{fontSize:13}}>Total area</span><h2 style={{fontSize:35,margin:'8px 0',color:'#173e2e'}}>{area.toFixed(2)} m²</h2><p style={{margin:0}}>{num(floorL)} m × {num(floorW)} m</p></div></div>}
{mode==='angle'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}><div className="dj-glass-card" style={box}><h2>Angle finder</h2><p>Measure from a corner along both walls, then measure diagonally between those two points. Enter all three measurements in mm.</p><div style={{display:'grid',gap:13}}>{input('Distance along wall A',sideA,setSideA)}{input('Distance along wall B',sideB,setSideB)}{input('Diagonal between marks',diagonal,setDiagonal)}</div><div style={{marginTop:18,background:'#eaf4ec',padding:18,borderRadius:12}}>{validTriangle?<><div>Actual corner angle</div><h2 style={{fontSize:32,color:'#153e2b'}}>{angleDeg.toFixed(2)}°</h2><div>Equal mitre saw cut (each piece)</div><h2 style={{fontSize:27,color:'#153e2b'}}>{sawAngle.toFixed(2)}°</h2><p style={{fontSize:13}}>Saw setting measured from a square (90°) cut for a standard two-piece internal corner.</p></>:<p>Enter three measurements that form a valid triangle.</p>}</div></div><div className="dj-glass-card" style={box}><h2>Measuring guide</h2><svg viewBox="0 0 360 280" width="100%" role="img" aria-label="Triangle showing two wall measurements and the diagonal"><path d="M45 235 L45 45 L305 235 Z" fill="#eaf3ec" stroke="#b88951" strokeWidth="5" strokeLinejoin="round"/><text x="10" y="148" fontSize="15" fill="#143d2b">A</text><text x="176" y="258" fontSize="15" fill="#143d2b">B</text><text x="172" y="120" fontSize="15" fill="#143d2b">Diagonal</text><path d="M45 203 Q82 202 82 235" stroke="#175c3a" strokeWidth="2" fill="none"/></svg><p style={{fontSize:13,color:'#52675a'}}>Mark the same corner on both walls, measure to each mark and then between marks. The angle is calculated using the cosine rule. For unequal pieces or non-standard joinery, check the cutting orientation on a test piece.</p></div></div>}
</>}
</div></main>
}