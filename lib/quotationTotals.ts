import {read, type Unit,type Hardware,type Labour,type ExtraCost,DEFAULT_HARDWARE,DEFAULT_FINISH_RATES,pricedDoor} from './data';
export type SavedQuotation={
 id:string;number?:string;date?:string;client?:string;project?:string;name?:string;savedAt?:string;includeVat?:boolean;totalAmount?:number;finished?:boolean;finishedAt?:string;siteImages?:{path:string;name:string}[];
 chosenUnits?:{id:string;qty:number;adc?:boolean;doorFinish?:string;doorSqm?:number;doorWidth?:number;doorHeight?:number;doorCount?:number}[];chosenHardware?:{id:string;qty:number}[];
 chosenLabour?:{id:string;qty:number}[];chosenElectrics?:{id:string;qty:number}[];chosenFinishes?:{id:string;qty:number}[];chosenFillers?:{id:string;qty:number}[];chosenTimber?:{id:string;qty:number}[];
};
export function savedQuoteTotal(q:SavedQuotation){
 if(typeof q.totalAmount==='number'&&Number.isFinite(q.totalAmount))return q.totalAmount;
 const units=read<Unit[]>('dj_units',[]);
 const doorRates={...DEFAULT_FINISH_RATES,...read<Record<string,number>>('dj_door_rates',{})};
 const hardware=read<Hardware[]>('dj_hardware',DEFAULT_HARDWARE);
 const labour=read<Labour[]>('dj_labour',[]);
 const electrics=read<ExtraCost[]>('dj_electrics',[]);
 const finishes=read<ExtraCost[]>('dj_finishes',[]);const fillers=read<ExtraCost[]>('dj_fillers',[]);
 let subtotal=0;
 const timberRates=read<Record<string,number>>('dj_timber_rates',{});
 for(const x of q.chosenTimber||[])subtotal+=(Number(x.qty)||0)*(timberRates[x.id]||0);
 for(const x of q.chosenUnits||[]){const u=units.find(z=>z.id===x.id);if(u)subtotal+=(Number(x.qty)||0)*(Number(u.price||0)+(x.adc?(pricedDoor({...x,hasDoors:!!x.adc,doorMaterial:'MFC',doorCount:x.doorCount||1,doorSqm:x.doorSqm||0},doorRates,u)):0))}
 for(const [items,library] of [[q.chosenHardware||[],hardware],[q.chosenLabour||[],labour],[q.chosenElectrics||[],electrics],[q.chosenFinishes||[],finishes],[q.chosenFillers||[],fillers]] as const){
  for(const x of items){const row=library.find(z=>z.id===x.id);if(row)subtotal+=(Number(x.qty)||0)*Number(row.price||0)}
 }
 return Math.round((subtotal+(q.includeVat?Math.round(subtotal*0.135*100)/100:0))*100)/100;
}
