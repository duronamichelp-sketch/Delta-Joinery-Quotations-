'use client';
import Link from 'next/link';
import Image from 'next/image';
export default function DesktopSidebar({active}:{active:'home'|'quotes'|'library'|'preview'}){
return <aside className="dj-shared-sidebar"><Link className="dj-shared-brand" href="/"><Image src="/delta-logo.png" alt="Delta Joinery" width={45} height={45}/><span><b>DELTA JOINERY</b><small>BESPOKE INTERIORS</small></span></Link><nav><Link className={active==='home'?'current':''} href="/">⌂ <span>Home</span></Link><Link href="/quote">▤ <span>New Quotation</span></Link><Link className={active==='quotes'?'current':''} href="/quotes">▤ <span>Saved Quotations</span></Link><Link className={active==='library'?'current':''} href="/units">▣ <span>Price Library</span></Link><Link className={active==='preview'?'current':''} href="/preview">▤ <span>Preview / PDF</span></Link></nav></aside>}
