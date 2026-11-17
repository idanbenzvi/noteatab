import { useState } from 'react';
import App from './App';
import Games from './Games';
import Instruments from './Instruments';

type Tab = 'learn' | 'play' | 'inst';
export default function Root() {
  const [tab, setTab] = useState<Tab>('learn');
  return (
    <>
      <nav className="main-tabs" role="tablist" aria-label="Sections">
        <button role="tab" aria-selected={tab === 'learn'} className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>📖 Learn</button>
        <button role="tab" aria-selected={tab === 'play'} className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>🎯 Practice games</button>
        <button role="tab" aria-selected={tab === 'inst'} className={tab === 'inst' ? 'on' : ''} onClick={() => setTab('inst')}>🎷 Instruments</button>
      </nav>
      <div hidden={tab !== 'learn'}><App /></div>
      <div hidden={tab !== 'play'}><Games /></div>
      <div hidden={tab !== 'inst'}><Instruments /></div>
    </>
  );
}
