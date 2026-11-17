import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAJOR_KEYS, SCALES, SCALE_ORDER, KEY_SIGS, circlePos, midiOf, noteName, pcOf, pitchName, positionsFor, scaleAscending,
  scaleGaps, scaleNotes, parentMajor, signatureCount, signatureLabel, spellMidi, stepOf, noteFromStep, MIN_WRITTEN, MAX_WRITTEN, STRINGS, WRITTEN_OFFSET,
  type FretPos, type Note, type Pitch, type ScaleType,
} from '../lib/music';
import { pluck } from '../lib/audio';
import Staff, { type AccMode } from './Staff';
import Fretboard3D, { type LabelMode } from './Fretboard3D';
import CircleOfFifths from './CircleOfFifths';
import Explainer from './Explainer';
import Chords from './Chords';
import Licks from './Licks';
import SpotlightCard from './reactbits/SpotlightCard';

const FLAT_ROOTS = new Set(['F', 'B♭', 'E♭', 'A♭', 'D♭']);

// Most places any one note can be played — the positions list reserves room for this many rows so
// stepping through notes (e.g. while a scale plays) never changes the card height and shifts the page.
let maxPlaces = 1;
for (let m = MIN_WRITTEN; m <= MAX_WRITTEN; m++) maxPlaces = Math.max(maxPlaces, positionsFor(m).length);

