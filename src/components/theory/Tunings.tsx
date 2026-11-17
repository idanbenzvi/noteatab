import { useMemo, useState } from 'react';
import { STRINGS, mod, pitchName, type Pitch } from '../../lib/music';
import { CAPO_SHAPES, TUNINGS, diatonicName, intervalName } from '../../lib/theory';
import { pluck } from '../../lib/audio';
import FlatFretboard, { type Mark } from './FlatFretboard';
import TCard from './TCard';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const OPEN_CHORD: Record<string, { pcs: number[]; suffix: string; root: number; strings: number[] }> = {
  openg: { pcs: [], suffix: '', root: 7, strings: [0, 1, 2, 3, 4, 5] },
  opend: { pcs: [], suffix: '', root: 2, strings: [0, 1, 2, 3, 4, 5] },
  opene: { pcs: [], suffix: '', root: 4, strings: [0, 1, 2, 3, 4, 5] },
  openc: { pcs: [], suffix: '', root: 0, strings: [0, 1, 2, 3, 4, 5] },
  dadgad: { pcs: [], suffix: 'sus4', root: 2, strings: [0, 1, 2, 3, 4, 5] },
  dropd: { pcs: [], suffix: '5', root: 2, strings: [0, 1, 2] },
  dbldrop: { pcs: [], suffix: '5', root: 2, strings: [0, 1, 2] },
};
const CAPO_OPEN: Record<string, (number | null)[]> = {
  C: [null, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], D: [null, null, 0, 2, 3, 2], A: [null, 0, 2, 2, 2, 0], E: [0, 2, 2, 1, 0, 0],
  Am: [null, 0, 2, 2, 1, 0], Em: [0, 2, 2, 0, 0, 0], Dm: [null, null, 0, 2, 3, 1],
};
const KEYS: Pitch[] = [
  { l: 0, acc: 0 }, { l: 1, acc: -1 }, { l: 1, acc: 0 }, { l: 2, acc: -1 }, { l: 2, acc: 0 }, { l: 3, acc: 0 },
  { l: 3, acc: 1 }, { l: 4, acc: 0 }, { l: 5, acc: -1 }, { l: 5, acc: 0 }, { l: 6, acc: -1 }, { l: 6, acc: 0 },
];

export default function Tunings() {
  return (
    <TCard eyebrow="Guitar · 3" title="Alternate tunings, capo and transposing" narrate="theory-tunings" className="explainer">
      <Tuner />
      <CapoLab />
    </TCard>
  );
}

function Tuner() {
  const [id, setId] = useState('dropd');
  const [find, setFind] = useState<number | null>(null);
  const [n, setN] = useState(5);
  const t = TUNINGS.find((x) => x.id === id)!;
  const std = TUNINGS[0];
  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [];
    t.midi.forEach((m, s) => {
      for (let f = 0; f <= 12; f++) {
        const pc = (m + f) % 12;
        if (find !== null && pc === find) out.push({ s, f, kind: 'sel', label: NAMES[pc] });
        else if (find === null && f === 0) out.push({ s, f, kind: 'scale', label: NAMES[pc] });
      }
    });
    return out;
  }, [t, find]);
  const diffs = t.midi.map((m, s) => m - std.midi[s]);
  const open = OPEN_CHORD[id];
  const barreRoot = open ? mod(open.root + n, 12) : 0;
  const play = (frets: number) => (open ? open.strings : [0, 1, 2, 3, 4, 5]).forEach((s, i) => pluck(t.midi[s] + frets, i * 0.05, 2.2));
  return (
    <section className="rh-block">
      <h3 className="tx-h3">1 · Alternate tunings</h3>
      <p className="hint small">Tuning is how the six strings are pitched. <b>Standard</b> tuning (E A D G B E) is a compromise that makes most chords and scales reachable. Other tunings trade that flexibility for a special sound, an easier shape, or a lower register. Pick one to see its fretboard.</p>
      <div className="tabs" role="radiogroup" aria-label="Tuning">
        {TUNINGS.map((x) => <button key={x.id} role="radio" aria-checked={id === x.id} className={id === x.id ? 'on' : ''} onClick={() => setId(x.id)}>{x.name}</button>)}
      </div>
      <div className="ex-live">
        <p className="ex-live-title"><b>{t.name}</b> · low → high: <b>{t.notes}</b></p>
        <ul>
          <li>{t.blurb}</li>
          <li>Compared with standard: {diffs.every((d) => d === 0) ? 'this is standard.' : diffs.map((d, s) => d ? <span key={s} className="acc-chip">string {6 - s}: {d > 0 ? '+' : ''}{d} st</span> : null)}</li>
          <li>Neighbouring strings: {t.midi.slice(1).map((m, i) => <span key={i} className="acc-chip">{NAMES[t.midi[i] % 12]}→{NAMES[m % 12]} {intervalName(m - t.midi[i])}</span>)}</li>
        </ul>
      </div>
      <div className="builder-bar">
        <button className="pill accent" onClick={() => t.midi.forEach((m, s) => pluck(m, s * 0.07, 2.4))}>▶ Strum the open strings</button>
        <span className="setting-label" style={{ width: 'auto' }}>Find a note</span>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          <button className={find === null ? 'on' : ''} onClick={() => setFind(null)}>open</button>
          {NAMES.map((nm, pc) => <button key={pc} className={find === pc ? 'on' : ''} onClick={() => setFind(pc)}>{nm}</button>)}
        </div>
      </div>
      <FlatFretboard tuning={t.midi} frets={12} marks={marks} onCell={(s, f) => pluck(t.midi[s] + f)} caption={`${t.name} tuning fretboard`} />
      <p className="hint small">Notice how the same note lands on different frets than in standard tuning. When you change tuning, <b>shapes you know move or break</b>: only the strings that changed shift. In Drop D, a chord that uses the 6th string must be re-fingered.</p>
      {open && (
        <div className="ex-live">
          <p className="ex-live-title">{open.suffix === '5' ? 'One-finger power chords' : open.suffix === 'sus4' ? 'Open strings ring a sus chord' : 'Open strings ring a chord'}:
            fret <b>{n}</b> across {open.suffix === '5' ? 'the three lowest strings' : 'all six strings'} = <b>{NAMES[barreRoot]}{open.suffix}</b></p>
          <label className="tempo-row" style={{ margin: 0 }}><span className="setting-label" style={{ width: 'auto' }}>Fret</span>
            <input type="range" min={0} max={12} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Fret to barre" /><b>{n}</b>
            <button className="pill accent" onClick={() => play(n)}>▶ Play</button></label>
          <p className="hint small">That is the point of the tuning: lay one finger flat across the strings and the shape stays the same while the key changes.</p>
        </div>
      )}
    </section>
  );
}

