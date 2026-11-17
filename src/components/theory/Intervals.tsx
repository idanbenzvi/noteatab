import { useMemo, useState } from 'react';
import { LETTERS, STRINGS, WRITTEN_OFFSET, midiOf, noteName, spellMidi } from '../../lib/music';
import { INTERVALS, SEMIS_TO_NUMBER, intervalBetween, noteAbove } from '../../lib/theory';
import { MiniStaff } from './MiniStaff';
import FlatFretboard, { type Mark } from './FlatFretboard';
import { VoiceToggle, soundWritten, type Voice } from './common';
import TCard from './TCard';

const rel = (ds: number, df: number) => {
  const str = ds === 0 ? 'on the same string' : ds > 0 ? `${ds} string${ds > 1 ? 's' : ''} higher` : `${-ds} string${ds < -1 ? 's' : ''} lower`;
  const fr = df === 0 ? 'same fret' : df > 0 ? `${df} fret${df > 1 ? 's' : ''} up` : `${-df} fret${df < -1 ? 's' : ''} down`;
  return `${str}, ${fr}`;
};

export default function Intervals() {
  const [pos, setPos] = useState({ s: 1, f: 3 });
  const [semis, setSemis] = useState(7);
  const [harmonic, setHarmonic] = useState(false);
  const [voice, setVoice] = useState<Voice>('guitar');

  const rootMidi = STRINGS[pos.s].midi + pos.f;                    // sounding
  const rootW = rootMidi + WRITTEN_OFFSET;                         // written
  const root = spellMidi(rootW);
  const number = SEMIS_TO_NUMBER[semis];
  const top = noteAbove(root, number, semis);
  const iv = intervalBetween(root, top);
  const info = INTERVALS.find((i) => i.semis === semis)!;
  const letters = Array.from({ length: number }, (_, i) => LETTERS[(root.l + i) % 7]);

  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [{ s: pos.s, f: pos.f, kind: 'root', label: 'R' }];
    STRINGS.forEach((st, s) => {
      const f = rootMidi + semis - st.midi;
      if (f >= 0 && f <= 12 && Math.abs(f - pos.f) <= 6 && !(s === pos.s && f === pos.f)) out.push({ s, f, kind: 'alt', label: info.short });
    });
    return out;
  }, [pos, semis, rootMidi, info.short]);
  const ways = marks.filter((m) => m.kind === 'alt');

  const play = () => {
    if (harmonic) { soundWritten(voice, rootW, 0, 2); soundWritten(voice, rootW + semis, 0, 2); }
    else { soundWritten(voice, rootW, 0, 1.2); soundWritten(voice, rootW + semis, 0.6, 1.6); }
  };

  return (
    <TCard eyebrow="Pitch & harmony · 1" title="Intervals: the distance between two notes" narrate="theory-intervals" className="explainer">
      <p className="hint">An <b>interval</b> measures the distance between two notes. Everything else in music is built from them: scales are patterns of intervals, chords are stacks of them, and melodies are sequences of them. Click a note on the neck to choose the starting note, then pick an interval.</p>

      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Play as"><button className={!harmonic ? 'on' : ''} onClick={() => setHarmonic(false)}>Melodic</button><button className={harmonic ? 'on' : ''} onClick={() => setHarmonic(true)}>Harmonic</button></div>
        <VoiceToggle voice={voice} onChange={setVoice} />
        <button className="pill accent" onClick={play}>▶ Hear {iv.short}</button>
      </div>
      <div className="iv-picker" role="radiogroup" aria-label="Interval">
        {INTERVALS.slice(1).map((i) => (
          <button key={i.semis} role="radio" aria-checked={semis === i.semis} className={`key-chip ${semis === i.semis ? 'on' : ''}`} onClick={() => { setSemis(i.semis); soundWritten(voice, rootW, 0, 1.2); soundWritten(voice, rootW + i.semis, harmonic ? 0 : 0.6, 1.6); }}>
            <b>{i.short}</b><small>{i.semis} st</small>
          </button>
        ))}
      </div>

      <MiniStaff notes={[{ n: root, label: noteName(root) }, { n: top, label: noteName(top), cls: 'sel', stack: harmonic }]} gap={harmonic ? 0 : 100} width={460}
        caption={`${iv.name} above ${noteName(root)}`} />
      <div className="ex-live">
        <p className="ex-live-title"><b>{noteName(root)} → {noteName(top)}</b> is a <b>{iv.name}</b> ({iv.short}) · {semis} semitone{semis === 1 ? '' : 's'}</p>
        <ul>
          <li><b>Step 1, the number:</b> count letters including both ends: {letters.join(' ')} → that is {number === 8 ? 'an octave (8)' : `a ${number}${['', '', 'nd', 'rd', 'th', 'th', 'th', 'th'][number]}`}.</li>
          <li><b>Step 2, the quality:</b> compare the semitones with the major scale from the bottom note. {iv.quality === 'P' ? 'Unisons, 4ths, 5ths and octaves are “perfect” when they match the major scale.' : iv.quality === 'M' ? 'It matches the major scale, so it is major.' : iv.quality === 'm' ? 'It is one semitone smaller than the major interval, so it is minor.' : iv.quality === 'A' ? 'It is one semitone larger than major or perfect, so it is augmented.' : 'It is one semitone smaller than minor or perfect, so it is diminished.'}</li>
          <li><b>Sounds like:</b> {info.song}. {info.tip}</li>
        </ul>
      </div>

      <h3 className="tx-h3">On the neck</h3>
      <p className="hint small">The amber <b>R</b> is your starting note. The teal dots are the same interval above it, wherever it is within a few frets. {ways.length > 0 && <>Shapes to learn: {ways.slice(0, 3).map((m, i) => <span key={i}>{i ? '; ' : ''}<b>{rel(m.s - pos.s, m.f - pos.f)}</b></span>)}.</>}</p>
      <FlatFretboard frets={12} marks={marks} onCell={(s, f) => { setPos({ s, f }); soundWritten(voice, STRINGS[s].midi + f + WRITTEN_OFFSET, 0, 1.2); }} caption="Interval shapes on the fretboard" />
      <p className="hint small">Because the G and B strings are a major third apart (four frets) instead of a fourth (five frets), shapes that cross them shift by one fret. Every shape is movable: slide it anywhere and the interval stays the same.</p>

      <div className="ex-grid">
        <article><h3>Major, minor, perfect</h3><p>Seconds, thirds, sixths and sevenths come in <b>major</b> and <b>minor</b> sizes; the minor one is a semitone smaller. Unisons, fourths, fifths and octaves are <b>perfect</b>. Shrink a perfect or minor interval by a semitone and it becomes <b>diminished</b>; grow a perfect or major one and it becomes <b>augmented</b>.</p></article>
        <article><h3>Why spelling matters</h3><p>C to E♯ and C to F both span five semitones, yet C to E♯ is an <i>augmented 3rd</i> (letters C D E) while C to F is a <i>perfect 4th</i> (letters C D E F). The same sound can be a different interval depending on how it is written, and the letter count is what tells them apart.</p></article>
        <article><h3>Consonant and dissonant</h3><p>Perfect fifths, fourths, octaves and thirds and sixths sound stable (<i>consonant</i>). Seconds, sevenths and the tritone sound tense (<i>dissonant</i>) and want to move. The pull between tension and rest is the engine of harmony.</p></article>
        <article><h3>Interval and ear</h3><p>The song cues in the interval picker are mnemonics for your ear: sing the first two notes of the tune. Then try the <b>Interval ear training</b> game in the practice tab to test yourself.</p></article>
      </div>
    </TCard>
  );
}
