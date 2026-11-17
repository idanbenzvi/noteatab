import { useEffect, useMemo, useRef, useState } from 'react';
import { mod, noteName, pcOf, pitchName, scaleNotes, type Pitch } from '../../lib/music';
import { FUNCTION_NAMES, MAJOR_FUNCTIONS, MINOR_FUNCTIONS, QUALITIES, QUALITY_BY_ID, noteAbove, spellChord, type Func } from '../../lib/theory';
import { playChord, ac } from '../../lib/audio';
import { followClock } from '../../lib/rhythmAudio';
import { buildChord, type Chord, type Step } from '../Chords';
import { MiniStaff } from './MiniStaff';
import { VoiceToggle, type Voice } from './common';
import TCard from './TCard';

const ROOTS: Pitch[] = [
  { l: 0, acc: 0 }, { l: 1, acc: -1 }, { l: 1, acc: 0 }, { l: 2, acc: -1 }, { l: 2, acc: 0 }, { l: 3, acc: 0 },
  { l: 3, acc: 1 }, { l: 4, acc: 0 }, { l: 5, acc: -1 }, { l: 5, acc: 0 }, { l: 6, acc: -1 }, { l: 6, acc: 0 },
];
const LETTER_STEPS: Record<string, number[]> = { sus2: [0, 1, 4], sus4: [0, 3, 4] };

/** Sounding MIDI for a chord, root-position, bass around C3. */
const chordMidis = (c: Chord, bass = 48) => { const b = bass + mod(c.pcs[0] - bass, 12); return c.offs.map((o) => b + o); };

interface Preset { name: string; major: boolean; steps: Step[]; note: string }
const dom = (d: number): Step => ({ d, ov: 'dom7' });
const PRESETS: Preset[] = [
  { name: 'I – V – vi – IV', major: true, steps: [{ d: 0 }, { d: 4 }, { d: 5 }, { d: 3 }], note: 'The pop-rock loop: home, tension, a minor shade, then a gentle lift.' },
  { name: 'I – vi – IV – V', major: true, steps: [{ d: 0 }, { d: 5 }, { d: 3 }, { d: 4 }], note: 'The “50s progression”: doo-wop and early rock and roll.' },
  { name: 'ii – V – I', major: true, steps: [{ d: 1, seventh: true }, { ...dom(4) }, { d: 0, seventh: true }], note: 'The core of jazz harmony: subdominant → dominant → tonic.' },
  { name: '12-bar blues', major: true, steps: [dom(0), dom(0), dom(0), dom(0), dom(3), dom(3), dom(0), dom(0), dom(4), dom(3), dom(0), dom(4)], note: 'Twelve bars on I, IV and V (all dominant 7ths): the backbone of blues, rock and roll and jazz.' },
  { name: 'i – ♭VII – ♭VI – V', major: false, steps: [{ d: 0 }, { d: 6 }, { d: 5 }, { d: 4, ov: 'maj' }], note: 'The Andalusian cadence: a descending line from i to V, a flamenco and rock staple.' },
  { name: 'i – ♭VI – ♭III – ♭VII', major: false, steps: [{ d: 0 }, { d: 5 }, { d: 2 }, { d: 6 }], note: 'An epic minor-key loop built only from the natural minor scale.' },
  { name: 'i – iv – V7 – i', major: false, steps: [{ d: 0 }, { d: 3 }, { d: 4, ov: 'dom7' }, { d: 0 }], note: 'Classic minor cadence with a major V7 borrowed from harmonic minor.' },
];

