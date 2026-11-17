import { useMemo, useState } from 'react';
import { STRINGS, mod, pcOf, pitchName, type Pitch } from '../../lib/music';
import { BARRE_SHAPES, CAGED_FORMS, pentatonicBoxes, placeShape, type Shape } from '../../lib/theory';
import { pluck } from '../../lib/audio';
import FlatFretboard, { type Box, type Mark } from './FlatFretboard';
import TCard from './TCard';

const ROOTS: Pitch[] = [
  { l: 0, acc: 0 }, { l: 1, acc: -1 }, { l: 1, acc: 0 }, { l: 2, acc: -1 }, { l: 2, acc: 0 }, { l: 3, acc: 0 },
  { l: 3, acc: 1 }, { l: 4, acc: 0 }, { l: 5, acc: -1 }, { l: 5, acc: 0 }, { l: 6, acc: -1 }, { l: 6, acc: 0 },
];
const strum = (frets: (number | null)[]) => frets.forEach((f, s) => { if (f !== null) pluck(STRINGS[s].midi + f, s * 0.045, 2.2); });
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

function shapeMarks(frets: (number | null)[], rootPc: number, label: (pc: number) => string): Mark[] {
  const out: Mark[] = [];
  frets.forEach((f, s) => { if (f !== null) { const pc = (STRINGS[s].midi + f) % 12; out.push({ s, f, kind: pc === rootPc ? 'root' : 'scale', label: label(pc) }); } });
  return out;
}

export default function Shapes() {
  const [root, setRoot] = useState<Pitch>({ l: 4, acc: 0 });
  const rootPc = pcOf(root);
  const [tab, setTab] = useState<'barre' | 'caged' | 'pent'>('barre');

  return (
    <TCard eyebrow="Guitar · 2" title="Moveable shapes: barre chords, CAGED and pentatonic boxes" narrate="theory-shapes" className="explainer">
      <p className="hint">The guitar’s greatest trick: because the strings are tuned in a regular pattern, <b>every shape can slide up the neck</b> and keep its sound, only changing its key. Learn a handful of shapes and you can play in any key.</p>
      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Key" style={{ flexWrap: 'wrap' }}>
          {ROOTS.map((r) => <button key={pitchName(r)} className={pcOf(root) === pcOf(r) ? 'on' : ''} onClick={() => setRoot(r)}>{pitchName(r)}</button>)}
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'barre'} className={tab === 'barre' ? 'on' : ''} onClick={() => setTab('barre')}>Barre chords</button>
        <button role="tab" aria-selected={tab === 'caged'} className={tab === 'caged' ? 'on' : ''} onClick={() => setTab('caged')}>CAGED system</button>
        <button role="tab" aria-selected={tab === 'pent'} className={tab === 'pent' ? 'on' : ''} onClick={() => setTab('pent')}>Pentatonic boxes</button>
      </div>
      {tab === 'barre' && <Barre rootPc={rootPc} root={root} />}
      {tab === 'caged' && <Caged rootPc={rootPc} root={root} />}
      {tab === 'pent' && <Pent rootPc={rootPc} root={root} />}
    </TCard>
  );
}

/* ------------------------------ barre chords ------------------------------ */

