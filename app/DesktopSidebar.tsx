'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {useDeltaAccount} from './CloudSync';

export default function DesktopSidebar({active}:{active:'home'|'quote'|'quotes'|'finished'|'library'|'preview'|'hours'|'tools'}){
  const account=useDeltaAccount();
  const pathname=usePathname();
  const [expanded,setExpanded]=useState(false);
  const toolsOpen=expanded||pathname.startsWith('/tools');

  return <aside className="dj-shared-sidebar">
    <Link className="dj-shared-brand" href="/">
      <span><b>DELTA JOINERY</b><small>BESPOKE INTERIORS</small></span>
    </Link>
    <nav>
      <Link className={active==='home'?'current':''} href="/">⌂ <span>Home</span></Link>
      <Link className={active==='quote'?'current':''} href="/quote">▤ <span>New Quotation</span></Link>
      <Link className={active==='quotes'?'current':''} href="/quotes">▤ <span>Saved Quotations</span></Link>
      <Link className={active==='finished'?'current':''} href="/finished-quotes">✓ <span>Finished Quotations</span></Link>
      <Link className={active==='library'?'current':''} href="/units">▣ <span>Price Library</span></Link>
      <Link className={active==='preview'?'current':''} href="/preview">▤ <span>Preview / PDF</span></Link>
      <Link className={active==='hours'?'current':''} href="/hours">◷ <span>My Hours</span></Link>
      <button
        type="button"
        className={'dj-tools-toggle '+(toolsOpen?'current':'')}
        aria-expanded={toolsOpen}
        onClick={()=>setExpanded(v=>!v)}
      >
        <span>⚒ <span>Tools</span></span><span aria-hidden="true">{toolsOpen?'⌃':'⌄'}</span>
      </button>
      {toolsOpen&&<div className="dj-tools-submenu">
        <Link className={'dj-tool-link '+(pathname==='/tools/addresses'?'current':'')} href="/tools/addresses"><span>⌖</span><span>Addresses</span></Link>
        <Link className={'dj-tool-link '+(pathname.includes('measurements')?'current':'')} href="/tools/measurements"><span>▱</span><span>Measurements</span></Link>
        <Link className={'dj-tool-link '+(pathname==='/tools/skoda'?'current':'')} href="/tools/skoda"><span>▣</span><span>Škoda</span></Link>
        <Link className={'dj-tool-link '+(pathname.includes('cutting-list')?'current':'')} href="/tools/cutting-list"><span>▤</span><span>Cutting List</span></Link>
      </div>}
    </nav>
    {account&&<div className="dj-sidebar-account">
      <span className="dj-sidebar-account-label">CLOUD ACCOUNT</span>
      <span className="dj-sidebar-account-email" title={account.email}>{account.email}</span>
      <button type="button" onClick={account.signOut}>Sign out</button>
    </div>}
  </aside>;
}
