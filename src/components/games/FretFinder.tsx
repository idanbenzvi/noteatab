import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS, spellMidi, noteName } from '../../lib/music';
import { pluck } from '../../lib/audio';
import { pickWeighted, record } from '../../lib/progress';
import FlatFretboard, { type Mark } from '../theory/FlatFretboard';
import SpotlightCard from '../reactbits/SpotlightCard';
import { RoundHud, RoundSummary, useRound } from './useRound';
import type { RunnerProps } from './QuizRunner';

const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const FRETS = 12;
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

interface Q { mode: 'string' | 'all'; pc: number; s: number; name: string; targets: { s: number; f: number }[] }
const rnd = (n: number) => Math.floor(Math.random() * n);

function make(level: string): Q {
  const accidentals = level !== 'string';
  const pcs = accidentals ? Array.from({ length: 12 }, (_, i) => i) : NATURAL;
  const pairs = STRINGS.flatMap((_, s) => pcs.map((pc) => ({ s, pc })));
  const mode = level === 'all' ? 'all' : 'string';
  const pick = pickWeighted(pairs, (p) => (mode === 'all' ? `all:${p.pc}` : `${p.s}:${p.pc}`), 'finder');
  const flat = Math.random() < 0.5;
  const name = noteName(spellMidi(60 + pick.pc, flat));
  const targets: { s: number; f: number }[] = [];
  STRINGS.forEach((st, s) => {
    if (mode === 'string' && s !== pick.s) return;
    for (let f = 0; f <= FRETS; f++) if ((st.midi + f) % 12 === pick.pc) targets.push({ s, f });
  });
  return { mode, pc: pick.pc, s: pick.s, name, targets };
}

export default function FretFinder({ level, sprint, onExit }: RunnerProps) {
  const lv = level || 'string';
  const r = useRound(`noteatab.best.finder.${lv}.${sprint ? 'sprint' : 'practice'}`, sprint);
  const [q, setQ] = useState<Q | null>(null);
  const [found, setFound] = useState<{ s: number; f: number }[]>([]);
  const [wrong, setWrong] = useState<{ s: number; f: number }[]>([]);
  const [done, setDone] = useState<boolean | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const next = useCallback(() => {
    window.clearTimeout(timer.current);
    setQ(make(lv)); setFound([]); setWrong([]); setDone(null);
  }, [lv]);
  useEffect(() => { next(); return () => window.clearTimeout(timer.current); }, [next]);

  const settle = (ok: boolean, qq: Q) => {
    setDone(ok);
    r.answer(ok);
    record('finder', qq.mode === 'all' ? `all:${qq.pc}` : `${qq.s}:${qq.pc}`, ok);
    const wait = ok ? 1000 : sprint ? 1900 : 0;
    if (wait) timer.current = window.setTimeout(() => (r.expired() ? r.finish() : next()), wait);
  };

  const click = (s: number, f: number) => {
    if (!q || done !== null) return;
    pluck(STRINGS[s].midi + f, 0, 1.2);
    const hit = q.targets.some((t) => t.s === s && t.f === f);
    if (!hit) {
      setWrong((w) => (w.some((x) => x.s === s && x.f === f) ? w : [...w, { s, f }]));
      if (q.mode === 'string') settle(false, q);
      return;
    }
    if (found.some((x) => x.s === s && x.f === f)) return;
    const nf = [...found, { s, f }];
    setFound(nf);
    if (nf.length === q.targets.length) settle(wrong.length === 0, q);
  };
  const giveUp = () => { if (q && done === null) settle(false, q); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && done === false && !sprint) { e.preventDefault(); next(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, sprint, next]);

  if (r.over) return <RoundSummary r={r} title="Fretboard finder" onAgain={() => { r.restart(); next(); }} onExit={onExit} />;
  const marks: Mark[] = [];
  if (q) {
    found.forEach((p) => marks.push({ ...p, kind: 'good', label: q.name }));
    wrong.forEach((p) => marks.push({ ...p, kind: 'bad', label: '✕' }));
    if (done !== null) q.targets.filter((t) => !found.some((x) => x.s === t.s && x.f === t.f)).forEach((t) => marks.push({ ...t, kind: 'alt', label: q.name }));
  }
  const strName = q ? `${ORD[5 - q.s]} string (${STRINGS[q.s].name})` : '';
  return (
    <SpotlightCard className={`card game ${done === null ? '' : done ? 'ok' : 'no'}`} spotlight="rgba(255,122,89,0.08)">
      <header className="card-head">
        <div><p className="eyebrow">Fretboard finder · {lv === 'string' ? 'one string' : lv === 'sharps' ? 'one string, ♯/♭' : 'every one on the neck'}{sprint ? ' · sprint' : ''}</p>
          <h2>{q ? (q.mode === 'string' ? <>Find <span className="big-note">{q.name}</span> on the {strName}</> : <>Find <b>every</b> <span className="big-note">{q.name}</span> from fret 0 to 12</>) : '…'}</h2></div>
        <div className="controls">
          {sprint && <span className={`clock ${r.left <= 10 ? 'low' : ''}`}>{r.left}s</span>}
          <button className="pill" onClick={r.finish}>{sprint ? 'End round' : 'Finish'}</button>
        </div>
      </header>
      <RoundHud r={r} />
      <FlatFretboard frets={FRETS} marks={marks} onCell={click} caption="Click where the note is" />
      <div className="feedback" aria-live="polite">
        {q && done === null && q.mode === 'all' && (
          <><span className="muted">Found {found.length} of {q.targets.length}. {wrong.length ? `${wrong.length} wrong click${wrong.length > 1 ? 's' : ''}.` : ''}</span>
            <button className="link" onClick={giveUp}>Show me</button></>
        )}
        {q && done !== null && (
          <p className={done ? 'good' : 'bad'}>{done ? '✓ Correct. ' : '✗ Not quite. '}
            <b>{q.name} lives at {q.targets.map((t) => `string ${6 - t.s} fret ${t.f}`).join(', ')}.</b></p>
        )}
        {done === false && !sprint && <button className="pill accent" onClick={next}>Next <kbd>Enter</kbd></button>}
      </div>
      <p className="hint small">{q?.mode === 'string' ? 'One click: the first click decides. Landmarks help: the fretboard repeats every 12 frets, and fret 5 on one string equals the open string above (except G→B, where it is fret 4).' : 'Wrong clicks count against a perfect round. Use octaves: every note appears again 12 frets higher.'}</p>
    </SpotlightCard>
  );
}
