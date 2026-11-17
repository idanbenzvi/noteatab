import { useMemo, useState } from 'react';
import { LETTERS, LETTER_PC, mod, noteName, pitchName, scaleNotes, type Note, type Pitch } from '../../lib/music';
import { MiniStaff } from './MiniStaff';
import PianoKeys from './PianoKeys';
import { VoiceToggle, soundWritten, type Voice } from './common';
import TCard from './TCard';

/** Every spelling (letter + up to a double accidental) of a pitch class, simplest first. */
export function spellings(pc: number): Pitch[] {
  const out: Pitch[] = [];
  for (let l = 0; l < 7; l++) for (const acc of [0, -1, 1, -2, 2]) if (mod(LETTER_PC[l] + acc, 12) === pc) out.push({ l, acc });
  return out.sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc));
}

const PAIRS: [Pitch, Pitch][] = [
  [{ l: 6, acc: 0 }, { l: 0, acc: -1 }],        // B ↔ C♭
  [{ l: 3, acc: 1 }, { l: 4, acc: -1 }],        // F♯ ↔ G♭
  [{ l: 0, acc: 1 }, { l: 1, acc: -1 }],        // C♯ ↔ D♭
];

export default function Enharmonics() {
  const [midi, setMidi] = useState(61);
  const [voice, setVoice] = useState<Voice>('piano');
  const [pair, setPair] = useState(1);
  const pc = mod(midi, 12);
  const names = useMemo(() => spellings(pc), [pc]);
  const oct = Math.floor(midi / 12) - 1;
  const notes = names.map((p, i) => {
    // the octave number follows the letter, so B♯ / C♭ spellings cross the octave boundary
    const o = oct + (p.l === 0 && p.acc < 0 && pc === 11 ? 1 : 0) + (p.l === 6 && p.acc > 0 && pc === 0 ? -1 : 0);
    const nn: Note = { l: p.l, acc: p.acc, oct: o };
    return { n: nn, label: noteName(nn), cls: (i === 0 ? 'sel' : 'alt') as 'sel' | 'alt' };
  });
  const [A, B] = PAIRS[pair];
  const sa = scaleNotes(A, 'major'), sb = scaleNotes(B, 'major');
  const accs = (s: ReturnType<typeof scaleNotes>) => s.filter((n) => n.acc !== 0).map((n) => pitchName(n)).join(', ');

  return (
    <TCard eyebrow="Reading music · 4" title="Enharmonics: one sound, two names" narrate="theory-enharmonics" className="explainer">
      <p className="hint">C♯ and D♭ are the <b>same key on the piano and the same fret on the guitar</b>, yet they are written differently. Notes (or keys) that sound identical but are spelled differently are called <b>enharmonic</b>. Click a key to see every name it can have.</p>
      <div className="builder-bar"><VoiceToggle voice={voice} onChange={setVoice} /></div>
      <PianoKeys from={60} to={83} marks={{ [midi]: { cls: 'on' }, [midi + 12]: { cls: 'on-b' } }}
        onKey={(m) => { const k = m < 72 ? m : m - 12; setMidi(k); soundWritten(voice, k); }} />
      <div className="ex-live">
        <p className="ex-live-title">This key has {names.length === 1 ? 'one name' : `${names.length} names`}:
          {names.map((p) => <span key={pitchName(p)} className={`acc-chip ${p.acc > 0 ? 'sharp' : p.acc < 0 ? 'flat' : ''}`} style={{ marginLeft: 6 }}>{pitchName(p)}</span>)}</p>
      </div>
      <MiniStaff notes={notes} gap={84} width={520} caption="All spellings of the selected key" />

      <h3 className="tx-h3">Which name do I write?</h3>
      <p className="hint small">Follow the key. A scale uses <b>each letter name exactly once</b>, so the spelling is whatever keeps that true. Compare two enharmonic keys:</p>
      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Enharmonic key pair">
          {PAIRS.map(([a, b], i) => <button key={i} className={pair === i ? 'on' : ''} onClick={() => setPair(i)}>{pitchName(a)} = {pitchName(b)}</button>)}
        </div>
      </div>
      <div className="spell-compare">
        {([[A, sa], [B, sb]] as [Pitch, ReturnType<typeof scaleNotes>][]).map(([root, sc]) => (
          <div key={pitchName(root)} className="spell-col">
            <b>{pitchName(root)} major</b>
            <div className="notes-row">
              {sc.map((n) => <span key={n.l} className={`chip ${n.isRoot ? 'root' : ''}`} style={{ minWidth: 52 }}><b>{pitchName(n)}</b><small>{LETTERS[n.l]}</small></span>)}
            </div>
          </div>
        ))}
      </div>
      <p className="hint small">Both scales sound the same, but each uses all seven letters once. {pitchName(A)} major contains {accs(sa)}; {pitchName(B)} major contains {accs(sb)}. Writing the other key’s notes would repeat a letter and skip another, which makes music harder to read.</p>

      <div className="ex-grid">
        <article><h3>Surprising enharmonics</h3><p>Even white keys can have another name: <b>E♯ = F</b>, <b>B♯ = C</b>, <b>F♭ = E</b>, <b>C♭ = B</b>. They are rare, but they appear in keys with many accidentals (F♯ major contains E♯; G♭ major contains C♭).</p></article>
        <article><h3>Double accidentals</h3><p>A double sharp (𝄪) raises a note two half steps and a double flat (𝄫) lowers it two. F𝄪 is the same pitch as G. You meet them when a key needs to sharpen a note that is already sharp, such as the 7th degree of G♯ minor.</p></article>
        <article><h3>On the guitar</h3><p>Every pitch has several homes on the neck, and each note also has several names. The 5th fret of the A string and the open D string are the same pitch on different strings. Chord and scale spellings follow the music, not the fret you press.</p></article>
        <article><h3>Rule of thumb</h3><p>Use <b>sharps</b> when going up and in sharp keys, <b>flats</b> when going down and in flat keys. If a chord or scale <i>needs</i> each letter once, spell it that way, even if it means an unusual note such as E♯.</p></article>
      </div>
    </TCard>
  );
}