export default function Harmony() {
  const [voice, setVoice] = useState<Voice>('piano');
  const [root, setRoot] = useState<Pitch>(ROOTS[0]);
  const [qid, setQid] = useState('maj');
  const [minor, setMinor] = useState(false);
  const [sevenths, setSevenths] = useState(false);
  const [prog, setProg] = useState<Step[]>(PRESETS[0].steps);
  const [bpm, setBpm] = useState(84);
  const [active, setActive] = useState<number | undefined>(undefined);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);

  /* ---- 1 · building a chord ---- */
  const q = QUALITY_BY_ID[qid];
  const steps = LETTER_STEPS[q.id] ?? [0, 2, 4, 6];
  const rootNote = { ...root, oct: 4 };
  const stack = q.offs.map((o, k) => noteAbove(rootNote, steps[k] + 1, o));
  const names = spellChord(root, q).map(pitchName);
  const buildMidis = q.offs.map((o) => 60 + mod(pcOf(root), 12) + o - (pcOf(root) > 6 ? 12 : 0));
  const hearBuild = (arp: boolean) => playChord(voice, buildMidis.map((m) => m - (voice === 'guitar' ? 12 : 0)), { spread: arp ? 0.3 : undefined });
  const gaps = q.offs.slice(1).map((o, k) => o - q.offs[k]);
  const gapName = (g: number) => (g === 4 ? 'major 3rd' : g === 3 ? 'minor 3rd' : g === 5 ? 'perfect 4th' : g === 2 ? 'major 2nd' : g === 7 ? 'perfect 5th' : `${g} semitones`);

  /* ---- 2 · chords of a key ---- */
  const scale = useMemo(() => scaleNotes(root, minor ? 'minor' : 'major'), [root, minor]);
  const diatonic = useMemo(() => scale.map((_, d) => buildChord(scale, { d }, sevenths)), [scale, sevenths]);
  const funcs = minor ? MINOR_FUNCTIONS : MAJOR_FUNCTIONS;

  /* ---- 3 · progression builder ---- */
  const chords = useMemo(() => prog.map((s) => buildChord(scale, s, sevenths)), [prog, scale, sevenths]);
  const barSec = (60 / bpm) * 4;
  const playProg = () => {
    cancel.current?.();
    const t0 = ac().currentTime + 0.1;
    const times = chords.map((_, i) => t0 + i * barSec);
    chords.forEach((c, i) => {
      const m = chordMidis(c).map((x) => x - (voice === 'guitar' ? 12 : 0));
      playChord(voice, m, { delay: times[i] - ac().currentTime, dur: barSec * 0.95 });
      playChord(voice, m, { delay: times[i] - ac().currentTime + barSec / 2, dur: barSec * 0.45 });
    });
    cancel.current = followClock(times, setActive, () => setActive(undefined), t0 + chords.length * barSec);
  };
  const hearChord = (c: Chord) => playChord(voice, chordMidis(c).map((x) => x - (voice === 'guitar' ? 12 : 0)), { dur: 2 });
  const addStep = (s: Step) => { setProg((p) => (p.length >= 16 ? p : [...p, s])); };
  const romanOf = (s: Step) => buildChord(scale, s, sevenths).roman;

  const cadence = (a: Step, b: Step) => {
    const ca = buildChord(scale, a, false), cb = buildChord(scale, b, false);
    cancel.current?.();
    playChord(voice, chordMidis(ca).map((x) => x - (voice === 'guitar' ? 12 : 0)), { dur: 1.6 });
    playChord(voice, chordMidis(cb).map((x) => x - (voice === 'guitar' ? 12 : 0)), { delay: 1.1, dur: 2.4 });
  };

  return (
    <TCard eyebrow="Pitch & harmony · 2" title="Chords and harmony" narrate="theory-harmony" className="explainer">
      <p className="hint">A <b>chord</b> is three or more notes played together. Most chords are built by stacking <b>thirds</b>: take a note, skip one, take the next, skip one, take the next. The size of the thirds (major = 4 semitones, minor = 3) decides the chord’s character.</p>
      <div className="builder-bar">
        <VoiceToggle voice={voice} onChange={setVoice} />
        <div className="seg" role="radiogroup" aria-label="Key" style={{ flexWrap: 'wrap' }}>
          {ROOTS.map((r) => <button key={pitchName(r)} className={pcOf(root) === pcOf(r) ? 'on' : ''} onClick={() => setRoot(r)}>{pitchName(r)}</button>)}
        </div>
      </div>

      <section className="rh-block">
        <h3 className="tx-h3">1 · Building a chord</h3>
        <div className="tabs" role="radiogroup" aria-label="Chord quality">
          {QUALITIES.map((x) => <button key={x.id} role="radio" aria-checked={qid === x.id} className={qid === x.id ? 'on' : ''} onClick={() => setQid(x.id)}>{x.name}</button>)}
        </div>
        <MiniStaff notes={stack.map((n, i) => ({ n, stack: i > 0, cls: i === 0 ? 'sel' as const : undefined }))} width={440} gap={0} caption={`${pitchName(root)}${q.symbol} chord on the staff`} />
        <div className="ex-live">
          <p className="ex-live-title"><b>{pitchName(root)}{q.symbol}</b> = {names.join(' – ')} · formula <b>{q.formula}</b></p>
          <ul>
            <li>Stacked from the root: {gaps.map((g, i) => <span key={i}>{i ? ' + ' : ''}<b>{gapName(g)}</b></span>)}. {q.sound}</li>
            <li>Intervals above the root: {q.offs.slice(1).map((o, i) => <span key={i} className="acc-chip">{noteName(stack[i + 1])} · {o} st</span>)}</li>
          </ul>
        </div>
        <div className="start-row"><button className="pill accent" onClick={() => hearBuild(false)}>▶ Hear the chord</button><button className="pill" onClick={() => hearBuild(true)}>♪ Hear it note by note</button></div>
      </section>

      <section className="rh-block">
        <div className="tx-head">
          <h3 className="tx-h3">2 · The chords of a key and what they do</h3>
          <div className="controls">
            <div className="seg"><button className={!minor ? 'on' : ''} onClick={() => setMinor(false)}>Major</button><button className={minor ? 'on' : ''} onClick={() => setMinor(true)}>Minor</button></div>
            <div className="seg"><button className={!sevenths ? 'on' : ''} onClick={() => setSevenths(false)}>Triads</button><button className={sevenths ? 'on' : ''} onClick={() => setSevenths(true)}>7ths</button></div>
          </div>
        </div>
        <p className="hint small">Build a triad on each note of the {pitchName(root)} {minor ? 'minor' : 'major'} scale and number the chords with <b>Roman numerals</b>: capitals for major chords, lower case for minor, ° for diminished. Chords fall into three families by <b>function</b>. Click a chord to hear it.</p>
        <div className="func-grid">
          {diatonic.map((c, d) => {
            const f: Func = funcs[d];
            return (
              <button key={d} className={`func-cell f-${f}`} onClick={() => hearChord(c)} title={`${c.symbol}: ${FUNCTION_NAMES[f].name}`}>
                <small>{c.roman}</small><b>{c.symbol}</b><span>{c.names.join(' ')}</span><em>{FUNCTION_NAMES[f].name}</em>
              </button>
            );
          })}
        </div>
        <div className="func-legend">
          {(['T', 'S', 'D'] as Func[]).map((f) => <span key={f} className={`func-tag f-${f}`}><b>{FUNCTION_NAMES[f].name}</b> {FUNCTION_NAMES[f].blurb}</span>)}
        </div>
        <p className="hint small">Harmony usually flows <b>tonic → subdominant → dominant → tonic</b>, home to away to tension and back. The <b>I, IV and V</b> chords (one of each flavour) are enough to play thousands of songs.</p>
      </section>

      <section className="rh-block">
        <h3 className="tx-h3">3 · Build a progression</h3>
        <p className="hint small">Tap chords to add them (up to 16 bars), or start from a classic. Each chord lasts one bar of 4 beats.</p>
        <div className="preset-row">
          {PRESETS.filter((p) => p.major === !minor).map((p) => <button key={p.name} className="pill" onClick={() => { cancel.current?.(); setActive(undefined); setProg(p.steps); }} title={p.note}>{p.name}</button>)}
        </div>
        <div className="func-grid small">
          {diatonic.map((c, d) => <button key={d} className={`func-cell f-${funcs[d]}`} onClick={() => addStep({ d, seventh: sevenths })}><b>{c.roman}</b><span>{c.symbol}</span></button>)}
          <button className="func-cell f-D" onClick={() => addStep(dom(4))}><b>V7</b><span>{pitchName(scale[4])}7</span></button>
        </div>
        <div className="prog-slots" aria-label="Your progression">
          {chords.length === 0 && <span className="muted">Add a chord above.</span>}
          {chords.map((c, i) => (
            <button key={i} className={`slot ${active === i ? 'on' : ''}`} onClick={() => setProg((p) => p.filter((_, j) => j !== i))} title="Click to remove">
              <small>{c.roman}</small><b>{c.symbol}</b>
            </button>
          ))}
        </div>
        <div className="builder-bar">
          <button className="pill accent" onClick={playProg} disabled={!chords.length}>▶ Play progression</button>
          <button className="pill" onClick={() => { cancel.current?.(); setActive(undefined); setProg([]); }} disabled={!chords.length}>Clear</button>
          <label className="tempo-row" style={{ margin: 0 }}><span className="setting-label" style={{ width: 'auto' }}>Tempo</span>
            <input type="range" min={50} max={150} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Progression tempo" /><b>{bpm}</b></label>
        </div>
        <p className="hint small">Chord shapes for these on the fretboard live in the <b>Learn</b> tab, under “The chords”, for whichever key you pick there.</p>
      </section>

      <div className="ex-grid">
        <article>
          <h3>Cadences: how phrases end</h3>
          <p>A <b>cadence</b> is a chord pair that closes a phrase. Click one to hear it in {pitchName(root)} {minor ? 'minor' : 'major'}:</p>
          <div className="preset-row">
            <button className="pill" onClick={() => cadence({ d: 4 }, { d: 0 })}>Authentic V → I</button>
            <button className="pill" onClick={() => cadence({ d: 3 }, { d: 0 })}>Plagal IV → I</button>
            <button className="pill" onClick={() => cadence({ d: 0 }, { d: 4 })}>Half I → V</button>
            <button className="pill" onClick={() => cadence({ d: 4 }, { d: 5 })}>Deceptive V → vi</button>
          </div>
          <p className="hint small">Authentic is the full stop; plagal the soft “amen”; half is a comma; deceptive swerves where you expected home.</p>
        </article>
        <article>
          <h3>Why the V chord pulls home</h3>
          <p>The V chord contains the 7th degree of the scale (the <b>leading tone</b>), a half step below the tonic, and in V7 also the 4th degree, which wants to fall. Both notes crave a neighbour in the I chord, and that tension is what a dominant chord is.</p>
        </article>
        <article>
          <h3>Sevenths and colour</h3>
          <p>Adding another third on top makes a <b>seventh chord</b>. Major 7ths sound smooth, minor 7ths mellow, and the dominant 7th (a major triad with a ♭7) sounds bluesy and restless. Jazz uses them almost everywhere.</p>
        </article>
        <article>
          <h3>Roman numerals travel</h3>
          <p>I–V–vi–IV is the same pattern in every key: in C it is C–G–Am–F, in G it is G–D–Em–C. Naming chords by function lets you transpose a song just by changing the key, which is also how guitarists use a capo.</p>
        </article>
      </div>
    </TCard>
  );
}
