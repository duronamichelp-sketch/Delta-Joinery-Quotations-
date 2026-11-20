'use client';
import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react';
import DesktopSidebar from '../DesktopSidebar';
import {useDeltaAccount} from '../CloudSync';
import {
 HANDOVERS_KEY,WORK_TYPES,SHARED_FIELDS,fieldsForWork,newAcceptedJob,newWork,
 workName,missingHandover,formatJobPrice,
 type AcceptedJob,type WorkKind,type WorkItem,type WorkField,type HandoverImage
} from '../../lib/acceptedJobs';
import {saveAcceptedJobPdf} from '../../lib/acceptedJobsPdf';
import './accepted-jobs.css';

type Slot='referenceImages'|'fixingImages';
const useLocalJobs=():AcceptedJob[]=>{
 try{
  const raw=JSON.parse(localStorage.getItem(HANDOVERS_KEY)||'[]');
  return Array.isArray(raw)?raw.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&Array.isArray(x.works)):[];
 }catch{return []}
};
const allImages=(job:AcceptedJob)=>job.works.flatMap(w=>[...(w.referenceImages||[]),...(w.fixingImages||[])]);
const readable=(date:string)=>{try{return new Date(date).toLocaleDateString('en-IE',{day:'2-digit',month:'short',year:'numeric'})}catch{return date}};
const cloned=(j:AcceptedJob):AcceptedJob=>JSON.parse(JSON.stringify(j)) as AcceptedJob;
const pdfError=(e:unknown)=>e instanceof Error?e.message:'Could not prepare the PDF.';

