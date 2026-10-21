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

export const DOOR_OPTIONS:Record<string,string[]>={MFC:['MFC','MFC Painted','MFC Shaker'],'PAINTED MDF':['Painted MDF','MDF Painted Shaker'],'MDF VENEER':['MDF Veneer','MDF Veneer Shaker'],'MDF MOLDING':['MDF Molding','MDF Molding Shaker'],SPF:['SPF','SPF Shaker']};
export const DOOR_FINISHES=Object.values(DOOR_OPTIONS).flat();
export function unitDoorPrice(unit:Unit,finish?:string){return Number((finish&&unit.doorPrices?.[finish])??unit.doorCost??0)}

export const DEFAULT_FINISH_RATES:Record<string,number>={'MFC':120,'Painted MDF':190,'MDF Veneer':240};
export function doorSqm(x:QuoteUnit){const calculated=(Number(x.doorWidth)||0)*(Number(x.doorHeight)||0)*(Number(x.doorCount)||0)/1000000;return Math.max(0,calculated>0?calculated:Number(x.doorSqm)||0)}
export function pricedDoor(x:QuoteUnit,rates:Record<string,number>,unit?:Unit){const finish=x.doorFinish||'MFC';const rate=unit?.doorPrices?.[finish]??rates[finish]??0;return x.adc?doorSqm(x)*Math.max(0,Number(rate)||0):0}
