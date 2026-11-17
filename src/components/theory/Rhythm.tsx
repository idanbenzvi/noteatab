import { useEffect, useMemo, useRef, useState } from 'react';
import { STRINGS, WRITTEN_OFFSET, spellMidi, stepOf } from '../../lib/music';
import { BASES, BASE_INFO, BASE_UNITS, TIME_SIGS, ev, unitsOf, type Base, type REvent, type TimeSig } from '../../lib/rhythm';
import { followClock, schedulePattern } from '../../lib/rhythmAudio';
import RhythmStaff from './RhythmStaff';
import TCard from './TCard';

const NOTE_GLYPH: Record<Base, string> = { w: '𝅝', h: '𝅗𝅥', q: '𝅘𝅥', e: '𝅘𝅥𝅮', s: '𝅘𝅥𝅯' };
const REST_GLYPH: Record<Base, string> = { w: '𝄻', h: '𝄼', q: '𝄽', e: '𝄾', s: '𝄿' };
const TEMPO_WORDS: [number, string][] = [[60, 'Largo'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [200, 'Presto']];
const tempoWord = (bpm: number) => (TEMPO_WORDS.find(([b]) => bpm <= b) ?? TEMPO_WORDS[TEMPO_WORDS.length - 1])[1];

// An E-minor-pentatonic riff on the top three strings: the staff and the tab show the very same notes.
const RIFF: { s: number; f: number }[] = [
  { s: 3, f: 0 }, { s: 3, f: 2 }, { s: 4, f: 0 }, { s: 4, f: 3 }, { s: 5, f: 0 }, { s: 4, f: 3 }, { s: 4, f: 0 }, { s: 3, f: 2 },
];
const riffMidi = (r: { s: number; f: number }) => STRINGS[r.s].midi + r.f;           // sounding
const riffStep = (r: { s: number; f: number }) => stepOf(spellMidi(riffMidi(r) + WRITTEN_OFFSET));

function useRunner() {
  const [active, setActive] = useState<number | undefined>(undefined);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);
  const stop = () => { cancel.current?.(); setActive(undefined); };
  const run = (times: number[], endAt: number) => {
    cancel.current?.();
    cancel.current = followClock(times, setActive, () => setActive(undefined), endAt);
  };
  return { active, run, stop };
}

export default function Rhythm() {
  const [bpm, setBpm] = useState(88);

  return (
    <TCard eyebrow="Reading music · 1" title="Rhythm: when to play" narrate="theory-rhythm" className="explainer">
      <p className="hint">Pitch tells you <b>which</b> note to play; rhythm tells you <b>when</b> and <b>for how long</b>. Staff notation carries both. Plain tab only shows where to put your fingers, so learning rhythm is what lets you play a tab or a staff in time.</p>
      <label className="tempo-row">
        <span className="setting-label">Tempo</span>
        <input type="range" min={50} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="Tempo in beats per minute" />
        <b>{bpm} <small>bpm</small></b><span className="muted">{tempoWord(bpm)}</span>
      </label>
      <NoteValues bpm={bpm} />
      <TimeSignatures bpm={bpm} />
      <DotsTiesRests />
      <Builder bpm={bpm} />
    </TCard>
  );
}

/* ------------------------------ note values ------------------------------ */