export default function App() {
  const [root, setRoot] = useState<Pitch>(MAJOR_KEYS[0]);
  const [type, setType] = useState<ScaleType>('major');
  const [selected, setSelected] = useState<Note>({ l: 4, acc: 0, oct: 4 }); // written G4 = open G string
  const [accMode, setAccMode] = useState<AccMode>('auto');
  const [labelMode, setLabelMode] = useState<LabelMode>('names');
  const [focus, setFocus] = useState<FretPos | null>(null);
  const [sound, setSound] = useState(true);
  const timers = useRef<number[]>([]);

  const positions = useMemo(() => positionsFor(midiOf(selected)), [selected]);
  const notes = useMemo(() => scaleNotes(root, type), [root, type]);

  const select = useCallback((n: Note) => {
    const m = midiOf(n);
    if (m < MIN_WRITTEN || m > MAX_WRITTEN) return;
    setSelected(n);
    if (sound) pluck(m - WRITTEN_OFFSET);
  }, [sound]);

  const pickFret = (s: number, f: number) => {
    const m = STRINGS[s].midi + f + WRITTEN_OFFSET;
    const inScale = notes.find((n) => n.pc === m % 12);
    const flat = FLAT_ROOTS.has(pitchName(root)) || (inScale ? inScale.acc < 0 : false);
    const sp = spellMidi(m, flat);
    if (inScale) {
      // respell using the scale's letter so it matches the staff
      const letter = inScale.l;
      const oct = Math.round((m - (inScale.acc + [0, 2, 4, 5, 7, 9, 11][letter])) / 12) - 1;
      select({ l: letter, acc: inScale.acc, oct });
    } else select(sp);
  };

  const pickRoot = (k: Pitch, ring: 'major' | 'minor') => {
    setRoot(k);
    const fam = SCALES[type].family;
    if (ring !== fam) setType(ring === 'major' ? 'major' : 'minor');
  };

  const playScale = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    scaleAscending(root, type).forEach(({ note }, i) => {
      timers.current.push(window.setTimeout(() => {
        setSelected(note); pluck(midiOf(note) - WRITTEN_OFFSET, 0, 1.2);
      }, i * 420));
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      const step = stepOf(selected) + (e.key === 'ArrowUp' ? 1 : -1);
      const sn = notes.find((n) => n.l === ((step % 7) + 7) % 7);
      select(noteFromStep(step, sn?.acc ?? 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, notes, select]);

  const inKey = notes.find((n) => n.pc === midiOf(selected) % 12);
  const degree = inKey?.degree;
  const gaps = scaleGaps(type);
  const accidentals = notes.filter((n) => n.acc !== 0);
  const parent = parentMajor(root, type);

  return (
    <div className="app">
      {/* ---------------- Staff ↔ fretboard positions ---------------- */}
      <section className="row two-one">
        <SpotlightCard className="card">
          <header className="card-head">
            <div>
              <p className="eyebrow">1 · The page</p>
              <h2>Pick a note on the treble clef</h2>
            </div>
            <div className="seg" role="radiogroup" aria-label="Accidental">
              {([['auto', 'Key'], [0, '♮'], [1, '♯'], [-1, '♭']] as [AccMode, string][]).map(([v, l]) => (
                <button key={String(v)} className={accMode === v ? 'on' : ''} onClick={() => setAccMode(v)}
                  title={v === 'auto' ? 'Spell notes to match the chosen key' : undefined}>{l}</button>
              ))}
            </div>
          </header>
          <Staff root={root} type={type} selected={selected} accMode={accMode} onSelect={select} />
          <p className="hint">Click any line or space, or one of the scale notes. <kbd>↑</kbd> <kbd>↓</kbd> moves the note.</p>
        </SpotlightCard>

        <SpotlightCard className="card" spotlight="rgba(255,122,89,0.10)">
          <p className="eyebrow">2 · The neck</p>
          <h2 className="places-title"><span className="big-note">{noteName(selected, true)}</span> can be played in {positions.length} {positions.length === 1 ? 'place' : 'places'}</h2>
          <ul className="positions" style={{ minHeight: maxPlaces * 48 + (maxPlaces - 1) * 8, alignContent: 'start' }}>
            {positions.map((p) => (
              <li key={`${p.s}-${p.f}`}>
                <button onMouseEnter={() => setFocus(p)} onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(p)} onBlur={() => setFocus(null)}
                  onClick={() => pluck(STRINGS[p.s].midi + p.f)}>
                  <span className="str">{STRINGS[p.s].label}</span>
                  <span className="where"><b>{STRINGS[p.s].name} string</b><em>{p.f === 0 ? 'open' : `fret ${p.f}`}</em></span>
                  <span className="tab">{STRINGS.map((_, i) => <i key={i} className={i === p.s ? 'hit' : ''} />).reverse()}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="hint small note-hint">
            Guitar music is <b>written an octave higher</b> than it sounds, so this {noteName(selected, true)} actually
            sounds as {noteName({ ...selected, oct: selected.oct - 1 }, true)}.
            {degree && <> In {pitchName(root)} {SCALES[type].label.toLowerCase()} it is degree <b>{degree}</b>.</>}
            {!inKey && <> It is outside the chosen scale.</>}
          </p>
        </SpotlightCard>
      </section>

      {/* ---------------- 3D fretboard ---------------- */}
      <SpotlightCard className="card wide">
        <header className="card-head">
          <div>
            <p className="eyebrow">3 · The fretboard</p>
            <h2>{pitchName(root)} {SCALES[type].label.toLowerCase()} across the neck</h2>
          </div>
          <div className="controls">
            <div className="seg" role="radiogroup" aria-label="Labels">
              {([['names', 'Notes'], ['degrees', 'Degrees'], ['none', 'Dots']] as [LabelMode, string][]).map(([v, l]) => (
                <button key={v} className={labelMode === v ? 'on' : ''} onClick={() => setLabelMode(v)}>{l}</button>
              ))}
            </div>
            <button className={`pill ${sound ? 'on' : ''}`} onClick={() => setSound(!sound)}>{sound ? '🔊 Sound on' : '🔈 Muted'}</button>
            <button className="pill accent" onClick={playScale}>▶ Play scale</button>
          </div>
        </header>
        <Fretboard3D root={root} type={type} selected={selected} focus={focus} labelMode={labelMode} onPick={pickFret} />
        <ul className="legend">
          <li><i className="dot root" /> Root</li>
          <li><i className="dot scale" /> Scale tone</li>
          <li><i className="dot sel" /> Your note</li>
          <li className="muted">Hover for names · click any fret to hear and read it · move the mouse to tilt the neck</li>
        </ul>
      </SpotlightCard>

      {/* ---------------- Circle of fifths ---------------- */}
      <section className="row one-one">
        <SpotlightCard className="card">
          <p className="eyebrow">4 · The key</p>
          <h2>Circle of fifths</h2>
          <CircleOfFifths root={root} type={type} onPick={pickRoot} />
          <p className="hint small">Outer ring: major keys with their signature. Inner ring: relative minors. Lit wedges are notes of the current scale; the shape in the middle shows how the scale sits on the circle.</p>
        </SpotlightCard>

        <SpotlightCard className="card" spotlight="rgba(79,209,197,0.10)">
          <p className="eyebrow">5 · The scale</p>
          <h2>{pitchName(root)} {SCALES[type].label}</h2>
          <div className="tabs" role="tablist">
            {SCALE_ORDER.map((t) => (
              <button key={t} role="tab" aria-selected={type === t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{SCALES[t].label}</button>
            ))}
          </div>
          <p className="blurb">{SCALES[type].blurb}</p>
          <div className="notes-row">
            {notes.map((n) => (
              <button key={n.pc} className={`chip ${n.isRoot ? 'root' : ''} ${midiOf(selected) % 12 === n.pc ? 'sel' : ''}`}
                onClick={() => {
                  const asc = scaleAscending(root, type).find((a) => a.note.l === n.l && a.note.acc === n.acc);
                  if (asc) select(asc.note);
                }}>
                <b>{pitchName(n)}</b><small>{n.degree}</small>
              </button>
            ))}
          </div>
          <div className="gaps" aria-label="Step pattern">
            {gaps.map((g, i) => <span key={i} className={`gap g-${g.replace('+', '')}`}>{g}</span>)}
          </div>
          <div className="accs">
            <span className="accs-label">Sharps &amp; flats in this scale</span>
            {accidentals.length === 0
              ? <span className="acc-chip none">none · all natural notes</span>
              : <>
                  {accidentals.map((n) => <span key={n.pc} className={`acc-chip ${n.acc > 0 ? 'sharp' : 'flat'}`}>{pitchName(n)}</span>)}
                  <span className="accs-count">{accidentals.length}{accidentals[0].acc > 0 ? '♯' : '♭'}</span>
                </>}
          </div>
          <p className="hint small">
            W = whole step (2 frets) · H = half step (1 fret).
            {SCALES[type].family === 'major' || type === 'dorian' || type === 'minor' || type === 'minorPent'
              ? <> Same notes as {pitchName(parent)} major ({signatureLabel(signatureCount(parent))}).</> : null}
          </p>
          <button className="pill accent block" onClick={playScale}>▶ Hear it and watch it travel</button>
        </SpotlightCard>
      </section>

      <Chords root={root} type={type} />

      <Licks root={root} type={type} />

      <Explainer root={root} type={type} />
    </div>
  );
}
