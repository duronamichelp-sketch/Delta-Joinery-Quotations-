'use client';

import {useEffect,useState} from 'react';

/** Derive elapsed time from the clock, including after a tab has been asleep. */
export function useLiveNow(){
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{
  const update=()=>setNow(new Date());
  const onReturn=()=>{if(document.visibilityState==='visible')update()};
  update();
  const timer=window.setInterval(onReturn,1000);
  window.addEventListener('focus',onReturn);
  document.addEventListener('visibilitychange',onReturn);
  return()=>{
   window.clearInterval(timer);
   window.removeEventListener('focus',onReturn);
   document.removeEventListener('visibilitychange',onReturn);
  };
 },[]);
 return now;
}
