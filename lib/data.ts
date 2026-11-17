export type Unit={id:string;name:string;width:number;height:number;depth:number;sqm:number;price:number;material?:UnitMaterial;doorCost?:number;hingesPerUnit?:number;hingePrice?:number;image?:string;doorPrices?:Record<string,number>};
export type Hardware={id:string;name:string;category:string;price:number;image?:string};
export type DoorMaterial='MFC'|'Veneer'|'Painted MDF';
export type QuoteUnit={id:string;qty:number;hasDoors:boolean;doorMaterial:DoorMaterial;doorCount:number;doorSqm:number;adc?:boolean;doorFinish?:string;doorCategory?:string;doorWidth?:number;doorHeight?:number;ais?:boolean;shelfMaterial?:UnitMaterial;shelfQty?:number};
export type QuoteHardware={id:string;qty:number};
export const DEFAULT_HARDWARE:Hardware[]=[{id:'hinge',name:'Blumotion 110° Hinge',category:'Hinges',price:4},{id:'movento',name:'Blum Movento 40kg',category:'Drawer systems',price:120},{id:'tipon',name:'Blum Movento TIP-ON',category:'Drawer systems',price:128},{id:'merivobox',name:'Blum MERIVOBOX',category:'Drawer systems',price:90}];
export const DEFAULT_DOOR_RATES:Record<DoorMaterial,number>={'MFC':120,'Veneer':240,'Painted MDF':190};
export const currency=(v:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(v);
export const positive=(v:number)=>Number.isFinite(v)?Math.max(0,v):0;
export const read=<T,>(key:string,fallback:T):T=>{try{const x=localStorage.getItem(key);return x?JSON.parse(x) as T:fallback;}catch{return fallback;}};

export type Labour={id:string;name:string;price:number;unit:string;image?:string};
export type QuoteLabour={id:string;qty:number};
export const DEFAULT_LABOUR:Labour[]=[];

export type ExtraCost={id:string;name:string;price:number;image?:string};
export type ProductionCost={id:string;name:string;price:number;unit:string};
// Standard hourly workshop charge-out prices: midpoint of quoted range + 10%.
// No labour or material charges included. CNC remains optional, never automatically added.
export const DEFAULT_CNC_MACHINE_COSTS:ProductionCost[]=[
 {id:'prod-cnc-machining',name:'CNC machining',price:99,unit:'hour'},
 {id:'prod-cnc-programming',name:'CNC programming / setup',price:52.25,unit:'hour'}
];
export const DEFAULT_PRODUCTION_COSTS:ProductionCost[]=[
 {id:'prod-panel-cutting',name:'Panel saw / sheet cutting',price:55,unit:'hour'},
 {id:'prod-edge-banding',name:'Edge banding',price:60.5,unit:'hour'}
];
export const cncCostsWithDefaults=(savedCnc:ProductionCost[]|null|undefined,savedProduction?:ProductionCost[]|null):ProductionCost[]=>{
 const entries=Array.isArray(savedCnc)?savedCnc:[];
 const old=Array.isArray(savedProduction)?savedProduction:[];
 const additions=DEFAULT_CNC_MACHINE_COSTS.map(item=>old.find(x=>x.id===item.id)||item);
 const ids=new Set(entries.map(x=>x.id));
 return [...entries,...additions.filter(x=>!ids.has(x.id))];
};
export const productionCostsWithDefaults=(saved:ProductionCost[]|null|undefined):ProductionCost[]=>{
 const entries=(Array.isArray(saved)?saved:[]).filter(x=>!DEFAULT_CNC_MACHINE_COSTS.some(c=>c.id===x.id));
 const ids=new Set(entries.map(x=>x.id));
 return [...entries,...DEFAULT_PRODUCTION_COSTS.filter(x=>!ids.has(x.id))];
};


export const DOOR_OPTIONS:Record<string,string[]>={MFC:['MFC Plain'],MDF:['MDF Plain','MDF Shaker','MDF Molding'],'MDF VENEER':['MDF Veneer Plain','MDF Veneer Solid Molding']};
export const DOOR_FINISHES=Object.values(DOOR_OPTIONS).flat();
export function unitDoorPrice(unit:Unit,finish?:string){return Number((finish&&unit.doorPrices?.[finish])??unit.doorCost??0)}

export const DEFAULT_FINISH_RATES:Record<string,number>={'MFC Plain':120,'MDF Plain':190,'MDF Veneer Plain':240};
// ADC prices the combined door face at the selected unit's overall height and width.
// The number of door leaves does not multiply the total front face area.
export function doorSqm(x:QuoteUnit,unit?:Unit){
 const width=Number(unit?.width)||0,height=Number(unit?.height)||0;
 if(width>0&&height>0)return width*height/1000000;
 const calculated=(Number(x.doorWidth)||0)*(Number(x.doorHeight)||0)*(Number(x.doorCount)||1)/1000000;
 return Math.max(0,calculated>0?calculated:Number(x.doorSqm)||0);
}
export function pricedDoor(x:QuoteUnit,rates:Record<string,number>,unit?:Unit){
 if(!x.adc)return 0;
 const material=unit?unitMaterial(unit):'MFC';
 const category=material==='Veneer'?'MDF VENEER':material;
 const finish=x.doorFinish||DOOR_OPTIONS[category]?.[0]||'MFC Plain';
 const rate=unit?.doorPrices?.[finish]??rates[finish]??DEFAULT_FINISH_RATES[finish]??0;
 return doorSqm(x,unit)*Math.max(0,Number(rate)||0);
}

export const UNIT_HEIGHTS=[150,...Array.from({length:23},(_,i)=>(i+2)*100)];
export const UNIT_WIDTHS=[150,...Array.from({length:11},(_,i)=>(i+2)*100)];
export const UNIT_DEPTHS=[300,350,400,450,500,550,600];
// Delta Joinery MFC 18mm big-piece list rate; includes 15% uplift.
// Carcass assumption: two sides, top, bottom, and full 18mm back; no doors.
export type UnitMaterial='MFC'|'MDF'|'Veneer';
export const UNIT_BENCHMARK={MFC:250,MDF:375,Veneer:390} as const;
// Full five-panel carcass: two sides, top, bottom, and back. Benchmark is 600w x 720h x 550d mm.
export const carcassArea=(w:number,h:number,d:number)=>(2*h*d+2*w*d+w*h)/1000000;
const REFERENCE_AREA=carcassArea(600,720,550);
export const sizePrice=(w:number,h:number,d:number,material:UnitMaterial='MFC')=>Math.round(carcassArea(w,h,d)/REFERENCE_AREA*UNIT_BENCHMARK[material]*100)/100;
export const unitMaterial=(unit:Unit):UnitMaterial=>unit.material||( /veneer/i.test(unit.name)?'Veneer': /\bmdf\b/i.test(unit.name)?'MDF':'MFC');
// 18 mm carcass panels; internal shelf sits between the sides and stops at the full back.
export function shelfDimensions(unit:Unit){
 return {width:Math.max(0,Number(unit.width)-36),depth:Math.max(0,Number(unit.depth)-18)};
}
export function shelfArea(unit:Unit){
 const s=shelfDimensions(unit);
 return s.width*s.depth/1000000;
}
// Price per internal shelf, using the same material-specific reference rates as carcasses.
export function shelfPrice(unit:Unit,material:UnitMaterial='MFC'){
 return Math.round(shelfArea(unit)/REFERENCE_AREA*UNIT_BENCHMARK[material]*100)/100;
}
export function shelvesTotal(options:{ais?:boolean;shelfMaterial?:UnitMaterial;shelfQty?:number},unit?:Unit){
 if(!options.ais||!unit)return 0;
 const qty=Math.max(0,Math.trunc(Number(options.shelfQty)||0));
 return Math.round(shelfPrice(unit,options.shelfMaterial||unitMaterial(unit))*qty*100)/100;
}
export const sizeKey=(w:number,h:number,d:number)=>[w,h,d].join('x');
