'use client';
import {useEffect,useState} from 'react';

/** Five-second welcome overlay only for signed-in desktop visitors. */
export default function DesktopWelcome(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!window.matchMedia('(min-width: 900px)').matches)return;
  if(sessionStorage.getItem('dj_welcome_seen')==='1')return;
  sessionStorage.setItem('dj_welcome_seen','1');
  setVisible(true);
  const id=window.setTimeout(()=>setVisible(false),5000);
  return ()=>window.clearTimeout(id);
 },[]);
 if(!visible)return null;
 return <div className="dj-welcome" role="status" aria-label="Welcome back Mr Dunne">
  <div className="dj-welcome-blueprint left" aria-hidden="true"><span>720</span><i/><i/><i/></div>
  <div className="dj-welcome-blueprint right" aria-hidden="true"><span>550</span><i/><i/><i/></div>
  <div className="dj-welcome-tool tool-ruler" aria-hidden="true">▰━━━━╍╍╍╍╍╍╍╍</div>
  <div className="dj-welcome-tool tool-drill" aria-hidden="true">⚒</div>
  <div className="dj-welcome-tool tool-pencil" aria-hidden="true">✎</div>
  <div className="dj-welcome-tool tool-saw" aria-hidden="true">◔</div>
  <div className="dj-welcome-tool tool-measure" aria-hidden="true">⌁</div>
  <section className="dj-welcome-card"><div className="dj-welcome-logo">DJ</div><p className="dj-welcome-brand">DELTA JOINERY</p><h1>Welcome back Mr Dunne</h1><p className="dj-welcome-intro">This is your Delta Joinery quotation workspace.</p><p className="dj-welcome-sub">Access your quotations, prices and saved jobs on any device.</p><div className="dj-welcome-progress"><div/></div><p className="dj-welcome-status">Preparing your workspace…</p></section>
  <style>{`
    .dj-welcome{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;overflow:hidden;padding:24px;background:radial-gradient(ellipse 42% 46% at 52% 43%,#265f3e 0%,#123923 55%,#062316 100%);color:#123c2b;font-family:Inter,Arial,sans-serif}
    .dj-welcome:before{content:'';position:absolute;inset:0;opacity:.17;background:repeating-linear-gradient(25deg,transparent 0 85px,rgba(163,204,167,.2) 86px,transparent 87px),repeating-linear-gradient(115deg,transparent 0 125px,rgba(163,204,167,.17) 126px,transparent 127px);pointer-events:none}
    .dj-welcome-card{position:relative;z-index:2;width:min(530px,92vw);box-sizing:border-box;border-radius:21px;padding:35px 45px 36px;background:linear-gradient(145deg,#fff,#f4f8f4);box-shadow:0 24px 95px #001a11aa,0 0 85px #68bf7c45}
    .dj-welcome-logo{width:56px;height:56px;display:grid;place-items:center;background:#12492f;color:#fff;border-radius:12px;font-size:25px;font-weight:900;letter-spacing:-1px}
    .dj-welcome-brand{font-size:12px;letter-spacing:3px;font-weight:800;color:#61806b;margin:18px 0 20px}
    .dj-welcome-card h1{font-size:clamp(27px,3vw,35px);line-height:1.2;letter-spacing:-1.3px;margin:0 0 16px;color:#0b3c28;font-weight:800}
    .dj-welcome-intro{font-size:17px;margin:0 0 5px;color:#36594a}
    .dj-welcome-sub{font-size:13px;line-height:1.5;margin:0;color:#779185}
    .dj-welcome-progress{height:12px;border-radius:99px;margin-top:35px;overflow:hidden;background:#dce7df}
    .dj-welcome-progress>div{height:100%;width:0;background:linear-gradient(90deg,#0b5030,#55c784);border-radius:inherit;animation:dj-welcome-loading 5s linear forwards}
    .dj-welcome-status{font-size:13px;margin:20px 0 0;color:#698174}
    .dj-welcome-tool{position:absolute;pointer-events:none;color:#99b69c;opacity:.19;font-weight:200;text-shadow:0 15px 22px #000;user-select:none}
    .tool-ruler{right:-2%;top:6%;font-size:70px;transform:rotate(16deg)}.tool-drill{left:3%;bottom:7%;font-size:220px;transform:rotate(-24deg)}.tool-pencil{right:12%;bottom:8%;font-size:200px;transform:rotate(-35deg)}.tool-saw{right:2%;top:-9%;font-size:330px}.tool-measure{left:-1%;top:16%;font-size:200px;transform:rotate(-28deg)}
    .dj-welcome-blueprint{position:absolute;width:390px;height:220px;border:1px solid #8cb29932;transform:rotate(-18deg);opacity:.45}
    .dj-welcome-blueprint.left{left:6%;top:11%}.dj-welcome-blueprint.right{right:13%;bottom:8%;transform:rotate(-18deg)}
    .dj-welcome-blueprint i{position:absolute;display:block;border:1px solid #8cb29952;inset:20px 30px}.dj-welcome-blueprint i:nth-of-type(2){inset:45px 65px}.dj-welcome-blueprint i:nth-of-type(3){inset:65px 95px}
    .dj-welcome-blueprint span{position:absolute;top:-27px;left:45%;font-size:13px;color:#b6d5c0}
    @keyframes dj-welcome-loading{from{width:0}to{width:100%}}
    @media(max-width:899px){.dj-welcome{display:none}}
   `}</style>
 </div>;
}
