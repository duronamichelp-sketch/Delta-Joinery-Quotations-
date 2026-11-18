import {read, type Unit,type Hardware,type Labour,type ExtraCost,DEFAULT_HARDWARE,DEFAULT_FINISH_RATES,pricedDoor,doorLeafBreakdown,DEFAULT_PRODUCTION_COSTS,productionCostsWithDefaults,cncCostsWithDefaults,shelvesTotal,shelfDimensions,shelfPrice,type UnitMaterial,measuredTrimPrice,type MeasuredTrimType} from './data';

export type SavedQuoteLine={category:string;description:string;qty:number;rate:number;amount:number;unit?:string};
export type SavedQuoteBreakdown={key:string;label:string;amount:number};

export type SavedQuotation={
 id:string;number?:string;date?:string;client?:string;project?:string;name?:string;savedAt?:string;sourceTaskId?:string;
 email?:string;phone?:string;address?:string;notes?:string;
 includeVat?:boolean;includeUplift?:boolean;upliftPercent?:number|string;totalAmount?:number;subtotalAmount?:number;vatAmount?:number;
 finished?:boolean;finishedAt?:string;siteImages?:{path:string;name:string}[];
 costLines?:SavedQuoteLine[];costBreakdown?:SavedQuoteBreakdown[];
 chosenUnits?:{id:string;qty:number;customName?:string;customPrice?:number;adc?:boolean;hasDoors?:boolean;doorMaterial?:string;doorCount?:number;doorSqm?:number;doorWidth?:number;doorHeight?:number;doorFinish?:string;doorCategory?:string;ais?:boolean;shelfMaterial?:UnitMaterial;shelfQty?:number}[];
 chosenHardware?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenLabour?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenCnc?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenProduction?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenElectrics?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenFinishes?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenFillers?:{id:string;qty:number;customName?:string;customPrice?:number;trimType?:MeasuredTrimType;trimMaterial?:UnitMaterial;trimHeight?:number;trimWidth?:number}[];
 chosenTimber?:{id:string;qty:number;customName?:string;customPrice?:number}[];
 chosenWorktops?:{id:string;name:string;qty:number;rate:number;unit:string}[];
 chosenCustomProducts?:{id:string;name:string;price?:number;lines?:{id:string;description:string;price:number}[]}[];
};

const DEFAULT_CNC=[
 {id:'cnc-0',name:'MDF 22 Strada Handle',price:10,unit:'door'},
 {id:'cnc-1',name:'Frame Door',price:10,unit:'door'},
 {id:'cnc-2',name:'Shaker Door',price:25,unit:'door'},
 {id:'cnc-3',name:'Grooving',price:50,unit:'m²'},
 {id:'cnc-4',name:'Decor Pieces - High Complexity',price:45,unit:'each'},
 {id:'cnc-5',name:'Decor Pieces - Medium Complexity',price:30,unit:'each'},
 {id:'cnc-6',name:'Decor Pieces - Low Complexity',price:15,unit:'each'},
 {id:'cnc-7',name:'Bent Panel',price:120,unit:'each'},
 {id:'cnc-8',name:'Bent Panel - Shaker Door',price:170,unit:'each'},
 {id:'cnc-9',name:'Bent Panel - Big Piece',price:190,unit:'each'},
 {id:'cnc-10',name:'Bent Panel - Big Piece Shaker Door',price:240,unit:'each'},
 {id:'cnc-11',name:'Built-in Handle',price:20,unit:'door'},
 {id:'cnc-12',name:'PVC Film Covering',price:20,unit:'piece'}
];

const round=(n:number)=>Math.round((Number(n)||0)*100)/100;

