import { useEffect, useState, type ComponentType } from 'react';
import Rhythm from './Rhythm';
import KeySignatures from './KeySignatures';
import Clefs from './Clefs';
import Enharmonics from './Enharmonics';
import Intervals from './Intervals';
import Harmony from './Harmony';
import Modes from './Modes';
import TabSymbols from './TabSymbols';
import Shapes from './Shapes';
import Tunings from './Tunings';

export interface TheorySection { id: string; label: string; group: string; View: ComponentType }
export const SECTIONS: TheorySection[] = [
  { id: 'rhythm', label: 'Rhythm & note values', group: 'Reading music', View: Rhythm },
  { id: 'keys', label: 'Key signatures', group: 'Reading music', View: KeySignatures },
  { id: 'clefs', label: 'Clefs & ledger lines', group: 'Reading music', View: Clefs },
  { id: 'enharmonics', label: 'Enharmonics', group: 'Reading music', View: Enharmonics },
  { id: 'intervals', label: 'Intervals', group: 'Pitch & harmony', View: Intervals },
  { id: 'harmony', label: 'Chords & harmony', group: 'Pitch & harmony', View: Harmony },
  { id: 'modes', label: 'Modes', group: 'Pitch & harmony', View: Modes },
  { id: 'tab', label: 'Tab symbols', group: 'Guitar', View: TabSymbols },
  { id: 'shapes', label: 'Moveable shapes', group: 'Guitar', View: Shapes },
  { id: 'tunings', label: 'Tunings & capo', group: 'Guitar', View: Tunings },
];

export default function Theory() {
  const [id, setId] = useState<string>((import.meta.env.PUBLIC_SECTION as string) || 'rhythm');
  useEffect(() => {
    const read = () => { const h = window.location.hash.split('/')[1]; if (h && SECTIONS.some((s) => s.id === h)) setId(h); };
    read(); window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const choose = (next: string) => { setId(next); try { history.replaceState(null, '', `#theory/${next}`); } catch { /* ignore */ } };
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  const View = (SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]).View;
  return (
    <div className="app">
      <nav className="sub-nav" aria-label="Theory topics">
        {groups.map((g) => (
          <div key={g} className="sub-group"><span>{g}</span>
            {SECTIONS.filter((s) => s.group === g).map((s) => <button key={s.id} className={id === s.id ? 'on' : ''} onClick={() => choose(s.id)}>{s.label}</button>)}
          </div>
        ))}
      </nav>
      <View />
    </div>
  );
}
