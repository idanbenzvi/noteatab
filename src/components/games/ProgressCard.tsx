import { useEffect, useState } from 'react';
import { STRINGS } from '../../lib/music';
import { accuracy, dayStreak, daysPracticed, resetProgress, subscribe, totals, weakest } from '../../lib/progress';
import FlatFretboard, { type Mark } from '../theory/FlatFretboard';
import SpotlightCard from '../reactbits/SpotlightCard';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const DOMAINS: [string, string][] = [
  ['fret', 'Fretboard notes'], ['finder', 'Fretboard finder'], ['clef', 'Note names'], ['keysig', 'Key signatures'], ['enharm', 'Enharmonics'],
  ['spell', 'Interval spelling'], ['interval', 'Interval ear'], ['chord', 'Chord ear'], ['rhythm', 'Rhythm reading'], ['rhythm-tap', 'Rhythm tapping'],
];
/** red → amber → teal by accuracy */
const heat = (a: number) => (a < 0.5 ? `hsl(${Math.round(a * 2 * 40 + 8)} 85% 55%)` : `hsl(${Math.round(40 + (a - 0.5) * 2 * 130)} 65% 50%)`);

export default function ProgressCard() {
  const [, bump] = useState(0);
  useEffect(() => subscribe(() => bump((n) => n + 1)), []);
  // localStorage is read after hydration so the server-rendered markup matches
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <SpotlightCard className="card"><p className="eyebrow">Your progress</p><h2>Practice history</h2></SpotlightCard>;

  const tot = totals();
  const any = Object.values(tot).some((t) => t.n > 0);
  const streak = dayStreak();
  const marks: Mark[] = [];
  STRINGS.forEach((_, s) => { for (let f = 0; f <= 12; f++) { const a = accuracy('fret', `${s}:${f}`); if (a !== null) marks.push({ s, f, kind: 'heat', fill: heat(a), label: '' }); } });
  const weak = weakest('fret', 5);

  return (
    <SpotlightCard className="card" spotlight="rgba(79,209,197,0.10)">
      <header className="card-head">
        <div><p className="eyebrow">Your progress</p><h2>Practice history</h2></div>
        {any && <button className="link" onClick={() => { if (window.confirm('Erase all saved practice history on this device?')) resetProgress(); }}>Reset</button>}
      </header>
      {!any ? <p className="hint">Play a few rounds and your accuracy will appear here: per-note heat map, weak spots, and a day streak. It is stored only in this browser.</p> : (
        <>
          <div className="stat-row prog-stats">
            <div className="stat accent"><b>{streak > 0 ? `🔥 ${streak}` : '0'}</b><small>day streak</small></div>
            <div className="stat"><b>{daysPracticed()}</b><small>days practised</small></div>
            <div className="stat"><b>{Object.values(tot).reduce((a, t) => a + t.n, 0)}</b><small>answers</small></div>
          </div>
          <div className="prog-domains">
            {DOMAINS.filter(([d]) => tot[d]).map(([d, label]) => (
              <div key={d} className="dom-row"><span>{label}</span><span className="dom-bar"><i style={{ width: `${Math.round((tot[d].c / tot[d].n) * 100)}%` }} /></span><b>{Math.round((tot[d].c / tot[d].n) * 100)}%</b><small>{tot[d].n}</small></div>
            ))}
          </div>
          {marks.length > 0 && (
            <>
              <h3 className="tx-h3">Fretboard heat map</h3>
              <p className="hint small">Each dot is a position you have been asked about: <span style={{ color: heat(0.1) }}>red</span> = often wrong, <span style={{ color: heat(1) }}>green</span> = solid. Untried spots stay empty. Turn on “Weak spots first” in the staff/tab games to drill the red ones.</p>
              <FlatFretboard frets={12} marks={marks} caption="Accuracy per fretboard position" />
              {weak.length > 0 && (
                <p className="hint small">Weakest: {weak.map((w, i) => { const [s, f] = w.item.split(':').map(Number); return <span key={w.item}>{i ? ' · ' : ''}<b>{NAMES[(STRINGS[s].midi + f) % 12]}</b> (string {6 - s}, fret {f}, {Math.round(w.acc * 100)}%)</span>; })}</p>
              )}
            </>
          )}
        </>
      )}
    </SpotlightCard>
  );
}