// Allocate the uplift across individual quoted units rather than applying one
// undisclosed lump sum. Cent remainders are distributed deterministically.
export function distributeQuotationUplift<T extends {qty:number;amount:number}>(rows:T[],enabled?:boolean,percentage?:number|string):T[]{
 const percent=enabled?Math.max(0,Math.min(1000,Number(percentage)||0)):0;
 if(!percent)return rows.map(row=>({...row}));
 const eligible=rows.map((row,index)=>({index,qty:Math.max(0,Math.round(Number(row.qty)||0))})).filter(x=>x.qty>0);
 const itemCount=eligible.reduce((sum,x)=>sum+x.qty,0);
 if(!itemCount)return rows.map(row=>({...row}));
 const baseCents=Math.round(rows.reduce((sum,row)=>sum+(Number(row.amount)||0),0)*100);
 const increaseCents=Math.round(baseCents*percent/100);
 const share=Math.floor(increaseCents/itemCount);
 let remainder=increaseCents-share*itemCount;
 const extra=rows.map(()=>0);
 for(const {index,qty} of eligible){const cents=share*qty+Math.min(qty,remainder);extra[index]=cents;remainder-=Math.min(qty,remainder)}
 return rows.map((row,index)=>({...row,amount:round((Math.round((Number(row.amount)||0)*100)+extra[index])/100)}));
}


