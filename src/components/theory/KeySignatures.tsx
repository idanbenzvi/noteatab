import { useMemo, useState } from 'react';
import { midiOf, pitchName, scaleAscending, scaleNotes, type Pitch } from '../../lib/music';
import { FLAT_ORDER, SHARP_ORDER, keyCount, majorKeyForCount, minorKeyForCount, sigLetters } from '../../lib/theory';
import { LETTERS } from '../../lib/music';
import { MiniStaff, type Clef } from './MiniStaff';
import { VoiceToggle, soundWritten, type Voice } from './common';
import TCard from './TCard';

const COUNTS = Array.from({ length: 15 }, (_, i) => i - 7);       // -7 … +7
const sigText = (c: number) => (c === 0 ? 'no ♯ or ♭' : `${Math.abs(c)} ${c > 0 ? 'sharp' : 'flat'}${Math.abs(c) > 1 ? 's' : ''}`);

export default function KeySignatures() {
  const [count, setCount] = useState(2);
  const [minor, setMinor] = useState(false);
  const [clef, setClef] = useState<Clef>('treble');
  const [voice, setVoice] = useState<Voice>('guitar');

  const major = majorKeyForCount(count);
  const minorKey = minorKeyForCount(count);
  const tonic: Pitch = minor ? minorKey : major;
  const letters = sigLetters(count).map((l) => LETTERS[l]);
  const sharp = count > 0;

  const asc = useMemo(() => scaleAscending(tonic, minor ? 'minor' : 'major').map((a) => ({ ...a, note: clef === 'bass' ? { ...a.note, oct: a.note.oct - 2 } : a.note })), [tonic, minor, clef]);
  const notes = asc.map((a, i) => ({ n: a.note, label: undefined as string | undefined, cls: (i === 0 || i === asc.length - 1) ? ('sel' as const) : undefined }));

  const play = () => asc.forEach((a, i) => soundWritten(voice, midiOf(a.note) + (clef === 'bass' ? 12 : 0), i * 0.38, 0.9));

  // how to read the signature
  let rule: string;
  if (count === 0) rule = 'No sharps or flats: the key is C major (or A minor).';
  else if (sharp) {
    const last = letters[letters.length - 1];
    rule = `Last sharp is ${last}♯. The major key is a half step above it: ${pitchName(major)} major.`;
  } else if (count === -1) rule = 'With a single flat (B♭) there is no “second-to-last” flat to read. Just remember: one flat is F major.';
  else rule = `The second-to-last flat is ${letters[letters.length - 2]}♭, which names the key: ${pitchName(major)} major.`;

  return (
    <TCard eyebrow="Reading music · 2" title="Key signatures" narrate="theory-keys" className="explainer">
      <p className="hint">A key signature collects the sharps or flats a piece uses at the start of every line, so they need not be written beside each note. Pick a key and see how the signature, the scale and the circle of fifths fit together.</p>

      <div className="key-picker" role="radiogroup" aria-label="Key signature">
        {COUNTS.map((c) => (
          <button key={c} role="radio" aria-checked={count === c} className={`key-chip ${count === c ? 'on' : ''} ${c > 0 ? 'sh' : c < 0 ? 'fl' : ''}`} onClick={() => setCount(c)}>
            <b>{pitchName(minor ? minorKeyForCount(c) : majorKeyForCount(c))}{minor ? 'm' : ''}</b>
            <small>{c === 0 ? '0' : `${Math.abs(c)}${c > 0 ? '♯' : '♭'}`}</small>
          </button>
        ))}
      </div>
      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Mode"><button className={!minor ? 'on' : ''} onClick={() => setMinor(false)}>Major</button><button className={minor ? 'on' : ''} onClick={() => setMinor(true)}>Minor</button></div>
        <div className="seg" role="radiogroup" aria-label="Clef"><button className={clef === 'treble' ? 'on' : ''} onClick={() => setClef('treble')}>𝄞 Treble</button><button className={clef === 'bass' ? 'on' : ''} onClick={() => setClef('bass')}>𝄢 Bass</button></div>
        <VoiceToggle voice={voice} onChange={setVoice} />
        <button className="pill accent" onClick={play}>▶ Hear the scale</button>
      </div>

      <MiniStaff clef={clef} keySig={count} notes={notes} names gap={58} width={680} caption={`${pitchName(tonic)} ${minor ? 'minor' : 'major'} key signature and scale`} />
      <p className="hint small">The signature is only written once, at the start. The scale below it needs <b>no accidentals beside the notes</b> because the signature already says which letters are sharp or flat.</p>

      <div className="ex-live key-readout">
        <p className="ex-live-title"><b>{pitchName(tonic)} {minor ? 'minor' : 'major'}</b> · {sigText(count)}
          {count !== 0 && <> · <span className="order">{letters.map((l) => l + (sharp ? '♯' : '♭')).join('  ')}</span></>}</p>
        <ul>
          <li>It shares its signature with <b>{pitchName(minor ? major : minorKey)} {minor ? 'major' : 'minor'}</b> (the relative {minor ? 'major' : 'minor'}, three semitones {minor ? 'up' : 'down'}).</li>
          <li>{rule}</li>
          <li>Notes of the scale: {scaleNotes(tonic, minor ? 'minor' : 'major').map((n) => <span key={n.pc} className={`acc-chip ${n.acc > 0 ? 'sharp' : n.acc < 0 ? 'flat' : ''}`}>{pitchName(n)}</span>)}</li>
        </ul>
      </div>

      <div className="ex-grid">
        <article>
          <h3>The order never changes</h3>
          <p>Sharps are always added in the order <span className="order">{SHARP_ORDER.map((l) => LETTERS[l]).join(' ')}</span> and flats in the opposite order, <span className="order">{FLAT_ORDER.map((l) => LETTERS[l]).join(' ')}</span>. A mnemonic for sharps: <i>“Father Charles Goes Down And Ends Battle.”</i> For flats just read it backwards: <i>“Battle Ends And Down Goes Charles’s Father.”</i></p>
        </article>
        <article>
          <h3>Reading a signature: sharps</h3>
          <p>Find the <b>last sharp</b> in the signature, then go up a half step: that is the major key. Sharps F♯ C♯ G♯ → last is G♯ → A major. This works because the last sharp is always the seventh note of the scale (the “leading tone”), one half step below home.</p>
        </article>
        <article>
          <h3>Reading a signature: flats</h3>
          <p>Find the <b>second-to-last flat</b>: that is the key. Flats B♭ E♭ A♭ → second-to-last is E♭ → E♭ major. (Only F major, with a single flat, breaks the pattern, so learn that one by heart.)</p>
        </article>
        <article>
          <h3>Major or minor?</h3>
          <p>One signature serves <b>two</b> keys: a major key and its relative minor, which starts on the sixth note. Look at the first and last chords, and at the notes the melody keeps returning to. If it feels like home on A rather than C, a no-sharp signature means A minor.</p>
        </article>
        <article>
          <h3>Why guitarists care</h3>
          <p>Sharp keys (G, D, A, E) are comfortable on guitar because open strings fit them; flat keys (F, B♭, E♭) are usually played with barre chords or a capo. Horn players meet the reverse: B♭ and E♭ instruments favour flat keys. The Instruments tab shows why.</p>
        </article>
      </div>
    </TCard>
  );
}