export default function AcceptedJobs(){
 const account=useDeltaAccount();
 const [jobs,setJobs]=useState<AcceptedJob[]>([]);
 const [draft,setDraft]=useState<AcceptedJob|null>(null);
 const [newKind,setNewKind]=useState<WorkKind>('door');
 const [addKind,setAddKind]=useState<WorkKind>('door');
 const [filter,setFilter]=useState('');
 const [status,setStatus]=useState('');
 const [saving,setSaving]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [exporting,setExporting]=useState(false);
 const [imageUrls,setImageUrls]=useState<Record<string,string>>({});
 const topRef=useRef<HTMLDivElement|null>(null);
 const workAreaRef=useRef<HTMLDivElement|null>(null);
 const missing=draft?missingHandover(draft):[];
 const canExport=Boolean(draft)&&missing.length===0&&!saving&&!uploading&&!exporting;
 const selectedId=draft?.id;
 const sorted=useMemo(()=>[...jobs].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
  .filter(j=>[j.client,j.project,...j.works.map(w=>w.title)].join(' ').toLowerCase().includes(filter.trim().toLowerCase())),[jobs,filter]);
 const imageKey=draft?allImages(draft).map(x=>x.path).join('|'):'';

 useEffect(()=>{
  const reload=()=>setJobs(useLocalJobs());
  reload();
  const onCloud=(e:Event)=>{if((e as CustomEvent<string>).detail===HANDOVERS_KEY)reload()};
  const onStorage=(e:StorageEvent)=>{if(e.key===HANDOVERS_KEY)reload()};
  window.addEventListener('dj-cloud-received',onCloud);
  window.addEventListener('storage',onStorage);
  return()=>{window.removeEventListener('dj-cloud-received',onCloud);window.removeEventListener('storage',onStorage)};
 },[]);

 useEffect(()=>{
  if(!draft||!account||!imageKey){setImageUrls({});return}
  let dead=false;
  const paths=Array.from(new Set(imageKey.split('|').filter(Boolean)));
  void Promise.all(paths.map(async path=>{
   try{return [path,await account.getQuotationImageUrl(path)] as const}
   catch{return [path,''] as const}
  })).then(entries=>{if(!dead)setImageUrls(Object.fromEntries(entries))});
  return()=>{dead=true};
 // Path string is stable when a user edits questions; do not request signed URLs on every keystroke.
 },[account,imageKey]);

 function start(kind:WorkKind){
  setDraft(newAcceptedJob(kind));
  setStatus('New accepted job. Fill the questions, mark non-applicable answers N/A, then save.');
  window.requestAnimationFrame(()=>topRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function open(job:AcceptedJob){
  setDraft(cloned(job));setStatus('');
  window.requestAnimationFrame(()=>topRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function cancel(){
  if(!draft)return;
  if(!window.confirm('Close this job? Unsaved form changes will be discarded.'))return;
  setDraft(null);setStatus('');
 }
 function setBase(key:keyof AcceptedJob,value:string){
  setDraft(prev=>prev?{...prev,[key]:value}:prev);
 }
 function setWork(workId:string,fn:(work:WorkItem)=>WorkItem){
  setDraft(prev=>prev?{...prev,works:prev.works.map(w=>w.id===workId?fn(w):w)}:prev);
 }
 function setAnswer(workId:string,key:string,value:string){
  setWork(workId,w=>({...w,answers:{...w.answers,[key]:value}}));
 }
 function changeKind(workId:string,kind:WorkKind){
  setWork(workId,w=>({...w,kind,title:w.title===workName(w.kind)?workName(kind):w.title}));
 }
 function addWork(){
  setDraft(prev=>prev?{...prev,works:[...prev.works,newWork(addKind)]}:prev);
  setStatus('Work item added. Complete its specification and reference images.');
  window.requestAnimationFrame(()=>workAreaRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function removeWork(id:string){
  if(!draft||draft.works.length<=1)return;
  if(!window.confirm('Remove this work item from the handover draft?'))return;
  setDraft(prev=>prev?{...prev,works:prev.works.filter(w=>w.id!==id)}:prev);
 }
 async function uploadPhotos(workId:string,slot:Slot,selection:FileList|null){
  if(!selection?.length||!draft||!account)return;
  const work=draft.works.find(w=>w.id===workId);if(!work)return;
  const files=Array.from(selection);
  const allowed=files.filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=8*1024*1024);
  if(allowed.length!==files.length){setStatus('Only JPG, PNG or WebP reference images up to 8 MB each are supported.');return}
  if((work[slot]||[]).length+allowed.length>4){setStatus('Maximum four images per reference type and work item.');return}
  setUploading(true);setStatus('Uploading reference photographs to secure job storage...');
  try{
   const uploaded=await account.uploadQuotationImages(draft.id+'-handover-'+workId+'-'+slot,allowed);
   if(uploaded.length!==allowed.length)throw new Error('One or more photos were not uploaded');
   setWork(workId,w=>({...w,[slot]:[...(w[slot]||[]),...uploaded],
    ...(slot==='referenceImages'?{referenceNA:false}:{fixingNA:false})}));
   setImageUrls(prev=>({...prev}));
   setStatus(String(uploaded.length)+' reference image(s) uploaded. Save this handover to keep the photo references.');
  }catch(e){setStatus('Image upload failed: '+pdfError(e))}
  finally{setUploading(false)}
 }
 function removePhoto(workId:string,slot:Slot,path:string){
  setWork(workId,w=>({...w,[slot]:(w[slot]||[]).filter(img=>img.path!==path)}));
  setStatus('Image removed from this draft. Save the job to confirm the change.');
 }
 async function saveDraft(){
  if(!draft||!account||saving||uploading)return;
  setSaving(true);setStatus('Saving the accepted job to Delta Joinery Cloud...');
  try{
   const now=new Date().toISOString();
   const current={...draft,updatedAt:now};
   const prior=jobs.find(j=>j.id===current.id);
   const next=[current,...jobs.filter(j=>j.id!==current.id)];
   await account.saveTool(HANDOVERS_KEY,next);
   setJobs(next);setDraft(cloned(current));
   setStatus('Saved successfully. '+(missingHandover(current).length?'Complete remaining fields to enable PDF export.':'This job is ready for PDF export.'));
   // Removed images are deleted after cloud acknowledgement, not while unsaved.
   if(prior){
    const keep=new Set(allImages(current).map(img=>img.path));
    const removed=allImages(prior).map(img=>img.path).filter(path=>!keep.has(path));
    if(removed.length){try{await account.removeQuotationImages(removed)}catch{setStatus('Job saved. Some removed image files could not be cleaned up.')}}}
  }catch(e){setStatus('Save failed: '+pdfError(e))}
  finally{setSaving(false)}
 }
 async function deleteJob(job:AcceptedJob){
  if(!account||saving||!window.confirm('Permanently delete the accepted job '+job.project+' and its saved references?'))return;
  setSaving(true);
  try{
   const next=jobs.filter(x=>x.id!==job.id);
   await account.saveTool(HANDOVERS_KEY,next);
   setJobs(next);
   if(draft?.id===job.id)setDraft(null);
   const images=allImages(job).map(x=>x.path);
   if(images.length){try{await account.removeQuotationImages(images)}catch{setStatus('Job deleted, but some image files could not be removed.');return}}
   setStatus('Accepted job deleted.');
  }catch(e){setStatus('Could not delete accepted job: '+pdfError(e))}
  finally{setSaving(false)}
 }
 async function exportPdf(){
  if(!draft||!account||!canExport)return;
  setExporting(true);setStatus('Preparing the technical PDF and reference images...');
  try{
   const pages=await saveAcceptedJobPdf(draft,path=>account.getQuotationImageUrl(path));
   setStatus('PDF generated ('+pages+' page'+(pages===1?'':'s')+'). Keep the saved handover up to date with any revised instructions.');
  }catch(e){setStatus('PDF blocked: '+pdfError(e))}
  finally{setExporting(false)}
 }
 function fieldInput(work:WorkItem,field:WorkField){
  const value=work.answers[field.id]||'';
  return <label className="dj-ah-field" key={field.id}>
   <span>{field.label} <b title="Must have an answer or N/A">*</b></span>
   <div className="dj-ah-input-wrap">
    {field.multiline
     ?<textarea value={value} maxLength={1800} rows={3} placeholder={field.placeholder||'Enter specification or N/A'} onChange={e=>setAnswer(work.id,field.id,e.target.value)}/>
     :<input value={value} maxLength={500} placeholder={field.placeholder||'Enter value or N/A'} onChange={e=>setAnswer(work.id,field.id,e.target.value)}/>}
    <button type="button" title={'Not applicable: '+field.label} className="dj-ah-na" onClick={()=>setAnswer(work.id,field.id,'N/A')}>N/A</button>
   </div>
  </label>;
 }
 function photoBox(work:WorkItem,slot:Slot){
  const isReference=slot==='referenceImages';
  const images=work[slot]||[];
  const na=isReference?work.referenceNA:work.fixingNA;
  const label=isReference?'Design / inspiration photos':'Fixings / locks / hardware photos';
  return <div className="dj-ah-photo-box" key={slot}>
   <div className="dj-ah-photo-title"><b>{label}</b><small>Attach images or confirm N/A.</small></div>
   <div className="dj-ah-photo-controls">
    <label className="dj-ah-file">
     <span>＋ Add reference image</span>
     <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading||saving} onChange={(e:ChangeEvent<HTMLInputElement>)=>{const selected=e.currentTarget.files;void uploadPhotos(work.id,slot,selected);e.currentTarget.value=''}}/>
    </label>
    <label className="dj-ah-na-check"><input type="checkbox" checked={na} disabled={images.length>0}
      onChange={e=>setWork(work.id,w=>({...w,[isReference?'referenceNA':'fixingNA']:e.target.checked}))}/> N/A</label>
   </div>
   {images.length>0?<div className="dj-ah-photo-list">{images.map(img=><div key={img.path} className="dj-ah-photo-item">
    {imageUrls[img.path]?<img src={imageUrls[img.path]} alt={img.name}/>:<div className="dj-ah-img-empty">Photo saved</div>}
    <small title={img.name}>{img.name}</small>
    <button type="button" onClick={()=>removePhoto(work.id,slot,img.path)}>Remove</button>
   </div>)}</div>:<p className="dj-ah-photo-empty">{na?'Not applicable confirmed':'No images uploaded'}</p>}
  </div>;
 }

 return <main className="rev-shell dj-full-desktop dj-functional dj-unified-page dj-handover-shell">
  <DesktopSidebar active="accepted"/>
  <div className="rev-phone rev-inner dj-unified-content dj-handover-content" ref={topRef}>
   <header className="dj-ah-top">
    <div><div className="dj-ah-kicker">DELTA JOINERY / PROJECT CONTROL</div><h1>Accepted Jobs</h1>
     <p>Turn an accepted quotation into a complete fabrication and installation handover.</p></div>
    {draft&&<button type="button" className="dj-ah-button dj-ah-muted" onClick={cancel}>Back to saved jobs</button>}
   </header>
   {!draft?<div className="dj-ah-landing">
    <section className="dj-ah-panel dj-ah-start">
     <h2>Create a job handover</h2><p>Select the first work type. You can add more work items to the same accepted job.</p>
     <div className="dj-ah-new-row">
      <label className="dj-ah-field"><span>What type of work was accepted?</span>
       <select value={newKind} onChange={e=>setNewKind(e.target.value as WorkKind)}>
        {WORK_TYPES.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select>
      </label>
      <button type="button" className="dj-ah-button dj-ah-primary" onClick={()=>start(newKind)}>＋ New accepted job</button>
     </div>
    </section>
    <section className="dj-ah-panel">
     <div className="dj-ah-panel-head"><div><h2>Saved handovers</h2><p>{jobs.length} accepted job{jobs.length===1?'':'s'} saved to your account</p></div>
      <input aria-label="Search saved jobs" className="dj-ah-search" value={filter} placeholder="Search client or job..." onChange={e=>setFilter(e.target.value)}/></div>
     {sorted.length===0?<p className="dj-ah-empty">{filter?'No saved jobs match your search.':'No accepted jobs saved yet. Create a handover above.'}</p>:
      <div className="dj-ah-saved-list">{sorted.map(job=>{
       const n=missingHandover(job).length;
       return <div className="dj-ah-saved" key={job.id}>
        <div><strong>{job.project||'Untitled accepted job'}</strong>
         <span>{job.client||'Client not entered'} · {job.works.length} work item{job.works.length===1?'':'s'} · {formatJobPrice(job)}</span>
         <small>{n?String(n)+' fields awaiting completion':'Ready for PDF'} · Updated {readable(job.updatedAt)}</small></div>
        <div className="dj-ah-saved-actions"><button type="button" onClick={()=>open(job)}>Open / Edit</button>
         <button type="button" className="dj-ah-delete" onClick={()=>void deleteJob(job)}>Delete</button></div>
       </div>})}</div>}
    </section>
   </div>:<>
    <div className="dj-ah-toolbar">
     <div><span className="dj-ah-eyebrow">JOB HANDOVER</span><strong>{draft.project||'New accepted job'}</strong><small>{draft.works.length} work item{draft.works.length===1?'':'s'} · {missing.length?String(missing.length)+' answers needed':'All required information completed'}</small></div>
     <div className="dj-ah-toolbar-buttons">
      <button type="button" className="dj-ah-button dj-ah-muted" disabled={saving||uploading||exporting} onClick={()=>void saveDraft()}>{saving?'Saving...':'Save draft'}</button>
      <button type="button" className="dj-ah-button dj-ah-primary" disabled={!canExport} title={missing.length?'Complete all required answers or N/A to export':''} onClick={()=>void exportPdf()}>{exporting?'Generating PDF...':'Download PDF'}</button>
     </div>
    </div>
    <section className="dj-ah-panel"><div className="dj-ah-step"><span>01</span><div><h2>Client & accepted job details</h2><p>These details appear on the handover for every work item.</p></div></div>
     <div className="dj-ah-fields">
      {SHARED_FIELDS.map(field=><label className={'dj-ah-field '+(field.multiline?'dj-ah-wide':'')} key={field.id}>
       <span>{field.label} <b>*</b></span>
       <div className="dj-ah-input-wrap">
        {field.id==='vatBasis'?<select value={String(draft[field.id]||'')} onChange={e=>setBase(field.id,e.target.value)}>
         <option value="">Select VAT treatment</option><option value="Including VAT">Including VAT</option><option value="Excluding VAT">Excluding VAT</option><option value="N/A">N/A</option>
        </select>:field.multiline?
         <textarea rows={3} maxLength={1800} value={String(draft[field.id]||'')} placeholder={field.placeholder} onChange={e=>setBase(field.id,e.target.value)}/>
         :<input value={String(draft[field.id]||'')} maxLength={500} placeholder={field.placeholder}
          inputMode={field.id==='agreedPrice'?'decimal':'text'} onChange={e=>setBase(field.id,e.target.value)}/>}
        {field.id!=='vatBasis'&&<button type="button" className="dj-ah-na" onClick={()=>setBase(field.id,'N/A')}>N/A</button>}
       </div>
      </label>)}
     </div>
    </section>
    <div ref={workAreaRef}>
     {draft.works.map((work,index)=><section className="dj-ah-panel" key={work.id}>
      <div className="dj-ah-work-top">
       <div className="dj-ah-step"><span>{String(index+2).padStart(2,'0')}</span><div><h2>Work {index+1} — {work.title||workName(work.kind)}</h2>
        <p>Manufacturing specification, required materials and installation instructions.</p></div></div>
       {draft.works.length>1&&<button type="button" className="dj-ah-text-danger" onClick={()=>removeWork(work.id)}>Remove work</button>}
      </div>
      <div className="dj-ah-fields dj-ah-work-name">
       <label className="dj-ah-field"><span>Work type</span><select value={work.kind} onChange={e=>changeKind(work.id,e.target.value as WorkKind)}>
        {WORK_TYPES.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
       <label className="dj-ah-field"><span>Work name / location <b>*</b></span><input value={work.title} maxLength={120} placeholder="e.g. Bedroom 1 wardrobe"
        onChange={e=>setWork(work.id,w=>({...w,title:e.target.value}))}/></label>
      </div>
      {(['Measurements','Construction & materials','Hardware & fittings','Finish & installation'] as const).map(group=>{
       const fields=fieldsForWork(work.kind).filter(field=>field.group===group);
       return fields.length?<div className="dj-ah-group" key={group}>
        <div className="dj-ah-group-title">{group}</div><div className="dj-ah-fields">{fields.map(field=>fieldInput(work,field))}</div>
       </div>:null;
      })}
      <div className="dj-ah-group"><div className="dj-ah-group-title">Reference photographs</div>
       <div className="dj-ah-photo-grid">{photoBox(work,'referenceImages')}{photoBox(work,'fixingImages')}</div>
      </div>
     </section>)}
    </div>
    <section className="dj-ah-panel dj-ah-add-more"><div><h2>Multiple work items?</h2><p>Add a door, wardrobe, stairs or any other work to this handover. All items share the same client details and agreed price.</p></div>
     <div className="dj-ah-add-actions"><select aria-label="Additional work type" value={addKind} onChange={e=>setAddKind(e.target.value as WorkKind)}>
      {WORK_TYPES.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select>
      <button type="button" className="dj-ah-button dj-ah-muted" onClick={addWork}>＋ Add another work</button></div>
    </section>
    <section className="dj-ah-panel dj-ah-validation">
     <div className="dj-ah-panel-head"><div><h2>Print-ready checklist</h2><p>Drafts can be saved at any stage. PDF export stays locked until every answer is supplied or N/A.</p></div>
      <strong className={missing.length?'dj-ah-pending':'dj-ah-ready'}>{missing.length?String(missing.length)+' missing':'Ready to print'}</strong></div>
     {missing.length>0?<div className="dj-ah-missing"><p>Complete the following questions. N/A is permitted where genuinely not applicable.</p>
      <ul>{missing.slice(0,12).map((m,i)=><li key={i}>{m}</li>)}</ul>{missing.length>12&&<small>+ {missing.length-12} more unanswered requirements</small>}</div>:
      <p className="dj-ah-all-done">Every required answer and reference-image decision is complete. The PDF will include all work items and expand to additional pages if necessary.</p>}
     <div className="dj-ah-actions">
      <button type="button" className="dj-ah-button dj-ah-muted" disabled={saving||uploading||exporting} onClick={()=>void saveDraft()}>{saving?'Saving...':'Save accepted job'}</button>
      <button type="button" className="dj-ah-button dj-ah-primary" disabled={!canExport} onClick={()=>void exportPdf()}>{exporting?'Generating...':'Download job PDF'}</button>
     </div>
    </section>
   </>}
   {status&&<p role="status" className="dj-ah-status">{status}</p>}
  </div>
 </main>;
}
