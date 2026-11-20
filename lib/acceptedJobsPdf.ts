import {jsPDF} from 'jspdf';
import {
 type AcceptedJob,type WorkItem,type HandoverImage,
 SHARED_FIELDS,fieldsForWork,workName,missingHandover,formatJobPrice
} from './acceptedJobs';

type Resolver=(path:string)=>Promise<string>;
type Photo={label:string;data:string;filename:string};
const rgba={ink:[28,43,58] as [number,number,number],muted:[88,105,119] as [number,number,number],border:[203,211,217] as [number,number,number],light:[246,248,250] as [number,number,number]};
const cleanFilename=(s:string)=>s.replace(/[^a-z0-9_-]+/gi,'-').slice(0,62)||'Accepted-Job';

async function jpegFromSignedUrl(url:string):Promise<string>{
 const response=await fetch(url);
 if(!response.ok)throw new Error('Could not retrieve a saved reference image ('+response.status+'). Refresh the page or check the image.');
 const blob=await response.blob();
 if(!blob.type.startsWith('image/'))throw new Error('Reference image has an unsupported file type');
 const objectUrl=URL.createObjectURL(blob);
 try{
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{
   const image=new window.Image();
   image.onload=()=>resolve(image);
   image.onerror=()=>reject(new Error('Could not decode a reference photo. Use JPEG or PNG images.'));
   image.src=objectUrl;
  });
  const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('The browser could not prepare the reference photograph.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.84);
 }finally{URL.revokeObjectURL(objectUrl)}
}
async function resolvePhotos(images:HandoverImage[],label:string,resolve:Resolver):Promise<Photo[]>{
 const result:Photo[]=[];
 for(const img of images){
  const url=await resolve(img.path);
  result.push({label,filename:img.name,data:await jpegFromSignedUrl(url)});
 }
 return result;
}

