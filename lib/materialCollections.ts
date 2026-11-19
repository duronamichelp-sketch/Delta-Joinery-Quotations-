export type MaterialKind='timber'|'product'|'general';
export type MaterialUnit='pcs'|'boxes'|'packs'|'sets'|'bottles'|'tubes'|'tubs'|'rolls'|'bags'|'sheets'|'metres'|'litres'|'kg';
export type SavedAddress={id:string;name:string;eircode:string};
export type Coordinates={lat:number;lng:number};
export type CachedLocation=Coordinates & {eircode:string};

export type MaterialItem={
 id:string;kind:MaterialKind;name:string;quantity:number;unit:string;shopId:string;
 shopName?:string;shopEircode?:string;
 length?:string;lengthUnit?:'ft'|'mm';width?:string;thickness?:string;
 notes?:string;collected?:boolean;
};
export type MaterialCollection={
 id:string;title:string;createdAt:string;updatedAt:string;
 items:MaterialItem[];stopOrder:string[];originId?:string;
 manualKm?:Record<string,string>;calculatedKm?:Record<string,number>;
 geoCache?:Record<string,CachedLocation>;lastSortLabel?:string;
};
export const MATERIALS_KEY='dj_material_collections';
export const NO_SHOP='__unassigned';
export const UNITS:MaterialUnit[]=['pcs','boxes','packs','sets','bottles','tubes','tubs','rolls','bags','sheets','metres','litres','kg'];

export function createCollection(title:string):MaterialCollection{
 const now=new Date().toISOString();
 return {id:crypto.randomUUID(),title:title.trim(),createdAt:now,updatedAt:now,items:[],stopOrder:[],originId:'',manualKm:{},calculatedKm:{},geoCache:{}};
}
export function shopIds(items:MaterialItem[]):string[]{
 return Array.from(new Set(items.map(item=>item.shopId||NO_SHOP)));
}
export function normalizedStopOrder(collection:MaterialCollection):string[]{
 const available=shopIds(collection.items);
 return [...(collection.stopOrder||[]).filter((id,index,all)=>available.includes(id)&&all.indexOf(id)===index),...available.filter(id=>!(collection.stopOrder||[]).includes(id))];
}
export function moveBefore<T>(values:T[],from:T,to:T):T[]{
 if(from===to)return [...values];
 const next=values.filter(item=>item!==from);
 const target=next.indexOf(to);
 if(target<0||!values.includes(from))return [...values];
 next.splice(target,0,from);
 return next;
}
export function moveBy<T>(values:T[],item:T,direction:-1|1):T[]{
 const index=values.indexOf(item);
 const target=index+direction;
 if(index<0||target<0||target>=values.length)return [...values];
 const next=[...values];[next[index],next[target]]=[next[target],next[index]];
 return next;
}
export function moveItemWithinShop(items:MaterialItem[],fromId:string,toId:string):MaterialItem[]{
 const source=items.find(i=>i.id===fromId),target=items.find(i=>i.id===toId);
 if(!source||!target||(source.shopId||NO_SHOP)!==(target.shopId||NO_SHOP))return [...items];
 const indexes=items.map((it,index)=>(it.shopId||NO_SHOP)===(source.shopId||NO_SHOP)?index:-1).filter(i=>i>=0);
 const reordered=moveBefore(indexes.map(index=>items[index]),source,target);
 const copy=[...items];indexes.forEach((index,i)=>{copy[index]=reordered[i]});return copy;
}
export function kmBetween(a:Coordinates,b:Coordinates):number{
 const toRadians=(d:number)=>d*Math.PI/180;
 const dLat=toRadians(b.lat-a.lat),dLon=toRadians(b.lng-a.lng);
 const h=Math.sin(dLat/2)**2+Math.cos(toRadians(a.lat))*Math.cos(toRadians(b.lat))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function validKm(value:unknown):number|null{
 if(value===null||value===undefined||String(value).trim()==='')return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
}
export function distanceForStop(collection:MaterialCollection,id:string):number|null{
 const manual=validKm(collection.manualKm?.[id]);
 return manual!==null?manual:validKm(collection.calculatedKm?.[id]);
}
export function farthestFirst(collection:MaterialCollection):string[]{
 const order=normalizedStopOrder(collection);
 return order.map((id,index)=>({id,index,distance:distanceForStop(collection,id)}))
  .sort((a,b)=>(a.distance===null?1:0)-(b.distance===null?1:0)||
    (b.distance??0)-(a.distance??0)||a.index-b.index)
  .map(x=>x.id);
}
export function addressForStop(id:string,items:MaterialItem[],addresses:SavedAddress[]):SavedAddress|null{
 if(id===NO_SHOP)return null;
 const saved=addresses.find(a=>a.id===id);
 if(saved)return saved;
 const old=items.find(i=>i.shopId===id);
 return old?{id,name:old.shopName||'Unlisted supplier',eircode:old.shopEircode||''}:null;
}
export function itemDescription(item:MaterialItem):string{
 const amount=`${item.quantity} ${item.unit||'pcs'}`;
 if(item.kind!=='timber')return amount;
 const dimensions=[
  item.length?`${item.length} ${item.lengthUnit||'ft'} L`:'',
  item.width?`${item.width} mm W`:'',
  item.thickness?`${item.thickness} mm T`:''
 ].filter(Boolean).join(' × ');
 return dimensions?`${amount} · ${dimensions}`:amount;
}
