'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

export default function RouteReset(){
  const pathname=usePathname();
  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:'auto'});
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  },[pathname]);
  return null;
}
