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
const [wallName,setWallName]=useState(''),[width,setWidth]=useState('1800'),[height,setHeight]=useState('2400');
const [slatFace,setSlatFace]=useState('40'),[slatDepth,setSlatDepth]=useState('18'),[slatCount,setSlatCount]=useState('30');
const [gapInput,setGapInput]=useState('20'),[layoutDriver,setLayoutDriver]=useState<'slat'|'gap'>('slat');
const [hasBacking,setHasBacking]=useState(false),[backingThickness,setBackingThickness]=useState('6');
const [topHorizontal,setTopHorizontal]=useState(false),[bottomHorizontal,setBottomHorizontal]=useState(false);
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
const W=num(width),H=num(height);
const qty=Math.max(2,Math.min(500,Math.floor(num(slatCount)||2)));
const requestedSlatFace=Math.max(.1,num(slatFace));
const requestedGap=Math.max(0,num(gapInput));
const autoGapFromSlat=qty>1?(W-qty*requestedSlatFace)/(qty-1):0;
const autoSlatFromGap=qty>0?(W-(qty-1)*requestedGap)/qty:0;
const effectiveSlatFace=layoutDriver==='gap'?Math.max(0,autoSlatFromGap):requestedSlatFace;
const effectiveGap=layoutDriver==='gap'?requestedGap:Math.max(0,autoGapFromSlat);
const slatD=Math.max(.1,num(slatDepth));
const backingD=hasBacking?num(backingThickness):0;
const overallDepth=slatD+backingD;
const horizontalCount=(topHorizontal?1:0)+(bottomHorizontal?1:0);
const innerVerticalLength=Math.max(0,H-horizontalCount*effectiveSlatFace);
const horizontalSlatLength=Math.max(0,W-2*effectiveSlatFace);
const slatLayoutValid=W>0&&H>0&&qty>=2&&effectiveSlatFace>0&&effectiveGap>=0&&innerVerticalLength>0&&horizontalSlatLength>=0&&Math.abs(qty*effectiveSlatFace+(qty-1)*effectiveGap-W)<.11;
const verticalLengthTotal=qty===2?2*H:2*H+(qty-2)*innerVerticalLength;
const slatLinearM=(verticalLengthTotal+horizontalCount*horizontalSlatLength)/1000;
const slatFaceArea=((verticalLengthTotal*effectiveSlatFace)+(horizontalCount*horizontalSlatLength*effectiveSlatFace))/1000000;
const liveFrontScale=Math.min(540/Math.max(W,1),286/Math.max(H,1));
const liveFrontW=W*liveFrontScale,liveFrontH=H*liveFrontScale;
const liveFrontL=84+(540-liveFrontW)/2,liveFrontT=58+(286-liveFrontH)/2;
const liveFace=Math.max(.7,effectiveSlatFace*liveFrontScale);
const A=num(sideA),B=num(sideB),C=num(diagonal);const validTriangle=A>0&&B>0&&C>0&&C<A+B&&C>Math.abs(A-B);const angleDeg=validTriangle?Math.acos(Math.max(-1,Math.min(1,(A*A+B*B-C*C)/(2*A*B))))*180/Math.PI:0;const sawAngle=(180-angleDeg)/2;
const area=num(floorL)*num(floorW);
const downloadSlatDrawing=()=>{
 if(!slatLayoutValid)return;
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
 const pageW=297,pageH=210;
 const wallLabel=(wallName.trim()||'Unnamed wall').slice(0,80);
 const safeName=(wallName.trim()||'slatted-wall').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'slatted-wall';

 // PAGE FRAME + HEADER
 doc.setDrawColor(40);doc.setLineWidth(.35);doc.rect(8,8,281,194);
 doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('DELTA JOINERY',12,16);
 doc.setFontSize(10);doc.text('SLATTED WALL TECHNICAL SETTING-OUT',12,24);
 doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.text('ALL DIMENSIONS IN MILLIMETRES · VERIFY SITE DIMENSIONS BEFORE MANUFACTURE',12,30);
 doc.line(198,8,198,34);
 doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text('WALL / LOCATION',202,14);
 doc.setFontSize(10);
 const nameLines=doc.splitTextToSize(wallLabel,82).slice(0,2);
 doc.text(nameLines,202,21);
 doc.line(8,34,289,34);

 // FRONT ELEVATION ZONE
 const boxX=12,boxY=40,boxW=184,boxH=108;
 doc.setLineWidth(.25);doc.rect(boxX,boxY,boxW,boxH);
 doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('A · FRONT ELEVATION',boxX+3,boxY+6);
 doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text('FIRST + LAST VERTICAL SLATS FULL HEIGHT',boxX+3,boxY+11);

 const drawX=28,drawY=56,drawWMax=150,drawHMax=72;
 const fs=Math.min(drawWMax/Math.max(W,1),drawHMax/Math.max(H,1));
 const fW=W*fs,fH=H*fs;
 const fL=drawX+(drawWMax-fW)/2;
 const fT=drawY+(drawHMax-fH)/2;
 const pdfFace=Math.max(.25,effectiveSlatFace*fs);

 doc.setDrawColor(70);doc.rect(fL,fT,fW,fH);
 doc.setFillColor(174,128,78);
 const shortTop=fT+(topHorizontal?pdfFace:0);
 const shortH=Math.max(.25,fH-(topHorizontal?pdfFace:0)-(bottomHorizontal?pdfFace:0));
 for(let i=0;i<qty;i++){
   const px=fL+i*(effectiveSlatFace+effectiveGap)*fs;
   const isEnd=i===0||i===qty-1;
   doc.rect(px,isEnd?fT:shortTop,pdfFace,isEnd?fH:shortH,'F');
 }
 const horizontalX=fL+pdfFace;
 const horizontalW=Math.max(.25,fW-2*pdfFace);
 if(topHorizontal)doc.rect(horizontalX,fT,horizontalW,pdfFace,'F');
 if(bottomHorizontal)doc.rect(horizontalX,fT+fH-pdfFace,horizontalW,pdfFace,'F');

 // Front width dimension
 const widthDimY=fT+fH+8;
 doc.setDrawColor(65);doc.line(fL,widthDimY,fL+fW,widthDimY);
 doc.line(fL,widthDimY-2,fL,widthDimY+2);doc.line(fL+fW,widthDimY-2,fL+fW,widthDimY+2);
 doc.setFontSize(6.5);doc.text(`WALL LENGTH  ${W.toFixed(1)}`,fL+fW/2,widthDimY-2,{align:'center'});
 // Front height dimension
 const heightDimX=fL-8;
 doc.line(heightDimX,fT,heightDimX,fT+fH);
 doc.line(heightDimX-2,fT,heightDimX+2,fT);doc.line(heightDimX-2,fT+fH,heightDimX+2,fT+fH);
 doc.text(`WALL HEIGHT  ${H.toFixed(1)}`,heightDimX-2,fT+fH/2,{angle:90,align:'center'});

 // Slat + gap detail
 if(qty>=2){
   const firstEnd=fL+pdfFace;
   const secondStart=fL+(effectiveSlatFace+effectiveGap)*fs;
   const dim1=fT-6,dim2=fT-12;
   doc.line(fL,dim1,firstEnd,dim1);doc.line(fL,dim1-1.5,fL,dim1+1.5);doc.line(firstEnd,dim1-1.5,firstEnd,dim1+1.5);
   doc.text(`${effectiveSlatFace.toFixed(2)} SLAT`,(fL+firstEnd)/2,dim1-2,{align:'center'});
   if(effectiveGap>0){
     doc.line(firstEnd,dim2,secondStart,dim2);doc.line(firstEnd,dim2-1.5,firstEnd,dim2+1.5);doc.line(secondStart,dim2-1.5,secondStart,dim2+1.5);
     doc.text(`${effectiveGap.toFixed(2)} GAP`,(firstEnd+secondStart)/2,dim2-2,{align:'center'});
   }
 }
 doc.setFontSize(6);doc.text(`${qty} VERTICAL SLATS · ${qty-1} EQUAL GAPS`,boxX+3,boxY+boxH-5);

 // DEPTH SECTION ZONE
 const dx=202,dy=40,dw=83,dh=54;
 doc.rect(dx,dy,dw,dh);
 doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('B · DEPTH SECTION',dx+3,dy+6);
 doc.setFont('helvetica','normal');doc.setFontSize(6);doc.text('ROOM SIDE',dx+7,dy+14);doc.text('WALL SIDE',dx+dw-7,dy+14,{align:'right'});
 const secX=dx+12,secY=dy+21,secH=15;
 const maxDepthW=50;
 const depthScale=maxDepthW/Math.max(overallDepth,.1);
 const slatDraw=Math.max(10,slatD*depthScale);
 const backDraw=hasBacking?Math.max(5,backingD*depthScale):0;
 doc.setFillColor(174,128,78);doc.rect(secX,secY,slatDraw,secH,'F');doc.rect(secX,secY,slatDraw,secH);
 if(hasBacking){doc.setFillColor(130,140,146);doc.rect(secX+slatDraw,secY,backDraw,secH,'F');doc.rect(secX+slatDraw,secY,backDraw,secH);}
 const depthDimY=secY+secH+7;
 doc.line(secX,depthDimY,secX+slatDraw+backDraw,depthDimY);
 doc.line(secX,depthDimY-1.5,secX,depthDimY+1.5);doc.line(secX+slatDraw+backDraw,depthDimY-1.5,secX+slatDraw+backDraw,depthDimY+1.5);
 doc.setFontSize(6.5);doc.text(`OVERALL DEPTH  ${overallDepth.toFixed(2)}`,secX+(slatDraw+backDraw)/2,depthDimY-2,{align:'center'});

 // COMPONENT DETAIL ZONE
 const cx=202,cy=99,cw=83,ch=49;
 doc.rect(cx,cy,cw,ch);
 doc.setFont('helvetica','bold');doc.setFontSize(7.5);doc.text('C · COMPONENT DETAILS',cx+3,cy+6);
 doc.setFont('helvetica','normal');doc.setFontSize(6.4);
 const line1=cy+14,lineStep=6;
 doc.text(`Slat face`,cx+4,line1);doc.text(`${effectiveSlatFace.toFixed(2)}`,cx+cw-4,line1,{align:'right'});
 doc.text(`Slat depth`,cx+4,line1+lineStep);doc.text(`${slatD.toFixed(2)}`,cx+cw-4,line1+lineStep,{align:'right'});
 doc.text(`Backing`,cx+4,line1+lineStep*2);doc.text(hasBacking?`${backingD.toFixed(0)}`:'NONE',cx+cw-4,line1+lineStep*2,{align:'right'});
 doc.text(`Overall depth`,cx+4,line1+lineStep*3);doc.text(`${overallDepth.toFixed(2)}`,cx+cw-4,line1+lineStep*3,{align:'right'});
 doc.text(`Inner vertical height`,cx+4,line1+lineStep*4);doc.text(`${innerVerticalLength.toFixed(2)}`,cx+cw-4,line1+lineStep*4,{align:'right'});

 // BOTTOM TECHNICAL TITLE BLOCK / SCHEDULE
 const tx=12,ty=154,tw=273,th=42;
 doc.rect(tx,ty,tw,th);
 doc.setFont('helvetica','bold');doc.setFontSize(7);doc.text('SETTING-OUT SCHEDULE',tx+3,ty+6);
 doc.line(tx,ty+9,tx+tw,ty+9);
 doc.setFont('helvetica','normal');doc.setFontSize(6.2);

 const col1=tx+3,col2=tx+70,col3=tx+140,col4=tx+210;
 const row1=ty+16,row2=ty+23,row3=ty+30,row4=ty+37;
 doc.text('Wall size',col1,row1);doc.text(`${W.toFixed(1)} × ${H.toFixed(1)}`,col1+25,row1);
 doc.text('Vertical slats',col2,row1);doc.text(String(qty),col2+27,row1);
 doc.text('Equal gap',col3,row1);doc.text(`${effectiveGap.toFixed(2)}`,col3+25,row1);
 doc.text('Slat face',col4,row1);doc.text(`${effectiveSlatFace.toFixed(2)}`,col4+23,row1);

 doc.text('End slats',col1,row2);doc.text(`${H.toFixed(2)} FULL HEIGHT`,col1+25,row2);
 doc.text('Inner slats',col2,row2);doc.text(`${innerVerticalLength.toFixed(2)}`,col2+27,row2);
 doc.text('Slat depth',col3,row2);doc.text(`${slatD.toFixed(2)}`,col3+25,row2);
 doc.text('Backing',col4,row2);doc.text(hasBacking?`${backingD.toFixed(0)}`:'NONE',col4+23,row2);

 doc.text('Top horizontal',col1,row3);doc.text(topHorizontal?`${horizontalSlatLength.toFixed(2)} LONG`:'NONE',col1+25,row3);
 doc.text('Bottom horizontal',col2,row3);doc.text(bottomHorizontal?`${horizontalSlatLength.toFixed(2)} LONG`:'NONE',col2+27,row3);
 doc.text('Overall depth',col3,row3);doc.text(`${overallDepth.toFixed(2)}`,col3+25,row3);
 doc.text('Total slat',col4,row3);doc.text(`${slatLinearM.toFixed(3)} m`,col4+23,row3);

 doc.setFontSize(5.7);
 doc.text('Layout rule: first and last vertical slats full height; top/bottom horizontals fit between them.',col1,row4);
 doc.text('Generated by Delta Joinery Tools',tx+tw-3,row4,{align:'right'});

 doc.save(`delta-joinery-${safeName}-${Math.round(W)}x${Math.round(H)}.pdf`);
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
{mode==='slats'&&<div style={{display:'grid',gridTemplateColumns:'minmax(320px,.85fr) minmax(420px,1.3fr)',gap:18,alignItems:'start'}}>
<div className="dj-glass-card" style={box}>
 <h2>Slatted wall setting-out</h2>
 <p>Enter the finished wall size. The first slat starts flush at the left edge and the last slat finishes flush at the right edge.</p>
 <div style={{display:'grid',gap:14}}>
  <label style={label}>Wall name / location<input style={field} value={wallName} onChange={e=>setWallName(e.target.value)} placeholder="e.g. Reception feature wall"/></label>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
   {input('Wall length',width,setWidth)}
   {input('Wall height',height,setHeight)}
  </div>
  <label style={label}>Number of vertical slats<input style={field} inputMode="numeric" type="number" min="2" max="500" step="1" value={slatCount} onChange={e=>setSlatCount(e.target.value)}/></label>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
   <label style={label}>Slat face width (mm)<input style={field} inputMode="decimal" type="number" min=".1" step=".01" value={layoutDriver==='gap'?effectiveSlatFace.toFixed(2):slatFace} onChange={e=>{setSlatFace(e.target.value);setLayoutDriver('slat')}}/><span style={{fontWeight:400,opacity:.68}}>Editing this recalculates the gap.</span></label>
   <label style={label}>Gap (mm)<input style={field} inputMode="decimal" type="number" min="0" step=".01" value={layoutDriver==='slat'&&autoGapFromSlat>=0?effectiveGap.toFixed(2):gapInput} onChange={e=>{setGapInput(e.target.value);setLayoutDriver('gap')}}/><span style={{fontWeight:400,opacity:.68}}>Editing this recalculates the slat face.</span></label>
  </div>
  <label style={label}>Slat depth / thickness (mm)<input style={field} inputMode="decimal" type="number" min=".1" step=".01" value={slatDepth} onChange={e=>setSlatDepth(e.target.value)}/><span style={{fontWeight:400,opacity:.68}}>Used for the finished wall depth.</span></label>
  <div style={{display:'grid',gap:10,padding:'13px 0',borderTop:'1px solid rgba(112,190,239,.18)',borderBottom:'1px solid rgba(112,190,239,.18)'}}>
   <label style={{...label,display:'flex',alignItems:'center',gap:10}}><input type="checkbox" checked={hasBacking} onChange={e=>setHasBacking(e.target.checked)} style={{width:18,height:18}}/>Include backing board</label>
   {hasBacking&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['6','9','18','22'].map(t=><button key={t} type="button" onClick={()=>setBackingThickness(t)} style={{...primary,background:backingThickness===t?'#0c70b8':'rgba(255,255,255,.08)',padding:'9px 14px'}}>{t} mm</button>)}</div>}
  </div>
  <div style={{display:'grid',gap:9}}>
   <strong style={{fontSize:13}}>Horizontal end-to-end slats</strong>
   <label style={{...label,display:'flex',alignItems:'center',gap:10}}><input type="checkbox" checked={topHorizontal} onChange={e=>setTopHorizontal(e.target.checked)} style={{width:18,height:18}}/>Add top horizontal slat — between first and last slat</label>
   <label style={{...label,display:'flex',alignItems:'center',gap:10}}><input type="checkbox" checked={bottomHorizontal} onChange={e=>setBottomHorizontal(e.target.checked)} style={{width:18,height:18}}/>Add bottom horizontal slat — between first and last slat</label>
  </div>
 </div>
 <div style={{marginTop:18,background:'#eaf4ec',padding:15,borderRadius:12,color:'#173e2e'}}>
  {slatLayoutValid?<><strong>Setting-out fits exactly</strong><p>First slat starts: <b>0.00 mm</b></p><p>Last slat finishes: <b>{W.toFixed(2)} mm</b></p><p>Vertical slats: <b>{qty}</b> · Equal gaps: <b>{Math.max(0,qty-1)}</b></p><p>Slat face: <b>{effectiveSlatFace.toFixed(2)} mm</b> · Gap: <b>{effectiveGap.toFixed(2)} mm</b></p><p>First + last slats: <b>{H.toFixed(2)} mm full height</b></p><p>Inner vertical slats: <b>{innerVerticalLength.toFixed(2)} mm</b></p><p>Slat depth: <b>{slatD.toFixed(2)} mm</b>{hasBacking&&<> · Backing: <b>{backingD.toFixed(0)} mm</b> · Overall depth: <b>{overallDepth.toFixed(2)} mm</b></>}</p>{topHorizontal&&<p>Top horizontal: <b>{horizontalSlatLength.toFixed(2)} × {effectiveSlatFace.toFixed(2)} × {slatD.toFixed(2)} mm</b></p>}{bottomHorizontal&&<p>Bottom horizontal: <b>{horizontalSlatLength.toFixed(2)} × {effectiveSlatFace.toFixed(2)} × {slatD.toFixed(2)} mm</b></p>}</>:<><strong>Layout cannot fit.</strong><p>Check the wall dimensions, slat count, slat face width or gap.</p></>}
 </div>
 <button type="button" disabled={!slatLayoutValid} onClick={downloadSlatDrawing} style={{...primary,marginTop:14,width:'100%',opacity:slatLayoutValid?1:.45,cursor:slatLayoutValid?'pointer':'not-allowed'}}>Download technical drawing (PDF)</button>
</div>

<div style={{display:'grid',gap:14}}>
 <div className="dj-glass-card" style={box}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}><h2 style={{margin:0}}>Front profile</h2><small>First + last slats fixed to wall edges</small></div>
  <svg width="100%" viewBox="0 0 680 410" role="img" aria-label="Front elevation of slatted wall with dimensions">
   <rect x={liveFrontL} y={liveFrontT} width={liveFrontW} height={liveFrontH} fill="#26382e" stroke="#9fb6a8"/>
   {slatLayoutValid&&Array.from({length:Math.min(qty,250)},(_,i)=>{const isEnd=i===0||i===qty-1;const innerTop=liveFrontT+(topHorizontal?liveFace:0);const innerH=Math.max(1,liveFrontH-(topHorizontal?liveFace:0)-(bottomHorizontal?liveFace:0));return <rect key={i} x={liveFrontL+i*(effectiveSlatFace+effectiveGap)*liveFrontScale} y={isEnd?liveFrontT:innerTop} width={liveFace} height={isEnd?liveFrontH:innerH} fill="#b98d5b"/>})}
   {topHorizontal&&<rect x={liveFrontL+liveFace} y={liveFrontT} width={Math.max(.8,liveFrontW-2*liveFace)} height={liveFace} fill="#b98d5b"/>}
   {bottomHorizontal&&<rect x={liveFrontL+liveFace} y={liveFrontT+liveFrontH-liveFace} width={Math.max(.8,liveFrontW-2*liveFace)} height={liveFace} fill="#b98d5b"/>}
   <path d={`M${liveFrontL} ${liveFrontT+liveFrontH+14} V${liveFrontT+liveFrontH+26} M${liveFrontL+liveFrontW} ${liveFrontT+liveFrontH+14} V${liveFrontT+liveFrontH+26} M${liveFrontL} ${liveFrontT+liveFrontH+21} H${liveFrontL+liveFrontW}`} stroke="#9fb6a8"/><text x={liveFrontL+liveFrontW/2} y={liveFrontT+liveFrontH+42} textAnchor="middle" fill="#dce8e1" fontSize="14">LENGTH {W.toFixed(1)} mm</text>
   <path d={`M${liveFrontL-16} ${liveFrontT} H${liveFrontL-28} M${liveFrontL-16} ${liveFrontT+liveFrontH} H${liveFrontL-28} M${liveFrontL-23} ${liveFrontT} V${liveFrontT+liveFrontH}`} stroke="#9fb6a8"/><text x={liveFrontL-46} y={liveFrontT+liveFrontH/2} textAnchor="middle" fill="#dce8e1" fontSize="13" transform={`rotate(-90 ${liveFrontL-46} ${liveFrontT+liveFrontH/2})`}>HEIGHT {H.toFixed(1)} mm</text>
   {slatLayoutValid&&qty>=2&&<><path d={`M${liveFrontL} ${liveFrontT-16} H${liveFrontL+effectiveSlatFace*liveFrontScale}`} stroke="#9fb6a8"/><text x={liveFrontL+(effectiveSlatFace*liveFrontScale)/2} y={liveFrontT-22} textAnchor="middle" fill="#dce8e1" fontSize="10">{effectiveSlatFace.toFixed(2)} slat</text><path d={`M${liveFrontL+effectiveSlatFace*liveFrontScale} ${liveFrontT-34} H${liveFrontL+(effectiveSlatFace+effectiveGap)*liveFrontScale}`} stroke="#9fb6a8"/><text x={liveFrontL+(effectiveSlatFace+effectiveGap/2)*liveFrontScale} y={liveFrontT-40} textAnchor="middle" fill="#dce8e1" fontSize="10">{effectiveGap.toFixed(2)} gap</text></>}
   <text x={liveFrontL} y="405" fill="#aabfb3" fontSize="11">{qty} vertical slats · end slats full height {H.toFixed(2)} mm · inner slats {innerVerticalLength.toFixed(2)} mm</text>
  </svg>
 </div>

 <div className="dj-glass-card" style={box}>
  <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><h3 style={{margin:0}}>Top profile / depth</h3><small>Finished wall thickness</small></div>
  <svg width="100%" viewBox="0 0 620 230" role="img" aria-label="Depth section showing slat depth, backing thickness and overall finished depth">
   <text x="70" y="38" fill="#aabfb3" fontSize="11">ROOM SIDE</text><text x="548" y="38" textAnchor="end" fill="#aabfb3" fontSize="11">WALL SIDE</text>
   {(()=>{
     const mmScale=8;
     const slatW=Math.max(28,slatD*mmScale);
     const backingW=hasBacking?Math.max(14,backingD*mmScale):0;
     const totalW=slatW+backingW;
     const startX=310-totalW/2;
     return <g>
       <rect x={startX} y="82" width={slatW} height="52" fill="#b98d5b" stroke="#d7b786"/>
       {hasBacking&&<rect x={startX+slatW} y="82" width={backingW} height="52" fill="#77838a" stroke="#9fb6a8"/>}
       <text x={startX+slatW/2} y="112" textAnchor="middle" fill="#101c23" fontSize="12">SLAT</text>
       {hasBacking&&backingW>=42&&<text x={startX+slatW+backingW/2} y="112" textAnchor="middle" fill="#eef5f1" fontSize="11">BACKING</text>}
       <path d={`M${startX} 154 V168 M${startX+totalW} 154 V168 M${startX} 161 H${startX+totalW}`} stroke="#9fb6a8"/>
       <text x="310" y="187" textAnchor="middle" fill="#dce8e1" fontSize="14">OVERALL DEPTH {overallDepth.toFixed(2)} mm</text>
     </g>
   })()}
   <text x="195" y="216" fill="#dce8e1" fontSize="11">Slat depth {slatD.toFixed(2)} mm</text><text x="360" y="216" fill="#dce8e1" fontSize="11">Backing {hasBacking?backingD.toFixed(0)+' mm':'none'}</text>
  </svg>
 </div>