/** Generates an internal workshop handover. Uses additional pages when multiple detailed works/photos need them. */
export async function saveAcceptedJobPdf(job:AcceptedJob,getImageUrl:Resolver):Promise<number>{
 const incomplete=missingHandover(job);
 if(incomplete.length)throw new Error('Complete all required answers or N/A before exporting. Missing: '+incomplete[0]);
 const photos=await Promise.all(job.works.map(async work=>({
  id:work.id,
  items:[...(await resolvePhotos(work.referenceImages,'Design reference',getImageUrl)),
   ...(await resolvePhotos(work.fixingImages,'Fixings / hardware reference',getImageUrl))]
 })));
 const imageMap=new Map(photos.map(x=>[x.id,x.items]));
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const w=297,h=210,margin=14,usable=w-margin*2,bottom=195;
 let y=28;
 const setColour=(rgb:[number,number,number])=>doc.setTextColor(...rgb);
 function addHeader(){
  doc.setFillColor(255,255,255);doc.rect(0,0,w,h,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(15);setColour(rgba.ink);
  doc.text('DELTA JOINERY',margin,15);
  doc.setFontSize(8.8);doc.setFont('helvetica','normal');setColour(rgba.muted);
  doc.text('ACCEPTED JOB | WORKSHOP & INSTALLATION HANDOVER',w-margin,11,{align:'right'});
  doc.text((job.project||'Accepted project').slice(0,92),w-margin,16,{align:'right'});
  doc.setDrawColor(...rgba.border);doc.line(margin,20,w-margin,20);
  y=27;
 }
 function nextPage(){
  doc.addPage();addHeader();
 }
 function space(height:number){
  if(y+height>bottom)nextPage();
 }
 function heading(name:string){
  space(name.startsWith('REFERENCE IMAGES')?66:27);doc.setFillColor(...rgba.light);doc.setDrawColor(...rgba.border);
  doc.rect(margin,y,usable,8,'FD');
  doc.setFont('helvetica','bold');doc.setFontSize(10.5);setColour(rgba.ink);
  doc.text(name,margin+3,y+5.5);y+=11;
 }
 function row(a:[string,string],b?:[string,string]){
  const gap=2;const colWidth=b?(usable-gap)/2:usable;
  const pa=doc.splitTextToSize((a[1]||'N/A').trim(),colWidth-8) as string[];
  const pb=b?doc.splitTextToSize((b[1]||'N/A').trim(),colWidth-8) as string[]:[];
  let lines=Math.max(pa.length,pb.length,1);
  let maxChunk=26;
  let index=0;
  while(index<lines){
   const take=Math.min(maxChunk,lines-index);
   const rowHeight=Math.max(12,8+take*4);
   space(rowHeight+1.4);
   const renderCell=(x:number,label:string,text:string[],chunkStart:number)=>{
    doc.setDrawColor(...rgba.border);doc.rect(x,y,colWidth,rowHeight);
    doc.setFont('helvetica','bold');doc.setFontSize(7.7);setColour(rgba.muted);
    const title=label+(chunkStart?' (continued)':'');
    doc.text(doc.splitTextToSize(title,colWidth-8)[0],x+3,y+4.5);
    doc.setFont('helvetica','normal');doc.setFontSize(9.4);setColour(rgba.ink);
    const slice=text.slice(index,index+take);
    if(slice.length)doc.text(slice,x+3,y+9,{lineHeightFactor:1.17});
   };
   renderCell(margin,a[0],pa,index);
   if(b)renderCell(margin+colWidth+gap,b[0],pb,index);
   y+=rowHeight+1.4;index+=take;
  }
 }
 function sectionText(text:string){
  const lines=doc.splitTextToSize(text,usable-8) as string[];
  row(['Summary',lines.join(' ')]);
 }
 function drawPhotos(work:WorkItem){
  const items=imageMap.get(work.id)||[];
  const sorted:Photo[]=[...items];
  const naTypes:{label:string;notApplicable:boolean;count:number}[]=[
   {label:'Design reference',notApplicable:work.referenceNA,count:work.referenceImages.length},
   {label:'Fixings / hardware reference',notApplicable:work.fixingNA,count:work.fixingImages.length}
  ];
  if(!sorted.length&&naTypes.every(x=>x.notApplicable)){
   row(['Design / reference images','N/A'],['Fixings / hardware images','N/A']);
   return;
  }
  for(const na of naTypes)if(na.notApplicable)sorted.push({label:na.label,data:'',filename:'N/A'});
  const boxW=(usable-4)/2,boxH=54;
  for(let i=0;i<sorted.length;i+=2){
   space(boxH+3);
   for(let col=0;col<2;col++){
    const entry=sorted[i+col];if(!entry)continue;
    const x=margin+col*(boxW+4);
    doc.setDrawColor(...rgba.border);doc.rect(x,y,boxW,boxH);
    doc.setFont('helvetica','bold');doc.setFontSize(8.6);setColour(rgba.ink);
    doc.text(entry.label,x+3,y+6);
    doc.setFont('helvetica','normal');doc.setFontSize(7.1);setColour(rgba.muted);
    doc.text((entry.filename||'').slice(0,67),x+3,y+11);
    if(entry.data){
     const props=doc.getImageProperties(entry.data);
     const maxW=boxW-6,maxH=boxH-17;
     const ratio=Math.min(maxW/props.width,maxH/props.height);
     const imgW=Math.max(1,props.width*ratio),imgH=Math.max(1,props.height*ratio);
     doc.addImage(entry.data,'JPEG',x+(boxW-imgW)/2,y+14+(maxH-imgH)/2,imgW,imgH);
    }else{
     doc.setFontSize(11);doc.text('N/A',x+boxW/2,y+40,{align:'center'});
    }
   }
   y+=boxH+3;
  }
 }
 addHeader();
 heading('CLIENT & PROJECT');
 const shared=SHARED_FIELDS.map(def=>{
  let value=String(job[def.id]||'');
  if(def.id==='agreedPrice')value=formatJobPrice(job);
  return [def.label,value] as [string,string];
 });
 for(let i=0;i<shared.length;i+=2)row(shared[i],shared[i+1]);
 row(['Work items included',job.works.map((w,i)=>String(i+1)+'. '+w.title+' ('+workName(w.kind)+')').join('; ')]);
 for(let i=0;i<job.works.length;i++){
  const work=job.works[i];
  heading('WORK '+(i+1)+' OF '+job.works.length+' | '+work.title.toUpperCase()+' | '+workName(work.kind).toUpperCase());
  const fields=fieldsForWork(work.kind);
  for(const group of ['Measurements','Construction & materials','Hardware & fittings','Finish & installation'] as const){
   const groupFields=fields.filter(field=>field.group===group);
   if(!groupFields.length)continue;
   space(20);
   doc.setFont('helvetica','bold');doc.setFontSize(9.2);setColour(rgba.ink);
   doc.text(group.toUpperCase(),margin,y+4);y+=7;
   for(let j=0;j<groupFields.length;j+=2){
    const f1=groupFields[j],f2=groupFields[j+1];
    row([f1.label,work.answers[f1.id]||'N/A'],f2?[f2.label,work.answers[f2.id]||'N/A']:undefined);
   }
  }
  space(12);
  heading('REFERENCE IMAGES | '+work.title);
  drawPhotos(work);
 }
 space(12);
 doc.setFont('helvetica','italic');doc.setFontSize(7.8);setColour(rgba.muted);
 doc.text('Internal production handover. Confirm site dimensions, load requirements and statutory compliance before manufacture.',margin,y+4);
 const pages=doc.getNumberOfPages();
 for(let p=1;p<=pages;p++){
  doc.setPage(p);
  doc.setDrawColor(...rgba.border);doc.line(margin,201,w-margin,201);
  doc.setFont('helvetica','normal');doc.setFontSize(7.4);setColour(rgba.muted);
  doc.text('DELTA JOINERY | ACCEPTED PROJECT | '+job.acceptedDate,margin,206);
  doc.text('PAGE '+p+' / '+pages,w-margin,206,{align:'right'});
 }
 doc.save('Delta_Joinery_Job_Handover_'+cleanFilename(job.client)+'_'+cleanFilename(job.project)+'.pdf');
 return pages;
}