export function savedQuoteDetails(q:SavedQuotation){
 const units=read<Unit[]>('dj_units',[]);
 const doorRates={...DEFAULT_FINISH_RATES,...read<Record<string,number>>('dj_door_rates',{})};
 const hardware=read<Hardware[]>('dj_hardware',DEFAULT_HARDWARE);
 const labour=read<Labour[]>('dj_labour',[]);
 const electrics=read<ExtraCost[]>('dj_electrics',[]);
 const finishes=read<ExtraCost[]>('dj_finishes',[]);
 const fillers=read<ExtraCost[]>('dj_fillers',[]);
 const timberRates=read<Record<string,number>>('dj_timber_rates',{});
 const cnc=cncCostsWithDefaults(read<{id:string;name:string;price:number;unit:string}[]>('dj_cnc_production',DEFAULT_CNC),read<{id:string;name:string;price:number;unit:string}[]>('dj_production_costs',DEFAULT_PRODUCTION_COSTS));
 const production=productionCostsWithDefaults(read<{id:string;name:string;price:number;unit:string}[]>('dj_production_costs',DEFAULT_PRODUCTION_COSTS));

 const lines:SavedQuoteLine[]=[];
 const addLine=(category:string,description:string,qty:number,rate:number,unit?:string)=>{
  const qn=Number(qty)||0,rn=Number(rate)||0;
  if(qn<=0)return;
  lines.push({category,description,qty:qn,rate:rn,amount:round(qn*rn),unit});
 };

 for(const x of q.chosenUnits||[]){
  const u=units.find(z=>z.id===x.id);
  if(!u&&!x.customName)continue;
  addLine('Units',x.customName||u!.name,Number(x.qty)||0,x.customName?(Number(x.customPrice)||0):(Number(u!.price)||0),'unit');
  if(x.adc&&u){
   const doorRate=pricedDoor({...x,hasDoors:!!x.adc,doorMaterial:'MFC',doorCount:x.doorCount||1,doorSqm:x.doorSqm||0} as any,doorRates,u);
   if(doorRate>0)addLine('Doors',`${u.name} — ${doorLeafBreakdown(x as any,doorRates,u).count} × ${x.doorFinish||'Door'} (${Number(doorLeafBreakdown(x as any,doorRates,u).leafWidth.toFixed(2))} × ${u.height} mm, €${doorLeafBreakdown(x as any,doorRates,u).priceEach.toFixed(2)} each)`,Number(x.qty)||0,doorRate,'door set');
  }
  if(x.ais&&u){
   const shelfRate=shelvesTotal(x,u);
   if(shelfRate>0){
    const size=shelfDimensions(u);
    const material=x.shelfMaterial||'MFC';
    addLine('Shelves',`${u.name} — AIS ${x.shelfQty||0} × ${material} shelves (${size.width} × ${size.depth} mm)`,Number(x.qty)||0,shelfRate,'shelf set');
   }
  }
 }
 for(const x of q.chosenHardware||[]){const row=hardware.find(z=>z.id===x.id);if(x.customName)addLine('Hardware',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Hardware',row.name,x.qty,row.price,'each')}
 for(const x of q.chosenLabour||[]){const row=labour.find(z=>z.id===x.id);if(x.customName)addLine('Labour',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Labour',row.name,x.qty,row.price,row.unit)}
 for(const x of q.chosenElectrics||[]){const row=electrics.find(z=>z.id===x.id);if(x.customName)addLine('Electrics',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Electrics',row.name,x.qty,row.price,'each')}
 for(const x of q.chosenFinishes||[]){const row=finishes.find(z=>z.id===x.id);if(x.customName)addLine('Finishes',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Finishes',row.name,x.qty,row.price,'each')}
 for(const x of q.chosenFillers||[]){const row=fillers.find(z=>z.id===x.id);if(x.trimType){const material=x.trimMaterial||'MFC';addLine('Fillers / Plinths & Coving',`${x.trimType} — ${material} (${x.trimHeight||0} × ${x.trimWidth||0} mm)`,x.qty,measuredTrimPrice(x.trimHeight||0,x.trimWidth||0,material),'piece')}else if(x.customName)addLine('Fillers / Plinths & Coving',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Fillers / Plinths & Coving',row.name,x.qty,row.price,'each')}
 for(const x of q.chosenTimber||[]){addLine('Timber',x.customName||x.id,x.qty,x.customName?(Number(x.customPrice)||0):(timberRates[x.id]||0),'ft')}
 for(const x of q.chosenWorktops||[]){addLine('Worktops',x.name,x.qty,x.rate,x.unit)}
 for(const x of q.chosenCnc||[]){const row=cnc.find(z=>z.id===x.id);if(x.customName)addLine('CNC Production',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('CNC Production',row.name,x.qty,row.price,row.unit)}
 for(const x of q.chosenProduction||[]){const row=production.find(z=>z.id===x.id)||cnc.find(z=>z.id===x.id&&x.id.startsWith('prod-cnc-'));if(x.customName)addLine('Production Costs',x.customName,x.qty,Number(x.customPrice)||0,'each');else if(row)addLine('Production Costs',row.name,x.qty,row.price,row.unit)}
 for(const product of q.chosenCustomProducts||[]){const price=typeof product.price==='number'?product.price:(product.lines||[]).reduce((s,l)=>s+(Number(l.price)||0),0);addLine('Custom Products',product.name,1,price,'item')}

 const effectiveLines=q.costLines?.length?q.costLines:distributeQuotationUplift(lines,q.includeUplift,q.upliftPercent);
 const categoryOrder=['Units','Doors','Shelves','Hardware','Labour','Electrics','Finishes','Fillers / Plinths & Coving','Timber','Worktops','CNC Production','Production Costs','Custom Products'];
 const computedBreakdown=categoryOrder.map((label,index)=>({
  key:String(index+1),
  label,
  amount:round(effectiveLines.filter(x=>x.category===label).reduce((sum,x)=>sum+(Number(x.amount)||0),0))
 }));
 const breakdown=q.costBreakdown?.length?q.costBreakdown:computedBreakdown;
 const computedSubtotal=round(breakdown.reduce((sum,x)=>sum+(Number(x.amount)||0),0));
 const subtotal=typeof q.subtotalAmount==='number'&&Number.isFinite(q.subtotalAmount)?q.subtotalAmount:computedSubtotal;
 const vat=typeof q.vatAmount==='number'&&Number.isFinite(q.vatAmount)?q.vatAmount:(q.includeVat?round(subtotal*0.135):0);
 const total=typeof q.totalAmount==='number'&&Number.isFinite(q.totalAmount)?q.totalAmount:round(subtotal+vat);
 return {lines:effectiveLines,breakdown,subtotal:round(subtotal),vat:round(vat),total:round(total)};
}

export function savedQuoteTotal(q:SavedQuotation){
 return savedQuoteDetails(q).total;
}
