export const HANDOVERS_KEY='dj_accepted_jobs';

export type WorkKind='door'|'stairs'|'wardrobe'|'tv-unit'|'alcove'|'kitchen'|'cabinet'|'shelving'|'panelling'|'other';
export type HandoverImage={path:string;name:string};
export type WorkField={id:string;label:string;placeholder?:string;multiline?:boolean;group:'Measurements'|'Construction & materials'|'Hardware & fittings'|'Finish & installation'};
export type WorkItem={
 id:string;kind:WorkKind;title:string;answers:Record<string,string>;
 referenceImages:HandoverImage[];fixingImages:HandoverImage[];
 referenceNA:boolean;fixingNA:boolean;
};
export type AcceptedJob={
 id:string;project:string;client:string;address:string;phone:string;email:string;
 quotationRef:string;acceptedDate:string;targetDate:string;preparedBy:string;
 agreedPrice:string;vatBasis:string;siteInstructions:string;
 works:WorkItem[];createdAt:string;updatedAt:string;
};
export const WORK_TYPES:{id:WorkKind;name:string}[]=[
 {id:'door',name:'Door'},{id:'stairs',name:'Stairs'},{id:'wardrobe',name:'Wardrobe'},
 {id:'tv-unit',name:'TV Unit'},{id:'alcove',name:'Alcove / Media Units'},
 {id:'kitchen',name:'Kitchen / Island'},{id:'cabinet',name:'Cabinet / Storage'},
 {id:'shelving',name:'Shelving'},{id:'panelling',name:'Wall / Slatted Panels'},
 {id:'other',name:'Other Bespoke Work'}
];
export const workName=(kind:WorkKind)=>WORK_TYPES.find(x=>x.id===kind)?.name||'Other Bespoke Work';
export const SHARED_FIELDS:{id:keyof AcceptedJob;label:string;placeholder:string;multiline?:boolean}[]=[
 {id:'project',label:'Project / accepted job',placeholder:'e.g. Bedroom wardrobe and media unit'},
 {id:'client',label:'Client name',placeholder:'Full name / business'},
 {id:'address',label:'Site address',placeholder:'Full address and Eircode',multiline:true},
 {id:'phone',label:'Contact number',placeholder:'Phone number or N/A'},
 {id:'email',label:'Client email',placeholder:'Email or N/A'},
 {id:'quotationRef',label:'Accepted quotation number',placeholder:'e.g. DJ-1042 or N/A'},
 {id:'acceptedDate',label:'Date accepted',placeholder:'YYYY-MM-DD or N/A'},
 {id:'targetDate',label:'Target completion / installation date',placeholder:'Date or N/A'},
 {id:'preparedBy',label:'Prepared / confirmed by',placeholder:'Name or N/A'},
 {id:'agreedPrice',label:'Total agreed price (€)',placeholder:'Amount or N/A'},
 {id:'vatBasis',label:'Price VAT treatment',placeholder:'Including VAT / Excluding VAT / N/A'},
 {id:'siteInstructions',label:'Site access / constraints / general instructions',placeholder:'Parking, working hours, site conditions, or N/A',multiline:true}
];
const f=(id:string,label:string,group:WorkField['group'],placeholder='',multiline=false):WorkField=>({id,label,group,placeholder,multiline});
export const COMMON_WORK_FIELDS:WorkField[]=[
 f('description','What is being manufactured / supplied?','Construction & materials','Describe the accepted work',true),
 f('material','Main material / board / timber','Construction & materials','e.g. 18mm oak veneered MDF'),
 f('assembly','Construction / assembly method','Construction & materials','e.g. shop fabrication, on-site assembly'),
 f('finish','Finish, colour, paint reference / sheen','Finish & installation','e.g. RAL 9010, satin clear lacquer'),
 f('installation','Installation and fixing method','Finish & installation','e.g. frame fixing to masonry, plugs / screws',true),
 f('exceptions','Special details, exclusions or checks','Finish & installation','Critical details or N/A',true)
];
const specifics:Record<WorkKind,WorkField[]>={
 door:[
  f('openingHeight','Structural opening height (mm)','Measurements'),
  f('openingWidth','Structural opening width (mm)','Measurements'),
  f('leafThickness','Door leaf thickness (mm)','Measurements'),
  f('leafCount','Number of leaves / doors','Measurements'),
  f('swing','Handing / swing direction','Measurements','e.g. RH inward'),
  f('frame','Frame, lining and architrave','Construction & materials'),
  f('construction','Door construction / design detail','Construction & materials'),
  f('hinges','Hinge type, size, finish and quantity','Hardware & fittings'),
  f('lock','Lock / latch make, model and backset','Hardware & fittings'),
  f('handles','Handles, escutcheons and accessories','Hardware & fittings'),
  f('seals','Seals, threshold / door stops','Hardware & fittings')
 ],
 stairs:[
  f('floorHeight','Finished floor-to-floor height (mm)','Measurements'),
  f('overallLength','Overall horizontal stair run / length (mm)','Measurements'),
  f('width','Staircase width (mm)','Measurements'),
  f('risers','Number of risers / rises','Measurements'),
  f('treads','Number of treads, going and tread depth (mm)','Measurements'),
  f('landing','Landing positions / sizes','Measurements'),
  f('layout','Stair configuration (straight, L, U, winder)','Construction & materials'),
  f('stringers','Stringer type / material','Construction & materials'),
  f('treadMaterial','Treads, risers and nosings','Construction & materials'),
  f('balustrade','Balustrade, handrail, newels, spindles','Hardware & fittings'),
  f('structure','Structural support / anchor detail','Hardware & fittings')
 ],
 wardrobe:[
  f('height','Overall height (mm)','Measurements'),
  f('width','Overall width (mm)','Measurements'),
  f('depth','Overall depth (mm)','Measurements'),
  f('carcass','Carcass material and thickness','Construction & materials'),
  f('front','Door type, quantity and material','Construction & materials'),
  f('internal','Internal layout: rails, shelves, drawers','Construction & materials', '',true),
  f('hinges','Hinges, runners and door hardware','Hardware & fittings'),
  f('handles','Handles, catches and soft-close fittings','Hardware & fittings'),
  f('lighting','LED / power supply / channels','Hardware & fittings'),
  f('scribe','Fillers, scribing and plinths','Finish & installation')
 ],
 'tv-unit':[
  f('height','Overall height (mm)','Measurements'),
  f('width','Overall width (mm)','Measurements'),
  f('depth','Overall depth (mm)','Measurements'),
  f('tv','TV size and mounting / bracket','Hardware & fittings'),
  f('carcass','Carcass / doors / shelving specification','Construction & materials'),
  f('cabling','Power, data and cable routes','Hardware & fittings'),
  f('led','LED strip locations, driver and access','Hardware & fittings'),
  f('ventilation','Equipment ventilation / service access','Construction & materials'),
  f('wallFix','Wall type and structural fixing points','Hardware & fittings')
 ],
 alcove:[
  f('height','Overall height (mm)','Measurements'),f('width','Overall width (mm)','Measurements'),
  f('depth','Overall depth (mm)','Measurements'),f('pair','Left / right side configuration','Measurements'),
  f('carcass','Carcass and front construction','Construction & materials'),
  f('shelves','Shelves, worktops and thickness','Construction & materials'),
  f('doors','Doors, hinges and handles','Hardware & fittings'),
  f('services','Sockets, media, wiring and LED','Hardware & fittings'),
  f('scribe','Fillers, skirting and scribing','Finish & installation')
 ],
 kitchen:[
  f('height','Overall height / worktop level (mm)','Measurements'),
  f('width','Overall width / plan dimensions (mm)','Measurements'),
  f('depth','Overall depth / clearances (mm)','Measurements'),
  f('units','Units, drawers, doors and positions','Construction & materials', '',true),
  f('carcass','Carcass / front material and thickness','Construction & materials'),
  f('worktop','Worktop material, edge and thickness','Construction & materials'),
  f('hardware','Drawer runners, hinges and handles','Hardware & fittings'),
  f('appliances','Appliances, cut-outs, sink and taps','Hardware & fittings'),
  f('services','Electric, plumbing and extraction coordination','Finish & installation')
 ],
 cabinet:[
  f('height','Overall height (mm)','Measurements'),f('width','Overall width (mm)','Measurements'),
  f('depth','Overall depth (mm)','Measurements'),f('carcass','Carcass, shelf and panel construction','Construction & materials'),
  f('doors','Doors, drawers and quantity','Construction & materials'),
  f('hardware','Hinges, runners, handles, locks','Hardware & fittings'),
  f('location','Freestanding / wall / floor mounted','Finish & installation')
 ],
 shelving:[
  f('height','Overall installation height (mm)','Measurements'),
  f('width','Overall width (mm)','Measurements'),
  f('depth','Shelf depth (mm)','Measurements'),
  f('shelfCount','Shelf count and spacing','Measurements'),
  f('shelfMaterial','Shelf material, thickness and edge','Construction & materials'),
  f('support','Brackets, cleats and support method','Hardware & fittings'),
  f('load','Expected load / additional reinforcement','Hardware & fittings')
 ],
 panelling:[
  f('height','Wall / panel height (mm)','Measurements'),
  f('width','Wall / panel total width (mm)','Measurements'),
  f('panelThickness','Panel / slat thickness (mm)','Measurements'),
  f('slat','Slat width, gap and orientation','Construction & materials'),
  f('backing','Backing board thickness and material','Construction & materials'),
  f('battens','Rear battens / split battens positions','Hardware & fittings'),
  f('returns','Corners, reveals, top and bottom trims','Finish & installation'),
  f('services','Socket / LED / access cut-outs','Hardware & fittings')
 ],
 other:[
  f('dimensions','All critical dimensions with units','Measurements','Height, width, length, depth, etc.',true),
  f('construction','Fabrication and component breakdown','Construction & materials','Materials, quantities, joints',true),
  f('hardware','Fixings, hinges, locks or fittings','Hardware & fittings','Specify products or N/A',true),
  f('coordination','Site installation and other trades','Finish & installation','Notes or N/A',true)
 ]
};
export const fieldsForWork=(kind:WorkKind):WorkField[]=>[...specifics[kind],...COMMON_WORK_FIELDS];
export function newWork(kind:WorkKind='door'):WorkItem{
 return {id:crypto.randomUUID(),kind,title:workName(kind),answers:{},referenceImages:[],fixingImages:[],referenceNA:false,fixingNA:false};
}
export function newAcceptedJob(kind:WorkKind='door'):AcceptedJob{
 const now=new Date().toISOString();
 return {id:crypto.randomUUID(),project:'',client:'',address:'',phone:'',email:'',quotationRef:'',acceptedDate:now.slice(0,10),targetDate:'',preparedBy:'',agreedPrice:'',vatBasis:'',siteInstructions:'',works:[newWork(kind)],createdAt:now,updatedAt:now};
}
export const answered=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
export function missingHandover(job:AcceptedJob):string[]{
 const errors:string[]=[];
 for(const meta of SHARED_FIELDS)if(!answered(job[meta.id]))errors.push('Client/job details: '+meta.label);
 const price=job.agreedPrice.trim();
 if(price&&price.toUpperCase()!=='N/A'&&(!Number.isFinite(Number(price))||Number(price)<0))errors.push('Client/job details: Agreed price must be a non-negative number or N/A');
 if(!job.works.length)errors.push('Add at least one work item');
 for(const work of job.works){
  const prefix=(work.title.trim()||workName(work.kind))+': ';
  if(!answered(work.title))errors.push(prefix+'Work name');
  for(const field of fieldsForWork(work.kind))if(!answered(work.answers[field.id]))errors.push(prefix+field.label);
  if(!work.referenceNA&&!work.referenceImages.length)errors.push(prefix+'Design reference photo or mark N/A');
  if(!work.fixingNA&&!work.fixingImages.length)errors.push(prefix+'Hardware / fixing reference photo or mark N/A');
 }
 return errors;
}
export function formatJobPrice(job:AcceptedJob):string{
 const p=job.agreedPrice.trim();
 if(p.toUpperCase()==='N/A')return 'N/A';
 const n=Number(p);
 return Number.isFinite(n)?'€'+n.toLocaleString('en-IE',{minimumFractionDigits:2,maximumFractionDigits:2}):p;
}
