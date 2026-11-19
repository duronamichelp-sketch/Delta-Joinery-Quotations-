import type {SavedQuotation} from './quotationTotals';

export type UpcomingQuotationTask={
 id:string;
 client?:string;
 project?:string;
 notes?:string;
 created?:string;
 quotationId?:string;
 siteImages?:{path:string;name:string}[];
};

const normalized=(value?:string)=>String(value||'').trim().toLowerCase();

/**
 * Open an upcoming job by its stable task ID, never by the previously
 * active dj_quote (which is shared between devices and can be overwritten).
 */
export function quotationForUpcomingTask(task:UpcomingQuotationTask,quotes:SavedQuotation[]):Partial<SavedQuotation>{
 const linked=quotes.find(q=>q.sourceTaskId===task.id||
   (!!task.quotationId&&(q.id===task.quotationId||q.number===task.quotationId)));
 const legacy=linked?undefined:quotes.find(q=>!q.sourceTaskId&&!task.quotationId&&
   !!normalized(task.client)&&!!normalized(task.project)&&
   normalized(q.client)===normalized(task.client)&&
   normalized(q.project)===normalized(task.project));
 const saved=linked||legacy;
 const photos=new Map<string,{path:string;name:string}>();
 for(const img of [...(saved?.siteImages||[]),...(task.siteImages||[])]){
  if(img?.path&&!photos.has(img.path))photos.set(img.path,img);
 }
 return {
  ...(saved||{}),
  number:saved?.number||saved?.id,
  date:saved?.date||task.created,
  client:task.client??saved?.client??'',
  project:task.project??saved?.project??'',
  notes:task.notes??saved?.notes??'',
  sourceTaskId:task.id,
  siteImages:Array.from(photos.values())
 };
}