function CapoLab() {
  const [key, setKey] = useState<Pitch>({ l: 6, acc: -1 });
  const [minor, setMinor] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const keyPc = mod(STRINGS[0].midi * 0 + (key.l === 0 ? 0 : [0, 2, 4, 5, 7, 9, 11][key.l]) + key.acc, 12);
  const rows = CAPO_SHAPES.filter((s) => s.minor === minor).map((s) => {
    const pc = mod([0, 2, 4, 5, 7, 9, 11][s.root.l] + s.root.acc, 12);
    return { ...s, capo: mod(keyPc - pc, 12), pc };
  }).sort((a, b) => a.capo - b.capo);
  const best = rows[0];
  const sel = rows.find((r) => r.name === pick) ?? best;
  const shape = CAPO_OPEN[sel.name];
  const marks: Mark[] = shape.flatMap((f, s) => (f === null ? [] : [{ s, f: f + sel.capo, kind: f === 0 ? 'scale' as const : 'root' as const, label: f === 0 ? '○' : String(f) }]));
  const names = (k: Pitch, m: boolean) => [0, 3, 4, ...(m ? [5] : [5])].map((d) => diatonicName(k, m, d));
  return (
    <section className="rh-block">
      <h3 className="tx-h3">2 · Capo: change key without changing shapes</h3>
      <p className="hint small">A <b>capo</b> clamps across the neck and acts as a new nut: every open string is raised by the same number of frets. You play easy open-chord shapes, but the music sounds higher. To find the capo position for a song: <b>capo fret = (sounding key − shape key) in semitones</b>.</p>
      <div className="builder-bar">
        <span className="setting-label" style={{ width: 'auto' }}>Song in</span>
        <div className="seg" style={{ flexWrap: 'wrap' }}>{KEYS.map((k) => <button key={pitchName(k)} className={mod([0, 2, 4, 5, 7, 9, 11][k.l] + k.acc, 12) === keyPc ? 'on' : ''} onClick={() => { setKey(k); setPick(null); }}>{pitchName(k)}</button>)}</div>
        <div className="seg"><button className={!minor ? 'on' : ''} onClick={() => { setMinor(false); setPick(null); }}>major</button><button className={minor ? 'on' : ''} onClick={() => { setMinor(true); setPick(null); }}>minor</button></div>
      </div>
      <div className="capo-table">
        <div className="capo-head"><span>Play shapes in</span><span>Capo</span><span>You play</span><span>It sounds</span></div>
        {rows.map((r) => (
          <button key={r.name} className={`capo-row ${sel.name === r.name ? 'on' : ''} ${r.capo === 0 ? 'zero' : ''}`} onClick={() => setPick(r.name)}>
            <b>{r.name}</b><span>{r.capo === 0 ? 'no capo' : `fret ${r.capo}`}</span>
            <span>{names(r.root, r.minor).join(' · ')}</span><span>{names(key, minor).join(' · ')}</span>
          </button>
        ))}
      </div>
      <p className="hint small">Chords shown are I, IV, V and vi/VI of each key (the sounding key is the right column). {best.capo > 0 && <>The lowest capo here is <b>{best.name} shapes with the capo at fret {best.capo}</b>; higher capo positions are brighter and let a singer reach higher notes.</>} A capo above fret 7 gets squeezed and quiet.</p>
      <FlatFretboard frets={12} capo={sel.capo} marks={marks} caption="Open chord shape played with a capo" onCell={(s, f) => pluck(STRINGS[s].midi + f)} />
      <div className="start-row"><button className="pill accent" onClick={() => shape.forEach((f, s) => { if (f !== null) pluck(STRINGS[s].midi + sel.capo + f, s * 0.045, 2.2); })}>▶ Strum {sel.name} shape{sel.capo ? ` with capo ${sel.capo}` : ''} (sounds {pitchName(key)}{minor ? 'm' : ''})</button></div>
      <div className="ex-grid">
        <article><h3>Capo or barre?</h3><p>Both raise the pitch. The capo gives you ringing <b>open strings</b> and leaves all four fingers free; a barre chord uses a finger and has a different, tighter tone. Players often combine them.</p></article>
        <article><h3>Transposing with a capo</h3><p>To play a song in a singer’s key, move the capo up one fret per semitone and keep your shapes. That is why folk and pop songbooks print “capo 3” above the chords: the chords on the page are the <i>shapes</i>, not the sounding chords.</p></article>
      </div>
    </section>
  );
}
