import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)return NextResponse.json({error:'Live ETA requires a Google Maps Routes API key in Vercel settings.'},{status:503});
 let body:{origin?:string;destination?:string};
 try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
 const origin=body.origin||'',destination=body.destination||'';
 if(!/^-?\d{1,2}\.\d+,-?\d{1,3}\.\d+$/.test(origin)||destination.length<5||destination.length>100)return NextResponse.json({error:'Invalid location'},{status:400});
 const [latitude,longitude]=origin.split(',').map(Number);
 if(Math.abs(latitude)>90||Math.abs(longitude)>180)return NextResponse.json({error:'Invalid coordinates'},{status:400});
 const common={origin:{location:{latLng:{latitude,longitude}}},destination:{address:destination+', Ireland'},travelMode:'DRIVE',languageCode:'en',units:'METRIC'};
 async function estimate(routingPreference:'TRAFFIC_AWARE'|'TRAFFIC_UNAWARE'){
  const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.duration'},body:JSON.stringify({...common,routingPreference}),cache:'no-store'});
  if(!response.ok)throw Error('Routes service unavailable ('+response.status+')');
  const result=await response.json();
  const duration=result.routes?.[0]?.duration;
  if(!duration)throw Error('No driving route found');
  return Math.max(1,Math.ceil(Number(String(duration).replace('s',''))/60))+' min';
 }
 try{const [traffic,normal]=await Promise.all([estimate('TRAFFIC_AWARE'),estimate('TRAFFIC_UNAWARE')]);return NextResponse.json({traffic,normal},{headers:{'Cache-Control':'no-store'}})}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Route unavailable'},{status:502})}
}
