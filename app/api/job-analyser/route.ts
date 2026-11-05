import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

function jsonFromText(text:string){
 const cleaned=text.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim();
 try{return JSON.parse(cleaned)}catch{}
 const a=cleaned.indexOf('{'),b=cleaned.lastIndexOf('}');
 if(a>=0&&b>a)return JSON.parse(cleaned.slice(a,b+1));
 throw new Error('The analyser returned an unreadable result.');
}
const num=(x:unknown)=>Number.isFinite(Number(x))?Number(x):0;
function normalise(x:any, fallbackName:string){
 const scope=Array.isArray(x?.scope)?x.scope:[];
 const costs=x?.costs||{};
 const subtotal=num(costs.subtotal)||['materials','production','cnc','finishing','installation','transport','other'].reduce((s,k)=>s+num(costs[k]),0);
 const margin=num(costs.margin);
 return {
  project:{name:String(x?.project?.name||fallbackName||'Untitled Project'),client:String(x?.project?.client||''),architect:String(x?.project?.architect||''),contractor:String(x?.project?.contractor||''),location:String(x?.project?.location||''),revision:String(x?.project?.revision||''),summary:String(x?.project?.summary||'')},
  scope:scope.map((i:any,n:number)=>({ref:String(i?.ref||`J${String(n+1).padStart(2,'0')}`),item:String(i?.item||'Joinery item'),location:String(i?.location||''),qty:Math.max(0,num(i?.qty)||1),measure:String(i?.measure||'1 unit'),material:String(i?.material||'Not specified'),description:String(i?.description||''),source:String(i?.source||''),confidence:['Confirmed','Calculated','Estimated','Missing'].includes(i?.confidence)?i.confidence:'Estimated',estimatedCost:num(i?.estimatedCost)})),
  materials:Array.isArray(x?.materials)?x.materials.map((m:any)=>({material:String(m?.material||'Material'),quantity:String(m?.quantity||'TBC'),basis:String(m?.basis||'')})):[],
  rfis:Array.isArray(x?.rfis)?x.rfis.map((r:any,n:number)=>({ref:String(r?.ref||`RFI-${String(n+1).padStart(2,'0')}`),item:String(r?.item||'General'),question:String(r?.question||''),source:String(r?.source||'')})):[],
  drawingReferences:Array.isArray(x?.drawingReferences)?x.drawingReferences.map((d:any)=>({reference:String(d?.reference||'Document'),description:String(d?.description||'')})):[],
  costs:{materials:num(costs.materials),production:num(costs.production),cnc:num(costs.cnc),finishing:num(costs.finishing),installation:num(costs.installation),transport:num(costs.transport),other:num(costs.other),subtotal,margin,total:num(costs.total)||subtotal+margin},
  assumptions:Array.isArray(x?.assumptions)?x.assumptions.map(String):[]
 };
}

export async function POST(req:Request){
 try{
  const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!token)return NextResponse.json({error:'AI analysis is not available on this deployment yet.'},{status:503});
  const form=await req.formData();
  const files=form.getAll('files').filter((x):x is File=>x instanceof File);
  const projectName=String(form.get('projectName')||'');
  const library=String(form.get('priceLibrary')||'{}');
  if(!files.length)return NextResponse.json({error:'No project files were received.'},{status:400});
  const total=files.reduce((n,f)=>n+f.size,0);
  if(total>4_000_000)return NextResponse.json({error:'This live analyser currently accepts up to 4 MB per analysis. Split very large packages into smaller batches.'},{status:413});

  const content:any[]=[{type:'text',text:`You are Delta Joinery's senior estimator. Analyse the attached project package ONLY for joinery, bespoke cabinetry, fitted furniture, architectural woodwork and directly associated installation/finishing work.

PROJECT NAME: ${projectName||'Infer from the documents'}

DELTA PRICE LIBRARY JSON:
${library.slice(0,60000)}

Rules:
- Cross-reference drawings, BOQ, specifications, schedules and notes.
- Do not invent dimensions, finishes, quantities or prices.
- Every scope item must have confidence exactly one of: Confirmed, Calculated, Estimated, Missing.
- Confirmed = explicitly stated. Calculated = mathematically derived from explicit dimensions. Estimated = reasonable allowance because exact data is unavailable. Missing = key information absent.
- Put drawing/BOQ/spec references in source wherever identifiable.
- Use m² for sheet/veneer/panel areas, lm for trims/timber/slats/plinths, units/sets/sheets where appropriate.
- Use the Delta Price Library when a matching rate exists. If no reliable rate exists, make a conservative estimator allowance and state that assumption.
- costs.total must equal subtotal + margin. Use a 15% margin unless the supplied library clearly says otherwise.
- RFIs must identify contradictions, missing specifications, missing measurements, unclear interfaces, or anything that could materially change cost.
- This is an internal estimator. Do not include VAT in total.
Return ONLY valid JSON with this exact shape:
{
 "project":{"name":"","client":"","architect":"","contractor":"","location":"","revision":"","summary":""},
 "scope":[{"ref":"J01","item":"","location":"","qty":1,"measure":"","material":"","description":"","source":"","confidence":"Confirmed","estimatedCost":0}],
 "materials":[{"material":"","quantity":"","basis":""}],
 "rfis":[{"ref":"RFI-01","item":"","question":"","source":""}],
 "drawingReferences":[{"reference":"","description":""}],
 "costs":{"materials":0,"production":0,"cnc":0,"finishing":0,"installation":0,"transport":0,"other":0,"subtotal":0,"margin":0,"total":0},
 "assumptions":[]
}`}];

  for(const file of files){
   const bytes=Buffer.from(await file.arrayBuffer());
   const mime=file.type||'application/octet-stream';
   if(mime.startsWith('text/')||/\.(csv|txt)$/i.test(file.name)){
    content.push({type:'text',text:`FILE: ${file.name}\n${bytes.toString('utf8').slice(0,120000)}`});
   }else if(mime.startsWith('image/')){
    content.push({type:'image_url',image_url:{url:`data:${mime};base64,${bytes.toString('base64')}`}});
   }else{
    content.push({type:'file',file:{filename:file.name,file_data:`data:${mime};base64,${bytes.toString('base64')}`}});
   }
  }

  const gateway=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
   method:'POST',
   headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.DELTA_ANALYSER_MODEL||'openai/gpt-6-astra',messages:[{role:'user',content}],stream:false})
  });
  const raw=await gateway.json();
  if(!gateway.ok)throw new Error(raw?.error?.message||raw?.message||'AI Gateway rejected the analysis request.');
  const text=raw?.choices?.[0]?.message?.content;
  if(typeof text!=='string')throw new Error('The analyser returned no usable content.');
  return NextResponse.json({analysis:normalise(jsonFromText(text),projectName)});
 }catch(e){
  console.error('job-analyser',e);
  return NextResponse.json({error:e instanceof Error?e.message:'Project analysis failed.'},{status:500});
 }
}
