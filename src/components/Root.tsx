import { useEffect, useState } from 'react';
import App from './App';
import Games from './Games';
import Instruments from './Instruments';
import Theory from './theory/Theory';
import Tools from './Tools';
import Visualizer from './Visualizer';

type Tab = 'learn' | 'theory' | 'play' | 'inst' | 'tools' | 'viz';
const TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: '📖 Learn' },
  { id: 'theory', label: '🧠 Theory' },
  { id: 'play', label: '🎯 Practice games' },
  { id: 'inst', label: '🎷 Instruments' },
  { id: 'viz', label: '🌀 Visualizer' },
  { id: 'tools', label: '🛠 Tools' },
];

export default function Root() {
  const [tab, setTab] = useState<Tab>((import.meta.env.PUBLIC_TAB as Tab) || 'learn');
  // deep links like #theory/rhythm
  useEffect(() => {
    const read = () => { const t = window.location.hash.slice(1).split('/')[0] as Tab; if (TABS.some((x) => x.id === t)) setTab(t); };
    read(); window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const choose = (t: Tab) => { setTab(t); try { history.replaceState(null, '', `#${t}`); } catch { /* ignore */ } };
  return (
    <>
      <nav className="main-tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => choose(t.id)}>{t.label}</button>
        ))}
      </nav>
      <div hidden={tab !== 'learn'}><App /></div>
      <div hidden={tab !== 'theory'}><Theory /></div>
      <div hidden={tab !== 'play'}><Games /></div>
      <div hidden={tab !== 'inst'}><Instruments /></div>
      <div hidden={tab !== 'viz'}><Visualizer /></div>
      <div hidden={tab !== 'tools'}><Tools /></div>
    </>
  );
}