function NoteValues({ bpm }: { bpm: number }) {
  const [rests, setRests] = useState(false);
  const [playing, setPlaying] = useState<Base | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const sig = TIME_SIGS[0];
  const play = (b: Base) => {
    const count = 16 / BASE_UNITS[b];
    const events = Array.from({ length: count }, () => ev(b, { rest: rests }));
    const sch = schedulePattern(events, sig, bpm, { metronome: true, pitch: 52 });
    setPlaying(b);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(null), Math.max(0, (sch.endAt - sch.startAt) * 1000) + 150);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <section className="rh-block">
      <div className="tx-head">
        <h3 className="tx-h3">1 · Note values and rests</h3>
        <div className="seg"><button className={!rests ? 'on' : ''} onClick={() => setRests(false)}>Notes</button><button className={rests ? 'on' : ''} onClick={() => setRests(true)}>Rests</button></div>
      </div>
      <p className="hint small">Every note value is half the one above it. Each row is one 4/4 bar (four beats); click a row to hear it counted against a metronome. A <b>rest</b> is a silence of the same length.</p>
      <div className="nv-grid">
        {BASES.map((b) => {
          const n = 16 / BASE_UNITS[b];
          return (
            <button key={b} className={`nv-row ${playing === b ? 'playing' : ''}`} onClick={() => play(b)} aria-label={`Play ${BASE_INFO[b].name} bar`}>
              <span className="nv-glyph">{rests ? REST_GLYPH[b] : NOTE_GLYPH[b]}</span>
              <span className="nv-name"><b>{rests ? BASE_INFO[b].restName : BASE_INFO[b].name}</b><small>{BASE_INFO[b].beats} · {BASE_INFO[b].fraction} of a whole</small></span>
              <span className="nv-bar" aria-hidden="true">
                {Array.from({ length: n }, (_, i) => <i key={i} style={{ flex: 1 }} className={playing === b ? 'on' : ''} />)}
              </span>
              <span className="nv-count">{n}×</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------ time signatures ------------------------------ */

function TimeSignatures({ bpm }: { bpm: number }) {
  const [sigId, setSigId] = useState('4/4');
  const sig = TIME_SIGS.find((s) => s.id === sigId)!;
  const events = useMemo<REvent[]>(() => (sig.group === 6 ? Array.from({ length: 6 }, () => ev('e')) : Array.from({ length: sig.top }, () => ev('q'))), [sig]);
  const { active, run, stop } = useRunner();
  const play = () => {
    const sch = schedulePattern(events, sig, bpm, { pitch: 55, countIn: false, metronome: false });
    run(sch.times, sch.endAt);
  };
  return (
    <section className="rh-block">
      <div className="tx-head">
        <h3 className="tx-h3">2 · Time signatures</h3>
        <div className="seg" role="radiogroup" aria-label="Time signature">
          {TIME_SIGS.map((s) => <button key={s.id} className={sigId === s.id ? 'on' : ''} onClick={() => { stop(); setSigId(s.id); }}>{s.label}</button>)}
        </div>
      </div>
      <p className="hint small">The <b>top number</b> says how many beats are in each bar; the <b>bottom number</b> says which note value gets one beat (4 = quarter note, 8 = eighth note). Bars are separated by barlines. {sig.feel}</p>
      <RhythmStaff events={events} sig={sig} active={active} caption={`A bar of ${sig.label}`} lineOnly />
      <div className="beat-boxes" aria-hidden="true">
        {Array.from({ length: sig.units / sig.group }, (_, b) => (
          <span key={b} className={`beat-box ${sig.strong.includes(b * sig.group) ? 'strong' : ''}`}>{b + 1}</span>
        ))}
      </div>
      <div className="start-row"><button className="pill accent" onClick={play}>▶ Play the bar</button><span className="muted">Strong beats are lit; the others lean toward them.</span></div>
    </section>
  );
}

/* ------------------------------ dots, ties, rests ------------------------------ */

function DotsTiesRests() {
  const [base, setBase] = useState<Base>('q');
  const [dot, setDot] = useState(true);
  const u = BASE_UNITS[base];
  const total = dot ? u * 1.5 : u;
  const beats = (x: number) => (x / 4 === 1 ? '1 beat' : `${x / 4} beats`);
  return (
    <section className="rh-block">
      <h3 className="tx-h3">3 · Dots, ties and rests</h3>
      <div className="ex-grid">
        <article>
          <h3>A dot adds half</h3>
          <p>A dot after a note makes it <b>half as long again</b>. A dotted half note is 2 + 1 = 3 beats. Pick a note:</p>
          <div className="seg" role="radiogroup" aria-label="Base note">
            {(['h', 'q', 'e'] as Base[]).map((b) => <button key={b} className={base === b ? 'on' : ''} onClick={() => setBase(b)}>{NOTE_GLYPH[b]}</button>)}
          </div>
          <label className="check"><input type="checkbox" checked={dot} onChange={(e) => setDot(e.target.checked)} /> dotted</label>
          <p className="dot-math"><span className="nv-glyph sm">{NOTE_GLYPH[base]}{dot ? '.' : ''}</span> = {beats(u)}{dot ? <> + {beats(u / 2)}</> : null} = <b>{beats(total)}</b></p>
        </article>
        <article>
          <h3>A tie adds two notes together</h3>
          <p>A curved line between two notes <b>of the same pitch</b> joins them into one longer sound: you play the first and hold through the second. Ties are how a note lasts across a barline.</p>
          <p className="dot-math"><span className="nv-glyph sm">𝅗𝅥 ⁀ 𝅘𝅥</span> = 2 + 1 = <b>3 beats</b>, the same as a dotted half note.</p>
          <p className="hint small">A <i>slur</i> looks similar but joins <b>different</b> pitches; on guitar it means “play legato” (hammer-ons and pull-offs).</p>
        </article>
        <article>
          <h3>Rests are written silence</h3>
          <p>Every note value has a rest of the same length. Stay in time while you rest: the beat keeps going. In tab, rests are often left out, which is one more reason to read the rhythm from the staff.</p>
          <p className="dot-math">{BASES.map((b) => <span key={b} className="nv-glyph sm" title={BASE_INFO[b].restName}>{REST_GLYPH[b]}</span>)}</p>
        </article>
        <article>
          <h3>Eighth-note flags and beams</h3>
          <p>Eighth notes have one flag, sixteenths have two. When several are side by side the flags join into <b>beams</b>, which group the notes by beat so you can see where each beat lies.</p>
        </article>
      </div>
    </section>
  );
}

/* ------------------------------ builder ------------------------------ */

function Builder({ bpm }: { bpm: number }) {
  const [sigId, setSigId] = useState('4/4');
  const sig = TIME_SIGS.find((s) => s.id === sigId)!;
  const [events, setEvents] = useState<REvent[]>(() => [ev('q'), ev('e'), ev('e'), ev('q'), ev('q', { rest: true })]);
  const { active, run, stop } = useRunner();
  const [dot, setDot] = useState(false);
  const [rest, setRest] = useState(false);
  const used = unitsOf(events);
  const left = sig.units - used;

  const sounding = events.filter((x) => !x.rest);
  const riff = sounding.map((_, i) => RIFF[i % RIFF.length]);
  const steps = riff.map(riffStep);
  const midis = riff.map(riffMidi);

  const add = (b: Base) => {
    const e = ev(b, { dot, rest });
    if (e.u > left || !Number.isInteger(e.u)) return;
    stop();
    setEvents((xs) => [...xs, e]);
  };
  const play = () => {
    const sch = schedulePattern(events, sig, bpm, { midis, metronome: true, countIn: true });
    run(sch.times, sch.endAt);
  };
  const changeSig = (id: string) => { stop(); setSigId(id); setEvents([]); };
  const fills = (b: Base) => { const e = ev(b, { dot, rest }); return e.u <= left && Number.isInteger(e.u); };

  return (
    <section className="rh-block">
      <h3 className="tx-h3">4 · Build a bar and see staff and tab together</h3>
      <p className="hint small">Choose a time signature, then add notes and rests until the bar is full. The notes you place take the next pitch of a little E-minor riff, so the staff (top) and the tab (below) always show the same notes. Notice that the tab alone gives you the strings and frets but <b>no rhythm</b>: the spacing and note shapes above are what tell you when to play.</p>
      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Time signature">
          {TIME_SIGS.slice(0, 4).map((s) => <button key={s.id} className={sigId === s.id ? 'on' : ''} onClick={() => changeSig(s.id)}>{s.label}</button>)}
        </div>
        <div className="seg">
          <button className={!rest ? 'on' : ''} onClick={() => setRest(false)}>Note</button>
          <button className={rest ? 'on' : ''} onClick={() => setRest(true)}>Rest</button>
        </div>
        <label className="check"><input type="checkbox" checked={dot} onChange={(e) => setDot(e.target.checked)} /> dotted</label>
      </div>
      <div className="palette">
        {BASES.map((b) => (
          <button key={b} className="pal" disabled={!fills(b)} onClick={() => add(b)} title={`Add ${rest ? BASE_INFO[b].restName : BASE_INFO[b].name}${dot ? ' (dotted)' : ''}`}>
            <span className="nv-glyph">{rest ? REST_GLYPH[b] : NOTE_GLYPH[b]}{dot ? '.' : ''}</span>
            <small>{BASE_INFO[b].name.replace(' note', '')}</small>
          </button>
        ))}
        <button className="pal" onClick={() => { stop(); setEvents((xs) => xs.slice(0, -1)); }} disabled={!events.length}><span className="nv-glyph">⌫</span><small>Undo</small></button>
        <button className="pal" onClick={() => { stop(); setEvents([]); }} disabled={!events.length}><span className="nv-glyph">✕</span><small>Clear</small></button>
      </div>
      <div className={`meter ${left === 0 ? 'full' : ''}`}>
        <i style={{ width: `${Math.min(100, (used / sig.units) * 100)}%` }} />
        <span>{left === 0 ? '✓ The bar is full' : `${(left / sig.group).toFixed(left % sig.group ? 2 : 0).replace(/\.?0+$/, '')} beat${left === sig.group ? '' : 's'} to fill`}</span>
      </div>
      {events.length > 0
        ? <RhythmStaff events={events} sig={sig} steps={steps} tab={riff} active={active} caption="Your bar on the staff and in tab" />
        : <p className="empty-note muted">Add a note to begin.</p>}
      <div className="start-row">
        <button className="pill accent" onClick={play} disabled={!events.length}>▶ Play with count-in</button>
        <span className="muted">{left > 0 && events.length ? 'The bar is not full yet. Playing it would leave a gap.' : 'One bar of clicks, then your rhythm.'}</span>
      </div>
    </section>
  );
}
