import { useMemo, useState } from 'react';
import { STRINGS, WRITTEN_OFFSET, mod, pcOf, pitchName, type Pitch } from '../../lib/music';
import { MODES, MODE_BY_ID, modeNotes, modeParent, type ModeId } from '../../lib/theory';
import { soundReal, VoiceToggle, type Voice } from './common';
import FlatFretboard, { type Mark } from './FlatFretboard';
import TCard from './TCard';

const ROOTS: Pitch[] = [
  { l: 0, acc: 0 }, { l: 1, acc: -1 }, { l: 1, acc: 0 }, { l: 2, acc: -1 }, { l: 2, acc: 0 }, { l: 3, acc: 0 },
  { l: 3, acc: 1 }, { l: 4, acc: 0 }, { l: 5, acc: -1 }, { l: 5, acc: 0 }, { l: 6, acc: -1 }, { l: 6, acc: 0 },
];

export default function Modes() {
  const [root, setRoot] = useState<Pitch>({ l: 1, acc: 0 });
  const [mode, setMode] = useState<ModeId>('dorian');
  const [compare, setCompare] = useState(true);
  const [voice, setVoice] = useState<Voice>('guitar');

  const def = MODE_BY_ID[mode];
  const notes = useMemo(() => modeNotes(root, mode), [root, mode]);
  const parent = modeParent(root, mode);
  const byPc = new Map(notes.map((n) => [n.pc, n]));

  const marks = useMemo<Mark[]>(() => {
    const out: Mark[] = [];
    STRINGS.forEach((st, s) => {
      for (let f = 0; f <= 15; f++) {
        const n = byPc.get((st.midi + f) % 12);
        if (!n) continue;
        out.push({ s, f, kind: n.isRoot ? 'root' : compare && n.altered ? 'alt' : 'scale', label: pitchName(n) });
      }
    });
    return out;
  }, [byPc, compare]);

  const play = () => {
    const rootPc = pcOf(root);
    const base = 48 + mod(rootPc - 48, 12);
    [...def.semis, 12].forEach((o, i) => soundReal(voice, base + o, i * 0.4, 0.9));
  };

  const ladder = [...MODES].sort((a, b) => b.bright - a.bright);

  return (
    <TCard eyebrow="Pitch & harmony · 3" title="Modes: the same notes from a different home" narrate="theory-modes" className="explainer">
      <p className="hint">Play the notes of C major but treat <b>D</b> as home, and you hear a different scale: D Dorian. A <b>mode</b> is a scale made by starting a parent scale on another degree. The notes are the same; the centre of gravity moves, and with it the mood. There are seven modes, one for each degree of the major scale.</p>

      <div className="builder-bar">
        <div className="seg" role="radiogroup" aria-label="Root" style={{ flexWrap: 'wrap' }}>
          {ROOTS.map((r) => <button key={pitchName(r)} className={pcOf(root) === pcOf(r) ? 'on' : ''} onClick={() => setRoot(r)}>{pitchName(r)}</button>)}
        </div>
        <VoiceToggle voice={voice} onChange={setVoice} />
        <button className="pill accent" onClick={play}>▶ Play {pitchName(root)} {def.name}</button>
      </div>
      <div className="tabs" role="radiogroup" aria-label="Mode">
        {MODES.map((m) => <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.name}</button>)}
      </div>

      <div className="ex-live">
        <p className="ex-live-title"><b>{pitchName(root)} {def.name}</b> · {def.mood}</p>
        <ul>
          <li>Notes: {notes.map((n) => <span key={n.l} className={`acc-chip ${n.altered ? 'flat' : ''}`}>{pitchName(n)} <small style={{ color: 'var(--muted)' }}>{n.degree}</small></span>)}</li>
          <li>It is degree <b>{def.degree}</b> of <b>{pitchName(parent)} major</b>: the same seven notes, started on {pitchName(root)}. Compared with {pitchName(root)} major it {def.id === 'ionian' ? 'is the major scale itself.' : <>alters <b>{notes.filter((n) => n.altered).map((n) => n.degree).join(', ')}</b>.</>}</li>
          <li>Typical use: {def.use} Home chord: <b>{pitchName(root)}{def.chord}</b>.</li>
        </ul>
      </div>

      <div className="tx-head">
        <h3 className="tx-h3">On the neck</h3>
        <label className="check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> highlight notes that differ from major</label>
      </div>
      <FlatFretboard frets={15} marks={marks} caption={`${pitchName(root)} ${def.name} across the neck`}
        onCell={(s, f) => soundReal(voice, STRINGS[s].midi + f, 0, 1.2)} />
      <p className="hint small"><span className="dot root" /> root · <span className="dot scale" /> other scale notes{compare && <> · <span className="dot alt" /> notes lowered or raised compared with major</>}. Because the notes match {pitchName(parent)} major, any {pitchName(parent)} major shape you know already gives you {pitchName(root)} {def.name}: just <b>stress {pitchName(root)} as home</b>.</p>

      <h3 className="tx-h3">Dark to bright</h3>
      <p className="hint small">Ordered by how many notes are raised or lowered relative to the major scale. Each step down the list lowers one more note:</p>
      <div className="bright-ladder">
        {ladder.map((m) => (
          <button key={m.id} className={`bright-row ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
            <b>{m.name}</b>
            <span className="bright-bar"><i style={{ width: `${(m.bright / 7) * 100}%` }} /></span>
            <small>{modeNotes({ l: 0, acc: 0 }, m.id).filter((n) => n.altered).map((n) => n.degree).join(' ') || 'major'}</small>
          </button>
        ))}
      </div>

      <div className="ex-grid">
        <article><h3>Why “same notes” matters</h3><p>C Ionian, D Dorian, E Phrygian, F Lydian, G Mixolydian, A Aeolian and B Locrian all use the white keys. On guitar one fretboard pattern holds all seven; only the note you treat as home changes. That is why a single pattern can carry you through a whole song.</p></article>
        <article><h3>Hearing the difference</h3><p>Play the scale over a drone on the root, or a single chord. Over A minor, A Aeolian sounds plain sad; A Dorian (raised 6th, F♯) gains a hopeful lift; A Phrygian (♭2) turns Spanish and dark. The chord stays the same: the mode colours how you play over it.</p></article>
        <article><h3>Mode vs. key</h3><p>The <i>key</i> says which seven notes a piece uses; the <i>mode</i> says which note is home. D minor and D Dorian share a tonic but differ in one note (B♭ vs B♮). Pieces in a mode are also described as “modal”: they lean on the characteristic note instead of conventional tension and resolution.</p></article>
        <article><h3>Pentatonic scales and the modes</h3><p>A pentatonic scale is a mode filter: drop two notes of the parent scale and you remove the harshest ones. Minor pentatonic works over Dorian, Aeolian and Phrygian chords alike; major pentatonic over Ionian, Lydian and Mixolydian. That is why pentatonic positions are the most reliable soloing tool.</p></article>
      </div>
    </TCard>
  );
}
