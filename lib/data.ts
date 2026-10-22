export type Unit={id:string;name:string;width:number;height:number;depth:number;sqm:number;price:number;doorCost?:number;hingesPerUnit?:number;hingePrice?:number;image?:string;doorPrices?:Record<string,number>};
export type Hardware={id:string;name:string;category:string;price:number;image?:string};
export type DoorMaterial='MFC'|'Veneer'|'Painted MDF';
export type QuoteUnit={id:string;qty:number;hasDoors:boolean;doorMaterial:DoorMaterial;doorCount:number;doorSqm:number;adc?:boolean;doorFinish?:string;doorCategory?:string;doorWidth?:number;doorHeight?:number};
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

export const DOOR_OPTIONS:Record<string,string[]>={MFC:['MFC Plain'],MDF:['MDF Plain','MDF Shaker','MDF Molding'],'MDF VENEER':['MDF Veneer Plain','MDF Veneer Solid Molding']};
export const DOOR_FINISHES=Object.values(DOOR_OPTIONS).flat();
export function unitDoorPrice(unit:Unit,finish?:string){return Number((finish&&unit.doorPrices?.[finish])??unit.doorCost??0)}

export const DEFAULT_FINISH_RATES:Record<string,number>={'MFC Plain':120,'MDF Plain':190,'MDF Veneer Plain':240};
export function doorSqm(x:QuoteUnit){const calculated=(Number(x.doorWidth)||0)*(Number(x.doorHeight)||0)*(Number(x.doorCount)||0)/1000000;return Math.max(0,calculated>0?calculated:Number(x.doorSqm)||0)}
export function pricedDoor(x:QuoteUnit,rates:Record<string,number>,unit?:Unit){const finish=x.doorFinish||'MFC';const rate=unit?.doorPrices?.[finish]??rates[finish]??0;return x.adc?doorSqm(x)*Math.max(0,Number(rate)||0):0}

export const UNIT_HEIGHTS=[150,...Array.from({length:23},(_,i)=>(i+2)*100)];
export const UNIT_WIDTHS=[150,...Array.from({length:11},(_,i)=>(i+2)*100)];
export const UNIT_DEPTHS=[300,350,400,450,500,550,600];
// Delta Joinery MFC 18mm big-piece list rate; includes 15% uplift.
// Carcass assumption: two sides, top, bottom, and full 18mm back; no doors.
export const MFC_CARCASS_RATE=120;
export const UNIT_MARKUP=1.15;
export const carcassArea=(w:number,h:number,d:number)=>(2*h*d+2*w*d+w*h)/1000000;
export const sizePrice=(w:number,h:number,d:number)=>Math.round(carcassArea(w,h,d)*MFC_CARCASS_RATE*UNIT_MARKUP*100)/100;
export const sizeKey=(w:number,h:number,d:number)=>[w,h,d].join('x');