</div>
</div>}
{mode==='floor'&&<div className="dj-glass-card" style={box}><h2>Floor coverage</h2><p>Enter the length and width of your space to calculate the floor area.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14,maxWidth:650}}>{input('Length',floorL,setFloorL,'m')}{input('Width',floorW,setFloorW,'m')}</div><div style={{marginTop:20,background:'#eaf4ec',padding:22,borderRadius:12}}><span style={{fontSize:13}}>Total area</span><h2 style={{fontSize:35,margin:'8px 0',color:'#173e2e'}}>{area.toFixed(2)} m²</h2><p style={{margin:0}}>{num(floorL)} m × {num(floorW)} m</p></div></div>}
{mode==='angle'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}><div className="dj-glass-card" style={box}><h2>Angle finder</h2><p>Measure from a corner along both walls, then measure diagonally between those two points. Enter all three measurements in mm.</p><div style={{display:'grid',gap:13}}>{input('Distance along wall A',sideA,setSideA)}{input('Distance along wall B',sideB,setSideB)}{input('Diagonal between marks',diagonal,setDiagonal)}</div><div style={{marginTop:18,background:'#eaf4ec',padding:18,borderRadius:12}}>{validTriangle?<><div>Actual corner angle</div><h2 style={{fontSize:32,color:'#153e2b'}}>{angleDeg.toFixed(2)}°</h2><div>Equal mitre saw cut (each piece)</div><h2 style={{fontSize:27,color:'#153e2b'}}>{sawAngle.toFixed(2)}°</h2><p style={{fontSize:13}}>Saw setting measured from a square (90°) cut for a standard two-piece internal corner.</p></>:<p>Enter three measurements that form a valid triangle.</p>}</div></div><div className="dj-glass-card" style={box}><h2>Measuring guide</h2><svg viewBox="0 0 360 280" width="100%" role="img" aria-label="Triangle showing two wall measurements and the diagonal"><path d="M45 235 L45 45 L305 235 Z" fill="#eaf3ec" stroke="#b88951" strokeWidth="5" strokeLinejoin="round"/><text x="10" y="148" fontSize="15" fill="#143d2b">A</text><text x="176" y="258" fontSize="15" fill="#143d2b">B</text><text x="172" y="120" fontSize="15" fill="#143d2b">Diagonal</text><path d="M45 203 Q82 202 82 235" stroke="#175c3a" strokeWidth="2" fill="none"/></svg><p style={{fontSize:13,color:'#52675a'}}>Mark the same corner on both walls, measure to each mark and then between marks. The angle is calculated using the cosine rule. For unequal pieces or non-standard joinery, check the cutting orientation on a test piece.</p></div></div>}
</>}
</div></main>
}