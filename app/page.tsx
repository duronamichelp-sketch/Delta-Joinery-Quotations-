'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {currency,read} from '../../lib/data';
type Saved={id:string;number:string;client:string;project:string;date:string;chosenUnits:{qty:number}[]};
export default function Dashboard(){
 const [saved,setSaved]=useState<Saved[]>([]);
 useEffect(()=>setSaved(read('dj_saved_quotes',[])),[]);
 return <main className="dj-app">
 <section className="dj-hero"><div className="dj-hero-inner"><Image src="/delta-logo.png" alt="Delta Joinery" width={190} height={58} priority/><div className="dj-hero-copy"><div className="dj-eyebrow">DELTA JOINERY · QUOTATIONS</div><h1>Beautifully simple quotations.</h1><p>Create a professional estimate in minutes, wherever the job takes you.</p></div><Link href="/quote" className="dj-primary">＋ New Quotation <span>→</span></Link></div></section>
 <div className="dj-dashboard-wrap"><div className="dj-dashboard-grid"><Link href="/quote" className="dj-dashboard-tile"><span className="dj-tile-icon">▤</span><b>New quotation</b><small>Build a quick estimate</small><span className="dj-tile-arrow">↗</span></Link><Link href="/quotes" className="dj-dashboard-tile"><span className="dj-tile-icon">◷</span><b>Saved quotations</b><small>Open previous jobs</small><span className="dj-tile-arrow">↗</span></Link><Link href="/units" className="dj-dashboard-tile"><span className="dj-tile-icon">▦</span><b>Price library</b><small>Units, doors, hardware and labour</small><span className="dj-tile-arrow">↗</span></Link></div><section className="dj-recent"><div className="dj-section-heading"><h2>Recent quotations</h2><Link href="/quotes">View all →</Link></div>{saved.length===0?<p className="dj-muted">Your saved jobs will appear here when you save a quotation.</p>:saved.slice(0,4).map(x=><Link key={x.id} href="/quotes" className="dj-recent-row"><div><b>{x.number||x.id}</b><small>{x.client||'Client'} · {x.project||'Project'}</small></div><span>→</span></Link>)}</section><p className="dj-note">Saved quotations are currently stored in this browser. Syncing between devices requires the separate cloud database connection.</p></div>
 <nav className="dj-bottom-nav no-print"><Link href="/" aria-current="page">⌂<small>Home</small></Link><Link href="/quote">▤<small>Quote</small></Link><Link href="/quotes">◷<small>Saved</small></Link><Link href="/units">▦<small>Library</small></Link></nav>
 </main>
}