function Barre({ rootPc, root }: { rootPc: number; root: Pitch }) {
  const [q, setQ] = useState<keyof typeof BARRE_SHAPES>('maj');
  const [which, setWhich] = useState(0);
  const shapes = BARRE_SHAPES[q];
  const sh = shapes[which % shapes.length];
  const placed = placeShape(sh, rootPc);
  const suffix = { maj: '', min: 'm', dom7: '7', min7: 'm7' }[q];
  const barreFret = placed ? Math.min(...placed.filter((f): f is number => f !== null && f > 0), 99) : 0;
  const names = useMemo(() => new Map<number, string>(), []);
  void names;
  return (
    <section className="rh-block">
      <div className="tx-head">
        <h3 className="tx-h3">{pitchName(root)}{suffix} as a barre chord</h3>
        <div className="controls">
          <div className="seg">{([['maj', 'Major'], ['min', 'Minor'], ['dom7', '7'], ['min7', 'm7']] as const).map(([k, l]) => <button key={k} className={q === k ? 'on' : ''} onClick={() => setQ(k)}>{l}</button>)}</div>
          <div className="seg">{shapes.map((s, i) => <button key={s.id} className={which % shapes.length === i ? 'on' : ''} onClick={() => setWhich(i)}>{s.label}</button>)}</div>
        </div>
      </div>
      {placed ? (
        <>
          <FlatFretboard frets={Math.max(8, Math.max(...placed.filter((f): f is number => f !== null)) + 2)} marks={shapeMarks(placed, rootPc, (pc) => NAMES[pc])}
            boxes={barreFret < 99 ? [{ lo: barreFret, hi: barreFret, cls: 'barre' }] : []} onCell={(s, f) => pluck(STRINGS[s].midi + f)} caption="Barre chord shape" />
          <div className="start-row"><button className="pill accent" onClick={() => strum(placed)}>▶ Strum {pitchName(root)}{suffix}</button>
            <span className="muted">{barreFret < 99 ? <>Index finger flat across fret <b>{barreFret}</b></> : 'Open shape'}; the root is on the {sh.root === 0 ? '6th' : '5th'} string. Strings marked × are not played.</span></div>
        </>
      ) : <p className="muted">This chord does not fit this shape within the neck.</p>}
      <div className="ex-grid">
        <article><h3>How barre chords work</h3><p>Take an open chord such as E major, move it up so no open strings are used, and let your first finger replace the nut as a <b>barre</b>. The shape is unchanged, so its sound is unchanged; the chord just shifts up in pitch by the number of frets you moved.</p></article>
        <article><h3>Name them by the root</h3><p>An <b>E-shape</b> barre chord has its root on the 6th string: fret 3 is G, fret 5 is A. An <b>A-shape</b> has its root on the 5th string: fret 3 is C, fret 5 is D. Know the notes on those two strings and you can name every barre chord.</p></article>
        <article><h3>Power chords</h3><p>The two or three lowest strings of the E shape (root + fifth, with an optional octave) form a <b>power chord</b>: no third, so it is neither major nor minor. It is the basis of rock guitar.</p></article>
      </div>
    </section>
  );
}

/* ------------------------------ CAGED ------------------------------ */

function Caged({ rootPc, root }: { rootPc: number; root: Pitch }) {
  const [sel, setSel] = useState<string | 'all'>('all');
  const placed = useMemo(() => CAGED_FORMS.map((f) => ({ f, frets: placeShape(f, rootPc, undefined, 0) })), [rootPc]);
  const valid = placed.filter((p): p is { f: Shape; frets: (number | null)[] } => !!p.frets)
    .sort((a, b) => Math.min(...a.frets.filter((x): x is number => x !== null)) - Math.min(...b.frets.filter((x): x is number => x !== null)));
  const marks: Mark[] = [];
  const boxes: Box[] = [];
  valid.forEach(({ f, frets }) => {
    if (sel !== 'all' && sel !== f.id) return;
    const fr = frets.filter((x): x is number => x !== null);
    frets.forEach((x, s) => { if (x !== null) { const pc = (STRINGS[s].midi + x) % 12; marks.push({ s, f: x, kind: pc === rootPc ? 'root' : sel === 'all' ? 'scale' : 'alt', label: sel === 'all' ? f.id : NAMES[pc] }); } });
    boxes.push({ lo: Math.min(...fr), hi: Math.max(...fr), cls: sel === 'all' ? '' : 'sel' });
  });
  return (
    <section className="rh-block">
      <div className="tx-head">
        <h3 className="tx-h3">CAGED in {pitchName(root)} major</h3>
        <div className="seg"><button className={sel === 'all' ? 'on' : ''} onClick={() => setSel('all')}>All five</button>{CAGED_FORMS.map((f) => <button key={f.id} className={sel === f.id ? 'on' : ''} onClick={() => setSel(f.id)}>{f.id}</button>)}</div>
      </div>
      <p className="hint small">The five open chord shapes <b>C, A, G, E and D</b> can each be moved up the neck to play the same chord, and together they tile the fretboard: one {pitchName(root)} major chord in five places. Order along the neck: {valid.map((v) => v.f.id).join(' → ')}, then it repeats an octave higher.</p>
      <FlatFretboard frets={15} marks={marks} boxes={boxes} caption="CAGED shapes" onCell={(s, f) => pluck(STRINGS[s].midi + f)} />
      <div className="start-row">
        {valid.filter((v) => sel === 'all' || sel === v.f.id).map((v) => <button key={v.f.id} className="pill" onClick={() => strum(v.frets)}>▶ {v.f.label} at fret {Math.min(...v.frets.filter((x): x is number => x !== null))}</button>)}
      </div>
      <div className="ex-grid">
        <article><h3>Why it is useful</h3><p>The word CAGED is just the order of the open shapes. Learn the five and you always have a chord and a surrounding scale region wherever you are on the neck. Soloists use the shapes as “home bases”: the chord tones in each form are the safe notes to land on.</p></article>
        <article><h3>Chords become scales</h3><p>Around each chord shape sits a pattern of the major scale. Connect them and the whole neck is mapped: that is how players escape the “box” of one position. The pentatonic boxes tab shows the five scale regions for the same neighbourhoods.</p></article>
      </div>
    </section>
  );
}

