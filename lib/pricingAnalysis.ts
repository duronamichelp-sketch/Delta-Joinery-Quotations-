import type {SavedQuotation} from './quotationTotals';
import {type Unit,unitMaterial} from './data';

export type FurnitureType='auto'|'wardrobe'|'kitchen'|'alcove'|'media'|'desk'|'storage'|'other';
type QuoteScope=Pick<SavedQuotation,'project'|'chosenUnits'|'chosenCustomProducts'>;
const round=(v:number)=>Math.round(v*100)/100;
export function identifyFurnitureType(text:string):Exclude<FurnitureType,'auto'>{
 const name=(text||'').toLowerCase();
 if(/wardrobe|closet|dressing room/.test(name))return 'wardrobe';
 if(/kitchen|island|pantry/.test(name))return 'kitchen';
 if(/alcove|recess|fireplace/.test(name))return 'alcove';
 if(/media|tv unit|television|entertainment/.test(name))return 'media';
 if(/desk|office|study/.test(name))return 'desk';
 if(/storage|cabinet|press|cupboard|locker/.test(name))return 'storage';
 return 'other';
}
const unitCount=(q:QuoteScope)=> (q.chosenUnits||[]).reduce((sum,item)=>sum+Math.max(0,Number(item.qty)||0),0);
function dominantMaterial(q:QuoteScope,units:Unit[]){
 const counts:Record<string,number>={};
 for(const item of q.chosenUnits||[]){
  const unit=units.find(u=>u.id===item.id);
  if(!unit)continue;
  const material=unitMaterial(unit);
  counts[material]=(counts[material]||0)+(Number(item.qty)||1);
 }
 const keys=Object.keys(counts);
 return keys.length?keys.sort((a,b)=>counts[b]-counts[a])[0]:null;
}
export function analyseFurniturePricing(args:{
 quote:QuoteScope&{priceAnalysisType?:FurnitureType};
 sellingPrice:number;estimatedCost?:number|null;targetMargin?:number;
 history:SavedQuotation[];units:Unit[];currentId?:string;
}){
 const {quote,units,history,currentId}=args;
 const type=args.quote.priceAnalysisType&&args.quote.priceAnalysisType!=='auto'?
 args.quote.priceAnalysisType:identifyFurnitureType(quote.project||'');
 const amount=Math.max(0,Number(args.sellingPrice)||0);
 const cost=typeof args.estimatedCost==='number'&&Number.isFinite(args.estimatedCost)&&args.estimatedCost>=0?args.estimatedCost:null;
 const marginTarget=Math.min(80,Math.max(0,Number(args.targetMargin??30)||30));
 const margin=cost!==null&&amount>0?(amount-cost)/amount*100:null;
 const required=cost!==null&&marginTarget<100?round(cost/(1-marginTarget/100)):null;
 const costStatus=cost===null?'missing':amount<=0?'empty':amount<cost?'loss':margin!==null&&margin<marginTarget?'low':'healthy';
 const scope=unitCount(quote);
 const material=dominantMaterial(quote,units);
 const comparisons=history.filter(old=>{
  if(!old.finished||old.id===currentId||old.number===currentId)return false;
  const oldType=identifyFurnitureType(old.project||old.name||'');
  if(type==='other'||oldType!==type)return false;
  const oldCount=unitCount(old);
  if(scope===0||oldCount===0)return false; // Insufficient scope information for a credible comparison
  if(Math.abs(oldCount-scope)>Math.max(1,Math.ceil(scope*.25)))return false;
  const oldMaterial=dominantMaterial(old,units);
  if(!material||!oldMaterial||material!==oldMaterial)return false;
  const oldSubtotal=typeof old.subtotalAmount==='number'?old.subtotalAmount:
   (old.costLines||[]).reduce((a,l)=>a+(Number(l.amount)||0),0);
  return Number.isFinite(oldSubtotal)&&oldSubtotal>0;
 }).map(old=>typeof old.subtotalAmount==='number'?old.subtotalAmount:
 (old.costLines||[]).reduce((a,l)=>a+(Number(l.amount)||0),0)).sort((a,b)=>a-b);
 const comparables=comparisons.length;
 const median=comparables?comparables%2?comparisons[Math.floor(comparables/2)]:
 (comparisons[comparables/2-1]+comparisons[comparables/2])/2:null;
 // Internal comparison only: not a third-party market valuation.
 const benchmarkStatus=comparables<3||median===null?'insufficient':amount<median*.75?'below':amount>median*1.25?'above':'within';
 return {type,scope,material,cost,margin,required,targetMargin:marginTarget,costStatus,
         benchmarkStatus,comparables,median:median===null?null:round(median),
         low:median===null?null:round(median*.75),high:median===null?null:round(median*1.25)};
}