/* ------------------------------ pentatonic boxes ------------------------------ */

function Pent({ rootPc, root }: { rootPc: number; root: Pitch }) {
  const [minor, setMinor] = useState(true);
  const [box, setBox] = useState<number | 'all'>('all');
  const scaleRoot = minor ? rootPc : rootPc;                         // key root is the scale root either way
  const all = useMemo(() => pentatonicBoxes(scaleRoot, minor), [scaleRoot, minor]);
  // "box 1" is the one whose lowest string note is the root, then the next four up the neck
  const rootFret = mod(scaleRoot - STRINGS[0].midi, 12);
  const start = Math.max(0, all.findIndex((b) => b.pos.some((p) => p.s === 0 && p.f === rootFret)));
  const five = Array.from({ length: 5 }, (_, i) => all[(start + i) % all.length]).filter(Boolean);
  const semis = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const pcs = new Set(semis.map((x) => (scaleRoot + x) % 12));
  const marks: Mark[] = [];
  const boxes: Box[] = [];
  five.forEach((b, i) => {
    if (box !== 'all' && box !== i) return;
    boxes.push({ lo: b.lo, hi: b.hi, cls: box === 'all' ? `b${i}` : 'sel' });
    b.pos.forEach((p) => { const pc = (STRINGS[p.s].midi + p.f) % 12; marks.push({ s: p.s, f: p.f, kind: pc === scaleRoot ? 'root' : 'scale', label: box === 'all' ? '' : NAMES[pc] }); });
  });
  if (box === 'all') {
    STRINGS.forEach((st, s) => { for (let f = 0; f <= 17; f++) if (pcs.has((st.midi + f) % 12) && !marks.some((m) => m.s === s && m.f === f)) marks.push({ s, f, kind: (st.midi + f) % 12 === scaleRoot ? 'root' : 'scale' }); });
  }
  return (
    <section className="rh-block">
      <div className="tx-head">
        <h3 className="tx-h3">{pitchName(root)} {minor ? 'minor' : 'major'} pentatonic</h3>
        <div className="controls">
          <div className="seg"><button className={minor ? 'on' : ''} onClick={() => setMinor(true)}>Minor</button><button className={!minor ? 'on' : ''} onClick={() => setMinor(false)}>Major</button></div>
          <div className="seg"><button className={box === 'all' ? 'on' : ''} onClick={() => setBox('all')}>All</button>{five.map((_, i) => <button key={i} className={box === i ? 'on' : ''} onClick={() => setBox(i)}>Box {i + 1}</button>)}</div>
        </div>
      </div>
      <p className="hint small">A <b>box</b> is a pentatonic scale fingered with exactly two notes on each string inside a span of about four frets. Five boxes cover the neck, each starting where the last one ended. Box 1 is the one with the root on the low E string.</p>
      <FlatFretboard frets={17} marks={marks} boxes={boxes} caption="Pentatonic boxes" onCell={(s, f) => pluck(STRINGS[s].midi + f)} />
      <p className="hint small">{box === 'all' ? 'Shaded bands show the five boxes; each one overlaps its neighbours by a note or two.' : (() => { const b = five[box]; return b ? `Box ${box + 1} covers frets ${b.lo}–${b.hi}. Start on a root (amber) and play every note in the box up and down.` : ''; })()}</p>
      <div className="ex-grid">
        <article><h3>Minor and major are the same boxes</h3><p>A minor pentatonic and the pentatonic of its relative major (C major pentatonic) use <b>the same notes</b> and therefore the same box shapes; only the home note differs. Slide the minor boxes down three frets to get the major ones, which is why one set of five shapes covers blues, rock and country.</p></article>
        <article><h3>Using the boxes</h3><p>Pick a box next to the chord you are playing, find the root notes in it, and phrase around them. Then connect to the next box by sliding on a string. Add the ♭5 (the “blue note”) to the minor pentatonic for the classic blues sound.</p></article>
      </div>
    </section>
  );
}
